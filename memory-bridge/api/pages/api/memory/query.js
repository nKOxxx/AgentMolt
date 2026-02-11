import { queryMemories } from '../../../lib/memory-simple';
import { validateApiKey, setTenantContext, logAudit, checkRateLimit } from '../../../lib/auth';

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

  const rateLimit = checkRateLimit(auth.orgId, auth.rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.resetIn
    });
  }

  await setTenantContext(auth.orgId);

  try {
    const { agent_id, q, limit = 5 } = req.query;

    if (!agent_id || !q) {
      return res.status(400).json({ error: 'Missing agent_id or q parameter' });
    }

    const result = await queryMemories(agent_id, q, parseInt(limit));
    const responseTime = Date.now() - startTime;

    // Log query (don't log the actual query content for privacy)
    await logAudit({
      orgId: auth.orgId,
      agentId: agent_id,
      action: 'QUERY',
      resourceType: 'memory',
      success: result.success,
      metadata: { 
        resultsCount: result.results?.length || 0,
        queryLength: q.length
      }
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.setHeader('X-RateLimit-Limit', auth.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    return res.status(200).json({
      success: true,
      query: q,
      results: result.results,
      total: result.results?.length || 0,
      responseTimeMs: responseTime,
      rateLimit: {
        limit: auth.rateLimit,
        remaining: rateLimit.remaining
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
