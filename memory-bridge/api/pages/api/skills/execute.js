import { validateApiKey, setTenantContext, logAudit } from '../../../lib/auth.js';

/**
 * Paid Skill Execution Endpoint
 * Requires x402 payment before executing skill
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  
  // Validate API key
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const auth = await validateApiKey(apiKey);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  await setTenantContext(auth.orgId);

  try {
    const { agent_id, skill_id, params } = req.body;

    if (!agent_id || !skill_id) {
      return res.status(400).json({ error: 'Missing agent_id or skill_id' });
    }

    // Get skill pricing
    const skill = getSkillPricing(skill_id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check if payment header is present
    const paymentHeader = req.headers['x-payment'];
    
    if (!paymentHeader && skill.price > 0) {
      // Return 402 Payment Required
      return res.status(402).json({
        error: 'Payment required',
        paymentRequired: {
          scheme: 'usdc',
          amount: (skill.price * 1000000).toString(), // Convert to USDC decimals
          receiver: process.env.AGENTMOLT_WALLET_ADDRESS,
          deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          skillName: skill.name,
          skillDescription: skill.description
        }
      });
    }

    // Verify payment (simplified - in production use x402 SDK verification)
    let paymentVerified = false;
    let txHash = null;
    
    if (paymentHeader) {
      const payment = JSON.parse(paymentHeader);
      // Verify payment authorization signature
      // This would use x402 SDK in production
      paymentVerified = true;
      txHash = '0x' + Math.random().toString(36).substring(2, 15);
    }

    if (skill.price > 0 && !paymentVerified) {
      return res.status(402).json({ error: 'Invalid payment' });
    }

    // Execute skill
    const result = await executeSkill(skill_id, params, agent_id);

    const responseTime = Date.now() - startTime;

    // Log to audit
    await logAudit({
      orgId: auth.orgId,
      agentId: agent_id,
      action: 'SKILL_EXECUTION',
      resourceType: 'skill',
      resourceId: skill_id,
      success: true,
      metadata: {
        skillName: skill.name,
        price: skill.price,
        paymentVerified,
        txHash,
        responseTime
      }
    });

    // Return result with payment info
    return res.status(200).json({
      success: true,
      skill: skill.name,
      result: result.data,
      payment: {
        required: skill.price > 0,
        amount: skill.price,
        verified: paymentVerified,
        txHash
      },
      responseTimeMs: responseTime
    });

  } catch (error) {
    console.error('Skill execution error:', error);
    
    await logAudit({
      orgId: auth.orgId,
      action: 'SKILL_EXECUTION',
      resourceType: 'skill',
      success: false,
      metadata: { error: error.message }
    });

    return res.status(500).json({ 
      error: 'Skill execution failed',
      message: error.message 
    });
  }
}

/**
 * Get skill pricing configuration
 */
function getSkillPricing(skillId) {
  const skills = {
    'web-search': {
      id: 'web-search',
      name: 'Web Search',
      description: 'Search the web for information',
      price: 0.01 // USDC
    },
    'code-review': {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code for bugs and improvements',
      price: 0.50 // USDC
    },
    'data-analysis': {
      id: 'data-analysis',
      name: 'Data Analysis',
      description: 'Analyze datasets and generate insights',
      price: 0.25 // USDC
    },
    'sentiment-analysis': {
      id: 'sentiment-analysis',
      name: 'Sentiment Analysis',
      description: 'Analyze sentiment of text',
      price: 0.05 // USDC
    },
    'translation': {
      id: 'translation',
      name: 'Translation',
      description: 'Translate text between languages',
      price: 0.02 // USDC
    }
  };

  return skills[skillId];
}

/**
 * Execute skill (placeholder - would integrate with actual skill providers)
 */
async function executeSkill(skillId, params, agentId) {
  // This is a placeholder implementation
  // In production, this would call actual skill providers
  
  const mockResults = {
    'web-search': {
      data: {
        results: ['Result 1', 'Result 2', 'Result 3'],
        query: params.query
      }
    },
    'code-review': {
      data: {
        issues: [],
        suggestions: ['Consider using async/await'],
        score: 85
      }
    },
    'data-analysis': {
      data: {
        summary: { count: 1000, mean: 42.5 },
        insights: ['Trend increasing', 'Outliers detected']
      }
    },
    'sentiment-analysis': {
      data: {
        sentiment: 'positive',
        score: 0.85
      }
    },
    'translation': {
      data: {
        translation: params.text,
        sourceLanguage: params.from,
        targetLanguage: params.to
      }
    }
  };

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));

  return mockResults[skillId] || { data: {} };
}
