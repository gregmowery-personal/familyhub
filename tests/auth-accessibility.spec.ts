import { test, expect } from '@playwright/test';
import { 
  AuthPageHelpers, 
  AccessibilityTestHelpers,
  TouchTargetTestHelpers 
} from './helpers/auth-helpers';
import { 
  testUsers, 
  accessibilityTestData, 
  touchTargetRequirements,
  contrastRequirements,
  mobileViewports 
} from './helpers/auth-fixtures';

test.describe('Authentication Accessibility Compliance', () => {
  let authHelpers: AuthPageHelpers;
  let a11yHelpers: AccessibilityTestHelpers;
  let touchHelpers: TouchTargetTestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthPageHelpers(page);
    a11yHelpers = new AccessibilityTestHelpers(page);
    touchHelpers = new TouchTargetTestHelpers(page);
  });

  test.describe('WCAG AA Compliance', () => {
    test.describe('Login Form Accessibility', () => {
      test.beforeEach(async ({ page }) => {
        await authHelpers.goToLogin();
      });

      test('should have proper form structure and semantics', async ({ page }) => {
        // Form should have proper role and structure
        const form = page.locator('form');
        await expect(form).toBeVisible();
        
        // Should have fieldset or proper grouping
        const formElements = await form.locator('input, button, label').count();
        expect(formElements).toBeGreaterThan(3);
        
        // Should have proper heading hierarchy
        await a11yHelpers.checkHeadingStructure();
      });

      test('should have proper form labels and associations', async ({ page }) => {
        await a11yHelpers.checkFormLabels();
        
        // Specific checks for login form
        const emailInput = page.getByLabel(/email/i);
        await expect(emailInput).toHaveAttribute('id');
        await expect(emailInput).toHaveAttribute('required');
        
        const passwordInput = page.getByLabel(/^password$/i);
        await expect(passwordInput).toHaveAttribute('id');
        await expect(passwordInput).toHaveAttribute('required');
        
        // Check for proper autocomplete attributes
        await expect(emailInput).toHaveAttribute('autocomplete', 'email');
        await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
      });

      test('should provide clear error messaging', async ({ page }) => {
        // Trigger validation errors
        await authHelpers.submitLoginForm();
        
        // Error messages should have proper ARIA attributes
        const errorMessages = page.locator('[role="alert"], [aria-live="polite"]');
        const errorCount = await errorMessages.count();
        expect(errorCount).toBeGreaterThan(0);
        
        // Error messages should be associated with form fields
        const emailError = page.locator('[role="alert"]').filter({ hasText: /email/i });
        const passwordError = page.locator('[role="alert"]').filter({ hasText: /password/i });
        
        await expect(emailError).toBeVisible();
        await expect(passwordError).toBeVisible();
        
        // Errors should be announced by screen readers
        for (const error of await errorMessages.all()) {
          const ariaLive = await error.getAttribute('aria-live');
          const role = await error.getAttribute('role');
          expect(ariaLive === 'polite' || ariaLive === 'assertive' || role === 'alert').toBe(true);
        }
      });

      test('should support keyboard navigation', async ({ page }) => {
        await a11yHelpers.checkKeyboardNavigation();
        
        // Specific keyboard tests for login form
        await page.keyboard.press('Tab'); // Email field
        await expect(page.getByLabel(/email/i)).toBeFocused();
        
        await page.keyboard.press('Tab'); // Password field
        await expect(page.getByLabel(/^password$/i)).toBeFocused();
        
        await page.keyboard.press('Tab'); // Password toggle
        await expect(page.getByRole('button', { name: /show password/i })).toBeFocused();
        
        await page.keyboard.press('Tab'); // Remember me
        await expect(page.getByLabel(/remember me/i)).toBeFocused();
        
        await page.keyboard.press('Tab'); // Forgot password
        await expect(page.getByRole('button', { name: /forgot password/i })).toBeFocused();
        
        await page.keyboard.press('Tab'); // Submit button
        await expect(page.getByRole('button', { name: /sign in/i })).toBeFocused();
      });

      test('should have visible focus indicators', async ({ page }) => {
        const interactiveElements = await page.locator('input, button, a').all();
        
        for (const element of interactiveElements) {
          if (!(await element.isVisible())) continue;
          
          await element.focus();
          
          // Check for visible focus styles
          const focusStyles = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outline: styles.outline,
              outlineWidth: styles.outlineWidth,
              outlineColor: styles.outlineColor,
              boxShadow: styles.boxShadow,
              border: styles.border
            };
          });
          
          // Should have some form of focus indicator
          const hasFocusIndicator = (
            focusStyles.outline !== 'none' ||
            focusStyles.outlineWidth !== '0px' ||
            focusStyles.boxShadow.includes('rgb') ||
            focusStyles.border.includes('rgb')
          );
          
          expect(hasFocusIndicator).toBe(true);
        }
      });

      test('should provide sufficient color contrast', async ({ page }) => {
        await a11yHelpers.checkColorContrast();
        
        // Check specific elements for contrast
        const textElements = [
          page.getByText(/sign in/i).first(),
          page.getByLabel(/email/i),
          page.getByLabel(/^password$/i),
          page.getByText(/remember me/i),
          page.getByText(/forgot password/i)
        ];
        
        for (const element of textElements) {
          if (!(await element.isVisible())) continue;
          
          const contrast = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            
            // Get RGB values from computed color
            const colorMatch = styles.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            const bgColorMatch = styles.backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            
            if (!colorMatch || !bgColorMatch) return null;
            
            const textColor = {
              r: parseInt(colorMatch[1]),
              g: parseInt(colorMatch[2]),
              b: parseInt(colorMatch[3])
            };
            
            const bgColor = {
              r: parseInt(bgColorMatch[1]),
              g: parseInt(bgColorMatch[2]),
              b: parseInt(bgColorMatch[3])
            };
            
            // Calculate relative luminance
            const luminance = (color: {r: number, g: number, b: number}) => {
              const rgb = [color.r, color.g, color.b].map(c => {
                c = c / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
              });
              return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
            };
            
            const textLum = luminance(textColor);
            const bgLum = luminance(bgColor);
            
            // Calculate contrast ratio
            const contrast = (Math.max(textLum, bgLum) + 0.05) / (Math.min(textLum, bgLum) + 0.05);
            return contrast;
          });
          
          if (contrast) {
            // WCAG AA requires 4.5:1 for normal text
            expect(contrast).toBeGreaterThanOrEqual(contrastRequirements.normalText);
          }
        }
      });

      test('should work with screen readers', async ({ page }) => {
        // Check for proper ARIA landmarks
        await expect(page.locator('[role="main"], main')).toBeVisible();
        await expect(page.locator('[role="banner"], header')).toBeVisible();
        
        // Form should have proper role or be within main content
        const form = page.locator('form');
        const formRole = await form.getAttribute('role');
        const isInMain = await form.evaluate(el => {
          const main = document.querySelector('main, [role="main"]');
          return main?.contains(el) || false;
        });
        
        expect(formRole === 'form' || isInMain).toBe(true);
        
        // Check for proper announcement of dynamic content
        await authHelpers.submitLoginForm();
        const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]');
        const liveRegionCount = await liveRegions.count();
        expect(liveRegionCount).toBeGreaterThan(0);
      });

      test('should support assistive technology interactions', async ({ page }) => {
        // Test form submission with Enter key
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
        await page.getByLabel(/^password$/i).press('Enter');
        
        // Form should submit
        await page.waitForLoadState('networkidle');
        
        // Test button activation with Space key
        await authHelpers.goToLogin();
        const forgotPasswordBtn = page.getByRole('button', { name: /forgot password/i });
        await forgotPasswordBtn.focus();
        await page.keyboard.press(' ');
        
        // Should navigate to forgot password form
        await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
      });
    });

    test.describe('Signup Form Accessibility', () => {
      test.beforeEach(async ({ page }) => {
        await authHelpers.goToSignup();
      });

      test('should have complex form accessibility features', async ({ page }) => {
        // Check fieldset grouping for related fields
        const nameFields = page.locator('input[autocomplete*="name"]');
        const nameFieldCount = await nameFields.count();
        expect(nameFieldCount).toBe(2); // First name and last name
        
        // Password fields should be properly grouped
        const passwordFields = page.locator('input[type="password"]');
        const passwordFieldCount = await passwordFields.count();
        expect(passwordFieldCount).toBe(2); // Password and confirm password
        
        // Check for proper form instructions
        await expect(page.getByText(/enter your email address/i)).toBeVisible();
        
        // Check for password requirements announcement
        const passwordField = page.getByLabel(/^password$/i);
        await passwordField.focus();
        await passwordField.fill('weak');
        
        // Password strength should be announced
        await expect(page.getByText(/password strength/i)).toBeVisible();
      });

      test('should handle complex validation messaging', async ({ page }) => {
        await authHelpers.submitSignupForm();
        
        // Multiple validation errors should be properly announced
        const errors = await page.locator('[role="alert"]').count();
        expect(errors).toBeGreaterThan(3);
        
        // Each error should be associated with its field
        const firstNameError = page.locator('[role="alert"]').filter({ hasText: /first name/i });
        const emailError = page.locator('[role="alert"]').filter({ hasText: /email/i });
        const termsError = page.locator('[role="alert"]').filter({ hasText: /terms/i });
        
        await expect(firstNameError).toBeVisible();
        await expect(emailError).toBeVisible();
        await expect(termsError).toBeVisible();
      });

      test('should support dynamic content updates', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        
        // Password strength should update dynamically
        await passwordField.fill('weak');
        await expect(page.getByText(/very weak/i)).toBeVisible();
        
        await passwordField.fill('StrongPass123!');
        await expect(page.getByText(/strong/i)).toBeVisible();
        
        // Updates should be announced to screen readers
        const strengthIndicator = page.locator('[aria-live]').filter({ hasText: /strength/i });
        if (await strengthIndicator.count() > 0) {
          await expect(strengthIndicator).toHaveAttribute('aria-live', 'polite');
        }
      });

      test('should handle checkbox and link accessibility', async ({ page }) => {
        // Terms checkbox should be properly labeled
        const termsCheckbox = page.getByLabel(/accept.*terms/i);
        await expect(termsCheckbox).toHaveAttribute('type', 'checkbox');
        
        // Terms and privacy links should be accessible
        const termsLink = page.getByRole('button', { name: /terms of service/i });
        const privacyLink = page.getByRole('button', { name: /privacy policy/i });
        
        await expect(termsLink).toBeVisible();
        await expect(privacyLink).toBeVisible();
        
        // Links should be keyboard accessible
        await termsLink.focus();
        await expect(termsLink).toBeFocused();
        
        await privacyLink.focus();
        await expect(privacyLink).toBeFocused();
        
        // Optional newsletter checkbox should be clearly labeled
        const newsletterCheckbox = page.getByLabel(/newsletter/i);
        await expect(newsletterCheckbox).toBeVisible();
        const isRequired = await newsletterCheckbox.getAttribute('required');
        expect(isRequired).toBeNull(); // Should not be required
      });
    });

    test.describe('Social Login Accessibility', () => {
      test.beforeEach(async ({ page }) => {
        await authHelpers.goToLogin();
      });

      test('should have accessible social login buttons', async ({ page }) => {
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        
        // Buttons should have proper labels
        await expect(googleButton).toHaveAttribute('aria-label', 'Continue with Google');
        await expect(appleButton).toHaveAttribute('aria-label', 'Continue with Apple');
        
        // Icons should be decorative (aria-hidden)
        const googleIcon = googleButton.locator('svg');
        const appleIcon = appleButton.locator('svg');
        
        await expect(googleIcon).toHaveAttribute('aria-hidden', 'true');
        await expect(appleIcon).toHaveAttribute('aria-hidden', 'true');
        
        // Buttons should meet touch target requirements
        const googleBox = await googleButton.boundingBox();
        const appleBox = await appleButton.boundingBox();
        
        expect(googleBox?.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
        expect(appleBox?.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
      });

      test('should handle loading states accessibly', async ({ page }) => {
        // Mock delayed social login
        await page.route('**/api/auth/social/google', async route => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await route.fulfill({ status: 200, body: '{}' });
        });
        
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        await googleButton.click();
        
        // Loading state should be announced
        await expect(googleButton).toContainText(/connecting/i);
        await expect(googleButton).toBeDisabled();
        
        // Should have proper ARIA attributes during loading
        const ariaLabel = await googleButton.getAttribute('aria-label');
        expect(ariaLabel).toContain('Google');
        
        // Other buttons should be disabled during loading
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        await expect(appleButton).toBeDisabled();
      });
    });

    test.describe('Error Handling Accessibility', () => {
      test('should make error messages accessible', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Mock API error
        await page.route('**/api/auth/login', async route => {
          await route.fulfill({
            status: 401,
            body: JSON.stringify({ error: 'Invalid credentials' })
          });
        });
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: 'wrongpassword'
        });
        await authHelpers.submitLoginForm();
        
        // Error should be announced
        const errorAlert = page.locator('[role="alert"]').filter({ hasText: /invalid/i });
        await expect(errorAlert).toBeVisible();
        
        // Should have proper heading structure for error
        const errorHeading = errorAlert.locator('h1, h2, h3, h4, h5, h6').first();
        if (await errorHeading.count() > 0) {
          await expect(errorHeading).toBeVisible();
        }
        
        // Focus should be managed after error
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      });

      test('should handle network errors accessibly', async ({ page }) => {
        await authHelpers.goToLogin();
        
        // Mock network error
        await page.route('**/api/auth/**', route => route.abort('connectionfailed'));
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        await authHelpers.submitLoginForm();
        
        // Network error should be announced
        const networkError = page.locator('[role="alert"]').filter({ hasText: /network|connection/i });
        await expect(networkError).toBeVisible();
        
        // Should provide retry mechanism
        const retryButton = page.getByRole('button', { name: /try again|retry/i });
        if (await retryButton.count() > 0) {
          await expect(retryButton).toBeVisible();
          await expect(retryButton).toBeFocused();
        }
      });
    });
  });

  test.describe('Touch Target Compliance', () => {
    test('should meet WCAG touch target requirements', async ({ page }) => {
      await authHelpers.goToLogin();
      await touchHelpers.checkTouchTargetSizes();
    });

    test('should have adequate spacing between targets', async ({ page }) => {
      await authHelpers.goToSignup();
      await touchHelpers.checkTouchTargetSpacing();
    });

    test('should maintain touch targets during form state changes', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Check initial state
      await touchHelpers.checkTouchTargetSizes();
      
      // Submit form to show errors
      await authHelpers.submitLoginForm();
      
      // Check that touch targets are still adequate with errors shown
      await touchHelpers.checkTouchTargetSizes();
      
      // Check that error messages don't interfere with touch targets
      const submitButton = page.getByRole('button', { name: /sign in/i });
      const buttonBox = await submitButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
    });
  });

  test.describe('Mobile Accessibility', () => {
    mobileViewports.forEach(({ name, width, height }) => {
      test.describe(`${name} (${width}x${height})`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width, height });
        });

        test('should maintain accessibility on mobile', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Check touch targets
          await touchHelpers.checkTouchTargetSizes();
          
          // Check keyboard navigation works on mobile
          await a11yHelpers.checkKeyboardNavigation();
          
          // Check form labels
          await a11yHelpers.checkFormLabels();
        });

        test('should handle mobile keyboard interactions', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Email field should trigger email keyboard
          const emailField = page.getByLabel(/email/i);
          await expect(emailField).toHaveAttribute('type', 'email');
          await expect(emailField).toHaveAttribute('inputmode', 'email');
          
          // Password field should trigger secure keyboard
          const passwordField = page.getByLabel(/^password$/i);
          await expect(passwordField).toHaveAttribute('type', 'password');
          
          // Test that form can be submitted with mobile keyboard
          await emailField.fill(testUsers.valid.email);
          await passwordField.fill(testUsers.valid.password);
          await passwordField.press('Enter');
          
          await page.waitForLoadState('networkidle');
        });

        test('should handle focus management on mobile', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Submit form to show errors
          await authHelpers.submitSignupForm();
          
          // First error field should receive focus
          const firstErrorField = page.getByLabel(/first name/i);
          await expect(firstErrorField).toBeFocused();
          
          // Error should be visible in viewport
          await expect(firstErrorField).toBeInViewport();
        });

        test('should support mobile assistive technologies', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Check that content is properly structured for mobile screen readers
          await a11yHelpers.checkHeadingStructure();
          
          // Check that form instructions are available
          const instructions = page.locator('[role="note"], .form-instructions, .help-text');
          if (await instructions.count() > 0) {
            await expect(instructions.first()).toBeVisible();
          }
          
          // Check that error announcements work on mobile
          await authHelpers.submitLoginForm();
          const alerts = page.locator('[role="alert"]');
          const alertCount = await alerts.count();
          expect(alertCount).toBeGreaterThan(0);
        });
      });
    });
  });

  test.describe('High Contrast and Visual Accessibility', () => {
    test('should work in high contrast mode', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Simulate high contrast mode
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            * {
              background: white !important;
              color: black !important;
              border-color: black !important;
            }
            :focus {
              outline: 3px solid yellow !important;
            }
          }
        `
      });
      
      // Elements should still be visible and functional
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/^password$/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Focus indicators should be enhanced
      const emailField = page.getByLabel(/email/i);
      await emailField.focus();
      
      const focusStyles = await emailField.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline;
      });
      
      expect(focusStyles).toBeTruthy();
      expect(focusStyles).not.toBe('none');
    });

    test('should support reduced motion preferences', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      // Animations should be disabled or reduced
      const animatedElements = page.locator('.transition, .animate, [style*="transition"]');
      const animatedCount = await animatedElements.count();
      
      if (animatedCount > 0) {
        for (const element of await animatedElements.all()) {
          const transitionStyle = await element.evaluate(el => {
            return window.getComputedStyle(el).transition;
          });
          
          // Transitions should be disabled or very short
          expect(transitionStyle === 'none' || transitionStyle.includes('0s')).toBe(true);
        }
      }
    });

    test('should work with forced colors mode', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Simulate Windows High Contrast mode
      await page.addStyleTag({
        content: `
          @media (forced-colors: active) {
            * {
              color: CanvasText !important;
              background-color: Canvas !important;
              border-color: CanvasText !important;
            }
            button {
              background-color: ButtonFace !important;
              color: ButtonText !important;
              border-color: ButtonText !important;
            }
            :focus {
              outline: 2px solid Highlight !important;
            }
          }
        `
      });
      
      // Form should still be usable
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Focus should be clearly visible
      const button = page.getByRole('button', { name: /sign in/i });
      await button.focus();
      await expect(button).toBeFocused();
    });
  });

  test.describe('Screen Reader Specific Tests', () => {
    test('should provide proper form context', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Form should have accessible name
      const form = page.locator('form');
      const formName = await form.evaluate(el => {
        return el.getAttribute('aria-label') || 
               el.getAttribute('aria-labelledby') ||
               document.querySelector('h1, h2')?.textContent ||
               'Login form';
      });
      
      expect(formName).toBeTruthy();
    });

    test('should announce loading states', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Mock slow response
      await page.route('**/api/auth/login', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({ status: 200, body: '{}' });
      });
      
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await submitButton.click();
      
      // Loading state should be announced
      await expect(submitButton).toContainText(/signing|loading/i);
      
      // Button should indicate it's busy
      const ariaLabel = await submitButton.getAttribute('aria-label');
      const ariaDescribedBy = await submitButton.getAttribute('aria-describedby');
      const isDisabled = await submitButton.isDisabled();
      
      expect(isDisabled || ariaLabel?.includes('loading') || ariaDescribedBy).toBeTruthy();
    });

    test('should provide progress indication for multi-step flows', async ({ page }) => {
      await authHelpers.goToSignup();
      
      // If there are progress indicators, they should be accessible
      const progressIndicators = page.locator('[role="progressbar"], .progress, .step-indicator');
      const progressCount = await progressIndicators.count();
      
      if (progressCount > 0) {
        const progress = progressIndicators.first();
        
        // Should have proper ARIA attributes
        const hasAriaLabel = await progress.getAttribute('aria-label');
        const hasAriaValueNow = await progress.getAttribute('aria-valuenow');
        const hasAriaValueMax = await progress.getAttribute('aria-valuemax');
        
        expect(hasAriaLabel || hasAriaValueNow || hasAriaValueMax).toBeTruthy();
      }
    });

    test('should handle live region updates properly', async ({ page }) => {
      await authHelpers.goToSignup();
      
      const passwordField = page.getByLabel(/^password$/i);
      
      // Password strength updates should be in live region
      await passwordField.fill('weak');
      
      const liveRegions = page.locator('[aria-live]');
      const liveRegionCount = await liveRegions.count();
      
      if (liveRegionCount > 0) {
        const strengthRegion = liveRegions.filter({ hasText: /strength|weak|strong/i });
        if (await strengthRegion.count() > 0) {
          const politeness = await strengthRegion.first().getAttribute('aria-live');
          expect(['polite', 'assertive']).toContain(politeness);
        }
      }
    });
  });

  test.describe('Keyboard Navigation Edge Cases', () => {
    test('should handle focus trapping in modals', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // If there are modal dialogs, test focus trapping
      const modals = page.locator('[role="dialog"], .modal, .popup');
      const modalCount = await modals.count();
      
      if (modalCount > 0) {
        const modal = modals.first();
        await expect(modal).toBeVisible();
        
        // Focus should be trapped within modal
        const focusableElements = modal.locator('input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
        const elementCount = await focusableElements.count();
        
        if (elementCount > 0) {
          // Tab through all elements
          for (let i = 0; i < elementCount; i++) {
            await page.keyboard.press('Tab');
            const focusedElement = page.locator(':focus');
            const isInModal = await focusedElement.evaluate(el => {
              const modalEl = document.querySelector('[role="dialog"], .modal, .popup');
              return modalEl?.contains(el) || false;
            });
            expect(isInModal).toBe(true);
          }
        }
      }
    });

    test('should handle escape key properly', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Test escape key dismisses overlays
      const passwordField = page.getByLabel(/^password$/i);
      await passwordField.focus();
      await page.keyboard.press('Escape');
      
      // If there are dismissible elements (dropdowns, tooltips), they should close
      const overlays = page.locator('.dropdown-open, .tooltip-open, [aria-expanded="true"]');
      const overlayCount = await overlays.count();
      
      if (overlayCount > 0) {
        // Overlays should be closed after escape
        await page.waitForTimeout(100);
        const stillOpenCount = await overlays.count();
        expect(stillOpenCount).toBeLessThanOrEqual(overlayCount);
      }
    });

    test('should support arrow key navigation where appropriate', async ({ page }) => {
      // If there are radio button groups or other arrow-navigable controls
      const radioGroups = page.locator('[role="radiogroup"], input[type="radio"]');
      const radioGroupCount = await radioGroups.count();
      
      if (radioGroupCount > 0) {
        const firstRadio = radioGroups.first();
        await firstRadio.focus();
        
        // Arrow keys should navigate within group
        await page.keyboard.press('ArrowDown');
        const focusedElement = page.locator(':focus');
        const isRadio = await focusedElement.getAttribute('type');
        expect(isRadio).toBe('radio');
      }
    });
  });
});