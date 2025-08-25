import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';
import { 
  getCreditsStatus,
  generateStableAnonId,
  initializeUserCredits
} from '@/app/lib/credits-ledger';

/**
 * API route for getting a user's credit balance
 * GET /api/credits/balance
 */
export async function GET(request: NextRequest) {
  // Get Supabase client and session
  const supabase = getServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let userId: string;
  let isNewUser = false;
  
  // Determine the user ID (authenticated or anonymous)
  if (session?.user) {
    // Authenticated user
    userId = session.user.id;
  } else {
    // Anonymous user - use stable ID from cookie
    const cookieStore = cookies();
    let anonId = cookieStore.get('ria-hunter-anon-id')?.value;
    
    if (!anonId) {
      // Create a new anonymous ID
      anonId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      // Set cookie for 30 days
      cookieStore.set('ria-hunter-anon-id', anonId, { 
        expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
      });
      isNewUser = true;
    }
    
    // Generate stable ID from the cookie value
    userId = generateStableAnonId(anonId);
  }
  
  try {
    // For new anonymous users, initialize with free credits
    if (isNewUser) {
      await initializeUserCredits(userId, 5); // Start with 5 free credits
    }
    
    // Get current balance and subscription status
    const { balance, isSubscriber } = await getCreditsStatus(userId);
    
    return NextResponse.json({
      credits: balance,
      isSubscriber,
      userId: session?.user ? userId : undefined // Only return userId for authenticated users
    });
  } catch (error) {
    console.error('Error getting credit balance:', error);
    return NextResponse.json(
      { error: 'Failed to get credit balance' },
      { status: 500 }
    );
  }
}
