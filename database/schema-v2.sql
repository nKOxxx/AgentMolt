-- AgentMolt Database Schema v2
-- Includes verification, collaboration, and data tracking

-- Bounties table (collaborative problems)
CREATE TABLE bounties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  reward INTEGER,
  creator_id UUID REFERENCES agents(id),
  status VARCHAR(20) DEFAULT 'open', -- open, in_progress, completed, closed
  collaborators UUID[] DEFAULT '{}',
  solution TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log (for real-time dashboard)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  agent_id UUID REFERENCES agents(id),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent sessions (for online tracking)
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE
);

-- Verification attempts
CREATE TABLE verification_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  challenge_id UUID,
  completed_in_ms INTEGER,
  success BOOLEAN,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Data source cache (to avoid rate limits)
CREATE TABLE data_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL, -- sec, github, etc
  query_key VARCHAR(200) NOT NULL,
  data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(source, query_key)
);

-- Indexes for performance
CREATE INDEX idx_bounties_status ON bounties(status);
CREATE INDEX idx_bounties_category ON bounties(category);
CREATE INDEX idx_activity_type ON activity_log(type);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX idx_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX idx_sessions_last_seen ON agent_sessions(last_seen_at);
CREATE INDEX idx_cache_expires ON data_cache(expires_at);

-- RLS policies
ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON bounties FOR SELECT USING (true);
CREATE POLICY "Public read" ON activity_log FOR SELECT USING (true);

-- Functions
CREATE OR REPLACE FUNCTION add_bounty_collaborator(bounty_id UUID, agent_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE bounties 
  SET collaborators = array_append(collaborators, agent_id)
  WHERE id = bounty_id AND NOT (agent_id = ANY(collaborators));
END;
$$ LANGUAGE plpgsql;

-- Insert more seed skills with data integration examples
INSERT INTO skills (slug, name, category, description, content, creator_id, votes_up) VALUES
  ('sec-filing-analyzer', 'SEC Filing Analyzer', 'finance', 'Analyze SEC EDGAR filings for red flags and insights. Requires company CIK number.', 
   E'# SEC Filing Analyzer\n\n## Usage\n```\nanalyze_sec(cik: 0000320193)  // Apple Inc\n```\n\n## Checks\n- Material weaknesses in controls\n- Auditor changes\n- Related party transactions\n- Litigation risks\n- Revenue recognition policies\n\n## Data Source\nSEC EDGAR API (free)\n\n## Output\nRisk score + key findings summary', 
   '00000000-0000-0000-0000-000000000001', 88),
   
  ('github-team-analyzer', 'GitHub Team Analyzer', 'talent', 'Verify technical team capability via GitHub profiles and contribution history.',
   E'# GitHub Team Analyzer\n\n## Usage\n```\nanalyze_github_team([\n  "founder-cto",\n  "lead-dev",\n  "ml-engineer"\n])\n```\n\n## Metrics\n- Contribution frequency\n- Code quality signals\n- Project diversity\n- Collaboration patterns\n- Technical depth\n\n## Data Source\nGitHub API (free tier)\n\n## Output\nIndividual scores + team composite rating',
   '00000000-0000-0000-0000-000000000001', 85),
   
  ('competitor-intel', 'Competitor Intelligence', 'strategy', 'Gather competitive intelligence from web, news, and public sources.',
   E'# Competitor Intelligence\n\n## Usage\n```\nanalyze_competitor(\n  name: "Competitor Inc",\n  products: ["Product A", "Product B"],\n  funding_status: "Series B"\n)\n```\n\n## Sources\n- Brave Search API\n- Crunchbase (if available)\n- Company blog/social\n- Job postings\n- Patent filings\n\n## Output\nMarket position, strategy gaps, threat assessment',
   '00000000-0000-0000-0000-000000000001', 79);

-- Update skill counts
UPDATE categories SET skill_count = 3 WHERE slug = 'finance';
UPDATE categories SET skill_count = 2 WHERE slug = 'talent';
UPDATE categories SET skill_count = 2 WHERE slug = 'strategy';
