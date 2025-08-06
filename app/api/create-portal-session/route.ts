import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  console.log('Create portal session request received');
  try {
    if (!stripe) {
      console.error('Stripe not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('Authorization header missing');
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Failed to get user from token:', userError);
      return NextResponse.json({ error: 'Failed to authenticate user' }, { status: 401 });
    }

    // Get the user's subscription to find their Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      console.error('No subscription found for user:', subError);
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Create the portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/usage-billing`,
    });

    console.log('Portal session created:', portalSession.id);

    return NextResponse.json({ 
      url: portalSession.url 
    });

  } catch (error: any) {
    console.error('Portal session creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create portal session',
      details: error.message 
    }, { status: 500 });
  }
}