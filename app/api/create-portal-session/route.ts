import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the user token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get the user's subscription to find their Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let stripeCustomerId: string | null = null;

    if (subscription?.stripe_customer_id) {
      stripeCustomerId = subscription.stripe_customer_id;
      console.log('Found Stripe customer ID in Supabase:', stripeCustomerId);
    } else {
      console.log('No subscription found in Supabase, attempting Stripe direct lookup');
      
      // CRITICAL FIX: Direct Stripe lookup for promotional subscriptions
      // This handles cases where subscription exists in Stripe but not in Supabase
      if (user.email) {
        try {
          // Find customer by email in Stripe
          const customers = await stripe.customers.list({
            email: user.email,
            limit: 1,
          });

          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id;
            console.log('Found Stripe customer via direct lookup:', stripeCustomerId);
          } else {
            console.log('No Stripe customer found for email:', user.email);
          }
        } catch (stripeError) {
          console.error('Stripe direct lookup failed:', stripeError);
        }
      }
    }

    if (!stripeCustomerId) {
      console.error('No Stripe customer ID found for user:', user.id);
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.ria-hunter.app'}/usage-billing`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}