import type { CacheConfig } from './permission-cache';

// =============================================
// Environment-based Cache Configuration
// =============================================

/**
 * Get cache configuration from environment variables
 */
export function getCacheConfigFromEnv(): Partial<CacheConfig> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // L1 Cache (Local LRU) Configuration
    l1MaxEntries: parseInt(process.env.RBAC_L1_CACHE_MAX_ENTRIES || '10000', 10),
    l1TtlMs: parseInt(process.env.RBAC_L1_CACHE_TTL_MS || '60000', 10), // 1 minute default
    l1UpdateAgeOnGet: process.env.RBAC_L1_CACHE_UPDATE_AGE === 'true',

    // L2 Cache (Redis) Configuration
    redisUrl: process.env.REDIS_URL || 
              process.env.REDIS_CONNECTION_STRING || 
              process.env.SUPABASE_REDIS_URL,
    redisKeyPrefix: process.env.RBAC_CACHE_PREFIX || 'rbac:cache:',
    redisDefaultTtlSeconds: parseInt(process.env.RBAC_L2_CACHE_TTL_SECONDS || '300', 10), // 5 minutes default
    redisConnectionTimeout: parseInt(process.env.RBAC_REDIS_TIMEOUT || '5000', 10),
    redisRetryAttempts: parseInt(process.env.RBAC_REDIS_RETRY_ATTEMPTS || '3', 10),

    // Cache versioning
    cacheVersionKey: process.env.RBAC_CACHE_VERSION_KEY || 'rbac:cache:version',
    enableVersioning: process.env.RBAC_CACHE_VERSIONING !== 'false', // Enabled by default

    // Performance tuning
    enableChecksums: process.env.RBAC_CACHE_CHECKSUMS !== 'false', // Enabled by default
    compressionThreshold: parseInt(process.env.RBAC_CACHE_COMPRESSION_THRESHOLD || '1024', 10),
    batchInvalidationSize: parseInt(process.env.RBAC_CACHE_BATCH_SIZE || '100', 10),
    metricsCollectionInterval: parseInt(process.env.RBAC_CACHE_METRICS_INTERVAL || '60000', 10), // 1 minute

    // Environment-specific optimizations
    ...(isDevelopment && {
      // Development: Shorter TTLs for faster iteration
      l1TtlMs: 30000, // 30 seconds
      redisDefaultTtlSeconds: 60, // 1 minute
      metricsCollectionInterval: 30000, // 30 seconds
    }),

    ...(isProduction && {
      // Production: Longer TTLs for better performance
      l1TtlMs: 300000, // 5 minutes
      redisDefaultTtlSeconds: 900, // 15 minutes
      l1MaxEntries: 50000, // Larger cache in production
    })
  };
}

/**
 * Validate cache configuration
 */
export function validateCacheConfig(config: Partial<CacheConfig>): string[] {
  const errors: string[] = [];

  if (config.l1MaxEntries && config.l1MaxEntries <= 0) {
    errors.push('L1 cache max entries must be positive');
  }

  if (config.l1TtlMs && config.l1TtlMs <= 0) {
    errors.push('L1 cache TTL must be positive');
  }

  if (config.redisDefaultTtlSeconds && config.redisDefaultTtlSeconds <= 0) {
    errors.push('Redis default TTL must be positive');
  }

  if (config.redisConnectionTimeout && config.redisConnectionTimeout <= 0) {
    errors.push('Redis connection timeout must be positive');
  }

  if (config.compressionThreshold && config.compressionThreshold <= 0) {
    errors.push('Compression threshold must be positive');
  }

  if (config.batchInvalidationSize && config.batchInvalidationSize <= 0) {
    errors.push('Batch invalidation size must be positive');
  }

  if (config.metricsCollectionInterval && config.metricsCollectionInterval <= 0) {
    errors.push('Metrics collection interval must be positive');
  }

  return errors;
}

/**
 * Get optimal cache configuration for the current environment
 */
export function getOptimalCacheConfig(): Partial<CacheConfig> {
  const baseConfig = getCacheConfigFromEnv();
  const errors = validateCacheConfig(baseConfig);

  if (errors.length > 0) {
    console.warn('Cache configuration validation errors:', errors);
    // Fall back to safe defaults
    return getDefaultCacheConfig();
  }

  return baseConfig;
}

/**
 * Get safe default cache configuration
 */
export function getDefaultCacheConfig(): Partial<CacheConfig> {
  return {
    l1MaxEntries: 10000,
    l1TtlMs: 60000, // 1 minute
    l1UpdateAgeOnGet: true,

    redisKeyPrefix: 'rbac:cache:',
    redisDefaultTtlSeconds: 300, // 5 minutes
    redisConnectionTimeout: 5000,
    redisRetryAttempts: 3,

    cacheVersionKey: 'rbac:cache:version',
    enableVersioning: true,

    enableChecksums: true,
    compressionThreshold: 1024,
    batchInvalidationSize: 100,
    metricsCollectionInterval: 60000, // 1 minute
  };
}

// =============================================
// Cache Configuration Presets
// =============================================

export const CachePresets = {
  /**
   * High-performance preset for production environments
   */
  highPerformance: {
    l1MaxEntries: 50000,
    l1TtlMs: 300000, // 5 minutes
    l1UpdateAgeOnGet: true,
    redisDefaultTtlSeconds: 900, // 15 minutes
    enableChecksums: true,
    batchInvalidationSize: 200,
    metricsCollectionInterval: 30000, // 30 seconds
  } as Partial<CacheConfig>,

  /**
   * Memory-efficient preset for resource-constrained environments
   */
  memoryEfficient: {
    l1MaxEntries: 5000,
    l1TtlMs: 30000, // 30 seconds
    l1UpdateAgeOnGet: false,
    redisDefaultTtlSeconds: 120, // 2 minutes
    enableChecksums: false,
    batchInvalidationSize: 50,
    metricsCollectionInterval: 120000, // 2 minutes
  } as Partial<CacheConfig>,

  /**
   * Development preset with short TTLs for quick iteration
   */
  development: {
    l1MaxEntries: 1000,
    l1TtlMs: 10000, // 10 seconds
    l1UpdateAgeOnGet: true,
    redisDefaultTtlSeconds: 30, // 30 seconds
    enableChecksums: false,
    batchInvalidationSize: 25,
    metricsCollectionInterval: 30000, // 30 seconds
  } as Partial<CacheConfig>,

  /**
   * Security-focused preset with shorter TTLs and integrity checks
   */
  securityFocused: {
    l1MaxEntries: 10000,
    l1TtlMs: 30000, // 30 seconds
    l1UpdateAgeOnGet: false,
    redisDefaultTtlSeconds: 60, // 1 minute
    enableChecksums: true,
    enableVersioning: true,
    batchInvalidationSize: 50,
    metricsCollectionInterval: 15000, // 15 seconds
  } as Partial<CacheConfig>,
};

// =============================================
// Runtime Cache Configuration Selection
// =============================================

/**
 * Select cache configuration based on environment and requirements
 */
export function selectCacheConfig(
  environment?: 'development' | 'staging' | 'production',
  requirements?: {
    highPerformance?: boolean;
    memoryConstrained?: boolean;
    securityFocused?: boolean;
  }
): Partial<CacheConfig> {
  const env = environment || process.env.NODE_ENV || 'development';
  const req = requirements || {};

  // Priority order: security > memory > performance > environment
  if (req.securityFocused) {
    return { ...CachePresets.securityFocused, ...getCacheConfigFromEnv() };
  }

  if (req.memoryConstrained) {
    return { ...CachePresets.memoryEfficient, ...getCacheConfigFromEnv() };
  }

  if (req.highPerformance && env === 'production') {
    return { ...CachePresets.highPerformance, ...getCacheConfigFromEnv() };
  }

  // Environment-based defaults
  switch (env) {
    case 'development':
      return { ...CachePresets.development, ...getCacheConfigFromEnv() };
    
    case 'production':
      return { ...CachePresets.highPerformance, ...getCacheConfigFromEnv() };
    
    default:
      return getOptimalCacheConfig();
  }
}

// =============================================
// Cache Configuration Utilities
// =============================================

/**
 * Log cache configuration for debugging
 */
export function logCacheConfig(config: Partial<CacheConfig>): void {
  const sensitiveFields = ['redisUrl'];
  const safeConfig = { ...config };
  
  sensitiveFields.forEach(field => {
    if (safeConfig[field as keyof CacheConfig]) {
      safeConfig[field as keyof CacheConfig] = '[REDACTED]' as any;
    }
  });

  console.log('RBAC Cache Configuration:', JSON.stringify(safeConfig, null, 2));
}

/**
 * Get cache configuration summary for monitoring
 */
export function getCacheConfigSummary(config: Partial<CacheConfig>): {
  l1Config: { maxEntries: number; ttlMs: number };
  l2Config: { enabled: boolean; ttlSeconds: number };
  features: { versioning: boolean; checksums: boolean };
} {
  return {
    l1Config: {
      maxEntries: config.l1MaxEntries || 10000,
      ttlMs: config.l1TtlMs || 60000,
    },
    l2Config: {
      enabled: !!config.redisUrl,
      ttlSeconds: config.redisDefaultTtlSeconds || 300,
    },
    features: {
      versioning: config.enableVersioning !== false,
      checksums: config.enableChecksums !== false,
    },
  };
}