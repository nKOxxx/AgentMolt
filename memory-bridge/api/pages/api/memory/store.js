import { storeMemory } from '../../../lib/memory';

/**
 * POST /api/memory/store
 * Store a new memory
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // API Key authentication
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.MEMORY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { agent_id, content, content_type, metadata } = req.body;

    // Validation
    if (!agent_id || !content || !content_type) {
      return res.status(400).json({
        error: 'Missing required fields: agent_id, content, content_type'
      });
    }

    if (!['conversation', 'action', 'insight', 'error'].includes(content_type)) {
      return res.status(400).json({
        error: 'Invalid content_type. Must be: conversation, action, insight, error'
      });
    }

    // Store memory
    const result = await storeMemory(agent_id, content, content_type, metadata);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error in store endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
