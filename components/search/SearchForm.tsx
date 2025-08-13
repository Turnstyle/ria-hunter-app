'use client'

import React, { useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'

export default function SearchForm({ onResult, onError }: { onResult: (result: any, query: string) => void, onError: (message: string, query: string) => void }) {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setIsLoading(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: q })
      })
      if (!resp.ok) {
        onError(`Search failed (${resp.status})`, q)
        return
      }
      const data = await resp.json()
      onResult(data, q)
    } catch (err: any) {
      onError(err?.message || 'Search failed', q)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about RIAs..."
          className="w-full px-4 py-3 pr-28 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  )
}