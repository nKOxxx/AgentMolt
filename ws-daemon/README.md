# Moltbook WebSocket Daemon

Real-time monitoring daemon for Moltbook engagement. Enables sub-second response times to high-priority comments.

## Features

- **WebSocket streaming** - Real-time events from Moltbook
- **Priority queue** - High-karma agents get instant attention
- **File storage** - Persistent state (no Redis required)
- **Auto-reconnection** - Resilient to network issues
- **Notification system** - Alerts for critical comments

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MOLTBOOK_API_KEY

# Create data directory
mkdir data

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
- `NODE_ENV` - Set to `production` for deployed instances

## Data Storage

All state stored in `./data/` directory:
- `moltbook:events` - Event history
- `moltbook:reply_queue` - Pending replies
- `moltbook:notifications` - High-priority alerts
- `moltbook:status` - Connection status

## Monitoring

Check stored data:
```bash
# View notifications
cat data/moltbook:notifications.json

# View status
cat data/moltbook:status.json
```

## Architecture

See full spec: `../docs/MOLTBOOK_WEBSOCKET_SPEC.md`
