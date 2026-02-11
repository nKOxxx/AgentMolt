import { queryMemories } from '../../../lib/memory-simple.js';
import { validateApiKey, setTenantContext, logAudit } from '../../../lib/auth.js';
import redis from '../../../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  const rateLimit = await redis.checkRedisRateLimit(auth.orgId, auth.rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  await setTenantContext(auth.orgId);

  try {
    const { agent_id, q, limit = 5 } = req.query;

    if (!agent_id || !q) {
      return res.status(400).json({ error: 'Missing agent_id or q parameter' });
    }

    // Check cache first
    const cacheKey = `query:${auth.orgId}:${agent_id}:${Buffer.from(q).toString('base64')}`;
    const cached = await redis.getCache(cacheKey);
    
    if (cached) {
      const parsed = JSON.parse(cached);
      const responseTime = Date.now() - startTime;
      
      res.setHeader('X-RateLimit-Limit', auth.rateLimit);
      res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
      res.setHeader('X-Response-Time', `${responseTime}ms`);
      res.setHeader('X-Cache-Status', 'HIT');
      
      await logAudit({
        orgId: auth.orgId,
        agentId: agent_id,
        action: 'QUERY',
        resourceType: 'memory',
        success: true,
        metadata: { 
          resultsCount: parsed.results?.length || 0,
          queryLength: q.length,
          cached: true
        }
      });

      return res.status(200).json({
        success: true,
        query: q,
        results: parsed.results,
        total: parsed.results?.length || 0,
        responseTimeMs: responseTime,
        cached: true,
        rateLimit: {
          limit: auth.rateLimit,
          remaining: rateLimit.remaining
        }
      });
    }

    // Cache miss - query database
    const result = await queryMemories(agent_id, q, parseInt(limit));
    const responseTime = Date.now() - startTime;

    // Cache the result
    await redis.setCache(cacheKey, result, 300); // 5 minute TTL

    await logAudit({
      orgId: auth.orgId,
      agentId: agent_id,
      action: 'QUERY',
      resourceType: 'memory',
      success: result.success,
      metadata: { 
        resultsCount: result.results?.length || 0,
        queryLength: q.length,
        cached: false
      }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.setHeader('X-RateLimit-Limit', auth.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Cache-Status', 'MISS');

    return res.status(200).json({
      success: true,
      query: q,
      results: result.results,
      total: result.results?.length || 0,
      responseTimeMs: responseTime,
      cached: false,
      rateLimit: {
        limit: auth.rateLimit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
