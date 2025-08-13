'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

interface SearchResultsProps {
  result: {
    answer: string;
    sources: Array<{
      firm_name: string;
      crd_number: string | number;
      cik?: string | number;
      city: string;
      state: string;
      aum?: number | null;
      matched_keywords?: string[];
      score?: number;
      aggregated?: boolean;
      group_size?: number;
      crd_numbers?: string[];
    }>;
    aiProvider?: string;
    timestamp?: string;
    query?: string;
    keywords?: string[];
  } | null;
  isLoading?: boolean;
  error?: string | null;
}

const SearchResults: React.FC<SearchResultsProps> = ({ result, isLoading, error }) => {
  type FundSummaryItem = { type: string; type_short: string; count: number };
  const [summaryByFirm, setSummaryByFirm] = useState<Record<string, FundSummaryItem[]>>({});
  const [fetchedCrds, setFetchedCrds] = useState<Set<string>>(new Set());

  const apiBase = (process.env.NEXT_PUBLIC_RIA_HUNTER_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const inFlightRef = useRef<Set<string>>(new Set());
  const warnedMisconfigRef = useRef<boolean>(false);

  // Build the display list by collapsing backend-aggregated results into a single row.
  type SourceItem = SearchResultsProps['result'] extends { sources: infer U } ? U extends Array<infer S> ? S : any : any;

  const displaySources: SourceItem[] = useMemo(() => {
    const sources = result?.sources || [];
    if (sources.length === 0) return [] as SourceItem[];

    // First pass: identify aggregated groups and collect member CRDs
    const aggregatedCrds = new Set<string>();
    const groupKeyToRep = new Map<string, SourceItem>();

    for (const s of sources) {
      const crds = Array.isArray(s.crd_numbers) ? s.crd_numbers.map(String).filter(Boolean) : [];
      if (s.aggregated && crds.length > 1) {
        const key = `group:${crds.slice().sort().join('|')}`;
        crds.forEach(c => aggregatedCrds.add(String(c)));
        if (!groupKeyToRep.has(key)) {
          const representative: any = {
            ...s,
            aggregated: true,
            group_size: crds.length,
            crd_numbers: crds,
            // Use the first CRD as the representative id for linking and chip fetches
            crd_number: crds[0],
          };
          groupKeyToRep.set(key, representative);
        }
      }
    }

    // Second pass: include singletons that are not part of any aggregated group
    const singles: SourceItem[] = [];
    for (const s of sources) {
      const crd = String(s.crd_number || '');
      const isInAggregated = aggregatedCrds.has(crd);
      const isAggregatedRow = Boolean(s.aggregated && Array.isArray(s.crd_numbers) && s.crd_numbers.length > 1);
      if (!isInAggregated && !isAggregatedRow) singles.push(s);
    }

    return [...Array.from(groupKeyToRep.values()), ...singles];
  }, [result]);

  const uniqueCrds = useMemo(() => {
    if (displaySources.length === 0) return [] as string[];
    const ids = displaySources.map(s => String(s.crd_number || '')).filter(Boolean);
    const MAX_SUMMARY_FETCH = 10;
    return Array.from(new Set(ids)).slice(0, MAX_SUMMARY_FETCH);
  }, [displaySources]);

  const idsKey = useMemo(() => uniqueCrds.join(','), [uniqueCrds]);

  useEffect(() => {
    if (!apiBase || uniqueCrds.length === 0) return;

    const ids = uniqueCrds.filter(id => !summaryByFirm[id] && !fetchedCrds.has(id) && !inFlightRef.current.has(id));
    if (ids.length === 0) return;

    // Skip if API base points to this frontend host or a Vercel preview domain to avoid 404 spam
    try {
      const apiHost = new URL(apiBase).hostname;
      const isFrontendHost = typeof window !== 'undefined' && apiHost === window.location.hostname;
      const isDisallowedVercel = apiHost.endsWith('.vercel.app') && apiHost !== 'ria-hunter.vercel.app';
      if (isFrontendHost || isDisallowedVercel) {
        if (!warnedMisconfigRef.current) {
          console.warn('Skipping fund summary fetches: NEXT_PUBLIC_RIA_HUNTER_API_URL appears misconfigured (frontend or vercel domain).');
          warnedMisconfigRef.current = true;
        }
        // Mark these ids as fetched so we do not retry on future renders
        setFetchedCrds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
        return;
      }
    } catch {}

    ids.forEach(async (id) => {
      inFlightRef.current.add(id);
      try {
        // Call our proxy to avoid surfacing 404s in the console
        const proxyResp = await fetch(`/api/funds/summary/${id}`, { cache: 'no-store' });
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          const summary: FundSummaryItem[] = Array.isArray(data?.summary) ? data.summary : [];
          if (summary.length > 0) {
            setSummaryByFirm(prev => ({ ...prev, [id]: summary }));
          }
        }
      } catch {}
      finally {
        setFetchedCrds(prev => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        inFlightRef.current.delete(id);
      }
    });
  }, [apiBase, idsKey]);
  // Format the AI answer for better readability
  const formatAnswer = (answer: string): string => {
    if (!answer) return '';
    
    // Split by numbered lists (1. 2. 3. etc) and create proper formatting
    let formatted = answer
      // Handle numbered lists
      .replace(/(\d+\.)\s*\*\*(.*?)\*\*/g, '<div class="mb-3"><span class="font-bold text-blue-800">$1 $2</span>')
      .replace(/(\d+\.)\s*/g, '<div class="mb-3"><span class="font-bold text-blue-800">$1</span> ')
      // Handle bold firm names and key info
      .replace(/\*\*(.*?)\*\*/g, '<span class="font-semibold text-gray-900">$1</span>')
      // Handle CRD numbers and locations
      .replace(/CRD Number:\s*(\d+)/g, '<span class="text-sm text-gray-600">CRD: $1</span>')
      .replace(/AUM:\s*\$([0-9,]+)/g, '<span class="font-medium text-green-700">AUM: $$1</span>')
      // Add line breaks for better spacing
      .replace(/([.!?])\s+(\d+\.)/g, '$1</div><div class="mb-3"><span class="font-bold text-blue-800">$2</span> ')
      // Clean up any remaining formatting issues
      .replace(/\n/g, '<br>');
    
    // If it doesn't end with a closing div, add one
    if (!formatted.endsWith('</div>') && formatted.includes('<div class="mb-3">')) {
      formatted += '</div>';
    }
    
    return formatted;
  };

  const formatAUM = (aum: number | null | undefined): string => {
    if (!aum) return 'N/A';

    if (aum >= 1_000_000_000) {
      return `$${(aum / 1_000_000_000).toFixed(1)}B`;
    } else if (aum >= 1_000_000) {
      return `$${(aum / 1_000_000).toFixed(1)}M`;
    } else if (aum >= 1_000) {
      return `$${(aum / 1_000).toFixed(1)}K`;
    }
    return `$${aum.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-pulse space-y-4 w-full">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Search Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getAIProviderDisplay = (provider: string | undefined): string => {
    switch (provider) {
      case 'openai':
        return 'OpenAI (GPT-4 Turbo)';
      case 'vertex':
        return 'Google Vertex AI';
      default:
        return provider || 'Unknown';
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* AI Answer */}
      <div>
        <div className="flex items-center gap-2 mb-2 sm:mb-3">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span className="text-sm sm:text-base font-semibold text-gray-900">AI Assistant</span>
          {displaySources && displaySources.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-auto flex-shrink-0">
              {Math.min(displaySources.length, 10)} shown
            </span>
          )}
        </div>
        
        <div className="prose prose-sm max-w-none text-left">
          <div 
            className="text-gray-700 text-sm sm:text-base leading-relaxed space-y-2 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: formatAnswer(result.answer) }}
          />
        </div>
      </div>

      {/* Sources */}
      {result.sources && result.sources.length > 0 && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
          <details open>
            <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-6a1 1 0 01-1-1V8z" clipRule="evenodd"/>
              </svg>
              Source Data ({result.sources.length}) - <span className="text-blue-600">Click RIA names for profiles</span>
            </summary>
            <div className="mt-2 sm:mt-3 space-y-2">
              {displaySources.slice(0, 10).map((source, index) => {
                const rawKeywords = (source.matched_keywords || []).map((k: unknown) => String(k).toLowerCase())
                const tags: string[] = []
                if (rawKeywords.some((k: string) => k.includes('venture capital'))) tags.push('VC')
                if (rawKeywords.some((k: string) => k.includes('private equity') || k === 'pe')) tags.push('PE')
                if (rawKeywords.some((k: string) => k.includes('commercial real estate') || k === 'cre' || k.includes('real estate'))) tags.push('RE')
                if (rawKeywords.some((k: string) => k.includes('hedge'))) tags.push('Hedge')
                const key = String(source.crd_number || source.cik || '').trim()
                const summary = key ? summaryByFirm[key] : undefined
                return (
                <div key={index} className="border-l-3 border-blue-400 pl-2 sm:pl-3 py-2 bg-blue-50/50 rounded-r">
                  <div className="font-medium text-gray-900 text-xs sm:text-sm mb-1 break-words">
                    <Link 
                      href={`/profile/${source.crd_number}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                      title="Click to view detailed RIA profile with Living Profile features"
                    >
                      {source.firm_name}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="flex-shrink-0">CRD: {source.crd_number}</span>
                      <span className="break-words">{source.city}, {source.state}</span>
                      {source.aum && (
                        <span className="font-medium text-green-700 flex-shrink-0">
                          AUM: {formatAUM(source.aum)}
                        </span>
                      )}
                      {source.aggregated && (source.group_size || (source.crd_numbers && source.crd_numbers.length > 1)) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800">
                          Group of {source.group_size || (source.crd_numbers?.length || 1)}
                        </span>
                      )}
                      {source.aggregated && Array.isArray(source.crd_numbers) && source.crd_numbers.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.nextElementSibling?.classList.toggle('hidden')
                          }}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View members
                        </button>
                      )}
                    </div>
                    {Array.isArray(source.crd_numbers) && source.crd_numbers.length > 1 && (
                      <div className="hidden pl-0.5">
                        <div className="mt-1 text-[11px] text-gray-700">Members CRDs: {source.crd_numbers.join(', ')}</div>
                      </div>
                    )}
                    {summary && summary.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {summary.map((s, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-800">
                            {s.type_short}
                            <span className="ml-1 opacity-80">{s.count}</span>
                          </span>
                        ))}
                      </div>
                    ) : (tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tags.map((t, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-800">
                            {t}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )})}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
