const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  MOLTBOOK_API_URL: 'https://www.moltbook.com/api/v1',
  MOLTBOOK_API_KEY: process.env.MOLTBOOK_API_KEY,
  MY_AGENT_ID: '4ee927aa-4899-4c07-ba4c-cf1edcc0c348',
  MY_AGENT_NAME: 'ares_agent',
  DATA_DIR: './data',
  POLL_INTERVAL: 60000, // 1 minute
  HIGH_PRIORITY_KARMA: 100,
  MY_POSTS: [
    'b057d30e-eaab-4886-a6dc-8b041ef6746f', // Post 1: Security Crisis
    'a0ff61f2-e43a-4dc9-843f-3e3855a74d76', // Post 2: Four Primitives
    '0bb31fec-bd24-44f4-b4d7-6c6bb9bf5423'  // Post 3: AgentMolt Launch
  ]
};

// Simple file-based storage
class FileStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    console.log('[STORAGE] File storage initialized at', this.dataDir);
  }

  async set(key, value) {
    this.cache.set(key, value);
    const filePath = path.join(this.dataDir, `${key.replace(/:/g, '_')}.json`);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  async get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const filePath = path.join(this.dataDir, `${key.replace(/:/g, '_')}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const value = JSON.parse(data);
      this.cache.set(key, value);
      return value;
    } catch { return null; }
  }

  async lpush(key, value) {
    let list = await this.get(key) || [];
    list.unshift(value);
    if (list.length > 100) list = list.slice(0, 100);
    await this.set(key, list);
  }
}

class MoltbookPoller {
  constructor() {
    this.storage = new FileStorage(CONFIG.DATA_DIR);
    this.knownComments = new Set();
  }

  async init() {
    console.log('[INIT] Starting Moltbook Poller...');
    console.log(`[INIT] Monitoring ${CONFIG.MY_POSTS.length} posts`);
    await this.storage.init();
    await this.loadKnownComments();
    this.startPolling();
  }

  async apiRequest(endpoint) {
    try {
      const response = await axios.get(`${CONFIG.MOLTBOOK_API_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.MOLTBOOK_API_KEY}` },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[API] Error: ${error.message}`);
      return null;
    }
  }

  async loadKnownComments() {
    const known = await this.storage.get('moltbook:known_comments');
    if (known) {
      known.forEach(id => this.knownComments.add(id));
    }
    console.log(`[INIT] ${this.knownComments.size} known comments`);
  }

  async saveKnownComment(commentId) {
    this.knownComments.add(commentId);
    await this.storage.set('moltbook:known_comments', Array.from(this.knownComments));
  }

  async checkPostComments(postId) {
    const data = await this.apiRequest(`/posts/${postId}`);
    if (!data?.success || !data.post) return;

    const post = data.post;
    if (!post.comments || post.comments.length === 0) return;

    for (const comment of post.comments) {
      if (comment.author.id === CONFIG.MY_AGENT_ID) continue;
      if (this.knownComments.has(comment.id)) continue;

      await this.handleNewComment(comment, post);
      await this.saveKnownComment(comment.id);
    }
  }

  async handleNewComment(comment, post) {
    const authorKarma = comment.author?.karma || 0;
    const mentionsMe = comment.content?.includes(`@${CONFIG.MY_AGENT_NAME}`);
    
    console.log(`\n[NEW COMMENT] 🔥 @${comment.author.name} commented on "${post.title.substring(0, 50)}..."`);
    console.log(`              Karma: ${authorKarma} | Mentions: ${mentionsMe ? 'YES' : 'no'}`);
    console.log(`              Content: ${comment.content.substring(0, 100)}...`);

    // Store comment
    await this.storage.lpush('moltbook:recent_comments', {
      id: comment.id,
      author: comment.author.name,
      authorKarma,
      content: comment.content.substring(0, 300),
      postTitle: post.title,
      timestamp: Date.now(),
      mentionsMe
    });

    // High priority alert
    if (authorKarma > CONFIG.HIGH_PRIORITY_KARMA || mentionsMe) {
      const alert = {
        type: mentionsMe ? 'mention' : 'high_karma_comment',
        author: comment.author.name,
        authorKarma,
        postTitle: post.title,
        content: comment.content.substring(0, 500),
        timestamp: Date.now(),
        postId: post.id,
        commentId: comment.id
      };
      
      await this.storage.lpush('moltbook:high_priority_alerts', alert);
      
      console.log(`[ALERT] ⭐ HIGH PRIORITY: @${comment.author.name} ${mentionsMe ? 'MENTIONED YOU!' : `(${authorKarma} karma)`}`);
      
      // Write to a special file for easy checking
      await this.storage.set('moltbook:latest_alert', alert);
    }
  }

  async poll() {
    console.log(`\n[POLL ${new Date().toLocaleTimeString()}] Checking ${CONFIG.MY_POSTS.length} posts...`);
    
    for (const postId of CONFIG.MY_POSTS) {
      await this.checkPostComments(postId);
      await new Promise(r => setTimeout(r, 1000)); // Rate limit friendly
    }
    
    console.log(`[POLL] Complete. Next check in ${CONFIG.POLL_INTERVAL/1000}s`);
  }

  startPolling() {
    this.poll();
    setInterval(() => this.poll(), CONFIG.POLL_INTERVAL);
  }
}

// Main
const poller = new MoltbookPoller();

process.on('SIGINT', async () => {
  console.log('\n[SHUTDOWN] Stopping poller...');
  process.exit(0);
});

poller.init().catch(error => {
  console.error('[FATAL]', error);
  process.exit(1);
});
