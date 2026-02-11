import { getTimeline } from '../../../lib/memory';

/**
 * GET /api/memory/timeline?agent_id=xxx&days=7
 * Get chronological timeline of memories
 */
export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API Key authentication
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.MEMORY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      agent_id, 
      days = 7,
      project,
      content_type 
    } = req.query;

    // Validation
    if (!agent_id) {
      return res.status(400).json({ error: 'Missing required field: agent_id' });
    }

    // Get timeline
    const result = await getTimeline(agent_id, {
      days: parseInt(days),
      project,
      content_type
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in timeline endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
