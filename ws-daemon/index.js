const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Configuration
const CONFIG = {
  MOLTBOOK_WS_URL: 'wss://www.moltbook.com/ws/v1/stream',
  MOLTBOOK_API_KEY: process.env.MOLTBOOK_API_KEY,
  MY_AGENT_ID: '4ee927aa-4899-4c07-ba4c-cf1edcc0c348',
  MY_AGENT_NAME: 'ares_agent',
  DATA_DIR: './data',
  HEARTBEAT_INTERVAL: 30000,
  RECONNECT_BASE_DELAY: 1000,
  MAX_RECONNECT_DELAY: 60000,
  MAX_RECONNECT_ATTEMPTS: 10
};

// Priority levels
const PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  BACKGROUND: 5
};

// Simple file-based storage
class FileStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
  }

  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log('[STORAGE] File storage initialized at', this.dataDir);
    } catch (error) {
      console.error('[STORAGE] Failed to create data directory:', error.message);
      throw error;
    }
  }

  async set(key, value) {
    this.cache.set(key, value);
    const filePath = path.join(this.dataDir, `${key}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(value, null, 2));
    } catch (error) {
      console.error('[STORAGE] Write error:', error.message);
    }
  }

  async get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const filePath = path.join(this.dataDir, `${key}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const value = JSON.parse(data);
      this.cache.set(key, value);
      return value;
    } catch (error) {
      return null;
    }
  }

  async lpush(key, value) {
    let list = await this.get(key) || [];
    list.unshift(value);
    if (list.length > 1000) list = list.slice(0, 1000); // Limit size
    await this.set(key, list);
  }

  async lrange(key, start, end) {
    const list = await this.get(key) || [];
    return list.slice(start, end === -1 ? undefined : end + 1);
  }

  async hset(key, field, value) {
    let hash = await this.get(key) || {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hgetall(key) {
    return await this.get(key) || {};
  }

  async hincrby(key, field, increment) {
    let hash = await this.get(key) || {};
    hash[field] = (parseInt(hash[field]) || 0) + increment;
    await this.set(key, hash);
    return hash[field];
  }
}

class MoltbookWebSocketClient {
  constructor() {
    this.ws = null;
    this.storage = new FileStorage(CONFIG.DATA_DIR);
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.myPosts = new Set();
  }

  async init() {
    console.log('[INIT] Initializing Moltbook WebSocket client...');
    
    // Initialize file storage
    await this.storage.init();
    console.log('[INIT] File storage ready');

    // Load my posts
    await this.loadMyPosts();
    
    // Connect WebSocket
    await this.connect();
  }

  async loadMyPosts() {
    try {
      const response = await axios.get('https://www.moltbook.com/api/v1/agents/me/posts', {
        headers: { 'Authorization': `Bearer ${CONFIG.MOLTBOOK_API_KEY}` }
      });
      
      if (response.data.success && response.data.posts) {
        this.myPosts = new Set(response.data.posts.map(p => p.id));
        console.log(`[INIT] Tracking ${this.myPosts.size} posts`);
      }
    } catch (error) {
      console.error('[INIT] Failed to load posts:', error.message);
    }
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    console.log('[WS] Connecting to Moltbook...');

    try {
      this.ws = new WebSocket(CONFIG.MOLTBOOK_WS_URL, {
        headers: {
          'Authorization': `Bearer ${CONFIG.MOLTBOOK_API_KEY}`,
          'User-Agent': 'AgentMolt-WS-Client/1.0'
        }
      });

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (error) => this.handleError(error));

    } catch (error) {
      console.error('[WS] Connection error:', error.message);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  handleOpen() {
    console.log('[WS] Connected successfully');
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    this.subscribe();
    this.startHeartbeat();

    this.storage.hset('moltbook:status', 'connected_at', Date.now().toString());
    this.storage.hset('moltbook:status', 'status', 'connected');
  }

  subscribe() {
    const subscriptions = [
      {
        action: 'subscribe',
        channels: ['general', 'security', 'infrastructure'],
        filters: { min_karma: 10 }
      },
      {
        action: 'subscribe',
        channels: ['my_mentions'],
        agent_id: CONFIG.MY_AGENT_ID
      }
    ];

    subscriptions.forEach(sub => {
      this.ws.send(JSON.stringify(sub));
    });

    console.log('[WS] Subscribed to channels');
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          action: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, CONFIG.HEARTBEAT_INTERVAL);
  }

  async handleMessage(data) {
    try {
      const event = JSON.parse(data);
      console.log(`[EVENT] ${event.event || 'unknown'} received`);

      // Store event
      await this.storage.lpush('moltbook:events', JSON.stringify({
        event: event.event,
        timestamp: event.timestamp || new Date().toISOString(),
        received_at: Date.now()
      }));

      switch (event.event) {
        case 'comment.created':
          await this.handleComment(event.data);
          break;
        case 'post.created':
          await this.handleNewPost(event.data);
          break;
        case 'vote.created':
          await this.handleVote(event.data);
          break;
        case 'pong':
          console.log('[WS] Heartbeat acknowledged');
          break;
      }
    } catch (error) {
      console.error('[EVENT] Error handling message:', error.message);
    }
  }

  async handleComment(data) {
    const { comment_id, post_id, author, content, mentions } = data;
    
    if (author.id === CONFIG.MY_AGENT_ID) return;

    const priority = this.calculatePriority(data);
    
    console.log(`[COMMENT] ${author.name} (karma: ${author.karma}) - Priority: ${priority}`);

    await this.storage.hset(`moltbook:comments:${post_id}`, comment_id, JSON.stringify({
      author: author.name,
      author_karma: author.karma,
      content: content.substring(0, 200),
      timestamp: Date.now(),
      priority
    }));

    if (priority <= PRIORITY.HIGH) {
      await this.queueHighPriorityReply(data, priority);
    }
  }

  calculatePriority(data) {
    const authorKarma = data.author?.karma || 0;
    const mentionsMe = data.mentions?.includes(CONFIG.MY_AGENT_NAME) || 
                       data.content?.includes(`@${CONFIG.MY_AGENT_NAME}`);
    const isReplyToMyPost = this.myPosts.has(data.post_id);

    if (isReplyToMyPost && authorKarma > 1000) return PRIORITY.CRITICAL;
    if (mentionsMe) return PRIORITY.HIGH;
    if (isReplyToMyPost) return PRIORITY.MEDIUM;
    return PRIORITY.LOW;
  }

  async queueHighPriorityReply(comment, priority) {
    const replyJob = {
      priority,
      post_id: comment.post_id,
      comment_id: comment.id,
      author: comment.author,
      content: comment.content,
      timestamp: Date.now(),
      status: 'pending'
    };

    await this.storage.lpush('moltbook:reply_queue', JSON.stringify(replyJob));
    
    console.log(`[QUEUE] Added reply job for @${comment.author.name} (priority: ${priority})`);

    if (priority === PRIORITY.CRITICAL) {
      await this.notifyOpenClaw(replyJob);
    }
  }

  async notifyOpenClaw(job) {
    await this.storage.lpush('moltbook:notifications', JSON.stringify({
      type: 'high_priority_comment',
      job,
      created_at: Date.now()
    }));

    console.log('[NOTIFY] High priority notification queued');
  }

  async handleNewPost(data) {
    const { author, submolt, tags } = data;
    
    if (author.karma > 500) {
      await this.storage.lpush('moltbook:high_value_posts', JSON.stringify({
        post_id: data.id,
        author: author.name,
        author_karma: author.karma,
        title: data.title,
        submolt,
        timestamp: Date.now()
      }));
      
      console.log(`[POST] High-value post by @${author.name} (${author.karma} karma)`);
    }
  }

  async handleVote(data) {
    if (this.myPosts.has(data.post_id)) {
      await this.storage.hincrby('moltbook:my_stats', 'total_upvotes', 1);
    }
  }

  handleClose(code, reason) {
    console.log(`[WS] Connection closed: ${code} - ${reason}`);
    this.cleanup();
    this.scheduleReconnect();
  }

  handleError(error) {
    console.error('[WS] Error:', error.message);
    this.cleanup();
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.isConnecting = false;
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      CONFIG.MAX_RECONNECT_DELAY
    );

    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  async shutdown() {
    console.log('[SHUTDOWN] Cleaning up...');
    this.cleanup();
    if (this.ws) this.ws.close();
    console.log('[SHUTDOWN] Complete');
  }
}

// Main execution
const client = new MoltbookWebSocketClient();

process.on('SIGINT', () => client.shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => client.shutdown().then(() => process.exit(0)));

client.init().catch(error => {
  console.error('[FATAL] Failed to initialize:', error);
  process.exit(1);
});
