# Memory Bridge
## Long-Term Memory for AI Agents

---

### The Problem

AI agents have **two memory problems**:

**1. The Goldfish Problem (Session Loss)**
When a session ends, everything evaporates. Every conversation, decision, and insight disappears. Agents start from zero next time, repeating work, forgetting preferences, losing institutional knowledge.

**2. The Context Window Problem (In-Session Loss)**
Even during active conversations, agents forget. Ask about something discussed 20 messages ago? Lost. Reference an earlier decision? Gone. The agent's "attention span" is limited, and important details fall out of the context window.

**Result:** Agents are amnesiac collaborators - unreliable for complex work that spans time or requires remembering earlier details.

**Current options:**
- ❌ Vector databases: Complex, expensive, overkill for structured memory
- ❌ File storage: Unsearchable, unscalable, no security
- ❌ Longer context windows: Expensive, still limited, doesn't solve session loss
- ❌ No persistence: Agents stay goldfish

---

### The Solution

**Memory Bridge** - API-first long-term memory for AI agents

**Core Features:**
- 💾 **Persistent Storage** - 500MB free tier, scalable to terabytes
- 🔍 **Smart Search** - Keyword-based retrieval with relevance scoring
- 🔒 **Multi-Tenant Security** - Organization isolation, API key auth, audit logs
- ⚡ **Fast & Simple** - REST API, <100ms response times
- 🆓 **Free to Start** - Zero cost until you need scale

---

### How It Works

**Solves both problems:**

```
┌─────────────────────────────────────────────────────────┐
│  DURING CONVERSATION (Context Window Extension)         │
│  Agent forgets detail from 20 messages ago              │
│     ↓                                                   │
│  GET /query?q=what+we+decided+about+X                   │
│     ↓                                                   │
│  Returns: "Earlier you decided to build Y..."           │
│     ↓                                                   │
│  Agent continues with full context ✓                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  BETWEEN SESSIONS (Persistence)                         │
│  Session ends                                           │
│     ↓                                                   │
│  All memories automatically saved                       │
│     ↓                                                   │
│  Next session: GET /query?q=previous+work               │
│     ↓                                                   │
│  Agent resumes with full history ✓                      │
└─────────────────────────────────────────────────────────┘
```

**Example:**
```bash
# Store important decisions/insights
POST /api/memory/store
{"agent_id": "...", "content": "User prefers dark mode, wants mobile-first design", "content_type": "insight"}

# Retrieve during conversation (context window augmentation)
GET /api/memory/query?q=user+design+preferences
→ Returns: "User prefers dark mode, wants mobile-first design"

# Retrieve next week (session persistence)
GET /api/memory/query?q=what+we+decided
→ Returns full conversation history with rankings
```

---

### Live Demo

**Interactive Demo:** `demo.html` (download and open in browser)

**API Endpoint:** `https://agentmolt-memory.onrender.com`

**Test Credentials:**
- API Key: `mb-free-7x9k2m5p8q1`
- Agent ID: `4ee927aa-4899-4c07-ba4c-cf1edcc0c348`

**Try It:**
1. Open demo → Click "Check Status" (API health)
2. Click "Store Memory" (saves to database)
3. Click "Search Memories" (retrieves with relevance)
4. View "Timeline" (chronological history)

---

### Technical Architecture

| Layer | Technology | Security |
|-------|-----------|----------|
| **API** | Next.js + Node.js | Rate limiting, input validation |
| **Auth** | API Keys + bcrypt | Hashed, scoped, revocable |
| **Database** | PostgreSQL (Supabase) | RLS policies, tenant isolation |
| **Audit** | Append-only logs | Every action tracked |
| **Hosting** | Render + Supabase | SSL, DDoS protection |

**Compliance Ready:**
- Multi-tenancy by design
- Audit trails for SOC 2
- Row-level security (RLS)
- GDPR-compliant data handling

---

### Use Cases

**1. Personal AI Agents**
- Remember preferences, past decisions
- Build long-term user profiles
- Continuity across sessions

**2. Business Automation**
- Log process decisions
- Audit trail for compliance
- Knowledge retention across team changes

**3. Multi-Agent Systems**
- Shared memory between agents
- Organization-wide knowledge base
- Access control per agent

**4. AI-Native Apps**
- Drop-in memory layer
- No vector DB complexity
- Production-ready from day one

---

### Pricing

| Tier | Cost | Limits | Best For |
|------|------|--------|----------|
| **Free** | $0 | 500MB, 100 req/min | Prototyping, personal agents |
| **Starter** | $25/mo | 8GB, 1000 req/min | Small teams, early products |
| **Pro** | $122/mo | 100GB, semantic search | Production apps |
| **Enterprise** | Custom | Unlimited, dedicated | Scale deployments |

**Open Core Model:**
- Basic framework: Open source
- Advanced features: Hosted service
- Self-hosting: Available (MIT license)

---

### Roadmap

**✅ Week 1 (Complete):** Multi-tenancy, auth, audit logs, RLS
**⏳ Week 2:** Redis caching, rate limiting, background jobs
**⏳ Week 3:** Semantic search (embeddings), vector DB, scale testing
**⏳ Month 2:** SDKs, webhooks, integrations, enterprise features

---

### Get Started

**1. Try the Demo:**
Download `demo.html` → Open in browser → Test live API

**2. Get API Access:**
```bash
curl -X POST https://agentmolt-memory.onrender.com/api/memory/store \
  -H "X-API-Key: mb-free-7x9k2m5p8q1" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "your-agent-uuid", "content": "Hello Memory Bridge", "content_type": "conversation"}'
```

**3. Integrate:**
- REST API (any language)
- Webhook support (coming soon)
- SDKs: Python, Node.js (coming soon)

---

### Contact

**GitHub:** github.com/nKOxxx/AgentMolt  
**Demo API:** agentmolt-memory.onrender.com  
**Status:** Live, accepting beta users

---

**Built for the agent economy. Infrastructure that remembers.**
