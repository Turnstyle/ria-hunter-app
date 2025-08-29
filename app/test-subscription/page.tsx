'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useSessionDemo } from '@/app/hooks/useSessionDemo';

export default function TestSubscriptionPage() {
  const { user, session } = useAuth();
  const { isSubscriber, searchesRemaining, refreshStatus } = useSessionDemo();
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    if (!session?.access_token) {
      setError('No authentication token available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debug-subscription', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch debug data: ${response.status}`);
      }

      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchDebugData();
    }
  }, [session?.access_token]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Subscription Debug</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please sign in to debug subscription status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Debug for {user.email}</h1>
      
      {/* Current Status from Hooks */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Current Frontend Status</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Is Subscriber (useSessionDemo):</span>
            <span className={`font-medium ${isSubscriber ? 'text-green-600' : 'text-red-600'}`}>
              {isSubscriber ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Searches Remaining:</span>
            <span className="font-medium">{searchesRemaining ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">User ID:</span>
            <span className="font-mono text-sm">{user.id}</span>
          </div>
        </div>
        <button
          onClick={() => refreshStatus()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Status
        </button>
      </div>

      {/* Debug Data */}
      {loading && (
        <div className="bg-gray-50 rounded-lg p-6">
          <p className="text-gray-600">Loading debug data...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {debugData && (
        <>
          {/* Final Status */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Debug Analysis</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Final Subscriber Status:</span>
                <span className={`font-medium ${debugData.finalStatus?.isSubscriber ? 'text-green-600' : 'text-red-600'}`}>
                  {debugData.finalStatus?.isSubscriber ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status Source:</span>
                <span className="font-medium">{debugData.finalStatus?.source || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Stripe Data */}
          {debugData.stripeData && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Stripe Data</h2>
              {debugData.stripeData.error ? (
                <p className="text-red-600">Error: {debugData.stripeData.error}</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Customer</h3>
                    <div className="pl-4 space-y-1 text-sm">
                      <div>ID: <span className="font-mono">{debugData.stripeData.customer?.id}</span></div>
                      <div>Email: {debugData.stripeData.customer?.email}</div>
                      <div>Has Active Sub: <span className={debugData.stripeData.hasActiveSubscription ? 'text-green-600' : 'text-red-600'}>
                        {debugData.stripeData.hasActiveSubscription ? 'Yes' : 'No'}
                      </span></div>
                      {debugData.stripeData.activeCoupon && (
                        <div>Active Coupon: <span className="font-mono bg-yellow-100 px-1">{JSON.stringify(debugData.stripeData.activeCoupon)}</span></div>
                      )}
                    </div>
                  </div>
                  
                  {debugData.stripeData.subscriptions?.map((sub: any, idx: number) => (
                    <div key={idx}>
                      <h3 className="font-medium mb-2">Subscription {idx + 1}</h3>
                      <div className="pl-4 space-y-1 text-sm">
                        <div>ID: <span className="font-mono">{sub.id}</span></div>
                        <div>Status: <span className={`font-medium ${sub.status === 'active' ? 'text-green-600' : ''}`}>{sub.status}</span></div>
                        <div>Current Period End: {sub.current_period_end ? new Date(sub.current_period_end * 1000).toLocaleDateString() : 'N/A'}</div>
                        {sub.discount && (
                          <div>Discount: <span className="font-mono bg-yellow-100 px-1">{JSON.stringify(sub.discount)}</span></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Supabase Data */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Supabase Data</h2>
            
            <div className="mb-4">
              <h3 className="font-medium mb-2">Subscription Status (from utility)</h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(debugData.subscriptionStatus, null, 2)}
              </pre>
            </div>

            <div className="mb-4">
              <h3 className="font-medium mb-2">User Profile</h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(debugData.userProfile, null, 2)}
              </pre>
            </div>

            <div className="mb-4">
              <h3 className="font-medium mb-2">Raw Subscription</h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(debugData.rawSubscription, null, 2)}
              </pre>
            </div>

            {debugData.dbError && (
              <div className="mb-4">
                <h3 className="font-medium mb-2 text-red-600">Database Error</h3>
                <pre className="bg-red-50 p-3 rounded text-xs overflow-x-auto">
                  {JSON.stringify(debugData.dbError, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDebugData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Debug Data
          </button>
        </>
      )}
    </div>
  );
}
