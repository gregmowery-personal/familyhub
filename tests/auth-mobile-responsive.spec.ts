import { test, expect } from '@playwright/test';
import { 
  AuthPageHelpers, 
  TouchTargetTestHelpers,
  MobileTestHelpers,
  AccessibilityTestHelpers
} from './helpers/auth-helpers';
import { 
  testUsers, 
  mobileViewports, 
  desktopViewports,
  touchTargetRequirements 
} from './helpers/auth-fixtures';

test.describe('Authentication Mobile Responsiveness', () => {
  let authHelpers: AuthPageHelpers;
  let touchHelpers: TouchTargetTestHelpers;
  let mobileHelpers: MobileTestHelpers;
  let a11yHelpers: AccessibilityTestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthPageHelpers(page);
    touchHelpers = new TouchTargetTestHelpers(page);
    mobileHelpers = new MobileTestHelpers(page);
    a11yHelpers = new AccessibilityTestHelpers(page);
  });

  test.describe('Minimum Width Support (320px)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    });

    test('should render login form at minimum width', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // All form elements should be visible and functional
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Form should not have horizontal overflow
      const bodyOverflow = await page.evaluate(() => {
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        return {
          overflowX: computedStyle.overflowX,
          scrollWidth: body.scrollWidth,
          clientWidth: body.clientWidth
        };
      });
      
      expect(bodyOverflow.scrollWidth).toBeLessThanOrEqual(bodyOverflow.clientWidth + 1); // 1px tolerance
    });

    test('should render signup form at minimum width', async ({ page }) => {
      await authHelpers.goToSignup();
      
      // All form fields should be visible
      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
      
      // Name fields should stack vertically on narrow screens
      const firstNameBox = await page.getByLabel(/first name/i).boundingBox();
      const lastNameBox = await page.getByLabel(/last name/i).boundingBox();
      
      if (firstNameBox && lastNameBox) {
        // Fields should be stacked (Y positions should be different)
        expect(Math.abs(firstNameBox.y - lastNameBox.y)).toBeGreaterThan(10);
      }
      
      // Form should not overflow
      const formOverflow = await page.locator('form').evaluate(el => {
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        };
      });
      
      expect(formOverflow.scrollWidth).toBeLessThanOrEqual(formOverflow.clientWidth + 1);
    });

    test('should handle social login buttons at minimum width', async ({ page }) => {
      await authHelpers.goToLogin();
      
      const googleButton = page.getByRole('button', { name: /continue with google/i });
      const appleButton = page.getByRole('button', { name: /continue with apple/i });
      
      // Buttons should be visible and full-width
      await expect(googleButton).toBeVisible();
      await expect(appleButton).toBeVisible();
      
      const googleBox = await googleButton.boundingBox();
      const appleBox = await appleButton.boundingBox();
      
      if (googleBox && appleBox) {
        // Buttons should be near full width (accounting for margins)
        expect(googleBox.width).toBeGreaterThan(280); // 320px - margins
        expect(appleBox.width).toBeGreaterThan(280);
        
        // Should maintain minimum touch target height
        expect(googleBox.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
        expect(appleBox.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
      }
    });

    test('should handle form validation errors at minimum width', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.submitLoginForm();
      
      // Error messages should be visible
      const errorMessages = page.locator('[role="alert"]');
      const errorCount = await errorMessages.count();
      expect(errorCount).toBeGreaterThan(0);
      
      // Errors should not cause horizontal overflow
      for (let i = 0; i < errorCount; i++) {
        const error = errorMessages.nth(i);
        if (await error.isVisible()) {
          const errorBox = await error.boundingBox();
          if (errorBox) {
            expect(errorBox.x + errorBox.width).toBeLessThanOrEqual(320 + 5); // Small tolerance
          }
        }
      }
    });

    test('should maintain readability at minimum width', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Text should be readable (not too cramped)
      const textElements = await page.locator('p, span, label, button').all();
      
      for (const element of textElements.slice(0, 5)) { // Test subset for performance
        if (!(await element.isVisible())) continue;
        
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            padding: computed.padding
          };
        });
        
        // Font size should be at least 16px for readability
        const fontSize = parseInt(styles.fontSize);
        expect(fontSize).toBeGreaterThanOrEqual(14); // Minimum readable size
      }
    });
  });

  test.describe('Mobile Viewport Tests', () => {
    mobileViewports.forEach(({ name, width, height }) => {
      test.describe(`${name} (${width}x${height})`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width, height });
        });

        test('should render authentication forms properly', async ({ page }) => {
          await authHelpers.goToLogin();
          await mobileHelpers.checkMobileLayout();
          
          // Form should be usable
          await authHelpers.fillLoginForm({
            email: testUsers.valid.email,
            password: testUsers.valid.password
          });
          
          // Form submission should work
          await authHelpers.submitLoginForm();
          await expect(page).toHaveURL(/\/dashboard/);
        });

        test('should meet touch target requirements', async ({ page }) => {
          await authHelpers.goToLogin();
          await touchHelpers.checkTouchTargetSizes();
          
          // Test specific elements
          const interactiveElements = [
            page.getByLabel(/email/i),
            page.getByLabel(/^password$/i),
            page.getByRole('button', { name: /show password/i }),
            page.getByRole('button', { name: /sign in/i }),
            page.getByRole('button', { name: /continue with google/i })
          ];
          
          for (const element of interactiveElements) {
            if (await element.isVisible()) {
              const box = await element.boundingBox();
              if (box) {
                expect(box.width).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.width);
                expect(box.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
              }
            }
          }
        });

        test('should handle mobile keyboard properly', async ({ page }) => {
          await authHelpers.goToLogin();
          await mobileHelpers.testMobileFormUsability();
          
          // Email field should trigger email keyboard
          const emailField = page.getByLabel(/email/i);
          await expect(emailField).toHaveAttribute('type', 'email');
          await expect(emailField).toHaveAttribute('inputmode', 'email');
          
          // Form should work with mobile keyboard
          await emailField.fill(testUsers.valid.email);
          await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
          await page.getByLabel(/^password$/i).press('Enter');
          
          await expect(page).toHaveURL(/\/dashboard/);
        });

        test('should handle orientation changes', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Fill form in portrait
          await page.getByLabel(/email/i).fill(testUsers.valid.email);
          await page.getByLabel(/^password$/i).fill('partial-password');
          
          // Rotate to landscape
          await page.setViewportSize({ width: height, height: width });
          
          // Form data should persist
          await expect(page.getByLabel(/email/i)).toHaveValue(testUsers.valid.email);
          await expect(page.getByLabel(/^password$/i)).toHaveValue('partial-password');
          
          // Form should still be usable
          await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
          await authHelpers.submitLoginForm();
          await expect(page).toHaveURL(/\/dashboard/);
        });

        test('should maintain proper spacing and layout', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Check that form elements have proper spacing
          await touchHelpers.checkTouchTargetSpacing();
          
          // Form should not be cramped
          const formElements = await page.locator('input, button, label').all();
          
          for (let i = 0; i < formElements.length - 1; i++) {
            const currentBox = await formElements[i].boundingBox();
            const nextBox = await formElements[i + 1].boundingBox();
            
            if (currentBox && nextBox && 
                await formElements[i].isVisible() && 
                await formElements[i + 1].isVisible()) {
              
              // Vertical spacing should be adequate
              const verticalSpacing = Math.abs(nextBox.y - (currentBox.y + currentBox.height));
              if (verticalSpacing < 100) { // Elements are vertically related
                expect(verticalSpacing).toBeGreaterThanOrEqual(8);
              }
            }
          }
        });

        test('should handle mobile scrolling properly', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Long forms should be scrollable
          const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
          const viewportHeight = height;
          
          if (bodyHeight > viewportHeight) {
            // Should be able to scroll to bottom
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            
            // Submit button should be accessible
            const submitButton = page.getByRole('button', { name: /create account/i });
            await expect(submitButton).toBeInViewport();
            
            // Should be able to scroll back to top
            await page.evaluate(() => window.scrollTo(0, 0));
            
            // First field should be visible
            const firstField = page.getByLabel(/first name/i);
            await expect(firstField).toBeInViewport();
          }
        });

        test('should support mobile gestures and interactions', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Test touch interactions
          const emailField = page.getByLabel(/email/i);
          
          // Should respond to touch events
          await emailField.tap();
          await expect(emailField).toBeFocused();
          
          // Should handle double-tap for text selection
          await emailField.fill('test@example.com');
          await emailField.dblclick();
          
          // Field should have text selected (cursor should be at the end or text selected)
          const selectionStart = await emailField.evaluate(el => (el as HTMLInputElement).selectionStart);
          const selectionEnd = await emailField.evaluate(el => (el as HTMLInputElement).selectionEnd);
          
          expect(selectionStart !== selectionEnd || selectionEnd === emailField.inputValue().length).toBe(true);
        });

        test('should handle mobile-specific form features', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Test autocomplete attributes for mobile keyboards
          const formFields = [
            { field: page.getByLabel(/first name/i), autocomplete: 'given-name' },
            { field: page.getByLabel(/last name/i), autocomplete: 'family-name' },
            { field: page.getByLabel(/email/i), autocomplete: 'email' },
            { field: page.getByLabel(/^password$/i), autocomplete: 'new-password' }
          ];
          
          for (const { field, autocomplete } of formFields) {
            await expect(field).toHaveAttribute('autocomplete', autocomplete);
          }
          
          // Password field should prevent autocapitalization
          const passwordField = page.getByLabel(/^password$/i);
          const autocapitalize = await passwordField.getAttribute('autocapitalize');
          expect(autocapitalize === 'off' || autocapitalize === 'none' || autocapitalize === null).toBe(true);
        });

        test('should maintain accessibility on mobile', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Touch targets should be accessible
          await touchHelpers.checkTouchTargetSizes();
          
          // Keyboard navigation should work
          await a11yHelpers.checkKeyboardNavigation();
          
          // Screen reader features should work
          await a11yHelpers.checkFormLabels();
          
          // Focus management should work on mobile
          await page.keyboard.press('Tab');
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeVisible();
          await expect(focusedElement).toBeInViewport();
        });
      });
    });
  });

  test.describe('Responsive Breakpoints', () => {
    const breakpoints = [
      { name: 'Small Mobile', width: 320 },
      { name: 'Large Mobile', width: 414 },
      { name: 'Small Tablet', width: 768 },
      { name: 'Large Tablet', width: 1024 },
      { name: 'Desktop', width: 1280 }
    ];

    breakpoints.forEach(({ name, width }) => {
      test(`should adapt layout at ${name} (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await authHelpers.goToSignup();
        
        if (width <= 768) {
          // Mobile/tablet layout
          await mobileHelpers.checkMobileLayout();
          
          // Name fields should stack on narrow screens
          const firstNameBox = await page.getByLabel(/first name/i).boundingBox();
          const lastNameBox = await page.getByLabel(/last name/i).boundingBox();
          
          if (firstNameBox && lastNameBox && width <= 640) {
            // Should be stacked vertically
            expect(Math.abs(firstNameBox.y - lastNameBox.y)).toBeGreaterThan(10);
          }
        } else {
          // Desktop layout
          // Name fields might be side-by-side
          const firstNameBox = await page.getByLabel(/first name/i).boundingBox();
          const lastNameBox = await page.getByLabel(/last name/i).boundingBox();
          
          if (firstNameBox && lastNameBox) {
            // Could be side-by-side (similar Y positions)
            const yDifference = Math.abs(firstNameBox.y - lastNameBox.y);
            expect(yDifference).toBeLessThan(firstNameBox.height + 20);
          }
        }
      });
    });

    test('should transition smoothly between breakpoints', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Start at mobile width
      await page.setViewportSize({ width: 375, height: 812 });
      const mobileLayout = await page.screenshot({ fullPage: true });
      
      // Transition to tablet
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(100); // Allow for transitions
      const tabletLayout = await page.screenshot({ fullPage: true });
      
      // Transition to desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(100);
      const desktopLayout = await page.screenshot({ fullPage: true });
      
      // Layouts should be different (responsive)
      expect(mobileLayout.equals(tabletLayout)).toBe(false);
      expect(tabletLayout.equals(desktopLayout)).toBe(false);
      
      // Form should remain functional at all sizes
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Device-Specific Features', () => {
    test('should support iOS Safari specific features', async ({ page }) => {
      // Simulate iOS Safari
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1');
      await page.setViewportSize({ width: 375, height: 812 });
      
      await authHelpers.goToLogin();
      
      // Should handle iOS Safari zoom issues
      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewportMeta).toContain('user-scalable=no');
      
      // Form inputs should not zoom on focus
      const emailField = page.getByLabel(/email/i);
      const fontSize = await emailField.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });
      
      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16); // iOS won't zoom if 16px+
    });

    test('should support Android Chrome specific features', async ({ page }) => {
      // Simulate Android Chrome
      await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36');
      await page.setViewportSize({ width: 360, height: 800 });
      
      await authHelpers.goToSignup();
      
      // Should handle Android keyboard properly
      const passwordField = page.getByLabel(/^password$/i);
      
      // Should have proper input attributes for Android
      await expect(passwordField).toHaveAttribute('type', 'password');
      const autocomplete = await passwordField.getAttribute('autocomplete');
      expect(autocomplete).toBe('new-password');
    });

    test('should handle notch/safe areas on newer devices', async ({ page }) => {
      // Simulate iPhone X with notch
      await page.setViewportSize({ width: 375, height: 812 });
      
      await authHelpers.goToLogin();
      
      // Content should not be obscured by notch
      const header = page.locator('header, .header, h1').first();
      if (await header.isVisible()) {
        const headerBox = await header.boundingBox();
        if (headerBox) {
          // Should have safe area padding
          expect(headerBox.y).toBeGreaterThanOrEqual(20); // Safe area top
        }
      }
      
      // Bottom content should account for home indicator
      const submitButton = page.getByRole('button', { name: /sign in/i });
      const buttonBox = await submitButton.boundingBox();
      if (buttonBox) {
        const viewportHeight = 812;
        const bottomSpace = viewportHeight - (buttonBox.y + buttonBox.height);
        expect(bottomSpace).toBeGreaterThanOrEqual(10); // Safe area bottom
      }
    });

    test('should support PWA features on mobile', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Should have PWA manifest
      const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
      if (manifest) {
        expect(manifest).toBeTruthy();
        
        // Fetch and validate manifest
        const manifestResponse = await page.request.get(manifest);
        expect(manifestResponse.ok()).toBe(true);
        
        const manifestJson = await manifestResponse.json();
        expect(manifestJson.name || manifestJson.short_name).toBeTruthy();
        expect(manifestJson.start_url).toBeTruthy();
      }
      
      // Should have proper meta tags for mobile web app
      const appleMobileCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
      if (appleMobileCapable) {
        expect(appleMobileCapable).toBe('yes');
      }
    });
  });

  test.describe('Performance on Mobile', () => {
    test('should load quickly on mobile networks', async ({ page }) => {
      // Simulate slow 3G
      await page.context().route('**/*', async route => {
        // Add delay to simulate slow network
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });
      
      await page.setViewportSize({ width: 375, height: 812 });
      
      const startTime = Date.now();
      await authHelpers.goToLogin();
      
      // Page should be interactive within reasonable time even on slow network
      await expect(page.getByLabel(/email/i)).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(5000); // 5 seconds on slow 3G
    });

    test('should handle limited mobile memory', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      
      // Test memory usage by navigating through auth flows
      await authHelpers.goToLogin();
      await authHelpers.goToSignup();
      await authHelpers.goToForgotPassword();
      await authHelpers.goToLogin();
      
      // Page should remain responsive
      await expect(page.getByLabel(/email/i)).toBeVisible();
      
      // Should be able to fill and submit form
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should optimize images and assets for mobile', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Check for optimized images
      const images = await page.locator('img').all();
      
      for (const img of images) {
        if (await img.isVisible()) {
          const src = await img.getAttribute('src');
          const srcset = await img.getAttribute('srcset');
          
          // Should have responsive images or appropriate size
          if (src) {
            // Images should be optimized (WebP, appropriate size)
            const hasOptimizedFormat = src.includes('.webp') || src.includes('.avif');
            const hasResponsiveSrc = srcset !== null;
            
            expect(hasOptimizedFormat || hasResponsiveSrc).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Mobile Form Validation', () => {
    test('should show validation errors appropriately on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await authHelpers.goToSignup();
      
      // Submit form with errors
      await authHelpers.submitSignupForm();
      
      // Errors should be visible and not overlap
      const errors = await page.locator('[role="alert"]').all();
      expect(errors.length).toBeGreaterThan(0);
      
      for (let i = 0; i < errors.length; i++) {
        const error = errors[i];
        if (await error.isVisible()) {
          const errorBox = await error.boundingBox();
          if (errorBox) {
            // Error should be within viewport
            expect(errorBox.x).toBeGreaterThanOrEqual(0);
            expect(errorBox.x + errorBox.width).toBeLessThanOrEqual(375);
            
            // Should not overlap with other errors
            for (let j = i + 1; j < errors.length; j++) {
              const otherError = errors[j];
              if (await otherError.isVisible()) {
                const otherBox = await otherError.boundingBox();
                if (otherBox) {
                  const overlap = !(
                    errorBox.y + errorBox.height <= otherBox.y ||
                    otherBox.y + otherBox.height <= errorBox.y
                  );
                  expect(overlap).toBe(false);
                }
              }
            }
          }
        }
      }
    });

    test('should handle real-time validation on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await authHelpers.goToSignup();
      
      const passwordField = page.getByLabel(/^password$/i);
      
      // Type weak password
      await passwordField.fill('weak');
      
      // Should show strength indicator
      await expect(page.getByText(/password strength/i)).toBeVisible();
      await expect(page.getByText(/very weak|weak/i)).toBeVisible();
      
      // Improve password
      await passwordField.fill('StrongPass123!');
      await expect(page.getByText(/strong/i)).toBeVisible();
      
      // Validation should not cause layout shift on mobile
      const formHeight = await page.locator('form').evaluate(el => el.scrollHeight);
      
      // Clear and retype password
      await passwordField.fill('');
      await passwordField.fill('AnotherStrong123!');
      
      const newFormHeight = await page.locator('form').evaluate(el => el.scrollHeight);
      
      // Height should remain relatively stable
      expect(Math.abs(formHeight - newFormHeight)).toBeLessThan(50);
    });
  });
});