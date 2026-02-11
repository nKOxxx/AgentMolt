-- ============================================
-- WEEK 2: REDIS & BACKGROUND JOBS
-- Caching, rate limiting, job queue
-- ============================================

-- ============================================
-- 1. CREATE JOB QUEUE TABLE (for Bull/Redis fallback)
-- ============================================
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Job details
    name VARCHAR(100) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'failed', 'delayed')),
    
    -- Attempts
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Timing
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    delay_until TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    stack_trace TEXT,
    
    -- For retries
    backoff_type VARCHAR(20) DEFAULT 'exponential', -- 'fixed', 'exponential'
    backoff_delay_ms INTEGER DEFAULT 2000,
    
    -- Metadata
    priority INTEGER DEFAULT 0, -- Higher = processed first
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job processing
CREATE INDEX idx_job_queue_status ON job_queue(status, priority DESC, created_at);
CREATE INDEX idx_job_queue_org ON job_queue(org_id, status);
CREATE INDEX idx_job_queue_delay ON job_queue(delay_until) WHERE status = 'delayed';

-- ============================================
-- 2. RATE LIMIT TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limit_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Window tracking
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    
    -- Usage
    request_count INTEGER DEFAULT 0,
    
    UNIQUE(org_id, window_start)
);

CREATE INDEX idx_rate_limit_windows_org ON rate_limit_windows(org_id, window_end);

-- ============================================
-- 3. CACHE METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Cache key and value
    cache_key VARCHAR(500) NOT NULL,
    cache_value JSONB NOT NULL,
    
    -- TTL
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(org_id, cache_key)
);

CREATE INDEX idx_cache_entries_org ON cache_entries(org_id, cache_key);
CREATE INDEX idx_cache_entries_expiry ON cache_entries(expires_at);

-- ============================================
-- 4. AGENT SESSION TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    
    -- Session info
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    
    -- Usage
    request_count INTEGER DEFAULT 0,
    last_request_at TIMESTAMPTZ,
    
    -- Lifecycle
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    
    UNIQUE(org_id, agent_id, session_token)
);

CREATE INDEX idx_agent_sessions_token ON agent_sessions(session_token);
CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_id, expires_at);

-- ============================================
-- 5. FUNCTIONS FOR RATE LIMITING
-- ============================================

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_org_id UUID,
    p_limit_per_minute INTEGER DEFAULT 100
) RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_at TIMESTAMPTZ
) AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_window_end TIMESTAMPTZ;
    v_current_count INTEGER;
    v_allowed BOOLEAN;
    v_remaining INTEGER;
BEGIN
    -- Define current minute window
    v_window_start := date_trunc('minute', NOW());
    v_window_end := v_window_start + interval '1 minute';
    
    -- Get or create window
    INSERT INTO rate_limit_windows (org_id, window_start, window_end, request_count)
    VALUES (p_org_id, v_window_start, v_window_end, 0)
    ON CONFLICT (org_id, window_start) DO NOTHING;
    
    -- Get current count
    SELECT request_count INTO v_current_count
    FROM rate_limit_windows
    WHERE org_id = p_org_id AND window_start = v_window_start;
    
    -- Check if allowed
    v_allowed := v_current_count < p_limit_per_minute;
    v_remaining := GREATEST(0, p_limit_per_minute - v_current_count - 1);
    
    -- Increment if allowed
    IF v_allowed THEN
        UPDATE rate_limit_windows
        SET request_count = request_count + 1
        WHERE org_id = p_org_id AND window_start = v_window_start;
    END IF;
    
    RETURN QUERY SELECT v_allowed, v_remaining, v_window_end;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old rate limit windows
CREATE OR REPLACE FUNCTION cleanup_rate_limit_windows()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_windows
    WHERE window_end < NOW() - interval '1 hour';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM cache_entries
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. UPDATE ORGANIZATIONS WITH CURRENT USAGE
-- ============================================
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS current_storage_bytes BIGINT DEFAULT 0;

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS current_request_count INTEGER DEFAULT 0;

-- Function to update org stats
CREATE OR REPLACE FUNCTION update_org_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE organizations 
        SET current_storage_bytes = current_storage_bytes + LENGTH(NEW.content),
            current_request_count = current_request_count + 1
        WHERE id = NEW.org_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE organizations 
        SET current_storage_bytes = GREATEST(0, current_storage_bytes - LENGTH(OLD.content))
        WHERE id = OLD.org_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update org storage
DROP TRIGGER IF EXISTS update_org_storage_trigger ON memories;
CREATE TRIGGER update_org_storage_trigger
    AFTER INSERT OR DELETE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_org_storage();

SELECT 'Week 2 migration complete: Redis, caching, rate limiting, background jobs' as status;
