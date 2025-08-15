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
      
      // Debug logging for promotional subscription diagnosis
      console.log('Subscription data found:', {
        userId: user.id,
        subscriptionId: subscription.stripe_subscription_id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
        cancelledAt: subscription.cancelled_at,
        createdAt: subscription.created_at
      });

      // Fix: Comprehensive subscription status check that handles promotional subscriptions
      // This ensures promotional subscriptions (with $0 billing) are correctly recognized as Pro
      const isActive = subscription.status === 'active' ||
                      subscription.status === 'trialing' ||
                      (subscription.status === 'past_due' &&
                       subscription.current_period_end &&
                       new Date(subscription.current_period_end) > now);

      console.log('Pro subscription determination:', {
        isActive,
        status: subscription.status,
        isPromotional: true, // Assume this could be promotional
        shouldHaveUnlimitedAccess: isActive
      });

      const response = {
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
        isSubscriber: isActive,  // Key fix: base this purely on subscription status
        unlimited: isActive,     // Pro users get unlimited access regardless of billing amount
        userId: user.id,
        userEmail: user.email
      };

      console.log('Subscription status response:', response);
      return NextResponse.json(response);
    }

    // Debug logging for no local subscription case
    console.log('No subscription found in Supabase for user:', user.id);

    const backendBaseUrl = process.env.RIA_HUNTER_BACKEND_URL;
    if (backendBaseUrl) {
      try {
        console.log('Attempting backend fallback for subscription status');
        const url = `${backendBaseUrl.replace(/\/$/, '')}/api/subscription-status`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Authorization: authHeader },
          cache: 'no-store',
        });

        if (resp.ok) {
          const data = await resp.json();
          console.log('Backend fallback subscription data:', data);
          
          // Only use backend fallback if it indicates an active subscription
          // This prevents backend from incorrectly overriding valid local subscription data
          if (data.hasActiveSubscription || data.isSubscriber || data.unlimited) {
            console.log('Using backend fallback - found active subscription');
            return NextResponse.json(data);
          } else {
            console.log('Backend fallback shows no active subscription, using local default');
          }
        } else {
          console.log('Backend fallback failed with status:', resp.status);
        }
      } catch (error) {
        console.error('Backend proxy failed:', error);
      }
    } else {
      console.log('No backend URL configured, using local default response');
    }

    const defaultResponse = {
      hasActiveSubscription: false,
      status: 'none',
      subscription: null,
      isSubscriber: false,
      unlimited: false,
      userId: user.id,
      userEmail: user.email
    };

    console.log('Returning default subscription response:', defaultResponse);
    return NextResponse.json(defaultResponse);

  } catch (error) {
    console.error('Unexpected error in subscription status check:', error);
    return NextResponse.json({
      error: 'Internal server error',
      hasActiveSubscription: false,
      status: 'error'
    }, { status: 500 });
  }
}
