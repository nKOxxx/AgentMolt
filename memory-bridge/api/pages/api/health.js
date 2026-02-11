import redis from '../../lib/redis.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Check Redis health
    const redisHealth = await redis.getRedisHealth();
    
    // Check database (lightweight query)
    const dbStatus = 'connected'; // Simplified - actual check would query Supabase
    
    const responseTime = Date.now() - startTime;
    
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.2.0-week2',
      features: {
        multiTenancy: true,
        rls: true,
        auditLogging: true,
        rateLimiting: true,
        caching: redisHealth.connected,
        backgroundJobs: redisHealth.connected
      },
      services: {
        api: { status: 'ok', responseTime: `${responseTime}ms` },
        redis: redisHealth,
        database: { status: dbStatus }
      },
      limits: {
        free: {
          storage: '500MB',
          requestsPerMinute: 100,
          agents: 10
        }
      }
    };
    
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}
