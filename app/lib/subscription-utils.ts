import { getServerSupabaseClient } from './supabase-server';

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

export async function checkUserSubscription(userId: string): Promise<SubscriptionStatus> {
  const supabase = getServerSupabaseClient();
  
  try {
    // Try with all columns first, fall back to basic columns if schema differs
    let subscription, error;
    try {
      const result = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .single();
      subscription = result.data;
      error = result.error;
    } catch (schemaError) {
      console.error('Schema error, falling back to basic query:', schemaError);
      const result = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();
      subscription = result.data;
      error = result.error;
    }

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking subscription:', error);
      return {
        hasActiveSubscription: false,
        status: null,
        trialEnd: null,
        currentPeriodEnd: null
      };
    }

    if (!subscription) {
      return {
        hasActiveSubscription: false,
        status: null,
        trialEnd: null,
        currentPeriodEnd: null
      };
    }

    const now = new Date();
    const isActive = subscription.status === 'active' || 
                    subscription.status === 'trialing' ||
                    (subscription.status === 'past_due' && (subscription as any).current_period_end && new Date((subscription as any).current_period_end) > now);

    return {
      hasActiveSubscription: isActive,
      status: subscription.status,
      trialEnd: (subscription as any).trial_end || null,
      currentPeriodEnd: (subscription as any).current_period_end || null
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return {
      hasActiveSubscription: false,
      status: null,
      trialEnd: null,
      currentPeriodEnd: null
    };
  }
}