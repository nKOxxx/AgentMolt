export default function Home() {
  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <header style={styles.header}>
          <h1 style={styles.title}>🧠 Memory Bridge</h1>
          <p style={styles.subtitle}>Long-term memory for AI agents. Store, query, and recall agent experiences.</p>
          <span style={styles.badge}>FREE TIER MVP</span>
        </header>

        <div style={styles.features}>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>💾</div>
            <h3 style={styles.featureTitle}>Persistent Storage</h3>
            <p style={styles.featureText}>500MB free storage per organization</p>
          </div>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>🔍</div>
            <h3 style={styles.featureTitle}>Smart Search</h3>
            <p style={styles.featureText}>Keyword-based memory retrieval</p>
          </div>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>🔒</div>
            <h3 style={styles.featureTitle}>Secure & Isolated</h3>
            <p style={styles.featureText}>Multi-tenant with API key auth</p>
          </div>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>📊</div>
            <h3 style={styles.featureTitle}>Audit Logging</h3>
            <p style={styles.featureText}>Full traceability of all actions</p>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📚 API Endpoints</h2>
            <div style={styles.endpoint}>
              <span style={styles.method}>POST</span>
              <span style={styles.path}>/api/memory/store</span>
            </div>
            <div style={styles.endpoint}>
              <span style={styles.method}>GET</span>
              <span style={styles.path}>/api/memory/query</span>
            </div>
            <div style={styles.endpoint}>
              <span style={styles.method}>GET</span>
              <span style={styles.path}>/api/memory/timeline</span>
            </div>
            <div style={styles.endpoint}>
              <span style={styles.method}>GET</span>
              <span style={styles.path}>/api/health</span>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>🚀 Quick Start</h2>
            <pre style={styles.code}>{`curl -X POST https://agentmolt-memory.onrender.com/api/memory/store \\
  -H "X-API-Key: mb-free-..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "...",
    "content": "Memory content",
    "content_type": "conversation"
  }'`}</pre>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>✅ Status</h2>
            <div style={styles.status}>
              <div style={styles.statusDot}></div>
              <span>API is operational</span>
            </div>
            <p style={styles.version}>Version: 1.1.0-free</p>
            <p style={styles.version}>Multi-tenancy: Enabled</p>
            <p style={styles.version}>RLS: Active</p>
          </div>
        </div>

        <div style={styles.footer}>
          <p>Built for the AgentMolt ecosystem • Open core model</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#0a0a0f',
    color: '#e2e8f0',
    minHeight: '100vh',
    padding: '2rem'
  },
  inner: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '3rem'
  },
  title: {
    fontSize: '3rem',
    background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1.1rem'
  },
  badge: {
    display: 'inline-block',
    background: '#1e293b',
    color: '#00d4ff',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    marginTop: '1rem',
    border: '1px solid #00d4ff'
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    margin: '3rem 0'
  },
  feature: {
    background: '#1a1a2e',
    padding: '1.5rem',
    borderRadius: '12px',
    textAlign: 'center',
    border: '1px solid #2d2d44'
  },
  featureIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem'
  },
  featureTitle: {
    fontSize: '1rem',
    marginBottom: '0.25rem',
    color: '#e2e8f0'
  },
  featureText: {
    fontSize: '0.85rem',
    color: '#94a3b8'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1.5rem'
  },
  card: {
    background: '#1a1a2e',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid #2d2d44'
  },
  cardTitle: {
    fontSize: '1.25rem',
    color: '#00d4ff',
    marginBottom: '1rem'
  },
  endpoint: {
    background: '#0f172a',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '0.5rem',
    fontFamily: 'monospace',
    fontSize: '0.85rem'
  },
  method: {
    color: '#22c55e',
    marginRight: '0.5rem'
  },
  path: {
    color: '#e2e8f0'
  },
  code: {
    background: '#0f172a',
    padding: '1rem',
    borderRadius: '8px',
    fontSize: '0.75rem',
    overflowX: 'auto',
    color: '#94a3b8'
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#22c55e'
  },
  version: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    margin: '0.25rem 0'
  },
  footer: {
    textAlign: 'center',
    marginTop: '3rem',
    padding: '2rem',
    color: '#64748b',
    borderTop: '1px solid #1e293b'
  }
};
