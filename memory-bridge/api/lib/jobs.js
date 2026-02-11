import redis from './redis.js';

// ============================================
// BACKGROUND JOB PROCESSOR
// Handles: NLP, embeddings, exports, webhooks
// ============================================

const PROCESSORS = {
  // NLP keyword extraction
  'nlp:extract': async (data) => {
    const { memoryId, content } = data;
    
    // Import NLP library dynamically
    const nlp = (await import('compromise')).default;
    
    try {
      const doc = nlp(content);
      const keywords = [
        ...doc.nouns().out('array'),
        ...doc.topics().out('array')
      ].map(k => k.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
      
      return { success: true, keywords, memoryId };
    } catch (error) {
      // Fallback to basic extraction
      const words = content.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter((w, i, self) => self.indexOf(w) === i)
        .slice(0, 10);
      
      return { success: true, keywords: words, memoryId, fallback: true };
    }
  },
  
  // Generate embeddings (Phase 3 - placeholder)
  'embedding:generate': async (data) => {
    const { memoryId, content } = data;
    
    // Placeholder - will use OpenAI in Phase 3
    console.log(`[Job] Would generate embedding for memory ${memoryId}`);
    
    return { 
      success: true, 
      memoryId, 
      status: 'deferred_to_phase3',
      note: 'Semantic search coming in Week 3'
    };
  },
  
  // Export memories
  'export:memories': async (data) => {
    const { orgId, agentId, format } = data;
    
    // Query database for all memories
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*')
      .eq('org_id', orgId)
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    let output;
    if (format === 'json') {
      output = JSON.stringify(memories, null, 2);
    } else if (format === 'csv') {
      // Simple CSV conversion
      const headers = ['id', 'content', 'content_type', 'created_at'];
      const rows = memories.map(m => 
        headers.map(h => JSON.stringify(m[h] || '')).join(',')
      );
      output = [headers.join(','), ...rows].join('\n');
    }
    
    return { 
      success: true, 
      format,
      count: memories.length,
      data: output,
      size: output.length
    };
  },
  
  // Cleanup old data
  'cleanup:expired': async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Clean up old audit logs (>90 days)
    const { data: auditCount } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .select('count');
    
    // Clean up old rate limit windows
    const { data: rateLimitCount } = await supabase.rpc('cleanup_rate_limit_windows');
    
    // Clean up expired cache
    const { data: cacheCount } = await supabase.rpc('cleanup_expired_cache');
    
    return {
      success: true,
      deleted: {
        audit_logs: auditCount?.length || 0,
        rate_limit_windows: rateLimitCount || 0,
        cache_entries: cacheCount || 0
      }
    };
  },
  
  // Webhook delivery (Phase 3)
  'webhook:deliver': async (data) => {
    const { url, payload } = data;
    
    // Placeholder for webhook delivery
    console.log(`[Job] Would deliver webhook to ${url}`);
    
    return {
      success: true,
      delivered: false,
      status: 'deferred_to_phase3',
      url
    };
  }
};

// ============================================
// JOB PROCESSOR MAIN LOOP
// ============================================

export async function processJob(job) {
  const { queue, data, attempts, maxAttempts } = job;
  
  const processor = PROCESSORS[queue];
  if (!processor) {
    throw new Error(`Unknown job queue: ${queue}`);
  }
  
  try {
    console.log(`[Job] Processing ${queue} (attempt ${attempts + 1}/${maxAttempts})`);
    const result = await processor(data);
    
    await redis.completeJob(queue, job.id, result);
    console.log(`[Job] Completed ${queue}:`, result.success ? 'success' : 'failed');
    
    return result;
  } catch (error) {
    console.error(`[Job] Failed ${queue}:`, error.message);
    
    if (attempts + 1 >= maxAttempts) {
      await redis.failJob(queue, job.id, error);
      throw error;
    }
    
    // Retry with exponential backoff
    const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s
    await redis.addJob(queue, data, { 
      attempts: maxAttempts,
      delay 
    });
    
    throw error;
  }
}

// ============================================
// JOB WORKER (Run this in background)
// ============================================

export async function startWorker(queueName, options = {}) {
  const { concurrency = 1, pollInterval = 1000 } = options;
  
  console.log(`[Worker] Starting ${queueName} worker (concurrency: ${concurrency})`);
  
  let running = true;
  
  const processNext = async () => {
    if (!running) return;
    
    try {
      const job = await redis.getNextJob(queueName);
      
      if (job) {
        await processJob(job);
      }
    } catch (error) {
      console.error('[Worker] Error:', error.message);
    }
    
    // Continue polling
    setTimeout(processNext, pollInterval);
  };
  
  // Start workers
  for (let i = 0; i < concurrency; i++) {
    processNext();
  }
  
  return {
    stop: () => { running = false; },
    status: () => ({ running, queue: queueName })
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function scheduleNLPExtraction(memoryId, content) {
  return redis.addJob('nlp:extract', { memoryId, content });
}

export async function scheduleEmbedding(memoryId, content) {
  return redis.addJob('embedding:generate', { memoryId, content });
}

export async function scheduleExport(orgId, agentId, format = 'json') {
  return redis.addJob('export:memories', { orgId, agentId, format });
}

export async function scheduleCleanup() {
  return redis.addJob('cleanup:expired', {});
}

export async function scheduleWebhook(url, payload) {
  return redis.addJob('webhook:deliver', { url, payload });
}

export default {
  processJob,
  startWorker,
  scheduleNLPExtraction,
  scheduleEmbedding,
  scheduleExport,
  scheduleCleanup,
  scheduleWebhook,
  PROCESSORS
};
