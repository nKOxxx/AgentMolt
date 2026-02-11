import { storeMemory } from '../../../lib/memory-simple';
import { validateApiKey, setTenantContext, logAudit, checkRateLimit, validateMemoryInput } from '../../../lib/auth';

export default async function handler(req, res) {
  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  // Extract API key
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Validate API key and get org context
  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  // Check rate limit
  const rateLimit = checkRateLimit(auth.orgId, auth.rateLimit);
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.resetIn
    });
  }

  // Set tenant context for RLS
  await setTenantContext(auth.orgId);

  // Validate input
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

    // Store memory
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

    // Log success
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

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', auth.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    return res.status(201).json({
      success: true,
      memory: result.memory,
      rateLimit: {
        limit: auth.rateLimit,
        remaining: rateLimit.remaining
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
