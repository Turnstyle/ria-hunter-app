'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

interface OptimizedSearchFormProps {
  onSearch: (query: string) => Promise<any>
  onResults: (results: any) => void
  placeholder?: string
}

interface QuerySuggestion {
  text: string
  type: 'popular' | 'recent' | 'template'
  description: string
}

export default function OptimizedSearchForm({ 
  onSearch, 
  onResults, 
  placeholder = "Ask about RIAs, e.g., 'What are New York's 5 largest RIAs?'" 
}: OptimizedSearchFormProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([])
  const [searchSource, setSearchSource] = useState<'database' | 'cache' | 'materialized_view' | 'ai' | null>(null)

  // Pre-defined query templates for instant results
  const queryTemplates: QuerySuggestion[] = useMemo(() => [
    {
      text: "What are New York's 5 largest RIAs by assets under management?",
      type: 'template',
      description: 'Geographic filtering with asset ranking'
    },
    {
      text: "Which RIAs were most active with Commercial Real Estate private funds?",
      type: 'template', 
      description: 'Fund type activity analysis'
    },
    {
      text: "Show me the top 10 RIAs nationally by AUM",
      type: 'template',
      description: 'National ranking by assets'
    },
    {
      text: "Which RIAs have filed in the last 12 months?",
      type: 'template',
      description: 'Recent activity tracking'
    }
  ], [])

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) return
      
      setIsSearching(true)
      setSearchTime(null)
      const startTime = Date.now()
      
      try {
        const apiBase = process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || process.env.NEXT_PUBLIC_API_URL || ''
        if (!apiBase) {
          throw new Error('Search service not configured')
        }

        const resp = await fetch(`${apiBase}/api/v1/ria/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery })
        })

        const executionTime = Date.now() - startTime
        setSearchTime(executionTime)

        if (!resp.ok) {
          const err = await safeJson(resp)
          throw new Error(err?.error || `Search failed (${resp.status})`)
        }

        const data = await resp.json()

        // Normalize to OptimizedSearchResults shape
        const resultsArray = Array.isArray(data?.results) ? data.results : (Array.isArray(data?.data) ? data.data : [])
        const normalized = {
          data: resultsArray,
          source: (data?.source as any) || 'ai',
          cached: Boolean(data?.cached),
          executionTime
        }

        setSearchSource(normalized.source)
        onResults(normalized)

      } catch (error) {
        console.error('Search error:', error)
        onResults({ error: 'Search failed', data: [] })
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [onSearch, onResults]
  )

  // Load popular queries for suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const response = await fetch('/api/ria-hunter/performance-monitor')
        if (response.ok) {
          const data = await response.json()
          const popularSuggestions = data.popularQueries?.slice(0, 3).map((q: any) => ({
            text: q.query_text,
            type: 'popular' as const,
            description: `Asked ${q.query_count} times`
          })) || []
          
          setSuggestions([...queryTemplates, ...popularSuggestions])
        } else {
          setSuggestions(queryTemplates)
        }
      } catch {
        setSuggestions(queryTemplates)
      }
    }
    
    loadSuggestions()
  }, [queryTemplates])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      debouncedSearch(query)
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: QuerySuggestion) => {
    setQuery(suggestion.text)
    setShowSuggestions(false)
    debouncedSearch(suggestion.text)
  }

  const getSourceBadgeColor = (source: string | null) => {
    switch (source) {
      case 'cache': return 'bg-green-100 text-green-800'
      case 'materialized_view': return 'bg-blue-100 text-blue-800' 
      case 'database': return 'bg-purple-100 text-purple-800'
      case 'ai': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSourceIcon = (source: string | null) => {
    switch (source) {
      case 'cache': return '⚡'
      case 'materialized_view': return '📊'
      case 'database': return '🗄️'
      case 'ai': return '🤖'
      default: return '🔍'
    }
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowSuggestions(e.target.value.length > 2)
            }}
            onFocus={() => setShowSuggestions(query.length > 2)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pr-12 text-lg border-2 border-gray-200 rounded-lg 
                     focus:border-blue-500 focus:outline-none transition-colors
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isSearching}
          />
          
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 
                     text-blue-600 hover:text-blue-800 disabled:text-gray-400 
                     transition-colors"
          >
            {isSearching ? (
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>

        {/* Search Status */}
        {(isSearching || searchTime !== null) && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            {isSearching ? (
              <span className="text-blue-600">🔍 Searching...</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceBadgeColor(searchSource)}`}>
                  {getSourceIcon(searchSource)} {searchSource?.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-gray-600">
                  Results in {searchTime}ms
                </span>
              </div>
            )}
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 
                        rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2 px-2">
                Quick Queries
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded flex items-start gap-2 
                           transition-colors group"
                >
                  <span className="text-lg mt-0.5 group-hover:scale-110 transition-transform">
                    {suggestion.type === 'template' ? '📝' : 
                     suggestion.type === 'popular' ? '🔥' : '⭐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {suggestion.text}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {suggestion.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function detectQueryType(query: string): string {
  const queryLower = query.toLowerCase()
  
  if (queryLower.includes('new york') || queryLower.includes('ny') || queryLower.includes('geographic')) {
    return 'geographic'
  }
  if (queryLower.includes('top') || queryLower.includes('largest') || queryLower.includes('biggest')) {
    return 'top_by_aum'
  }
  if (queryLower.includes('commercial real estate') || queryLower.includes('fund')) {
    return 'fund_activity'
  }
  if (queryLower.includes('recent') || queryLower.includes('last') || queryLower.includes('active')) {
    return 'recent_activity'
  }
  
  return 'general'
}

async function safeJson(resp: Response): Promise<any | null> {
  try {
    return await resp.json()
  } catch {
    return null
  }
}
