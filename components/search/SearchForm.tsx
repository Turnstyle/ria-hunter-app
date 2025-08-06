'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

interface SearchFormProps {
  onResult?: (result: any, query: string) => void;
  onError?: (error: string, query: string) => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onResult, onError }) => {
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { user, signInWithGoogle } = useAuth();
  const [aiProvider, setAiProvider] = useState<'openai' | 'vertex'>('openai');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(10);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [queryCount, setQueryCount] = useState<number>(0);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  // Initialize gamification state from localStorage
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

  // Example queries that work well with the system and provide excellent user experiences
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
      // Show subscription modal for pro features
      setShowSubscriptionModal(true);
      return; // Don't change the limit yet
    }
    setLimit(newLimit);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!query.trim()) return;

    // Gamification: Check query limits
    const maxFreeQueries = hasSharedOnLinkedIn ? 3 : 2;
    if (queryCount >= maxFreeQueries) {
      setShowAccountModal(true);
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query.trim(),
          aiProvider,
          limit
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      
      // Gamification: Increment query count and save to localStorage
      const newQueryCount = queryCount + 1;
      setQueryCount(newQueryCount);
      localStorage.setItem('ria-hunter-query-count', newQueryCount.toString());
      
      // Show LinkedIn modal after second query (if not shared yet)
      if (newQueryCount === 2 && !hasSharedOnLinkedIn) {
        setTimeout(() => setShowLinkedInModal(true), 1000); // Delay to let results show first
      }
      
      if (onResult) {
        onResult(data, query.trim());
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
    
    // Open LinkedIn share in new window
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    
    // Mark as shared and give bonus query
    setHasSharedOnLinkedIn(true);
    localStorage.setItem('ria-hunter-linkedin-shared', 'true');
    setShowLinkedInModal(false);
  };

  const handleAccountCreation = async () => {
    setIsCreatingSession(true);
    if (!user) {
      // If user is not signed in, sign them in first
      await signInWithGoogle('/?checkout=true');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-email': user.email || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      // Handle error display to the user
    } finally {
      setIsCreatingSession(false);
      setShowAccountModal(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Main Search Form */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <div className="space-y-4">
            <label htmlFor="query" className="block text-lg font-semibold text-gray-900">
              Ask about RIAs
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 border-2 border-gray-200 p-4 rounded-xl text-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                placeholder="What is the largest RIA in California?"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 focus:outline-none transition-colors"
            >
              <svg 
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Options
            </button>
            
            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
                <div>
                  <label htmlFor="aiProvider" className="block text-sm font-medium text-gray-700 mb-2">
                    AI Provider
                  </label>
                  <select
                    id="aiProvider"
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as 'openai' | 'vertex')}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    disabled={isLoading}
                  >
                    <option value="openai">OpenAI (GPT-4 Turbo)</option>
                    <option value="vertex">Google Vertex AI</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="maxResults" className="block text-sm font-medium text-gray-700 mb-2">
                    Max Results
                  </label>
                  <select
                    id="maxResults"
                    value={limit}
                    onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    disabled={isLoading}
                  >
                    <option value={10}>10 results</option>
                    <option value={20}>20 results</option>
                    <option value={50}>50 results (Pro)</option>
                    <option value={100}>100 results (Pro)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Example Queries */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Try these example queries:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {exampleQueries.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="group bg-white border-2 border-gray-200 p-4 rounded-xl hover:border-blue-300 hover:shadow-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={isLoading}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900 transition-colors">
                    &ldquo;{example}&rdquo;
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 relative">
            <button
              onClick={() => setShowSubscriptionModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">Unlock Pro Results</h3>
              <p className="text-gray-600 mb-6">
                Get access to 50-100 results per query with our Pro subscription. 
                Perfect for comprehensive research and analysis.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    // TODO: Navigate to subscription page
                    window.open('/subscribe', '_blank');
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl"
                >
                  Upgrade to Pro
                </button>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn Share Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 relative">
            <button
              onClick={() => setShowLinkedInModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">🎉 Loving RIA Hunter?</h3>
              <p className="text-gray-600 mb-6">
                Share your experience on LinkedIn and unlock <span className="font-semibold text-blue-600">1 bonus query</span>! 
                Help others discover this powerful tool while getting extra searches.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleLinkedInShare}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Share on LinkedIn & Get Bonus Query
                </button>
                <button
                  onClick={() => setShowLinkedInModal(false)}
                  className="w-full px-6 py-3 text-gray-600 hover:text-gray-800 focus:outline-none transition-colors"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Creation Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                <button
                  onClick={handleAccountCreation}
                  disabled={isCreatingSession}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl"
                >
                  {isCreatingSession ? 'Processing...' : 'Start Free 7-Day Pro Trial'}
                </button>
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
