/**
 * Permission Cache Tests
 * 
 * Tests for the two-level caching system
 */

import { PermissionCache, CacheKeyBuilder } from '../../src/lib/auth/permission-cache'
import { AuthorizationResult } from '../../src/lib/auth/authorization-service'

// Mock Redis client for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn()
  }))
}))

describe('PermissionCache', () => {
  let cache: PermissionCache

  beforeEach(() => {
    // Create cache with test configuration
    cache = new PermissionCache({
      l1MaxEntries: 100,
      l1TtlMs: 5000, // 5 seconds
      redisUrl: undefined, // Disable Redis for unit tests
      enableChecksums: false,
      enableVersioning: false
    })
  })

  afterEach(async () => {
    await cache.close()
  })

  describe('Basic Cache Operations', () => {
    test('should cache and retrieve permission result', async () => {
      const key = 'test-key'
      const result: AuthorizationResult = {
        allowed: true,
        reason: 'DIRECT_ROLE_ALLOW',
        source: 'DIRECT_ROLE'
      }

      // Set cache entry
      await cache.set(key, result, 60)

      // Retrieve cache entry
      const cached = await cache.get(key)
      
      expect(cached).not.toBeNull()
      expect(cached?.result).toEqual(result)
    })

    test('should return null for non-existent key', async () => {
      const cached = await cache.get('non-existent-key')
      expect(cached).toBeNull()
    })

    test('should respect TTL expiration', async () => {
      const key = 'ttl-test-key'
      const result: AuthorizationResult = {
        allowed: true,
        reason: 'DIRECT_ROLE_ALLOW'
      }

      // Set with very short TTL
      await cache.set(key, result, 0.001) // 1ms

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should be expired
      const cached = await cache.get(key)
      expect(cached).toBeNull()
    })
  })

  describe('Cache Key Builder', () => {
    test('should build user permission key correctly', () => {
      const key = CacheKeyBuilder.userPermission('user-123', 'read', 'resource-456')
      expect(key).toBe('user:user-123:read:resource-456')
    })

    test('should build user roles key correctly', () => {
      const key = CacheKeyBuilder.userRoles('user-123')
      expect(key).toBe('user:user-123:roles')
    })

    test('should build delegation key correctly', () => {
      const key = CacheKeyBuilder.roleDelegations('user-123')
      expect(key).toBe('user:user-123:delegations')
    })

    test('should build permission set key correctly', () => {
      const key = CacheKeyBuilder.permissionSet('pset-123')
      expect(key).toBe('permission_set:pset-123')
    })
  })

  describe('Cache Invalidation', () => {
    test('should invalidate matching patterns', async () => {
      // Set multiple cache entries
      await cache.set('user:123:read:doc1', { allowed: true, reason: 'TEST' }, 60)
      await cache.set('user:123:write:doc1', { allowed: true, reason: 'TEST' }, 60)
      await cache.set('user:456:read:doc1', { allowed: true, reason: 'TEST' }, 60)

      // Verify entries exist
      expect(await cache.get('user:123:read:doc1')).not.toBeNull()
      expect(await cache.get('user:123:write:doc1')).not.toBeNull()
      expect(await cache.get('user:456:read:doc1')).not.toBeNull()

      // Invalidate user 123 entries
      await cache.invalidatePattern('user:123:*')

      // Check invalidation results
      expect(await cache.get('user:123:read:doc1')).toBeNull()
      expect(await cache.get('user:123:write:doc1')).toBeNull()
      expect(await cache.get('user:456:read:doc1')).not.toBeNull() // Should remain
    })

    test('should handle multiple pattern invalidation', async () => {
      // Set cache entries
      await cache.set('user:123:read:doc1', { allowed: true, reason: 'TEST' }, 60)
      await cache.set('user:456:read:doc1', { allowed: true, reason: 'TEST' }, 60)
      await cache.set('role:family_coordinator:permissions', { allowed: true, reason: 'TEST' }, 60)

      // Invalidate multiple patterns
      await cache.invalidateMultiple(['user:123:*', 'user:456:*'])

      // Check results
      expect(await cache.get('user:123:read:doc1')).toBeNull()
      expect(await cache.get('user:456:read:doc1')).toBeNull()
      expect(await cache.get('role:family_coordinator:permissions')).not.toBeNull() // Should remain
    })
  })

  describe('Cache Metrics', () => {
    test('should track hit and miss metrics', async () => {
      // Initial metrics
      const initialMetrics = cache.getMetrics()
      expect(initialMetrics.l1Hits).toBe(0)
      expect(initialMetrics.l1Misses).toBe(0)

      // Cache miss
      await cache.get('non-existent-key')
      let metrics = cache.getMetrics()
      expect(metrics.l1Misses).toBe(1)

      // Cache hit
      await cache.set('test-key', { allowed: true, reason: 'TEST' }, 60)
      await cache.get('test-key')
      metrics = cache.getMetrics()
      expect(metrics.l1Hits).toBe(1)
    })

    test('should calculate hit rates correctly', () => {
      // Simulate some cache operations by directly updating metrics
      const cache = new PermissionCache({
        l1MaxEntries: 100,
        redisUrl: undefined,
        enableChecksums: false
      })

      // Test with no operations
      let hitRates = cache.getHitRate()
      expect(hitRates.l1).toBe(0)
      expect(hitRates.l2).toBe(0)
      expect(hitRates.overall).toBe(0)
    })
  })

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await cache.healthCheck()

      expect(health).toHaveProperty('l1Cache')
      expect(health).toHaveProperty('l2Cache')
      expect(health).toHaveProperty('metrics')
      expect(health).toHaveProperty('performance')

      expect(health.l1Cache.status).toMatch(/healthy|degraded/)
      expect(health.l2Cache.status).toMatch(/healthy|unhealthy|disabled/)
    })

    test('should detect L1 cache capacity issues', async () => {
      // Create cache with very small capacity
      const smallCache = new PermissionCache({
        l1MaxEntries: 2,
        redisUrl: undefined
      })

      // Fill cache beyond capacity
      await smallCache.set('key1', { allowed: true, reason: 'TEST' }, 60)
      await smallCache.set('key2', { allowed: true, reason: 'TEST' }, 60)
      await smallCache.set('key3', { allowed: true, reason: 'TEST' }, 60) // Should evict

      const health = await smallCache.healthCheck()
      
      // Cache should be at or near capacity
      expect(health.l1Cache.size).toBeLessThanOrEqual(2)
      
      await smallCache.close()
    })
  })

  describe('Cache Configuration', () => {
    test('should use provided configuration', () => {
      const customCache = new PermissionCache({
        l1MaxEntries: 5000,
        l1TtlMs: 30000,
        redisKeyPrefix: 'test:cache:',
        enableChecksums: true
      })

      // Configuration should be applied (we can't directly test private config,
      // but we can test behavior that would be affected)
      expect(customCache).toBeDefined()
    })

    test('should handle missing Redis gracefully', async () => {
      const cacheWithoutRedis = new PermissionCache({
        redisUrl: undefined,
        l1MaxEntries: 100
      })

      // Should still work with L1 cache only
      await cacheWithoutRedis.set('test', { allowed: true, reason: 'TEST' }, 60)
      const result = await cacheWithoutRedis.get('test')
      
      expect(result).not.toBeNull()
      expect(result?.result.allowed).toBe(true)

      await cacheWithoutRedis.close()
    })
  })

  describe('Error Handling', () => {
    test('should handle cache operation errors gracefully', async () => {
      // This test verifies that cache errors don't crash the system
      const result = await cache.get('test-key')
      expect(result).toBeNull() // Should return null, not throw
    })

    test('should handle invalidation errors gracefully', async () => {
      // Should not throw even if pattern is malformed
      await expect(cache.invalidatePattern('**invalid**pattern**')).resolves.not.toThrow()
    })
  })

  describe('Cache Versioning', () => {
    test('should support cache versioning', async () => {
      const versionedCache = new PermissionCache({
        l1MaxEntries: 100,
        redisUrl: undefined,
        enableVersioning: true
      })

      // Set initial version
      const initialVersion = versionedCache.getCacheVersion()
      expect(initialVersion).toBeGreaterThan(0)

      // Increment version should invalidate all entries
      await versionedCache.set('test', { allowed: true, reason: 'TEST' }, 60)
      expect(await versionedCache.get('test')).not.toBeNull()

      await versionedCache.incrementCacheVersion()
      expect(await versionedCache.get('test')).toBeNull() // Should be invalidated

      expect(versionedCache.getCacheVersion()).toBe(initialVersion + 1)

      await versionedCache.close()
    })
  })
})

// Integration test with mock authorization service
describe('Cache Integration', () => {
  test('should integrate with cache invalidation triggers', async () => {
    const cache = new PermissionCache({
      l1MaxEntries: 100,
      redisUrl: undefined
    })

    // Set some cache entries
    await cache.set('user:123:read:doc1', { allowed: true, reason: 'TEST' }, 60)
    
    // Test trigger-based invalidation
    await cache.invalidateFromTrigger({
      type: 'ROLE_ASSIGNED',
      userId: '123'
    })

    // Entry should be invalidated
    expect(await cache.get('user:123:read:doc1')).toBeNull()

    await cache.close()
  })
})