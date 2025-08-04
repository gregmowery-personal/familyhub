/**
 * RBAC System Setup and Integration
 * 
 * This file provides utilities to set up the complete RBAC system
 * with caching, monitoring, and proper configuration.
 */

import { PermissionCache, createPermissionCache } from './permission-cache'
import { AuthorizationService } from './authorization-service'
import { CacheMonitor, createCacheMonitor } from './cache-monitor'
import { selectCacheConfig, logCacheConfig } from './cache-config'

// =============================================
// RBAC System Components
// =============================================

export interface RBACSystem {
  cache: PermissionCache;
  authService: AuthorizationService;
  monitor: CacheMonitor;
  isInitialized: boolean;
}

export interface RBACSetupOptions {
  environment?: 'development' | 'staging' | 'production';
  requirements?: {
    highPerformance?: boolean;
    memoryConstrained?: boolean;
    securityFocused?: boolean;
  };
  customConfig?: {
    cache?: any;
    monitor?: any;
  };
  enableMonitoring?: boolean;
  enableCaching?: boolean;
}

// =============================================
// System Setup
// =============================================

let rbacSystemInstance: RBACSystem | null = null;

/**
 * Initialize the complete RBAC system with caching and monitoring
 */
export async function initializeRBACSystem(options: RBACSetupOptions = {}): Promise<RBACSystem> {
  if (rbacSystemInstance?.isInitialized) {
    return rbacSystemInstance;
  }

  console.log('Initializing RBAC system...');

  try {
    // 1. Configure cache based on environment and requirements
    const cacheConfig = selectCacheConfig(options.environment, options.requirements);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('RBAC Cache Configuration:');
      logCacheConfig(cacheConfig);
    }

    // 2. Create cache instance (if caching is enabled)
    const cache = options.enableCaching !== false ? 
      createPermissionCache({ ...cacheConfig, ...options.customConfig?.cache }) :
      createPermissionCache({ l1MaxEntries: 0, redisUrl: undefined }); // Disabled cache

    // 3. Create authorization service with cache
    const authService = new AuthorizationService(cache);

    // 4. Create monitoring system (if monitoring is enabled)
    const monitor = options.enableMonitoring !== false ?
      createCacheMonitor(cache, authService, options.customConfig?.monitor) :
      null as any; // Type assertion for disabled monitoring

    // 5. Wait for cache to initialize (Redis connection, etc.)
    await waitForCacheInitialization(cache);

    // 6. Perform initial health check
    const health = await performSystemHealthCheck(cache, authService, monitor);
    
    if (health.overall !== 'healthy' && options.environment === 'production') {
      console.warn('RBAC system initialized with degraded health:', health);
    }

    const system: RBACSystem = {
      cache,
      authService,
      monitor,
      isInitialized: true
    };

    rbacSystemInstance = system;
    
    console.log('RBAC system initialized successfully');
    return system;

  } catch (error) {
    console.error('Failed to initialize RBAC system:', error);
    throw new Error(`RBAC system initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the initialized RBAC system
 */
export function getRBACSystem(): RBACSystem {
  if (!rbacSystemInstance?.isInitialized) {
    throw new Error('RBAC system not initialized. Call initializeRBACSystem() first.');
  }
  return rbacSystemInstance;
}

/**
 * Shutdown the RBAC system gracefully
 */
export async function shutdownRBACSystem(): Promise<void> {
  if (!rbacSystemInstance) {
    return;
  }

  console.log('Shutting down RBAC system...');

  try {
    // Stop monitoring
    if (rbacSystemInstance.monitor) {
      rbacSystemInstance.monitor.stopMonitoring();
    }

    // Close cache connections
    await rbacSystemInstance.cache.close();

    rbacSystemInstance.isInitialized = false;
    rbacSystemInstance = null;

    console.log('RBAC system shutdown complete');
  } catch (error) {
    console.error('Error during RBAC system shutdown:', error);
  }
}

// =============================================
// System Health and Diagnostics
// =============================================

/**
 * Perform comprehensive system health check
 */
export async function performSystemHealthCheck(
  cache: PermissionCache,
  authService: AuthorizationService,
  monitor?: CacheMonitor
): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    cache: any;
    authorization: { status: 'healthy' | 'degraded' };
    monitoring?: any;
  };
  recommendations: string[];
}> {
  const results = {
    overall: 'healthy' as const,
    components: {
      cache: await cache.healthCheck(),
      authorization: { status: 'healthy' as const },
      monitoring: monitor ? await monitor.getMonitoringHealth() : undefined
    },
    recommendations: [] as string[]
  };

  // Evaluate overall health
  let healthScore = 0;
  let maxScore = 0;

  // Cache health (40% weight)
  maxScore += 40;
  if (results.components.cache.performance.hitRate > 0.8) healthScore += 40;
  else if (results.components.cache.performance.hitRate > 0.6) healthScore += 25;
  else if (results.components.cache.performance.hitRate > 0.4) healthScore += 15;

  // L2 Cache availability (30% weight)
  maxScore += 30;
  if (results.components.cache.l2Cache.status === 'healthy') healthScore += 30;
  else if (results.components.cache.l2Cache.status === 'disabled') healthScore += 20;

  // Error rate (20% weight)
  maxScore += 20;
  if (results.components.cache.performance.errorRate < 0.01) healthScore += 20;
  else if (results.components.cache.performance.errorRate < 0.05) healthScore += 10;

  // Monitoring (10% weight)
  maxScore += 10;
  if (results.components.monitoring?.status === 'healthy') healthScore += 10;
  else if (results.components.monitoring?.status === 'degraded') healthScore += 5;

  const healthPercentage = maxScore > 0 ? healthScore / maxScore : 0;

  if (healthPercentage >= 0.8) {
    results.overall = 'healthy';
  } else if (healthPercentage >= 0.6) {
    results.overall = 'degraded';
  } else {
    results.overall = 'unhealthy';
  }

  // Generate recommendations
  results.recommendations = generateHealthRecommendations(results.components);

  return results;
}

/**
 * Generate health recommendations based on system status
 */
function generateHealthRecommendations(components: any): string[] {
  const recommendations: string[] = [];

  // Cache recommendations
  if (components.cache.performance.hitRate < 0.7) {
    recommendations.push('Consider tuning cache TTL values to improve hit rate');
  }

  if (components.cache.performance.errorRate > 0.05) {
    recommendations.push('Investigate and reduce cache error rate');
  }

  if (components.cache.l1Cache.status === 'degraded') {
    recommendations.push('L1 cache is near capacity - consider increasing max entries');
  }

  if (components.cache.l2Cache.status === 'unhealthy') {
    recommendations.push('Redis connection issues detected - check Redis health');
  }

  // Monitoring recommendations
  if (components.monitoring?.status === 'degraded') {
    recommendations.push('Cache monitoring is degraded - check monitoring configuration');
  }

  if (components.monitoring?.alerting?.activeAlerts > 5) {
    recommendations.push('Multiple active alerts - review and resolve issues');
  }

  return recommendations;
}

/**
 * Wait for cache to fully initialize
 */
async function waitForCacheInitialization(cache: PermissionCache, timeout: number = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const health = await cache.healthCheck();
      
      // Cache is considered initialized if L1 is healthy and L2 is either healthy or disabled
      if (health.l1Cache.status === 'healthy' && 
          (health.l2Cache.status === 'healthy' || health.l2Cache.status === 'disabled')) {
        return;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Continue waiting if health check fails
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  throw new Error('Cache initialization timeout');
}

// =============================================
// Utility Functions
// =============================================

/**
 * Quick system status check
 */
export async function getSystemStatus(): Promise<{
  initialized: boolean;
  uptime?: number;
  version: string;
  environment: string;
  cache?: {
    hitRate: number;
    size: number;
    errors: number;
  };
}> {
  const version = process.env.npm_package_version || '1.0.0';
  const environment = process.env.NODE_ENV || 'development';

  if (!rbacSystemInstance?.isInitialized) {
    return {
      initialized: false,
      version,
      environment
    };
  }

  const startupTime = rbacSystemInstance.cache.getMetrics().lastReset;
  const uptime = Date.now() - startupTime;
  const hitRates = rbacSystemInstance.authService.getCacheHitRate();
  const metrics = rbacSystemInstance.authService.getCacheMetrics();

  return {
    initialized: true,
    uptime,
    version,
    environment,
    cache: {
      hitRate: hitRates.overall,
      size: metrics.l1Size,
      errors: metrics.errors
    }
  };
}

/**
 * Emergency system reset (use with caution)
 */
export async function emergencySystemReset(): Promise<void> {
  console.warn('Performing emergency RBAC system reset...');
  
  if (rbacSystemInstance) {
    try {
      await rbacSystemInstance.authService.clearAllCache();
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache during reset:', error);
    }
  }
  
  await shutdownRBACSystem();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  console.log('Emergency reset complete - system will reinitialize on next request');
}

// =============================================
// Development and Testing Utilities
// =============================================

/**
 * Setup RBAC system for development/testing
 */
export async function setupRBACForTesting(options: {
  disableRedis?: boolean;
  shortTTLs?: boolean;
  enableLogging?: boolean;
} = {}): Promise<RBACSystem> {
  const testConfig: RBACSetupOptions = {
    environment: 'development',
    customConfig: {
      cache: {
        redisUrl: options.disableRedis ? undefined : process.env.TEST_REDIS_URL,
        l1TtlMs: options.shortTTLs ? 1000 : 30000, // 1 second or 30 seconds
        redisDefaultTtlSeconds: options.shortTTLs ? 2 : 60, // 2 seconds or 1 minute
        metricsCollectionInterval: 5000, // 5 seconds
      },
      monitor: {
        enableAlerting: false, // Disable alerts in tests
        metricsCollectionInterval: 5000,
      }
    },
    enableMonitoring: !process.env.CI, // Disable monitoring in CI
  };

  if (options.enableLogging) {
    console.log('Setting up RBAC system for testing with config:', testConfig);
  }

  return await initializeRBACSystem(testConfig);
}

// =============================================
// Process Lifecycle Integration
// =============================================

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down RBAC system gracefully...`);
      
      try {
        await shutdownRBACSystem();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });
}

// Auto-setup graceful shutdown in production
if (process.env.NODE_ENV === 'production') {
  setupGracefulShutdown();
}