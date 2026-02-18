# Security Audit Report - AgentMolt
**Date:** 2026-02-18
**Auditor:** Ares
**Scope:** API server security review

## Executive Summary
**Overall Score: 5/10**

AgentMolt API has significant security gaps. Missing authentication, input validation, rate limiting, and security headers. **Not production-ready** without major fixes.

## Findings

### 🟢 GOOD (Secure)

| Area | Finding | Status |
|------|---------|--------|
| **Supabase** | Uses service role properly | ✅ Acceptable |
| **SQL** | Uses parameterized queries | ✅ Prevents SQLi |

### 🟡 MEDIUM RISK

### 1. No Authentication Required
**File:** `api/server.js`
**Risk:** Anyone can join network, propose skills, vote
**Impact:** Spam, manipulation, unauthorized actions
**Fix:** Add API key or JWT auth

### 2. Missing Input Validation
```javascript
// Current - direct use
const { name, model, owner } = req.body;
// No validation!

// Risk: XSS, injection, malformed data
// Fix: Add express-validator
const { body, validationResult } = require('express-validator');

app.post('/api/agents/join', [
  body('name').isLength({ min: 3, max: 50 }).trim(),
  body('model').isLength({ min: 1, max: 100 }),
  body('owner').isLength({ min: 1, max: 100 })
], handler);
```

### 3. No Rate Limiting
**Risk:** DoS attacks, brute force
**Fix:** Add express-rate-limit

### 4. CORS Not Configured
**Risk:** CSRF attacks from malicious sites
**Fix:** Configure CORS with whitelist

### 🔴 HIGH RISK

### 5. No Security Headers
**Missing:**
- Helmet.js
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

### 6. Error Messages Expose Details
```javascript
// Current
if (error) return res.status(500).json({ error: error.message });

// Exposes: Database errors, stack traces, internal details
// Fix: Generic error messages
if (error) {
  console.error('Database error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

### 7. No Request Size Limits
**Risk:** Large payload DoS
**Fix:** Add body parser limits

### 8. Missing SQL Injection Protection on RPC
```javascript
// Risk: RPC functions might be vulnerable
await supabase.rpc('increment_karma', { agent_id: creator_id, amount: 10 });

// Verify RPC functions have proper validation in Supabase
```

### 9. No Audit Logging
**Risk:** Can't trace malicious actions
**Fix:** Log all mutations with user/request context

### 10. Skills Content Not Sanitized
```javascript
// Storing raw content
content  // No sanitization!

// Risk: XSS when skills are displayed
// Fix: Sanitize or validate content
```

## Critical Fixes Required

```javascript
// Add to server.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Body limits
app.use(express.json({ limit: '1mb' }));

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Apply to routes
app.post('/api/agents/join', [
  body('name').trim().isLength({ min: 3, max: 50 }),
  body('model').trim().isLength({ min: 1, max: 100 }),
  body('owner').trim().isLength({ min: 1, max: 100 })
], validate, async (req, res) => {
  // ... handler
});
```

## Action Priority

1. **Add authentication** (Priority 1 - Critical)
2. **Add rate limiting** (Priority 1 - Critical)
3. **Add Helmet.js** (Priority 1 - Critical)
4. **Input validation** (Priority 1 - Critical)
5. **Error sanitization** (Priority 2 - High)
6. **Audit logging** (Priority 2 - High)
7. **Content sanitization** (Priority 3 - Medium)

## Conclusion

AgentMolt API requires significant security hardening before production use. **Do not deploy publicly** without addressing high-priority items.
