# AgentMolt Heartbeat Protocol

Standardized health monitoring for AgentMolt infrastructure.

## Quick Check

```bash
curl -s https://agentmolt-memory.onrender.com/api/health | jq .
```

## Expected Response

```json
{
  "status": "ok",
  "timestamp": "2026-02-16T09:30:00Z",
  "version": "1.2.0-week2",
  "features": {
    "multiTenancy": true,
    "rls": true,
    "auditLogging": true,
    "rateLimiting": true,
    "caching": true,
    "backgroundJobs": true
  },
  "services": {
    "api": {
      "status": "ok",
      "responseTime": "45ms"
    },
    "redis": {
      "connected": true,
      "latency": "12ms",
      "mode": "redis"
    },
    "database": {
      "status": "connected"
    }
  }
}
```

## Heartbeat Checks

### Level 1: Basic (Every 2 minutes)
```bash
# Check API responds
curl -s -o /dev/null -w "%{http_code}" \
  https://agentmolt-memory.onrender.com/api/health

# Expected: 200
```

### Level 2: Functional (Every 5 minutes)
```bash
# Test actual functionality
curl -X POST https://agentmolt-memory.onrender.com/api/memory/store \
  -H "X-API-Key: test_key" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "heartbeat-check",
    "content": "Health check",
    "content_type": "action"
  }'

# Expected: 201 Created
```

### Level 3: Deep (Every 15 minutes)
```bash
# Query the test memory
curl "https://agentmolt-memory.onrender.com/api/memory/query?agent_id=heartbeat-check&q=health" \
  -H "X-API-Key: test_key"

# Expected: Returns the memory we just stored
```

## Automated Monitoring

### Using Cron (Linux/Mac)
```bash
# Add to crontab
*/2 * * * * curl -s https://agentmolt-memory.onrender.com/api/health > /dev/null 2>&1 || echo "AGENTMOLT DOWN" | mail -s "Alert" admin@example.com
```

### Using Render Cron Job
```yaml
# render.yaml
services:
  - type: cron
    name: agentmolt-health-check
    schedule: "*/2 * * * *"
    command: curl -s https://agentmolt-memory.onrender.com/api/health || echo "DOWN"
```

### Using UptimeRobot (Free)
1. Sign up at https://uptimerobot.com
2. Add monitor:
   - Type: HTTP(s)
   - URL: https://agentmolt-memory.onrender.com/api/health
   - Interval: 5 minutes
3. Set alert (email/Slack/SMS)

## Response Actions

### If API Returns 5xx
1. Check Redis: `redis-cli ping`
2. Check Supabase: Query from dashboard
3. Check logs: `render logs --tail`
4. Alert human if down >5 minutes

### If Response Time >2s
1. Check Redis cache hit rate
2. Check database connection pool
3. Consider upgrading Render plan
4. Monitor for 30 minutes

### If Redis Disconnected
1. Check Upstash dashboard
2. Verify connection string
3. Restart API service
4. Fallback to database-only mode

## Health Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 🟢 OK | All systems operational | None |
| 🟡 Degraded | Slow response, partial outage | Monitor closely |
| 🔴 Down | Complete outage | Immediate response |

## Status Page

Public status: https://status.agentmolt.xyz (coming soon)

Subscribe for incident notifications.

---

**Last updated:** 2026-02-16
**Version:** 1.2.0
