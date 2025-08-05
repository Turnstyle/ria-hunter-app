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
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status, trial_end, current_period_end')
      .eq('user_id', userId)
      .single();

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
                    (subscription.status === 'past_due' && subscription.current_period_end && new Date(subscription.current_period_end) > now);

    return {
      hasActiveSubscription: isActive,
      status: subscription.status,
      trialEnd: subscription.trial_end,
      currentPeriodEnd: subscription.current_period_end
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