'use client'

import React, { useEffect, useState } from 'react'
import UpgradeButton from '@/app/components/subscription/UpgradeButton'
import { useAuth } from '@/app/contexts/AuthContext'
import { useCredits } from '@/hooks/useCredits'

interface SubscriptionDetailsProps {
  userId: string
}

export default function SubscriptionDetails({ userId }: SubscriptionDetailsProps) {
  const { session } = useAuth()
  const { isSubscriber, subscriptionStatus, loading: creditsLoading } = useCredits()
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
    
    if (!creditsLoading) {
      loadDetails()
    }
  }, [userId, session?.access_token, creditsLoading])

  if (loading || creditsLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse h-5 bg-gray-200 w-40 rounded" />
      </div>
    )
  }

  // Determine display status
  const displayStatus = isSubscriber ? 'Pro Subscriber' : 
                       subscriptionStatus === 'none' ? 'Free Plan' : 
                       subscriptionStatus;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h2>
      <div className="text-sm text-gray-900">Status: {displayStatus}</div>
      
      {subscriptionDetails?.subscription?.current_period_end && (
        <div className="text-xs text-gray-600 mt-1">
          Renews: {new Date(subscriptionDetails.subscription.current_period_end).toLocaleDateString()}
        </div>
      )}
      
      <div className="mt-4">
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
    if (!session?.access_token) return
    setIsLoading(true)
    try {
      const resp = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
    >
      {isLoading ? 'Opening…' : 'Manage Billing'}
    </button>
  )
}