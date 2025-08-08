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
  const { user, session, signInWithGoogle } = useAuth();
  const [aiProvider, setAiProvider] = useState<'openai' | 'vertex'>('openai');
  const [limit, setLimit] = useState<number>(10);
  const [showMaxResultsPopover, setShowMaxResultsPopover] = useState<boolean>(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState<boolean>(false);
  const [queryCount, setQueryCount] = useState<number>(0);
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);
  const [hasSharedOnLinkedIn, setHasSharedOnLinkedIn] = useState<boolean>(false);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  // Helpers to scope localStorage by user so devices shared between accounts don't mix credits
  const getKey = (base: string) => {
    const suffix = user?.id ? `:${user.id}` : ':anon';
    return `${base}${suffix}`;
  };

  // Initialize gamification state from localStorage
  useEffect(() => {
    const savedQueryCount = localStorage.getItem(getKey('ria-hunter-query-count'));
    const savedShareStatus = localStorage.getItem(getKey('ria-hunter-linkedin-shared'));
    
    if (savedQueryCount) {
      setQueryCount(parseInt(savedQueryCount));
    }
    if (savedShareStatus === 'true') {
      setHasSharedOnLinkedIn(true);
    }
  }, [user?.id]);

  // Handle checkout redirect after login
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('checkout') === 'true' && session) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // Trigger checkout
      handleAccountCreation();
    }
  }, [session]);

  // Example queries that work well with the system and provide excellent user experiences
  const exampleQueries = [
    "What are New York's 5 largest RIAs by assets under management?",
    "Show me RIAs located in Florida with activity in Hedge Fund investments.",
    "List the top 10 most active private equity fund RIA's in Chicago, IL",
    "Find investment advisors in Texas with over $1 billion AUM",
    "Which RIA's were most active in the last 12 months with Commercial Real Estate private funds?",
    "What RIA's do private equity funds in Idaho?"
  ];

  const handleLimitChange = (newLimit: number) => {
    if (newLimit > 20) {
      // Show subscription modal for pro features
      setShowSubscriptionModal(true);
      return; // Don't change the limit yet
    }
    setLimit(newLimit);
  };

  const toggleAiProvider = () => {
    setAiProvider(aiProvider === 'openai' ? 'vertex' : 'openai');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!query.trim()) return;

    // For authenticated users, let the API handle subscription checks
    if (!session) {
      // Gamification: Check query limits for unauthenticated users
      const signupBonusAwarded = localStorage.getItem(getKey('ria-hunter-signup-bonus'));
      const baseCredits = 2;
      const linkedInBonus = hasSharedOnLinkedIn ? 1 : 0;
      const signupBonus = signupBonusAwarded === 'true' ? 2 : 0;
      const maxFreeQueries = baseCredits + linkedInBonus + signupBonus;
      
      if (queryCount >= maxFreeQueries) {
        setShowAccountModal(true);
        return;
      }
    }
    
    setIsLoading(true);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth header if user is signed in
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          query: query.trim(),
          aiProvider,
          limit
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          // Payment required - show upgrade modal
          setShowAccountModal(true);
          return;
        }
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      
      // Only track query count for unauthenticated users
      if (!session) {
        const newQueryCount = queryCount + 1;
        setQueryCount(newQueryCount);
        localStorage.setItem(getKey('ria-hunter-query-count'), newQueryCount.toString());
        
        // Show LinkedIn modal after second query (if not shared yet)
        if (newQueryCount === 2 && !hasSharedOnLinkedIn) {
          setTimeout(() => setShowLinkedInModal(true), 1000);
        }
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
    localStorage.setItem(getKey('ria-hunter-linkedin-shared'), 'true');
    setShowLinkedInModal(false);
  };

  const handleAccountCreation = async () => {
    if (isCreatingSession) return; // Prevent double-clicks
    
    setIsCreatingSession(true);
    
    if (!user || !session) {
      // If user is not signed in, sign them in first
      await signInWithGoogle('/?checkout=true');
      return;
    }

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const sessionData = await response.json();
      if (sessionData.url) {
        window.location.href = sessionData.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout process. Please try again.');
    } finally {
      setIsCreatingSession(false);
      setShowAccountModal(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Main Search Form */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible">
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8">
          <div className="relative">
            {/* Input Container with Inline Buttons */}
            <div className="relative flex items-center border-2 border-gray-200 rounded-xl focus-within:border-blue-500 transition-colors">
              {/* AI Provider Button */}
              <button
                type="button"
                onClick={toggleAiProvider}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-l-lg transition-colors border-r border-gray-200"
                disabled={isLoading}
                title={`Choose a model (Current: ${aiProvider === 'openai' ? 'OpenAI' : 'Google Vertex AI'})`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="hidden sm:inline">{aiProvider === 'openai' ? 'GPT-4' : 'Vertex'}</span>
              </button>

              {/* Max Results Button with Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMaxResultsPopover(!showMaxResultsPopover)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors border-r border-gray-200"
                  disabled={isLoading}
                  title={`Max results: ${limit}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">{limit}</span>
                </button>

                {/* Max Results Popover */}
                {showMaxResultsPopover && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[999] min-w-[200px]">
                    <div className="p-2">
                      <div className="text-xs font-medium text-gray-700 mb-2">Max Results</div>
                      <div className="space-y-1">
                        {[10, 20, 50, 100].map((resultLimit) => (
                          <button
                            key={resultLimit}
                            type="button"
                            onClick={() => {
                              handleLimitChange(resultLimit);
                              setShowMaxResultsPopover(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                              limit === resultLimit 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            disabled={isLoading}
                          >
                            {resultLimit} results {resultLimit > 20 ? '(Pro)' : ''}
                          </button>
                        ))}
                      </div>
                      {/* Pro CTA in popover */}
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMaxResultsPopover(false);
                            setShowSubscriptionModal(true);
                          }}
                          className="w-full px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          Get More Results with Pro
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Input Field */}
              <input
                type="text"
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 px-4 py-3 sm:py-4 text-base border-0 outline-none bg-transparent"
                placeholder="Ask about RIAs..."
                disabled={isLoading}
              />

              {/* Search Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="flex items-center justify-center px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-r-lg transition-colors disabled:text-gray-400"
                title="Search"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Click outside to close popover */}
            {showMaxResultsPopover && (
              <div
                className="fixed inset-0 z-0"
                onClick={() => setShowMaxResultsPopover(false)}
              />
            )}
          </div>
        </form>
      </div>

      {/* Example Queries */}
      <div className="text-center">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 px-4">Try these example queries:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {exampleQueries.map((example, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleExampleClick(example)}
              className="group bg-white border-2 border-gray-200 p-3 sm:p-4 rounded-xl hover:border-blue-300 hover:shadow-md focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-left"
              disabled={isLoading}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 group-hover:text-blue-900 transition-colors break-words">
                    &ldquo;{example}&rdquo;
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Use Case Examples */}
      <div className="text-center">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 px-4">Use Case Examples:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* For Founders */}
          <div className="group bg-white border border-gray-200 p-4 sm:p-6 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">For Founders</h4>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 text-left leading-relaxed">
              Find angel investors and early-stage VCs for your startup.
            </p>
          </div>

          {/* For Fund Managers */}
          <div className="group bg-white border border-gray-200 p-4 sm:p-6 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">For Fund Managers</h4>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 text-left leading-relaxed">
              Identify and research family offices for capital allocation.
            </p>
          </div>

          {/* For M&A Teams */}
          <div className="group bg-white border border-gray-200 p-4 sm:p-6 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-gray-900">For M&A Teams</h4>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 text-left leading-relaxed">
              Evaluate potential acquisition targets and perform market analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-3 sm:p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 max-w-md w-full mx-2 sm:mx-4 relative max-h-[90vh] overflow-y-auto">
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
                  onClick={handleAccountCreation}
                  disabled={isCreatingSession}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {isCreatingSession ? 'Processing...' : 'Start Free 7-Day Pro Trial'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-3 sm:p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 max-w-md w-full mx-2 sm:mx-4 relative max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-3 sm:p-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 lg:p-8 max-w-md w-full mx-2 sm:mx-4 relative max-h-[90vh] overflow-y-auto">
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
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
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