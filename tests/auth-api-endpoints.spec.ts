import { test, expect } from '@playwright/test';
import { 
  testUsers, 
  apiResponses, 
  securityTestData,
  rateLimitConfigs,
  errorMessages 
} from './helpers/auth-fixtures';

test.describe('Authentication API Endpoints', () => {
  let baseURL: string;

  test.beforeAll(async () => {
    baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001';
  });

  test.describe('/api/auth/login', () => {
    test.describe('Successful Login', () => {
      test('should login with valid credentials', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password,
            rememberMe: false
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('user');
        expect(data.data).toHaveProperty('session');
        expect(data.data.user).toHaveProperty('id');
        expect(data.data.user).toHaveProperty('email');
        expect(data.data.session).toHaveProperty('access_token');
        expect(data.data.session).toHaveProperty('refresh_token');
      });

      test('should handle remember me option', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password,
            rememberMe: true
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        
        // Should include session data for persistent login
        expect(data.data.session.expires_in).toBeGreaterThan(3600); // Longer than 1 hour
      });

      test('should return user profile and families', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.data).toHaveProperty('profile');
        expect(data.data).toHaveProperty('families');
        expect(Array.isArray(data.data.families)).toBe(true);
      });

      test('should set proper session headers', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        expect(response.status()).toBe(200);

        // Check for security headers
        expect(response.headers()['x-content-type-options']).toBe('nosniff');
        expect(response.headers()['cache-control']).toContain('no-cache');
      });
    });

    test.describe('Login Failures', () => {
      test('should reject invalid email format', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'invalid-email',
            password: testUsers.valid.password
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.errors).toHaveProperty('email');
        expect(data.errors.email).toContain('valid email address');
      });

      test('should reject missing required fields', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {}
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.errors).toHaveProperty('email');
        expect(data.errors).toHaveProperty('password');
      });

      test('should reject invalid credentials', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: 'wrongpassword'
          }
        });

        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(errorMessages.auth.invalidCredentials);
        expect(data.code).toBe('INVALID_CREDENTIALS');
      });

      test('should handle unverified email', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.unverified.email,
            password: testUsers.unverified.password
          }
        });

        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(errorMessages.auth.emailNotVerified);
        expect(data.code).toBe('EMAIL_NOT_VERIFIED');
      });

      test('should handle account lockout', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.blocked.email,
            password: testUsers.blocked.password
          }
        });

        expect(response.status()).toBe(423);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(errorMessages.auth.accountLocked);
        expect(data.code).toBe('ACCOUNT_LOCKED');
      });
    });

    test.describe('Rate Limiting', () => {
      test('should enforce rate limits for failed attempts', async ({ request }) => {
        const { limit } = rateLimitConfigs.login;
        
        // Make multiple failed login attempts
        for (let i = 0; i < limit; i++) {
          const response = await request.post('/api/auth/login', {
            data: {
              email: testUsers.valid.email,
              password: 'wrongpassword'
            }
          });
          expect(response.status()).toBe(401);
        }

        // Next attempt should be rate limited
        const rateLimitedResponse = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: 'wrongpassword'
          }
        });

        expect(rateLimitedResponse.status()).toBe(429);

        const data = await rateLimitedResponse.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(errorMessages.auth.tooManyRequests);
        expect(data.code).toBe('TOO_MANY_REQUESTS');

        // Should include rate limit headers
        expect(rateLimitedResponse.headers()['retry-after']).toBeTruthy();
        expect(rateLimitedResponse.headers()['x-ratelimit-limit']).toBe(limit.toString());
        expect(rateLimitedResponse.headers()['x-ratelimit-remaining']).toBe('0');
      });

      test('should reset rate limit after successful login', async ({ request }) => {
        // Make a few failed attempts
        for (let i = 0; i < 3; i++) {
          await request.post('/api/auth/login', {
            data: {
              email: testUsers.valid.email,
              password: 'wrongpassword'
            }
          });
        }

        // Successful login should reset rate limit
        const successResponse = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        expect(successResponse.status()).toBe(200);

        // Should be able to make more attempts after success
        const nextAttemptResponse = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: 'wrongpassword'
          }
        });

        expect(nextAttemptResponse.status()).toBe(401); // Normal failure, not rate limited
      });
    });

    test.describe('Security Features', () => {
      test('should detect suspicious activity patterns', async ({ request }) => {
        // Simulate rapid failed attempts from same IP
        const promises = [];
        for (let i = 0; i < 20; i++) {
          promises.push(
            request.post('/api/auth/login', {
              data: {
                email: `test${i}@example.com`,
                password: 'wrongpassword'
              }
            })
          );
        }

        await Promise.all(promises);

        // Next request should be blocked due to suspicious activity
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        expect(response.status()).toBe(423);

        const data = await response.json();
        expect(data.error).toContain('suspicious activity');
      });

      test('should log authentication events', async ({ request }) => {
        // This test would typically check audit logs
        // For now, we'll verify the response includes audit metadata
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.data).toHaveProperty('session_id');
        
        // Verify session tracking
        expect(data.data.session_id).toBeTruthy();
        expect(typeof data.data.session_id).toBe('string');
      });

      test('should sanitize input data', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: '  TEST@EXAMPLE.COM  ', // Should be trimmed and lowercased
            password: testUsers.valid.password
          }
        });

        // Should process the email correctly despite formatting
        expect(response.status()).toBe(401); // Will fail auth but not validation
      });
    });

    test.describe('CORS Headers', () => {
      test('should include proper CORS headers', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        const headers = response.headers();
        expect(headers['access-control-allow-origin']).toBeTruthy();
        expect(headers['access-control-allow-methods']).toContain('POST');
        expect(headers['access-control-allow-headers']).toContain('Content-Type');
      });

      test('should handle OPTIONS preflight requests', async ({ request }) => {
        const response = await request.fetch('/api/auth/login', {
          method: 'OPTIONS'
        });

        expect(response.status()).toBe(200);

        const headers = response.headers();
        expect(headers['access-control-allow-methods']).toContain('POST');
        expect(headers['access-control-allow-headers']).toBeTruthy();
      });
    });
  });

  test.describe('/api/auth/signup', () => {
    test.describe('Successful Signup', () => {
      test('should create account with valid data', async ({ request }) => {
        const uniqueEmail = `test-${Date.now()}@example.com`;
        
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: testUsers.valid.firstName,
            lastName: testUsers.valid.lastName,
            email: uniqueEmail,
            password: testUsers.valid.password,
            acceptTerms: true,
            subscribeNewsletter: false
          }
        });

        expect(response.status()).toBe(201);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('user');
        expect(data.data.user.email).toBe(uniqueEmail);
        expect(data.data.user.email_confirmed_at).toBeNull(); // Should require verification
        expect(data.message).toContain('check your email');
      });

      test('should handle newsletter subscription option', async ({ request }) => {
        const uniqueEmail = `test-newsletter-${Date.now()}@example.com`;
        
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: testUsers.valid.firstName,
            lastName: testUsers.valid.lastName,
            email: uniqueEmail,
            password: testUsers.valid.password,
            acceptTerms: true,
            subscribeNewsletter: true
          }
        });

        expect(response.status()).toBe(201);

        const data = await response.json();
        expect(data.success).toBe(true);
        // Newsletter subscription should be recorded in user profile
        expect(data.data).toHaveProperty('user');
      });

      test('should create user profile', async ({ request }) => {
        const uniqueEmail = `test-profile-${Date.now()}@example.com`;
        
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: 'John',
            lastName: 'Doe',
            email: uniqueEmail,
            password: testUsers.valid.password,
            acceptTerms: true
          }
        });

        expect(response.status()).toBe(201);

        const data = await response.json();
        expect(data.data).toHaveProperty('profile');
        expect(data.data.profile.first_name).toBe('John');
        expect(data.data.profile.last_name).toBe('Doe');
      });
    });

    test.describe('Signup Validation', () => {
      test('should validate required fields', async ({ request }) => {
        const response = await request.post('/api/auth/signup', {
          data: {}
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.errors).toHaveProperty('firstName');
        expect(data.errors).toHaveProperty('lastName');
        expect(data.errors).toHaveProperty('email');
        expect(data.errors).toHaveProperty('password');
        expect(data.errors).toHaveProperty('acceptTerms');
      });

      test('should validate name format', async ({ request }) => {
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: '',
            lastName: 'A', // Too short
            email: testUsers.valid.email,
            password: testUsers.valid.password,
            acceptTerms: true
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.firstName).toContain('required');
        expect(data.errors.lastName).toContain('at least 2 characters');
      });

      test('should validate password strength', async ({ request }) => {
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: testUsers.valid.firstName,
            lastName: testUsers.valid.lastName,
            email: testUsers.valid.email,
            password: 'weak', // Too weak
            acceptTerms: true
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.password).toBeTruthy();
        expect(data.errors.password.some((error: string) => 
          error.includes('uppercase') || 
          error.includes('number') || 
          error.includes('8 characters')
        )).toBe(true);
      });

      test('should require terms acceptance', async ({ request }) => {
        const response = await request.post('/api/auth/signup', {
          data: {
            firstName: testUsers.valid.firstName,
            lastName: testUsers.valid.lastName,
            email: testUsers.valid.email,
            password: testUsers.valid.password,
            acceptTerms: false
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.acceptTerms).toContain('accept the terms');
      });

      test('should prevent duplicate email registration', async ({ request }) => {
        // First registration should succeed
        const firstResponse = await request.post('/api/auth/signup', {
          data: {
            firstName: testUsers.valid.firstName,
            lastName: testUsers.valid.lastName,
            email: testUsers.valid.email,
            password: testUsers.valid.password,
            acceptTerms: true
          }
        });

        expect(firstResponse.status()).toBe(201);

        // Second registration with same email should fail
        const secondResponse = await request.post('/api/auth/signup', {
          data: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: testUsers.valid.email, // Same email
            password: 'DifferentPass123!',
            acceptTerms: true
          }
        });

        expect(secondResponse.status()).toBe(409);

        const data = await secondResponse.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('already exists');
        expect(data.code).toBe('EMAIL_ALREADY_EXISTS');
      });
    });

    test.describe('Rate Limiting', () => {
      test('should enforce signup rate limits', async ({ request }) => {
        const { limit } = rateLimitConfigs.signup;
        
        // Make multiple signup attempts
        for (let i = 0; i < limit; i++) {
          await request.post('/api/auth/signup', {
            data: {
              firstName: 'Test',
              lastName: 'User',
              email: `test${i}-${Date.now()}@example.com`,
              password: testUsers.valid.password,
              acceptTerms: true
            }
          });
        }

        // Next attempt should be rate limited
        const rateLimitedResponse = await request.post('/api/auth/signup', {
          data: {
            firstName: 'Test',
            lastName: 'User',
            email: `rate-limited-${Date.now()}@example.com`,
            password: testUsers.valid.password,
            acceptTerms: true
          }
        });

        expect(rateLimitedResponse.status()).toBe(429);

        const data = await rateLimitedResponse.json();
        expect(data.code).toBe('TOO_MANY_REQUESTS');
      });
    });
  });

  test.describe('/api/auth/forgot-password', () => {
    test.describe('Successful Reset Request', () => {
      test('should send reset email for valid user', async ({ request }) => {
        const response = await request.post('/api/auth/forgot-password', {
          data: {
            email: testUsers.valid.email
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('reset instructions');
        expect(data.message).toContain('email address');
      });

      test('should handle non-existent email gracefully', async ({ request }) => {
        const response = await request.post('/api/auth/forgot-password', {
          data: {
            email: 'nonexistent@example.com'
          }
        });

        // Should still return success to prevent email enumeration
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('reset instructions');
      });
    });

    test.describe('Validation', () => {
      test('should validate email format', async ({ request }) => {
        const response = await request.post('/api/auth/forgot-password', {
          data: {
            email: 'invalid-email'
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.email).toContain('valid email address');
      });

      test('should require email field', async ({ request }) => {
        const response = await request.post('/api/auth/forgot-password', {
          data: {}
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.email).toContain('required');
      });
    });

    test.describe('Rate Limiting', () => {
      test('should enforce rate limits for password reset requests', async ({ request }) => {
        const { limit } = rateLimitConfigs.forgotPassword;
        
        // Make multiple requests
        for (let i = 0; i < limit; i++) {
          await request.post('/api/auth/forgot-password', {
            data: {
              email: testUsers.valid.email
            }
          });
        }

        // Next request should be rate limited
        const rateLimitedResponse = await request.post('/api/auth/forgot-password', {
          data: {
            email: testUsers.valid.email
          }
        });

        expect(rateLimitedResponse.status()).toBe(429);
      });
    });
  });

  test.describe('/api/auth/reset-password', () => {
    test.describe('Successful Password Reset', () => {
      test('should reset password with valid token', async ({ request }) => {
        // This would typically require a valid reset token from the forgot-password flow
        const response = await request.post('/api/auth/reset-password', {
          data: {
            token: 'valid-reset-token',
            password: 'NewSecurePass123!'
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('password has been reset');
      });
    });

    test.describe('Token Validation', () => {
      test('should reject invalid token', async ({ request }) => {
        const response = await request.post('/api/auth/reset-password', {
          data: {
            token: 'invalid-token',
            password: 'NewSecurePass123!'
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('invalid or expired');
      });

      test('should reject expired token', async ({ request }) => {
        const response = await request.post('/api/auth/reset-password', {
          data: {
            token: 'expired-token',
            password: 'NewSecurePass123!'
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.error).toContain('expired');
      });
    });

    test.describe('Password Validation', () => {
      test('should validate new password strength', async ({ request }) => {
        const response = await request.post('/api/auth/reset-password', {
          data: {
            token: 'valid-reset-token',
            password: 'weak'
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.errors.password).toBeTruthy();
      });
    });
  });

  test.describe('/api/auth/refresh', () => {
    test.describe('Token Refresh', () => {
      test('should refresh valid token', async ({ request }) => {
        const response = await request.post('/api/auth/refresh', {
          data: {
            refresh_token: 'valid-refresh-token'
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('session');
        expect(data.data.session).toHaveProperty('access_token');
        expect(data.data.session).toHaveProperty('refresh_token');
      });

      test('should reject invalid refresh token', async ({ request }) => {
        const response = await request.post('/api/auth/refresh', {
          data: {
            refresh_token: 'invalid-token'
          }
        });

        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('invalid');
      });

      test('should reject expired refresh token', async ({ request }) => {
        const response = await request.post('/api/auth/refresh', {
          data: {
            refresh_token: 'expired-token'
          }
        });

        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.error).toContain('expired');
      });
    });
  });

  test.describe('/api/auth/logout', () => {
    test.describe('Session Termination', () => {
      test('should logout successfully', async ({ request }) => {
        const response = await request.post('/api/auth/logout', {
          headers: {
            'Authorization': 'Bearer valid-access-token'
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('logged out');
      });

      test('should handle logout without valid session', async ({ request }) => {
        const response = await request.post('/api/auth/logout');

        // Should still return success
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });
  });

  test.describe('/api/auth/verify-email', () => {
    test.describe('Email Verification', () => {
      test('should verify email with valid token', async ({ request }) => {
        const response = await request.post('/api/auth/verify-email', {
          data: {
            token: 'valid-verification-token'
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toContain('verified');
      });

      test('should reject invalid verification token', async ({ request }) => {
        const response = await request.post('/api/auth/verify-email', {
          data: {
            token: 'invalid-token'
          }
        });

        expect(response.status()).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('invalid or expired');
      });
    });
  });

  test.describe('/api/auth/social/*', () => {
    test.describe('Social Authentication', () => {
      test('should handle Google OAuth callback', async ({ request }) => {
        // This would typically be tested with OAuth flow mocking
        const response = await request.get('/api/auth/social/google', {
          params: {
            code: 'google-auth-code',
            state: 'csrf-state'
          }
        });

        // Response depends on OAuth implementation
        expect([200, 302]).toContain(response.status());
      });

      test('should handle Apple OAuth callback', async ({ request }) => {
        const response = await request.get('/api/auth/social/apple', {
          params: {
            code: 'apple-auth-code',
            state: 'csrf-state'
          }
        });

        expect([200, 302]).toContain(response.status());
      });

      test('should reject invalid OAuth state', async ({ request }) => {
        const response = await request.get('/api/auth/social/google', {
          params: {
            code: 'google-auth-code',
            state: 'invalid-state'
          }
        });

        expect(response.status()).toBe(400);
      });
    });
  });

  test.describe('API Security', () => {
    test.describe('Input Sanitization', () => {
      test('should prevent XSS in email field', async ({ request }) => {
        for (const payload of securityTestData.xssPayloads) {
          const response = await request.post('/api/auth/login', {
            data: {
              email: payload,
              password: testUsers.valid.password
            }
          });

          // Should not execute XSS, should return validation error
          expect([400, 401]).toContain(response.status());

          const data = await response.json();
          expect(data.success).toBe(false);
        }
      });

      test('should prevent SQL injection attempts', async ({ request }) => {
        for (const payload of securityTestData.sqlInjectionPayloads) {
          const response = await request.post('/api/auth/login', {
            data: {
              email: payload,
              password: testUsers.valid.password
            }
          });

          // Should not cause SQL injection, should return normal error
          expect([400, 401]).toContain(response.status());
        }
      });
    });

    test.describe('HTTP Security Headers', () => {
      test('should include security headers in responses', async ({ request }) => {
        const response = await request.post('/api/auth/login', {
          data: {
            email: testUsers.valid.email,
            password: testUsers.valid.password
          }
        });

        const headers = response.headers();
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBeTruthy();
        expect(headers['cache-control']).toContain('no-cache');
      });
    });

    test.describe('Request Size Limits', () => {
      test('should reject oversized requests', async ({ request }) => {
        const largeData = {
          email: testUsers.valid.email,
          password: 'a'.repeat(100000) // Very large password
        };

        const response = await request.post('/api/auth/login', {
          data: largeData
        });

        expect(response.status()).toBe(413); // Payload too large
      });
    });
  });
});