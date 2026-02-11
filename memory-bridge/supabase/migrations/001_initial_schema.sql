-- Memory Bridge Lite - Database Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLE: memories
-- ============================================
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL,
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    
    -- Core content
    content TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL 
        CHECK (content_type IN ('conversation', 'action', 'insight', 'error')),
    
    -- Metadata for search/filtering
    metadata JSONB NOT NULL DEFAULT '{
        "keywords": [],
        "people": [],
        "projects": [],
        "importance": 5,
        "source": "unknown"
    }'::jsonb,
    
    -- Analytics
    retrieval_count INTEGER NOT NULL DEFAULT 0,
    last_retrieved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Primary lookup: by agent, sorted by recency
CREATE INDEX idx_memories_agent_created 
    ON memories(agent_id, created_at DESC);

-- Search: GIN index on keywords array within metadata
CREATE INDEX idx_memories_keywords 
    ON memories USING GIN ((metadata->'keywords'));

-- Search: GIN index on people (for "what did I discuss with X?")
CREATE INDEX idx_memories_people 
    ON memories USING GIN ((metadata->'people'));

-- Search: GIN index on projects
CREATE INDEX idx_memories_projects 
    ON memories USING GIN ((metadata->'projects'));

-- Soft delete filter (exclude deleted by default)
CREATE INDEX idx_memories_not_deleted 
    ON memories(agent_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- ============================================
-- AUDIT TABLE: memory_queries
-- ============================================
CREATE TABLE memory_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL,
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    
    query TEXT NOT NULL,
    query_keywords TEXT[],
    results_count INTEGER NOT NULL,
    response_time_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_memory_queries_agent 
    ON memory_queries(agent_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_queries ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can only access their own memories
CREATE POLICY agent_isolation_memories ON memories
    FOR ALL
    USING (agent_id = current_setting('app.current_agent_id')::UUID);

CREATE POLICY agent_isolation_queries ON memory_queries
    FOR ALL
    USING (agent_id = current_setting('app.current_agent_id')::UUID);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Increment retrieval_count on query (called by application)
CREATE OR REPLACE FUNCTION increment_memory_retrieval(memory_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE memories 
    SET retrieval_count = retrieval_count + 1,
        last_retrieved_at = NOW()
    WHERE id = memory_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- KEYWORD EXTRACTION HELPER
-- ============================================

-- This function will be called by the API to extract keywords
-- For now, it's a placeholder - actual NLP happens in Node.js
CREATE OR REPLACE FUNCTION extract_keywords(input_text TEXT)
RETURNS TEXT[] AS $$
BEGIN
    -- Basic keyword extraction (fallback if Node.js fails)
    -- Removes common words, splits by space/punctuation
    RETURN ARRAY(
        SELECT DISTINCT word
        FROM regexp_split_to_table(
            lower(regexp_replace(input_text, '[^a-zA-Z0-9\s]', ' ', 'g')), 
            '\s+'
        ) AS word
        WHERE length(word) > 3
        AND word NOT IN ('this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'while', 'about', 'would', 'could', 'should')
        LIMIT 20
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Daily memory stats per agent
CREATE VIEW memory_stats_daily AS
SELECT 
    agent_id,
    DATE(created_at) as date,
    content_type,
    COUNT(*) as count,
    AVG((metadata->>'importance')::int) as avg_importance
FROM memories
WHERE deleted_at IS NULL
GROUP BY agent_id, DATE(created_at), content_type;

-- Top retrieved memories (for "most valuable" insights)
CREATE VIEW top_memories AS
SELECT 
    id,
    agent_id,
    content,
    metadata,
    retrieval_count,
    created_at
FROM memories
WHERE deleted_at IS NULL
ORDER BY retrieval_count DESC, created_at DESC
LIMIT 100;

-- ============================================
-- SEED DATA (for testing)
-- ============================================

-- Add a test agent (replace with real agent_id later)
INSERT INTO memories (agent_id, content, content_type, metadata) VALUES
(
    '4ee927aa-4899-4c07-ba4c-cf1edcc0c348', -- ares_agent
    'Discussed Memory Bridge Lite architecture with Nikola',
    'conversation',
    '{
        "keywords": ["memory", "bridge", "architecture", "supabase"],
        "people": ["nikola"],
        "projects": ["AgentMolt"],
        "importance": 9,
        "source": "telegram"
    }'::jsonb
),
(
    '4ee927aa-4899-4c07-ba4c-cf1edcc0c348',
    'Designed database schema for agent memory persistence',
    'insight',
    '{
        "keywords": ["database", "schema", "persistence"],
        "people": [],
        "projects": ["AgentMolt"],
        "importance": 8,
        "source": "design"
    }'::jsonb
);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE memories IS 'Core storage for agent memories with metadata for search';
COMMENT ON COLUMN memories.metadata IS 'JSONB containing: keywords[], people[], projects[], importance (1-10), source';
COMMENT ON TABLE memory_queries IS 'Audit log of all memory queries for analytics';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 'Memory Bridge Lite schema created successfully!' as status;
