-- RIA Hunter Performance Optimization Script
-- This script contains all the performance optimizations for instant query responses

-- Enable timing for performance monitoring
\timing

-- Display current status
SELECT 'Starting RIA Hunter performance optimization...' as status;

-- 1. Refresh all materialized views
SELECT 'Refreshing materialized views...' as status;
SELECT refresh_performance_views();

-- 2. Update table statistics for better query planning
SELECT 'Updating table statistics...' as status;
ANALYZE advisers, filings, private_funds, query_cache, popular_queries, search_analytics;

-- 3. Clean up expired cache entries
SELECT 'Cleaning expired cache entries...' as status;
DELETE FROM query_cache WHERE expires_at < NOW();

-- 4. Optimize database settings for performance
SELECT 'Optimizing database configuration...' as status;

-- Check current performance settings
SELECT 
    name, 
    setting, 
    unit,
    short_desc
FROM pg_settings 
WHERE name IN (
    'shared_buffers',
    'effective_cache_size', 
    'work_mem',
    'maintenance_work_mem',
    'random_page_cost',
    'seq_page_cost'
);

-- 5. Test query performance
SELECT 'Testing query performance...' as status;

-- Test 1: Geographic filtering (New York RIAs)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT a.legal_name, f.total_aum, a.main_office_location->>'state'
FROM advisers a
JOIN filings f ON a.id = f.adviser_id
WHERE a.main_office_location->>'state' = 'NY'
ORDER BY f.total_aum DESC NULLS LAST
LIMIT 5;

-- Test 2: Commercial Real Estate activity
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)  
SELECT a.legal_name, COUNT(pf.id) as re_funds, SUM(pf.gross_asset_value) as total_re
FROM advisers a
JOIN filings f ON a.id = f.adviser_id
JOIN private_funds pf ON f.id = pf.filing_id
WHERE pf.fund_type = 'Commercial Real Estate'
GROUP BY a.legal_name
ORDER BY re_funds DESC, total_re DESC
LIMIT 5;

-- Test 3: Materialized view performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM mv_top_rias_by_aum WHERE state = 'NY' LIMIT 5;

-- 6. Check index usage
SELECT 'Checking index usage...' as status;

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC
LIMIT 15;

-- 7. Cache performance metrics
SELECT 'Cache performance metrics:' as status;
SELECT get_cache_stats();

-- 8. Search analytics summary
SELECT 'Search analytics summary:' as status;
SELECT get_search_insights(30); -- Last 30 days

-- 9. Database size information
SELECT 'Database size information:' as status;
SELECT 
    'advisers' as table_name,
    COUNT(*) as rows,
    pg_size_pretty(pg_total_relation_size('advisers'::regclass)) as size
FROM advisers
UNION ALL
SELECT 
    'filings' as table_name,
    COUNT(*) as rows,
    pg_size_pretty(pg_total_relation_size('filings'::regclass)) as size
FROM filings
UNION ALL
SELECT 
    'private_funds' as table_name,
    COUNT(*) as rows,
    pg_size_pretty(pg_total_relation_size('private_funds'::regclass)) as size
FROM private_funds
UNION ALL
SELECT 
    'query_cache' as table_name,
    COUNT(*) as rows,
    pg_size_pretty(pg_total_relation_size('query_cache'::regclass)) as size
FROM query_cache
ORDER BY table_name;

-- 10. Final optimization status
SELECT 'RIA Hunter optimization completed!' as status;
SELECT NOW() as completion_time;
