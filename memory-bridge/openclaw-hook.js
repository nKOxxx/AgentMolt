#!/usr/bin/env node
/**
 * OpenClaw Memory Bridge Hook
 * 
 * Automatically saves session memories to Memory Bridge before compression.
 * 
 * Usage: Run before session compaction/compaction
 * ./memory-hook.js --agent-id=<uuid> --session-key=<key>
 */

const https = require('https');

// Memory Bridge Configuration
const MEMORY_BRIDGE_URL = 'agentmolt-memory.onrender.com';
const MEMORY_API_KEY = process.env.MEMORY_API_KEY || 'mb-free-7x9k2m5p8q1';

// Session context (passed from OpenClaw or set via env)
const AGENT_ID = process.env.OPENCLAW_AGENT_ID || '4ee927aa-4899-4c07-ba4c-cf1edcc0c348';

/**
 * Extract key insights from session context
 * This would integrate with OpenClaw's session data
 */
function extractSessionSummary() {
  const timestamp = new Date().toISOString();
  const date = timestamp.split('T')[0];
  
  // Read from TASKS.md or session file if available
  // For now, construct from environment/context
  return {
    content: process.env.SESSION_SUMMARY || `Session activity on ${date}`,
    content_type: 'conversation',
    metadata: {
      source: 'openclaw',
      people: [],
      projects: extractProjectsFromContext(),
      importance: 7
    }
  };
}

function extractProjectsFromContext() {
  // Detect project from working directory or context
  const cwd = process.cwd();
  if (cwd.includes('agentmolt')) return ['AgentMolt'];
  if (cwd.includes('moltstamp')) return ['MoltStamp'];
  if (cwd.includes('kraken')) return ['The Kraken'];
  return ['General'];
}

/**
 * Store memory to Memory Bridge API
 */
async function storeMemory(memory) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      agent_id: AGENT_ID,
      ...memory
    });

    const options = {
      hostname: MEMORY_BRIDGE_URL,
      port: 443,
      path: '/api/memory/store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MEMORY_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.success) {
            console.log('✅ Memory saved:', result.memory.id);
            resolve(result);
          } else {
            console.error('❌ Failed to save memory:', result.error);
            reject(new Error(result.error));
          }
        } catch (e) {
          console.error('❌ Invalid response:', responseData);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Request error:', e.message);
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Query memories before compression
 */
async function queryMemories(query, limit = 5) {
  return new Promise((resolve, reject) => {
    const queryString = `agent_id=${AGENT_ID}&q=${encodeURIComponent(query)}&limit=${limit}`;
    
    const options = {
      hostname: MEMORY_BRIDGE_URL,
      port: 443,
      path: `/api/memory/query?${queryString}`,
      method: 'GET',
      headers: {
        'X-API-Key': MEMORY_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Main hook execution
 */
async function runHook() {
  console.log('🧠 Memory Bridge Hook - Session Save');
  console.log('=====================================\n');

  try {
    // Extract session summary
    const memory = extractSessionSummary();
    
    console.log('Extracting session context...');
    console.log('Content:', memory.content.substring(0, 100) + '...');
    console.log('Type:', memory.content_type);
    console.log('Projects:', memory.metadata.projects.join(', '));
    
    // Store to Memory Bridge
    console.log('\n💾 Saving to Memory Bridge...');
    const result = await storeMemory(memory);
    
    console.log('\n✅ Session memory saved successfully!');
    console.log('Memory ID:', result.memory.id);
    console.log('Created:', result.memory.created_at);
    
    return 0;
  } catch (error) {
    console.error('\n❌ Hook failed:', error.message);
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  runHook().then(code => process.exit(code));
}

module.exports = { storeMemory, queryMemories, extractSessionSummary };
