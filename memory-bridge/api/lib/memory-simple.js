import { createClient } from '@supabase/supabase-js';
import nlp from 'compromise';

// Free tier: Single client, no connection pooling needed
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// KEYWORD EXTRACTION (Synchronous, no queue)
// ============================================

export function extractKeywords(content) {
  try {
    const doc = nlp(content);
    const nouns = doc.nouns().out('array');
    const topics = doc.topics().out('array');
    
    return [...new Set([...nouns, ...topics])]
      .map(k => k.toLowerCase().trim())
      .filter(k => k.length > 3)
      .filter(k => !isStopWord(k))
      .slice(0, 10); // Limit to save space
  } catch (error) {
    return basicExtract(content);
  }
}

function basicExtract(content) {
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'were']);
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .filter((w, i, self) => self.indexOf(w) === i)
    .slice(0, 10);
}

function isStopWord(word) {
  const stops = new Set(['this', 'that', 'with', 'from', 'have', 'been']);
  return stops.has(word.toLowerCase());
}

// ============================================
// SIMPLE IMPORTANCE (Fast heuristic)
// ============================================

export function calculateImportance(content, type) {
  let score = 5;
  if (content.length > 200) score += 1;
  if (type === 'insight') score += 2;
  if (type === 'error') score += 1;
  return Math.min(10, score);
}

// ============================================
// CORE OPERATIONS (No async queue)
// ============================================

export async function storeMemory(agentId, content, contentType, metadata = {}) {
  try {
    const keywords = extractKeywords(content);
    const importance = calculateImportance(content, contentType);
    
    const { data, error } = await supabase
      .from('memories')
      .insert({
        agent_id: agentId,
        content: content.slice(0, 5000), // Limit size (free tier)
        content_type: contentType,
        metadata: {
          keywords,
          people: metadata.people || [],
          projects: metadata.projects || [],
          importance,
          source: metadata.source || 'unknown'
        }
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, memory: data };
  } catch (error) {
    console.error('Store error:', error);
    return { success: false, error: error.message };
  }
}

export async function queryMemories(agentId, query, limit = 5) {
  try {
    const queryKeywords = extractKeywords(query);
    
    // Simple keyword search (no embeddings, no Pinecone)
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50); // Get more for client-side ranking
    
    if (error) throw error;
    
    // Client-side keyword matching (simple relevance)
    const results = (data || [])
      .map(m => {
        const memKeywords = m.metadata?.keywords || [];
        const matches = queryKeywords.filter(qk => 
          memKeywords.some(mk => mk.includes(qk) || qk.includes(mk))
        ).length;
        return { ...m, relevance: matches / queryKeywords.length };
      })
      .filter(m => m.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
    
    return { success: true, query, results };
  } catch (error) {
    console.error('Query error:', error);
    return { success: false, error: error.message };
  }
}

export async function getTimeline(agentId, days = 7) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Group by date
    const grouped = (data || []).reduce((acc, m) => {
      const date = m.created_at.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(m);
      return acc;
    }, {});
    
    return { success: true, timeline: grouped };
  } catch (error) {
    console.error('Timeline error:', error);
    return { success: false, error: error.message };
  }
}

export default { storeMemory, queryMemories, getTimeline, extractKeywords };
