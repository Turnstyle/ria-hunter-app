'use client'

import React, { useEffect, useState } from 'react'
import UpgradeButton from '@/app/components/subscription/UpgradeButton'
import { useAuth } from '@/app/contexts/AuthContext'

interface SubscriptionDetailsProps {
  userId: string
}

interface SubscriptionInfo {
  status: string
  current_period_end?: string | null
}

export default function SubscriptionDetails({ userId }: SubscriptionDetailsProps) {
  const { session } = useAuth()
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
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
        if (!resp.ok) throw new Error('Failed to load subscription')
        const data = await resp.json()
        const derivedStatus = (data?.status
          || data?.subscription?.status
          || data?.subscriptionStatus?.status
          || data?.rawSubscription?.status
          || 'unknown') as string
        const derivedPeriodEnd = (data?.current_period_end
          || data?.subscription?.current_period_end
          || data?.subscriptionStatus?.current_period_end
          || data?.rawSubscription?.current_period_end
          || null) as string | null
        setInfo({ status: derivedStatus, current_period_end: derivedPeriodEnd })
      } catch (e: any) {
        setError(e?.message || 'Error loading subscription')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, session?.access_token])

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse h-5 bg-gray-200 w-40 rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h2>
      <div className="text-sm text-gray-900">Status: {info?.status || 'unknown'}</div>
      {info?.current_period_end && (
        <div className="text-xs text-gray-600 mt-1">Renews: {new Date(info.current_period_end).toLocaleDateString()}</div>
      )}
      <div className="mt-4">
        {info?.status === 'active' ? (
          <ManageBillingButton />
        ) : (
          <UpgradeButton buttonText="Upgrade" />
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