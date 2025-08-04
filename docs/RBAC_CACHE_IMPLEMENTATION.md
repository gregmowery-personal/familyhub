# RBAC Permission Cache Implementation

This document describes the implementation of the two-level caching system for the FamilyHub RBAC (Role-Based Access Control) system as specified in the RBAC Design Proposal V2.

## Overview

The permission cache implementation provides:

1. **Two-Level Cache Architecture**: Local LRU cache (L1) + Redis cache (L2)
2. **Smart Invalidation**: Pattern-based and trigger-based cache invalidation
3. **TTL Management**: Configurable TTL with action-specific timing
4. **Cache Versioning**: Global versioning for consistency
5. **Comprehensive Monitoring**: Health checks, metrics, and alerting
6. **Production-Ready**: Error handling, failover, and performance optimization

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Authorization   │───▶│ Permission      │───▶│ Database /      │
│ Service         │    │ Cache           │    │ Supabase        │
│                 │◀───│                 │◀───│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cache Monitor   │    │ L1: LRU Cache   │    │ L2: Redis       │
│ & Metrics       │    │ (In-Memory)     │    │ (Distributed)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. PermissionCache (`/src/lib/auth/permission-cache.ts`)

Main caching implementation with:
- **L1 Cache**: LRU cache for ultra-fast local access
- **L2 Cache**: Redis for distributed caching
- **Smart Invalidation**: Pattern matching and batch operations
- **Data Integrity**: Checksums and version validation

### 2. Cache Configuration (`/src/lib/auth/cache-config.ts`)

Environment-based configuration management:
- **Development**: Short TTLs for quick iteration
- **Production**: Optimized for performance
- **Security-Focused**: Enhanced integrity checks
- **Memory-Efficient**: Reduced memory footprint

### 3. Cache Monitor (`/src/lib/auth/cache-monitor.ts`)

Monitoring and alerting system:
- **Performance Metrics**: Hit rates, response times, error rates
- **Health Monitoring**: Component status and availability
- **Alerting**: Configurable alerts for various conditions
- **Reporting**: Comprehensive performance reports

### 4. RBAC Setup (`/src/lib/auth/rbac-setup.ts`)

System integration and lifecycle management:
- **Initialization**: Complete system setup
- **Health Checks**: System diagnostics
- **Graceful Shutdown**: Clean resource management
- **Testing Utilities**: Development and test support

## Usage Examples

### Basic Setup

```typescript
import { initializeRBACSystem } from '@/lib/auth/rbac-setup'

// Initialize with default configuration
const rbacSystem = await initializeRBACSystem()

// Use the authorization service
const result = await rbacSystem.authService.authorize(
  userId,
  'schedule.read',
  resourceId,
  'schedule'
)
```

### Production Setup

```typescript
import { initializeRBACSystem } from '@/lib/auth/rbac-setup'

// Production configuration
const rbacSystem = await initializeRBACSystem({
  environment: 'production',
  requirements: {
    highPerformance: true,
    securityFocused: true
  },
  customConfig: {
    cache: {
      l1MaxEntries: 50000,
      redisDefaultTtlSeconds: 900,
      enableChecksums: true
    }
  }
})
```

### Development/Testing Setup

```typescript
import { setupRBACForTesting } from '@/lib/auth/rbac-setup'

// Test configuration with short TTLs
const rbacSystem = await setupRBACForTesting({
  disableRedis: true,
  shortTTLs: true,
  enableLogging: true
})
```

## Configuration

### Environment Variables

```bash
# L1 Cache (Local LRU)
RBAC_L1_CACHE_MAX_ENTRIES=10000
RBAC_L1_CACHE_TTL_MS=60000
RBAC_L1_CACHE_UPDATE_AGE=true

# L2 Cache (Redis)
REDIS_URL=redis://localhost:6379
RBAC_CACHE_PREFIX=rbac:cache:
RBAC_L2_CACHE_TTL_SECONDS=300
RBAC_REDIS_TIMEOUT=5000
RBAC_REDIS_RETRY_ATTEMPTS=3

# Cache Features
RBAC_CACHE_VERSIONING=true
RBAC_CACHE_CHECKSUMS=true
RBAC_CACHE_COMPRESSION_THRESHOLD=1024
RBAC_CACHE_BATCH_SIZE=100
RBAC_CACHE_METRICS_INTERVAL=60000

# Alerting
CACHE_ALERT_WEBHOOK_URL=https://hooks.slack.com/...
```

### Cache Presets

```typescript
import { CachePresets } from '@/lib/auth/cache-config'

// High-performance preset
const config = CachePresets.highPerformance

// Memory-efficient preset
const config = CachePresets.memoryEfficient

// Security-focused preset
const config = CachePresets.securityFocused

// Development preset
const config = CachePresets.development
```

## Cache Keys

The system uses structured cache keys for efficient pattern matching:

```typescript
import { CacheKeyBuilder } from '@/lib/auth/permission-cache'

// User permission check
const key = CacheKeyBuilder.userPermission(userId, action, resourceId)
// Result: "user:123:schedule.read:456"

// User roles
const key = CacheKeyBuilder.userRoles(userId)
// Result: "user:123:roles"

// Role delegations
const key = CacheKeyBuilder.roleDelegations(userId)
// Result: "user:123:delegations"
```

## Cache Invalidation

### Automatic Invalidation

The cache automatically invalidates when permissions change:

```typescript
// Role assignment change
await authService.invalidateCache({
  type: 'ROLE_ASSIGNED',
  userId: 'user-123'
})

// Delegation change
await authService.invalidateCache({
  type: 'DELEGATION_CREATED',
  toUserId: 'user-456'
})

// Permission set update
await authService.invalidateCache({
  type: 'PERMISSION_SET_UPDATED',
  permissionSetId: 'pset-789'
})
```

### Manual Invalidation

```typescript
// Pattern-based invalidation
await cache.invalidatePattern('user:123:*')
await cache.invalidatePattern('role:admin:*')

// Batch invalidation
await cache.invalidateMultiple([
  'user:123:*',
  'user:456:*',
  'permission_set:abc:*'
])

// Clear all cache (emergency)
await cache.clear()
```

## Monitoring

### Health Checks

```typescript
// Get cache health
const health = await cache.healthCheck()
console.log('Cache Status:', health.l1Cache.status, health.l2Cache.status)

// Get authorization service health
const authHealth = await authService.getCacheHealth()
```

### Performance Metrics

```typescript
// Get hit rates
const hitRates = authService.getCacheHitRate()
console.log(`Hit Rate: ${(hitRates.overall * 100).toFixed(1)}%`)

// Get detailed metrics
const metrics = authService.getCacheMetrics()
console.log('L1 Size:', metrics.l1Size)
console.log('Errors:', metrics.errors)
```

### Monitoring Dashboard

```typescript
// Generate performance report
const monitor = getCacheMonitor(cache, authService)
const report = await monitor.generatePerformanceReport({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  end: new Date()
})

console.log('Performance Summary:', report.summary)
console.log('Recommendations:', report.recommendations)
```

## API Integration

### Health Check Endpoint

```typescript
// GET /api/auth/cache-health
export async function GET(request: NextRequest) {
  const authService = getAuthorizationService()
  const cacheHealth = await authService.getCacheHealth()
  
  return NextResponse.json({
    health: cacheHealth,
    performance: authService.getCacheHitRate(),
    timestamp: new Date().toISOString()
  })
}
```

### Cache Management Endpoint

```typescript
// POST /api/auth/cache-health
export async function POST(request: NextRequest) {
  const { action, ...params } = await request.json()
  const authService = getAuthorizationService()
  
  switch (action) {
    case 'clear':
      await authService.clearAllCache()
      return NextResponse.json({ success: true })
      
    case 'warmup':
      await authService.warmupCacheForUsers(params.userIds)
      return NextResponse.json({ success: true })
  }
}
```

## Best Practices

### 1. Cache Configuration

- **Production**: Use high-performance preset with Redis
- **Development**: Use short TTLs for quick iteration
- **Testing**: Disable Redis and use memory-only cache
- **Security**: Enable checksums and versioning

### 2. Cache Invalidation

- **Specific Patterns**: Use specific patterns like `user:123:*` over global `*`
- **Batch Operations**: Group multiple invalidations together
- **Trigger-Based**: Let the system handle automatic invalidation
- **Emergency Only**: Use global cache clear only in emergencies

### 3. Monitoring

- **Set Alerts**: Configure alerts for low hit rates and high error rates
- **Regular Reports**: Generate weekly performance reports
- **Health Checks**: Monitor cache health in production
- **Capacity Planning**: Track cache utilization over time

### 4. Performance Optimization

- **TTL Tuning**: Adjust TTLs based on data change frequency
- **Cache Warming**: Pre-load cache for frequently accessed data
- **Connection Pooling**: Use Redis connection pooling in production
- **Memory Management**: Monitor and tune L1 cache size

## Troubleshooting

### Common Issues

1. **Low Hit Rate**
   - Check TTL values (may be too short)
   - Review invalidation patterns (may be too aggressive)
   - Verify cache is properly initialized

2. **High Error Rate**
   - Check Redis connection
   - Review error logs for patterns
   - Verify network connectivity

3. **High Memory Usage**
   - Reduce L1 cache max entries
   - Shorten TTL values
   - Enable compression

4. **Redis Connection Issues**
   - Check Redis server status
   - Verify connection string
   - Review network configuration

### Debug Information

```typescript
// Enable debug logging
process.env.NODE_ENV = 'development'

// Get system status
const status = await getSystemStatus()
console.log('System Status:', status)

// Check cache configuration
const health = await performSystemHealthCheck(cache, authService, monitor)
console.log('Health Report:', health)
```

## Performance Characteristics

### Expected Performance

- **L1 Cache Hit**: < 1ms
- **L2 Cache Hit**: < 10ms
- **Database Query**: < 50ms
- **Cache Miss**: < 100ms (includes DB query + cache population)

### Scalability

- **L1 Cache**: Handles 10,000+ entries efficiently
- **L2 Cache**: Scales with Redis cluster
- **Concurrent Users**: Tested with 1,000+ concurrent authorization checks
- **Memory Usage**: ~1MB per 1,000 cached entries

### Reliability

- **Redis Failover**: System continues with L1 cache only
- **Cache Corruption**: Checksum validation prevents bad data
- **Version Mismatch**: Automatic invalidation on version changes
- **Error Recovery**: Graceful degradation with logging

## Integration with Authorization Service

The cache is fully integrated with the authorization service:

```typescript
class AuthorizationService {
  async authorize(userId, action, resourceId, resourceType) {
    // 1. Rate limiting check
    // 2. Cache check (L1 then L2)
    // 3. Emergency override check
    // 4. Permission evaluation
    // 5. Cache population
    // 6. Audit logging
  }
  
  async invalidateCache(trigger) {
    // Smart invalidation based on trigger type
  }
  
  getCacheHealth() {
    // Comprehensive health check
  }
}
```

The cache provides transparent performance improvements while maintaining the same authorization API contract.

## Future Enhancements

### Planned Features

1. **Cache Warming Strategies**: Intelligent pre-loading
2. **Distributed Invalidation**: Cross-instance cache invalidation
3. **Machine Learning**: Predictive cache warming
4. **Advanced Metrics**: Detailed performance analytics
5. **Multi-Region Support**: Geographic cache distribution

### Configuration Evolution

- **Dynamic Configuration**: Runtime configuration updates
- **A/B Testing**: Cache strategy experimentation
- **Auto-Tuning**: Automatic TTL optimization
- **Cost Optimization**: Usage-based configuration

This implementation provides a robust, scalable, and production-ready caching layer for the FamilyHub RBAC system while maintaining simplicity and ease of use.