import { queryMemories } from '../../../lib/memory-simple';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.MEMORY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { agent_id, q, limit = 5 } = req.query;

    if (!agent_id || !q) {
      return res.status(400).json({ error: 'Missing agent_id or q' });
    }

    const result = await queryMemories(agent_id, q, parseInt(limit));

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
