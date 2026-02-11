import { storeMemory } from '../../../lib/memory-simple.js';
import { validateApiKey, setTenantContext, logAudit, validateMemoryInput } from '../../../lib/auth.js';
import redis from '../../../lib/redis.js';
import jobs from '../../../lib/jobs.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

  // Check Redis rate limit first (fast)
  const rateLimit = await redis.checkRedisRateLimit(auth.orgId, auth.rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    });
  }

  await setTenantContext(auth.orgId);

  const validation = validateMemoryInput(req.body);
  if (!validation.valid) {
    await logAudit({
      orgId: auth.orgId,
      action: 'CREATE',
      resourceType: 'memory',
      success: false,
      metadata: { errors: validation.errors }
    });
    return res.status(400).json({ error: 'Validation failed', details: validation.errors });
  }

  try {
    const { agent_id, content, content_type, metadata } = req.body;

    const result = await storeMemory(agent_id, content, content_type, metadata);

    const responseTime = Date.now() - startTime;

    if (!result.success) {
      await logAudit({
        orgId: auth.orgId,
        agentId: agent_id,
        action: 'CREATE',
        resourceType: 'memory',
        success: false,
        newValues: { content: content.substring(0, 100) },
        metadata: { error: result.error }
      });
      return res.status(500).json({ error: result.error });
    }

    // Schedule background NLP job (async)
    await jobs.scheduleNLPExtraction(result.memory.id, content);

    // Invalidate query cache for this agent (cache invalidation)
    await redis.invalidateCache(`query:${auth.orgId}:${agent_id}:*`);

    await logAudit({
      orgId: auth.orgId,
      agentId: agent_id,
      action: 'CREATE',
      resourceType: 'memory',
      resourceId: result.memory.id,
      newValues: { 
        content_type, 
        importance: result.memory.metadata?.importance 
      },
      success: true
    });

    res.setHeader('X-RateLimit-Limit', auth.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Cache-Status', 'MISS');

    return res.status(201).json({
      success: true,
      memory: result.memory,
      jobQueued: true,
      rateLimit: {
        limit: auth.rateLimit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt
      }
    });
  } catch (error) {
    console.error('Error:', error);
    await logAudit({
      orgId: auth.orgId,
      action: 'CREATE',
      resourceType: 'memory',
      success: false,
      metadata: { error: error.message }
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
