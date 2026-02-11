// Keep-alive script to prevent Render free tier from sleeping
const https = require('https');

const API_URL = process.env.API_URL || 'memory-bridge.onrender.com';

function ping() {
  const options = {
    hostname: API_URL,
    port: 443,
    path: '/api/health',
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    console.log(`[${new Date().toISOString()}] Ping status: ${res.statusCode}`);
  });

  req.on('error', (e) => {
    console.error(`[${new Date().toISOString()}] Ping error: ${e.message}`);
  });

  req.end();
}

// Ping immediately and exit (cron handles frequency)
ping();
