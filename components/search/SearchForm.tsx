'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import UpgradeButton from '@/app/components/subscription/UpgradeButton';

interface SearchFormProps {
  onResult?: (result: any, query: string) => void;
  onError?: (error: string, query: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onResult, onError }) => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user, session, signInWithGoogle } = useAuth();
  const [aiProvider, setAiProvider] = useState<'openai' | 'vertex'>('openai');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(10);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [queryCount, setQueryCount] = useState<number>(0);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);

  useEffect(() => {
    const savedQueryCount = localStorage.getItem('ria-hunter-query-count');
    const savedShareStatus = localStorage.getItem('ria-hunter-linkedin-shared');
    
    if (savedQueryCount) {
      setQueryCount(parseInt(savedQueryCount));
    }
    if (savedShareStatus === 'true') {
      setHasSharedOnLinkedIn(true);
    }
  }, []);

  const handleUpgrade = async () => {
    if (!session) {
      await signInWithGoogle('/?checkout=true');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }

    } catch (error) {
      console.error('Upgrade error:', error);
      alert(error instanceof Error ? error.message : 'Failed to start upgrade process');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'true' && session) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleUpgrade();
    }
  }, [session]);

  const exampleQueries = [
    "What are New York's 5 largest RIAs by assests under management?",
    "Show me RIAs located in New York",
    "List the top 10 most active private equity fund RIA's in Chicago, IL",
    "Find investment advisors in Texas with over $1 billion AUM",
    "Which RIA's were most active in the last 12 months with Commercial Real Estate private funds?",
    "Which RIAs are located in California and what are their specialties?"
  ];

  const handleLimitChange = (newLimit: number) => {
    if (newLimit > 20) {
      setShowSubscriptionModal(true);
      return; 
    }
    setLimit(newLimit);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!query.trim()) return;

    const maxFreeQueries = hasSharedOnLinkedIn ? 3 : 2;
    if (!session && queryCount >= maxFreeQueries) {
      setShowAccountModal(true);
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ 
          query: query.trim(),
          aiProvider,
          limit
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          setShowAccountModal(true);
        } else {
          throw new Error(errorData.error || 'Search failed');
        }
      } else {
        const data = await response.json();
        
        if (!session) {
          const newQueryCount = queryCount + 1;
          setQueryCount(newQueryCount);
          localStorage.setItem('ria-hunter-query-count', newQueryCount.toString());
          
          if (newQueryCount === 2 && !hasSharedOnLinkedIn) {
            setTimeout(() => setShowLinkedInModal(true), 1000);
          }
        }
        
        if (onResult) {
          onResult(data, query.trim());
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (onError) {
        onError(errorMessage, query.trim());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  const handleLinkedInShare = () => {
    const shareText = encodeURIComponent("Just discovered this RIA Hunter app - it's incredible for researching investment advisors! The AI-powered search is a game-changer for finding RIAs. Check it out! #vibecoding");
    const shareUrl = encodeURIComponent(window.location.origin);
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&text=${shareText}`;
    
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    
    setHasSharedOnLinkedIn(true);
    localStorage.setItem('ria-hunter-linkedin-shared', 'true');
    setShowLinkedInModal(false);
  };

  return (
    <div className="space-y-8">
      {/* Main Search Form */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          {/* ... form content ... */}
        </form>
      </div>

      {/* ... example queries ... */}

      {/* Account Creation Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 relative">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">Upgrade to Pro</h3>
              <p className="text-gray-600 mb-4">
                You&apos;ve reached your free query limit{hasSharedOnLinkedIn ? ' (including your LinkedIn bonus!)' : ''}.
              </p>
              <div className="bg-gray-100 p-4 rounded-lg mb-6 text-left">
                <p className="text-sm font-medium text-gray-800">
                  Create your free account and get:
                </p>
                <ul className="text-sm text-gray-700 mt-2 space-y-1">
                  <li>• 7-day Pro trial (unlimited queries)</li>
                  <li>• Access to Browse & Analytics features</li>
                  <li>• Advanced search filters</li>
                  <li>• Export capabilities</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <UpgradeButton
                  className="w-full"
                  size="lg"
                  buttonText="Start Free 7-Day Pro Trial"
                />
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchForm;
