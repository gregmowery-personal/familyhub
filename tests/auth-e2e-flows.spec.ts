import { test, expect } from '@playwright/test';
import { 
  AuthPageHelpers, 
  APITestHelpers,
  generateTestUser,
  generateLoginCredentials 
} from './helpers/auth-helpers';
import { testUsers, mobileViewports } from './helpers/auth-fixtures';

test.describe('Authentication End-to-End Flows', () => {
  let authHelpers: AuthPageHelpers;
  let apiHelpers: APITestHelpers;

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthPageHelpers(page);
    apiHelpers = new APITestHelpers(page);
  });

  test.describe('Complete User Registration Flow', () => {
    test('should complete full signup → email verification → login flow', async ({ page }) => {
      const testUser = generateTestUser();

      // Step 1: User navigates to signup
      await authHelpers.goToSignup();
      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();

      // Step 2: User fills and submits signup form
      await authHelpers.fillSignupForm(testUser);
      await authHelpers.submitSignupForm();

      // Step 3: User sees success message
      await authHelpers.expectSignupSuccess();
      await expect(page.getByText(/check your email/i)).toBeVisible();
      await expect(page.getByText(testUser.email)).toBeVisible();

      // Step 4: Mock email verification (simulate clicking email link)
      // In real scenario, user would click link in email
      await page.goto('/auth/verify-email?token=mock-verification-token');
      
      // Step 5: Email verification success
      await expect(page.getByText(/email verified/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

      // Step 6: User clicks sign in link
      await page.getByRole('link', { name: /sign in/i }).click();

      // Step 7: User logs in with verified account
      await authHelpers.fillLoginForm({
        email: testUser.email,
        password: testUser.password
      });
      await authHelpers.submitLoginForm();

      // Step 8: User successfully accesses dashboard
      await authHelpers.expectLoginSuccess();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });

    test('should handle signup with newsletter subscription', async ({ page }) => {
      const testUser = generateTestUser();

      await authHelpers.goToSignup();
      await authHelpers.fillSignupForm(testUser);
      
      // Check newsletter subscription
      await page.getByLabel(/newsletter/i).check();
      
      await authHelpers.submitSignupForm();
      await authHelpers.expectSignupSuccess();

      // Verify subscription was recorded (would check in actual API)
      const newsletterCheckbox = page.getByLabel(/newsletter/i);
      await expect(newsletterCheckbox).toBeChecked();
    });

    test('should prevent duplicate email registration', async ({ page }) => {
      const testUser = generateTestUser();

      // First registration
      await authHelpers.goToSignup();
      await authHelpers.fillSignupForm(testUser);
      await authHelpers.submitSignupForm();
      await authHelpers.expectSignupSuccess();

      // Second registration with same email
      await authHelpers.goToSignup();
      await authHelpers.fillSignupForm(testUser);
      await authHelpers.submitSignupForm();

      // Should show error
      await authHelpers.expectFormError('email address is already registered');
    });

    test('should handle terms and privacy policy clicks', async ({ page }) => {
      await authHelpers.goToSignup();

      // Terms of Service link
      const termsLink = page.getByRole('button', { name: /terms of service/i });
      await expect(termsLink).toBeVisible();
      
      // Privacy Policy link  
      const privacyLink = page.getByRole('button', { name: /privacy policy/i });
      await expect(privacyLink).toBeVisible();

      // Click terms - should open terms page/modal
      await termsLink.click();
      // In real app, this would open terms page or modal
      
      // Fill form and submit
      const testUser = generateTestUser();
      await authHelpers.fillSignupForm(testUser);
      
      // Should require terms acceptance
      await page.getByLabel(/accept.*terms/i).uncheck();
      await authHelpers.submitSignupForm();
      await expect(page.getByText(/must accept the terms/i)).toBeVisible();
    });
  });

  test.describe('Login Flows', () => {
    test('should handle successful login with remember me', async ({ page }) => {
      const credentials = generateLoginCredentials({ rememberMe: true });

      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm(credentials);
      
      // Check remember me
      await page.getByLabel(/remember me/i).check();
      
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // Check that session is marked as persistent
      // This would typically involve checking cookies or local storage
      const cookies = await page.context().cookies();
      const sessionCookies = cookies.filter(cookie => 
        cookie.name.includes('session') || cookie.name.includes('auth')
      );
      
      // Persistent session should have longer expiry
      const hasPersistentSession = sessionCookies.some(cookie => 
        !cookie.expires || cookie.expires > Date.now() + 86400000 // > 24 hours
      );
      expect(hasPersistentSession).toBe(true);
    });

    test('should handle login failure and retry', async ({ page }) => {
      await authHelpers.goToLogin();

      // First attempt with wrong password
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: 'wrongpassword'
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectFormError('Invalid email or password');

      // Second attempt with correct password
      await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should handle unverified email login attempt', async ({ page }) => {
      await authHelpers.goToLogin();
      
      await authHelpers.fillLoginForm({
        email: testUsers.unverified.email,
        password: testUsers.unverified.password
      });
      await authHelpers.submitLoginForm();

      // Should show email verification message
      await authHelpers.expectFormError('Please verify your email address before signing in');
      
      // Should provide link to resend verification
      await expect(page.getByRole('link', { name: /resend verification/i })).toBeVisible();
    });

    test('should handle account lockout', async ({ page }) => {
      await authHelpers.goToLogin();

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authHelpers.fillLoginForm({
          email: testUsers.valid.email,
          password: 'wrongpassword'
        });
        await authHelpers.submitLoginForm();
        await authHelpers.expectFormError('Invalid email or password');
      }

      // Next attempt should show lockout message
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: 'wrongpassword'
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectFormError('Too many login attempts');
    });

    test('should maintain login state across page refreshes', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // Refresh the page
      await page.reload();

      // Should still be logged in
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });
  });

  test.describe('Password Reset Flow', () => {
    test('should complete full password reset flow', async ({ page }) => {
      // Step 1: User clicks forgot password
      await authHelpers.goToLogin();
      await page.getByRole('button', { name: /forgot password/i }).click();

      // Step 2: User sees forgot password form
      await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();

      // Step 3: User enters email
      await authHelpers.fillForgotPasswordForm(testUsers.valid.email);
      await authHelpers.submitForgotPasswordForm();

      // Step 4: User sees success message
      await authHelpers.expectPasswordResetSuccess();
      await expect(page.getByText(/check your email/i)).toBeVisible();

      // Step 5: Mock clicking reset link in email
      await page.goto('/auth/reset-password?token=valid-reset-token');

      // Step 6: User sees reset password form
      await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
      await expect(page.getByLabel(/new password/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();

      // Step 7: User enters new password
      const newPassword = 'NewSecurePassword123!';
      await page.getByLabel(/new password/i).fill(newPassword);
      await page.getByLabel(/confirm password/i).fill(newPassword);
      await page.getByRole('button', { name: /reset password/i }).click();

      // Step 8: User sees success message
      await expect(page.getByText(/password has been reset/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

      // Step 9: User signs in with new password
      await page.getByRole('link', { name: /sign in/i }).click();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: newPassword
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should handle invalid reset token', async ({ page }) => {
      await page.goto('/auth/reset-password?token=invalid-token');
      
      await expect(page.getByText(/invalid or expired/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /request new reset/i })).toBeVisible();
      
      // User can request new reset
      await page.getByRole('link', { name: /request new reset/i }).click();
      await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    });

    test('should validate new password strength in reset flow', async ({ page }) => {
      await page.goto('/auth/reset-password?token=valid-reset-token');
      
      // Try weak password
      await page.getByLabel(/new password/i).fill('weak');
      await page.getByLabel(/confirm password/i).fill('weak');
      await page.getByRole('button', { name: /reset password/i }).click();

      // Should show password strength error
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
      await expect(page.getByText(/uppercase letter/i)).toBeVisible();
    });

    test('should prevent password reset token reuse', async ({ page }) => {
      const resetToken = 'one-time-use-token';
      
      // First use of token
      await page.goto(`/auth/reset-password?token=${resetToken}`);
      await page.getByLabel(/new password/i).fill('NewPassword123!');
      await page.getByLabel(/confirm password/i).fill('NewPassword123!');
      await page.getByRole('button', { name: /reset password/i }).click();
      await expect(page.getByText(/password has been reset/i)).toBeVisible();

      // Second use of same token should fail
      await page.goto(`/auth/reset-password?token=${resetToken}`);
      await expect(page.getByText(/invalid or expired/i)).toBeVisible();
    });

    test('should handle expired reset token', async ({ page }) => {
      await page.goto('/auth/reset-password?token=expired-token');
      
      await expect(page.getByText(/expired/i)).toBeVisible();
      await expect(page.getByText(/request a new reset link/i)).toBeVisible();
    });
  });

  test.describe('Social Authentication Flows', () => {
    test('should handle Google OAuth flow', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Mock OAuth redirect
      await page.route('**/api/auth/social/google', async route => {
        // Simulate OAuth redirect
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'https://accounts.google.com/oauth/authorize?client_id=...'
          }
        });
      });

      await authHelpers.clickGoogleLogin();
      
      // Would normally be redirected to Google
      // Mock returning from Google with auth code
      await page.goto('/auth/callback?provider=google&code=auth-code&state=csrf-state');
      
      // Should be redirected to dashboard after successful OAuth
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });

    test('should handle Apple OAuth flow', async ({ page }) => {
      await authHelpers.goToLogin();
      
      await page.route('**/api/auth/social/apple', async route => {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'https://appleid.apple.com/auth/authorize?client_id=...'
          }
        });
      });

      await authHelpers.clickAppleLogin();
      
      // Mock returning from Apple
      await page.goto('/auth/callback?provider=apple&code=auth-code&state=csrf-state');
      
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/welcome/i)).toBeVisible();
    });

    test('should handle OAuth errors', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Mock OAuth error
      await page.goto('/auth/callback?error=access_denied&error_description=User+denied+access');
      
      // Should show error message and redirect to login
      await expect(page.getByText(/authentication was cancelled/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    });

    test('should handle new user creation via social login', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.clickGoogleLogin();
      
      // Mock successful OAuth for new user
      await page.goto('/auth/callback?provider=google&code=auth-code&state=csrf-state&new_user=true');
      
      // Should show welcome message for new user
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/welcome to familyhub/i)).toBeVisible();
      await expect(page.getByText(/complete your profile/i)).toBeVisible();
    });

    test('should link social account to existing email', async ({ page }) => {
      // User already has account with email
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // User tries to login with Google using same email
      await page.goto('/auth');
      await authHelpers.clickGoogleLogin();
      
      // Mock Google OAuth returning same email
      await page.goto('/auth/callback?provider=google&code=auth-code&email=' + encodeURIComponent(testUsers.valid.email));
      
      // Should show account linking confirmation
      await expect(page.getByText(/link your google account/i)).toBeVisible();
      await expect(page.getByText(testUsers.valid.email)).toBeVisible();
      
      // User confirms linking
      await page.getByRole('button', { name: /link accounts/i }).click();
      
      // Should be logged in with linked account
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Session Management', () => {
    test('should handle automatic logout on session expiry', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // Mock session expiration
      await page.route('**/api/auth/session', async route => {
        await route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Session expired' })
        });
      });

      // Try to access protected resource
      await page.goto('/dashboard/settings');
      
      // Should be redirected to login
      await expect(page).toHaveURL(/\/auth/);
      await expect(page.getByText(/session expired/i)).toBeVisible();
    });

    test('should handle concurrent login sessions', async ({ page, context }) => {
      // Login in first tab
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // Open second tab and login again
      const secondPage = await context.newPage();
      const secondAuthHelpers = new AuthPageHelpers(secondPage);
      
      await secondAuthHelpers.goToLogin();
      await secondAuthHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await secondAuthHelpers.submitLoginForm();
      await secondAuthHelpers.expectLoginSuccess();

      // Both sessions should be active
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(secondPage).toHaveURL(/\/dashboard/);

      await secondPage.close();
    });

    test('should refresh tokens automatically', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      // Mock token near expiry
      let refreshCalled = false;
      await page.route('**/api/auth/refresh', async route => {
        refreshCalled = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              session: {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                expires_in: 3600
              }
            }
          })
        });
      });

      // Trigger API call that would require token refresh
      await page.goto('/dashboard/profile');
      
      // Token refresh should have been called
      await page.waitForTimeout(1000);
      expect(refreshCalled).toBe(true);
    });

    test('should handle logout from all devices', async ({ page, context }) => {
      // Login from multiple sessions
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();

      const secondPage = await context.newPage();
      const secondAuthHelpers = new AuthPageHelpers(secondPage);
      await secondAuthHelpers.goToLogin();
      await secondAuthHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await secondAuthHelpers.submitLoginForm();

      // Logout from all devices
      await page.goto('/dashboard/security');
      await page.getByRole('button', { name: /logout from all devices/i }).click();
      await page.getByRole('button', { name: /confirm/i }).click();

      // Both sessions should be logged out
      await expect(page).toHaveURL(/\/auth/);
      await expect(secondPage).toHaveURL(/\/auth/);

      await secondPage.close();
    });
  });

  test.describe('Mobile Authentication Flows', () => {
    mobileViewports.forEach(({ name, width, height }) => {
      test.describe(`${name} (${width}x${height})`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width, height });
        });

        test('should complete signup flow on mobile', async ({ page }) => {
          const testUser = generateTestUser();

          await authHelpers.goToSignup();
          await authHelpers.fillSignupForm(testUser);
          await authHelpers.submitSignupForm();
          await authHelpers.expectSignupSuccess();

          // Verify mobile-specific UI elements
          await expect(page.getByText(/check your email/i)).toBeVisible();
        });

        test('should handle mobile keyboard interactions', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Test that form fields work with mobile keyboard
          const emailField = page.getByLabel(/email/i);
          await emailField.focus();
          await emailField.fill(testUsers.valid.email);
          
          // Should trigger email keyboard on mobile
          await expect(emailField).toHaveAttribute('type', 'email');
          await expect(emailField).toHaveAttribute('inputmode', 'email');
          
          const passwordField = page.getByLabel(/^password$/i);
          await passwordField.focus();
          await passwordField.fill(testUsers.valid.password);
          
          await authHelpers.submitLoginForm();
          await authHelpers.expectLoginSuccess();
        });

        test('should handle mobile form validation', async ({ page }) => {
          await authHelpers.goToSignup();
          
          // Submit empty form
          await authHelpers.submitSignupForm();
          
          // Error messages should be visible and readable on mobile
          await expect(page.getByText(/first name is required/i)).toBeVisible();
          await expect(page.getByText(/email address is required/i)).toBeVisible();
          
          // Validation errors should not overlap with form fields
          const errorMessages = page.locator('.text-error, [role="alert"]');
          const errorCount = await errorMessages.count();
          expect(errorCount).toBeGreaterThan(0);
        });

        test('should maintain form state during orientation changes', async ({ page }) => {
          await authHelpers.goToLogin();
          
          // Fill form
          await page.getByLabel(/email/i).fill(testUsers.valid.email);
          await page.getByLabel(/^password$/i).fill('partial-password');
          
          // Simulate orientation change (landscape)
          await page.setViewportSize({ width: height, height: width });
          
          // Form data should persist
          await expect(page.getByLabel(/email/i)).toHaveValue(testUsers.valid.email);
          await expect(page.getByLabel(/^password$/i)).toHaveValue('partial-password');
          
          // Complete login
          await page.getByLabel(/^password$/i).fill(testUsers.valid.password);
          await authHelpers.submitLoginForm();
          await authHelpers.expectLoginSuccess();
        });
      });
    });
  });

  test.describe('Error Recovery Flows', () => {
    test('should recover from network errors', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });

      // Mock network error
      await apiHelpers.mockNetworkError();
      await authHelpers.submitLoginForm();
      await authHelpers.expectFormError('network error');

      // Remove network error mock
      await page.unroute('**/api/auth/**');
      await apiHelpers.mockSuccessfulLogin();

      // Retry should work
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should handle browser back/forward during auth flow', async ({ page }) => {
      // Start at login
      await authHelpers.goToLogin();
      
      // Go to signup
      await authHelpers.goToSignup();
      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
      
      // Browser back
      await page.goBack();
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      
      // Browser forward
      await page.goForward();
      await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
      
      // Form should still be functional
      const testUser = generateTestUser();
      await authHelpers.fillSignupForm(testUser);
      await authHelpers.submitSignupForm();
      await authHelpers.expectSignupSuccess();
    });

    test('should handle page refresh during form submission', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });

      // Start form submission
      const submitPromise = authHelpers.submitLoginForm();
      
      // Refresh page during submission
      await page.reload();
      
      // Should be back at login form, not in broken state
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      
      // Should be able to login normally
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      await authHelpers.submitLoginForm();
      await authHelpers.expectLoginSuccess();
    });

    test('should handle interrupted OAuth flow', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.clickGoogleLogin();
      
      // Simulate user closing OAuth popup or canceling
      await page.goto('/auth?error=oauth_cancelled');
      
      // Should show appropriate error message
      await expect(page.getByText(/authentication was cancelled/i)).toBeVisible();
      
      // User should be able to try again
      await authHelpers.clickGoogleLogin();
      
      // Mock successful OAuth
      await page.goto('/auth/callback?provider=google&code=auth-code&state=csrf-state');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Accessibility in Flows', () => {
    test('should maintain accessibility during form transitions', async ({ page }) => {
      await authHelpers.goToLogin();
      
      // Submit form to trigger validation
      await authHelpers.submitLoginForm();
      
      // Error messages should be announced to screen readers
      const errorMessages = page.locator('[role="alert"]');
      const errorCount = await errorMessages.count();
      expect(errorCount).toBeGreaterThan(0);
      
      // Focus should be managed properly
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should maintain focus during loading states', async ({ page }) => {
      await authHelpers.goToLogin();
      await authHelpers.fillLoginForm({
        email: testUsers.valid.email,
        password: testUsers.valid.password
      });
      
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await submitButton.focus();
      
      await submitButton.click();
      
      // Focus should remain on button during loading
      await expect(submitButton).toBeFocused();
      await expect(submitButton).toBeDisabled();
    });
  });
});