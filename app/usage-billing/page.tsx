'use client';

import React, { useEffect, useState } from 'react';
import SubscriptionDetails from '@/app/components/subscription/SubscriptionDetails';
import { useAuth } from '@/app/contexts/AuthContext';
import { User } from '@supabase/supabase-js';

export default function UsageBillingPage() {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  if (!currentUser) {
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
      <SubscriptionDetails userId={currentUser.id} />
    </div>
  );
}
