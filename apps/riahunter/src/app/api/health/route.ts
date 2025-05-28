import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define Zod schema for the health check response
const healthResponseSchema = z.object({
  status: z.literal('healthy'),
  timestamp: z.string().datetime(),
  version: z.string(),
});

export async function GET() {
  const responsePayload = {
    status: 'healthy' as const, // Ensure literal type for Zod
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
  };

  // Validate the response payload before sending
  const validationResult = healthResponseSchema.safeParse(responsePayload);

  if (!validationResult.success) {
    console.error('Health check response payload validation error:', validationResult.error);
    // In a real scenario, you might also send this error to Sentry
    return NextResponse.json(
      {
        error: 'Internal server error: Invalid health check response structure',
        details: validationResult.error.issues
      },
      { status: 500 }
    );
  }

  return NextResponse.json(validationResult.data, { status: 200 });
}
