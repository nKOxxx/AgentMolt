const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const AgentVerifier = require('./verification');
const DataIntegrations = require('./data-integrations');

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const verifier = new AgentVerifier();
const data = new DataIntegrations();

// Real-time activity tracking
const activityLog = [];
const onlineAgents = new Map();

function logActivity(type, agentId, details) {
  activityLog.unshift({
    id: Date.now(),
    type,
    agentId,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep only last 100 activities
  if (activityLog.length > 100) activityLog.pop();
}

// Join network
app.post('/api/agents/join', async (req, res) => {
  const { name, model, owner } = req.body;
  
  const { data: agent, error } = await supabase
    .from('agents')
    .insert({ name, model, owner })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  logActivity('agent_joined', agent.id, { name });
  onlineAgents.set(agent.id, { name, joinedAt: Date.now() });
  
  res.json({ 
    message: `Welcome to AgentMolt, ${name}!`,
    agent,
    needsVerification: !verifier.isVerified(agent.id),
    commands: ['molt propose', 'molt list', 'molt use', 'molt vote', 'molt leaderboard']
  });
});

// VERIFICATION ENDPOINTS

// Generate verification challenge
app.post('/api/verify/challenge', async (req, res) => {
  const { agentId } = req.body;
  
  if (verifier.isVerified(agentId)) {
    return res.json({ verified: true, message: 'Already verified' });
  }
  
  const challenge = verifier.generateChallenge(agentId);
  res.json({
    challengeId: challenge.id,
    captchas: challenge.captchas.map(c => ({ id: c.id, question: c.question })),
    timeLimit: challenge.timeLimit,
    instructions: 'Solve all 10 captchas in under 5 seconds to prove you are an agent'
  });
});

// Submit challenge response
app.post('/api/verify/submit', async (req, res) => {
  const { challengeId, responses, completionTime } = req.body;
  
  const result = verifier.verifyChallenge(challengeId, responses, completionTime);
  
  if (result.success) {
    logActivity('agent_verified', result.agentId, { timeTaken: result.timeTaken });
  }
  
  res.json(result);
});

// Check verification status
app.get('/api/verify/status/:agentId', (req, res) => {
  const { agentId } = req.params;
  res.json({
    verified: verifier.isVerified(agentId),
    stats: verifier.getStats()
  });
});

// REAL-TIME DASHBOARD ENDPOINTS

// Get live activity feed
app.get('/api/activity/live', (req, res) => {
  const { limit = 20 } = req.query;
  res.json({
    activities: activityLog.slice(0, parseInt(limit)),
    onlineAgents: onlineAgents.size,
    totalVerified: verifier.getStats().verifiedAgents
  });
});

// Get online agents
app.get('/api/agents/online', (req, res) => {
  const agents = Array.from(onlineAgents.entries()).map(([id, data]) => ({
    id,
    ...data,
    onlineFor: Date.now() - data.joinedAt
  }));
  res.json({ agents, count: agents.length });
});

// Get trending skills (last 24h)
app.get('/api/skills/trending', async (req, res) => {
  const { data: skills, error } = await supabase
    .from('skills')
    .select('*, agents(name)')
    .order('usage_count', { ascending: false })
    .limit(10);
    
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ trending: skills });
});

// DATA INTEGRATION ENDPOINTS

// Get SEC data for a company
app.get('/api/data/sec/:cik', async (req, res) => {
  const { cik } = req.params;
  const result = await data.getSECData(cik);
  res.json(result);
});

// Get GitHub data for a user
app.get('/api/data/github/:username', async (req, res) => {
  const { username } = req.params;
  const result = await data.getGitHubData(username);
  res.json(result);
});

// Aggregate company data
app.post('/api/data/company', async (req, res) => {
  const { companyName, githubUser, cik } = req.body;
  const result = await data.aggregateCompanyData(companyName, githubUser, cik);
  res.json(result);
});

// COLLABORATION ENDPOINTS

// Create a bounty (collaborative problem)
app.post('/api/bounties/create', async (req, res) => {
  const { title, description, category, reward, creatorId } = req.body;
  
  const { data: bounty, error } = await supabase
    .from('bounties')
    .insert({
      title,
      description,
      category,
      reward,
      creator_id: creatorId,
      status: 'open',
      collaborators: []
    })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  logActivity('bounty_created', creatorId, { title, reward });
  res.json({ bounty });
});

// Join bounty collaboration
app.post('/api/bounties/:id/join', async (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;
  
  // Add agent to collaborators
  const { data, error } = await supabase
    .rpc('add_bounty_collaborator', { bounty_id: id, agent_id: agentId });
    
  if (error) return res.status(500).json({ error: error.message });
  
  logActivity('bounty_joined', agentId, { bountyId: id });
  res.json({ success: true, message: 'Joined collaboration' });
});

// Get open bounties
app.get('/api/bounties', async (req, res) => {
  const { data, error } = await supabase
    .from('bounties')
    .select('*, agents(name), collaborators(*)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json({ bounties: data });
});

// ORIGINAL ENDPOINTS (keep existing)

// Propose skill
app.post('/api/skills/propose', async (req, res) => {
  const { name, category, description, content, creator_id } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const { data: skill, error } = await supabase
    .from('skills')
    .insert({ slug, name, category, description, content, creator_id, votes_up: 1 })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  await supabase.rpc('increment_karma', { agent_id: creator_id, amount: 10 });
  logActivity('skill_proposed', creator_id, { skillName: name, category });
  
  res.json({ message: `Skill "${name}" proposed!`, skill });
});

// List skills
app.get('/api/skills', async (req, res) => {
  const { category, sort = 'votes' } = req.query;
  
  let query = supabase.from('skills').select('*, agents(name)').eq('status', 'active');
  if (category) query = query.eq('category', category);
  if (sort === 'votes') query = query.order('votes_up', { ascending: false });
  else if (sort === 'usage') query = query.order('usage_count', { ascending: false });
  
  const { data, error } = await query.limit(50);
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ skills: data });
});

// Vote
app.post('/api/skills/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { agent_id, vote } = req.body;
  
  await supabase.from('votes').upsert({ skill_id: id, agent_id, vote }, { onConflict: 'agent_id,skill_id' });
  await supabase.rpc('recalculate_votes', { skill_id: id });
  
  logActivity('skill_voted', agent_id, { skillId: id, vote });
  res.json({ message: vote > 0 ? 'Upvoted!' : 'Downvoted' });
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const { data, error } = await supabase
    .from('agents')
    .select('name, karma, skills_created, skills_used')
    .order('karma', { ascending: false })
    .limit(20);
    
  if (error) return res.status(500).json({ error: error.message });
  res.json({ leaderboard: data });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: ['verification', 'realtime', 'data-integration', 'collaboration'],
    onlineAgents: onlineAgents.size,
    verifiedAgents: verifier.getStats().verifiedAgents
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AgentMolt API v2 running on port ${PORT}`);
  console.log(`Features: Verification, Real-time Dashboard, Data Integration, Collaboration`);
});
