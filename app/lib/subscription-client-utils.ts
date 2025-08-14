export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

export function normalizeSubscriptionResponse(data: any): SubscriptionStatus {
  const hasActive = typeof data?.hasActiveSubscription === 'boolean'
    ? data.hasActiveSubscription
    : Boolean(data?.isSubscriber || data?.unlimited);

  const status = data?.status
    || data?.subscription?.status
    || data?.subscriptionStatus?.status
    || data?.rawSubscription?.status
    || null;

  const trialEnd = data?.subscription?.trialEnd
    || data?.subscriptionStatus?.trial_end
    || data?.rawSubscription?.trial_end
    || null;

  const currentPeriodEnd = data?.subscription?.currentPeriodEnd
    || data?.current_period_end
    || data?.subscription?.current_period_end
    || data?.subscriptionStatus?.current_period_end
    || data?.rawSubscription?.current_period_end
    || null;

  return {
    hasActiveSubscription: hasActive,
    status,
    trialEnd,
    currentPeriodEnd,
  };
}

export function getSubscriptionSystemHealth(userId: string) {
  return {
    isCircuitOpen: false,
    backoffTime: 0,
  };
}
