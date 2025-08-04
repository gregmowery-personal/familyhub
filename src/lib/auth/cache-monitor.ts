import { PermissionCache, CacheMetrics } from './permission-cache'
import { AuthorizationService } from './authorization-service'

// =============================================
// Cache Monitoring and Alerting
// =============================================

export interface CacheAlert {
  id: string;
  type: 'performance' | 'capacity' | 'availability' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved?: Date;
}

export interface CacheMonitorConfig {
  // Alert thresholds
  lowHitRateThreshold: number; // Below this triggers alert
  highErrorRateThreshold: number; // Above this triggers alert
  capacityThreshold: number; // Cache utilization above this triggers alert
  slowOperationThreshold: number; // Operation time above this (ms) triggers alert
  
  // Monitoring intervals
  metricsCollectionInterval: number; // How often to collect metrics (ms)
  alertCheckInterval: number; // How often to check for alerts (ms)
  
  // Alert settings
  enableAlerting: boolean;
  alertCooldownPeriod: number; // Minimum time between same type alerts (ms)
  
  // Retention
  metricsRetentionPeriod: number; // How long to keep metrics (ms)
  alertRetentionPeriod: number; // How long to keep alerts (ms)
}

export interface CachePerformanceReport {
  timeRange: { start: Date; end: Date };
  summary: {
    totalOperations: number;
    hitRate: { l1: number; l2: number; overall: number };
    averageResponseTime: number;
    errorRate: number;
    cacheUtilization: { l1: number; l2?: number };
  };
  trends: {
    hitRateOverTime: Array<{ timestamp: Date; hitRate: number }>;
    responseTimeOverTime: Array<{ timestamp: Date; responseTime: number }>;
    errorRateOverTime: Array<{ timestamp: Date; errorRate: number }>;
  };
  alerts: CacheAlert[];
  recommendations: string[];
}

// =============================================
// Cache Monitor Implementation
// =============================================

export class CacheMonitor {
  private cache: PermissionCache;
  private authService: AuthorizationService;
  private config: CacheMonitorConfig;
  private alerts: Map<string, CacheAlert> = new Map();
  private metricsHistory: Array<{ timestamp: Date; metrics: CacheMetrics }> = [];
  private lastAlertTimes: Map<string, Date> = new Map();
  private monitoringTimer: NodeJS.Timeout | null = null;
  private alertingTimer: NodeJS.Timeout | null = null;

  constructor(
    cache: PermissionCache,
    authService: AuthorizationService,
    config?: Partial<CacheMonitorConfig>
  ) {
    this.cache = cache;
    this.authService = authService;
    this.config = {
      // Default thresholds
      lowHitRateThreshold: 0.7, // 70%
      highErrorRateThreshold: 0.05, // 5%
      capacityThreshold: 0.9, // 90%
      slowOperationThreshold: 100, // 100ms
      
      // Default intervals
      metricsCollectionInterval: 60000, // 1 minute
      alertCheckInterval: 30000, // 30 seconds
      
      // Default alert settings
      enableAlerting: true,
      alertCooldownPeriod: 300000, // 5 minutes
      
      // Default retention
      metricsRetentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertRetentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      
      ...config
    };

    this.startMonitoring();
  }

  // =============================================
  // Monitoring Control
  // =============================================

  private startMonitoring(): void {
    if (!this.config.enableAlerting) {
      console.log('Cache monitoring disabled');
      return;
    }

    // Start metrics collection
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    // Start alert checking
    this.alertingTimer = setInterval(() => {
      this.checkAlerts();
    }, this.config.alertCheckInterval);

    console.log('Cache monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.alertingTimer) {
      clearInterval(this.alertingTimer);
      this.alertingTimer = null;
    }

    console.log('Cache monitoring stopped');
  }

  // =============================================
  // Metrics Collection
  // =============================================

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = this.cache.getMetrics();
      const timestamp = new Date();

      // Store metrics with timestamp
      this.metricsHistory.push({ timestamp, metrics });

      // Clean up old metrics
      this.cleanupOldMetrics();

      // Log metrics periodically for debugging
      if (process.env.NODE_ENV === 'development') {
        this.logMetrics(metrics);
      }
    } catch (error) {
      console.error('Failed to collect cache metrics:', error);
    }
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.config.metricsRetentionPeriod);
    this.metricsHistory = this.metricsHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
  }

  private logMetrics(metrics: CacheMetrics): void {
    const totalRequests = metrics.l1Hits + metrics.l1Misses + metrics.l2Hits + metrics.l2Misses;
    if (totalRequests > 0) {
      const hitRate = (metrics.l1Hits + metrics.l2Hits) / totalRequests;
      const errorRate = metrics.errors / totalRequests;
      
      console.log(`Cache Metrics - Hit Rate: ${(hitRate * 100).toFixed(1)}%, Error Rate: ${(errorRate * 100).toFixed(2)}%, L1 Size: ${metrics.l1Size}`);
    }
  }

  // =============================================
  // Alert Management
  // =============================================

  private async checkAlerts(): Promise<void> {
    try {
      const health = await this.cache.healthCheck();
      const hitRates = this.cache.getHitRate();
      const metrics = this.cache.getMetrics();

      // Check for various alert conditions
      await Promise.all([
        this.checkHitRateAlert(hitRates),
        this.checkErrorRateAlert(metrics),
        this.checkCapacityAlert(health),
        this.checkAvailabilityAlert(health)
      ]);

      // Clean up old alerts
      this.cleanupOldAlerts();
    } catch (error) {
      console.error('Failed to check cache alerts:', error);
    }
  }

  private async checkHitRateAlert(hitRates: { l1: number; l2: number; overall: number }): Promise<void> {
    if (hitRates.overall < this.config.lowHitRateThreshold) {
      await this.createAlert({
        type: 'performance',
        severity: hitRates.overall < 0.5 ? 'high' : 'medium',
        message: `Cache hit rate is low: ${(hitRates.overall * 100).toFixed(1)}%`,
        details: { hitRates, threshold: this.config.lowHitRateThreshold }
      });
    }
  }

  private async checkErrorRateAlert(metrics: CacheMetrics): Promise<void> {
    const totalOperations = metrics.l1Hits + metrics.l1Misses + metrics.l2Hits + metrics.l2Misses;
    if (totalOperations > 0) {
      const errorRate = metrics.errors / totalOperations;
      if (errorRate > this.config.highErrorRateThreshold) {
        await this.createAlert({
          type: 'error',
          severity: errorRate > 0.1 ? 'critical' : 'high',
          message: `Cache error rate is high: ${(errorRate * 100).toFixed(2)}%`,
          details: { errorRate, errors: metrics.errors, totalOperations }
        });
      }
    }
  }

  private async checkCapacityAlert(health: any): Promise<void> {
    const l1Utilization = health.l1Cache.size / health.l1Cache.maxSize;
    if (l1Utilization > this.config.capacityThreshold) {
      await this.createAlert({
        type: 'capacity',
        severity: l1Utilization > 0.95 ? 'critical' : 'medium',
        message: `L1 cache utilization is high: ${(l1Utilization * 100).toFixed(1)}%`,
        details: { 
          l1Utilization, 
          size: health.l1Cache.size, 
          maxSize: health.l1Cache.maxSize 
        }
      });
    }
  }

  private async checkAvailabilityAlert(health: any): Promise<void> {
    if (health.l2Cache.status === 'unhealthy') {
      await this.createAlert({
        type: 'availability',
        severity: 'high',
        message: 'L2 cache (Redis) is unavailable',
        details: { l2Status: health.l2Cache.status }
      });
    }
  }

  private async createAlert(alertData: {
    type: CacheAlert['type'];
    severity: CacheAlert['severity'];
    message: string;
    details: Record<string, any>;
  }): Promise<void> {
    const alertKey = `${alertData.type}:${alertData.message}`;
    
    // Check cooldown period
    const lastAlertTime = this.lastAlertTimes.get(alertKey);
    if (lastAlertTime && Date.now() - lastAlertTime.getTime() < this.config.alertCooldownPeriod) {
      return; // Skip alert due to cooldown
    }

    const alert: CacheAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...alertData,
      timestamp: new Date()
    };

    this.alerts.set(alert.id, alert);
    this.lastAlertTimes.set(alertKey, alert.timestamp);

    // Log alert
    console.warn(`Cache Alert [${alert.severity.toUpperCase()}]: ${alert.message}`, alert.details);

    // In a real system, you might send notifications here
    await this.sendAlert(alert);
  }

  private async sendAlert(alert: CacheAlert): Promise<void> {
    // Placeholder for alert notification system
    // Could integrate with:
    // - Email notifications
    // - Slack/Discord webhooks
    // - PagerDuty
    // - Custom webhook endpoints
    
    if (process.env.CACHE_ALERT_WEBHOOK_URL) {
      try {
        await fetch(process.env.CACHE_ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'FamilyHub RBAC Cache',
            alert: {
              ...alert,
              environment: process.env.NODE_ENV || 'unknown'
            }
          })
        });
      } catch (error) {
        console.error('Failed to send cache alert webhook:', error);
      }
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = new Date(Date.now() - this.config.alertRetentionPeriod);
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffTime) {
        this.alerts.delete(id);
      }
    }
  }

  // =============================================
  // Public Interface
  // =============================================

  getActiveAlerts(): CacheAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAllAlerts(): CacheAlert[] {
    return Array.from(this.alerts.values());
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = new Date();
      return true;
    }
    return false;
  }

  getMetricsHistory(timeRange?: { start: Date; end: Date }): Array<{ timestamp: Date; metrics: CacheMetrics }> {
    if (!timeRange) {
      return [...this.metricsHistory];
    }

    return this.metricsHistory.filter(
      entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
    );
  }

  async generatePerformanceReport(timeRange?: { start: Date; end: Date }): Promise<CachePerformanceReport> {
    const range = timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    };

    const metricsInRange = this.getMetricsHistory(range);
    const alertsInRange = Array.from(this.alerts.values()).filter(
      alert => alert.timestamp >= range.start && alert.timestamp <= range.end
    );

    // Calculate summary statistics
    const summary = this.calculateSummaryStatistics(metricsInRange);
    
    // Generate trends
    const trends = this.calculateTrends(metricsInRange);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, alertsInRange);

    return {
      timeRange: range,
      summary,
      trends,
      alerts: alertsInRange,
      recommendations
    };
  }

  private calculateSummaryStatistics(metricsHistory: Array<{ timestamp: Date; metrics: CacheMetrics }>): CachePerformanceReport['summary'] {
    if (metricsHistory.length === 0) {
      return {
        totalOperations: 0,
        hitRate: { l1: 0, l2: 0, overall: 0 },
        averageResponseTime: 0,
        errorRate: 0,
        cacheUtilization: { l1: 0 }
      };
    }

    const latestMetrics = metricsHistory[metricsHistory.length - 1].metrics;
    const totalOperations = latestMetrics.l1Hits + latestMetrics.l1Misses + latestMetrics.l2Hits + latestMetrics.l2Misses;

    const hitRate = totalOperations > 0 ? {
      l1: latestMetrics.l1Hits / totalOperations,
      l2: latestMetrics.l2Hits / totalOperations,
      overall: (latestMetrics.l1Hits + latestMetrics.l2Hits) / totalOperations
    } : { l1: 0, l2: 0, overall: 0 };

    const errorRate = totalOperations > 0 ? latestMetrics.errors / totalOperations : 0;

    return {
      totalOperations,
      hitRate,
      averageResponseTime: 0, // Would need to track this separately
      errorRate,
      cacheUtilization: {
        l1: latestMetrics.l1Size / 10000 // Assuming max size, should get from config
      }
    };
  }

  private calculateTrends(metricsHistory: Array<{ timestamp: Date; metrics: CacheMetrics }>): CachePerformanceReport['trends'] {
    return {
      hitRateOverTime: metricsHistory.map(entry => {
        const totalOps = entry.metrics.l1Hits + entry.metrics.l1Misses + entry.metrics.l2Hits + entry.metrics.l2Misses;
        const hitRate = totalOps > 0 ? (entry.metrics.l1Hits + entry.metrics.l2Hits) / totalOps : 0;
        return { timestamp: entry.timestamp, hitRate };
      }),
      responseTimeOverTime: [], // Would need separate tracking
      errorRateOverTime: metricsHistory.map(entry => {
        const totalOps = entry.metrics.l1Hits + entry.metrics.l1Misses + entry.metrics.l2Hits + entry.metrics.l2Misses;
        const errorRate = totalOps > 0 ? entry.metrics.errors / totalOps : 0;
        return { timestamp: entry.timestamp, errorRate };
      })
    };
  }

  private generateRecommendations(summary: CachePerformanceReport['summary'], alerts: CacheAlert[]): string[] {
    const recommendations: string[] = [];

    if (summary.hitRate.overall < 0.7) {
      recommendations.push('Consider increasing cache TTL values to improve hit rate');
      recommendations.push('Review cache invalidation patterns to reduce unnecessary evictions');
    }

    if (summary.errorRate > 0.05) {
      recommendations.push('Investigate cache error patterns and improve error handling');
    }

    if (summary.cacheUtilization.l1 > 0.9) {
      recommendations.push('Consider increasing L1 cache size to reduce evictions');
    }

    if (alerts.some(a => a.type === 'availability')) {
      recommendations.push('Review Redis connection settings and health');
      recommendations.push('Consider implementing Redis failover or clustering');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is within acceptable parameters');
    }

    return recommendations;
  }

  // =============================================
  // Health Check
  // =============================================

  async getMonitoringHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metricsCollection: { enabled: boolean; lastCollection: Date | null };
    alerting: { enabled: boolean; activeAlerts: number };
    dataRetention: { metricsCount: number; alertsCount: number };
  }> {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (activeAlerts.length > 5) {
      status = 'degraded';
    }

    return {
      status,
      metricsCollection: {
        enabled: !!this.monitoringTimer,
        lastCollection: this.metricsHistory.length > 0 ? 
          this.metricsHistory[this.metricsHistory.length - 1].timestamp : null
      },
      alerting: {
        enabled: this.config.enableAlerting,
        activeAlerts: activeAlerts.length
      },
      dataRetention: {
        metricsCount: this.metricsHistory.length,
        alertsCount: this.alerts.size
      }
    };
  }
}

// =============================================
// Singleton and Factory
// =============================================

let cacheMonitorInstance: CacheMonitor | null = null;

export function createCacheMonitor(
  cache: PermissionCache,
  authService: AuthorizationService,
  config?: Partial<CacheMonitorConfig>
): CacheMonitor {
  return new CacheMonitor(cache, authService, config);
}

export function getCacheMonitor(
  cache: PermissionCache,
  authService: AuthorizationService
): CacheMonitor {
  if (!cacheMonitorInstance) {
    cacheMonitorInstance = new CacheMonitor(cache, authService);
  }
  return cacheMonitorInstance;
}