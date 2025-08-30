-- Add indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_llm_context_keywords ON llm_trip_context(search_keywords);
CREATE INDEX IF NOT EXISTS idx_llm_context_natural_key ON llm_trip_context(natural_key);
CREATE INDEX IF NOT EXISTS idx_llm_context_type ON llm_trip_context(context_type);
CREATE INDEX IF NOT EXISTS idx_llm_context_access ON llm_trip_context(access_count DESC);

-- FAQ cache indexes
CREATE INDEX IF NOT EXISTS idx_faq_pattern ON llm_faq_cache(question_pattern);
CREATE INDEX IF NOT EXISTS idx_faq_usage ON llm_faq_cache(use_count DESC);

-- Search index optimization
CREATE INDEX IF NOT EXISTS idx_search_combined ON search_index(entity_type, search_tokens);
CREATE INDEX IF NOT EXISTS idx_search_relevance ON search_index(relevance_score DESC, entity_type);

-- Session context indexes
CREATE INDEX IF NOT EXISTS idx_session_expires ON session_context(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_accessed ON session_context(last_accessed);