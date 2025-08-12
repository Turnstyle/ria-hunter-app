import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  // Safety guard: disable unless explicitly enabled via env
  const isEnabled = process.env.MANUAL_SUBSCRIPTION_FIX_ENABLED === 'true';
  if (!isEnabled) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const serverSupabase = getServerSupabaseClient();

    // First, check if subscription already exists
    const { data: existingSubscription, error: checkError } = await serverSupabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing subscription:', checkError);
    }

    // Manually create an active subscription for testing purposes
    // This is a temporary fix to test if the subscription logic works
    const { data: subscription, error: upsertError } = await serverSupabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_subscription_id: 'sub_test_promo_code_sub',
        stripe_customer_id: 'cus_test_customer',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        trial_end: null,
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error upserting subscription:', upsertError);
      return NextResponse.json({ 
        error: 'Failed to create subscription', 
        details: upsertError 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription created/updated successfully',
      user: {
        id: user.id,
        email: user.email
      },
      existingSubscription,
      newSubscription: subscription
    });

  } catch (error) {
    console.error('Manual subscription fix error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
