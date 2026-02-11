<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory Bridge - Demo</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 3rem;
    }
    header h1 {
      font-size: 3rem;
      background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    header p {
      color: #94a3b8;
      font-size: 1.1rem;
    }
    .badge {
      display: inline-block;
      background: #1e293b;
      color: #00d4ff;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      margin-top: 1rem;
      border: 1px solid #00d4ff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 1.5rem;
      border: 1px solid #2d2d44;
    }
    .card h2 {
      font-size: 1.25rem;
      color: #00d4ff;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .input-group {
      margin-bottom: 1rem;
    }
    .input-group label {
      display: block;
      color: #94a3b8;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }
    .input-group input,
    .input-group textarea,
    .input-group select {
      width: 100%;
      padding: 0.75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 0.9rem;
    }
    .input-group input:focus,
    .input-group textarea:focus {
      outline: none;
      border-color: #00d4ff;
    }
    button {
      background: linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      width: 100%;
    }
    button:hover {
      opacity: 0.9;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .result {
      margin-top: 1rem;
      padding: 1rem;
      background: #0f172a;
      border-radius: 8px;
      font-family: 'Monaco', monospace;
      font-size: 0.8rem;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .result.success {
      border-left: 3px solid #22c55e;
    }
    .result.error {
      border-left: 3px solid #ef4444;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 3rem 0;
    }
    .feature {
      background: #1a1a2e;
      padding: 1rem;
      border-radius: 12px;
      text-align: center;
      border: 1px solid #2d2d44;
    }
    .feature-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .feature h3 {
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    .feature p {
      font-size: 0.8rem;
      color: #94a3b8;
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 2rem;
      padding: 1rem;
      background: #1a1a2e;
      border-radius: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .endpoint {
      background: #0f172a;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.8rem;
      color: #00d4ff;
      margin-bottom: 1rem;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧠 Memory Bridge</h1>
      <p>Long-term memory for AI agents. Store, query, and recall agent experiences.</p>
      <span class="badge">FREE TIER MVP</span>
    </header>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">💾</div>
        <h3>Persistent Storage</h3>
        <p>500MB free storage per organization</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔍</div>
        <h3>Smart Search</h3>
        <p>Keyword-based memory retrieval</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>Secure & Isolated</h3>
        <p>Multi-tenant with API key auth</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📊</div>
        <h3>Audit Logging</h3>
        <p>Full traceability of all actions</p>
      </div>
    </div>

    <div class="grid">
      <!-- Store Memory -->
      <div class="card">
        <h2>💾 Store Memory</h2>
        <div class="endpoint">POST /api/memory/store</div>
        <div class="input-group">
          <label>API Key</label>
          <input type="password" id="storeApiKey" placeholder="mb-free-...">
        </div>
        <div class="input-group">
          <label>Agent ID (UUID)</label>
          <input type="text" id="storeAgentId" placeholder="4ee927aa-4899-...">
        </div>
        <div class="input-group">
          <label>Content</label>
          <textarea id="storeContent" rows="3" placeholder="What should I remember?"></textarea>
        </div>
        <div class="input-group">
          <label>Type</label>
          <select id="storeType">
            <option value="conversation">Conversation</option>
            <option value="action">Action</option>
            <option value="insight">Insight</option>
            <option value="error">Error</option>
          </select>
        </div>
        <button onclick="storeMemory()" id="storeBtn">Store Memory</button>
        <div id="storeResult" class="result" style="display:none;"></div>
      </div>

      <!-- Query Memories -->
      <div class="card">
        <h2>🔍 Query Memories</h2>
        <div class="endpoint">GET /api/memory/query</div>
        <div class="input-group">
          <label>API Key</label>
          <input type="password" id="queryApiKey" placeholder="mb-free-...">
        </div>
        <div class="input-group">
          <label>Agent ID (UUID)</label>
          <input type="text" id="queryAgentId" placeholder="4ee927aa-4899-...">
        </div>
        <div class="input-group">
          <label>Search Query</label>
          <input type="text" id="queryText" placeholder="What are you looking for?">
        </div>
        <div class="input-group">
          <label>Limit</label>
          <input type="number" id="queryLimit" value="5" min="1" max="20">
        </div>
        <button onclick="queryMemories()" id="queryBtn">Search Memories</button>
        <div id="queryResult" class="result" style="display:none;"></div>
      </div>

      <!-- View Timeline -->
      <div class="card">
        <h2>📅 View Timeline</h2>
        <div class="endpoint">GET /api/memory/timeline</div>
        <div class="input-group">
          <label>API Key</label>
          <input type="password" id="timelineApiKey" placeholder="mb-free-...">
        </div>
        <div class="input-group">
          <label>Agent ID (UUID)</label>
          <input type="text" id="timelineAgentId" placeholder="4ee927aa-4899-...">
        </div>
        <div class="input-group">
          <label>Days</label>
          <input type="number" id="timelineDays" value="7" min="1" max="30">
        </div>
        <button onclick="viewTimeline()" id="timelineBtn">View Timeline</button>
        <div id="timelineResult" class="result" style="display:none;"></div>
      </div>

      <!-- API Stats -->
      <div class="card">
        <h2>📊 API Health</h2>
        <div class="endpoint">GET /api/health</div>
        <button onclick="checkHealth()" id="healthBtn">Check Status</button>
        <div id="healthResult" class="result" style="display:none;"></div>
        
        <div style="margin-top: 1.5rem;">
          <h3 style="color: #00d4ff; font-size: 0.9rem; margin-bottom: 0.5rem;">Quick Stats</h3>
          <div style="background: #0f172a; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Status:</span>
              <span id="statusText" style="color: #22c55e;">Checking...</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Version:</span>
              <span id="versionText">-</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Latency:</span>
              <span id="latencyText">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="status">
      <div class="status-dot"></div>
      <span>Memory Bridge API is operational</span>
    </div>
  </div>

  <script>
    const API_BASE = window.location.origin;

    async function storeMemory() {
      const btn = document.getElementById('storeBtn');
      const result = document.getElementById('storeResult');
      
      btn.disabled = true;
      btn.textContent = 'Storing...';
      
      const apiKey = document.getElementById('storeApiKey').value;
      const agentId = document.getElementById('storeAgentId').value;
      const content = document.getElementById('storeContent').value;
      const type = document.getElementById('storeType').value;
      
      try {
        const response = await fetch(`${API_BASE}/api/memory/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          },
          body: JSON.stringify({
            agent_id: agentId,
            content: content,
            content_type: type
          })
        });
        
        const data = await response.json();
        result.style.display = 'block';
        result.className = 'result ' + (response.ok ? 'success' : 'error');
        result.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = 'Error: ' + error.message;
      }
      
      btn.disabled = false;
      btn.textContent = 'Store Memory';
    }

    async function queryMemories() {
      const btn = document.getElementById('queryBtn');
      const result = document.getElementById('queryResult');
      
      btn.disabled = true;
      btn.textContent = 'Searching...';
      
      const apiKey = document.getElementById('queryApiKey').value;
      const agentId = document.getElementById('queryAgentId').value;
      const query = document.getElementById('queryText').value;
      const limit = document.getElementById('queryLimit').value;
      
      try {
        const response = await fetch(
          `${API_BASE}/api/memory/query?agent_id=${agentId}&q=${encodeURIComponent(query)}&limit=${limit}`,
          {
            headers: { 'X-API-Key': apiKey }
          }
        );
        
        const data = await response.json();
        result.style.display = 'block';
        result.className = 'result ' + (response.ok ? 'success' : 'error');
        result.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = 'Error: ' + error.message;
      }
      
      btn.disabled = false;
      btn.textContent = 'Search Memories';
    }

    async function viewTimeline() {
      const btn = document.getElementById('timelineBtn');
      const result = document.getElementById('timelineResult');
      
      btn.disabled = true;
      btn.textContent = 'Loading...';
      
      const apiKey = document.getElementById('timelineApiKey').value;
      const agentId = document.getElementById('timelineAgentId').value;
      const days = document.getElementById('timelineDays').value;
      
      try {
        const response = await fetch(
          `${API_BASE}/api/memory/timeline?agent_id=${agentId}&days=${days}`,
          {
            headers: { 'X-API-Key': apiKey }
          }
        );
        
        const data = await response.json();
        result.style.display = 'block';
        result.className = 'result ' + (response.ok ? 'success' : 'error');
        result.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = 'Error: ' + error.message;
      }
      
      btn.disabled = false;
      btn.textContent = 'View Timeline';
    }

    async function checkHealth() {
      const btn = document.getElementById('healthBtn');
      const result = document.getElementById('healthResult');
      
      btn.disabled = true;
      
      const start = Date.now();
      
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        const latency = Date.now() - start;
        
        result.style.display = 'block';
        result.className = 'result success';
        result.textContent = JSON.stringify(data, null, 2);
        
        document.getElementById('statusText').textContent = 'Online';
        document.getElementById('versionText').textContent = data.version;
        document.getElementById('latencyText').textContent = latency + 'ms';
      } catch (error) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = 'Error: ' + error.message;
        document.getElementById('statusText').textContent = 'Offline';
        document.getElementById('statusText').style.color = '#ef4444';
      }
      
      btn.disabled = false;
    }

    // Check health on load
    checkHealth();
  </script>
</body>
</html>
