import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { google } from 'ai-services'; // Google AI (Gemini) client, this is our instance from createGoogleGenerativeAI
import { chromaClient } from 'vector-store'; // ChromaDB client
import { IncludeEnum } from 'chromadb'; // Import IncludeEnum directly from chromadb
import { embed } from 'ai'; // Core function from AI SDK to generate embeddings
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

// import { createSupabaseClient } from 'supabase'; // Adjusted placeholder for Supabase client
// import { getEmbeddings, searchVectorStore } from 'ai-services'; // Adjusted placeholder for AI services

// Define Zod schema for the POST request body
const matchThesisBodySchema = z.object({
  thesisText: z.string().min(10, { message: "Thesis text must be at least 10 characters long" }), // Basic validation
});

// Zod schema for the response of the match-thesis POST endpoint
const matchThesisResponseSchema = z.object({
  message: z.string(),
  receivedThesis: z.string(),
  thesisEmbedding: z.array(z.number()).optional(),
  embeddingModel: z.string().optional(),
  embeddingError: z.string().optional(),
  extractedKeywords: z.array(z.string()),
  keywordMatches: z.array(
    z.object({
      ria_id: z.any(),
      matched_keywords: z.array(z.string()),
      score: z.number(),
    })
  ),
  semanticMatches: z.array(
    z.object({
      ria_id: z.any(),
      score: z.number().optional(),
    })
  ).optional(),
  semanticSearchError: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = matchThesisBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { thesisText } = validation.data;
    console.log('Match Thesis API called with thesis:', thesisText);

    // --- Generate Embedding for Thesis Text (Part of Phase 2 groundwork) ---
    let thesisEmbedding: number[] | undefined = undefined;
    let embeddingError: string | undefined = undefined;
    if (google) {
      try {
        const { embedding } = await embed({
          model: google.embedding('models/text-embedding-004'), // Use appropriate Google embedding model
          value: thesisText,
        });
        thesisEmbedding = embedding;
      } catch (e: any) {
        console.error('Error generating thesis embedding with Google:', e);
        embeddingError = e.message || 'Failed to generate embedding';
      }
    } else {
      embeddingError = 'Google AI client not available for embeddings.';
      console.warn(embeddingError);
    }

    // --- Phase 1: Basic Keyword/Phrase Matching ---

    // 1. Simple keyword extraction from thesisText
    const commonStopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can',
      'could', 'may', 'might', 'must', 'in', 'on', 'at', 'by', 'for', 'with',
      'about', 'against', 'between', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 's', 't', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
      'while', 'of', 'at', 'it', 'that', 'this', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    const keywords = thesisText
      .toLowerCase()
      .replace(/[\W_]+/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonStopWords.has(word));

    if (keywords.length === 0) {
      return NextResponse.json({
        message: 'No significant keywords extracted from thesis. Please provide a more specific thesis.',
        receivedThesis: thesisText,
        keywords: [],
        keywordMatches: [],
        semanticMatches: [],
        semanticSearchError: 'No significant keywords extracted from thesis.',
      });
    }

    // 2. Get Supabase client
    const supabase = getServerSupabaseClient();

    // 3. Fetch relevant narrative texts from Supabase
    // Placeholder: Assuming a table 'ria_narratives' with 'ria_id' (or 'crd_number') and 'narrative_text'
    // This will fetch ALL narratives. In a real scenario, you might want to be more selective or paginate.
    const { data: narratives, error: supabaseError } = await supabase
      .from('ria_narratives') // Replace with your actual narratives table name
      .select('ria_id, narrative_text'); // Adjust columns as needed

    if (supabaseError) {
      console.error('Supabase error fetching narratives:', supabaseError);
      return NextResponse.json({ error: 'Error fetching narrative data from Supabase', details: supabaseError.message }, { status: 500 });
    }

    if (!narratives || narratives.length === 0) {
      return NextResponse.json({
        message: 'No narratives found in the database to match against.',
        receivedThesis: thesisText,
        keywords,
        keywordMatches: [],
        semanticMatches: [],
        semanticSearchError: 'No narratives found in the database to match against.',
      });
    }

    // 4. Match keywords against the fetched narrative texts
    const matches: Array<{ ria_id: any; matched_keywords: string[]; score: number }> = [];
    narratives.forEach(narrativeEntry => {
      const narrativeContent = narrativeEntry.narrative_text ? narrativeEntry.narrative_text.toLowerCase() : '';
      const foundKeywords = new Set<string>();
      let score = 0;

      keywords.forEach(keyword => {
        if (narrativeContent.includes(keyword)) {
          foundKeywords.add(keyword);
          score++; // Simple scoring: 1 point per matched keyword
        }
      });

      if (foundKeywords.size > 0) {
        matches.push({
          ria_id: narrativeEntry.ria_id,
          matched_keywords: Array.from(foundKeywords),
          score: score,
        });
      }
    });

    // Sort matches by score (descending)
    matches.sort((a, b) => b.score - a.score);

    // Limit number of matches returned
    const limitedMatches = matches.slice(0, 20);

    // --- Phase 2: Semantic Search with ChromaDB (if thesis embedding is available) ---
    let semanticMatches: any[] = [];
    let semanticSearchError: string | undefined = undefined;
    const collectionName = 'ria_narratives_embeddings'; // Placeholder, make configurable or use constant

    if (thesisEmbedding && thesisEmbedding.length > 0) {
      try {
        console.log(`Attempting semantic search in Chroma collection: ${collectionName}`)
        const collection = await chromaClient.getCollection({ name: collectionName });

        const queryResults = await collection.query({
          queryEmbeddings: [thesisEmbedding],
          nResults: 10, // Number of results to retrieve
          // include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances] // Optional: what to include in results
        });

        // Process queryResults - structure depends on what you store and include
        // Example: queryResults.ids, queryResults.documents, queryResults.metadatas, queryResults.distances
        if (queryResults && queryResults.ids && queryResults.ids.length > 0 && queryResults.ids[0] && queryResults.ids[0].length > 0) {
          semanticMatches = queryResults.ids[0].map((id, index) => {
            const score = (queryResults.distances && queryResults.distances[0] && queryResults.distances[0][index] != null)
                          ? (1 - queryResults.distances[0][index])
                          : 0;
            // const doc = (queryResults.documents && queryResults.documents[0] && queryResults.documents[0][index] != null)
            //               ? queryResults.documents[0][index]
            //               : undefined;
            // const meta = (queryResults.metadatas && queryResults.metadatas[0] && queryResults.metadatas[0][index] != null)
            //                ? queryResults.metadatas[0][index]
            //                : undefined;
            return {
              ria_id: id,
              // document: doc,
              score: score,
              // metadata: meta
            };
          });
          semanticMatches.sort((a,b) => b.score - a.score); // Higher score is better
        } else {
          console.log('No semantic matches found in Chroma for the given thesis.');
        }

      } catch (e: any) {
        console.error('Error during ChromaDB semantic search:', e);
        semanticSearchError = e.message || 'Failed to perform semantic search';
        if (e.message && e.message.includes('CollectionNotFound')) {
            semanticSearchError = `Chroma collection '${collectionName}' not found. Please ensure ETL process has run and collection is populated.`;
        }
      }
    } else if (embeddingError) {
        semanticSearchError = `Semantic search skipped due to embedding error: ${embeddingError}`;
    } else {
        semanticSearchError = 'Semantic search skipped: No thesis embedding available.';
    }

    const responsePayload = {
      message: 'Investment Thesis Matcher results',
      receivedThesis: thesisText,
      thesisEmbedding: thesisEmbedding,
      embeddingModel: thesisEmbedding ? 'google:models/text-embedding-004' : undefined,
      embeddingError: embeddingError,
      extractedKeywords: keywords, // Phase 1 results
      keywordMatches: limitedMatches, // Phase 1 results, renamed for clarity
      semanticMatches: semanticMatches, // Phase 2 results
      semanticSearchError: semanticSearchError, // Phase 2 error info
    };

    // Validate the response payload before sending
    const validationResult = matchThesisResponseSchema.safeParse(responsePayload);
    if (!validationResult.success) {
      console.error('Match thesis response payload validation error:', validationResult.error);
      // Fallback response if our own response structure is invalid
      return NextResponse.json(
        {
          error: 'Internal server error: Invalid response structure',
          details: validationResult.error.issues
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in /api/ria-hunter/match-thesis POST:', error);
    Sentry.captureException(error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
