// app/api/ria-profile/[id]/route.ts
// Proxy endpoint for RIA profiles - replaces deprecated /api/v1/ria/profile
// This ensures we're using the correct backend endpoint

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Get the auth header if present
    const authHeader = request.headers.get('authorization');
    
    // Forward the request to the backend
    // Use the backend URL from environment or fallback to the API
    const backendUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || 
                      process.env.RIA_HUNTER_API_URL || 
                      'https://api.riahunter.com';
    
    // Call the actual backend endpoint
    const response = await fetch(`${backendUrl}/api/ria/profile/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
      },
      cache: 'no-store',
    });
    
    // If the profile is not found, return 404
    if (response.status === 404) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }
    
    // If there's an error from the backend, pass it through
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend profile fetch error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: response.status }
      );
    }
    
    // Parse the response
    const data = await response.json();
    
    // Return the profile data
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching RIA profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
