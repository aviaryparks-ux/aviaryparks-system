// lib/rate-limit.ts
// Simple in-memory rate limiter for API protection
// For production, consider using Redis-based rate limiting (e.g., @upstash/ratelimit)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

// In-memory store for rate limiting (resets on server restart)
// In production with multiple server instances, use Redis instead
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Get client identifier (IP address or custom identifier)
 * In Vercel/Edge, use x-forwarded-for or x-real-ip
 */
export function getClientIdentifier(request: Request | Request): string {
  // For Next.js Request object
  const headers = request.headers;

  // Try to get real IP from various headers
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare

  let ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0]?.trim();

  if (!ip) {
    // Fallback: use a hash of user-agent as fallback identifier
    const userAgent = headers.get('user-agent') || 'unknown';
    return `ua-${simpleHash(userAgent)}`;
  }

  return `ip-${simpleHash(ip)}`;
}

/**
 * Simple hash function for creating consistent identifiers
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check rate limit and return result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;

  let entry = rateLimitStore.get(key);

  // If no entry or entry has expired, create new one
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  return {
    allowed: entry.count <= config.maxRequests,
    remaining,
    resetIn,
  };
}

/**
 * Create rate limit headers
 */
export function createRateLimitHeaders(result: { remaining: number; resetIn: number }) {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  };
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const RateLimitConfigs = {
  // Strict: 5 requests per minute (for sensitive operations like login)
  strict: { windowMs: 60000, maxRequests: 5 },

  // Normal: 10 requests per minute (for general API calls)
  normal: { windowMs: 60000, maxRequests: 10 },

  // Relaxed: 30 requests per minute (for data fetching)
  relaxed: { windowMs: 60000, maxRequests: 30 },

  // API: 100 requests per minute (for authenticated API calls)
  api: { windowMs: 60000, maxRequests: 100 },
} as const;
