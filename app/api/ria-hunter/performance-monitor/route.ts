import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/app/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get cache statistics
    const { data: cacheStats } = await supabase
      .rpc('get_cache_stats')
      .single()
    
    // Get popular queries
    const { data: popularQueries } = await supabase
      .from('popular_queries')
      .select('query_text, query_count, last_asked')
      .order('query_count', { ascending: false })
      .limit(10)
    
    // Get recent performance metrics
    const { data: recentQueries } = await supabase
      .from('query_cache')
      .select('query_type, hit_count, created_at, last_accessed')
      .order('last_accessed', { ascending: false })
      .limit(20)
    
    return NextResponse.json({
      cacheStats,
      popularQueries,
      recentQueries,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Performance monitoring error:', error)
    return NextResponse.json({ error: 'Failed to get performance metrics' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    const supabase = createServerClient()
    
    if (action === 'refresh_views') {
      await supabase.rpc('refresh_performance_views')
      return NextResponse.json({ message: 'Performance views refreshed' })
    }
    
    if (action === 'clear_cache') {
      await supabase
        .from('query_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())
      
      return NextResponse.json({ message: 'Expired cache entries cleared' })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('Performance action error:', error)
    return NextResponse.json({ error: 'Failed to execute performance action' }, { status: 500 })
  }
}
