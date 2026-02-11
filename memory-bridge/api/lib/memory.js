import { createClient } from '@supabase/supabase-js';
import nlp from 'compromise';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ============================================
// KEYWORD EXTRACTION
// ============================================

/**
 * Extract keywords from content using compromise.js
 * Falls back to basic extraction if NLP fails
 */
export function extractKeywords(content) {
  try {
    const doc = nlp(content);
    
    // Get nouns (most relevant for memory)
    const nouns = doc.nouns().out('array');
    
    // Get verbs (actions)
    const verbs = doc.verbs().out('array');
    
    // Get topics (multi-word phrases)
    const topics = doc.topics().out('array');
    
    // Combine and deduplicate
    const keywords = [...new Set([...nouns, ...verbs, ...topics])]
      .map(k => k.toLowerCase().trim())
      .filter(k => k.length > 3)
      .filter(k => !isStopWord(k))
      .slice(0, 15);
    
    return keywords;
  } catch (error) {
    // Fallback to basic extraction
    return basicKeywordExtract(content);
  }
}

/**
 * Basic keyword extraction (fallback)
 */
function basicKeywordExtract(content) {
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their',
    'what', 'when', 'where', 'which', 'while', 'about', 'would', 'could', 'should',
    'will', 'there', 'here', 'then', 'than', 'them', 'these', 'those', 'very',
    'just', 'also', 'back', 'after', 'use', 'two', 'way', 'who', 'oil', 'sit',
    'set', 'run', 'eat', 'far', 'sea', 'eye', 'ask', 'own', 'say', 'too', 'old'
  ]);
  
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !stopWords.has(word))
    .filter((word, index, self) => self.indexOf(word) === index)
    .slice(0, 15);
}

function isStopWord(word) {
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their',
    'what', 'when', 'where', 'which', 'while', 'about', 'would', 'could', 'should'
  ]);
  return stopWords.has(word.toLowerCase());
}

// ============================================
// IMPORTANCE SCORING
// ============================================

/**
 * Calculate importance score (1-10) for a memory
 */
export function calculateImportance(content, metadata = {}) {
  let score = 5; // baseline
  
  // Length factor (longer = potentially more important)
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 100) score += 1;
  if (wordCount > 200) score += 1;
  
  // Keyword density (more unique keywords = more substantive)
  const keywords = extractKeywords(content);
  if (keywords.length > 10) score += 1;
  
  // Content type weighting
  const typeWeights = {
    'insight': 2,
    'action': 1,
    'conversation': 0,
    'error': 1
  };
  score += typeWeights[metadata.content_type] || 0;
  
  // People mentioned (social = important)
  if (metadata.people && metadata.people.length > 0) {
    score += 1;
  }
  
  // Projects mentioned (contextual relevance)
  if (metadata.projects && metadata.projects.length > 0) {
    score += 1;
  }
  
  // Cap at 10
  return Math.min(10, Math.max(1, score));
}

// ============================================
// MEMORY OPERATIONS
// ============================================

/**
 * Store a new memory
 */
export async function storeMemory(agentId, content, contentType, metadata = {}) {
  try {
    // Extract keywords
    const keywords = metadata.keywords || extractKeywords(content);
    
    // Calculate importance
    const importance = metadata.importance || calculateImportance(content, { 
      content_type: contentType,
      ...metadata 
    });
    
    // Build metadata object
    const memoryMetadata = {
      keywords,
      people: metadata.people || [],
      projects: metadata.projects || [],
      importance,
      source: metadata.source || 'unknown'
    };
    
    // Insert into database
    const { data, error } = await supabase
      .from('memories')
      .insert({
        agent_id: agentId,
        content,
        content_type: contentType,
        metadata: memoryMetadata
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      memory: data,
      keywords_extracted: keywords,
      importance_score: importance
    };
  } catch (error) {
    console.error('Error storing memory:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Query memories by keywords
 */
export async function queryMemories(agentId, query, options = {}) {
  const startTime = Date.now();
  
  try {
    const limit = options.limit || 5;
    const days = options.days || 30;
    
    // Extract keywords from query
    const queryKeywords = extractKeywords(query);
    
    // Build query
    let dbQuery = supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null);
    
    // Time filter
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      dbQuery = dbQuery.gte('created_at', cutoffDate.toISOString());
    }
    
    // Content type filter
    if (options.content_type) {
      dbQuery = dbQuery.eq('content_type', options.content_type);
    }
    
    // Project filter
    if (options.project) {
      dbQuery = dbQuery.contains('metadata->projects', [options.project]);
    }
    
    // Execute query
    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Get more for ranking
    
    if (error) throw error;
    
    // Rank results by relevance
    const rankedResults = rankResults(data || [], queryKeywords, query);
    
    // Take top N
    const results = rankedResults.slice(0, limit);
    
    // Update retrieval counts
    for (const result of results) {
      await incrementRetrievalCount(result.id);
    }
    
    // Log query
    await logQuery(agentId, query, queryKeywords, results.length, Date.now() - startTime);
    
    return {
      success: true,
      query,
      query_keywords: queryKeywords,
      results,
      total_count: data?.length || 0,
      response_time_ms: Date.now() - startTime
    };
  } catch (error) {
    console.error('Error querying memories:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rank results by relevance to query
 */
function rankResults(memories, queryKeywords, originalQuery) {
  return memories.map(memory => {
    const memoryKeywords = memory.metadata?.keywords || [];
    
    // Calculate keyword overlap
    const matchingKeywords = queryKeywords.filter(kw => 
      memoryKeywords.some(mk => mk.includes(kw) || kw.includes(mk))
    );
    
    const keywordScore = matchingKeywords.length / Math.max(queryKeywords.length, 1);
    
    // Importance score (normalized)
    const importanceScore = (memory.metadata?.importance || 5) / 10;
    
    // Recency score (exponential decay)
    const ageInDays = (Date.now() - new Date(memory.created_at)) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-ageInDays / 30); // 30-day half-life
    
    // Retrieval count (popularity)
    const retrievalScore = Math.min(memory.retrieval_count / 10, 1);
    
    // Combined score
    const relevanceScore = (
      keywordScore * 0.4 +
      importanceScore * 0.3 +
      recencyScore * 0.2 +
      retrievalScore * 0.1
    );
    
    return {
      ...memory,
      relevance_score: Math.round(relevanceScore * 100) / 100,
      matching_keywords: matchingKeywords
    };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}

/**
 * Get timeline of memories
 */
export async function getTimeline(agentId, options = {}) {
  try {
    const days = options.days || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let query = supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .gte('created_at', cutoffDate.toISOString());
    
    if (options.project) {
      query = query.contains('metadata->projects', [options.project]);
    }
    
    if (options.content_type) {
      query = query.eq('content_type', options.content_type);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Group by date
    const grouped = (data || []).reduce((acc, memory) => {
      const date = new Date(memory.created_at).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(memory);
      return acc;
    }, {});
    
    return {
      success: true,
      timeline: grouped,
      total_count: data?.length || 0
    };
  } catch (error) {
    console.error('Error getting timeline:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Increment retrieval count
 */
async function incrementRetrievalCount(memoryId) {
  try {
    await supabase.rpc('increment_memory_retrieval', { memory_id: memoryId });
  } catch (error) {
    // Silent fail - not critical
    console.warn('Failed to increment retrieval count:', error);
  }
}

/**
 * Log query for analytics
 */
async function logQuery(agentId, query, keywords, resultsCount, responseTime) {
  try {
    await supabase
      .from('memory_queries')
      .insert({
        agent_id: agentId,
        query,
        query_keywords: keywords,
        results_count: resultsCount,
        response_time_ms: responseTime
      });
  } catch (error) {
    // Silent fail - analytics not critical
    console.warn('Failed to log query:', error);
  }
}

// ============================================
// EXPORT
// ============================================

export default {
  storeMemory,
  queryMemories,
  getTimeline,
  extractKeywords,
  calculateImportance
};
