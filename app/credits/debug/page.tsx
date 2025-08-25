'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useCredits } from '@/app/hooks/useCredits';
import CreditsDebug from '@/app/components/credits/CreditsDebug';

export default function CreditsDebugPage() {
  const { user } = useAuth();
  const { credits, isSubscriber, isLoadingCredits, refreshCredits } = useCredits();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Credits Ledger Debug</h1>
      
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold mb-2">Current Credit Status</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-white p-3 rounded border flex-1">
            <div className="text-lg font-medium">{isLoadingCredits ? 'Loading...' : credits}</div>
            <div className="text-sm text-gray-600">Available Credits</div>
          </div>
          
          <div className="bg-white p-3 rounded border flex-1">
            <div className="text-lg font-medium">{isSubscriber ? 'Yes' : 'No'}</div>
            <div className="text-sm text-gray-600">Subscriber Status</div>
          </div>
          
          <div className="bg-white p-3 rounded border flex-1">
            <div className="text-lg font-medium">{user ? 'Authenticated' : 'Anonymous'}</div>
            <div className="text-sm text-gray-600">User Status</div>
          </div>
          
          <div className="bg-white p-3 rounded border flex-1">
            <button 
              onClick={() => refreshCredits()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      
      <CreditsDebug />
    </div>
  );
}
