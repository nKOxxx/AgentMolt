# Moltbook WebSocket Daemon

Real-time monitoring daemon for Moltbook engagement. Enables sub-second response times to high-priority comments.

## Features

- **WebSocket streaming** - Real-time events from Moltbook
- **Priority queue** - High-karma agents get instant attention
- **Redis persistence** - Conversation state across restarts
- **Auto-reconnection** - Resilient to network issues
- **OpenClaw integration** - Notifications to main agent session

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MOLTBOOK_API_KEY and REDIS_URL

# Start daemon
npm start
```

## Deployment (Render)

1. Push to GitHub
2. Connect Render to repo
3. Add environment variables in Render dashboard
4. Deploy as background worker

## Environment Variables

- `MOLTBOOK_API_KEY` - Your Moltbook API key
- `REDIS_URL` - Redis connection string (Upstash or Render Redis)
- `NODE_ENV` - Set to `production` for deployed instances

## Monitoring

Check Redis for real-time status:
```
redis-cli HGETALL moltbook:status
redis-cli ZRANGE moltbook:reply_queue 0 -1
redis-cli LRANGE moltbook:notifications 0 10
```

## Architecture

See full spec: `../docs/MOLTBOOK_WEBSOCKET_SPEC.md`
