const WebSocket = require('ws');
const Redis = require('ioredis');
const axios = require('axios');
require('dotenv').config();

// Configuration
const CONFIG = {
  MOLTBOOK_WS_URL: 'wss://www.moltbook.com/ws/v1/stream',
  MOLTBOOK_API_KEY: process.env.MOLTBOOK_API_KEY,
  REDIS_URL: process.env.REDIS_URL,
  MY_AGENT_ID: '4ee927aa-4899-4c07-ba4c-cf1edcc0c348',
  MY_AGENT_NAME: 'ares_agent',
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  RECONNECT_BASE_DELAY: 1000,
  MAX_RECONNECT_DELAY: 60000,
  MAX_RECONNECT_ATTEMPTS: 10
};

// Priority levels
const PRIORITY = {
  CRITICAL: 1,  // High-karma (>1000) reply to my post
  HIGH: 2,      // Mention of me
  MEDIUM: 3,    // Any reply to my post
  LOW: 4,       // New post in followed submolts
  BACKGROUND: 5 // General activity
};

class MoltbookWebSocketClient {
  constructor() {
    this.ws = null;
    this.redis = null;
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.myPosts = new Set();
  }

  async init() {
    console.log('[INIT] Initializing Moltbook WebSocket client...');
    
    // Connect to Redis
    try {
      this.redis = new Redis(CONFIG.REDIS_URL);
      await this.redis.ping();
      console.log('[INIT] Redis connected');
    } catch (error) {
      console.error('[INIT] Redis connection failed:', error.message);
      throw error;
    }

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

    // Subscribe to channels
    this.subscribe();
    
    // Start heartbeat
    this.startHeartbeat();

    // Log to Redis
    this.redis.hset('moltbook:status', 'connected_at', Date.now());
    this.redis.hset('moltbook:status', 'status', 'connected');
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

      // Store event in Redis for analysis
      await this.redis.lpush('moltbook:events', JSON.stringify({
        event: event.event,
        timestamp: event.timestamp || new Date().toISOString(),
        received_at: Date.now()
      }));
      await this.redis.ltrim('moltbook:events', 0, 999); // Keep last 1000

      // Handle specific event types
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
    
    // Skip my own comments
    if (author.id === CONFIG.MY_AGENT_ID) return;

    // Calculate priority
    const priority = this.calculatePriority(data);
    
    console.log(`[COMMENT] ${author.name} (karma: ${author.karma}) - Priority: ${priority}`);

    // Store comment
    await this.redis.hset(`moltbook:comments:${post_id}`, comment_id, JSON.stringify({
      author: author.name,
      author_karma: author.karma,
      content: content.substring(0, 200),
      timestamp: Date.now(),
      priority
    }));

    // Handle based on priority
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

    // Add to priority queue
    await this.redis.zadd('moltbook:reply_queue', priority, JSON.stringify(replyJob));
    
    console.log(`[QUEUE] Added reply job for @${comment.author.name} (priority: ${priority})`);

    // Notify OpenClaw gateway if critical
    if (priority === PRIORITY.CRITICAL) {
      await this.notifyOpenClaw(replyJob);
    }
  }

  async notifyOpenClaw(job) {
    try {
      // Store notification for OpenClaw to pick up
      await this.redis.lpush('moltbook:notifications', JSON.stringify({
        type: 'high_priority_comment',
        job,
        created_at: Date.now()
      }));

      console.log('[NOTIFY] High priority notification queued for OpenClaw');
    } catch (error) {
      console.error('[NOTIFY] Failed to notify:', error.message);
    }
  }

  async handleNewPost(data) {
    const { author, submolt, tags } = data;
    
    // Track high-karma agent posts
    if (author.karma > 500) {
      await this.redis.lpush('moltbook:high_value_posts', JSON.stringify({
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
    // Track votes on my posts
    if (this.myPosts.has(data.post_id)) {
      await this.redis.hincrby('moltbook:my_stats', 'total_upvotes', 1);
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
    
    // Update Redis status
    if (this.redis) {
      this.redis.hset('moltbook:status', 'status', 'disconnected');
      this.redis.hset('moltbook:status', 'disconnected_at', Date.now());
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('[WS] Max reconnection attempts reached. Giving up.');
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
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.redis) {
      await this.redis.quit();
    }
    
    console.log('[SHUTDOWN] Complete');
  }
}

// Main execution
const client = new MoltbookWebSocketClient();

// Handle process signals
process.on('SIGINT', () => client.shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => client.shutdown().then(() => process.exit(0)));

// Start
client.init().catch(error => {
  console.error('[FATAL] Failed to initialize:', error);
  process.exit(1);
});
