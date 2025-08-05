import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Define Zod schema for the POST request body
const askBodySchema = z.object({
  query: z.string().min(1, { message: "Query cannot be empty" }),
  limit: z.number().optional().default(5),
  aiProvider: z.enum(['openai', 'vertex']).optional().default('openai'),
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

    const { query, limit, aiProvider } = validation.data;

    // Get the backend API URL from environment variables
    const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    
    if (!backendApiUrl) {
      console.error('Backend API URL not configured');
      return NextResponse.json({ 
        error: 'Backend API not configured. Please check environment variables.' 
      }, { status: 500 });
    }

    // Call the backend API
    const backendResponse = await fetch(`${backendApiUrl}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: query.trim(), 
        limit, 
        aiProvider 
      }),
    });

    if (!backendResponse.ok) {
      let errorMessage = 'Failed to process query';
      try {
        const errorData = await backendResponse.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // If we can't parse the error response, use the status text
        errorMessage = `Backend error: ${backendResponse.status} ${backendResponse.statusText}`;
      }
      
      console.error('Backend API error:', errorMessage);
      return NextResponse.json({ 
        error: errorMessage
      }, { status: backendResponse.status });
    }

    const data = await backendResponse.json();

    // Validate the backend response has the expected format
    if (!data.answer || !Array.isArray(data.sources)) {
      console.error('Unexpected backend response format:', data);
      return NextResponse.json({ 
        error: 'Received unexpected response format from backend'
      }, { status: 500 });
    }

    // Return the data with additional metadata
    return NextResponse.json({
      ...data,
      aiProvider, // Include which AI provider was used
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /api/ask:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 