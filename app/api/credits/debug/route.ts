import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';
import { 
  getCreditsDebugInfo,
  generateStableAnonId
} from '@/app/lib/credits-ledger';

/**
 * API route for getting debug information about credits
 * GET /api/credits/debug
 * 
 * Note: This endpoint should be protected in production
 */
export async function GET(request: NextRequest) {
  // Get Supabase client and session
  const supabase = getServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  // This endpoint should only be accessible by authenticated users in production
  if (process.env.NODE_ENV === 'production' && !session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Determine the user ID (authenticated or anonymous)
  let userId: string;
  
  if (session?.user) {
    // Authenticated user
    userId = session.user.id;
  } else {
    // Anonymous user - use stable ID from cookie
    const cookiesList = request.cookies;
    const anonId = cookiesList.get('ria-hunter-anon-id')?.value;
    
    if (!anonId) {
      return NextResponse.json(
        { error: 'No anonymous ID found' },
        { status: 400 }
      );
    }
    
    // Generate stable ID from the cookie value
    userId = generateStableAnonId(anonId);
  }
  
  try {
    // Get debug information
    const debugInfo = await getCreditsDebugInfo(userId);
    
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Error getting credit debug info:', error);
    return NextResponse.json(
      { error: 'Failed to get credit debug information' },
      { status: 500 }
    );
  }
}

/**
 * API route for admin operations on credits
 * POST /api/credits/debug
 * 
 * This endpoint allows admins to add or deduct credits
 * Body: {
 *   action: 'add' | 'deduct',
 *   amount: number,
 *   targetUserId?: string,
 *   reason: string
 * }
 */
export async function POST(request: NextRequest) {
  // Get Supabase client and session
  const supabase = getServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  // This endpoint should only be accessible by admins
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Check if user is an admin
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'admin');
    
  const isAdmin = userRoles && userRoles.length > 0;
  
  if (!isAdmin && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }
  
  try {
    const body = await request.json();
    const { action, amount, targetUserId, reason } = body;
    
    if (!action || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (action !== 'add' && action !== 'deduct') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
    
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }
    
    // Determine target user
    const targetUser = targetUserId || session.user.id;
    
    // Import function dynamically to avoid circular dependencies
    const { addCredits, deductCredits } = await import('@/app/lib/credits-ledger');
    
    const idempotencyKey = `admin_${action}_${targetUser}_${Date.now()}`;
    const metadata = {
      adminUserId: session.user.id,
      reason,
      timestamp: new Date().toISOString()
    };
    
    let newBalance: number;
    
    if (action === 'add') {
      newBalance = await addCredits(targetUser, amount, {
        source: 'admin_adjust',
        refType: 'admin_adjustment',
        refId: idempotencyKey,
        idempotencyKey,
        metadata
      });
    } else {
      newBalance = await deductCredits(targetUser, amount, {
        source: 'admin_adjust',
        refType: 'admin_adjustment',
        refId: idempotencyKey,
        idempotencyKey,
        metadata
      });
    }
    
    return NextResponse.json({
      success: true,
      action,
      amount,
      userId: targetUser,
      newBalance
    });
  } catch (error: any) {
    console.error('Error performing admin credit operation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform credit operation', 
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}