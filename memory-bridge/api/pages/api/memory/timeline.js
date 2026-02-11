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
    // Import here to avoid issues
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { agent_id, days = 7 } = req.query;

    if (!agent_id) {
      return res.status(400).json({ error: 'Missing agent_id parameter' });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('agent_id', agent_id)
      .is('deleted_at', null)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by date
    const grouped = (data || []).reduce((acc, m) => {
      const date = m.created_at.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push({
        id: m.id,
        content: m.content,
        type: m.content_type,
        importance: m.metadata?.importance || 5
      });
      return acc;
    }, {});

    const responseTime = Date.now() - startTime;

    await logAudit({
      orgId: auth.orgId,
      agentId: agent_id,
      action: 'READ',
      resourceType: 'memory',
      success: true,
      metadata: { days: parseInt(days), resultsCount: data?.length || 0 }
    });

    res.setHeader('X-RateLimit-Limit', auth.rateLimit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    return res.status(200).json({
      success: true,
      agentId: agent_id,
      days: parseInt(days),
      timeline: grouped,
      total: data?.length || 0,
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
