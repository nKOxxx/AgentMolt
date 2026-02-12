import { Redis } from '@upstash/redis';

// ============================================
// WEEK 2: REDIS LAYER (Upstash Free Tier)
// Caching, Sessions, Rate Limiting
// ============================================

// Lazy-load Redis client (only when needed)
let redis = null;
let isRedisEnabled = false;

function getRedis() {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    isRedisEnabled = false;
    return null;
  }
  
  try {
    redis = new Redis({ url, token });
    isRedisEnabled = true;
    return redis;
  } catch (error) {
    console.error('Redis init error:', error.message);
    isRedisEnabled = false;
    return null;
  }
}

// Check if Redis is configured
function checkRedisEnabled() {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

// ============================================
// CACHE OPERATIONS
// ============================================

const CACHE_TTL = {
  QUERY_RESULTS: 300,      // 5 minutes
  AGENT_STATS: 60,         // 1 minute
  RATE_LIMIT: 60,          // 1 minute
  SESSION: 3600,           // 1 hour
  HEALTH: 10               // 10 seconds
};

export async function getCache(key) {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const value = await client.get(key);
    if (value) {
      // Increment hit counter for analytics
      await client.hincrby('cache:stats', 'hits', 1);
    }
    return value;
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 300) {
  const client = getRedis();
  if (!client) return false;
  
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
    await client.hincrby('cache:stats', 'sets', 1);
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
}

export async function deleteCache(key) {
  const client = getRedis();
  if (!client) return false;
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis del error:', error.message);
    return false;
  }
}

export async function invalidateCache(pattern) {
  const client = getRedis();
  if (!client) return 0;
  
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('Redis invalidate error:', error.message);
    return 0;
  }
}

// ============================================
// QUERY RESULT CACHING
// ============================================

export function getQueryCacheKey(orgId, agentId, query) {
  return `query:${orgId}:${agentId}:${Buffer.from(query).toString('base64')}`;
}

export async function getCachedQuery(orgId, agentId, query) {
  const key = getQueryCacheKey(orgId, agentId, query);
  const cached = await getCache(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedQuery(orgId, agentId, query, results) {
  const key = getQueryCacheKey(orgId, agentId, query);
  await setCache(key, results, CACHE_TTL.QUERY_RESULTS);
}

// ============================================
// RATE LIMITING (Redis-backed)
// ============================================

export async function checkRedisRateLimit(orgId, limit = 100) {
  const client = getRedis();
  if (!client) {
    // Fallback to in-memory if Redis not available
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + 60000) };
  }
  
  const key = `ratelimit:${orgId}:${Math.floor(Date.now() / 60000)}`;
  
  try {
    const current = await client.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await client.expire(key, 60);
    }
    
    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);
    const resetAt = new Date(Math.ceil(Date.now() / 60000) * 60000);
    
    return { allowed, remaining, resetAt };
  } catch (error) {
    console.error('Rate limit error:', error.message);
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + 60000) };
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function createSession(orgId, agentId, sessionData) {
  const client = getRedis();
  if (!client) return null;
  
  const sessionId = `sess:${orgId}:${agentId}:${Date.now()}`;
  
  try {
    await client.setex(
      sessionId,
      CACHE_TTL.SESSION,
      JSON.stringify({
        ...sessionData,
        createdAt: Date.now(),
        orgId,
        agentId
      })
    );
    return sessionId;
  } catch (error) {
    console.error('Session create error:', error.message);
    return null;
  }
}

export async function getSession(sessionId) {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const data = await client.get(sessionId);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Session get error:', error.message);
    return null;
  }
}

export async function extendSession(sessionId) {
  const client = getRedis();
  if (!client) return false;
  
  try {
    await client.expire(sessionId, CACHE_TTL.SESSION);
    return true;
  } catch (error) {
    console.error('Session extend error:', error.message);
    return false;
  }
}

// ============================================
// HEALTH & METRICS
// ============================================

export async function getRedisHealth() {
  if (!checkRedisEnabled()) {
    return { connected: false, mode: 'fallback', reason: 'not_configured' };
  }
  
  const client = getRedis();
  if (!client) {
    return { connected: false, mode: 'fallback', reason: 'init_failed' };
  }
  
  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;
    
    const stats = await client.hgetall('cache:stats');
    
    return {
      connected: true,
      latency: `${latency}ms`,
      mode: 'redis',
      stats: {
        hits: parseInt(stats?.hits || 0),
        sets: parseInt(stats?.sets || 0)
      }
    };
  } catch (error) {
    return { connected: false, error: error.message, mode: 'fallback' };
  }
}

// ============================================
// BACKGROUND JOB QUEUE (Redis-backed)
// ============================================

export async function addJob(queueName, jobData, options = {}) {
  const client = getRedis();
  if (!client) {
    // Fallback: process immediately
    console.log('Redis not available, processing job immediately:', jobData);
    return { id: null, immediate: true };
  }
  
  const jobId = `job:${queueName}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  
  const job = {
    id: jobId,
    queue: queueName,
    data: jobData,
    status: 'waiting',
    attempts: 0,
    maxAttempts: options.attempts || 3,
    createdAt: Date.now(),
    delay: options.delay || 0
  };
  
  try {
    if (job.delay > 0) {
      // Delayed job
      await client.zadd(`queue:${queueName}:delayed`, Date.now() + job.delay, JSON.stringify(job));
    } else {
      // Immediate job
      await client.lpush(`queue:${queueName}`, JSON.stringify(job));
    }
    
    return { id: jobId, immediate: false };
  } catch (error) {
    console.error('Add job error:', error.message);
    return { id: null, immediate: true };
  }
}

export async function getNextJob(queueName) {
  const client = getRedis();
  if (!client) return null;
  
  try {
    // Check delayed jobs first
    const delayed = await client.zrangebyscore(`queue:${queueName}:delayed`, 0, Date.now(), 'LIMIT', 0, 1);
    
    if (delayed.length > 0) {
      await client.zrem(`queue:${queueName}:delayed`, delayed[0]);
      return JSON.parse(delayed[0]);
    }
    
    // Get from main queue
    const job = await client.rpop(`queue:${queueName}`);
    return job ? JSON.parse(job) : null;
  } catch (error) {
    console.error('Get job error:', error.message);
    return null;
  }
}

export async function completeJob(queueName, jobId, result) {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.hset(`jobs:completed`, jobId, JSON.stringify({
      result,
      completedAt: Date.now()
    }));
    // Expire after 24 hours
    await client.expire(`jobs:completed`, 86400);
  } catch (error) {
    console.error('Complete job error:', error.message);
  }
}

export async function failJob(queueName, jobId, error) {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.hset(`jobs:failed`, jobId, JSON.stringify({
      error: error.message,
      failedAt: Date.now()
    }));
  } catch (err) {
    console.error('Fail job error:', err.message);
  }
}

export default {
  getCache,
  setCache,
  deleteCache,
  invalidateCache,
  getCachedQuery,
  setCachedQuery,
  checkRedisRateLimit,
  createSession,
  getSession,
  extendSession,
  getRedisHealth,
  addJob,
  getNextJob,
  completeJob,
  failJob,
  isRedisEnabled: checkRedisEnabled
};
