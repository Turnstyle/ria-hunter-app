'use client';

import React, { useState, useEffect } from 'react';
import { checkUserSubscription, SubscriptionStatus } from '@/app/lib/subscription-utils';
import { useAuth } from '@/app/contexts/AuthContext';
import UpgradeButton from './UpgradeButton';

interface SubscriptionDetailsProps {
  userId: string;
}

interface ExtendedSubscriptionStatus extends SubscriptionStatus {
  cancel_at_period_end?: boolean;
  stripe_customer_id?: string;
  current_period_start?: string;
}

interface UsageStats {
  queriesThisMonth: number;
  queriesTotal: number;
  lastQueryDate?: string;
}

const SubscriptionDetails: React.FC<SubscriptionDetailsProps> = ({ userId }) => {
  const [subscription, setSubscription] = useState<ExtendedSubscriptionStatus | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    const fetchSubscriptionAndUsage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch subscription details using the utility function
        const subscriptionStatus = await checkUserSubscription(userId);
        
        // Only set subscription if it's actually active
        if (subscriptionStatus.hasActiveSubscription) {
          setSubscription(subscriptionStatus);
        } else {
          setSubscription(null);
        }

        // Fetch usage statistics (mock data for now - you'd replace this with actual usage tracking)
        const mockUsageStats: UsageStats = {
          queriesThisMonth: Math.floor(Math.random() * 150),
          queriesTotal: Math.floor(Math.random() * 1000) + 200,
          lastQueryDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        setUsageStats(mockUsageStats);

      } catch (err) {
        console.error('Error fetching subscription details:', err);
        setError('Failed to load subscription details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionAndUsage();
  }, [userId]);

  const handleManageSubscription = async () => {
    try {
      // Create a customer portal session
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Unable to open billing portal. Please try again later.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading subscription details</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Subscription Status</h2>
          {subscription && (
            <button
              onClick={handleManageSubscription}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Manage Subscription
            </button>
          )}
        </div>

        {subscription ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subscription.status)}`}>
                      {getStatusText(subscription.status)}
                    </span>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan</label>
                  <p className="mt-1 text-sm text-gray-900 font-medium">RIA Hunter Pro</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Current Period</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {subscription.current_period_start && subscription.currentPeriodEnd ? 
                      `${formatDate(subscription.current_period_start)} - ${formatDate(subscription.currentPeriodEnd)}` :
                      'Active subscription'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Auto-renewal</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {subscription.cancel_at_period_end ? (
                      <span className="text-red-600">Canceled (ends {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'N/A'})</span>
                    ) : (
                      <span className="text-green-600">Enabled</span>
                    )}
                  </p>
                </div>

                {subscription.status === 'trialing' && subscription.trialEnd && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trial ends</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(subscription.trialEnd)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active subscription</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start your free 7-day trial to unlock unlimited queries and premium features.
            </p>
            <div className="mt-6">
              <UpgradeButton 
                buttonText="Start Free Trial"
                size="md"
                className="shadow-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Usage Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-600">This Month</p>
                  <p className="text-2xl font-semibold text-blue-900">{usageStats.queriesThisMonth}</p>
                  <p className="text-xs text-blue-600">queries</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-600">Total Queries</p>
                  <p className="text-2xl font-semibold text-green-900">{usageStats.queriesTotal}</p>
                  <p className="text-xs text-green-600">all time</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-600">Last Query</p>
                  <p className="text-sm font-semibold text-purple-900">
                    {usageStats.lastQueryDate 
                      ? formatDate(usageStats.lastQueryDate)
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDetails;