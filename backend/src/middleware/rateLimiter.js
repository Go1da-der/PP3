const { RateLimiterMemory } = require('rate-limiter-flexible');
const logger = require('../utils/logger');

// Create rate limiters
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds
});

const authRateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 5, // Number of requests
  duration: 900, // Per 15 minutes
  blockDuration: 900, // Block for 15 minutes
});

const createNotificationRateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.user?.id || req.ip,
  points: 10, // Number of notifications
  duration: 60, // Per 60 seconds
  blockDuration: 60, // Block for 60 seconds
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    // Use different limiters for different routes
    let limiter = rateLimiter;
    
    if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
      limiter = authRateLimiter;
    } else if (req.path.includes('/notifications') && req.method === 'POST') {
      limiter = createNotificationRateLimiter;
    }

    await limiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    
    res.set('Retry-After', String(secs));
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: secs
    });
  }
};

module.exports = rateLimiterMiddleware;
