import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define Zod schema for the POST request body
const askBodySchema = z.object({
  query: z.string().min(1, { message: "Query cannot be empty" }),
  limit: z.number().optional().default(5),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = askBodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        issues: validation.error.issues 
      }, { status: 400 });
    }

    const { query, limit } = validation.data;

    // Transform the natural language query into an investment thesis
    // This is a simple transformation - in production, you might use AI to enhance this
    const thesis = query;

    // Call the match-thesis endpoint
    const matchThesisResponse = await fetch(`${request.nextUrl.origin}/api/ria-hunter/match-thesis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ thesis }),
    });

    if (!matchThesisResponse.ok) {
      const errorData = await matchThesisResponse.json();
      return NextResponse.json({ 
        error: errorData.error || 'Failed to process query' 
      }, { status: matchThesisResponse.status });
    }

    const matchData = await matchThesisResponse.json();

    // Transform the match-thesis response into the expected format
    // Extract RIA information from the matches
    const sources = [];
    
    // Combine keyword and semantic matches
    const allMatches = [
      ...(matchData.keywordMatches || []),
      ...(matchData.semanticMatches || [])
    ];

    // Sort by score and take top results
    const topMatches = allMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // For now, we'll create a simple answer based on the query and matches
    let answer = `Based on your query "${query}", `;
    
    if (topMatches.length === 0) {
      answer += "I couldn't find any matching RIAs in our database.";
    } else {
      answer += `I found ${topMatches.length} relevant RIA${topMatches.length > 1 ? 's' : ''} that match your criteria.`;
      
      if (matchData.keywords && matchData.keywords.length > 0) {
        answer += ` Key factors considered: ${matchData.keywords.join(', ')}.`;
      }
    }

    // Transform matches into sources format
    // Note: In a real implementation, you would fetch the actual RIA details
    const sources = topMatches.map(match => ({
      firm_name: `RIA ${match.ria_id}`, // Placeholder - would fetch real name
      crd_number: match.ria_id.toString(),
      city: "Unknown", // Would fetch from database
      state: "Unknown", // Would fetch from database
      aum: null, // Would fetch from database
      matched_keywords: match.matched_keywords || [],
      score: match.score
    }));

    return NextResponse.json({
      answer,
      sources,
      query,
      keywords: matchData.keywords || []
    });

  } catch (error) {
    console.error('Error in /api/ask:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 