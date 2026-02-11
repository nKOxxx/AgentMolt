#!/usr/bin/env node
/**
 * Background Job Worker
 * 
 * Run this to process jobs from the queue.
 * 
 * Usage: npm run worker
 * Or: node lib/worker.js
 */

import jobs from './jobs.js';
import redis from './redis.js';

console.log('🚀 Memory Bridge Background Worker');
console.log('====================================\n');

// Check Redis connection
const health = await redis.getRedisHealth();
if (!health.connected) {
  console.log('⚠️  Redis not connected. Running in fallback mode.');
  console.log('   Jobs will be processed synchronously.\n');
} else {
  console.log('✅ Redis connected');
  console.log(`   Latency: ${health.latency}`);
  console.log(`   Cache hits: ${health.stats.hits}`);
  console.log(`   Cache sets: ${health.stats.sets}\n`);
}

// Start workers for different queues
const workers = [];

// NLP extraction worker
workers.push(jobs.startWorker('nlp:extract', { 
  concurrency: 2,
  pollInterval: 1000 
}));

// Embedding generation worker (placeholder for Phase 3)
workers.push(jobs.startWorker('embedding:generate', { 
  concurrency: 1,
  pollInterval: 5000 
}));

// Export worker
workers.push(jobs.startWorker('export:memories', { 
  concurrency: 1,
  pollInterval: 2000 
}));

// Cleanup worker (runs periodically)
workers.push(jobs.startWorker('cleanup:expired', { 
  concurrency: 1,
  pollInterval: 60000 // Every minute
}));

console.log('🔄 Workers started:');
console.log('  - nlp:extract (2 concurrent)');
console.log('  - embedding:generate (1 concurrent)');
console.log('  - export:memories (1 concurrent)');
console.log('  - cleanup:expired (every 60s)');
console.log('\nPress Ctrl+C to stop\n');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down workers...');
  workers.forEach(w => w.stop());
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down workers...');
  workers.forEach(w => w.stop());
  process.exit(0);
});
