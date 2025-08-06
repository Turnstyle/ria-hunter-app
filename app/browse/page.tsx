'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import UpgradeButton from '@/app/components/subscription/UpgradeButton';

interface RIA {
  cik: number;
  crd_number: number | null;
  legal_name: string;
  main_addr_street1: string | null;
  main_addr_street2: string | null;
  main_addr_city: string | null;
  main_addr_state: string | null;
  main_addr_zip: string | null;
  main_addr_country: string | null;
  phone_number: string | null;
  fax_number: string | null;
  website: string | null;
  is_st_louis_msa: boolean | null;
  latest_filing: {
    filing_date: string;
    total_aum: number | null;
    manages_private_funds_flag: boolean | null;
  } | null;
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
}

interface BrowseResponse {
  message: string;
  subscriptionStatus: SubscriptionStatus;
  data: RIA[];
}

interface BrowseError {
  error: string;
  requiresAuth?: boolean;
  requiresSubscription?: boolean;
  subscriptionStatus?: SubscriptionStatus;
}

export default function BrowsePage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [rias, setRias] = useState<RIA[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState('');
  const [privateInvestment, setPrivateInvestment] = useState<'true' | 'false' | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);

  const fetchRIAs = async () => {
    setLoading(true);
    setError(null);
    setRequiresAuth(false);
    setRequiresSubscription(false);
    
    try {
      const params = new URLSearchParams();
      if (location.trim()) params.append('location', location.trim());
      if (privateInvestment) params.append('privateInvestment', privateInvestment);
      
      const response = await fetch(`/api/browse-rias?${params}`);
      
      if (response.ok) {
        const data: BrowseResponse = await response.json();
        setRias(data.data || []);
        setSubscriptionStatus(data.subscriptionStatus);
      } else {
        const errorData: BrowseError = await response.json();
        
        if (errorData.requiresAuth) {
          setRequiresAuth(true);
          setError('Please sign in to browse RIAs');
        } else if (errorData.requiresSubscription) {
          setRequiresSubscription(true);
          setSubscriptionStatus(errorData.subscriptionStatus || null);
          setError('Subscription required to browse RIAs');
        } else {
          // Handle specific Auth0 configuration error gracefully
          if (errorData.error === 'Auth0 configuration error, unable to validate token') {
            setError('Service temporarily unavailable. We\'re working on it - come back later!');
          } else {
            setError(errorData.error || 'Failed to fetch RIAs');
          }
        }
        setRias([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      // Handle specific Auth0 configuration error gracefully
      if (errorMessage.includes('Auth0 configuration error')) {
        setError('Closed for renovations, come back later.');
      } else {
        setError(errorMessage);
      }
      setRias([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogle('/browse');
      if (result.error) {
        setError('Sign in failed. Please try again.');
      }
    } catch (err) {
      setError('Sign in failed. Please try again.');
    }
  };

  // Auto-fetch RIAs when user authentication state changes
  useEffect(() => {
    if (!authLoading && user) {
      fetchRIAs();
    } else if (!authLoading && !user) {
      setRequiresAuth(true);
      setError('Please sign in to browse RIAs');
      setRias([]);
    }
  }, [user, authLoading]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRIAs();
  };

  const formatAUM = (aum: number | null) => {
    if (!aum) return 'N/A';
    if (aum >= 1000000000) return `$${(aum / 1000000000).toFixed(1)}B`;
    if (aum >= 1000000) return `$${(aum / 1000000).toFixed(1)}M`;
    if (aum >= 1000) return `$${(aum / 1000).toFixed(1)}K`;
    return `$${aum.toLocaleString()}`;
  };

  const formatAddress = (ria: RIA) => {
    const parts = [
      ria.main_addr_city,
      ria.main_addr_state,
      ria.main_addr_zip
    ].filter(Boolean);
    return parts.join(', ') || 'Address not available';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse RIAs</h1>
          <p className="text-lg text-gray-600">Filter and browse Registered Investment Advisors</p>
        </div>

        {/* Preview Mode - Show teaser with blurred data */}
        {requiresAuth && !authLoading && (
          <div className="relative">
            {/* Filter Preview - Fully visible */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="preview-location" className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      id="preview-location"
                      value="St. Louis, MO"
                      disabled
                      className="w-full border border-gray-300 p-3 rounded-lg bg-gray-50 text-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="preview-private" className="block text-sm font-medium text-gray-700 mb-2">
                      Private Investment Focus
                    </label>
                    <select
                      id="preview-private"
                      value="All RIAs"
                      disabled
                      className="w-full border border-gray-300 p-3 rounded-lg bg-gray-50 text-gray-700"
                    >
                      <option>All RIAs</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      disabled
                      className="w-full px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed opacity-75"
                    >
                      Filter Results
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Results Container */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 relative">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  47 RIAs Found in St. Louis, MO
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {/* Sample RIA 1 - Edward Jones */}
                <div className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-lg font-semibold text-blue-600 blur-sm select-none">
                          Edward Jones & Co., L.P.
                        </div>
                        <div className="text-sm text-gray-500 blur-sm select-none">
                          CIK: 1035475
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="blur-sm select-none">St. Louis, MO 63143</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="blur-sm select-none">(314) 515-2000</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-blue-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="blur-sm select-none hover:text-blue-800">Website</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="blur-sm select-none">AUM: $1.87T</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4M4 10h16m-8 4l8 4-8 4V14z" />
                            </svg>
                            <span className="blur-sm select-none">Private Funds: No</span>
                          </div>
                          
                          <div className="text-xs text-gray-500 blur-sm select-none">
                            Last filing: March 28, 2024
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample RIA 2 - Moneta */}
                <div className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-lg font-semibold text-blue-600 blur-sm select-none">
                          Moneta Group Investment Advisors, LLC
                        </div>
                        <div className="text-sm text-gray-500 blur-sm select-none">
                          CIK: 1244715
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="blur-sm select-none">Clayton, MO 63105</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="blur-sm select-none">(314) 444-5900</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="blur-sm select-none">AUM: $42.1B</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4M4 10h16m-8 4l8 4-8 4V14z" />
                            </svg>
                            <span className="blur-sm select-none">Private Funds: Yes</span>
                          </div>
                          
                          <div className="text-xs text-gray-500 blur-sm select-none">
                            Last filing: March 28, 2024
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample RIA 3 - Benjamin Edwards */}
                <div className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-lg font-semibold text-blue-600 blur-sm select-none">
                          Benjamin F. Edwards & Co., Inc.
                        </div>
                        <div className="text-sm text-gray-500 blur-sm select-none">
                          CIK: 1512182
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="blur-sm select-none">St. Louis, MO 63141</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span className="blur-sm select-none">(855) 238-3934</span>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="blur-sm select-none">AUM: $8.3B</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4M4 10h16m-8 4l8 4-8 4V14z" />
                            </svg>
                            <span className="blur-sm select-none">Private Funds: No</span>
                          </div>
                          
                          <div className="text-xs text-gray-500 blur-sm select-none">
                            Last filing: March 25, 2024
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compelling Overlay with Call-to-Action */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/95 to-white/80 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                  <div className="flex justify-center mb-4">
                    <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">See the Full Picture</h2>
                  <p className="text-gray-600 mb-6">
                    Unlock detailed RIA data, advanced filters, and comprehensive analysis. 
                    <span className="block text-sm mt-2 text-blue-600 font-medium">
                      47 RIAs in St. Louis ready to explore
                    </span>
                  </p>
                  <button
                    onClick={handleSignIn}
                    className="w-full px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg hover:shadow-xl mb-3"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in to Browse RIAs
                    </div>
                  </button>
                  <p className="text-xs text-gray-500">
                    Free to sign up • 7-day Pro trial included
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Required State */}
        {requiresSubscription && user && (
          <div className="bg-white rounded-xl shadow-md p-8 mb-8 text-center border-l-4 border-yellow-500">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pro Subscription Required</h2>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              The Browse RIAs feature is available to Pro subscribers only. Upgrade now to get unlimited access to filter and browse RIAs with advanced search capabilities.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <h3 className="font-semibold text-blue-900 mb-2">Pro Features Include:</h3>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• Browse and filter RIAs</li>
                <li>• Unlimited natural language queries</li>
                <li>• Advanced search filters</li>
                <li>• Export capabilities</li>
                <li>• 7-day free trial</li>
              </ul>
            </div>
            <UpgradeButton className="px-8 py-3" />
          </div>
        )}

        {/* Filters - Show only if user has subscription */}
        {user && !requiresAuth && !requiresSubscription && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    placeholder="City, state, or ZIP code"
                  />
                </div>
                
                <div>
                  <label htmlFor="privateInvestment" className="block text-sm font-medium text-gray-700 mb-2">
                    Private Investment Focus
                  </label>
                  <select
                    id="privateInvestment"
                    value={privateInvestment}
                    onChange={(e) => setPrivateInvestment(e.target.value as 'true' | 'false' | '')}
                    className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="">All RIAs</option>
                    <option value="true">Private funds only</option>
                    <option value="false">No private funds</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Searching...
                      </div>
                    ) : (
                      'Filter Results'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* General Error State */}
        {error && !requiresAuth && !requiresSubscription && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-700">Error: {error}</p>
            </div>
          </div>
        )}

        {/* Results - Show only if user has subscription */}
        {user && !requiresAuth && !requiresSubscription && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {loading ? 'Loading...' : `${rias.length} RIAs Found`}
              </h2>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : rias.length === 0 && !error ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No RIAs found</h3>
                <p className="text-gray-500">Try adjusting your filters or search criteria.</p>
              </div>
            ) : rias.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {rias.map((ria) => (
                <div key={ria.cik} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <Link 
                          href={`/profile/${ria.cik}`}
                          className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {ria.legal_name}
                        </Link>
                        <div className="text-sm text-gray-500">
                          CIK: {ria.cik}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {formatAddress(ria)}
                          </div>
                          
                          {ria.phone_number && (
                            <div className="flex items-center text-sm text-gray-600 mb-1">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {ria.phone_number}
                            </div>
                          )}
                          
                          {ria.website && (
                            <div className="flex items-center text-sm text-blue-600 hover:text-blue-800">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              <a href={ria.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          {ria.latest_filing && (
                            <>
                              <div className="flex items-center text-sm text-gray-600 mb-1">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                AUM: {formatAUM(ria.latest_filing.total_aum)}
                              </div>
                              
                              <div className="flex items-center text-sm text-gray-600 mb-1">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4M4 10h16m-8 4l8 4-8 4V14z" />
                                </svg>
                                Private Funds: {ria.latest_filing.manages_private_funds_flag ? 'Yes' : 'No'}
                              </div>
                              
                              <div className="text-xs text-gray-500">
                                Last filing: {new Date(ria.latest_filing.filing_date).toLocaleDateString()}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}