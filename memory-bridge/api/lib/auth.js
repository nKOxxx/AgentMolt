import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// AUTH & TENANCY (Week 1 Hardening)
// ============================================

/**
 * Validate API key and return org context
 */
export async function validateApiKey(apiKey) {
  try {
    // Extract prefix for faster lookup
    const prefix = apiKey.substring(0, 20);
    
    // Find key by prefix
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*, organizations!inner(*)')
      .eq('key_prefix', prefix)
      .is('revoked_at', null)
      .limit(1);
    
    if (error || !keys || keys.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    const keyRecord = keys[0];
    
    // Verify hash
    const isValid = await bcrypt.compare(apiKey, keyRecord.key_hash);
    if (!isValid) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    // Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }
    
    // Check org status
    if (!keyRecord.organizations.is_active) {
      return { valid: false, error: 'Organization inactive' };
    }
    
    // Update last_used
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id);
    
    return {
      valid: true,
      orgId: keyRecord.org_id,
      scopes: keyRecord.scopes,
      rateLimit: keyRecord.rate_limit_per_minute,
      plan: keyRecord.organizations.plan
    };
  } catch (error) {
    console.error('Auth error:', error);
    return { valid: false, error: 'Authentication failed' };
  }
}

/**
 * Set tenant context for RLS
 */
export async function setTenantContext(orgId, agentId = null) {
  await supabase.rpc('set_tenant_context', {
    org_id: orgId,
    agent_id: agentId
  });
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logAudit({
  orgId,
  agentId = null,
  action,
  resourceType,
  resourceId = null,
  oldValues = null,
  newValues = null,
  success = true,
  metadata = {}
}) {
  try {
    await supabase.rpc('log_audit', {
      p_org_id: orgId,
      p_agent_id: agentId,
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_old_values: oldValues,
      p_new_values: newValues,
      p_success: success
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Audit log error:', error);
  }
}

// ============================================
// RATE LIMITING (In-memory for free tier, Redis for prod)
// ============================================

const rateLimitStore = new Map();

export function checkRateLimit(orgId, limit = 100) {
  const now = Date.now();
  const key = `${orgId}:${Math.floor(now / 60000)}`; // Per minute bucket
  
  const current = rateLimitStore.get(key) || 0;
  
  if (current >= limit) {
    return { allowed: false, resetIn: 60 - Math.floor((now % 60000) / 1000) };
  }
  
  rateLimitStore.set(key, current + 1);
  
  // Cleanup old entries (simple GC)
  if (Math.random() < 0.01) {
    const cutoff = now - 3600000; // 1 hour ago
    for (const [k, v] of rateLimitStore) {
      if (parseInt(k.split(':')[1]) * 60000 < cutoff) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  return { allowed: true, remaining: limit - current - 1 };
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

export function validateMemoryInput(data) {
  const errors = [];
  
  if (!data.agent_id || !isValidUUID(data.agent_id)) {
    errors.push('agent_id must be a valid UUID');
  }
  
  if (!data.content || typeof data.content !== 'string') {
    errors.push('content is required');
  } else if (data.content.length > 10000) {
    errors.push('content exceeds 10KB limit');
  }
  
  if (!data.content_type || !['conversation', 'action', 'insight', 'error'].includes(data.content_type)) {
    errors.push('content_type must be one of: conversation, action, insight, error');
  }
  
  return { valid: errors.length === 0, errors };
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default {
  validateApiKey,
  setTenantContext,
  logAudit,
  checkRateLimit,
  validateMemoryInput
};
