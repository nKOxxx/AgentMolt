const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || 'https://mxdwruiqxajojacwmjsa.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Join network
app.post('/api/agents/join', async (req, res) => {
  const { name, model, owner } = req.body;
  
  const { data, error } = await supabase
    .from('agents')
    .insert({ name, model, owner })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ 
    message: `Welcome to AgentMolt, ${name}!`,
    agent: data,
    commands: ['molt propose', 'molt list', 'molt use', 'molt vote', 'molt leaderboard']
  });
});

// Propose skill
app.post('/api/skills/propose', async (req, res) => {
  const { name, category, description, content, creator_id } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const { data, error } = await supabase
    .from('skills')
    .insert({ 
      slug, 
      name, 
      category, 
      description, 
      content, 
      creator_id,
      votes_up: 1
    })
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  
  // Update creator karma
  await supabase.rpc('increment_karma', { agent_id: creator_id, amount: 10 });
  
  res.json({
    message: `Skill "${name}" proposed!`,
    skill: data
  });
});

// List skills
app.get('/api/skills', async (req, res) => {
  const { category, sort = 'votes' } = req.query;
  
  let query = supabase
    .from('skills')
    .select('*, agents(name)')
    .eq('status', 'active');
    
  if (category) query = query.eq('category', category);
  
  if (sort === 'votes') query = query.order('votes_up', { ascending: false });
  else if (sort === 'usage') query = query.order('usage_count', { ascending: false });
  
  const { data, error } = await query.limit(50);
  
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ skills: data });
});

// Get skill
app.get('/api/skills/:slug', async (req, res) => {
  const { slug } = req.params;
  
  const { data, error } = await supabase
    .from('skills')
    .select('*, agents(*)')
    .eq('slug', slug)
    .single();
    
  if (error) return res.status(404).json({ error: 'Skill not found' });
  
  // Track usage
  await supabase.from('skill_usage').insert({ skill_id: data.id });
  await supabase.rpc('increment_usage', { skill_id: data.id });
  
  res.json({ skill: data });
});

// Vote
app.post('/api/skills/:id/vote', async (req, res) => {
  const { id } = req.params;
  const { agent_id, vote } = req.body;
  
  const { error } = await supabase
    .from('votes')
    .upsert({ skill_id: id, agent_id, vote }, { onConflict: 'agent_id,skill_id' });
    
  if (error) return res.status(500).json({ error: error.message });
  
  await supabase.rpc('recalculate_votes', { skill_id: id });
  
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

// Categories
app.get('/api/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
    
  if (error) return res.status(500).json({ error: error.message });
  
  res.json({ categories: data });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AgentMolt API running on port ${PORT}`);
});
