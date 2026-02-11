import { storeMemory } from '../../../lib/memory-simple';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.MEMORY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { agent_id, content, content_type, metadata } = req.body;

    if (!agent_id || !content || !content_type) {
      return res.status(400).json({
        error: 'Missing required fields: agent_id, content, content_type'
      });
    }

    const result = await storeMemory(agent_id, content, content_type, metadata);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
