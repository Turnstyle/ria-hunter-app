'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase-client';
import { Subscription } from '@/app/lib/schemas';

interface SubscriptionDetailsProps {
  userId: string;
}

const SubscriptionDetails: React.FC<SubscriptionDetailsProps> = ({ userId }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          throw error;
        }

        setSubscription(data);
      } catch (err) {
        setError('Failed to fetch subscription details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [userId]);

  if (loading) {
    return <div>Loading subscription details...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!subscription) {
    return <div>No active subscription found.</div>;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Subscription Details</h2>
      <div className="space-y-2">
        <p><strong>Status:</strong> {subscription.status}</p>
        <p><strong>Plan:</strong> {subscription.plan_id}</p>
        <p><strong>Current Period Start:</strong> {new Date(subscription.current_period_start).toLocaleDateString()}</p>
        <p><strong>Current Period End:</strong> {new Date(subscription.current_period_end).toLocaleDateString()}</p>
        {subscription.cancel_at_period_end && (
          <p className="text-red-500">Your subscription will be canceled at the end of the current period.</p>
        )}
      </div>
    </div>
  );
};

export default SubscriptionDetails;
