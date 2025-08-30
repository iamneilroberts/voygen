-- Performance Monitoring Dashboard Queries

-- 1. Tool Usage Statistics
SELECT 'Tool Usage Stats' as metric_type,
       context_type,
       COUNT(*) as total_records,
       SUM(access_count) as total_accesses,
       AVG(access_count) as avg_accesses,
       MAX(access_count) as most_accessed_count,
       MIN(last_accessed) as oldest_access,
       MAX(last_accessed) as newest_access
FROM llm_trip_context
GROUP BY context_type

UNION ALL

-- 2. Most Popular Searches
SELECT 'Popular Searches' as metric_type,
       'Top Item: ' || natural_key as context_type,
       1 as total_records,
       access_count as total_accesses,
       access_count as avg_accesses,
       access_count as most_accessed_count,
       last_accessed as oldest_access,
       last_accessed as newest_access
FROM llm_trip_context
WHERE access_count > 0
ORDER BY access_count DESC
LIMIT 5

UNION ALL

-- 3. FAQ Pattern Usage
SELECT 'FAQ Usage' as metric_type,
       question_pattern as context_type,
       1 as total_records,
       usage_count as total_accesses,
       usage_count as avg_accesses,
       usage_count as most_accessed_count,
       NULL as oldest_access,
       NULL as newest_access
FROM llm_faq_cache
WHERE usage_count > 0

UNION ALL

-- 4. Search Index Stats
SELECT 'Search Index' as metric_type,
       entity_type as context_type,
       COUNT(*) as total_records,
       SUM(access_count) as total_accesses,
       AVG(relevance_score) as avg_accesses,
       MAX(access_count) as most_accessed_count,
       NULL as oldest_access,
       NULL as newest_access
FROM search_index
GROUP BY entity_type

UNION ALL

-- 5. Recent Activity (last 24 hours)
SELECT 'Recent Activity' as metric_type,
       'Last 24h' as context_type,
       COUNT(*) as total_records,
       SUM(access_count) as total_accesses,
       0 as avg_accesses,
       0 as most_accessed_count,
       MIN(last_accessed) as oldest_access,
       MAX(last_accessed) as newest_access
FROM llm_trip_context
WHERE last_accessed > datetime('now', '-1 day');