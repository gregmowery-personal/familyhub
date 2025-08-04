import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { Redis } from 'redis';
import { LRUCache } from 'lru-cache';
import { logAuditEvent } from './utils';

// =============================================
// Type Definitions
// =============================================

export interface RateLimitConfig {
  /** Unique identifier for this rate limit rule */
  id: string;
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum number of requests in the window */
  maxRequests: number;
  /** Initial tokens in bucket (defaults to maxRequests) */
  initialTokens?: number;
  /** Token refill rate (tokens per second) */
  refillRate?: number;
  /** Maximum burst capacity (defaults to maxRequests) */
  burstCapacity?: number;
  /** Whether to enable exponential backoff */
  enableBackoff?: boolean;
  /** Base backoff time in milliseconds */
  baseBackoffMs?: number;
  /** Maximum backoff time in milliseconds */
  maxBackoffMs?: number;
  /** Custom error message */
  errorMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  backoffLevel?: number;
  violationCount?: number;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  backoffLevel: number;
  backoffExpires: number;
  violationCount: number;
  createdAt: number;
}

export interface RateLimitViolation {
  userId: string;
  resourceType: string;
  ruleId: string;
  violationTime: number;
  backoffLevel: number;
  retryAfter: number;
}

// =============================================
// Rate Limiter Implementation
// =============================================

export class RBACRateLimiter {
  private redis: Redis | null = null;
  private localCache: LRUCache<string, TokenBucket>;
  private configs: Map<string, RateLimitConfig> = new Map();
  private redisConnectionPromise: Promise<Redis> | null = null;

  constructor() {
    // Initialize local cache for fallback
    this.localCache = new LRUCache<string, TokenBucket>({
      max: 10000,
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });

    // Initialize Redis connection
    this.initializeRedis();

    // Setup default rate limit configurations
    this.setupDefaultConfigs();
  }

  // =============================================
  // Initialization
  // =============================================

  private async initializeRedis(): Promise<void> {
    if (this.redisConnectionPromise) {
      return;
    }

    this.redisConnectionPromise = this.connectToRedis();
    
    try {
      this.redis = await this.redisConnectionPromise;
    } catch (error) {
      console.error('Failed to initialize Redis for rate limiting:', error);
      console.warn('Rate limiter will use local cache only (not recommended for production)');
      this.redis = null;
    }
  }

  private async connectToRedis(): Promise<Redis> {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
    
    if (!redisUrl) {
      throw new Error('Redis connection string not found in environment variables');
    }

    const redis = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    });

    await redis.connect();
    
    redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    return redis;
  }

  private setupDefaultConfigs(): void {
    // Permission check limits - per user per resource type
    this.addConfig({
      id: 'rbac:permission_check',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200,
      refillRate: 3.33, // ~200 tokens per minute
      enableBackoff: true,
      baseBackoffMs: 1000,
      maxBackoffMs: 300000, // 5 minutes
      errorMessage: 'Too many permission checks. Please slow down.'
    });

    // Role assignment limits - per admin user
    this.addConfig({
      id: 'rbac:role_assignment',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      refillRate: 0.17, // ~10 tokens per minute
      enableBackoff: true,
      baseBackoffMs: 2000,
      maxBackoffMs: 600000, // 10 minutes
      errorMessage: 'Too many role assignments. Please wait before trying again.'
    });

    // Delegation creation limits - per user
    this.addConfig({
      id: 'rbac:delegation',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
      refillRate: 0.083, // ~5 tokens per minute
      enableBackoff: true,
      baseBackoffMs: 5000,
      maxBackoffMs: 900000, // 15 minutes
      errorMessage: 'Too many delegation requests. Please wait before creating more.'
    });

    // Emergency override limits - per user (very restrictive)
    this.addConfig({
      id: 'rbac:emergency_override',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      refillRate: 0.00083, // ~3 tokens per hour
      enableBackoff: true,
      baseBackoffMs: 60000, // 1 minute
      maxBackoffMs: 3600000, // 1 hour
      errorMessage: 'Emergency override limit exceeded. Contact system administrator.'
    });

    // Global API limits - per user across all RBAC operations
    this.addConfig({
      id: 'rbac:global',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 300,
      refillRate: 5, // ~300 tokens per minute
      enableBackoff: true,
      baseBackoffMs: 500,
      maxBackoffMs: 120000, // 2 minutes
      errorMessage: 'Global rate limit exceeded. Please slow down your requests.'
    });

    // Admin operations - higher limits for admin users
    this.addConfig({
      id: 'rbac:admin',
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      refillRate: 1.67, // ~100 tokens per minute
      enableBackoff: true,
      baseBackoffMs: 1000,
      maxBackoffMs: 300000, // 5 minutes
      errorMessage: 'Admin operation rate limit exceeded.'
    });

    // Resource-specific limits
    this.addConfig({
      id: 'rbac:resource:user',
      windowMs: 60 * 1000,
      maxRequests: 150,
      refillRate: 2.5,
      enableBackoff: true,
      baseBackoffMs: 1000,
      maxBackoffMs: 180000
    });

    this.addConfig({
      id: 'rbac:resource:family',
      windowMs: 60 * 1000,
      maxRequests: 100,
      refillRate: 1.67,
      enableBackoff: true,
      baseBackoffMs: 1500,
      maxBackoffMs: 240000
    });

    this.addConfig({
      id: 'rbac:resource:sensitive',
      windowMs: 60 * 1000,
      maxRequests: 50,
      refillRate: 0.83,
      enableBackoff: true,
      baseBackoffMs: 2000,
      maxBackoffMs: 600000
    });
  }

  // =============================================
  // Configuration Management
  // =============================================

  public addConfig(config: RateLimitConfig): void {
    // Set defaults
    const fullConfig: RateLimitConfig = {
      initialTokens: config.maxRequests,
      refillRate: config.maxRequests / (config.windowMs / 1000),
      burstCapacity: config.maxRequests,
      enableBackoff: true,
      baseBackoffMs: 1000,
      maxBackoffMs: 60000,
      ...config
    };

    this.configs.set(config.id, fullConfig);
  }

  public getConfig(ruleId: string): RateLimitConfig | undefined {
    return this.configs.get(ruleId);
  }

  public updateConfig(ruleId: string, updates: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(ruleId);
    if (existing) {
      this.configs.set(ruleId, { ...existing, ...updates });
    }
  }

  // =============================================
  // Core Rate Limiting Logic
  // =============================================

  public async checkLimit(
    userId: string,
    resourceType: string,
    ruleId?: string
  ): Promise<RateLimitResult> {
    try {
      const effectiveRuleId = ruleId || this.selectRuleId(resourceType);
      const config = this.configs.get(effectiveRuleId);

      if (!config) {
        console.warn(`Rate limit config not found for rule: ${effectiveRuleId}`);
        return this.allowResult(0, 0);
      }

      const bucketKey = this.getBucketKey(userId, resourceType, effectiveRuleId);
      const bucket = await this.getTokenBucket(bucketKey, config);

      // Check if user is in backoff period
      const now = Date.now();
      if (bucket.backoffExpires > now) {
        const retryAfter = Math.ceil((bucket.backoffExpires - now) / 1000);
        return this.denyResult(config, bucket, retryAfter);
      }

      // Refill tokens based on elapsed time
      this.refillTokens(bucket, config, now);

      // Check if request is allowed
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        await this.saveTokenBucket(bucketKey, bucket);
        
        return {
          allowed: true,
          limit: config.maxRequests,
          remaining: Math.floor(bucket.tokens),
          resetTime: Math.floor((now + config.windowMs) / 1000)
        };
      }

      // Request denied - apply backoff if enabled
      if (config.enableBackoff) {
        bucket.violationCount += 1;
        bucket.backoffLevel = Math.min(bucket.backoffLevel + 1, 10); // Max 10 levels

        const backoffMs = Math.min(
          config.baseBackoffMs! * Math.pow(2, bucket.backoffLevel - 1),
          config.maxBackoffMs!
        );

        bucket.backoffExpires = now + backoffMs;
        
        // Log violation for monitoring
        await this.logRateLimitViolation(userId, resourceType, effectiveRuleId, bucket);
      }

      await this.saveTokenBucket(bucketKey, bucket);

      const retryAfter = config.enableBackoff 
        ? Math.ceil((bucket.backoffExpires - now) / 1000)
        : Math.ceil(config.windowMs / 1000);

      return this.denyResult(config, bucket, retryAfter);

    } catch (error) {
      console.error('Error in rate limit check:', error);
      // On error, allow the request but log the issue
      await this.logError('rate_limit_check_error', error, { userId, resourceType, ruleId });
      return this.allowResult(0, 0);
    }
  }

  private selectRuleId(resourceType: string): string {
    // Select appropriate rule based on resource type
    const resourceRuleId = `rbac:resource:${resourceType}`;
    if (this.configs.has(resourceRuleId)) {
      return resourceRuleId;
    }

    // Check for sensitive resources
    const sensitiveResources = ['medical', 'financial', 'legal', 'emergency'];
    if (sensitiveResources.includes(resourceType)) {
      return 'rbac:resource:sensitive';
    }

    // Default to permission check limits
    return 'rbac:permission_check';
  }

  private refillTokens(bucket: TokenBucket, config: RateLimitConfig, now: number): void {
    const timeSinceLastRefill = now - bucket.lastRefill;
    const tokensToAdd = (timeSinceLastRefill / 1000) * config.refillRate!;
    
    bucket.tokens = Math.min(
      bucket.tokens + tokensToAdd,
      config.burstCapacity!
    );
    bucket.lastRefill = now;
  }

  // =============================================
  // Token Bucket Management
  // =============================================

  private async getTokenBucket(key: string, config: RateLimitConfig): Promise<TokenBucket> {
    try {
      // Try Redis first
      if (this.redis) {
        const data = await this.redis.get(key);
        if (data) {
          const bucket = JSON.parse(data) as TokenBucket;
          return bucket;
        }
      }

      // Fallback to local cache
      const cached = this.localCache.get(key);
      if (cached) {
        return cached;
      }

      // Create new bucket
      const now = Date.now();
      return {
        tokens: config.initialTokens!,
        lastRefill: now,
        backoffLevel: 0,
        backoffExpires: 0,
        violationCount: 0,
        createdAt: now
      };

    } catch (error) {
      console.error('Error getting token bucket:', error);
      // Return new bucket on error
      const now = Date.now();
      return {
        tokens: config.initialTokens!,
        lastRefill: now,
        backoffLevel: 0,
        backoffExpires: 0,
        violationCount: 0,
        createdAt: now
      };
    }
  }

  private async saveTokenBucket(key: string, bucket: TokenBucket): Promise<void> {
    try {
      const data = JSON.stringify(bucket);
      const ttl = 24 * 60 * 60; // 24 hours

      // Save to Redis if available
      if (this.redis) {
        await this.redis.setex(key, ttl, data);
      }

      // Always save to local cache as backup
      this.localCache.set(key, bucket);

    } catch (error) {
      console.error('Error saving token bucket:', error);
      // At least save to local cache
      this.localCache.set(key, bucket);
    }
  }

  private getBucketKey(userId: string, resourceType: string, ruleId: string): string {
    return `rbac:bucket:${ruleId}:${userId}:${resourceType}`;
  }

  // =============================================
  // Specialized Rate Limiting Methods
  // =============================================

  public async checkPermissionLimit(userId: string, resourceType: string): Promise<RateLimitResult> {
    return this.checkLimit(userId, resourceType, 'rbac:permission_check');
  }

  public async checkRoleAssignmentLimit(adminUserId: string): Promise<RateLimitResult> {
    return this.checkLimit(adminUserId, 'role_assignment', 'rbac:role_assignment');
  }

  public async checkDelegationLimit(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(userId, 'delegation', 'rbac:delegation');
  }

  public async checkEmergencyOverrideLimit(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(userId, 'emergency_override', 'rbac:emergency_override');
  }

  public async checkGlobalLimit(userId: string): Promise<RateLimitResult> {
    return this.checkLimit(userId, 'global', 'rbac:global');
  }

  public async checkAdminLimit(adminUserId: string, operation: string): Promise<RateLimitResult> {
    return this.checkLimit(adminUserId, operation, 'rbac:admin');
  }

  // =============================================
  // Multiple Rate Limit Checks
  // =============================================

  public async checkMultipleLimits(
    userId: string,
    resourceType: string,
    checks: Array<{ ruleId: string; required?: boolean }>
  ): Promise<{ allowed: boolean; results: Map<string, RateLimitResult>; failedChecks: string[] }> {
    const results = new Map<string, RateLimitResult>();
    const failedChecks: string[] = [];
    let overallAllowed = true;

    for (const check of checks) {
      const result = await this.checkLimit(userId, resourceType, check.ruleId);
      results.set(check.ruleId, result);

      if (!result.allowed) {
        failedChecks.push(check.ruleId);
        if (check.required !== false) { // Default to required
          overallAllowed = false;
        }
      }
    }

    return {
      allowed: overallAllowed,
      results,
      failedChecks
    };
  }

  // =============================================
  // Backoff and Penalty Management
  // =============================================

  public async clearBackoff(userId: string, resourceType: string, ruleId?: string): Promise<void> {
    try {
      const effectiveRuleId = ruleId || this.selectRuleId(resourceType);
      const bucketKey = this.getBucketKey(userId, resourceType, effectiveRuleId);
      
      const config = this.configs.get(effectiveRuleId);
      if (!config) return;

      const bucket = await this.getTokenBucket(bucketKey, config);
      
      // Reset backoff
      bucket.backoffLevel = 0;
      bucket.backoffExpires = 0;
      bucket.violationCount = 0;
      
      await this.saveTokenBucket(bucketKey, bucket);

    } catch (error) {
      console.error('Error clearing backoff:', error);
    }
  }

  public async resetUserLimits(userId: string): Promise<void> {
    try {
      // Clear all rate limits for a user (useful for admin reset)
      const pattern = `rbac:bucket:*:${userId}:*`;
      
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear from local cache
      for (const [key] of this.localCache.entries()) {
        if (key.includes(`:${userId}:`)) {
          this.localCache.delete(key);
        }
      }

      await this.logAuditEvent('rate_limit_reset', userId, {
        action: 'reset_user_limits',
        targetUserId: userId
      });

    } catch (error) {
      console.error('Error resetting user limits:', error);
    }
  }

  // =============================================
  // Monitoring and Analytics
  // =============================================

  public async getRateLimitStatus(
    userId: string,
    resourceType: string,
    ruleId?: string
  ): Promise<{
    limit: number;
    remaining: number;
    resetTime: number;
    backoffActive: boolean;
    backoffLevel: number;
    violationCount: number;
    retryAfter?: number;
  }> {
    try {
      const effectiveRuleId = ruleId || this.selectRuleId(resourceType);
      const config = this.configs.get(effectiveRuleId);
      
      if (!config) {
        return {
          limit: 0,
          remaining: 0,
          resetTime: 0,
          backoffActive: false,
          backoffLevel: 0,
          violationCount: 0
        };
      }

      const bucketKey = this.getBucketKey(userId, resourceType, effectiveRuleId);
      const bucket = await this.getTokenBucket(bucketKey, config);
      const now = Date.now();

      // Simulate refill to get current token count
      const timeSinceLastRefill = now - bucket.lastRefill;
      const tokensToAdd = (timeSinceLastRefill / 1000) * config.refillRate!;
      const currentTokens = Math.min(
        bucket.tokens + tokensToAdd,
        config.burstCapacity!
      );

      const backoffActive = bucket.backoffExpires > now;
      
      return {
        limit: config.maxRequests,
        remaining: Math.floor(currentTokens),
        resetTime: Math.floor((now + config.windowMs) / 1000),
        backoffActive,
        backoffLevel: bucket.backoffLevel,
        violationCount: bucket.violationCount,
        retryAfter: backoffActive ? Math.ceil((bucket.backoffExpires - now) / 1000) : undefined
      };

    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {
        limit: 0,
        remaining: 0,
        resetTime: 0,
        backoffActive: false,
        backoffLevel: 0,
        violationCount: 0
      };
    }
  }

  public async getViolationHistory(
    userId: string,
    timeWindowMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<RateLimitViolation[]> {
    try {
      const supabase = await createServerClient();
      const since = new Date(Date.now() - timeWindowMs);

      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('actor_user_id', userId)
        .eq('event_type', 'rate_limit_violation')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching violation history:', error);
        return [];
      }

      return (data || []).map(event => ({
        userId,
        resourceType: event.event_data?.resourceType || 'unknown',
        ruleId: event.event_data?.ruleId || 'unknown',
        violationTime: new Date(event.created_at).getTime(),
        backoffLevel: event.event_data?.backoffLevel || 0,
        retryAfter: event.event_data?.retryAfter || 0
      }));

    } catch (error) {
      console.error('Error getting violation history:', error);
      return [];
    }
  }

  // =============================================
  // Utility Methods
  // =============================================

  private allowResult(limit: number, remaining: number): RateLimitResult {
    return {
      allowed: true,
      limit,
      remaining,
      resetTime: Math.floor((Date.now() + 60000) / 1000) // Default 1 minute
    };
  }

  private denyResult(config: RateLimitConfig, bucket: TokenBucket, retryAfter: number): RateLimitResult {
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: Math.floor((Date.now() + config.windowMs) / 1000),
      retryAfter,
      backoffLevel: bucket.backoffLevel,
      violationCount: bucket.violationCount
    };
  }

  // =============================================
  // Logging and Monitoring
  // =============================================

  private async logRateLimitViolation(
    userId: string,
    resourceType: string,
    ruleId: string,
    bucket: TokenBucket
  ): Promise<void> {
    try {
      await this.logAuditEvent('rate_limit_violation', userId, {
        resourceType,
        ruleId,
        backoffLevel: bucket.backoffLevel,
        violationCount: bucket.violationCount,
        retryAfter: Math.ceil((bucket.backoffExpires - Date.now()) / 1000)
      });
    } catch (error) {
      console.error('Error logging rate limit violation:', error);
    }
  }

  private async logAuditEvent(eventType: string, userId: string, data: any): Promise<void> {
    try {
      await logAuditEvent(
        eventType,
        'rate_limiting',
        `Rate limit event: ${eventType}`,
        {
          actorUserId: userId,
          eventData: data,
          severity: eventType.includes('violation') ? 'medium' : 'low'
        }
      );
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  private async logError(errorType: string, error: any, context: any): Promise<void> {
    try {
      await logAuditEvent(
        errorType,
        'system',
        `Rate limiter error: ${errorType}`,
        {
          eventData: {
            error: error instanceof Error ? error.message : String(error),
            context
          },
          severity: 'high'
        }
      );
    } catch (auditError) {
      console.error('Error logging rate limiter error:', auditError);
    }
  }

  // =============================================
  // Health Check and Maintenance
  // =============================================

  public async healthCheck(): Promise<{
    redis: boolean;
    localCache: boolean;
    configCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let redisHealthy = false;

    // Check Redis connection
    try {
      if (this.redis) {
        await this.redis.ping();
        redisHealthy = true;
      }
    } catch (error) {
      errors.push(`Redis connection failed: ${error}`);
    }

    // Check local cache
    const localCacheHealthy = this.localCache.size >= 0; // Simple check

    return {
      redis: redisHealthy,
      localCache: localCacheHealthy,
      configCount: this.configs.size,
      errors
    };
  }

  public async cleanup(): Promise<void> {
    try {
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }

      // Clear local cache
      this.localCache.clear();

    } catch (error) {
      console.error('Error during rate limiter cleanup:', error);
    }
  }

  // =============================================
  // Static Factory Methods
  // =============================================

  public static create(): RBACRateLimiter {
    return new RBACRateLimiter();
  }
}

// =============================================
// Rate Limit Error Class
// =============================================

export class RateLimitError extends Error {
  public readonly code = 'RATE_LIMIT_EXCEEDED';
  public readonly statusCode = 429;
  public readonly retryAfter: number;
  public readonly limit: number;
  public readonly remaining: number;

  constructor(
    message: string,
    retryAfter: number,
    limit: number,
    remaining: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryAfter: this.retryAfter,
      limit: this.limit,
      remaining: this.remaining
    };
  }
}

// =============================================
// Singleton Instance and Helper Functions
// =============================================

let rateLimiterInstance: RBACRateLimiter | null = null;

export function getRateLimiter(): RBACRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RBACRateLimiter();
  }
  return rateLimiterInstance;
}

// =============================================
// Convenience Functions
// =============================================

export async function checkRateLimit(
  userId: string,
  resourceType: string,
  ruleId?: string
): Promise<RateLimitResult> {
  const limiter = getRateLimiter();
  return limiter.checkLimit(userId, resourceType, ruleId);
}

export async function enforceRateLimit(
  userId: string,
  resourceType: string,
  ruleId?: string
): Promise<void> {
  const result = await checkRateLimit(userId, resourceType, ruleId);
  
  if (!result.allowed) {
    const config = getRateLimiter().getConfig(ruleId || 'rbac:permission_check');
    const message = config?.errorMessage || 'Rate limit exceeded. Please try again later.';
    
    throw new RateLimitError(
      message,
      result.retryAfter || 60,
      result.limit,
      result.remaining
    );
  }
}

export async function checkPermissionRateLimit(userId: string, resourceType: string): Promise<RateLimitResult> {
  const limiter = getRateLimiter();
  return limiter.checkPermissionLimit(userId, resourceType);
}

export async function enforcePermissionRateLimit(userId: string, resourceType: string): Promise<void> {
  const result = await checkPermissionRateLimit(userId, resourceType);
  
  if (!result.allowed) {
    throw new RateLimitError(
      'Too many permission checks. Please slow down.',
      result.retryAfter || 60,
      result.limit,
      result.remaining
    );
  }
}