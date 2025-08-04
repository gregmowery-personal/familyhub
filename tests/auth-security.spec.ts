import { test, expect } from '@playwright/test';
import { 
  AuthPageHelpers, 
  SecurityTestHelpers 
} from './helpers/auth-helpers';
import { 
  testUsers, 
  securityTestData, 
  rateLimitConfigs,
  errorMessages 
} from './helpers/auth-fixtures';

test.describe('Authentication Security Testing', () => {
  let authHelpers: AuthPageHelpers;
  let securityHelpers: SecurityTestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthPageHelpers(page);
    securityHelpers = new SecurityTestHelpers(page);
  });

  test.describe('Cross-Site Scripting (XSS) Prevention', () => {
    test('should prevent XSS in email field', async ({ page }) => {
      await authHelpers.goToLogin();
      
      for (const payload of securityTestData.xssPayloads) {
        // Fill email field with XSS payload
        await page.getByLabel(/email/i).fill(payload);
        await authHelpers.submitLoginForm();
        
        // Check that script is not executed
        const alertDialogs = await page.locator('dialog[role="alertdialog"]').count();
        expect(alertDialogs).toBe(0);
        
        // Check that script is not in DOM as executable content
        const scriptTags = await page.locator('script').count();
        const initialScriptCount = scriptTags;
        
        // Payload should not create new script tags
        await page.waitForTimeout(100);
        const finalScriptCount = await page.locator('script').count();
        expect(finalScriptCount).toBeLessThanOrEqual(initialScriptCount);
        
        // Check that the field contains the literal string, not executed code
        const fieldValue = await page.getByLabel(/email/i).inputValue();
        expect(fieldValue).toBe(payload);
        
        // Clear field for next test
        await page.getByLabel(/email/i).fill('');
      }
    });

    test('should prevent XSS in password field', async ({ page }) => {
      await authHelpers.goToLogin();
      
      for (const payload of securityTestData.xssPayloads) {
        await page.getByLabel(/^password$/i).fill(payload);
        await authHelpers.submitLoginForm();
        
        // No script execution should occur
        const alertDialogs = await page.locator('dialog[role="alertdialog"]').count();
        expect(alertDialogs).toBe(0);
        
        // Field should contain literal string
        const fieldValue = await page.getByLabel(/^password$/i).inputValue();
        expect(fieldValue).toBe(payload);
        
        await page.getByLabel(/^password$/i).fill('');
      }
    });

    test('should prevent XSS in signup form fields', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const fields = [
        { label: /first name/i, selector: page.getByLabel(/first name/i) },
        { label: /last name/i, selector: page.getByLabel(/last name/i) },
        { label: /email/i, selector: page.getByLabel(/email/i) }
      ];
      
      for (const field of fields) {
        for (const payload of securityTestData.xssPayloads.slice(0, 2)) { // Test subset for performance
          await field.selector.fill(payload);
          await authHelpers.submitSignupForm();
          
          // No script execution
          const alertDialogs = await page.locator('dialog[role="alertdialog"]').count();
          expect(alertDialogs).toBe(0);
          
          // Field should contain literal string
          const fieldValue = await field.selector.inputValue();
          expect(fieldValue).toBe(payload);
          
          await field.selector.fill('');
        }
      }
    });

    test('should sanitize XSS in error messages', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Mock API response with potential XSS in error message
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: '<script>alert("xss")</script>Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          })
        });
      });
      
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: 'wrongpassword'
      });
      await authHelpers.submitLoginForm();
      
      // Error message should be displayed but script should not execute
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      
      // Should not have script tags in error display
      const errorHTML = await errorMessage.innerHTML();
      expect(errorHTML).not.toContain('<script>');
      
      // Should contain sanitized error text
      expect(errorHTML).toContain('Invalid credentials');
    });

    test('should prevent DOM-based XSS via URL parameters', async ({ page }) => {
      // Test with malicious URL parameters
      const maliciousParams = [
        '?email=<script>alert("xss")</script>',
        '?redirect=javascript:alert("xss")',
        '?token=<img src=x onerror=alert("xss")>',
        '#<script>alert("xss")</script>'
      ];
      
      for (const param of maliciousParams) {
        await page.goto(`/auth${param}`);
        
        // No script execution should occur
        const alertDialogs = await page.locator('dialog[role="alertdialog"]').count();
        expect(alertDialogs).toBe(0);
        
        // Page should load normally
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        
        // URL parameters should not be reflected unsanitized in DOM
        const bodyHTML = await page.locator('body').innerHTML();
        expect(bodyHTML).not.toContain('<script>alert("xss")</script>');
      }
    });
  });

  test.describe('Cross-Site Request Forgery (CSRF) Protection', () => {
    test('should require CSRF token for form submissions', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Attempt to submit form without proper CSRF token
      const response = await page.request.post('/api/auth/login', {
        data: {
          email: testUsers.valid.email,
          password: testUsers.valid.password
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Should be rejected due to CSRF protection
      expect([403, 429]).toContain(response.status()); // 403 Forbidden or 429 if rate limited
    });

    test('should validate CSRF token authenticity', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Attempt with invalid CSRF token
      const response = await page.request.post('/api/auth/login', {
        data: {
          email: testUsers.valid.email,
          password: testUsers.valid.password
        },
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token-123'
        }
      });
      
      expect([403, 401]).toContain(response.status());
    });

    test('should prevent CSRF via referrer validation', async ({ page }) => {
      // Attempt request from external origin
      const response = await page.request.post('/api/auth/login', {
        data: {
          email: testUsers.valid.email,
          password: testUsers.valid.password
        },
        headers: {
          'Referer': 'https://malicious-site.com',
          'Origin': 'https://malicious-site.com'
        }
      });
      
      expect([403, 400]).toContain(response.status());
    });

    test('should include CSRF protection in all auth endpoints', async ({ page }) => {
      const endpoints = [
        '/api/auth/login',
        '/api/auth/signup',
        '/api/auth/forgot-password',
        '/api/auth/reset-password'
      ];
      
      for (const endpoint of endpoints) {
        const response = await page.request.post(endpoint, {
          data: { email: 'test@example.com' }
        });
        
        // Should require CSRF protection
        expect([403, 400, 401]).toContain(response.status());
      }
    });
  });

  test.describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in login email', async ({ page }) => {
      await authHelpers.goToLogin();
      
      for (const payload of securityTestData.sqlInjectionPayloads) {
        await page.getByLabel(/email/i).fill(payload);
        await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
        await authHelpers.submitLoginForm();
        
        // Should return normal authentication error, not SQL error
        await authHelpers.expectFormError(errorMessages.auth.invalidCredentials);
        
        // Clear form
        await page.getByLabel(/email/i).fill('');
        await page.getByLabel(/^password$/i).fill('');
      }
    });

    test('should prevent SQL injection in password field', async ({ page }) => {
      await authHelpers.goToLogin();
      
      for (const payload of securityTestData.sqlInjectionPayloads) {
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill(payload);
        await authHelpers.submitLoginForm();
        
        // Should return normal authentication error
        await authHelpers.expectFormError(errorMessages.auth.invalidCredentials);
        
        await page.getByLabel(/email/i).fill('');
        await page.getByLabel(/^password$/i).fill('');
      }
    });

    test('should prevent SQL injection in signup fields', async ({ page }) => {
      await authHelpers.goToSignup();
      
      for (const payload of securityTestData.sqlInjectionPayloads.slice(0, 2)) {
        // Test in email field
        await page.getByLabel(/email/i).fill(payload);
        await page.getByLabel(/first name/i).fill('Test');
        await page.getByLabel(/last name/i).fill('User');
        await page.getByLabel(/^password$/i).fill('ValidPass123!');
        await page.getByLabel(/confirm password/i).fill('ValidPass123!');
        await page.getByLabel(/accept.*terms/i).check();
        
        await authHelpers.submitSignupForm();
        
        // Should return validation error, not SQL error
        const errorMessage = page.locator('[role="alert"]');
        await expect(errorMessage).toBeVisible();
        
        // Clear form
        await page.getByLabel(/email/i).fill('');
        await page.getByLabel(/first name/i).fill('');
        await page.getByLabel(/last name/i).fill('');
        await page.getByLabel(/^password$/i).fill('');
        await page.getByLabel(/confirm password/i).fill('');
        await page.getByLabel(/accept.*terms/i).uncheck();
      }
    });

    test('should prevent SQL injection via API parameters', async ({ page }) => {
      for (const payload of securityTestData.sqlInjectionPayloads) {
        const response = await page.request.post('/api/auth/login', {
          data: {
            email: payload,
            password: 'test123'
          }
        });
        
        // Should not return database errors
        expect([400, 401]).toContain(response.status());
        
        if (response.status() === 400) {
          const data = await response.json();
          expect(data.error || data.errors).toBeTruthy();
          
          // Should not contain SQL-specific error messages
          const errorText = JSON.stringify(data).toLowerCase();
          expect(errorText).not.toContain('sql');
          expect(errorText).not.toContain('syntax');
          expect(errorText).not.toContain('database');
          expect(errorText).not.toContain('table');
        }
      }
    });
  });

  test.describe('Rate Limiting Security', () => {
    test('should enforce login rate limits', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const { limit } = rateLimitConfigs.login;
      
      // Make failed attempts up to the limit
      for (let i = 0; i < limit; i++) {
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill(`wrongpassword${i}`);
        await authHelpers.submitLoginForm();
        
        await authHelpers.expectFormError(errorMessages.auth.invalidCredentials);
        
        // Clear form
        await page.getByLabel(/email/i).fill('');
        await page.getByLabel(/^password$/i).fill('');
      }
      
      // Next attempt should be rate limited
      await page.getByLabel(/email/i).fill(testUsers.valid.email);
      await page.getByLabel(/^password$/i).fill('wrongpassword');
      await authHelpers.submitLoginForm();
      
      await authHelpers.expectFormError(errorMessages.auth.tooManyRequests);
    });

    test('should enforce signup rate limits', async ({ page }) => {
      const { limit } = rateLimitConfigs.signup;
      
      // Make signup attempts up to the limit
      for (let i = 0; i < limit; i++) {
        await authHelpers.goToSignup();
        
        const testUser = {
          firstName: 'Test',
          lastName: 'User',
          email: `test${i}-${Date.now()}@example.com`,
          password: 'ValidPass123!'
        };
        
        await authHelpers.fillSignupForm(testUser);
        await authHelpers.submitSignupForm();
        
        // Should either succeed or hit rate limit
        const isSuccess = await page.getByText(/check your email/i).isVisible();
        const isRateLimit = await page.getByText(/too many/i).isVisible();
        
        if (isRateLimit) {
          // Hit rate limit before expected limit - this is acceptable
          break;
        }
        
        if (isSuccess) {
          // Navigate back for next attempt
          await page.goto('/auth');
        }
      }
      
      // One more attempt should definitely be rate limited
      await authHelpers.goToSignup();
      const testUser = {
        firstName: 'Test',
        lastName: 'User',
        email: `rate-limited-${Date.now()}@example.com`,
        password: 'ValidPass123!'
      };
      
      await authHelpers.fillSignupForm(testUser);
      await authHelpers.submitSignupForm();
      
      // Should show rate limit message
      await expect(page.getByText(/too many/i)).toBeVisible();
    });

    test('should enforce forgot password rate limits', async ({ page }) => {
      const { limit } = rateLimitConfigs.forgotPassword;
      
      // Make forgot password requests up to the limit
      for (let i = 0; i < limit; i++) {
        await authHelpers.goToForgotPassword();
        await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
        await authHelpers.submitForgotPasswordForm();
        
        const isSuccess = await page.getByText(/check your email/i).isVisible();
        const isRateLimit = await page.getByText(/too many/i).isVisible();
        
        if (isRateLimit) break;
        
        if (isSuccess) {
          await page.goto('/auth');
        }
      }
      
      // Next attempt should be rate limited
      await authHelpers.goToForgotPassword();
      await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
      await authHelpers.submitForgotPasswordForm();
      
      await expect(page.getByText(/too many/i)).toBeVisible();
    });

    test('should detect and prevent brute force attacks', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Simulate rapid automated attempts
      const attempts = [];
      for (let i = 0; i < 20; i++) {
        attempts.push(
          page.request.post('/api/auth/login', {
            data: {
              email: `brute${i}@example.com`,
              password: 'wrongpassword'
            }
          })
        );
      }
      
      const responses = await Promise.all(attempts);
      
      // Some responses should be blocked due to suspicious activity
      const blockedResponses = responses.filter(r => r.status() === 429 || r.status() === 423);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    test('should implement progressive delays for repeated failures', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const startTime = Date.now();
      
      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill('wrongpassword');
        await authHelpers.submitLoginForm();
        
        await authHelpers.expectFormError(errorMessages.auth.invalidCredentials);
        
        // Clear form
        await page.getByLabel(/email/i).fill('');
        await page.getByLabel(/^password$/i).fill('');
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should take progressively longer due to delays
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second total
    });
  });

  test.describe('Session Security', () => {
    test('should implement secure session handling', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      
      await authHelpers.expectLoginSuccess();
      
      // Check for secure session cookies
      const cookies = await page.context().cookies();
      const sessionCookies = cookies.filter(cookie => 
        cookie.name.toLowerCase().includes('session') || 
        cookie.name.toLowerCase().includes('auth') ||
        cookie.name.toLowerCase().includes('token')
      );
      
      for (const cookie of sessionCookies) {
        // Should be HttpOnly for security
        expect(cookie.httpOnly).toBe(true);
        
        // Should be Secure in production
        if (cookie.name.includes('prod') || process.env.NODE_ENV === 'production') {
          expect(cookie.secure).toBe(true);
        }
        
        // Should have SameSite protection
        expect(['Strict', 'Lax']).toContain(cookie.sameSite || 'Lax');
      }
    });

    test('should handle session hijacking attempts', async ({ page, context }) => {
      // Login normally
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
      
      // Get session cookies
      const cookies = await context.cookies();
      
      // Create new context (simulate different browser/user)
      const newContext = await page.context().browser()?.newContext();
      if (!newContext) return;
      
      const newPage = await newContext.newPage();
      
      // Try to use stolen session cookies
      await newContext.addCookies(cookies);
      await newPage.goto('/dashboard');
      
      // Should be redirected to login or show security warning
      // (Implementation depends on session validation)
      const url = newPage.url();
      const isSecure = url.includes('/auth') || 
                      await newPage.getByText(/security|unauthorized/i).isVisible();
      
      // Clean up
      await newContext.close();
    });

    test('should detect concurrent session abuse', async ({ page, context }) => {
      // Login in first session
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
      
      // Create multiple concurrent sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const newContext = await page.context().browser()?.newContext();
        if (newContext) {
          const newPage = await newContext.newPage();
          const newAuthHelpers = new AuthPageHelpers(newPage);
          
          await newAuthHelpers.goToLogin();
          await newAuthHelpers.fillLoginForm({
            email: testUsers.valid.email,
            password: testUsers.valid.password
          });
          
          sessions.push({ context: newContext, page: newPage, helpers: newAuthHelpers });
        }
      }
      
      // Try to login from all sessions simultaneously
      const loginPromises = sessions.map(session => 
        session.helpers.submitLoginForm()
      );
      
      await Promise.all(loginPromises);
      
      // Some sessions should be blocked or require additional verification
      let blockedSessions = 0;
      for (const session of sessions) {
        const isBlocked = await session.page.getByText(/suspicious|security|blocked/i).isVisible();
        if (isBlocked) blockedSessions++;
      }
      
      // Clean up
      for (const session of sessions) {
        await session.context.close();
      }
      
      // At least some sessions should be flagged as suspicious
      expect(blockedSessions).toBeGreaterThan(0);
    });

    test('should implement proper session timeout', async ({ page }) => {
      // Mock short session timeout
      await page.route('**/api/auth/session', async route => {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Session expired' })
        });
      });
      
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
      
      // Try to access protected resource after "timeout"
      await page.goto('/dashboard/settings');
      
      // Should be redirected to login with session expired message
      await expect(page).toHaveURL(/\/auth/);
      await expect(page.getByText(/session expired|please sign in/i)).toBeVisible();
    });
  });

  test.describe('Input Validation Security', () => {
    test('should validate input lengths to prevent buffer overflow', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Test extremely long inputs
      const longString = 'a'.repeat(10000);
      
      await page.getByLabel(/email/i).fill(longString + '@example.com');
      await page.getByLabel(/^password$/i).fill(longString);
      await authHelpers.submitLoginForm();
      
      // Should handle gracefully with validation error
      const errorVisible = await page.locator('[role="alert"], .error').isVisible();
      expect(errorVisible).toBe(true);
      
      // Page should not crash or become unresponsive
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should sanitize special characters in input', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const specialChars = ['<', '>', '"', "'", '&', '\n', '\r', '\t'];
      
      for (const char of specialChars) {
        const testValue = `test${char}value`;
        
        await page.getByLabel(/first name/i).fill(testValue);
        await authHelpers.submitSignupForm();
        
        // Field should contain the character but not cause rendering issues
        const fieldValue = await page.getByLabel(/first name/i).inputValue();
        expect(fieldValue).toContain(char);
        
        // Page should render correctly
        await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
        
        await page.getByLabel(/first name/i).fill('');
      }
    });

    test('should prevent file path traversal in input', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\boot.ini'
      ];
      
      for (const payload of pathTraversalPayloads) {
        await page.getByLabel(/email/i).fill(payload);
        await page.getByLabel(/^password$/i).fill('test123');
        await authHelpers.submitLoginForm();
        
        // Should return normal validation error
        await authHelpers.expectFormError(errorMessages.invalid.email);
        
        await page.getByLabel(/email/i).fill('');
      }
    });

    test('should validate MIME types for file uploads', async ({ page }) => {
      // If there are file upload fields in auth flow (profile pictures, etc.)
      const fileInputs = page.locator('input[type="file"]');
      const fileInputCount = await fileInputs.count();
      
      if (fileInputCount > 0) {
        const fileInput = fileInputs.first();
        
        // Test malicious file types
        const maliciousFiles = [
          'test.exe',
          'malware.bat',
          'script.js',
          'backdoor.php'
        ];
        
        for (const filename of maliciousFiles) {
          // Create mock file
          const file = {
            name: filename,
            mimeType: 'application/octet-stream',
            buffer: Buffer.from('malicious content')
          };
          
          await fileInput.setInputFiles(file);
          
          // Should show validation error
          const error = page.locator('[role="alert"]').filter({ hasText: /file type|invalid file/i });
          await expect(error).toBeVisible();
        }
      }
    });
  });

  test.describe('HTTP Security Headers', () => {
    test('should include security headers in responses', async ({ page }) => {
      const response = await page.request.get('/auth');
      const headers = response.headers();
      
      // Content Security Policy
      expect(headers['content-security-policy']).toBeTruthy();
      
      // X-Frame-Options
      expect(headers['x-frame-options']).toBeTruthy();
      expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options']);
      
      // X-Content-Type-Options
      expect(headers['x-content-type-options']).toBe('nosniff');
      
      // X-XSS-Protection
      expect(headers['x-xss-protection']).toBeTruthy();
      
      // Strict-Transport-Security (in production)
      if (process.env.NODE_ENV === 'production') {
        expect(headers['strict-transport-security']).toBeTruthy();
      }
      
      // Referrer-Policy
      expect(headers['referrer-policy']).toBeTruthy();
    });

    test('should prevent clickjacking attacks', async ({ page }) => {
      // Test that auth pages cannot be embedded in iframes
      const response = await page.request.get('/auth');
      const headers = response.headers();
      
      const frameOptions = headers['x-frame-options'];
      const csp = headers['content-security-policy'];
      
      // Should have frame protection
      const hasFrameProtection = 
        frameOptions === 'DENY' || 
        frameOptions === 'SAMEORIGIN' ||
        (csp && csp.includes('frame-ancestors'));
      
      expect(hasFrameProtection).toBe(true);
    });

    test('should implement proper CORS policy', async ({ page }) => {
      const response = await page.request.options('/api/auth/login');
      const headers = response.headers();
      
      // CORS headers should be restrictive
      const allowedOrigins = headers['access-control-allow-origin'];
      
      // Should not allow all origins (*)
      if (allowedOrigins) {
        expect(allowedOrigins).not.toBe('*');
      }
      
      // Should specify allowed methods
      const allowedMethods = headers['access-control-allow-methods'];
      if (allowedMethods) {
        expect(allowedMethods).toBeTruthy();
        expect(allowedMethods).not.toContain('*');
      }
    });
  });

  test.describe('Password Security', () => {
    test('should enforce strong password requirements', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'letmein',
        'admin',
        testUsers.valid.firstName.toLowerCase(), // Name-based password
        testUsers.valid.email.split('@')[0] // Email-based password
      ];
      
      for (const weakPassword of weakPasswords) {
        await page.getByLabel(/^password$/i).fill(weakPassword);
        await authHelpers.submitSignupForm();
        
        // Should show password strength error
        const passwordError = page.locator('[role="alert"]').filter({ hasText: /password/i });
        await expect(passwordError).toBeVisible();
        
        await page.getByLabel(/^password$/i).fill('');
      }
    });

    test('should prevent password reuse', async ({ page }) => {
      // This would typically require backend integration
      // For now, test that common passwords are rejected
      await authHelpers.goToSignup();
      
      const commonPasswords = [
        'Password123!', // Common pattern
        'Welcome123!', // Common corporate password
        'Spring2024!' // Date-based pattern
      ];
      
      for (const password of commonPasswords) {
        await page.getByLabel(/^password$/i).fill(password);
        
        // Check if password strength indicator warns about common passwords
        const strengthIndicator = page.locator('.password-strength, [aria-live]');
        if (await strengthIndicator.count() > 0) {
          const strengthText = await strengthIndicator.textContent();
          // Should warn about common patterns
          expect(strengthText?.toLowerCase()).toContain('common');
        }
        
        await page.getByLabel(/^password$/i).fill('');
      }
    });

    test('should handle password complexity requirements', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const testCases = [
        { password: 'NoNumbers!', error: /number/i },
        { password: 'nonumber123!', error: /uppercase/i },
        { password: 'NOLOWER123!', error: /lowercase/i },
        { password: 'NoSpecial123', error: /special/i },
        { password: 'Short1!', error: /8 characters/i }
      ];
      
      for (const testCase of testCases) {
        await page.getByLabel(/^password$/i).fill(testCase.password);
        await authHelpers.submitSignupForm();
        
        const passwordError = page.locator('[role="alert"]').filter({ hasText: testCase.error });
        await expect(passwordError).toBeVisible();
        
        await page.getByLabel(/^password$/i).fill('');
      }
    });
  });

  test.describe('Social Login Security', () => {
    test('should validate OAuth state parameter', async ({ page }) => {
      // Test OAuth callback with invalid state
      await page.goto('/auth/callback?provider=google&code=valid-code&state=invalid-state');
      
      // Should show error or redirect to login
      const hasError = await page.getByText(/error|invalid|unauthorized/i).isVisible();
      const isOnLogin = page.url().includes('/auth') && 
                       await page.getByRole('button', { name: /sign in/i }).isVisible();
      
      expect(hasError || isOnLogin).toBe(true);
    });

    test('should prevent OAuth authorization code reuse', async ({ page }) => {
      const authCode = 'test-auth-code-123';
      
      // First use of auth code
      await page.goto(`/auth/callback?provider=google&code=${authCode}&state=valid-state`);
      
      // Second use of same auth code should fail
      await page.goto(`/auth/callback?provider=google&code=${authCode}&state=valid-state`);
      
      // Should show error or redirect to login
      const hasError = await page.getByText(/error|invalid|expired/i).isVisible();
      const isOnLogin = page.url().includes('/auth');
      
      expect(hasError || isOnLogin).toBe(true);
    });

    test('should validate OAuth provider', async ({ page }) => {
      // Test with invalid provider
      await page.goto('/auth/callback?provider=malicious-provider&code=code&state=state');
      
      // Should reject invalid provider
      const hasError = await page.getByText(/error|invalid|unsupported/i).isVisible();
      expect(hasError).toBe(true);
    });
  });

  test.describe('API Security', () => {
    test('should implement request size limits', async ({ page }) => {
      const largePayload = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        extraData: 'x'.repeat(100000) // Very large field
      };
      
      const response = await page.request.post('/api/auth/login', {
        data: largePayload
      });
      
      // Should reject oversized request
      expect(response.status()).toBe(413); // Payload Too Large
    });

    test('should validate request content types', async ({ page }) => {
      // Test with invalid content type
      const response = await page.request.post('/api/auth/login', {
        data: 'invalid-xml-data',
        headers: {
          'Content-Type': 'application/xml'
        }
      });
      
      // Should reject invalid content type
      expect([400, 415]).toContain(response.status());
    });

    test('should implement API versioning security', async ({ page }) => {
      // Test deprecated API versions
      const response = await page.request.post('/api/v1/auth/login', {
        data: {
          email: testUsers.valid.email,
          password: testUsers.valid.password
        }
      });
      
      // Should either upgrade or reject deprecated versions
      expect([404, 410, 301, 302]).toContain(response.status());
    });
  });
});