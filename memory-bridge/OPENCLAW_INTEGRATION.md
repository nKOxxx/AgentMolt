# OpenClaw Memory Bridge Integration

Auto-save session memories before compression.

## Setup

### 1. Set Environment Variable

Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
export MEMORY_API_KEY="mb-free-7x9k2m5p8q1"
export OPENCLAW_AGENT_ID="4ee927aa-4899-4c07-ba4c-cf1edcc0c348"
```

Then reload:
```bash
source ~/.zshrc
```

### 2. Test Hook

```bash
cd ~/.openclaw/workspace/projects/agentmolt/memory-bridge
node openclaw-hook.js
```

Should output: `✅ Memory saved: <uuid>`

### 3. Integrate with OpenClaw

**Option A: Pre-compression Hook**

In your OpenClaw config, add before compression:
```bash
node /Users/ares/.openclaw/workspace/projects/agentmolt/memory-bridge/openclaw-hook.js
```

**Option B: Manual Save**

Before ending session, run:
```bash
SESSION_SUMMARY="Discussed payment rails architecture with Nikola" node openclaw-hook.js
```

**Option C: Auto-save on Session End**

Add to `~/.openclaw/config.yaml`:
```yaml
hooks:
  pre_compaction:
    - node /Users/ares/.openclaw/workspace/projects/agentmolt/memory-bridge/openclaw-hook.js
```

## Usage

### Save Memory
```javascript
const { storeMemory } = require('./openclaw-hook');

await storeMemory({
  content: "Discussed payment rails with Nikola",
  content_type: "conversation",
  metadata: {
    people: ["nikola"],
    projects: ["AgentMolt"],
    importance: 8
  }
});
```

### Query Memories
```javascript
const { queryMemories } = require('./openclaw-hook');

const results = await queryMemories("payment rails", 5);
console.log(results);
```

## Testing

```bash
# Test store
curl -X POST https://agentmolt-memory.onrender.com/api/memory/store \
  -H "X-API-Key: mb-free-7x9k2m5p8q1" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "4ee927aa-4899-4c07-ba4c-cf1edcc0c348",
    "content": "Test memory from OpenClaw",
    "content_type": "conversation"
  }'

# Test query
curl "https://agentmolt-memory.onrender.com/api/memory/query?agent_id=4ee927aa-4899-4c07-ba4c-cf1edcc0c348&q=test" \
  -H "X-API-Key: mb-free-7x9k2m5p8q1"
```
