import { queryMemories } from '../../../lib/memory';

/**
 * GET /api/memory/query?q=search+terms&limit=5&days=30
 * Query memories by keywords
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
      q, 
      limit = 5, 
      days = 30,
      content_type,
      project 
    } = req.query;

    // Validation
    if (!agent_id) {
      return res.status(400).json({ error: 'Missing required field: agent_id' });
    }

    if (!q) {
      return res.status(400).json({ error: 'Missing required field: q (query)' });
    }

    // Query memories
    const result = await queryMemories(agent_id, q, {
      limit: parseInt(limit),
      days: parseInt(days),
      content_type,
      project
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in query endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
