import { LRUCache } from 'lru-cache'
import { createClient } from 'redis'
import type { RedisClientType } from 'redis'
import { AuthorizationResult, CacheInvalidationTrigger } from './authorization-service'
import { getOptimalCacheConfig, logCacheConfig, getCacheConfigSummary } from './cache-config'

// =============================================
// Cache Configuration and Types
// =============================================

export interface CachedPermission {
  result: AuthorizationResult;
  timestamp: number;
  ttl: number;
  version: number;
  checksum?: string; // For data integrity verification
}

export interface CacheMetrics {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Size: number;
  l2Size: number;
  invalidations: number;
  errors: number;
  lastReset: number;
}

export interface CacheConfig {
  // L1 Cache (Local LRU)
  l1MaxEntries: number;
  l1TtlMs: number;
  l1UpdateAgeOnGet: boolean;

  // L2 Cache (Redis)
  redisUrl?: string;
  redisKeyPrefix: string;
  redisDefaultTtlSeconds: number;
  redisConnectionTimeout: number;
  redisRetryAttempts: number;

  // Cache versioning
  cacheVersionKey: string;
  enableVersioning: boolean;

  // Performance tuning
  enableChecksums: boolean;
  compressionThreshold: number;
  batchInvalidationSize: number;
  metricsCollectionInterval: number;
}

export interface InvalidationPattern {
  type: 'user' | 'role' | 'resource' | 'global';
  pattern: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// =============================================
// Enhanced Permission Cache Implementation
// =============================================

export class PermissionCache {
  private l1Cache: LRUCache<string, CachedPermission>;
  private l2Cache: RedisClientType | null = null;
  private config: CacheConfig;
  private cacheVersion: number = 1;
  private metrics: CacheMetrics;
  private isRedisConnected: boolean = false;
  private metricsTimer: NodeJS.Timeout | null = null;
  private invalidationQueue: Set<string> = new Set();

  constructor(config?: Partial<CacheConfig>) {
    // Get optimal configuration from environment or use provided config
    const optimalConfig = config ? { ...getOptimalCacheConfig(), ...config } : getOptimalCacheConfig();
    this.config = optimalConfig as CacheConfig;

    // Log configuration in development mode
    if (process.env.NODE_ENV === 'development') {
      logCacheConfig(this.config);
    }

    this.initializeL1Cache();
    this.initializeMetrics();
    this.initializeL2Cache().catch(err => {
      console.error('Failed to initialize Redis cache:', err);
    });
    this.startMetricsCollection();
  }

  // =============================================
  // Cache Initialization
  // =============================================

  private initializeL1Cache(): void {
    this.l1Cache = new LRUCache({
      max: this.config.l1MaxEntries,
      ttl: this.config.l1TtlMs,
      updateAgeOnGet: this.config.l1UpdateAgeOnGet,
      // Dispose function to track evictions
      dispose: (value: CachedPermission, key: string) => {
        this.metrics.l1Size = this.l1Cache.size;
      }
    });
  }

  private async initializeL2Cache(): Promise<void> {
    if (!this.config.redisUrl) {
      console.warn('Redis URL not configured, L2 cache disabled');
      return;
    }

    try {
      this.l2Cache = createClient({
        url: this.config.redisUrl,
        socket: {
          connectTimeout: this.config.redisConnectionTimeout,
          reconnectStrategy: (retries: number) => {
            if (retries > this.config.redisRetryAttempts) {
              return new Error('Redis connection failed after max retries');
            }
            return Math.min(retries * 50, 500);
          }
        }
      });

      this.l2Cache.on('connect', () => {
        console.log('Redis cache connected');
        this.isRedisConnected = true;
      });

      this.l2Cache.on('disconnect', () => {
        console.warn('Redis cache disconnected');
        this.isRedisConnected = false;
      });

      this.l2Cache.on('error', (err) => {
        console.error('Redis cache error:', err);
        this.metrics.errors++;
        this.isRedisConnected = false;
      });

      await this.l2Cache.connect();

      // Initialize cache version if versioning is enabled
      if (this.config.enableVersioning) {
        await this.initializeCacheVersion();
      }
    } catch (error) {
      console.error('Failed to initialize Redis cache:', error);
      this.l2Cache = null;
      this.isRedisConnected = false;
    }
  }

  private async initializeCacheVersion(): Promise<void> {
    if (!this.l2Cache || !this.isRedisConnected) return;

    try {
      const version = await this.l2Cache.get(this.config.cacheVersionKey);
      if (version) {
        this.cacheVersion = parseInt(version, 10) || 1;
      } else {
        await this.l2Cache.set(this.config.cacheVersionKey, this.cacheVersion.toString());
      }
    } catch (error) {
      console.error('Failed to initialize cache version:', error);
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      l1Size: 0,
      l2Size: 0,
      invalidations: 0,
      errors: 0,
      lastReset: Date.now()
    };
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.metricsCollectionInterval);
  }

  // =============================================
  // Core Cache Operations
  // =============================================

  /**
   * Get cached permission with two-level cache strategy
   */
  async get(key: string): Promise<CachedPermission | null> {
    const startTime = performance.now();
    
    try {
      // L1 Cache check (local LRU)
      const l1Result = this.l1Cache.get(key);
      if (l1Result && !this.isExpired(l1Result)) {
        this.metrics.l1Hits++;
        return l1Result;
      }
      this.metrics.l1Misses++;

      // L2 Cache check (Redis)
      if (this.l2Cache && this.isRedisConnected) {
        const l2Result = await this.getFromL2Cache(key);
        if (l2Result && !this.isExpired(l2Result)) {
          this.metrics.l2Hits++;
          // Populate L1 cache
          this.l1Cache.set(key, l2Result);
          return l2Result;
        }
        this.metrics.l2Misses++;
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.errors++;
      return null;
    } finally {
      // Track operation time
      const duration = performance.now() - startTime;
      if (duration > 10) { // Log slow cache operations
        console.warn(`Slow cache get operation: ${duration}ms for key ${key}`);
      }
    }
  }

  /**
   * Set permission in both cache levels
   */
  async set(key: string, result: AuthorizationResult, ttlSeconds: number): Promise<void> {
    const startTime = performance.now();
    
    try {
      const cached: CachedPermission = {
        result,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
        version: this.cacheVersion,
        checksum: this.config.enableChecksums ? this.generateChecksum(result) : undefined
      };

      // Set in L1 cache
      this.l1Cache.set(key, cached);

      // Set in L2 cache if available
      if (this.l2Cache && this.isRedisConnected) {
        await this.setInL2Cache(key, cached, ttlSeconds);
      }

      this.metrics.l1Size = this.l1Cache.size;
    } catch (error) {
      console.error('Cache set error:', error);
      this.metrics.errors++;
    } finally {
      const duration = performance.now() - startTime;
      if (duration > 50) { // Log slow cache operations
        console.warn(`Slow cache set operation: ${duration}ms for key ${key}`);
      }
    }
  }

  /**
   * Invalidate cache entries using smart patterns
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      this.metrics.invalidations++;
      
      // Parse invalidation pattern
      const invalidationPattern = this.parseInvalidationPattern(pattern);
      
      // Invalidate L1 cache
      await this.invalidateL1Pattern(invalidationPattern);
      
      // Invalidate L2 cache
      if (this.l2Cache && this.isRedisConnected) {
        await this.invalidateL2Pattern(invalidationPattern);
      }

      // For global invalidations, increment cache version
      if (invalidationPattern.type === 'global') {
        await this.incrementCacheVersion();
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
      this.metrics.errors++;
    } finally {
      const duration = performance.now() - startTime;
      console.log(`Cache invalidation completed in ${duration}ms for pattern: ${pattern}`);
    }
  }

  /**
   * Batch invalidation for multiple cache entries
   */
  async invalidateMultiple(patterns: string[]): Promise<void> {
    const batchSize = this.config.batchInvalidationSize;
    
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      await Promise.all(batch.map(pattern => this.invalidatePattern(pattern)));
      
      // Small delay between batches to prevent overwhelming the cache
      if (i + batchSize < patterns.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Smart cache invalidation based on RBAC change triggers
   */
  async invalidateFromTrigger(trigger: CacheInvalidationTrigger): Promise<void> {
    const patterns: string[] = [];
    
    switch (trigger.type) {
      case 'ROLE_ASSIGNED':
      case 'ROLE_REVOKED':
        if (trigger.userId) {
          patterns.push(`user:${trigger.userId}:*`);
        }
        break;
      
      case 'DELEGATION_CREATED':
      case 'DELEGATION_REVOKED':
        if (trigger.toUserId) {
          patterns.push(`user:${trigger.toUserId}:*`);
        }
        break;
      
      case 'PERMISSION_SET_UPDATED':
        if (trigger.permissionSetId) {
          // This requires getting affected users from the authorization service
          patterns.push(`permission_set:${trigger.permissionSetId}:*`);
          // For now, do a global invalidation for permission set changes
          patterns.push('*');
        }
        break;
    }

    if (patterns.length > 0) {
      await this.invalidateMultiple(patterns);
    }
  }

  // =============================================
  // L2 Cache (Redis) Operations
  // =============================================

  private async getFromL2Cache(key: string): Promise<CachedPermission | null> {
    if (!this.l2Cache || !this.isRedisConnected) return null;

    try {
      const redisKey = this.config.redisKeyPrefix + key;
      const cached = await this.l2Cache.get(redisKey);
      
      if (!cached) return null;

      const parsed = JSON.parse(cached) as CachedPermission;
      
      // Verify checksum if enabled
      if (this.config.enableChecksums && parsed.checksum) {
        const expectedChecksum = this.generateChecksum(parsed.result);
        if (expectedChecksum !== parsed.checksum) {
          console.warn(`Checksum mismatch for cache key ${key}, invalidating entry`);
          await this.l2Cache.del(redisKey);
          return null;
        }
      }

      return parsed;
    } catch (error) {
      console.error('L2 cache get error:', error);
      return null;
    }
  }

  private async setInL2Cache(key: string, cached: CachedPermission, ttlSeconds: number): Promise<void> {
    if (!this.l2Cache || !this.isRedisConnected) return;

    try {
      const redisKey = this.config.redisKeyPrefix + key;
      const serialized = JSON.stringify(cached);

      await this.l2Cache.setEx(redisKey, ttlSeconds, serialized);
    } catch (error) {
      console.error('L2 cache set error:', error);
    }
  }

  private async invalidateL2Pattern(pattern: InvalidationPattern): Promise<void> {
    if (!this.l2Cache || !this.isRedisConnected) return;

    try {
      const redisPattern = this.config.redisKeyPrefix + pattern.pattern;
      const keys = await this.l2Cache.keys(redisPattern);
      
      if (keys.length > 0) {
        // Delete in batches to avoid blocking Redis
        const batchSize = this.config.batchInvalidationSize;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.l2Cache.del(batch);
        }
      }
    } catch (error) {
      console.error('L2 cache invalidation error:', error);
    }
  }

  // =============================================
  // L1 Cache (LRU) Operations
  // =============================================

  private async invalidateL1Pattern(pattern: InvalidationPattern): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.l1Cache.keys()) {
      if (this.matchesPattern(key, pattern.pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.l1Cache.delete(key));
    this.metrics.l1Size = this.l1Cache.size;
  }

  // =============================================
  // Cache Versioning
  // =============================================

  async incrementCacheVersion(): Promise<void> {
    if (!this.config.enableVersioning) return;

    this.cacheVersion++;
    
    if (this.l2Cache && this.isRedisConnected) {
      try {
        await this.l2Cache.set(this.config.cacheVersionKey, this.cacheVersion.toString());
      } catch (error) {
        console.error('Failed to update cache version in Redis:', error);
      }
    }

    // Clear L1 cache since version changed
    this.l1Cache.clear();
    this.metrics.l1Size = 0;
  }

  getCacheVersion(): number {
    return this.cacheVersion;
  }

  // =============================================
  // Utility Methods
  // =============================================

  private isExpired(cached: CachedPermission): boolean {
    const now = Date.now();
    const ageExpired = (now - cached.timestamp) > cached.ttl;
    const versionExpired = this.config.enableVersioning && cached.version !== this.cacheVersion;
    
    return ageExpired || versionExpired;
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Convert simple wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/:/g, '\\:');
    
    try {
      return new RegExp(`^${regexPattern}$`).test(key);
    } catch (error) {
      // Fallback to simple string matching
      return key.includes(pattern.replace('*', ''));
    }
  }

  private parseInvalidationPattern(pattern: string): InvalidationPattern {
    // Parse pattern to determine type and priority
    if (pattern === '*') {
      return { type: 'global', pattern, reason: 'Global invalidation', priority: 'high' };
    }
    
    if (pattern.startsWith('user:')) {
      return { type: 'user', pattern, reason: 'User permission change', priority: 'high' };
    }
    
    if (pattern.startsWith('role:')) {
      return { type: 'role', pattern, reason: 'Role permission change', priority: 'medium' };
    }
    
    if (pattern.includes('resource:')) {
      return { type: 'resource', pattern, reason: 'Resource access change', priority: 'low' };
    }
    
    return { type: 'global', pattern, reason: 'Unknown pattern type', priority: 'medium' };
  }

  private generateChecksum(result: AuthorizationResult): string {
    // Simple checksum generation for data integrity
    const data = JSON.stringify(result);
    let hash = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  // =============================================
  // Cache Statistics and Monitoring
  // =============================================

  private updateMetrics(): void {
    this.metrics.l1Size = this.l1Cache.size;
    
    // Log metrics periodically
    const totalRequests = this.metrics.l1Hits + this.metrics.l1Misses + this.metrics.l2Hits + this.metrics.l2Misses;
    if (totalRequests > 0) {
      const l1HitRate = this.metrics.l1Hits / totalRequests;
      const l2HitRate = this.metrics.l2Hits / totalRequests;
      const overallHitRate = (this.metrics.l1Hits + this.metrics.l2Hits) / totalRequests;
      
      console.log(`Cache metrics - L1: ${(l1HitRate * 100).toFixed(1)}%, L2: ${(l2HitRate * 100).toFixed(1)}%, Overall: ${(overallHitRate * 100).toFixed(1)}%`);
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getHitRate(): { l1: number; l2: number; overall: number } {
    const totalRequests = this.metrics.l1Hits + this.metrics.l1Misses + this.metrics.l2Hits + this.metrics.l2Misses;
    
    if (totalRequests === 0) {
      return { l1: 0, l2: 0, overall: 0 };
    }

    return {
      l1: this.metrics.l1Hits / totalRequests,
      l2: this.metrics.l2Hits / totalRequests,
      overall: (this.metrics.l1Hits + this.metrics.l2Hits) / totalRequests
    };
  }

  resetMetrics(): void {
    this.initializeMetrics();
  }

  // =============================================
  // Cache Management
  // =============================================

  async clear(): Promise<void> {
    // Clear L1 cache
    this.l1Cache.clear();
    
    // Clear L2 cache
    if (this.l2Cache && this.isRedisConnected) {
      try {
        const keys = await this.l2Cache.keys(this.config.redisKeyPrefix + '*');
        if (keys.length > 0) {
          await this.l2Cache.del(keys);
        }
      } catch (error) {
        console.error('Failed to clear L2 cache:', error);
      }
    }
    
    this.metrics.l1Size = 0;
    this.metrics.l2Size = 0;
  }

  async close(): Promise<void> {
    // Stop metrics collection
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    // Close Redis connection
    if (this.l2Cache && this.isRedisConnected) {
      try {
        await this.l2Cache.quit();
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }

    // Clear L1 cache
    this.l1Cache.clear();
  }

  // =============================================
  // Health Check
  // =============================================

  async healthCheck(): Promise<{
    l1Cache: { status: 'healthy' | 'degraded'; size: number; maxSize: number };
    l2Cache: { status: 'healthy' | 'unhealthy' | 'disabled'; connected: boolean };
    metrics: CacheMetrics;
    performance: { hitRate: number; errorRate: number };
  }> {
    const hitRates = this.getHitRate();
    const totalOperations = this.metrics.l1Hits + this.metrics.l1Misses + this.metrics.l2Hits + this.metrics.l2Misses;
    const errorRate = totalOperations > 0 ? this.metrics.errors / totalOperations : 0;

    return {
      l1Cache: {
        status: this.l1Cache.size < this.config.l1MaxEntries * 0.9 ? 'healthy' : 'degraded',
        size: this.l1Cache.size,
        maxSize: this.config.l1MaxEntries
      },
      l2Cache: {
        status: !this.config.redisUrl ? 'disabled' : this.isRedisConnected ? 'healthy' : 'unhealthy',
        connected: this.isRedisConnected
      },
      metrics: this.metrics,
      performance: {
        hitRate: hitRates.overall,
        errorRate
      }
    };
  }
}

// =============================================
// Cache Factory and Singleton
// =============================================

let permissionCacheInstance: PermissionCache | null = null;

export function createPermissionCache(config?: Partial<CacheConfig>): PermissionCache {
  return new PermissionCache(config);
}

export function getPermissionCache(): PermissionCache {
  if (!permissionCacheInstance) {
    permissionCacheInstance = new PermissionCache();
  }
  return permissionCacheInstance;
}

// =============================================
// Cache Key Builders
// =============================================

export class CacheKeyBuilder {
  static userPermission(userId: string, action: string, resourceId: string): string {
    return `user:${userId}:${action}:${resourceId}`;
  }

  static userRoles(userId: string): string {
    return `user:${userId}:roles`;
  }

  static roleDelegations(userId: string): string {
    return `user:${userId}:delegations`;
  }

  static permissionSet(permissionSetId: string): string {
    return `permission_set:${permissionSetId}`;
  }

  static emergencyOverride(userId: string): string {
    return `emergency:${userId}`;
  }

  static roleAssignments(roleId: string): string {
    return `role:${roleId}:assignments`;
  }
}

// =============================================
// Cache Warmup Utilities
// =============================================

export class CacheWarmup {
  private cache: PermissionCache;

  constructor(cache: PermissionCache) {
    this.cache = cache;
  }

  /**
   * Warmup cache for frequently accessed users
   */
  async warmupUsers(userIds: string[]): Promise<void> {
    console.log(`Warming up cache for ${userIds.length} users`);
    
    // This would typically pre-load common permission checks
    // Implementation would depend on the specific authorization service
    // For now, this is a placeholder
  }

  /**
   * Warmup cache for common permission patterns
   */
  async warmupCommonPatterns(): Promise<void> {
    console.log('Warming up cache for common permission patterns');
    
    // Pre-load common permission checks like:
    // - schedule.read for all active users
    // - document.read for family members
    // - etc.
  }
}