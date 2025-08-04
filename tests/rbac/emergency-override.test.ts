/**
 * RBAC Emergency Override Tests
 * Testing emergency access scenarios, override activation, audit trails, and security controls
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock interfaces based on RBAC design
interface EmergencyOverride {
  id: string;
  triggeredBy: string;
  affectedUser: string;
  reason: 'no_response_24h' | 'panic_button' | 'admin_override' | 'medical_emergency';
  durationMinutes: number;
  grantedPermissions: string[];
  notifiedUsers: string[];
  activatedAt: Date;
  expiresAt: Date;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  justification: string;
}

interface EmergencyService {
  activateEmergencyOverride(request: EmergencyOverrideRequest): Promise<EmergencyOverride>;
  deactivateEmergencyOverride(overrideId: string, deactivatedBy: string): Promise<void>;
  getActiveEmergencyOverrides(userId?: string): Promise<EmergencyOverride[]>;
  checkEmergencyOverride(userId: string, resourceId: string): Promise<{ active: boolean; override?: EmergencyOverride }>;
  validateEmergencyTrigger(triggeredBy: string, reason: string): Promise<boolean>;
  sendEmergencyNotifications(override: EmergencyOverride): Promise<void>;
  auditEmergencyAccess(userId: string, action: string, resourceId: string, override: EmergencyOverride): Promise<void>;
  cleanupExpiredOverrides(): Promise<number>;
}

interface EmergencyOverrideRequest {
  triggeredBy: string;
  affectedUser?: string;
  reason: 'no_response_24h' | 'panic_button' | 'admin_override' | 'medical_emergency';
  durationMinutes?: number;
  justification: string;
  permissions?: string[];
  notifyUsers?: string[];
}

// Test data factories
const createEmergencyOverride = (reason: string = 'medical_emergency'): EmergencyOverride => ({
  id: testUtils.generateTestId('emergency'),
  triggeredBy: 'emergency-contact-1',
  affectedUser: 'care-recipient-1',
  reason: reason as any,
  durationMinutes: 60,
  grantedPermissions: ['medical.read', 'emergency.access', 'contact.notify'],
  notifiedUsers: ['family-admin-1', 'primary-caregiver-1'],
  activatedAt: new Date(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  justification: 'Medical emergency - ambulance called, need immediate access to medical history'
});

describe('RBAC Emergency Override System', () => {
  let mockEmergencyService: EmergencyService;

  beforeEach(() => {
    mockEmergencyService = {
      async activateEmergencyOverride(request) {
        const override = createEmergencyOverride(request.reason);
        override.triggeredBy = request.triggeredBy;
        override.affectedUser = request.affectedUser || request.triggeredBy;
        override.justification = request.justification;
        
        if (request.durationMinutes) {
          override.durationMinutes = request.durationMinutes;
          override.expiresAt = new Date(Date.now() + request.durationMinutes * 60 * 1000);
        }
        
        if (request.permissions) {
          override.grantedPermissions = request.permissions;
        }
        
        if (request.notifyUsers) {
          override.notifiedUsers = request.notifyUsers;
        }
        
        return override;
      },

      async deactivateEmergencyOverride(overrideId, deactivatedBy) {
        // Mock deactivation
      },

      async getActiveEmergencyOverrides(userId) {
        const override = createEmergencyOverride();
        if (userId) {
          override.affectedUser = userId;
        }
        return [override];
      },

      async checkEmergencyOverride(userId, resourceId) {
        const override = createEmergencyOverride();
        override.affectedUser = userId;
        return { active: true, override };
      },

      async validateEmergencyTrigger(triggeredBy, reason) {
        // Basic validation: user must exist and reason must be valid
        return triggeredBy.length > 0 && ['no_response_24h', 'panic_button', 'admin_override', 'medical_emergency'].includes(reason);
      },

      async sendEmergencyNotifications(override) {
        // Mock notification sending
      },

      async auditEmergencyAccess(userId, action, resourceId, override) {
        // Mock audit logging
      },

      async cleanupExpiredOverrides() {
        return 3; // Mock cleanup count
      }
    };
  });

  describe('Emergency Override Activation', () => {
    test('should activate medical emergency override', async () => {
      const request: EmergencyOverrideRequest = {
        triggeredBy: 'emergency-contact-1',
        affectedUser: 'elderly-parent-1',
        reason: 'medical_emergency',
        durationMinutes: 120,
        justification: 'Patient collapsed, paramedics need medical history access',
        permissions: ['medical.read', 'medication.read', 'emergency.contact'],
        notifyUsers: ['primary-caregiver-1', 'family-doctor-1']
      };

      const override = await mockEmergencyService.activateEmergencyOverride(request);

      expect(override.id).toHaveValidUUID();
      expect(override.triggeredBy).toBe('emergency-contact-1');
      expect(override.affectedUser).toBe('elderly-parent-1');
      expect(override.reason).toBe('medical_emergency');
      expect(override.durationMinutes).toBe(120);
      expect(override.grantedPermissions).toContain('medical.read');
      expect(override.notifiedUsers).toContain('primary-caregiver-1');
      expect(override.expiresAt.getTime() - override.activatedAt.getTime()).toBe(120 * 60 * 1000);
    });

    test('should activate panic button override', async () => {
      const request: EmergencyOverrideRequest = {
        triggeredBy: 'care-recipient-1',
        reason: 'panic_button',
        durationMinutes: 30,
        justification: 'Panic button pressed - emergency response needed'
      };

      const override = await mockEmergencyService.activateEmergencyOverride(request);

      expect(override.reason).toBe('panic_button');
      expect(override.triggeredBy).toBe('care-recipient-1');
      expect(override.affectedUser).toBe('care-recipient-1'); // Self-triggered
      expect(override.durationMinutes).toBe(30);
    });

    test('should activate no-response emergency override', async () => {
      const request: EmergencyOverrideRequest = {
        triggeredBy: 'automated-system',
        affectedUser: 'elderly-parent-1',
        reason: 'no_response_24h',
        durationMinutes: 240, // 4 hours
        justification: 'No response to check-in for 24 hours, welfare check needed'
      };

      const override = await mockEmergencyService.activateEmergencyOverride(request);

      expect(override.reason).toBe('no_response_24h');
      expect(override.triggeredBy).toBe('automated-system');
      expect(override.durationMinutes).toBe(240);
    });

    test('should activate admin override for system maintenance', async () => {
      const request: EmergencyOverrideRequest = {
        triggeredBy: 'system-admin-1',
        reason: 'admin_override',
        durationMinutes: 60,
        justification: 'Critical system maintenance requires elevated access',
        permissions: ['system.admin', 'database.access', 'user.impersonate']
      };

      const override = await mockEmergencyService.activateEmergencyOverride(request);

      expect(override.reason).toBe('admin_override');
      expect(override.grantedPermissions).toContain('system.admin');
      expect(override.triggeredBy).toBe('system-admin-1');
    });

    test('should validate emergency trigger authority', async () => {
      // Valid triggers
      expect(await mockEmergencyService.validateEmergencyTrigger('emergency-contact-1', 'medical_emergency')).toBe(true);
      expect(await mockEmergencyService.validateEmergencyTrigger('care-recipient-1', 'panic_button')).toBe(true);
      expect(await mockEmergencyService.validateEmergencyTrigger('admin-1', 'admin_override')).toBe(true);

      // Invalid triggers
      expect(await mockEmergencyService.validateEmergencyTrigger('', 'medical_emergency')).toBe(false);
      expect(await mockEmergencyService.validateEmergencyTrigger('user-1', 'invalid_reason' as any)).toBe(false);
    });

    test('should enforce maximum duration limits', async () => {
      const mockLimitedService = {
        ...mockEmergencyService,
        async activateEmergencyOverride(request: EmergencyOverrideRequest) {
          const maxDuration = 24 * 60; // 24 hours max
          
          if (request.durationMinutes && request.durationMinutes > maxDuration) {
            throw new Error(`Duration cannot exceed ${maxDuration} minutes`);
          }
          
          return createEmergencyOverride(request.reason);
        }
      };

      // Should allow valid duration
      await expect(mockLimitedService.activateEmergencyOverride({
        triggeredBy: 'admin-1',
        reason: 'admin_override',
        durationMinutes: 120,
        justification: 'Test'
      })).resolves.not.toThrow();

      // Should reject excessive duration
      await expect(mockLimitedService.activateEmergencyOverride({
        triggeredBy: 'admin-1',
        reason: 'admin_override',
        durationMinutes: 25 * 60, // 25 hours
        justification: 'Test'
      })).rejects.toThrow('Duration cannot exceed 1440 minutes');
    });
  });

  describe('Emergency Override Authorization', () => {
    test('should grant emergency access during active override', async () => {
      const userId = 'emergency-responder-1';
      const resourceId = 'medical-record-1';

      const { active, override } = await mockEmergencyService.checkEmergencyOverride(userId, resourceId);

      expect(active).toBe(true);
      expect(override).toBeDefined();
      expect(override!.affectedUser).toBe(userId);
      expect(override!.expiresAt).toBeAfter(new Date());
    });

    test('should deny access when no emergency override exists', async () => {
      const mockNoOverrideService = {
        ...mockEmergencyService,
        async checkEmergencyOverride(userId: string, resourceId: string) {
          return { active: false };
        }
      };

      const { active, override } = await mockNoOverrideService.checkEmergencyOverride('user-1', 'resource-1');

      expect(active).toBe(false);
      expect(override).toBeUndefined();
    });

    test('should audit all emergency access attempts', async () => {
      let auditEntries: any[] = [];

      const mockAuditService = {
        ...mockEmergencyService,
        async auditEmergencyAccess(userId: string, action: string, resourceId: string, override: EmergencyOverride) {
          auditEntries.push({
            userId,
            action,
            resourceId,
            overrideId: override.id,
            timestamp: new Date(),
            reason: override.reason
          });
        }
      };

      const override = createEmergencyOverride();
      await mockAuditService.auditEmergencyAccess('user-1', 'medical.read', 'record-1', override);

      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].userId).toBe('user-1');
      expect(auditEntries[0].action).toBe('medical.read');
      expect(auditEntries[0].reason).toBe('medical_emergency');
    });

    test('should restrict permissions to granted set during emergency', async () => {
      const override = createEmergencyOverride();
      override.grantedPermissions = ['medical.read', 'contact.notify'];

      const mockRestrictedService = {
        ...mockEmergencyService,
        async checkEmergencyOverride(userId: string, resourceId: string) {
          return { active: true, override };
        },
        hasEmergencyPermission(override: EmergencyOverride, requiredPermission: string): boolean {
          return override.grantedPermissions.includes(requiredPermission);
        }
      };

      const { active, override: activeOverride } = await mockRestrictedService.checkEmergencyOverride('user-1', 'resource-1');

      expect(active).toBe(true);
      expect(mockRestrictedService.hasEmergencyPermission(activeOverride!, 'medical.read')).toBe(true);
      expect(mockRestrictedService.hasEmergencyPermission(activeOverride!, 'admin.delete')).toBe(false);
    });
  });

  describe('Emergency Override Deactivation', () => {
    test('should deactivate emergency override manually', async () => {
      const overrideId = 'emergency-123';
      const deactivatedBy = 'admin-1';

      await expect(mockEmergencyService.deactivateEmergencyOverride(overrideId, deactivatedBy))
        .resolves.not.toThrow();
    });

    test('should auto-deactivate expired overrides', async () => {
      const cleanupCount = await mockEmergencyService.cleanupExpiredOverrides();

      expect(cleanupCount).toBeGreaterThanOrEqual(0);
      expect(typeof cleanupCount).toBe('number');
    });

    test('should handle deactivation at exact expiry time', async () => {
      const expiryTime = new Date('2024-01-15T12:00:00Z');
      testUtils.mockDate('2024-01-15T12:00:01Z'); // 1 second after expiry

      const mockExpiryService = {
        ...mockEmergencyService,
        async checkEmergencyOverride(userId: string, resourceId: string) {
          const override = createEmergencyOverride();
          override.expiresAt = expiryTime;
          
          // Check if expired
          const now = new Date();
          const active = override.expiresAt > now;
          
          return { active, override: active ? override : undefined };
        }
      };

      const { active, override } = await mockExpiryService.checkEmergencyOverride('user-1', 'resource-1');

      expect(active).toBe(false);
      expect(override).toBeUndefined();
    });

    test('should send deactivation notifications', async () => {
      let deactivationNotifications: string[] = [];

      const mockNotifyService = {
        ...mockEmergencyService,
        async deactivateEmergencyOverride(overrideId: string, deactivatedBy: string) {
          deactivationNotifications = [
            'emergency-deactivated-to-triggerer',
            'emergency-deactivated-to-family-admin',
            'emergency-deactivated-to-security-team'
          ];
        }
      };

      await mockNotifyService.deactivateEmergencyOverride('emergency-123', 'admin-1');

      expect(deactivationNotifications).toHaveLength(3);
      expect(deactivationNotifications).toContain('emergency-deactivated-to-security-team');
    });
  });

  describe('Emergency Notification System', () => {
    test('should notify all relevant parties on activation', async () => {
      let notificationsSent: Array<{ recipient: string; message: string; priority: string }> = [];

      const mockNotificationService = {
        ...mockEmergencyService,
        async sendEmergencyNotifications(override: EmergencyOverride) {
          for (const userId of override.notifiedUsers) {
            notificationsSent.push({
              recipient: userId,
              message: `Emergency override activated for ${override.affectedUser}`,
              priority: 'HIGH'
            });
          }
        }
      };

      const override = createEmergencyOverride();
      await mockNotificationService.sendEmergencyNotifications(override);

      expect(notificationsSent).toHaveLength(2);
      expect(notificationsSent[0].priority).toBe('HIGH');
      expect(notificationsSent[0].message).toContain('Emergency override activated');
    });

    test('should escalate notifications for critical emergencies', async () => {
      const criticalOverride = createEmergencyOverride('medical_emergency');
      criticalOverride.notifiedUsers = [
        'primary-caregiver-1',
        'family-doctor-1',
        'emergency-contact-1',
        'family-admin-1'
      ];

      let escalationNotifications: string[] = [];

      const mockEscalationService = {
        ...mockEmergencyService,
        async sendEmergencyNotifications(override: EmergencyOverride) {
          if (override.reason === 'medical_emergency') {
            escalationNotifications = [
              'sms-notification',
              'email-notification',
              'push-notification',
              'phone-call-notification'
            ];
          }
        }
      };

      await mockEscalationService.sendEmergencyNotifications(criticalOverride);

      expect(escalationNotifications).toHaveLength(4);
      expect(escalationNotifications).toContain('phone-call-notification');
    });

    test('should handle notification failures gracefully', async () => {
      const mockFailureService = {
        ...mockEmergencyService,
        async sendEmergencyNotifications(override: EmergencyOverride) {
          // Simulate partial notification failure
          const results = override.notifiedUsers.map((userId, index) => ({
            userId,
            success: index < 1, // First notification succeeds, others fail
            error: index >= 1 ? 'Network timeout' : null
          }));
          
          return results;
        }
      };

      const override = createEmergencyOverride();
      const results = await mockFailureService.sendEmergencyNotifications(override);

      expect(results).toBeDefined();
      // Emergency system should continue functioning even with notification failures
    });

    test('should send periodic status updates during long emergencies', async () => {
      let statusUpdates: Array<{ timestamp: Date; message: string }> = [];

      const mockStatusService = {
        ...mockEmergencyService,
        async sendPeriodicStatusUpdate(override: EmergencyOverride) {
          const elapsed = Date.now() - override.activatedAt.getTime();
          const remaining = override.expiresAt.getTime() - Date.now();
          
          statusUpdates.push({
            timestamp: new Date(),
            message: `Emergency override still active. Elapsed: ${Math.round(elapsed / 60000)}min, Remaining: ${Math.round(remaining / 60000)}min`
          });
        }
      };

      const longOverride = createEmergencyOverride();
      longOverride.durationMinutes = 240; // 4 hours
      
      await mockStatusService.sendPeriodicStatusUpdate(longOverride);

      expect(statusUpdates).toHaveLength(1);
      expect(statusUpdates[0].message).toContain('Emergency override still active');
    });
  });

  describe('Emergency Override Audit and Compliance', () => {
    test('should maintain detailed audit trail', async () => {
      let auditTrail: Array<{
        timestamp: Date;
        event: string;
        details: any;
      }> = [];

      const mockAuditService = {
        ...mockEmergencyService,
        async auditEmergencyAccess(userId: string, action: string, resourceId: string, override: EmergencyOverride) {
          auditTrail.push({
            timestamp: new Date(),
            event: 'emergency_access',
            details: {
              userId,
              action,
              resourceId,
              overrideId: override.id,
              reason: override.reason,
              triggeredBy: override.triggeredBy
            }
          });
        }
      };

      const override = createEmergencyOverride();
      await mockAuditService.auditEmergencyAccess('user-1', 'medical.read', 'record-1', override);

      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].event).toBe('emergency_access');
      expect(auditTrail[0].details.userId).toBe('user-1');
      expect(auditTrail[0].details.overrideId).toBe(override.id);
    });

    test('should generate emergency override reports', async () => {
      const mockReportService = {
        ...mockEmergencyService,
        async generateEmergencyReport(dateRange: { start: Date; end: Date }) {
          return {
            reportPeriod: dateRange,
            totalOverrides: 8,
            overridesByReason: {
              medical_emergency: 4,
              panic_button: 2,
              no_response_24h: 1,
              admin_override: 1
            },
            averageDuration: '2.5 hours',
            falseAlarms: 1,
            responseTime: '3.2 minutes',
            securityIncidents: 0,
            mostTriggeredBy: 'emergency-contact-1'
          };
        }
      };

      const report = await mockReportService.generateEmergencyReport({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      });

      expect(report.totalOverrides).toBe(8);
      expect(report.overridesByReason.medical_emergency).toBe(4);
      expect(report.falseAlarms).toBe(1);
      expect(report.securityIncidents).toBe(0);
    });

    test('should track override effectiveness metrics', async () => {
      const mockMetricsService = {
        ...mockEmergencyService,
        async getOverrideMetrics() {
          return {
            totalActivations: 25,
            successfulOutcomes: 23,
            falsePositives: 2,
            averageResponseTime: 180, // seconds
            userSatisfactionScore: 4.8,
            systemReliability: 99.2
          };
        }
      };

      const metrics = await mockMetricsService.getOverrideMetrics();

      expect(metrics.totalActivations).toBe(25);
      expect(metrics.successfulOutcomes).toBe(23);
      expect(metrics.averageResponseTime).toBe(180);
      expect(metrics.systemReliability).toBe(99.2);
    });
  });

  describe('Emergency Override Security', () => {
    test('should prevent abuse of emergency system', async () => {
      let abuseAttempts = 0;

      const mockSecurityService = {
        ...mockEmergencyService,
        async activateEmergencyOverride(request: EmergencyOverrideRequest) {
          // Check for abuse patterns
          if (request.triggeredBy === 'abusive-user-1') {
            abuseAttempts++;
            if (abuseAttempts > 3) {
              throw new Error('Emergency override abuse detected - user blocked');
            }
          }
          
          return createEmergencyOverride(request.reason);
        }
      };

      // Normal usage should work
      await expect(mockSecurityService.activateEmergencyOverride({
        triggeredBy: 'legitimate-user-1',
        reason: 'medical_emergency',
        justification: 'Real emergency'
      })).resolves.not.toThrow();

      // Abuse attempts should be blocked
      for (let i = 0; i < 3; i++) {
        await mockSecurityService.activateEmergencyOverride({
          triggeredBy: 'abusive-user-1',
          reason: 'medical_emergency',
          justification: 'Fake emergency'
        });
      }

      await expect(mockSecurityService.activateEmergencyOverride({
        triggeredBy: 'abusive-user-1',
        reason: 'medical_emergency',
        justification: 'Another fake emergency'
      })).rejects.toThrow('Emergency override abuse detected');
    });

    test('should require strong justification for admin overrides', async () => {
      const mockJustificationService = {
        ...mockEmergencyService,
        async activateEmergencyOverride(request: EmergencyOverrideRequest) {
          if (request.reason === 'admin_override') {
            if (!request.justification || request.justification.length < 50) {
              throw new Error('Admin override requires detailed justification (minimum 50 characters)');
            }
          }
          
          return createEmergencyOverride(request.reason);
        }
      };

      // Should reject weak justification
      await expect(mockJustificationService.activateEmergencyOverride({
        triggeredBy: 'admin-1',
        reason: 'admin_override',
        justification: 'Need access'
      })).rejects.toThrow('Admin override requires detailed justification');

      // Should accept strong justification
      await expect(mockJustificationService.activateEmergencyOverride({
        triggeredBy: 'admin-1',
        reason: 'admin_override',
        justification: 'Critical system maintenance required to fix database corruption affecting patient safety monitoring systems'
      })).resolves.not.toThrow();
    });

    test('should implement rate limiting for emergency activations', async () => {
      let activationCount = 0;

      const mockRateLimitService = {
        ...mockEmergencyService,
        async activateEmergencyOverride(request: EmergencyOverrideRequest) {
          activationCount++;
          
          // Rate limit: max 5 activations per user per hour
          if (activationCount > 5) {
            throw new Error('Rate limit exceeded for emergency activations');
          }
          
          return createEmergencyOverride(request.reason);
        }
      };

      // Should allow normal usage
      for (let i = 0; i < 5; i++) {
        await expect(mockRateLimitService.activateEmergencyOverride({
          triggeredBy: 'user-1',
          reason: 'medical_emergency',
          justification: `Emergency ${i + 1}`
        })).resolves.not.toThrow();
      }

      // Should block excessive usage
      await expect(mockRateLimitService.activateEmergencyOverride({
        triggeredBy: 'user-1',
        reason: 'medical_emergency',
        justification: 'Too many emergencies'
      })).rejects.toThrow('Rate limit exceeded');
    });
  });

  afterEach(() => {
    testUtils.restoreDate();
  });
});