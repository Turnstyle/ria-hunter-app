import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil', // Reverted to the correct API version
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          // Use pre-configured price ID if available, otherwise use price_data
          ...(process.env.STRIPE_PRICE_ID 
            ? { price: process.env.STRIPE_PRICE_ID }
            : {
                price_data: {
                  currency: 'usd',
                  product_data: {
                    name: process.env.STRIPE_PRODUCT_NAME || 'RIA Hunter Pro',
                    description: process.env.STRIPE_PRODUCT_DESCRIPTION || 'Unlimited queries and premium features',
                  },
                  unit_amount: parseInt(process.env.STRIPE_UNIT_AMOUNT || '2000'), // $20.00 in cents
                  recurring: {
                    interval: 'month',
                  },
                },
              }),
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: parseInt(process.env.STRIPE_TRIAL_DAYS || '7'),
        metadata: {
          user_id: userId,
        },
      },
      customer_email: userEmail || undefined,
      metadata: {
        user_id: userId,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/subscription/cancel`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ 
      id: session.id,
      url: session.url 
    });

  } catch (error: any) {
    console.error('Stripe checkout session creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    }, { status: 500 });
  }
}