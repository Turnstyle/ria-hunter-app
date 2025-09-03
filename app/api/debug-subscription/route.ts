// Force Node.js runtime for full database access (fixes Edge runtime limitations)
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkUserSubscription } from '@/app/lib/subscription-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Import Stripe if available
let stripe: any = null;
try {
  const Stripe = require('stripe');
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });
} catch (e) {
  console.log('Stripe not available in debug endpoint');
}

export async function GET(request: NextRequest) {
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

    // Get subscription status using the utility function
    const subscriptionStatus = await checkUserSubscription(user.id);

    // Query the subscriptions table directly
    const { data: rawSubscription, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Also check user_profiles for stripe_customer_id
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, subscription_status, subscription_tier')
      .eq('user_id', user.id)
      .single();

    // If we have Stripe and a customer ID, check Stripe directly
    let stripeData = null;
    if (stripe && userProfile?.stripe_customer_id) {
      try {
        // Get customer from Stripe
        const customer = await stripe.customers.retrieve(userProfile.stripe_customer_id, {
          expand: ['subscriptions', 'discount']
        });

        // Get detailed subscription info
        const subscriptions = customer.subscriptions?.data || [];
        const activeSubscription = subscriptions.find((sub: any) => 
          sub.status === 'active' || sub.status === 'trialing'
        );

        stripeData = {
          customer: {
            id: customer.id,
            email: customer.email,
            discount: customer.discount,
            metadata: customer.metadata
          },
          subscriptions: subscriptions.map((sub: any) => ({
            id: sub.id,
            status: sub.status,
            current_period_end: sub.current_period_end,
            trial_end: sub.trial_end,
            items: sub.items?.data?.map((item: any) => ({
              id: item.id,
              price: {
                id: item.price.id,
                product: item.price.product,
                unit_amount: item.price.unit_amount,
                currency: item.price.currency
              }
            })),
            discount: sub.discount,
            metadata: sub.metadata
          })),
          hasActiveSubscription: !!activeSubscription,
          activeCoupon: customer.discount?.coupon || activeSubscription?.discount?.coupon
        };
      } catch (stripeError) {
        console.error('Stripe lookup error:', stripeError);
        stripeData = { error: stripeError instanceof Error ? stripeError.message : 'Stripe lookup failed' };
      }
    }

    // Determine final subscription status
    const isSubscriber = subscriptionStatus.hasActiveSubscription || 
                        (stripeData && stripeData.hasActiveSubscription) ||
                        userProfile?.subscription_status === 'active' ||
                        userProfile?.subscription_tier === 'pro';

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      subscriptionStatus,
      rawSubscription,
      userProfile,
      stripeData,
      dbError,
      finalStatus: {
        isSubscriber,
        source: isSubscriber ? (
          subscriptionStatus.hasActiveSubscription ? 'supabase_subscription' :
          stripeData?.hasActiveSubscription ? 'stripe_direct' :
          userProfile?.subscription_status === 'active' ? 'user_profile' :
          'unknown'
        ) : 'none'
      }
    });

  } catch (error) {
    console.error('Debug subscription error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
