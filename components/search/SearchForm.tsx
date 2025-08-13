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
      const resultsArray = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data?.data) ? data.data : [])
      const sources = resultsArray.map((r: any) => ({
        firm_name: r?.firm_name || r?.legal_name || r?.name || 'Unknown',
        crd_number: r?.crd_number || r?.crd || r?.cik || '',
        cik: r?.cik ? String(r.cik) : undefined,
        city: r?.city || r?.main_addr_city || r?.main_office_location?.city || '',
        state: r?.state || r?.main_addr_state || r?.main_office_location?.state || '',
        aum: r?.aum ?? r?.total_aum ?? null,
        matched_keywords: r?.matched_keywords || r?.keywords || [],
        score: r?.score,
        aggregated: Boolean(r?.aggregated),
        group_size: typeof r?.group_size === 'number' ? r.group_size : (Array.isArray(r?.crd_numbers) ? r.crd_numbers.length : undefined),
        crd_numbers: Array.isArray(r?.crd_numbers) ? r.crd_numbers.map((x: any) => String(x)) : undefined,
      }))
      const normalized = {
        answer: typeof data?.answer === 'string' ? data.answer : '',
        sources,
        aiProvider: data?.provider || data?.source || undefined,
        timestamp: new Date().toISOString(),
        query: q,
        keywords: data?.keywords || [],
        meta: data?.meta || undefined,
      }
      onResult(normalized, q)
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
          id="search-query"
          name="query"
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