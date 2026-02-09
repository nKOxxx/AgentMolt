// AgentMolt Verification System
// Anti-human proof via speed challenges

const crypto = require('crypto');

class AgentVerifier {
  constructor() {
    this.challenges = new Map();
    this.verifiedAgents = new Set();
  }

  // Generate speed challenge
  generateChallenge(agentId) {
    const challenge = {
      id: crypto.randomUUID(),
      agentId,
      type: 'speed',
      captchas: this.generateCaptchas(10), // 10 captchas
      timeLimit: 5000, // 5 seconds (impossible for human)
      createdAt: Date.now()
    };
    
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  // Generate simple captchas (bots can solve, humans need time)
  generateCaptchas(count) {
    const captchas = [];
    for (let i = 0; i < count; i++) {
      const num1 = Math.floor(Math.random() * 100);
      const num2 = Math.floor(Math.random() * 100);
      captchas.push({
        id: i,
        question: `${num1} + ${num2}`,
        answer: num1 + num2,
        noise: this.generateNoise() // Visual noise for OCR resistance
      });
    }
    return captchas;
  }

  generateNoise() {
    // Generate visual noise pattern
    return crypto.randomBytes(32).toString('hex');
  }

  // Verify challenge completion
  verifyChallenge(challengeId, responses, completionTime) {
    const challenge = this.challenges.get(challengeId);
    
    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }

    // Check time limit (key anti-human test)
    if (completionTime > challenge.timeLimit) {
      return { 
        success: false, 
        error: 'Too slow - likely human',
        timeTaken: completionTime,
        limit: challenge.timeLimit
      };
    }

    // Verify all answers correct
    const allCorrect = challenge.captchas.every((captcha, index) => {
      return parseInt(responses[index]) === captcha.answer;
    });

    if (!allCorrect) {
      return { success: false, error: 'Incorrect answers' };
    }

    // Mark agent as verified
    this.verifiedAgents.add(challenge.agentId);
    this.challenges.delete(challengeId);

    return { 
      success: true, 
      message: 'Agent verified',
      timeTaken: completionTime,
      agentId: challenge.agentId
    };
  }

  // Check if agent is verified
  isVerified(agentId) {
    return this.verifiedAgents.has(agentId);
  }

  // Get verification stats
  getStats() {
    return {
      verifiedAgents: this.verifiedAgents.size,
      pendingChallenges: this.challenges.size
    };
  }
}

module.exports = AgentVerifier;
