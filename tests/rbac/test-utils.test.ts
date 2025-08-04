/**
 * RBAC Test Utilities
 * Shared utilities, fixtures, and helpers for RBAC testing
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Test utilities and fixtures for RBAC testing
export class RBACTestUtils {
  // User fixtures
  static createTestUser(overrides: Partial<any> = {}) {
    return {
      id: this.generateId('user'),
      email: 'test@example.com',
      familyId: this.generateId('family'),
      roles: [],
      isActive: true,
      createdAt: new Date(),
      ...overrides
    };
  }

  static createTestFamily(overrides: Partial<any> = {}) {
    return {
      id: this.generateId('family'),
      name: 'Test Family',
      members: [],
      adminUsers: [],
      createdAt: new Date(),
      ...overrides
    };
  }

  static createTestRole(type: string = 'caregiver', overrides: Partial<any> = {}) {
    return {
      id: this.generateId('role'),
      type,
      state: 'active',
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Role`,
      description: `Standard ${type} role`,
      priority: 100,
      permissionSets: [`${type}_permissions`],
      tags: [],
      ...overrides
    };
  }

  static createTestPermission(resource: string, action: string, overrides: Partial<any> = {}) {
    return {
      id: this.generateId('permission'),
      resource,
      action,
      effect: 'allow' as const,
      scope: 'family' as const,
      description: `Permission to ${action} ${resource}`,
      ...overrides
    };
  }

  static createTestDelegation(fromUserId: string, toUserId: string, overrides: Partial<any> = {}) {
    return {
      id: this.generateId('delegation'),
      fromUserId,
      toUserId,
      roleId: 'role-caregiver',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reason: 'Test delegation',
      state: 'pending' as const,
      scopes: [{
        entityType: 'user',
        entityId: 'recipient-1',
        scopeType: 'individual'
      }],
      ...overrides
    };
  }

  static createTestEmergencyOverride(overrides: Partial<any> = {}) {
    return {
      id: this.generateId('emergency'),
      triggeredBy: 'emergency-contact-1',
      affectedUser: 'care-recipient-1',
      reason: 'medical_emergency' as const,
      durationMinutes: 60,
      grantedPermissions: ['medical.read', 'emergency.access'],
      notifiedUsers: ['family-admin-1'],
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      justification: 'Test emergency override',
      ...overrides
    };
  }

  // ID generation
  static generateId(prefix: string = 'test'): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Time utilities
  static mockTime(date: string | Date): Date {
    const mockDate = new Date(date);
    jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    return mockDate;
  }

  static restoreTime(): void {
    jest.restoreAllMocks();
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Performance measurement
  static async measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    return { result, duration: end - start };
  }

  static calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Test data generation
  static generateTestUsers(count: number, familyId?: string): any[] {
    return Array.from({ length: count }, (_, i) => this.createTestUser({
      id: `user-${i}`,
      email: `user${i}@test.com`,
      familyId: familyId || this.generateId('family')
    }));
  }

  static generateTestRoles(types: string[]): any[] {
    return types.map(type => this.createTestRole(type));
  }

  static generateTestPermissions(resources: string[], actions: string[]): any[] {
    const permissions = [];
    for (const resource of resources) {
      for (const action of actions) {
        permissions.push(this.createTestPermission(resource, action));
      }
    }
    return permissions;
  }

  // Mock services
  static createMockAuthService() {
    return {
      authorize: jest.fn().mockResolvedValue({ allowed: true, reason: 'MOCK_ALLOW' }),
      batchAuthorize: jest.fn().mockResolvedValue([]),
      warmupCache: jest.fn().mockResolvedValue(undefined),
      clearCache: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockResolvedValue({
        averageLatency: 10,
        p95Latency: 25,
        throughput: 1000,
        errorRate: 0.01,
        cacheHitRate: 0.85
      })
    };
  }

  static createMockRoleService() {
    return {
      assignRole: jest.fn().mockResolvedValue(undefined),
      revokeRole: jest.fn().mockResolvedValue(undefined),
      getUserRoles: jest.fn().mockResolvedValue([]),
      updateRoleState: jest.fn().mockResolvedValue(undefined),
      getRole: jest.fn().mockResolvedValue(this.createTestRole()),
      createRole: jest.fn().mockResolvedValue(this.createTestRole()),
      validateRoleAssignment: jest.fn().mockResolvedValue(true)
    };
  }

  static createMockDelegationService() {
    return {
      createDelegation: jest.fn().mockResolvedValue(this.createTestDelegation('user1', 'user2')),
      approveDelegation: jest.fn().mockResolvedValue(undefined),
      revokeDelegation: jest.fn().mockResolvedValue(undefined),
      getActiveDelegations: jest.fn().mockResolvedValue([]),
      getDelegationsForUser: jest.fn().mockResolvedValue([]),
      getDelegationsFromUser: jest.fn().mockResolvedValue([]),
      validateDelegation: jest.fn().mockResolvedValue(true),
      getExpiredDelegations: jest.fn().mockResolvedValue([]),
      cleanupExpiredDelegations: jest.fn().mockResolvedValue(0)
    };
  }

  static createMockEmergencyService() {
    return {
      activateEmergencyOverride: jest.fn().mockResolvedValue(this.createTestEmergencyOverride()),
      deactivateEmergencyOverride: jest.fn().mockResolvedValue(undefined),
      getActiveEmergencyOverrides: jest.fn().mockResolvedValue([]),
      checkEmergencyOverride: jest.fn().mockResolvedValue({ active: false }),
      validateEmergencyTrigger: jest.fn().mockResolvedValue(true),
      sendEmergencyNotifications: jest.fn().mockResolvedValue(undefined),
      auditEmergencyAccess: jest.fn().mockResolvedValue(undefined),
      cleanupExpiredOverrides: jest.fn().mockResolvedValue(0)
    };
  }

  // Assertion helpers
  static expectValidAuthResult(result: any): void {
    expect(result).toBeDefined();
    expect(typeof result.allowed).toBe('boolean');
    expect(typeof result.reason).toBe('string');
  }

  static expectValidUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(id)).toBe(true);
  }

  static expectTimeWithinRange(timestamp: Date, start: Date, end: Date): void {
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(end.getTime());
  }

  static expectPerformanceWithinLimits(metrics: { duration: number; throughput?: number }): void {
    expect(metrics.duration).toBeLessThan(100); // 100ms max
    if (metrics.throughput) {
      expect(metrics.throughput).toBeGreaterThan(100); // 100 ops/sec min
    }
  }

  // Test scenario builders
  static buildFamilyScenario(memberCount: number = 4) {
    const family = this.createTestFamily();
    const admin = this.createTestUser({ 
      familyId: family.id, 
      email: 'admin@family.com',
      roles: ['admin']
    });
    
    const careRecipient = this.createTestUser({ 
      familyId: family.id, 
      email: 'patient@family.com',
      roles: ['care_recipient']
    });
    
    const caregivers = Array.from({ length: memberCount - 2 }, (_, i) => 
      this.createTestUser({ 
        familyId: family.id, 
        email: `caregiver${i + 1}@family.com`,
        roles: ['caregiver']
      })
    );

    return {
      family,
      admin,
      careRecipient,
      caregivers,
      allMembers: [admin, careRecipient, ...caregivers]
    };
  }

  static buildDelegationScenario() {
    const scenario = this.buildFamilyScenario(3);
    const [primaryCaregiver, backupCaregiver] = scenario.caregivers;
    
    const delegation = this.createTestDelegation(primaryCaregiver.id, backupCaregiver.id, {
      validFrom: new Date('2024-02-01T00:00:00Z'),
      validUntil: new Date('2024-02-14T23:59:59Z'),
      reason: 'Vacation coverage'
    });

    return {
      ...scenario,
      primaryCaregiver,
      backupCaregiver,
      delegation
    };
  }

  static buildEmergencyScenario() {
    const scenario = this.buildFamilyScenario(2);
    const emergencyContact = this.createTestUser({
      familyId: scenario.family.id,
      email: 'emergency@family.com',
      roles: ['emergency_contact']
    });

    const emergencyOverride = this.createTestEmergencyOverride({
      triggeredBy: emergencyContact.id,
      affectedUser: scenario.careRecipient.id,
      reason: 'medical_emergency'
    });

    return {
      ...scenario,
      emergencyContact,
      emergencyOverride
    };
  }

  // Load testing utilities
  static async runLoadTest(
    operation: () => Promise<any>,
    options: {
      concurrency?: number;
      duration?: number;
      iterations?: number;
    } = {}
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    throughput: number;
  }> {
    const {
      concurrency = 10,
      duration = 5000, // 5 seconds
      iterations
    } = options;

    const results: Array<{ success: boolean; latency: number }> = [];
    const startTime = performance.now();

    if (iterations) {
      // Run specific number of iterations
      const promises = Array.from({ length: iterations }, async () => {
        const { duration: latency } = await this.measureLatency(operation);
        return { success: true, latency };
      }).slice(0, concurrency);

      const batchResults = await Promise.allSettled(promises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' 
          ? result.value 
          : { success: false, latency: 0 }
      ));
    } else {
      // Run for specific duration
      const workers = Array.from({ length: concurrency }, async () => {
        const workerResults = [];
        while (performance.now() - startTime < duration) {
          try {
            const { duration: latency } = await this.measureLatency(operation);
            workerResults.push({ success: true, latency });
          } catch (error) {
            workerResults.push({ success: false, latency: 0 });
          }
        }
        return workerResults;
      });

      const workerResults = await Promise.all(workers);
      results.push(...workerResults.flat());
    }

    const totalTime = (performance.now() - startTime) / 1000; // Convert to seconds
    const successfulResults = results.filter(r => r.success);
    const latencies = successfulResults.map(r => r.latency);

    return {
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: results.length - successfulResults.length,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length || 0,
      p95Latency: this.calculatePercentile(latencies, 95),
      throughput: results.length / totalTime
    };
  }

  // Validation utilities
  static validateRBACConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate roles
    if (!config.roles || !Array.isArray(config.roles)) {
      errors.push('Roles configuration is missing or invalid');
    }

    // Validate permissions
    if (!config.permissions || !Array.isArray(config.permissions)) {
      errors.push('Permissions configuration is missing or invalid');
    }

    // Validate permission sets
    if (!config.permissionSets || !Array.isArray(config.permissionSets)) {
      errors.push('Permission sets configuration is missing or invalid');
    }

    // Check for circular dependencies in permission sets
    if (config.permissionSets) {
      // Simple circular dependency check
      const dependencies = new Map();
      for (const permSet of config.permissionSets) {
        if (permSet.parentSetId) {
          dependencies.set(permSet.id, permSet.parentSetId);
        }
      }

      // Check for cycles
      for (const [id, parentId] of dependencies) {
        const visited = new Set();
        let current = parentId;
        while (current && !visited.has(current)) {
          visited.add(current);
          current = dependencies.get(current);
          if (current === id) {
            errors.push(`Circular dependency detected in permission set: ${id}`);
            break;
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

describe('RBAC Test Utilities', () => {
  describe('Test Data Creation', () => {
    test('should create valid test user', () => {
      const user = RBACTestUtils.createTestUser();
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.familyId).toBeDefined();
      expect(user.isActive).toBe(true);
    });

    test('should create test user with overrides', () => {
      const user = RBACTestUtils.createTestUser({
        email: 'custom@example.com',
        isActive: false
      });
      
      expect(user.email).toBe('custom@example.com');
      expect(user.isActive).toBe(false);
    });

    test('should create valid test family', () => {
      const family = RBACTestUtils.createTestFamily();
      
      expect(family.id).toBeDefined();
      expect(family.name).toBe('Test Family');
      expect(Array.isArray(family.members)).toBe(true);
    });

    test('should create valid test role', () => {
      const role = RBACTestUtils.createTestRole('caregiver');
      
      expect(role.type).toBe('caregiver');
      expect(role.state).toBe('active');
      expect(role.permissionSets).toContain('caregiver_permissions');
    });

    test('should create valid test delegation', () => {
      const delegation = RBACTestUtils.createTestDelegation('user1', 'user2');
      
      expect(delegation.fromUserId).toBe('user1');
      expect(delegation.toUserId).toBe('user2');
      expect(delegation.state).toBe('pending');
      expect(delegation.scopes).toHaveLength(1);
    });

    test('should create valid test emergency override', () => {
      const override = RBACTestUtils.createTestEmergencyOverride();
      
      expect(override.reason).toBe('medical_emergency');
      expect(override.durationMinutes).toBe(60);
      expect(Array.isArray(override.grantedPermissions)).toBe(true);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique IDs', () => {
      const id1 = RBACTestUtils.generateId('test');
      const id2 = RBACTestUtils.generateId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-[a-z0-9]+$/);
    });

    test('should generate valid UUIDs', () => {
      const uuid = RBACTestUtils.generateUUID();
      
      RBACTestUtils.expectValidUUID(uuid);
    });
  });

  describe('Performance Utilities', () => {
    test('should measure operation latency', async () => {
      const testOperation = async () => {
        await RBACTestUtils.sleep(10);
        return 'result';
      };

      const { result, duration } = await RBACTestUtils.measureLatency(testOperation);
      
      expect(result).toBe('result');
      expect(duration).toBeGreaterThan(8);
      expect(duration).toBeLessThan(50);
    });

    test('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const p50 = RBACTestUtils.calculatePercentile(values, 50);
      const p95 = RBACTestUtils.calculatePercentile(values, 95);
      
      expect(p50).toBe(5);
      expect(p95).toBe(10);
    });

    test('should run basic load test', async () => {
      const testOperation = async () => {
        await RBACTestUtils.sleep(1);
        return 'success';
      };

      const results = await RBACTestUtils.runLoadTest(testOperation, {
        concurrency: 2,
        iterations: 10
      });

      expect(results.totalRequests).toBe(2); // Limited by concurrency
      expect(results.successfulRequests).toBe(2);
      expect(results.failedRequests).toBe(0);
      expect(results.throughput).toBeGreaterThan(0);
    });
  });

  describe('Mock Services', () => {
    test('should create mock authorization service', () => {
      const mockAuth = RBACTestUtils.createMockAuthService();
      
      expect(mockAuth.authorize).toBeDefined();
      expect(mockAuth.batchAuthorize).toBeDefined();
      expect(mockAuth.getMetrics).toBeDefined();
    });

    test('should create mock role service', () => {
      const mockRole = RBACTestUtils.createMockRoleService();
      
      expect(mockRole.assignRole).toBeDefined();
      expect(mockRole.revokeRole).toBeDefined();
      expect(mockRole.getUserRoles).toBeDefined();
    });

    test('should create mock delegation service', () => {
      const mockDelegation = RBACTestUtils.createMockDelegationService();
      
      expect(mockDelegation.createDelegation).toBeDefined();
      expect(mockDelegation.approveDelegation).toBeDefined();
      expect(mockDelegation.getActiveDelegations).toBeDefined();
    });
  });

  describe('Scenario Builders', () => {
    test('should build complete family scenario', () => {
      const scenario = RBACTestUtils.buildFamilyScenario(4);
      
      expect(scenario.family).toBeDefined();
      expect(scenario.admin).toBeDefined();
      expect(scenario.careRecipient).toBeDefined();
      expect(scenario.caregivers).toHaveLength(2); // 4 total - admin - care recipient
      expect(scenario.allMembers).toHaveLength(4);
    });

    test('should build delegation scenario', () => {
      const scenario = RBACTestUtils.buildDelegationScenario();
      
      expect(scenario.primaryCaregiver).toBeDefined();
      expect(scenario.backupCaregiver).toBeDefined();
      expect(scenario.delegation).toBeDefined();
      expect(scenario.delegation.fromUserId).toBe(scenario.primaryCaregiver.id);
      expect(scenario.delegation.toUserId).toBe(scenario.backupCaregiver.id);
    });

    test('should build emergency scenario', () => {
      const scenario = RBACTestUtils.buildEmergencyScenario();
      
      expect(scenario.emergencyContact).toBeDefined();
      expect(scenario.emergencyOverride).toBeDefined();
      expect(scenario.emergencyOverride.triggeredBy).toBe(scenario.emergencyContact.id);
    });
  });

  describe('Validation Utilities', () => {
    test('should validate valid RBAC configuration', () => {
      const validConfig = {
        roles: [
          { id: 'role1', type: 'admin' }
        ],
        permissions: [
          { id: 'perm1', resource: 'user', action: 'read' }
        ],
        permissionSets: [
          { id: 'set1', name: 'Admin Set' }
        ]
      };

      const validation = RBACTestUtils.validateRBACConfiguration(validConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid RBAC configuration', () => {
      const invalidConfig = {
        // Missing required fields
      };

      const validation = RBACTestUtils.validateRBACConfiguration(invalidConfig);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should detect circular dependencies in permission sets', () => {
      const configWithCircularDeps = {
        roles: [],
        permissions: [],
        permissionSets: [
          { id: 'set1', parentSetId: 'set2' },
          { id: 'set2', parentSetId: 'set1' } // Circular dependency
        ]
      };

      const validation = RBACTestUtils.validateRBACConfiguration(configWithCircularDeps);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('Circular dependency'))).toBe(true);
    });
  });

  describe('Assertion Helpers', () => {
    test('should validate authorization result', () => {
      const validResult = { allowed: true, reason: 'ADMIN_ACCESS' };
      const invalidResult = { allowed: 'yes' }; // Wrong type

      expect(() => RBACTestUtils.expectValidAuthResult(validResult)).not.toThrow();
      expect(() => RBACTestUtils.expectValidAuthResult(invalidResult)).toThrow();
    });

    test('should validate UUID format', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const invalidUUID = 'not-a-uuid';

      expect(() => RBACTestUtils.expectValidUUID(validUUID)).not.toThrow();
      expect(() => RBACTestUtils.expectValidUUID(invalidUUID)).toThrow();
    });

    test('should validate time ranges', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const middle = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2024-01-02T00:00:00Z');
      const outside = new Date('2024-01-03T00:00:00Z');

      expect(() => RBACTestUtils.expectTimeWithinRange(middle, start, end)).not.toThrow();
      expect(() => RBACTestUtils.expectTimeWithinRange(outside, start, end)).toThrow();
    });
  });
});

// Export for use in other test files
export default RBACTestUtils;