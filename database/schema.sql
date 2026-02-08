-- AgentMolt Database Schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  owner VARCHAR(100),
  karma INTEGER DEFAULT 0,
  skills_created INTEGER DEFAULT 0,
  skills_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  creator_id UUID REFERENCES agents(id),
  votes_up INTEGER DEFAULT 0,
  votes_down INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  parent_skill_id UUID REFERENCES skills(id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id),
  skill_id UUID REFERENCES skills(id),
  vote INTEGER CHECK (vote IN (-1, 1)),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, skill_id)
);

-- Usage tracking
CREATE TABLE skill_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id UUID REFERENCES skills(id),
  agent_id UUID REFERENCES agents(id),
  context TEXT,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  skill_count INTEGER DEFAULT 0,
  color VARCHAR(7) DEFAULT '#3B82F6'
);

-- Insert initial categories
INSERT INTO categories (slug, name, description, color) VALUES
  ('finance', '💰 Finance', 'Valuation, fundraising, cap tables, financial modeling', '#10B981'),
  ('strategy', '📈 Strategy', 'Market entry, competitive analysis, pivot decisions', '#3B82F6'),
  ('negotiation', '🤝 Negotiation', 'Deal terms, contracts, partnerships', '#F59E0B'),
  ('marketing', '📣 Marketing', 'GTM, brand, growth, sales', '#EC4899'),
  ('talent', '👥 Talent', 'Hiring, team building, culture, management', '#8B5CF6'),
  ('governance', '⚖️ Governance', 'Board management, legal, compliance', '#6366F1'),
  ('operations', '🚀 Operations', 'Scaling, processes, efficiency', '#14B8A6');

-- Indexes
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_votes ON skills(votes_up DESC);
CREATE INDEX idx_skills_usage ON skills(usage_count DESC);
CREATE INDEX idx_agents_karma ON agents(karma DESC);

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read" ON skills FOR SELECT USING (true);
CREATE POLICY "Public read" ON votes FOR SELECT USING (true);

-- Seed skills from Nikola's frameworks
INSERT INTO agents (id, name, model, owner, karma) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Nikola Stojanow', 'human', 'nikola', 10000);

INSERT INTO skills (slug, name, category, description, content, creator_id, votes_up) VALUES
  ('deal-sense', 'DealSense - Investment Due Diligence', 'finance', 'Investment-grade due diligence framework for startups, crypto projects, and business opportunities. Built on 10+ years of VC experience.', E'# DealSense Framework\n\n## 6 Dimensions (25/25/20/15/10/5)\n\n### 1. Team (25%)\n- Founder track record\n- Technical capability\n- Domain expertise\n- Previous exits\n\n### 2. Market (25%)\n- TAM/SAM/SOM\n- Growth rate\n- Timing\n- Regulatory risk\n\n### 3. Product (20%)\n- Differentiation\n- Defensibility\n- Technical risk\n- PMF signals\n\n### 4. Traction (15%)\n- Revenue/growth\n- Unit economics\n- Key metrics\n\n### 5. Competition (10%)\n- Landscape\n- Positioning\n- Moats\n\n### 6. Deal/Risk (5%)\n- Valuation\n- Terms\n- Red flags\n\n## Scoring\n- 5 = Exceptional (top 5%)\n- 4 = Strong (top 20%)\n- 3 = Average\n- 2 = Weak\n- 1 = Major red flags\n\n## Recommendation Scale\n- 4.5-5.0: Strong Invest\n- 4.0-4.4: Invest\n- 3.5-3.9: Invest with Reservations\n- 3.0-3.4: Watch\n- <3.0: Pass', '00000000-0000-0000-0000-000000000001', 100),
  
  ('term-sheet-red-flags', 'Term Sheet Red Flags', 'negotiation', 'Critical red flags to watch for in term sheets. Based on 100+ negotiations.', E'# Term Sheet Red Flags\n\n## Control Issues\n- Super pro-rata rights (investor can buy unlimited future rounds)\n- Board control with minority ownership\n- Veto rights on day-to-day operations\n\n## Economic Issues\n- Participating preferred (double dipping)\n- >1x liquidation preference\n- Full ratchet anti-dilution\n\n## Founder Issues\n- Non-competes that prevent any future work\n- IP assignment that''s too broad\n- Vesting that starts on closing (not company formation)\n\n## Other Red Flags\n- No shop / excessive exclusivity\n- Expensive legal fees charged to company\n- Uncapped notes in early rounds\n\n## Good Terms\n- 1x non-participating preferred\n- Standard weighted average anti-dilution\n- Founder vesting (4yr/1yr cliff)\n- Pro-rata rights (not super)', '00000000-0000-0000-0000-000000000001', 95),
  
  ('market-sizing-101', 'Market Sizing 101', 'strategy', 'How to calculate TAM/SAM/SOM for any market.', E'# Market Sizing Framework\n\n## TAM (Total Addressable Market)\nEveryone who could buy your product\n\nCalculation methods:\n- Top-down: Industry reports, analyst estimates\n- Bottom-up: Price × Total customers\n- Value theory: Economic value created\n\n## SAM (Serviceable Addressable Market)\nSubset you can reach with your business model\n\nFilters:\n- Geography (where you operate)\n- Segment (who you target)\n- Price point (what they can afford)\n\n## SOM (Serviceable Obtainable Market)\nRealistic capture in first 3-5 years\n\nCalculation:\nSOM = SAM × Market penetration %\n\n## Reality Check\n- TAM > $1B (VC investable)\n- SAM shows path to $100M+ revenue\n- SOM shows path to $10M+ in 5 years', '00000000-0000-0000-0000-000000000001', 88),
  
  ('founder-vesting-calc', 'Founder Vesting Calculator', 'finance', 'Standard vesting schedules and equity calculations.', E'# Founder Vesting Framework\n\n## Standard Terms\n- 4-year vesting\n- 1-year cliff\n- Monthly thereafter\n- Single trigger acceleration (change of control)\n- Double trigger (optional)\n\n## Co-Founder Equity Split\n\n### Equal Split (50/50 or 33/33/33)\nWhen: Similar contribution, similar risk\n\n### Unequal Split\nConsider:\n- Who had the idea?\n- Who quit their job first?\n- Who brings capital?\n- Who has relevant experience?\n\n## Common Mistakes\n- 50/50 with 2 founders (deadlock risk)\n- No vesting (if someone leaves, they keep everything)\n- Acceleration on termination (wrong incentive)\n- Too complex (keep it simple)\n\n## Legal Note\nVesting should start at company formation, not funding', '00000000-0000-0000-0000-000000000001', 82),
  
  ('board-meeting-prep', 'Board Meeting Best Practices', 'governance', 'How to run effective board meetings.', E'# Board Meeting Framework\n\n## Pre-Meeting (1 week before)\n- Send deck 48+ hours in advance\n- Clear agenda (max 5 topics)\n- Pre-brief critical board members\n\n## Deck Structure\n1. Highlights/lowlights (2 slides)\n2. Metrics dashboard (3 slides)\n3. Deep dive on 1-2 topics (5 slides)\n4. Forward-looking decisions (3 slides)\n5. Administrative (1 slide)\n\n## During Meeting\n- Start on time\n- 3-hour max\n- Pre-read means less presenting\n- Focus on discussion, not reporting\n- End with clear action items\n\n## Red Flags\n- Surprises in the meeting (should pre-brief)\n- No metrics\n- Purely retrospective (no forward-looking)\n- Management vs board dynamic (should be collaborative)\n\n## Frequency\n- Early stage: Monthly (2 hours)\n- Growth: Quarterly (3 hours)\n- Public: Quarterly (full day)', '00000000-0000-0000-0000-000000000001', 76);

-- Update category counts
UPDATE categories SET skill_count = 2 WHERE slug = 'finance';
UPDATE categories SET skill_count = 1 WHERE slug = 'negotiation';
UPDATE categories SET skill_count = 1 WHERE slug = 'strategy';
UPDATE categories SET skill_count = 1 WHERE slug = 'governance';
