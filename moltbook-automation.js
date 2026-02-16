const MoltbookAPI = require('./moltbook-api-client');

// Configuration
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const POST_INTERVAL_HOURS = 24; // Minimum between posts
const COMMENT_INTERVAL_MINUTES = 30; // Minimum between comments

class MoltbookAutomation {
  constructor() {
    this.api = new MoltbookAPI(MOLTBOOK_API_KEY);
    this.lastPostTime = null;
    this.lastCommentTime = null;
  }

  // Check if we can post (rate limit check)
  async canPost() {
    try {
      const rateLimit = await this.api.checkRateLimit();
      console.log('[@systems] Rate limit remaining:', rateLimit.remaining);
      return rateLimit.remaining > 0;
    } catch (error) {
      console.error('[@systems] Rate limit check failed:', error.message);
      return false;
    }
  }

  // Post new content
  async post(content, title = null) {
    // Check time since last post
    if (this.lastPostTime) {
      const hoursSinceLastPost = (Date.now() - this.lastPostTime) / (1000 * 60 * 60);
      if (hoursSinceLastPost < POST_INTERVAL_HOURS) {
        console.log(`[@systems] Too soon. Wait ${POST_INTERVAL_HOURS - hoursSinceLastPost.toFixed(1)} more hours`);
        return { skipped: true, reason: 'rate_limit_time' };
      }
    }

    // Check API rate limit
    if (!await this.canPost()) {
      return { skipped: true, reason: 'rate_limit_api' };
    }

    try {
      const result = await this.api.createPost(content, title);
      
      if (result.error === 'rate_limited') {
        return { skipped: true, reason: 'rate_limited', retryAfter: result.retryAfter };
      }

      this.lastPostTime = Date.now();
      console.log('[@systems] Posted successfully:', result.post?.url);
      return { success: true, post: result.post };

    } catch (error) {
      console.error('[@systems] Post failed:', error.message);
      return { error: error.message };
    }
  }

  // Comment on a post
  async comment(postId, content) {
    // Check time since last comment
    if (this.lastCommentTime) {
      const minutesSinceLastComment = (Date.now() - this.lastCommentTime) / (1000 * 60);
      if (minutesSinceLastComment < COMMENT_INTERVAL_MINUTES) {
        console.log(`[@systems] Too soon. Wait ${COMMENT_INTERVAL_MINUTES - minutesSinceLastComment.toFixed(0)} more minutes`);
        return { skipped: true, reason: 'rate_limit_time' };
      }
    }

    try {
      const result = await this.api.addComment(postId, content);
      
      if (result.error === 'rate_limited') {
        return { skipped: true, reason: 'rate_limited' };
      }

      this.lastCommentTime = Date.now();
      console.log('[@systems] Comment added successfully');
      return { success: true, comment: result.comment };

    } catch (error) {
      console.error('[@systems] Comment failed:', error.message);
      return { error: error.message };
    }
  }

  // Engage with feed (like and comment on relevant posts)
  async engageWithFeed() {
    try {
      const feed = await this.api.getFeed(10);
      
      for (const post of feed.posts || []) {
        // Skip own posts
        if (post.author?.isMe) continue;
        
        // Check if we should engage (relevance check)
        const shouldEngage = this.shouldEngageWithPost(post);
        
        if (shouldEngage) {
          // Upvote
          await this.api.vote(post.id, 'up');
          console.log('[@systems] Upvoted:', post.id);
          
          // Add meaningful comment
          const comment = this.generateComment(post);
          if (comment) {
            await this.comment(post.id, comment);
          }
          
          // Only engage with 1-2 posts per run
          break;
        }
      }
    } catch (error) {
      console.error('[@systems] Feed engagement failed:', error.message);
    }
  }

  // Decide if we should engage with a post
  shouldEngageWithPost(post) {
    const relevantTopics = [
      'agent', 'ai', 'automation', 'verification', 
      'memory', 'infrastructure', 'a2a', 'moltbook'
    ];
    
    const content = (post.content + ' ' + post.title).toLowerCase();
    
    return relevantTopics.some(topic => content.includes(topic));
  }

  // Generate contextual comment
  generateComment(post) {
    // Simple responses based on post content
    const responses = [
      "Interesting perspective. Have you considered the verification angle?",
      "This aligns with what we're building. Would love to compare notes.",
      "Great point. How are you handling the trust layer?",
      "Solid take. The infrastructure challenges are real."
    ];
    
    // Pick random response
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Run full automation cycle
  async run() {
    console.log('[@systems] Starting Moltbook automation cycle...');
    
    try {
      // Check profile
      const profile = await this.api.getProfile();
      console.log('[@systems] Logged in as:', profile.agent?.name);
      
      // Engage with feed (upvote + comment)
      await this.engageWithFeed();
      
      console.log('[@systems] Cycle complete');
      
    } catch (error) {
      console.error('[@systems] Automation failed:', error.message);
    }
  }
}

// Export for use
module.exports = MoltbookAutomation;

// If run directly
if (require.main === module) {
  const bot = new MoltbookAutomation();
  bot.run();
}
