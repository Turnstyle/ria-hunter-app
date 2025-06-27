import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { z } from 'zod';
import { google } from 'ai-services';
import { generateText, embed } from 'ai'; // Include embed for generating embeddings
import * as Sentry from "@sentry/nextjs";
import { ChromaApi, OpenAIEmbeddingFunction } from 'chromadb';

// Define Zod schema for the POST request body
const postBodySchema = z.object({
  thesis: z.string().min(1, { message: "Investment thesis cannot be empty" }),
});

// Define schema for the response
const matchResultSchema = z.object({
  ria_id: z.union([z.string(), z.number()]),
  matched_keywords: z.array(z.string()),
  score: z.number(),
});

const thesisMatchResponseSchema = z.object({
  receivedThesis: z.string(),
  keywords: z.array(z.string()),
  keywordMatches: z.array(matchResultSchema),
  semanticMatches: z.array(z.object({
    ria_id: z.union([z.string(), z.number()]),
    score: z.number(),
  })),
  semanticSearchError: z.string().optional(),
});

// Initialize ChromaDB client (if available)
let chromaClient: ChromaApi | null = null;
try {
  // This would be configured based on your Chroma setup
  // chromaClient = new ChromaApi({ path: process.env.CHROMA_URL });
} catch (error) {
  console.warn('ChromaDB client not available:', error);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = postBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: validation.error.issues }, { status: 400 });
    }

    const { thesis: thesisText } = validation.data;
    console.log('Received investment thesis:', thesisText);

    // Try to generate thesis embedding for semantic search
    let thesisEmbedding: number[] | null = null;
    try {
      if (google) {
        const { embedding } = await embed({
          model: google('embedding-001'), // Use Google's embedding model
          value: thesisText,
        });
        thesisEmbedding = embedding;
        console.log('Generated thesis embedding, dimension:', embedding.length);
      }
    } catch (embeddingError) {
      console.warn('Failed to generate thesis embedding:', embeddingError);
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

    // 3. Fetch relevant narrative texts from Supabase using real schema
    const { data: narratives, error: supabaseError } = await supabase
      .from('narratives')
      .select(`
        narrative_id,
        cik,
        narrative_type,
        narrative_text,
        advisers:advisers!inner(
          legal_name,
          main_addr_city,
          main_addr_state
        )
      `);

    if (supabaseError) {
      console.error('Supabase error fetching narratives:', supabaseError);
      Sentry.captureException(supabaseError);
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
          ria_id: narrativeEntry.cik,
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
    const collectionName = 'ria_narratives_embeddings';

    if (thesisEmbedding && thesisEmbedding.length > 0 && chromaClient) {
      try {
        console.log(`Attempting semantic search in Chroma collection: ${collectionName}`)
        const collection = await chromaClient.getCollection({ name: collectionName });

        const queryResults = await collection.query({
          queryEmbeddings: [thesisEmbedding],
          nResults: 10, // Number of results to retrieve
        });

        // Process queryResults
        if (queryResults && queryResults.ids && queryResults.ids.length > 0 && queryResults.ids[0] && queryResults.ids[0].length > 0) {
          semanticMatches = queryResults.ids[0].map((id, index) => {
            const score = (queryResults.distances && queryResults.distances[0] && queryResults.distances[0][index] != null)
                          ? (1 - queryResults.distances[0][index])
                          : 0;
            return {
              ria_id: id,
              score: score,
            };
          });
          semanticMatches.sort((a,b) => b.score - a.score); // Higher score is better
        } else {
          console.log('No semantic matches found in Chroma for the given thesis.');
        }
      } catch (chromaError) {
        console.error('Error during Chroma semantic search:', chromaError);
        semanticSearchError = `Chroma search failed: ${chromaError instanceof Error ? chromaError.message : 'Unknown error'}`;
      }
    } else if (!thesisEmbedding) {
      semanticSearchError = 'Could not generate embedding for thesis text.';
    } else if (!chromaClient) {
      semanticSearchError = 'ChromaDB client not available.';
    }

    const responsePayload = {
      receivedThesis: thesisText,
      keywords,
      keywordMatches: limitedMatches,
      semanticMatches,
      semanticSearchError,
    };

    // Validate the response payload
    const validationResult = thesisMatchResponseSchema.safeParse(responsePayload);

    if (!validationResult.success) {
      console.error('Thesis match response validation error:', validationResult.error.issues);
      Sentry.captureException(new Error('Thesis match response validation failed'), {
        extra: { issues: validationResult.error.issues, originalPayload: responsePayload },
      });
      return NextResponse.json(
        {
          error: 'Invalid data structure for thesis match response',
          details: validationResult.error.issues,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validationResult.data);

  } catch (error) {
    console.error('Error in /api/ria-hunter/match-thesis POST:', error);
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
