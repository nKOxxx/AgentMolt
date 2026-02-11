# Memory Bridge Lite - API Layer

## Configuration

Create `.env.local` in your project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xdnvxvlobfjblvzeomac.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbnZ4dmxvYmZqYmx2emVvbWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDU3MzIsImV4cCI6MjA4NjM4MTczMn0.sGx4JFBFIsi8MJ2kG8vVZYfbYVyJ_7GLm6O-isNXhJw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbnZ4dmxvYmZqYmx2emVvbWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTczMiwiZXhwIjoyMDg2MzgxNzMyfQ.P5gMLtytnmLte0xyCTsmUWvT4kIGzcBrKVLnoftgm04

# API
MEMORY_API_KEY=your-secret-api-key-for-agent-auth
```

## Installation

```bash
npm install @supabase/supabase-js compromise
```
