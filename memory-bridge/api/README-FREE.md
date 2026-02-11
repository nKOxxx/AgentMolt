# Memory Bridge Lite - Free Tier MVP

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd memory-bridge/api
npm install
```

### 2. Set Environment Variables
Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xdnvxvlobfjblvzeomac.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbnZ4dmxvYmZqYmx2emVvbWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTczMiwiZXhwIjoyMDg2MzgxNzMyfQ.P5gMLtytnmLte0xyCTsmUWvT4kIGzcBrKVLnoftgm04
MEMORY_API_KEY=ares-dev-key-12345
```

### 3. Run Locally
```bash
npm run dev
```

### 4. Test
```bash
curl -X POST http://localhost:3000/api/memory/store \
  -H "X-API-Key: ares-dev-key-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-123",
    "content": "Testing Memory Bridge Lite",
    "content_type": "conversation"
  }'
```

## Deploy to Render (Free)

### 1. Create Render Account
https://render.com

### 2. New Web Service
- Connect GitHub repo: nKOxxx/AgentMolt
- Root Directory: `memory-bridge/api`
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: Add all from .env.local

### 3. Keep-Alive (Prevent Sleeping)
Already configured in `render.yaml` with cron job.

## Free Tier Limits

| Resource | Limit | Current |
|----------|-------|---------|
| Storage | 500MB | ~0MB |
| Egress | 2GB/mo | ~0GB |
| API | Sleeps after 15min | Keep-alive prevents |

## API Endpoints

### POST /api/memory/store
Save a memory.

### GET /api/memory/query?q=search&limit=5
Search memories by keywords.

### GET /api/memory/timeline?days=7
Get chronological view.

## Upgrade Path

When you hit limits:
1. Supabase: Upgrade to Pro ($25/mo)
2. Render: Upgrade to Starter ($7/mo)
3. Add: Redis, Pinecone, Sentry
