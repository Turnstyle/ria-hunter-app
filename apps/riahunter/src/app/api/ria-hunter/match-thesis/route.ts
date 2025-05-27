import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from 'supabase/server';
import { google } from 'ai-services'; // Google AI (Gemini) client, this is our instance from createGoogleGenerativeAI
import { chromaClient } from 'vector-store'; // ChromaDB client
import { IncludeEnum } from 'chromadb'; // Import IncludeEnum directly from chromadb
import { embed } from 'ai'; // Core function from AI SDK to generate embeddings

// import { createSupabaseClient } from 'supabase'; // Adjusted placeholder for Supabase client
// import { getEmbeddings, searchVectorStore } from 'ai-services'; // Adjusted placeholder for AI services

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userThesis = body.thesis; // Assuming the frontend sends a JSON with a 'thesis' field

    if (!userThesis || typeof userThesis !== 'string') {
      return NextResponse.json({ error: 'Investment thesis (string) is required' }, { status: 400 });
    }

    // --- AI Processing: Embedding Generation ---
    if (!google) {
      console.error('Google AI client not initialized. Check GOOGLE_API_KEY.');
      return NextResponse.json({ error: 'AI service not available' }, { status: 503 });
    }

    // Ensure the google client has the textEmbeddingModel method and it's used correctly.
    // The model ID 'text-embedding-004' is a common one for Google.
    // Other models like 'models/embedding-001' might also work but 'text-embedding-004' is explicitly shown with textEmbeddingModel.
    const embeddingModel = google.textEmbeddingModel('text-embedding-004');

    const { embedding } = await embed({
      model: embeddingModel,
      value: userThesis,
    });
    // const thesisEmbedding = embedding; // If you need to store it in a differently named var
    console.log('User Thesis:', userThesis);
    console.log('Generated Thesis Embedding (first 3 values):', embedding?.slice(0, 3));

    // --- Vector Store Search (ChromaDB Example) ---
    // 2. Search your ChromaDB collection.
    //    The ETL process should have already populated this collection.
    // TODO: Replace 'your_chroma_collection_name' with your actual collection name.
    const collectionName = 'appfoundation-rag-collection'; // Updated collection name
    let matchedRiaNarratives = [];
    try {
      const collection = await chromaClient.getCollection({ name: collectionName });
      const queryResults = await collection.query({
        queryEmbeddings: [embedding],
        nResults: 10, // Number of results to retrieve
        include: [IncludeEnum.Metadatas, IncludeEnum.Documents, IncludeEnum.Distances] // Use IncludeEnum
      });

      // Safely access ChromaDB results
      const ids = queryResults.ids?.[0] || [];
      const metadatas = queryResults.metadatas?.[0] || [];
      const documents = queryResults.documents?.[0] || [];
      const distances = queryResults.distances?.[0] || [];

      matchedRiaNarratives = ids.map((id, index) => ({
        id: id,
        riaId: metadatas[index]?.ria_id as string | undefined, // Assuming metadata has ria_id
        narrativeSnippet: documents[index] as string | undefined,
        score: distances[index] as number | undefined, // Lower distance is better
      })).filter(match => !!match.riaId); // Ensure riaId is present

    } catch (chromaError) {
      console.error(`Error querying ChromaDB collection '${collectionName}':`, chromaError);
      return NextResponse.json({ error: 'Error searching vector store', details: chromaError instanceof Error ? chromaError.message : String(chromaError) }, { status: 500 });
    }
    console.log('Matched RIA Narratives from Chroma:', matchedRiaNarratives);

    // --- Supabase Query for Detailed RIA Data ---
    // 3. For each matched RIA, fetch more detailed information from Supabase.
    let detailedMatches = [...matchedRiaNarratives]; // Initialize with Chroma results
    const riaIdsToFetch = matchedRiaNarratives.map(match => match.riaId).filter(id => !!id) as string[];

    if (riaIdsToFetch.length > 0) {
      const supabase = getServerSupabaseClient();
      // TODO: Replace 'your_ria_table_name' and column names with your actual Supabase schema
      const { data: riaDetails, error: supabaseError } = await supabase
        .from('sec_advisers_test') // <--- Updated with actual table name
        .select('org_pk:id, managesprivatefunds, is_private_fund_related') // <--- Updated with actual columns, aliasing org_pk to id
        .in('org_pk', riaIdsToFetch); // <--- Updated to use org_pk for filtering

      if (supabaseError) {
        console.error('Supabase error fetching RIA details:', supabaseError);
        // Non-fatal: proceed with matches but note that details might be missing for some
        // detailedMatches will remain as is (just Chroma data)
      } else if (riaDetails) {
        // Merge Supabase details back into the matched narratives
        detailedMatches = matchedRiaNarratives.map(match => ({
          ...match,
          // Assumes match.riaId from ChromaDB corresponds to org_pk
          // Supabase result will have org_pk as the key, even with aliasing for the final structure
          details: riaDetails.find(detail => detail.org_pk === match.riaId) || null,
        }));
      }
    }
    console.log('Detailed Matches (Chroma + Supabase):', detailedMatches);

    return NextResponse.json({
      message: "Investment thesis processed",
      userThesis: userThesis,
      matches: detailedMatches,
    });

  } catch (error) {
    console.error('Error in /api/ria-hunter/match-thesis:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
