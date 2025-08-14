import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({
        hasActiveSubscription: false,
        status: 'no_auth',
        error: 'Missing authorization header'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({
        hasActiveSubscription: false,
        status: 'invalid_auth_format',
        error: 'Invalid authorization format'
      }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Token validation failed:', userError);
      return NextResponse.json({
        hasActiveSubscription: false,
        status: 'invalid_token',
        error: 'Invalid or expired token'
      }, { status: 401 });
    }

    const serverSupabase = getServerSupabaseClient();
    const { data: subscription, error: subError } = await serverSupabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subError && (subError as any).code !== 'PGRST116') {
      console.error('Database error fetching subscription:', subError);
    }

    if (subscription) {
      const now = new Date();

      const isActive = subscription.status === 'active' ||
                      subscription.status === 'trialing' ||
                      (subscription.status === 'past_due' &&
                       subscription.current_period_end &&
                       new Date(subscription.current_period_end) > now);

      return NextResponse.json({
        hasActiveSubscription: isActive,
        status: subscription.status,
        subscription: {
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          trialEnd: subscription.trial_end,
          stripeCustomerId: subscription.stripe_customer_id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          cancelledAt: subscription.cancelled_at
        },
        isSubscriber: isActive,
        unlimited: isActive,
        userId: user.id,
        userEmail: user.email
      });
    }

    const backendBaseUrl = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL;
    if (backendBaseUrl) {
      try {
        const url = `${backendBaseUrl.replace(/\/$/, '')}/api/subscription-status`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Authorization: authHeader },
          cache: 'no-store',
        });

        if (resp.ok) {
          const data = await resp.json();
          console.log('Using backend fallback for subscription status');
          return NextResponse.json(data);
        }
      } catch (error) {
        console.error('Backend proxy failed, using default response:', error);
      }
    }

    return NextResponse.json({
      hasActiveSubscription: false,
      status: 'none',
      subscription: null,
      isSubscriber: false,
      unlimited: false,
      userId: user.id,
      userEmail: user.email
    });

  } catch (error) {
    console.error('Unexpected error in subscription status check:', error);
    return NextResponse.json({
      error: 'Internal server error',
      hasActiveSubscription: false,
      status: 'error'
    }, { status: 500 });
  }
}
