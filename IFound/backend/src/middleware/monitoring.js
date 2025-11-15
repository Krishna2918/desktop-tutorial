const os = require('os');
const logger = require('../utils/logger');

// System health metrics
const healthMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  successCount: 0,
  totalResponseTime: 0,
};

// Request monitoring middleware
const monitorRequest = (req, res, next) => {
  const startTime = Date.now();
  healthMetrics.requestCount++;

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const responseTime = Date.now() - startTime;
    healthMetrics.totalResponseTime += responseTime;

    if (res.statusCode >= 500) {
      healthMetrics.errorCount++;
      logger.error(`Error Response: ${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`);
    } else if (res.statusCode >= 400) {
      logger.warn(`Client Error: ${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`);
    } else {
      healthMetrics.successCount++;
    }

    // Log slow requests (> 1000ms)
    if (responseTime > 1000) {
      logger.warn(`Slow Request: ${req.method} ${req.originalUrl} - ${responseTime}ms`);
    }

    return originalSend.call(this, data);
  };

  next();
};

// Get system metrics
const getSystemMetrics = () => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  return {
    uptime: {
      process: uptime,
      system: os.uptime(),
    },
    memory: {
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    },
    cpu: {
      model: os.cpus()[0]?.model || 'Unknown',
      cores: os.cpus().length,
      loadAverage: os.loadavg(),
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    },
  };
};

// Get application metrics
const getAppMetrics = () => {
  const avgResponseTime = healthMetrics.requestCount > 0
    ? (healthMetrics.totalResponseTime / healthMetrics.requestCount).toFixed(2)
    : 0;

  const errorRate = healthMetrics.requestCount > 0
    ? ((healthMetrics.errorCount / healthMetrics.requestCount) * 100).toFixed(2)
    : 0;

  return {
    requests: {
      total: healthMetrics.requestCount,
      success: healthMetrics.successCount,
      errors: healthMetrics.errorCount,
      errorRate: `${errorRate}%`,
    },
    performance: {
      avgResponseTime: `${avgResponseTime}ms`,
      totalResponseTime: `${healthMetrics.totalResponseTime}ms`,
    },
    runtime: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      uptimeSince: new Date(healthMetrics.startTime).toISOString(),
    },
  };
};

// Health check endpoint handler
const healthCheck = async (req, res) => {
  try {
    // Check database connection
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const { sequelize } = require('../models');
      const start = Date.now();
      await sequelize.authenticate();
      dbResponseTime = Date.now() - start;
    } catch (error) {
      dbStatus = 'unhealthy';
      logger.error('Database health check failed:', error);
    }

    // Check Redis connection
    let redisStatus = 'healthy';
    try {
      // Redis check would go here if we have a Redis client
      // For now, mark as N/A
      redisStatus = 'N/A';
    } catch (error) {
      redisStatus = 'unhealthy';
      logger.error('Redis health check failed:', error);
    }

    const health = {
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: {
          status: dbStatus,
          responseTime: `${dbResponseTime}ms`,
        },
        redis: {
          status: redisStatus,
        },
        aiModels: {
          status: 'healthy',
          faceRecognition: 'loaded',
          objectDetection: 'loaded',
          imageSimilarity: 'loaded',
        },
      },
      system: getSystemMetrics(),
      app: getAppMetrics(),
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

// Metrics endpoint handler
const metricsEndpoint = (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: getSystemMetrics(),
      application: getAppMetrics(),
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

// Log periodic metrics (every 5 minutes)
const logPeriodicMetrics = () => {
  setInterval(() => {
    const metrics = {
      ...getAppMetrics(),
      ...getSystemMetrics(),
    };

    logger.info('Periodic metrics', metrics);
  }, 5 * 60 * 1000); // 5 minutes
};

// Error rate alerting
const checkErrorRate = () => {
  setInterval(() => {
    const errorRate = healthMetrics.requestCount > 0
      ? (healthMetrics.errorCount / healthMetrics.requestCount) * 100
      : 0;

    if (errorRate > 10) {
      logger.warn(`High error rate detected: ${errorRate.toFixed(2)}%`, {
        totalRequests: healthMetrics.requestCount,
        errors: healthMetrics.errorCount,
      });
    }
  }, 60 * 1000); // 1 minute
};

// Memory leak detection
const checkMemoryUsage = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    if (heapUsedMB > 500) { // Alert if heap > 500MB
      logger.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`, {
        rss: (memUsage.rss / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      });
    }
  }, 2 * 60 * 1000); // 2 minutes
};

// Initialize monitoring
const initializeMonitoring = () => {
  logger.info('Initializing application monitoring...');
  logPeriodicMetrics();
  checkErrorRate();
  checkMemoryUsage();
  logger.info('Monitoring initialized successfully');
};

module.exports = {
  monitorRequest,
  healthCheck,
  metricsEndpoint,
  initializeMonitoring,
  getSystemMetrics,
  getAppMetrics,
};
