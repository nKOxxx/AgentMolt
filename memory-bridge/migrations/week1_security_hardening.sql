-- ============================================
-- WEEK 1: SECURITY HARDENING
-- Multi-tenancy, RLS, Audit Logging
-- ============================================

-- ============================================
-- 1. ORGANIZATIONS TABLE (Multi-tenancy root)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL, -- Hashed API key
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    
    -- Quotas (enforced in app layer)
    max_agents INTEGER DEFAULT 10,
    max_storage_mb INTEGER DEFAULT 500,
    max_requests_per_day INTEGER DEFAULT 10000,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default org for existing data
INSERT INTO organizations (id, name, slug, api_key_hash, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Org',
    'default',
    crypt('mb-free-7x9k2m5p8q1', gen_salt('bf')),
    'free'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. UPDATE MEMORIES TABLE (Add org_id)
-- ============================================
-- First add column if not exists
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Update existing records
UPDATE memories SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Make org_id NOT NULL after migration
ALTER TABLE memories ALTER COLUMN org_id SET NOT NULL;

-- ============================================
-- 3. CREATE AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant + Actor
    org_id UUID NOT NULL REFERENCES organizations(id),
    agent_id UUID,
    user_id UUID,
    
    -- Action details
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'QUERY', 'LOGIN', 'LOGOUT', 'EXPORT')),
    resource_type VARCHAR(50) NOT NULL, -- 'memory', 'agent', 'organization'
    resource_id UUID,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_path TEXT,
    request_method VARCHAR(10),
    
    -- Changes (for UPDATE)
    old_values JSONB,
    new_values JSONB,
    
    -- Query context (for READ/QUERY)
    query_params JSONB,
    results_count INTEGER,
    
    -- Performance
    response_time_ms INTEGER,
    
    -- Outcome
    success BOOLEAN NOT NULL DEFAULT true,
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Request tracking
    request_id UUID DEFAULT gen_random_uuid(),
    session_id UUID,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs(request_id);

-- Partition by month (for performance at scale)
-- CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on memories
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS tenant_isolation ON memories;
DROP POLICY IF EXISTS agent_isolation ON memories;

-- Policy: Users can only see their org's data
CREATE POLICY tenant_isolation ON memories
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::UUID);

-- Policy: Agents can only see their own data within org
CREATE POLICY agent_isolation ON memories
    FOR ALL
    USING (
        org_id = current_setting('app.current_org_id')::UUID
        AND agent_id = current_setting('app.current_agent_id')::UUID
    );

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Audit logs only visible to org
CREATE POLICY audit_tenant_isolation ON audit_logs
    FOR SELECT
    USING (org_id = current_setting('app.current_org_id')::UUID);

-- ============================================
-- 5. API KEYS TABLE (Key management)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Key details (key itself is hashed)
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification
    
    -- Scope
    name VARCHAR(255),
    scopes JSONB DEFAULT '["read", "write"]', -- ["read", "write", "admin"]
    
    -- Rate limiting (per key)
    rate_limit_per_minute INTEGER DEFAULT 100,
    
    -- Lifecycle
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(org_id, key_hash)
);

-- Insert default API key for existing org
INSERT INTO api_keys (org_id, key_hash, key_prefix, name, scopes)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    crypt('mb-free-7x9k2m5p8q1', gen_salt('bf')),
    'mb-free-',
    'Default Key',
    '["read", "write"]'
)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- ============================================
-- 6. AGENTS TABLE (Agent registry)
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Identity
    name VARCHAR(255),
    type VARCHAR(50) DEFAULT 'ai-agent', -- 'ai-agent', 'user', 'service'
    
    -- Metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Stats
    memory_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(org_id, name)
);

-- Migrate existing agent_ids from memories
INSERT INTO agents (id, org_id, name, type, last_activity_at)
SELECT DISTINCT 
    m.agent_id,
    m.org_id,
    'Agent ' || SUBSTRING(m.agent_id::text, 1, 8),
    'ai-agent',
    MAX(m.created_at)
FROM memories m
WHERE m.agent_id NOT IN (SELECT id FROM agents)
GROUP BY m.agent_id, m.org_id;

CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(org_id);

-- ============================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(org_id UUID, agent_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_org_id', org_id::text, false);
    IF agent_id IS NOT NULL THEN
        PERFORM set_config('app.current_agent_id', agent_id::text, false);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit(
    p_org_id UUID,
    p_agent_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        org_id, agent_id, action, resource_type, resource_id,
        old_values, new_values, success
    ) VALUES (
        p_org_id, p_agent_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_success
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent stats
CREATE OR REPLACE FUNCTION update_agent_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE agents 
        SET memory_count = memory_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.agent_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE agents 
        SET memory_count = GREATEST(0, memory_count - 1)
        WHERE id = OLD.agent_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update agent stats
DROP TRIGGER IF EXISTS update_agent_memory_count ON memories;
CREATE TRIGGER update_agent_memory_count
    AFTER INSERT OR DELETE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_stats();

-- ============================================
-- 8. QUOTA TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Daily tracking
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Usage
    requests_count INTEGER DEFAULT 0,
    storage_bytes BIGINT DEFAULT 0,
    
    -- Breakdown
    create_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    query_count INTEGER DEFAULT 0,
    
    UNIQUE(org_id, date)
);

CREATE INDEX IF NOT EXISTS idx_quota_usage_org_date ON quota_usage(org_id, date);

COMMIT;
