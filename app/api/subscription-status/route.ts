import { NextRequest, NextResponse } from 'next/server';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Extract user ID from the Bearer token (simplified approach)
    // In a real app, you'd validate the token properly
    const userId = authHeader.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid authorization header' },
        { status: 401 }
      );
    }

    const subscriptionStatus = await checkUserSubscription(userId);
    
    return NextResponse.json(subscriptionStatus);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}