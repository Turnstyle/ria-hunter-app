import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSupabaseClient } from '@/app/lib/supabase-server';
import { 
  addCredits, 
  recordStripeEvent, 
  isStripeEventProcessed,
  CreditsSource
} from '@/app/lib/credits-ledger';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    })
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Credit amounts for different subscription tiers
const SUBSCRIPTION_CREDITS = {
  'basic': 100,    // Basic tier: 100 credits/month
  'pro': 1000,     // Pro tier: 1000 credits/month
  'enterprise': 10000  // Enterprise tier: 10000 credits/month
};

// Default credits for new subscribers
const DEFAULT_SUBSCRIPTION_CREDITS = 100;

// Define product IDs to credit mapping
// These should match your Stripe product configuration
const PRODUCT_CREDIT_MAP: Record<string, number> = {
  // Replace with your actual product IDs
  'prod_basic': SUBSCRIPTION_CREDITS.basic,
  'prod_pro': SUBSCRIPTION_CREDITS.pro,
  'prod_enterprise': SUBSCRIPTION_CREDITS.enterprise
};

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
    await recordStripeEvent(
      err.message.includes('timestamp') ? `invalid_${Date.now()}` : 'invalid_signature',
      'signature_error',
      false,
      err.message
    );
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();

  try {
    console.log(`[Stripe Webhook] Processing event: ${event.type}`, {
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString(),
      livemode: (event as any).livemode,
    });

    // Record the event receipt
    await recordStripeEvent(event.id, event.type);

    // Check if this event has already been processed
    const isProcessed = await isStripeEventProcessed(event.id);
    if (isProcessed) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
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
          await recordStripeEvent(event.id, event.type, false, 'No user_id in metadata');
          break;
        }

        // Upsert subscription record
        console.log('[Stripe Webhook] Attempting to upsert subscription for user:', userId);
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: typeof subscription.customer === 'string' 
              ? subscription.customer 
              : subscription.customer.id,
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
          await recordStripeEvent(event.id, event.type, false, `Error upserting subscription: ${error.message}`);
        } else {
          console.log('Subscription upserted for user:', userId);
          
          // Only add credits for new or renewed subscriptions
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            // Determine number of credits to add based on the subscription
            let creditsToAdd = DEFAULT_SUBSCRIPTION_CREDITS;
            
            // Try to determine the specific product/plan
            if (subscription.items?.data?.length > 0) {
              const item = subscription.items.data[0];
              const priceId = item.price.id;
              
              // Fetch the product details
              try {
                const price = await stripe.prices.retrieve(priceId);
                const productId = typeof price.product === 'string' 
                  ? price.product 
                  : price.product.id;
                
                // Check if we have a mapping for this product
                if (PRODUCT_CREDIT_MAP[productId]) {
                  creditsToAdd = PRODUCT_CREDIT_MAP[productId];
                }
              } catch (priceError) {
                console.error('Error fetching price details:', priceError);
              }
            }
            
            // Add subscription credits to the ledger
            try {
              // If this is a renewal (not a new subscription), use the period start as the reference
              const isRenewal = event.type === 'customer.subscription.updated' && 
                               subscription.current_period_start && 
                               Date.now() / 1000 - subscription.current_period_start < 3600; // Within an hour of period start
              
              const refType = isRenewal ? 'subscription_renewal' : 'subscription_created';
              const refId = isRenewal 
                ? `${subscription.id}_${subscription.current_period_start}` 
                : subscription.id;
              
              // Make the credit operation idempotent using a stable key
              const idempotencyKey = `${event.id}_${refType}_${refId}`;
              
              await addCredits(userId, creditsToAdd, {
                source: 'subscription' as CreditsSource,
                refType,
                refId,
                idempotencyKey,
                metadata: {
                  subscriptionId: subscription.id,
                  eventId: event.id,
                  creditsAmount: creditsToAdd
                }
              });
              
              console.log(`Added ${creditsToAdd} subscription credits for user ${userId}`);
              await recordStripeEvent(event.id, event.type, true);
            } catch (creditsError) {
              console.error('Error adding subscription credits:', creditsError);
              await recordStripeEvent(event.id, event.type, false, `Error adding credits: ${creditsError.message}`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;

        if (!userId) {
          console.error('No user_id in subscription metadata');
          await recordStripeEvent(event.id, event.type, false, 'No user_id in metadata');
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
          await recordStripeEvent(event.id, event.type, false, `Error updating subscription: ${error.message}`);
        } else {
          console.log('Subscription cancelled for user:', userId);
          await recordStripeEvent(event.id, event.type, true);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          console.log('Payment succeeded for subscription:', invoice.subscription);
          
          // For subscription invoices, we handle credit updates via the subscription events
          await recordStripeEvent(event.id, event.type, true);
        } else if (invoice.customer) {
          // For one-time purchases, we could handle credit additions here
          console.log('Payment succeeded for one-time purchase');
          await recordStripeEvent(event.id, event.type, true);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        
        if (!userId) {
          console.error('No user_id in checkout session');
          await recordStripeEvent(event.id, event.type, false, 'No user_id in session');
          break;
        }
        
        // If this is a one-time purchase for credits
        if (session.mode === 'payment' && !session.subscription) {
          // Determine how many credits to add
          // This would be based on your product/line item configuration
          let creditsToAdd = 0;
          
          try {
            // If you have a credits package identifier in metadata
            if (session.metadata?.credits_amount) {
              creditsToAdd = parseInt(session.metadata.credits_amount, 10);
            } 
            // Otherwise, look up the line items
            else if (session.line_items) {
              // Direct access to line_items isn't available in webhook, need to fetch
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
              
              for (const item of lineItems.data) {
                // Match against your products/prices to determine credit amounts
                if (item.price?.metadata?.credits_amount) {
                  creditsToAdd += parseInt(item.price.metadata.credits_amount, 10) * item.quantity;
                }
              }
            }
            
            if (creditsToAdd > 0) {
              // Add one-time purchase credits
              await addCredits(userId, creditsToAdd, {
                source: 'coupon' as CreditsSource, // Using coupon as the source for one-time purchases
                refType: 'checkout_credits',
                refId: session.id,
                idempotencyKey: `checkout_${session.id}`,
                metadata: {
                  checkoutId: session.id,
                  eventId: event.id,
                  creditsAmount: creditsToAdd
                }
              });
              
              console.log(`Added ${creditsToAdd} one-time purchase credits for user ${userId}`);
              await recordStripeEvent(event.id, event.type, true);
            } else {
              console.log('No credits to add for checkout session:', session.id);
              await recordStripeEvent(event.id, event.type, true, 'No credits amount determined');
            }
          } catch (error) {
            console.error('Error processing checkout session for credits:', error);
            await recordStripeEvent(event.id, event.type, false, `Error adding credits: ${error.message}`);
          }
        } else {
          // For subscription checkouts, we handle credit updates via the subscription events
          await recordStripeEvent(event.id, event.type, true, 'Handled by subscription events');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for subscription:', invoice.subscription);
        
        // Record the failed payment, but don't take any action on credits yet
        await recordStripeEvent(event.id, event.type, true, 'Payment failed');
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        await recordStripeEvent(event.id, event.type, true, 'Unhandled event type');
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    await recordStripeEvent(
      event?.id || `error_${Date.now()}`, 
      event?.type || 'processing_error',
      false,
      error.message
    );
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}