import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!stripe || !endpointSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    console.log(`[Stripe Webhook] Processing event: ${event.type}`, {
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString(),
      livemode: (event as any).livemode,
    });
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any; // Using any to avoid type issues with Stripe API versions
        const userId = subscription.metadata?.user_id;
        console.log(`[Stripe Webhook] Processing subscription ${event.type}:`, {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          userId: userId,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
          metadata: subscription.metadata,
        });
        if (!userId) {
          console.error('[Stripe Webhook] CRITICAL: No user_id in subscription metadata:', {
            subscriptionId: subscription.id,
            metadata: subscription.metadata,
            customer: subscription.customer,
          });
          break;
        }

        // Upsert subscription record
        console.log('[Stripe Webhook] Attempting to upsert subscription for user:', userId);
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            status: subscription.status,
            current_period_start: subscription.current_period_start 
              ? new Date(subscription.current_period_start * 1000).toISOString() 
              : null,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            trial_end: subscription.trial_end 
              ? new Date(subscription.trial_end * 1000).toISOString() 
              : null,
          }, {
            onConflict: 'user_id'
          });

        if (error) {
          console.error('Error upserting subscription:', error);
        } else {
          console.log('Subscription upserted for user:', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error('No user_id in subscription metadata');
          break;
        }

        // Update subscription status to cancelled
        const { error } = await supabase
          .from('subscriptions')
          .update({ 
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Error updating cancelled subscription:', error);
        } else {
          console.log('Subscription cancelled for user:', userId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          console.log('Payment succeeded for subscription:', invoice.subscription);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        console.log('Payment failed for subscription:', invoice.subscription);
        // You might want to notify the user or update the subscription status
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
