/**
 * Memory-Aware Response Helper
 * 
 * Integrates Memory Bridge queries into OpenClaw workflow.
 * Use when user asks "what about X?" or mentions stored topics.
 */

const https = require('https');

const MEMORY_BRIDGE_URL = 'agentmolt-memory.onrender.com';
const MEMORY_API_KEY = process.env.MEMORY_API_KEY || 'mb-free-7x9k2m5p8q1';
const AGENT_ID = process.env.OPENCLAW_AGENT_ID || '4ee927aa-4899-4c07-ba4c-cf1edcc0c348';

async function queryMemories(query, limit = 5) {
  return new Promise((resolve, reject) => {
    const queryString = `agent_id=${AGENT_ID}&q=${encodeURIComponent(query)}&limit=${limit}`;
    
    const options = {
      hostname: MEMORY_BRIDGE_URL,
      port: 443,
      path: `/api/memory/query?${queryString}`,
      method: 'GET',
      headers: { 'X-API-Key': MEMORY_API_KEY }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Smart query detector
 * Checks if message is asking about past context
 */
function isMemoryQuery(message) {
  const patterns = [
    /what about (\w+)/i,
    /what did we (discuss|talk|say) about/i,
    /remind me about/i,
    /what was the/i,
    /do you remember/i,
    /last time we/i,
    /earlier (today|yesterday)/i,
    /previous/i
  ];
  return patterns.some(p => p.test(message));
}

/**
 * Extract query topic from message
 */
function extractQueryTopic(message) {
  // Remove common prefixes
  let cleaned = message
    .replace(/what about/i, '')
    .replace(/what did we (discuss|talk|say) about/i, '')
    .replace(/remind me about/i, '')
    .replace(/what was the/i, '')
    .replace(/do you remember/i, '')
    .replace(/last time we/i, '')
    .replace(/\?/g, '')
    .trim();
  
  return cleaned;
}

/**
 * Main function: Check memories and return context
 */
async function checkMemories(message) {
  if (!isMemoryQuery(message)) {
    return null; // Not a memory query
  }
  
  const topic = extractQueryTopic(message);
  if (!topic || topic.length < 3) {
    return null;
  }
  
  console.log(`🧠 Memory query detected: "${topic}"`);
  
  try {
    const result = await queryMemories(topic, 5);
    
    if (!result.success || !result.results || result.results.length === 0) {
      return { found: false, topic };
    }
    
    return {
      found: true,
      topic,
      count: result.results.length,
      memories: result.results.map(m => ({
        content: m.content,
        date: m.created_at.split('T')[0],
        importance: m.metadata?.importance || 5,
        keywords: m.metadata?.keywords || []
      }))
    };
  } catch (error) {
    console.error('Memory query failed:', error.message);
    return { found: false, topic, error: error.message };
  }
}

/**
 * Format memory context for response
 */
function formatMemoryContext(memoryResult) {
  if (!memoryResult || !memoryResult.found) {
    return null;
  }
  
  let context = `📚 **Memory Context: "${memoryResult.topic}"**\n\n`;
  
  memoryResult.memories.forEach((m, i) => {
    context += `${i + 1}. **${m.date}** (importance: ${m.importance}/10)\n`;
    context += `   ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}\n\n`;
  });
  
  return context;
}

module.exports = {
  checkMemories,
  formatMemoryContext,
  isMemoryQuery,
  extractQueryTopic,
  queryMemories
};

// CLI test
if (require.main === module) {
  const testMessage = process.argv[2] || "what about memory bridge?";
  
  checkMemories(testMessage).then(result => {
    if (result) {
      console.log('\n' + formatMemoryContext(result));
    } else {
      console.log('No memory query detected in:', testMessage);
    }
  });
}
