import { getServerSupabaseClient } from './supabase-server';

export interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

// Circuit breaker implementation to prevent infinite loops
class SubscriptionCircuitBreaker {
  private static instance: SubscriptionCircuitBreaker;
  private failures = new Map<string, { count: number; lastFailure: number; backoffUntil: number }>();
  private readonly maxFailures = 3;
  private readonly baseBackoffMs = 1000; // Start with 1 second
  private readonly maxBackoffMs = 60000; // Max 1 minute
  private readonly resetTimeMs = 300000; // Reset after 5 minutes
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionCircuitBreaker();
    }
    return this.instance;
  }

  isCircuitOpen(userId: string): boolean {
    const failure = this.failures.get(userId);
    if (!failure) return false;

    const now = Date.now();
    
    // Reset circuit if enough time has passed
    if (now - failure.lastFailure > this.resetTimeMs) {
      this.failures.delete(userId);
      return false;
    }

    // Check if we're still in backoff period
    return now < failure.backoffUntil;
  }

  recordFailure(userId: string) {
    const now = Date.now();
    const failure = this.failures.get(userId) || { count: 0, lastFailure: 0, backoffUntil: 0 };
    
    failure.count++;
    failure.lastFailure = now;
    
    // Calculate exponential backoff
    const backoffMs = Math.min(
      this.baseBackoffMs * Math.pow(2, failure.count - 1),
      this.maxBackoffMs
    );
    
    failure.backoffUntil = now + backoffMs;
    this.failures.set(userId, failure);
    
    console.warn(`Circuit breaker: User ${userId} failed ${failure.count} times, backing off for ${backoffMs}ms`);
  }

  recordSuccess(userId: string) {
    this.failures.delete(userId);
  }

  getBackoffTime(userId: string): number {
    const failure = this.failures.get(userId);
    if (!failure) return 0;
    
    return Math.max(0, failure.backoffUntil - Date.now());
  }
}

// Rate limiter to prevent too many concurrent requests
class SubscriptionRateLimiter {
  private static instance: SubscriptionRateLimiter;
  private activeRequests = new Map<string, number>();
  private lastRequestTime = new Map<string, number>();
  private readonly maxConcurrentRequests = 2;
  private readonly minTimeBetweenRequests = 1000; // 1 second

  static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionRateLimiter();
    }
    return this.instance;
  }

  async acquire(userId: string): Promise<void> {
    const now = Date.now();
    const activeCount = this.activeRequests.get(userId) || 0;
    const lastRequest = this.lastRequestTime.get(userId) || 0;

    // Check concurrent requests
    if (activeCount >= this.maxConcurrentRequests) {
      throw new Error('Too many concurrent subscription requests');
    }

    // Check time-based rate limit
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < this.minTimeBetweenRequests) {
      const waitTime = this.minTimeBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.activeRequests.set(userId, activeCount + 1);
    this.lastRequestTime.set(userId, Date.now());
  }

  release(userId: string) {
    const activeCount = this.activeRequests.get(userId) || 0;
    if (activeCount > 0) {
      this.activeRequests.set(userId, activeCount - 1);
    }
  }
}

async function querySubscriptionWithRetry(userId: string, retryCount = 0): Promise<any> {
  const supabase = getServerSupabaseClient();
  const maxRetries = 2;
  
  try {
    // Try with all required columns first
    const result = await supabase
      .from('subscriptions')
      .select('status, current_period_start, current_period_end, trial_end, stripe_subscription_id, stripe_customer_id')
      .eq('user_id', userId)
      .single();
      
    if (result.error && result.error.code !== 'PGRST116') {
      throw result.error;
    }
    
    return { data: result.data, error: result.error };
  } catch (error: any) {
    // If schema error, try fallback query
    if (error.message?.includes('column') && retryCount === 0) {
      console.warn('Schema mismatch, trying fallback query:', error.message);
      try {
        const fallbackResult = await supabase
          .from('subscriptions')
          .select('status, current_period_end')
          .eq('user_id', userId)
          .single();
        
        return { data: fallbackResult.data, error: fallbackResult.error };
      } catch (fallbackError) {
        console.warn('Fallback query also failed:', fallbackError);
        // Try minimal query as last resort
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return querySubscriptionWithRetry(userId, retryCount + 1);
        }
        throw fallbackError;
      }
    }
    
    // Retry with exponential backoff for other errors
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return querySubscriptionWithRetry(userId, retryCount + 1);
    }
    
    throw error;
  }
}

export async function checkUserSubscription(userId: string): Promise<SubscriptionStatus> {
  if (!userId) {
    return {
      hasActiveSubscription: false,
      status: null,
      trialEnd: null,
      currentPeriodEnd: null
    };
  }

  const circuitBreaker = SubscriptionCircuitBreaker.getInstance();
  const rateLimiter = SubscriptionRateLimiter.getInstance();

  // Check circuit breaker
  if (circuitBreaker.isCircuitOpen(userId)) {
    const backoffTime = circuitBreaker.getBackoffTime(userId);
    console.warn(`Circuit breaker open for user ${userId}, ${Math.ceil(backoffTime / 1000)}s remaining`);
    return {
      hasActiveSubscription: false,
      status: 'circuit_breaker_open',
      trialEnd: null,
      currentPeriodEnd: null
    };
  }

  try {
    // Rate limiting
    await rateLimiter.acquire(userId);
    
    // Query subscription data with retry logic
    const { data: subscription, error } = await querySubscriptionWithRetry(userId);

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking subscription:', error);
      circuitBreaker.recordFailure(userId);
      return {
        hasActiveSubscription: false,
        status: null,
        trialEnd: null,
        currentPeriodEnd: null
      };
    }

    if (!subscription) {
      circuitBreaker.recordSuccess(userId);
      return {
        hasActiveSubscription: false,
        status: null,
        trialEnd: null,
        currentPeriodEnd: null
      };
    }

    // Determine if subscription is active
    const now = new Date();
    const isActive = subscription.status === 'active' || 
                    subscription.status === 'trialing' ||
                    (subscription.status === 'past_due' && 
                     subscription.current_period_end && 
                     new Date(subscription.current_period_end) > now);

    const result = {
      hasActiveSubscription: isActive,
      status: subscription.status,
      trialEnd: subscription.trial_end || null,
      currentPeriodEnd: subscription.current_period_end || null
    };

    circuitBreaker.recordSuccess(userId);
    return result;

  } catch (error) {
    console.error('Error checking subscription status:', error);
    circuitBreaker.recordFailure(userId);
    return {
      hasActiveSubscription: false,
      status: null,
      trialEnd: null,
      currentPeriodEnd: null
    };
  } finally {
    rateLimiter.release(userId);
  }
}

// Helper function to check if subscription system is healthy
export function getSubscriptionSystemHealth(userId: string) {
  const circuitBreaker = SubscriptionCircuitBreaker.getInstance();
  return {
    isCircuitOpen: circuitBreaker.isCircuitOpen(userId),
    backoffTime: circuitBreaker.getBackoffTime(userId)
  };
}