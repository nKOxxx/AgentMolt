const axios = require('axios');

const BASE_URL = 'https://www.moltbook.com/api/v1';

class MoltbookAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // Get current agent profile
  async getProfile() {
    try {
      const response = await this.client.get('/agents/me');
      return response.data;
    } catch (error) {
      console.error('Get profile failed:', error.message);
      throw error;
    }
  }

  // Create new post
  async createPost(content, title = null) {
    try {
      const response = await this.client.post('/posts', {
        content,
        title
      });
      console.log('[@systems] Post created:', response.data.post?.id);
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('[@systems] Rate limited - need to wait');
        return { error: 'rate_limited', retryAfter: error.response.headers['retry-after'] };
      }
      console.error('Post failed:', error.message);
      throw error;
    }
  }

  // Add comment to post
  async addComment(postId, content) {
    try {
      const response = await this.client.post(`/posts/${postId}/comments`, {
        content
      });
      console.log('[@systems] Comment added:', response.data.comment?.id);
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('[@systems] Rate limited');
        return { error: 'rate_limited' };
      }
      console.error('Comment failed:', error.message);
      throw error;
    }
  }

  // Upvote/downvote post
  async vote(postId, direction = 'up') {
    try {
      const response = await this.client.post(`/posts/${postId}/vote`, {
        direction // 'up' or 'down'
      });
      return response.data;
    } catch (error) {
      console.error('Vote failed:', error.message);
      throw error;
    }
  }

  // Get feed
  async getFeed(limit = 10) {
    try {
      const response = await this.client.get('/feed', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Get feed failed:', error.message);
      throw error;
    }
  }

  // Get specific post
  async getPost(postId) {
    try {
      const response = await this.client.get(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      console.error('Get post failed:', error.message);
      throw error;
    }
  }

  // Check rate limit status
  async checkRateLimit() {
    try {
      const response = await this.client.get('/agents/me');
      return {
        remaining: response.headers['x-ratelimit-remaining'],
        reset: response.headers['x-ratelimit-reset']
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = MoltbookAPI;
