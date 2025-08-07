import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase-server'
import crypto from 'crypto'

interface QueryResult {
  data: any[]
  cached: boolean
  executionTime: number
  source: 'database' | 'cache' | 'materialized_view'
}

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'general' } = await request.json()
    const startTime = Date.now()
    
    const supabase = getServerSupabaseClient()
    
    // Generate cache key
    const normalizedQuery = normalizeQuery(query)
    const cacheKey = crypto.createHash('sha256').update(normalizedQuery).digest('hex')
    
    // Check cache first
    const cachedResult = await checkCache(supabase, cacheKey)
    if (cachedResult) {
      await incrementHitCount(supabase, cacheKey)
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        executionTime: Date.now() - startTime,
        source: 'cache'
      })
    }
    
    // Try to match common query patterns to materialized views
    const mvResult = await tryMaterializedViews(supabase, query, normalizedQuery)
    if (mvResult) {
      // Cache the result for future use
      await cacheResult(supabase, cacheKey, query, type, mvResult, 3600) // 1 hour TTL
      return NextResponse.json({
        data: mvResult,
        cached: false,
        executionTime: Date.now() - startTime,
        source: 'materialized_view'
      })
    }
    
    // Execute direct database query
    const dbResult = await executeDirectQuery(supabase, query, normalizedQuery)
    
    if (dbResult) {
      // Cache successful database results
      await cacheResult(supabase, cacheKey, query, type, dbResult, 1800) // 30 minutes TTL
      await trackPopularQuery(supabase, query, normalizedQuery)
      
      return NextResponse.json({
        data: dbResult,
        cached: false,
        executionTime: Date.now() - startTime,
        source: 'database'
      })
    }
    
    // If no database results, indicate fallback to AI needed
    return NextResponse.json({
      data: null,
      cached: false,
      executionTime: Date.now() - startTime,
      source: 'no_results',
      fallbackToAI: true
    })
    
  } catch (error) {
    console.error('Fast query error:', error)
    return NextResponse.json({ error: 'Query execution failed' }, { status: 500 })
  }
}

async function checkCache(supabase: any, cacheKey: string) {
  const { data } = await supabase
    .from('query_cache')
    .select('result_data')
    .eq('query_hash', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single()
  
  return data?.result_data || null
}

async function incrementHitCount(supabase: any, cacheKey: string) {
  await supabase
    .from('query_cache')
    .update({ 
      hit_count: supabase.raw('hit_count + 1'),
      last_accessed: new Date().toISOString()
    })
    .eq('query_hash', cacheKey)
}

async function cacheResult(supabase: any, cacheKey: string, query: string, type: string, data: any, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  
  await supabase
    .from('query_cache')
    .upsert({
      query_hash: cacheKey,
      query_text: query,
      query_type: type,
      result_data: data,
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
}

async function trackPopularQuery(supabase: any, query: string, normalizedQuery: string) {
  await supabase
    .from('popular_queries')
    .upsert({
      query_text: query,
      normalized_query: normalizedQuery,
      last_asked: new Date().toISOString()
    }, {
      onConflict: 'normalized_query'
    })
    .then(() => {
      // Increment count on conflict
      return supabase
        .from('popular_queries')
        .update({ 
          query_count: supabase.raw('query_count + 1'),
          last_asked: new Date().toISOString()
        })
        .eq('normalized_query', normalizedQuery)
    })
}

async function tryMaterializedViews(supabase: any, query: string, normalizedQuery: string) {
  const queryLower = normalizedQuery.toLowerCase()
  
  // Pattern: "top N RIAs by AUM" or "largest RIAs"
  if (queryLower.includes('top') || queryLower.includes('largest') || queryLower.includes('biggest')) {
    if (queryLower.includes('new york') || queryLower.includes(' ny ')) {
      const { data } = await supabase
        .from('mv_top_rias_by_aum')
        .select('*')
        .eq('state', 'NY')
        .limit(10)
      return data
    } else {
      const { data } = await supabase
        .from('mv_top_rias_by_aum')
        .select('*')
        .limit(10)
      return data
    }
  }
  
  // Pattern: "commercial real estate" queries
  if (queryLower.includes('commercial real estate') || queryLower.includes('real estate')) {
    const { data } = await supabase
      .from('mv_commercial_re_activity')
      .select('*')
      .limit(10)
    return data
  }
  
  // Pattern: "recent activity" or "last 12 months"
  if (queryLower.includes('recent') || queryLower.includes('active') || queryLower.includes('last')) {
    const { data } = await supabase
      .from('mv_recent_filing_activity')
      .select('*')
      .limit(10)
    return data
  }
  
  return null
}

async function executeDirectQuery(supabase: any, query: string, normalizedQuery: string) {
  const queryLower = normalizedQuery.toLowerCase()
  
  // Geographic filtering
  if (queryLower.includes('new york') || queryLower.includes(' ny ')) {
    const { data } = await supabase
      .from('advisers')
      .select(`
        legal_name,
        main_office_location,
        filings (
          total_aum,
          filing_date,
          private_fund_count
        )
      `)
      .eq('main_office_location->state', 'NY')
      .order('filings.total_aum', { ascending: false })
      .limit(10)
    
    return data?.map(adviser => ({
      ...adviser,
      latest_filing: adviser.filings?.[0]
    }))
  }
  
  // General top RIAs query
  if (queryLower.includes('top') || queryLower.includes('largest')) {
    const { data } = await supabase
      .from('advisers')
      .select(`
        legal_name,
        main_office_location,
        filings (
          total_aum,
          filing_date,
          private_fund_count
        )
      `)
      .not('filings.total_aum', 'is', null)
      .order('filings.total_aum', { ascending: false })
      .limit(10)
    
    return data?.map(adviser => ({
      ...adviser,
      latest_filing: adviser.filings?.[0]
    }))
  }
  
  return null
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(top|largest|biggest)\s*(\d+)/gi, 'top N')
    .replace(/(last|past)\s*(\d+)\s*(months?|years?)/gi, 'last N timeunit')
    .trim()
}
