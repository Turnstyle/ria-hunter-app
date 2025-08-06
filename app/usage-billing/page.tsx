import React from 'react';
import SubscriptionDetails from '@/app/components/subscription/SubscriptionDetails';
import { getCurrentUser } from '@/app/lib/supabase-server';

export default async function UsageBillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Usage & Billing</h1>
        <p>You must be logged in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Usage & Billing</h1>
      <SubscriptionDetails userId={user.id} />
    </div>
  );
}
