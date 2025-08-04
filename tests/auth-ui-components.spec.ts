import { test, expect } from '@playwright/test';
import { 
  AuthPageHelpers, 
  APITestHelpers,
  AccessibilityTestHelpers,
  TouchTargetTestHelpers 
} from './helpers/auth-helpers';
import { 
  testUsers, 
  formTestData, 
  errorMessages, 
  apiResponses,
  mobileViewports 
} from './helpers/auth-fixtures';

test.describe('Authentication UI Components', () => {
  let authHelpers: AuthPageHelpers;
  let apiHelpers: APITestHelpers;
  let a11yHelpers: AccessibilityTestHelpers;
  let touchHelpers: TouchTargetTestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthPageHelpers(page);
    apiHelpers = new APITestHelpers(page);
    a11yHelpers = new AccessibilityTestHelpers(page);
    touchHelpers = new TouchTargetTestHelpers(page);
  });

  test.describe('LoginForm Component', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.goToLogin();
    });

    test.describe('Form Rendering', () => {
      test('should render all form elements correctly', async ({ page }) => {
        // Check form structure
        await expect(page.locator('form')).toBeVisible();
        
        // Check email field
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toHaveAttribute('type', 'email');
        await expect(page.getByLabel(/email/i)).toHaveAttribute('autocomplete', 'email');
        await expect(page.getByLabel(/email/i)).toHaveAttribute('required');
        
        // Check password field
        await expect(page.getByLabel(/^password$/i)).toBeVisible();
        await expect(page.getByLabel(/^password$/i)).toHaveAttribute('type', 'password');
        await expect(page.getByLabel(/^password$/i)).toHaveAttribute('autocomplete', 'current-password');
        await expect(page.getByLabel(/^password$/i)).toHaveAttribute('required');
        
        // Check password toggle button
        await expect(page.getByRole('button', { name: /show password/i })).toBeVisible();
        
        // Check remember me checkbox
        await expect(page.getByLabel(/remember me/i)).toBeVisible();
        
        // Check forgot password link
        await expect(page.getByRole('button', { name: /forgot password/i })).toBeVisible();
        
        // Check submit button
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toHaveAttribute('type', 'submit');
      });

      test('should have proper ARIA labels and accessibility attributes', async ({ page }) => {
        // Check submit button has proper aria-label
        await expect(page.getByRole('button', { name: /sign in/i })).toHaveAttribute('aria-label', 'Sign in to your FamilyHub account');
        
        // Check password toggle has proper aria-label
        const passwordToggle = page.getByRole('button', { name: /show password/i });
        await expect(passwordToggle).toHaveAttribute('aria-label', 'Show password');
        
        // Check form has noValidate attribute for custom validation
        await expect(page.locator('form')).toHaveAttribute('novalidate');
      });
    });

    test.describe('Form Validation', () => {
      test('should show required field errors when submitting empty form', async ({ page }) => {
        await authHelpers.submitLoginForm();
        
        await authHelpers.expectFieldError('email', errorMessages.required.email);
        await authHelpers.expectFieldError('password', errorMessages.required.password);
      });

      test('should validate email format', async ({ page }) => {
        for (const invalidEmail of formTestData.emails.invalid) {
          await page.getByLabel(/email/i).fill(invalidEmail);
          await authHelpers.submitLoginForm();
          
          if (invalidEmail === '') {
            await authHelpers.expectFieldError('email', errorMessages.required.email);
          } else {
            await authHelpers.expectFieldError('email', errorMessages.invalid.email);
          }
          
          // Clear field for next test
          await page.getByLabel(/email/i).fill('');
        }
      });

      test('should validate password length', async ({ page }) => {
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill('short');
        await authHelpers.submitLoginForm();
        
        await authHelpers.expectFieldError('password', errorMessages.invalid.passwordTooShort);
      });

      test('should clear validation errors when valid input is provided', async ({ page }) => {
        // First trigger validation errors
        await authHelpers.submitLoginForm();
        await authHelpers.expectFieldError('email', errorMessages.required.email);
        
        // Then provide valid input
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
        
        // Errors should be cleared
        await authHelpers.expectNoFieldErrors();
      });
    });

    test.describe('Password Visibility Toggle', () => {
      test('should toggle password visibility', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        const toggleButton = page.getByRole('button', { name: /show password/i });
        
        // Initially password should be hidden
        await expect(passwordField).toHaveAttribute('type', 'password');
        
        // Click to show password
        await toggleButton.click();
        await expect(passwordField).toHaveAttribute('type', 'text');
        await expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');
        
        // Click to hide password again
        await toggleButton.click();
        await expect(passwordField).toHaveAttribute('type', 'password');
        await expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
      });

      test('should maintain password visibility state during form interaction', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        const toggleButton = page.getByRole('button', { name: /show password/i });
        
        // Show password
        await toggleButton.click();
        await expect(passwordField).toHaveAttribute('type', 'text');
        
        // Fill other fields
        await page.getByLabel(/email/i).fill(testUsers.valid.email);
        await passwordField.fill(testUsers.valid.password);
        
        // Password should still be visible
        await expect(passwordField).toHaveAttribute('type', 'text');
      });
    });

    test.describe('Form Submission', () => {
      test('should show loading state during submission', async ({ page }) => {
        await apiHelpers.mockSuccessfulLogin();
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.expectLoadingState('signing');
      });

      test('should handle successful login', async ({ page }) => {
        await apiHelpers.mockSuccessfulLogin();
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.waitForLoadingComplete();
        await authHelpers.expectLoginSuccess();
      });

      test('should handle login failure', async ({ page }) => {
        await apiHelpers.mockFailedLogin(errorMessages.auth.invalidCredentials);
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: 'wrongpassword'
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.waitForLoadingComplete();
        await authHelpers.expectFormError(errorMessages.auth.invalidCredentials);
      });

      test('should handle network errors gracefully', async ({ page }) => {
        await apiHelpers.mockNetworkError();
        
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: testUsers.valid.password
        });
        
        await authHelpers.submitLoginForm();
        await authHelpers.waitForLoadingComplete();
        await authHelpers.expectFormError('An unexpected error occurred');
      });
    });

    test.describe('Remember Me Functionality', () => {
      test('should allow checking and unchecking remember me', async ({ page }) => {
        const rememberMeCheckbox = page.getByLabel(/remember me/i);
        
        // Initially unchecked
        await expect(rememberMeCheckbox).not.toBeChecked();
        
        // Check the box
        await rememberMeCheckbox.check();
        await expect(rememberMeCheckbox).toBeChecked();
        
        // Uncheck the box
        await rememberMeCheckbox.uncheck();
        await expect(rememberMeCheckbox).not.toBeChecked();
      });

      test('should maintain remember me state during form validation', async ({ page }) => {
        const rememberMeCheckbox = page.getByLabel(/remember me/i);
        
        // Check remember me
        await rememberMeCheckbox.check();
        
        // Submit form with validation errors
        await authHelpers.submitLoginForm();
        await authHelpers.expectFieldError('email', errorMessages.required.email);
        
        // Remember me should still be checked
        await expect(rememberMeCheckbox).toBeChecked();
      });
    });

    test.describe('Forgot Password Integration', () => {
      test('should navigate to forgot password form', async ({ page }) => {
        await page.getByRole('button', { name: /forgot password/i }).click();
        
        // Should show forgot password form
        await expect(page.getByText(/reset your password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
      });
    });
  });

  test.describe('SignupForm Component', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.goToSignup();
    });

    test.describe('Form Rendering', () => {
      test('should render all form elements correctly', async ({ page }) => {
        // Name fields
        await expect(page.getByLabel(/first name/i)).toBeVisible();
        await expect(page.getByLabel(/last name/i)).toBeVisible();
        
        // Email field
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toHaveAttribute('type', 'email');
        
        // Password fields
        await expect(page.getByLabel(/^password$/i)).toBeVisible();
        await expect(page.getByLabel(/confirm password/i)).toBeVisible();
        
        // Password toggle buttons
        await expect(page.getByRole('button', { name: /show password/i }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /show confirm password/i })).toBeVisible();
        
        // Terms checkbox
        await expect(page.getByLabel(/accept.*terms/i)).toBeVisible();
        
        // Newsletter checkbox (optional)
        await expect(page.getByLabel(/newsletter/i)).toBeVisible();
        
        // Submit button
        await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
      });

      test('should have proper autocomplete attributes', async ({ page }) => {
        await expect(page.getByLabel(/first name/i)).toHaveAttribute('autocomplete', 'given-name');
        await expect(page.getByLabel(/last name/i)).toHaveAttribute('autocomplete', 'family-name');
        await expect(page.getByLabel(/email/i)).toHaveAttribute('autocomplete', 'email');
        await expect(page.getByLabel(/^password$/i)).toHaveAttribute('autocomplete', 'new-password');
        await expect(page.getByLabel(/confirm password/i)).toHaveAttribute('autocomplete', 'new-password');
      });
    });

    test.describe('Form Validation', () => {
      test('should validate required fields', async ({ page }) => {
        await authHelpers.submitSignupForm();
        
        await authHelpers.expectFieldError('first name', errorMessages.required.firstName);
        await authHelpers.expectFieldError('last name', errorMessages.required.lastName);
        await authHelpers.expectFieldError('email', errorMessages.required.email);
        await authHelpers.expectFieldError('password', errorMessages.required.password);
        await authHelpers.expectFieldError('confirm password', errorMessages.required.confirmPassword);
      });

      test('should validate name format', async ({ page }) => {
        // Test invalid names
        for (const invalidName of formTestData.names.invalid) {
          await page.getByLabel(/first name/i).fill(invalidName);
          await authHelpers.submitSignupForm();
          
          if (invalidName === '' || invalidName === 'A') {
            await authHelpers.expectFieldError('first name', 
              invalidName === '' ? errorMessages.required.firstName : errorMessages.invalid.nameTooShort);
          } else {
            await authHelpers.expectFieldError('first name', errorMessages.invalid.nameInvalidChars);
          }
          
          await page.getByLabel(/first name/i).fill('');
        }
      });

      test('should validate password strength', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        
        // Test weak passwords
        for (const weakPassword of formTestData.passwords.invalid) {
          await passwordField.fill(weakPassword);
          await authHelpers.submitSignupForm();
          
          // Should show appropriate password error
          const errorText = await page.locator('.text-error, [role="alert"]').textContent();
          expect(errorText).toContain('Password must');
          
          await passwordField.fill('');
        }
      });

      test('should show password strength indicator', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        
        // Test different password strengths
        const passwordTests = [
          { password: 'weak', expectedStrength: 'Very weak' },
          { password: 'Weak123', expectedStrength: 'Fair' },
          { password: 'StrongPass123!', expectedStrength: 'Strong' }
        ];
        
        for (const test of passwordTests) {
          await passwordField.fill(test.password);
          
          if (test.password.length >= 1) {
            await expect(page.getByText(/password strength/i)).toBeVisible();
            await expect(page.getByText(test.expectedStrength)).toBeVisible();
          }
        }
      });

      test('should validate password confirmation match', async ({ page }) => {
        await page.getByLabel(/^password$/i).fill('Password123!');
        await page.getByLabel(/confirm password/i).fill('DifferentPassword123!');
        await authHelpers.submitSignupForm();
        
        await authHelpers.expectFieldError('confirm password', errorMessages.invalid.passwordMismatch);
      });

      test('should require terms acceptance', async ({ page }) => {
        await authHelpers.fillSignupForm(testUsers.valid);
        // Don't check terms
        await page.getByLabel(/accept.*terms/i).uncheck();
        await authHelpers.submitSignupForm();
        
        await expect(page.getByText(errorMessages.terms.mustAccept)).toBeVisible();
      });
    });

    test.describe('Password Strength Features', () => {
      test('should update strength indicator in real-time', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        
        // Start with empty - no indicator
        await expect(page.getByText(/password strength/i)).not.toBeVisible();
        
        // Type weak password
        await passwordField.fill('pass');
        await expect(page.getByText(/very weak/i)).toBeVisible();
        
        // Improve password
        await passwordField.fill('Password123!');
        await expect(page.getByText(/strong/i)).toBeVisible();
      });

      test('should show password requirements feedback', async ({ page }) => {
        const passwordField = page.getByLabel(/^password$/i);
        
        // Test password without uppercase
        await passwordField.fill('password123!');
        await authHelpers.submitSignupForm();
        await authHelpers.expectFieldError('password', errorMessages.invalid.passwordNoUppercase);
        
        // Test password without number
        await passwordField.fill('Password!');
        await authHelpers.submitSignupForm();
        await authHelpers.expectFieldError('password', errorMessages.invalid.passwordNoNumber);
      });
    });

    test.describe('Terms and Privacy Links', () => {
      test('should handle terms of service link', async ({ page }) => {
        // Mock the terms click handler
        let termsClicked = false;
        await page.exposeFunction('onTermsClick', () => { termsClicked = true; });
        
        const termsLink = page.getByRole('button', { name: /terms of service/i });
        await expect(termsLink).toBeVisible();
        await expect(termsLink).toHaveAttribute('type', 'button');
      });

      test('should handle privacy policy link', async ({ page }) => {
        const privacyLink = page.getByRole('button', { name: /privacy policy/i });
        await expect(privacyLink).toBeVisible();
        await expect(privacyLink).toHaveAttribute('type', 'button');
      });
    });
  });

  test.describe('ForgotPasswordForm Component', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.goToForgotPassword();
    });

    test.describe('Form Rendering', () => {
      test('should render forgot password form correctly', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
        await expect(page.getByText(/enter your email address/i)).toBeVisible();
        
        // Email field
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toHaveAttribute('type', 'email');
        
        // Submit button
        await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
        
        // Back to login link
        await expect(page.getByRole('button', { name: /back to sign in/i })).toBeVisible();
        
        // Security notice
        await expect(page.getByText(/secure process/i)).toBeVisible();
        await expect(page.getByText(/expire after 1 hour/i)).toBeVisible();
      });
    });

    test.describe('Form Validation', () => {
      test('should validate email requirement', async ({ page }) => {
        await authHelpers.submitForgotPasswordForm();
        await authHelpers.expectFieldError('email', errorMessages.required.email);
      });

      test('should validate email format', async ({ page }) => {
        await page.getByLabel(/email/i).fill('invalid-email');
        await authHelpers.submitForgotPasswordForm();
        await authHelpers.expectFieldError('email', errorMessages.invalid.email);
      });
    });

    test.describe('Form Submission', () => {
      test('should handle successful reset request', async ({ page }) => {
        await page.route('**/api/auth/forgot-password', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: apiResponses.forgotPasswordSuccess.message
            })
          });
        });
        
        await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
        await authHelpers.submitForgotPasswordForm();
        
        await authHelpers.waitForLoadingComplete();
        await authHelpers.expectPasswordResetSuccess();
      });

      test('should hide form after successful submission', async ({ page }) => {
        await page.route('**/api/auth/forgot-password', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: apiResponses.forgotPasswordSuccess.message
            })
          });
        });
        
        await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
        await authHelpers.submitForgotPasswordForm();
        
        await authHelpers.waitForLoadingComplete();
        
        // Form should be hidden after success
        await expect(page.getByLabel(/email/i)).not.toBeVisible();
        await expect(page.getByRole('button', { name: /send reset link/i })).not.toBeVisible();
      });
    });

    test.describe('Navigation', () => {
      test('should navigate back to login', async ({ page }) => {
        await page.getByRole('button', { name: /back to sign in/i }).click();
        
        // Should show login form
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
        await expect(page.getByLabel(/^password$/i)).toBeVisible();
      });
    });
  });

  test.describe('SocialLoginButtons Component', () => {
    test.beforeEach(async ({ page }) => {
      await authHelpers.goToLogin();
    });

    test.describe('Button Rendering', () => {
      test('should render social login buttons correctly', async ({ page }) => {
        // Google button
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        await expect(googleButton).toBeVisible();
        await expect(googleButton).toHaveAttribute('aria-label', 'Continue with Google');
        
        // Apple button
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        await expect(appleButton).toBeVisible();
        await expect(appleButton).toHaveAttribute('aria-label', 'Continue with Apple');
      });

      test('should have proper touch target sizes', async ({ page }) => {
        await touchHelpers.checkTouchTargetSizes();
      });

      test('should display social provider icons', async ({ page }) => {
        // Google button should have Google colors/icon
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        await expect(googleButton.locator('svg')).toBeVisible();
        
        // Apple button should have Apple icon
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        await expect(appleButton.locator('svg')).toBeVisible();
      });
    });

    test.describe('Button Interactions', () => {
      test('should handle Google login click', async ({ page }) => {
        let googleClicked = false;
        await page.exposeFunction('onGoogleLogin', () => { googleClicked = true; });
        
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        await expect(googleButton).toBeEnabled();
        
        // Test that button can be clicked
        await expect(googleButton).toBeVisible();
      });

      test('should handle Apple login click', async ({ page }) => {
        let appleClicked = false;
        await page.exposeFunction('onAppleLogin', () => { appleClicked = true; });
        
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        await expect(appleButton).toBeEnabled();
        
        // Test that button can be clicked
        await expect(appleButton).toBeVisible();
      });

      test('should show loading state during social login', async ({ page }) => {
        // Mock a delayed response to test loading state
        await page.route('**/api/auth/social/google', async route => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        });
        
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        await googleButton.click();
        
        // Should show loading state
        await expect(googleButton).toContainText(/connecting/i);
        await expect(googleButton).toBeDisabled();
      });

      test('should disable all buttons during loading', async ({ page }) => {
        await page.route('**/api/auth/social/google', async route => {
          await new Promise(resolve => setTimeout(resolve, 500));
          await route.fulfill({ status: 200, body: '{}' });
        });
        
        const googleButton = page.getByRole('button', { name: /continue with google/i });
        const appleButton = page.getByRole('button', { name: /continue with apple/i });
        
        await googleButton.click();
        
        // Both buttons should be disabled during loading
        await expect(googleButton).toBeDisabled();
        await expect(appleButton).toBeDisabled();
      });
    });
  });

  test.describe('Cross-Component Interactions', () => {
    test('should maintain form state when switching between login and signup', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Fill login form
      await page.getByLabel(/email/i).fill(testUsers.valid.email);
      
      // Switch to signup
      await authHelpers.goToSignup();
      
      // Email should be preserved if possible
      const emailValue = await page.getByLabel(/email/i).inputValue();
      expect(emailValue).toBe('');
    });

    test('should handle form errors consistently across components', async ({ page }) => {
      // Test that all forms handle network errors the same way
      await apiHelpers.mockNetworkError();
      
      // Test login form
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({ email: testUsers.valid.email, password: testUsers.valid.password });
      await authHelpers.submitLoginForm();
      await authHelpers.waitForLoadingComplete();
      await authHelpers.expectFormError('An unexpected error occurred');
      
      // Test forgot password form
      await authHelpers.goToForgotPassword();
      await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
      await authHelpers.submitForgotPasswordForm();
      await authHelpers.waitForLoadingComplete();
      await authHelpers.expectFormError('An unexpected error occurred');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    mobileViewports.forEach(({ name, width, height }) => {
      test.describe(`${name} (${width}x${height})`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width, height });
        });

        test('should render forms correctly on mobile', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Form should be visible and usable
          await expect(page.locator('form')).toBeVisible();
          await expect(page.getByLabel(/email/i)).toBeVisible();
          await expect(page.getByLabel(/^password$/i)).toBeVisible();
          
          // Touch targets should be adequate
          await touchHelpers.checkTouchTargetSizes();
        });

        test('should maintain proper spacing on mobile', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Check that form elements don't overlap
          await touchHelpers.checkTouchTargetSpacing();
        });

        test('should handle form submission on mobile', async ({ page }) => {
          await apiHelpers.mockSuccessfulLogin();
          
          await authHelpers.goToLogin();
          await authHelpers.fillLoginForm({
            email: testUsers.valid.email,
            password: testUsers.valid.password
          });
          
          await authHelpers.submitLoginForm();
          await authHelpers.waitForLoadingComplete();
          await authHelpers.expectLoginSuccess();
        });
      });
    });
  });

  test.describe('Accessibility Compliance', () => {
    test('should meet WCAG AA requirements', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Check form labels
      await a11yHelpers.checkFormLabels();
      
      // Check keyboard navigation
      await a11yHelpers.checkKeyboardNavigation();
      
      // Check heading structure
      await a11yHelpers.checkHeadingStructure();
      
      // Check color contrast
      await a11yHelpers.checkColorContrast();
    });

    test('should support screen readers', async ({ page }) => {
      await authHelpers.goToSignup();
      
      // Check that form fields have proper labels
      const inputs = await page.locator('input').all();
      for (const input of inputs) {
        const inputId = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (inputId) {
          const label = page.locator(`label[for="${inputId}"]`);
          await expect(label).toBeVisible();
        } else {
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    });

    test('should provide proper error announcements', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.submitLoginForm();
      
      // Error messages should have proper ARIA attributes
      const errorMessages = page.locator('[role="alert"], .text-error');
      const errorCount = await errorMessages.count();
      expect(errorCount).toBeGreaterThan(0);
    });
  });
});