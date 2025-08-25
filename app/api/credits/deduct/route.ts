// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';
import { 
  deductCredits,
  getCreditsStatus,
  generateStableAnonId,
  CreditsSource
} from '@/app/lib/credits-ledger';

/**
 * API route for deducting credits for API usage
 * POST /api/credits/deduct
 * 
 * Body: {
 *   amount: number,           // Amount to deduct
 *   refType: string,          // Reference type (e.g., 'ask', 'search')
 *   refId: string,            // Reference ID for the operation
 *   idempotencyKey?: string,  // Optional idempotency key
 *   metadata?: object         // Optional metadata
 * }
 */
export async function POST(request: NextRequest) {
  // Get Supabase client and session
  const supabase = getServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let userId: string;
  
  // Determine the user ID (authenticated or anonymous)
  if (session?.user) {
    // Authenticated user
    userId = session.user.id;
  } else {
    // Anonymous user - use stable ID from cookie
    const cookiesList = request.cookies;
    const anonId = cookiesList.get('ria-hunter-anon-id')?.value;
    
    if (!anonId) {
      return NextResponse.json(
        { error: 'No anonymous ID found', code: 'NO_ANON_ID' },
        { status: 400 }
      );
    }
    
    // Generate stable ID from the cookie value
    userId = generateStableAnonId(anonId);
  }
  
  try {
    // Parse request body
    const body = await request.json();
    const { amount, refType, refId, idempotencyKey, metadata } = body;
    
    // Validate required fields
    if (!amount || !refType || !refId) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }
    
    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }
    
    // Check current credits and subscription status
    const { credits, isSubscriber } = await getCreditsStatus(userId);
    
    // Subscribers don't need to deduct credits
    if (isSubscriber) {
      return NextResponse.json({
        success: true,
        deducted: 0,
        remaining: credits,
        isSubscriber: true
      });
    }
    
    // Check if user has enough credits
    if (credits < amount) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits', 
          code: 'INSUFFICIENT_CREDITS',
          credits,
          remaining: credits, // Keep for backwards compatibility
          requested: amount
        },
        { status: 402 }
      );
    }
    
    // Deduct credits
    const newBalance = await deductCredits(userId, amount, {
      source: CreditsSource.USAGE,
      refType,
      refId,
      idempotencyKey: idempotencyKey || `${refType}_${refId}_${Date.now()}`,
      metadata: metadata || {}
    });
    
    return NextResponse.json({
      success: true,
      deducted: amount,
      credits: newBalance, // Use the standardized field name
      remaining: newBalance, // Keep for backwards compatibility
      isSubscriber: false
    });
  } catch (error: any) {
    console.error('Error deducting credits:', error);
    
    if (error.message?.includes('Insufficient credits')) {
      return NextResponse.json(
        { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to deduct credits', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}