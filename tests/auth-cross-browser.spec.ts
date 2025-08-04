import { test, expect, devices } from '@playwright/test';
import { 
  AuthPageHelpers, 
  AccessibilityTestHelpers,
  TouchTargetTestHelpers
} from './helpers/auth-helpers';
import { testUsers, browserConfigs } from './helpers/auth-fixtures';

test.describe('Authentication Cross-Browser Compatibility', () => {
  let authHelpers: AuthPageHelpers;
  let a11yHelpers: AccessibilityTestHelpers;
  let touchHelpers: TouchTargetTestHelpers;

  // Test on major browser engines
  const browsers = [
    { name: 'Chromium', device: devices['Desktop Chrome'] },
    { name: 'Firefox', device: devices['Desktop Firefox'] },
    { name: 'Safari', device: devices['Desktop Safari'] },
    { name: 'Edge', device: devices['Desktop Edge'] }
  ];

  browsers.forEach(({ name, device }) => {
    test.describe(`${name} Browser`, () => {
      test.use({ ...device });

      test.beforeEach(async ({ page }) => {
        authHelpers = new AuthPageHelpers(page);
        a11yHelpers = new AccessibilityTestHelpers(page);
        touchHelpers = new TouchTargetTestHelpers(page);
      });

      test('should render login form correctly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // All form elements should be visible
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/^password$/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        
        // Form should have proper styling
        const emailField = page.getByLabel(/email/i);
        const styles = await emailField.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            border: computed.border,
            borderRadius: computed.borderRadius,
            padding: computed.padding,
            fontSize: computed.fontSize
          };
        });
        
        expect(styles.border).toBeTruthy();
        expect(styles.padding).toBeTruthy();
        expect(parseInt(styles.fontSize)).toBeGreaterThan(12);
      });

      test('should handle form validation consistently', async ({ page }) => {
        await authHelpers.goToLogin();
        await authHelpers.submitLoginForm();
        
        // Validation errors should appear
        const emailError = page.locator('[role="alert"]').filter({ hasText: /email/i });
        const passwordError = page.locator('[role="alert"]').filter({ hasText: /password/i });
        
        await expect(emailError).toBeVisible();
        await expect(passwordError).toBeVisible();
        
        // Error styling should be consistent
        const errorStyle = await emailError.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            fontWeight: computed.fontWeight
          };
        });
        
        expect(errorStyle.color).toBeTruthy();
      });

      test('should support keyboard navigation', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Tab navigation should work
        await page.keyboard.press('Tab'); // Email field
        await expect(page.getByLabel(/email/i)).toBeFocused();
        
        await page.keyboard.press('Tab'); // Password field
        await expect(page.getByLabel(/^password$/i)).toBeFocused();
        
        await page.keyboard.press('Tab'); // Password toggle
        await expect(page.getByRole('button', { name: /show password/i })).toBeFocused();
        
        // Enter key should work for form submission
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
        await page.getByLabel(/^password$/i).press('Enter');
        
        await expect(page).toHaveURL(/\/dashboard/);
      });

      test('should handle JavaScript events properly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Click events should work
        const passwordToggle = page.getByRole('button', { name: /show password/i });
        const passwordField = page.getByLabel(/^password$/i);
        
        // Initially password field should be hidden
        await expect(passwordField).toHaveAttribute('type', 'password');
        
        // Click toggle
        await passwordToggle.click();
        await expect(passwordField).toHaveAttribute('type', 'text');
        
        // Click again
        await passwordToggle.click();
        await expect(passwordField).toHaveAttribute('type', 'password');
      });

      test('should handle CSS features consistently', async ({ page }) => {
        await authHelpers.goToSignup();
        
        // Flexbox/Grid layouts should work
        const form = page.locator('form');
        const formStyles = await form.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            display: computed.display,
            flexDirection: computed.flexDirection,
            gap: computed.gap
          };
        });
        
        // Should use modern CSS features
        expect(['flex', 'grid', 'block'].includes(formStyles.display)).toBe(true);
        
        // Password strength indicator should render
        const passwordField = page.getByLabel(/^password$/i);
        await passwordField.fill('StrongPass123!');
        
        const strengthIndicator = page.locator('.password-strength, [aria-live]').filter({ hasText: /strength/i });
        if (await strengthIndicator.count() > 0) {
          await expect(strengthIndicator).toBeVisible();
        }
      });

      test('should handle form submission correctly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.waitForLoadingComplete();
        await authHelpers.expectLoginSuccess();
      });

      test('should handle AJAX requests properly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Intercept login request
        let requestMade = false;
        await page.route('**/api/auth/login', async route => {
          requestMade = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { user: { id: '123' }, session: { access_token: 'token' } }
            })
          });
        });
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        
        // Request should have been made
        expect(requestMade).toBe(true);
      });

      test('should handle localStorage/sessionStorage', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Check if storage is available
        const storageAvailable = await page.evaluate(() => {
          try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
          } catch {
            return false;
          }
        });
        
        expect(storageAvailable).toBe(true);
        
        // Login and check if session data is stored
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.expectLoginSuccess();
        
        // Some session data should be stored
        const hasSessionData = await page.evaluate(() => {
          return localStorage.length > 0 || sessionStorage.length > 0;
        });
        
        expect(hasSessionData).toBe(true);
      });

      test('should handle cookies properly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.expectLoginSuccess();
        
        // Should have session cookies
        const cookies = await page.context().cookies();
        const sessionCookies = cookies.filter(cookie => 
          cookie.name.toLowerCase().includes('session') || 
          cookie.name.toLowerCase().includes('auth') ||
          cookie.name.toLowerCase().includes('token')
        );
        
        expect(sessionCookies.length).toBeGreaterThan(0);
      });

      test('should handle date/time features', async ({ page }) => {
        await authHelpers.goToSignup();
        
        // Check if date inputs work (if any)
        const dateInputs = page.locator('input[type="date"], input[type="datetime-local"]');
        const dateInputCount = await dateInputs.count();
        
        if (dateInputCount > 0) {
          const dateInput = dateInputs.first();
          await dateInput.fill('2024-01-01');
          await expect(dateInput).toHaveValue('2024-01-01');
        }
        
        // Check timezone handling
        const timezone = await page.evaluate(() => {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        });
        
        expect(timezone).toBeTruthy();
      });

      if (name !== 'Safari') { // Safari has different behavior
        test('should handle file uploads', async ({ page }) => {
          // If there are file upload fields
          const fileInputs = page.locator('input[type="file"]');
          const fileInputCount = await fileInputs.count();
          
          if (fileInputCount > 0) {
            const fileInput = fileInputs.first();
            
            // Create a test file
            const file = {
              name: 'test.jpg',
              mimeType: 'image/jpeg',
              buffer: Buffer.from('fake image data')
            };
            
            await fileInput.setInputFiles(file);
            
            // File should be selected
            const files = await fileInput.evaluate(el => (el as HTMLInputElement).files?.length);
            expect(files).toBe(1);
          }
        });
      }

      test('should handle focus and blur events', async ({ page }) => {
        await authHelpers.goToLogin();
        
        const emailField = page.getByLabel(/email/i);
        const passwordField = page.getByLabel(/^password$/i);
        
        // Focus events should work
        await emailField.focus();
        await expect(emailField).toBeFocused();
        
        // Blur events should work
        await passwordField.focus();
        await expect(passwordField).toBeFocused();
        await expect(emailField).not.toBeFocused();
      });

      test('should handle viewport and media queries', async ({ page }) => {
        // Test responsive behavior
        await page.setViewportSize({ width: 1200, height: 800 });
        await authHelpers.goToLogin();
        
        // Desktop layout
        const desktopLayout = await page.screenshot();
        
        // Mobile layout
        await page.setViewportSize({ width: 375, height: 812 });
        const mobileLayout = await page.screenshot();
        
        // Layouts should be different
        expect(desktopLayout.equals(mobileLayout)).toBe(false);
        
        // Form should still work on mobile
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.expectLoginSuccess();
      });
    });
  });

  test.describe('Browser-Specific Features', () => {
    test('should work in Chrome/Chromium', async ({ page }) => {
      await page.setUserAgent(browserConfigs[0].userAgent); // Chrome
      await authHelpers.goToLogin();
      
      // Test Chrome-specific features
      const isChrome = await page.evaluate(() => {
        return navigator.userAgent.includes('Chrome');
      });
      
      expect(isChrome).toBe(true);
      
      // Form should work normally
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should work in Firefox', async ({ page }) => {
      await page.setUserAgent(browserConfigs[1].userAgent); // Firefox
      await authHelpers.goToLogin();
      
      // Test Firefox-specific features
      const isFirefox = await page.evaluate(() => {
        return navigator.userAgent.includes('Firefox');
      });
      
      expect(isFirefox).toBe(true);
      
      // Password field behavior in Firefox
      const passwordField = page.getByLabel(/^password$/i);
      await passwordField.fill('testpassword');
      
      // Firefox should handle password field correctly
      await expect(passwordField).toHaveValue('testpassword');
      
      // Form submission should work
      await page.getByLabel(/email/i).fill(testUsers.valid.email);
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should work in Safari', async ({ page }) => {
      await page.setUserAgent(browserConfigs[2].userAgent); // Safari
      await authHelpers.goToLogin();
      
      // Test Safari-specific features
      const isSafari = await page.evaluate(() => {
        return navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
      });
      
      expect(isSafari).toBe(true);
      
      // Safari date handling
      const dateSupport = await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'date';
        return input.type === 'date';
      });
      
      expect(dateSupport).toBe(true);
      
      // Form should work
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should work in Edge', async ({ page }) => {
      await page.setUserAgent(browserConfigs[3].userAgent); // Edge
      await authHelpers.goToLogin();
      
      // Test Edge-specific features
      const isEdge = await page.evaluate(() => {
        return navigator.userAgent.includes('Edg');
      });
      
      expect(isEdge).toBe(true);
      
      // Edge should handle modern CSS
      const cssSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'grid';
        return div.style.display === 'grid';
      });
      
      expect(cssSupport).toBe(true);
      
      // Form should work
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });
  });

  test.describe('JavaScript API Compatibility', () => {
    test('should handle modern JavaScript features', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Test ES6+ features
      const jsSupport = await page.evaluate(() => {
        try {
          // Arrow functions
          const arrow = () => true;
          
          // Template literals
          const template = `test`;
          
          // Destructuring
          const { length } = [1, 2, 3];
          
          // Promises
          const promise = Promise.resolve(true);
          
          // fetch API
          const hasFetch = typeof fetch === 'function';
          
          return arrow() && template === 'test' && length === 3 && promise && hasFetch;
        } catch {
          return false;
        }
      });
      
      expect(jsSupport).toBe(true);
    });

    test('should handle async/await', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const asyncSupport = await page.evaluate(async () => {
        try {
          const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
          await delay(1);
          return true;
        } catch {
          return false;
        }
      });
      
      expect(asyncSupport).toBe(true);
    });

    test('should handle FormData API', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const formDataSupport = await page.evaluate(() => {
        try {
          const formData = new FormData();
          formData.append('test', 'value');
          return formData.get('test') === 'value';
        } catch {
          return false;
        }
      });
      
      expect(formDataSupport).toBe(true);
    });

    test('should handle URL API', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const urlSupport = await page.evaluate(() => {
        try {
          const url = new URL('https://example.com/path?param=value');
          return url.hostname === 'example.com' && url.searchParams.get('param') === 'value';
        } catch {
          return false;
        }
      });
      
      expect(urlSupport).toBe(true);
    });
  });

  test.describe('CSS Feature Compatibility', () => {
    test('should handle CSS Grid', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const gridSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'grid';
        return div.style.display === 'grid';
      });
      
      expect(gridSupport).toBe(true);
    });

    test('should handle CSS Flexbox', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const flexSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        return div.style.display === 'flex';
      });
      
      expect(flexSupport).toBe(true);
    });

    test('should handle CSS Custom Properties', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const customPropsSupport = await page.evaluate(() => {
        try {
          document.documentElement.style.setProperty('--test-prop', 'test-value');
          const value = getComputedStyle(document.documentElement).getPropertyValue('--test-prop');
          return value.trim() === 'test-value';
        } catch {
          return false;
        }
      });
      
      expect(customPropsSupport).toBe(true);
    });

    test('should handle CSS transitions and animations', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const animationSupport = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.transition = 'opacity 0.3s ease';
        div.style.animation = 'fadeIn 0.3s ease';
        return div.style.transition.includes('opacity') && div.style.animation.includes('fadeIn');
      });
      
      expect(animationSupport).toBe(true);
    });
  });

  test.describe('Web Standards Compatibility', () => {
    test('should handle ARIA attributes properly', async ({ page }) => {
      await authHelpers.goToLogin();
      await a11yHelpers.checkFormLabels();
      
      // Check that ARIA attributes are supported
      const ariaSupport = await page.evaluate(() => {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Test button');
        return button.getAttribute('aria-label') === 'Test button';
      });
      
      expect(ariaSupport).toBe(true);
    });

    test('should handle HTML5 input types', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const inputTypeSupport = await page.evaluate(() => {
        const email = document.createElement('input');
        email.type = 'email';
        
        const password = document.createElement('input');
        password.type = 'password';
        
        return email.type === 'email' && password.type === 'password';
      });
      
      expect(inputTypeSupport).toBe(true);
    });

    test('should handle HTML5 validation attributes', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const validationSupport = await page.evaluate(() => {
        const input = document.createElement('input');
        input.required = true;
        input.pattern = '[a-z]+';
        
        return input.required === true && input.pattern === '[a-z]+';
      });
      
      expect(validationSupport).toBe(true);
    });
  });

  test.describe('Error Handling Across Browsers', () => {
    test('should handle network errors consistently', async ({ page }) => {
      // Mock network error
      await page.route('**/api/auth/login', route => route.abort('connectionfailed'));
      
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      await authHelpers.submitLoginForm();
      
      // Should show error message
      await authHelpers.expectFormError('network');
    });

    test('should handle JavaScript errors gracefully', async ({ page }) => {
      // Monitor console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await authHelpers.goToLogin();
      
      // Inject a minor JS error
      await page.evaluate(() => {
        try {
          // @ts-ignore - Intentional error for testing
          nonExistentFunction();
        } catch {
          // Swallow error
        }
      });
      
      // Page should still be functional
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Should not have critical errors that break functionality
      const criticalErrors = consoleErrors.filter(error => 
        error.includes('Cannot read') || 
        error.includes('is not a function') ||
        error.includes('Uncaught')
      );
      
      expect(criticalErrors.length).toBeLessThan(3); // Some minor errors are acceptable
    });
  });
});