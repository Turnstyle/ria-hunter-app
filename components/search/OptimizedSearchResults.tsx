'use client'

import { useState } from 'react'

interface SearchResult {
  data: any[]
  source: 'database' | 'cache' | 'materialized_view' | 'ai'
  cached?: boolean
  executionTime: number
  error?: string
}

interface OptimizedSearchResultsProps {
  results: SearchResult | null
  isLoading?: boolean
}

export default function OptimizedSearchResults({ results, isLoading }: OptimizedSearchResultsProps) {
  const [sortBy, setSortBy] = useState<'aum' | 'name' | 'date'>('aum')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Searching RIA database...</p>
        </div>
      </div>
    )
  }

  if (!results) {
    return null
  }

  if (results.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
        <div className="flex items-center gap-2">
          <span className="text-red-600">❌</span>
          <span className="text-red-800 font-medium">Search Error</span>
        </div>
        <p className="text-red-700 mt-1">{results.error}</p>
      </div>
    )
  }

  if (!results.data || results.data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center">
        <span className="text-4xl mb-4 block">🔍</span>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
        <p className="text-gray-600">
          Try a different search term or browse our suggested queries above.
        </p>
      </div>
    )
  }

  const sortedResults = [...results.data].sort((a, b) => {
    switch (sortBy) {
      case 'aum':
        const aumA = parseFloat(a.total_aum || a.latest_filing?.total_aum || 0)
        const aumB = parseFloat(b.total_aum || b.latest_filing?.total_aum || 0)
        return aumB - aumA
      case 'name':
        return a.legal_name.localeCompare(b.legal_name)
      case 'date':
        const dateA = new Date(a.filing_date || a.latest_filing?.filing_date || 0)
        const dateB = new Date(b.filing_date || b.latest_filing?.filing_date || 0)
        return dateB.getTime() - dateA.getTime()
      default:
        return 0
    }
  })

  const formatCurrency = (amount: string | number | null | undefined): string => {
    if (!amount) return 'N/A'
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return 'N/A'
    
    if (num >= 1_000_000_000_000) {
      return `$${(num / 1_000_000_000_000).toFixed(1)}T`
    } else if (num >= 1_000_000_000) {
      return `$${(num / 1_000_000_000).toFixed(1)}B`
    } else if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(1)}M`
    }
    return `$${num.toLocaleString()}`
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSourceBadge = () => {
    const sourceConfig = {
      cache: { color: 'bg-green-100 text-green-800', icon: '⚡', label: 'Cache Hit' },
      materialized_view: { color: 'bg-blue-100 text-blue-800', icon: '📊', label: 'Precomputed' },
      database: { color: 'bg-purple-100 text-purple-800', icon: '🗄️', label: 'Database' },
      ai: { color: 'bg-yellow-100 text-yellow-800', icon: '🤖', label: 'AI Processed' }
    }
    
    const config = sourceConfig[results.source] || sourceConfig.database
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
        <span className="ml-1 opacity-75">({results.executionTime}ms)</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {results.data.length} Results
          </h2>
          {getSourceBadge()}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sort Controls */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="aum">Sort by AUM</option>
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date</option>
          </select>
          
          {/* View Mode Toggle */}
          <div className="flex rounded border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-sm ${viewMode === 'cards' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Results Display */}
      {viewMode === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedResults.map((result, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                  {result.legal_name}
                </h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  #{index + 1}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">📍</span>
                  <span className="text-gray-700">
                    {result.state || result.main_office_location?.state || 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">💰</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(result.total_aum || result.latest_filing?.total_aum)}
                  </span>
                </div>
                
                {(result.commercial_re_fund_count || result.private_fund_count) && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">🏢</span>
                    <span className="text-gray-700">
                      {result.commercial_re_fund_count ? 
                        `${result.commercial_re_fund_count} RE funds` :
                        `${result.private_fund_count} funds`
                      }
                    </span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">📅</span>
                  <span className="text-gray-700">
                    {formatDate(result.filing_date || result.latest_filing?.filing_date)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    RIA Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AUM
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funds
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latest Filing
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedResults.map((result, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded mr-2">
                          #{index + 1}
                        </span>
                        <span className="font-medium text-gray-900">
                          {result.legal_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {result.state || result.main_office_location?.state || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(result.total_aum || result.latest_filing?.total_aum)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {result.commercial_re_fund_count || result.private_fund_count || 'N/A'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(result.filing_date || result.latest_filing?.filing_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
