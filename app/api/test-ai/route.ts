import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getGoogleClient } from '@/app/lib/ai-models';

export async function POST(request: NextRequest) {
  try {
    const { query = 'Hello, please introduce yourself!' } = await request.json().catch(() => ({}));
    
    const googleClient = getGoogleClient();
    
    if (!googleClient) {
      return NextResponse.json({ 
        error: 'Google AI client not configured. Please check GOOGLE_AI_STUDIO_API_KEY environment variable.' 
      }, { status: 500 });
    }

    // Test the Google AI Studio API with the Gemini model
    const result = await generateText({
      model: googleClient('gemini-1.5-flash'), // Using 1.5 Flash for better throughput
      prompt: query,
      maxTokens: 150,
    });

    return NextResponse.json({
      success: true,
      query,
      response: result.text,
      model: 'gemini-1.5-flash',
      tokenUsage: result.usage,
      provider: 'google-ai-studio'
    });

  } catch (error: any) {
    console.error('Google AI test error:', error);
    
    return NextResponse.json({
      error: 'AI test failed',
      details: error.message,
      provider: 'google-ai-studio'
    }, { status: 500 });
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'Hello, please introduce yourself!';
  
  const body = JSON.stringify({ query });
  const mockRequest = {
    json: () => Promise.resolve({ query })
  } as NextRequest;
  
  return POST(mockRequest);
}