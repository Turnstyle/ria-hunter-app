import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers as nextHeaders } from 'next/headers';
import { createClient } from '@/app/lib/supabase-server';
// Import the streaming response
const { StreamingTextResponse } = require('ai');

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await nextHeaders();
    const requestId = reqHeaders?.get?.('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Extract user credentials from cookies
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      query = '',
      searchResults = [],
    } = body;
    
    if (!query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }
    
    if (!searchResults.length) {
      return NextResponse.json({ error: 'Search results are required for context' }, { status: 400 });
    }
    
    // Check if the client supports streaming responses
    const acceptHeader = request.headers.get('accept') || '';
    const supportsStreaming = acceptHeader.includes('text/event-stream');
    
    // Build context from search results
    const context = searchResults.map((result, index) => {
      return `[${index + 1}] ${result.content} (${result.metadata.riaName}, ${result.metadata.city}, ${result.metadata.state})`;
    }).join('\n\n');
    
    // In a real implementation, we would pass the query and context to an LLM
    // For this mock implementation, we'll generate a fake answer
    
    if (supportsStreaming) {
      // Return a streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send chunks of the answer with small delays to simulate streaming
          const answer = generateMockAnswer(query, searchResults);
          const chunks = answer.split('. ');
          
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk + '. '));
            await new Promise(resolve => setTimeout(resolve, 300)); // Simulate thinking time
          }
          
          controller.close();
        }
      });
      
      return new StreamingTextResponse(stream);
    } else {
      // Return a standard JSON response
      const answer = generateMockAnswer(query, searchResults);
      
      return NextResponse.json({
        answer,
        citations: searchResults.slice(0, 3).map(result => 
          `${result.metadata.riaName} (${result.metadata.city}, ${result.metadata.state})`
        ),
        query
      });
    }
    
  } catch (error) {
    console.error('RIA answer generation error:', error);
    return NextResponse.json({ error: 'Answer generation failed' }, { status: 500 });
  }
}

// Helper function to generate a mock answer based on the query and search results
function generateMockAnswer(query: string, searchResults: any[]): string {
  const isMissouri = query.toLowerCase().includes('missouri');
  const isVcRelated = query.toLowerCase().includes('vc') || query.toLowerCase().includes('venture');
  const isExecutiveRelated = query.toLowerCase().includes('executive');
  
  // Get names for citation
  const citedFirms = searchResults.slice(0, 3).map(r => r.metadata.riaName);
  
  if (isMissouri && isVcRelated && isExecutiveRelated) {
    return `Based on the search results, there are several active RIAs in Missouri with venture capital activity. The most notable include ${citedFirms[0]}, ${citedFirms[1]}, and ${citedFirms[2]}. ${citedFirms[0]} is based in St. Louis and has a significant focus on early-stage technology investments. Their executive team includes the CEO and CIO who both have backgrounds in venture capital. ${citedFirms[1]}, located in Kansas City, specializes in Series A and B funding rounds for healthcare and biotech startups. Their managing partners have over 20 years of combined experience in venture investments. ${citedFirms[2]} focuses on seed-stage investments in the midwest region and is led by former entrepreneurs who have successfully exited multiple startups.`;
  } else if (isVcRelated) {
    return `The search results show several RIAs with significant venture capital activity. ${citedFirms[0]} stands out with the highest level of VC investments, particularly in technology and healthcare sectors. ${citedFirms[1]} has a more diverse portfolio but maintains substantial venture capital exposure, especially in early-stage startups. ${citedFirms[2]} has been increasing their venture capital allocations over the past three years, focusing on Series A and B rounds. Each of these firms has dedicated partners or teams specifically focused on venture capital investments, allowing them to provide specialized expertise to their clients interested in this asset class.`;
  } else if (isExecutiveRelated) {
    return `The key executives at the top RIAs in the search results include: At ${citedFirms[0]}, the leadership team consists of the CEO, CIO, and Managing Directors who oversee different investment strategies. ${citedFirms[1]} is led by its founding partners who have backgrounds in investment banking and portfolio management. ${citedFirms[2]} has a more corporate structure with a CEO, President, and CFO at the helm, along with sector-specific investment directors. Many of these executives have previous experience at larger financial institutions before joining or founding these RIA firms, bringing valuable industry knowledge and client relationships.`;
  } else {
    return `Based on the search results, several prominent RIAs appear in the data. ${citedFirms[0]} manages significant assets with a focus on both institutional and high-net-worth individual clients. ${citedFirms[1]} offers a range of investment strategies across various asset classes. ${citedFirms[2]} specializes in more targeted investment approaches. These firms vary in size, with assets under management ranging from hundreds of millions to several billion dollars. They also differ in their geographic focus, client types, and investment philosophies, though all maintain strong fiduciary responsibilities to their clients.`;
  }
}
