'use client'

import React, { useEffect, useState } from 'react'
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
        setInfo({ status: data?.status || 'unknown', current_period_end: data?.current_period_end || null })
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
    </div>
  )
}