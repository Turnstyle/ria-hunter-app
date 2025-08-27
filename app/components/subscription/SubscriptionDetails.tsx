'use client'

import React, { useEffect, useState } from 'react'
import UpgradeButton from '@/app/components/subscription/UpgradeButton'
import { useAuth } from '@/app/contexts/AuthContext'
import { useSessionDemo } from '@/app/hooks/useSessionDemo'

interface SubscriptionDetailsProps {
  userId: string
}

export default function SubscriptionDetails({ userId }: SubscriptionDetailsProps) {
  const { session } = useAuth()
  const { searchesRemaining, isSubscriber, isLoading: isLoadingCredits } = useSessionDemo()
  const [loading, setLoading] = useState(true)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        const headers: Record<string, string> = {}
        const accessToken = session?.access_token
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }

        const resp = await fetch('/api/subscription-status', {
          cache: 'no-store',
          headers,
        })
        
        if (!resp.ok) {
          console.error('Failed to load subscription details')
          return
        }
        
        const data = await resp.json()
        setSubscriptionDetails(data)
      } catch (e: any) {
        console.error('Error loading subscription details:', e)
      } finally {
        setLoading(false)
      }
    }
    
    if (!isLoadingCredits) {
      loadDetails()
    }
  }, [userId, session?.access_token, isLoadingCredits])

  if (loading || isLoadingCredits) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-secondary-200 w-40 rounded"></div>
          <div className="h-4 bg-secondary-200 w-32 rounded"></div>
          <div className="h-4 bg-secondary-200 w-24 rounded"></div>
          <div className="h-10 bg-secondary-200 w-36 rounded-md"></div>
        </div>
      </div>
    )
  }

  // Determine display status
  const displayStatus = isSubscriber ? 'Pro Plan' : 'Free Plan';

  // Calculate remaining time if on trial
  const isOnTrial = subscriptionDetails?.subscription?.trial_end && 
                   new Date(subscriptionDetails.subscription.trial_end) > new Date();
  
  const daysLeft = isOnTrial ? 
    Math.ceil((new Date(subscriptionDetails.subscription.trial_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
    null;

  // Format renewal date
  const renewalDate = subscriptionDetails?.subscription?.current_period_end ? 
    new Date(subscriptionDetails.subscription.current_period_end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : null;

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-secondary-200">
      <h2 className="text-lg font-semibold text-secondary-900 mb-4">Subscription Status</h2>
      
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <div className={`w-3 h-3 rounded-full mr-2 ${isSubscriber ? 'bg-accent-500' : 'bg-primary-500'}`}></div>
          <span className="text-secondary-900 font-medium">{displayStatus}</span>
        </div>
        
        {isOnTrial && (
          <div className="text-sm text-secondary-600 mt-1 ml-5">
            Trial period: {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
          </div>
        )}
        
        {renewalDate && (
          <div className="text-sm text-secondary-600 mt-1 ml-5">
            Next billing date: {renewalDate}
          </div>
        )}
        
        {!isSubscriber && (
          <div className="text-sm text-secondary-600 mt-1 ml-5">
            Searches remaining: <span className="font-medium">{searchesRemaining ?? '—'}</span>
          </div>
        )}
        
        {isSubscriber && (
          <div className="text-sm text-secondary-600 mt-1 ml-5">
            Managed via Stripe
          </div>
        )}
      </div>
      
      {subscriptionDetails?.plan && (
        <div className="mb-4 p-4 bg-secondary-50 rounded-md border border-secondary-200">
          <h3 className="text-sm font-semibold text-secondary-900 mb-2">Current Plan Features</h3>
          <ul className="text-sm text-secondary-700 space-y-1">
            <li className="flex items-start">
              <svg className="h-4 w-4 text-accent-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {isSubscriber ? 'Unlimited searches' : `${searchesRemaining ?? '—'} searches remaining`}
            </li>
            <li className="flex items-start">
              <svg className="h-4 w-4 text-accent-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {isSubscriber ? 'Advanced filters and sorting' : 'Basic search functionality'}
            </li>
            <li className="flex items-start">
              <svg className="h-4 w-4 text-accent-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {isSubscriber ? 'RAG-powered search with citations' : 'Limited RAG capabilities'}
            </li>
            {isSubscriber && (
              <li className="flex items-start">
                <svg className="h-4 w-4 text-accent-500 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Priority support
              </li>
            )}
          </ul>
        </div>
      )}
      
      <div className="mt-5">
        {isSubscriber ? (
          <ManageBillingButton />
        ) : (
          <UpgradeButton buttonText="Upgrade to Pro" />
        )}
      </div>
    </div>
  )
}

function ManageBillingButton() {
  const { session } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      const resp = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      const data = await resp.json()
      if (!resp.ok || !data?.url) {
        throw new Error(data?.error || 'Failed to open billing portal')
      }
      window.location.href = data.url
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to open billing portal')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
    >
      {isLoading ? 'Opening…' : 'Manage Subscription'}
    </button>
  )
}