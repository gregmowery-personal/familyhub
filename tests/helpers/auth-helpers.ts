/**
 * Authentication Test Helper Functions
 * Provides reusable utilities for authentication testing
 */

import { Page, Locator, expect } from '@playwright/test';
import { testUsers, TestUser, LoginCredentials, touchTargetRequirements } from './auth-fixtures';

/**
 * Page Object Models for Authentication Pages
 */
export class AuthPageHelpers {
  constructor(private page: Page) {}

  /**
   * Navigation helpers
   */
  async goToLogin() {
    await this.page.goto('/auth');
  }

  async goToSignup() {
    await this.page.goto('/auth');
    await this.page.getByRole('tab', { name: /sign up/i }).click();
  }

  async goToForgotPassword() {
    await this.page.goto('/auth');
    await this.page.getByRole('button', { name: /forgot password/i }).click();
  }

  async goToDashboard() {
    await this.page.goto('/dashboard');
  }

  /**
   * Form interaction helpers
   */
  async fillLoginForm(credentials: LoginCredentials) {
    await this.page.getByLabel(/email/i).fill(credentials.email);
    await this.page.getByLabel(/password/i).first().fill(credentials.password);
    
    if (credentials.rememberMe) {
      await this.page.getByLabel(/remember me/i).check();
    }
  }

  async submitLoginForm() {
    await this.page.getByRole('button', { name: /sign in/i }).click();
  }

  async fillSignupForm(user: TestUser) {
    await this.page.getByLabel(/first name/i).fill(user.firstName);
    await this.page.getByLabel(/last name/i).fill(user.lastName);
    await this.page.getByLabel(/email/i).fill(user.email);
    await this.page.getByLabel(/^password$/i).fill(user.password);
    await this.page.getByLabel(/confirm password/i).fill(user.password);
    await this.page.getByLabel(/accept.*terms/i).check();
  }

  async submitSignupForm() {
    await this.page.getByRole('button', { name: /create account/i }).click();
  }

  async fillForgotPasswordForm(email: string) {
    await this.page.getByLabel(/email/i).fill(email);
  }

  async submitForgotPasswordForm() {
    await this.page.getByRole('button', { name: /send reset link/i }).click();
  }

  /**
   * Social login helpers
   */
  async clickGoogleLogin() {
    await this.page.getByRole('button', { name: /continue with google/i }).click();
  }

  async clickAppleLogin() {
    await this.page.getByRole('button', { name: /continue with apple/i }).click();
  }

  /**
   * Form validation helpers
   */
  async expectFieldError(fieldLabel: string, errorMessage: string) {
    const field = this.page.getByLabel(new RegExp(fieldLabel, 'i'));
    const fieldContainer = field.locator('..');
    await expect(fieldContainer.getByText(errorMessage)).toBeVisible();
  }

  async expectNoFieldErrors() {
    const errorMessages = this.page.locator('[role="alert"], .text-error, .error-message');
    await expect(errorMessages).toHaveCount(0);
  }

  async expectFormError(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  /**
   * Loading state helpers
   */
  async expectLoadingState(buttonText: string) {
    const button = this.page.getByRole('button', { name: new RegExp(buttonText, 'i') });
    await expect(button).toBeDisabled();
    await expect(button).toContainText(/loading|signing|creating|sending/i);
  }

  async waitForLoadingComplete() {
    await this.page.waitForLoadState('networkidle');
    // Wait for any spinning indicators to disappear
    await this.page.waitForSelector('.loading, .spinner', { state: 'hidden', timeout: 10000 });
  }

  /**
   * Success state helpers
   */
  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.page.getByText(/welcome/i)).toBeVisible();
  }

  async expectSignupSuccess() {
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
    await expect(this.page.getByText(/verify your account/i)).toBeVisible();
  }

  async expectPasswordResetSuccess() {
    await expect(this.page.getByText(/reset link sent/i)).toBeVisible();
    await expect(this.page.getByText(/check your email/i)).toBeVisible();
  }
}

/**
 * API Test Helpers
 */
export class APITestHelpers {
  constructor(private page: Page) {}

  /**
   * Mock API responses
   */
  async mockSuccessfulLogin() {
    await this.page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: { id: 'user-123', email: 'test@example.com' },
            session: { access_token: 'mock-token' }
          }
        })
      });
    });
  }

  async mockFailedLogin(errorMessage: string = 'Invalid credentials') {
    await this.page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          code: 'INVALID_CREDENTIALS'
        })
      });
    });
  }

  async mockRateLimited() {
    await this.page.route('**/api/auth/**', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: {
          'Retry-After': '300',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0'
        },
        body: JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.',
          code: 'TOO_MANY_REQUESTS'
        })
      });
    });
  }

  async mockNetworkError() {
    await this.page.route('**/api/auth/**', async route => {
      await route.abort('connectionfailed');
    });
  }

  /**
   * Capture and validate API requests
   */
  async captureLoginRequest(): Promise<any> {
    return new Promise((resolve) => {
      this.page.route('**/api/auth/login', async route => {
        const request = route.request();
        const body = JSON.parse(request.postData() || '{}');
        resolve({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          body: body
        });
        await route.continue();
      });
    });
  }
}

/**
 * Accessibility Test Helpers
 */
export class AccessibilityTestHelpers {
  constructor(private page: Page) {}

  /**
   * Check ARIA labels and roles
   */
  async checkAriaLabels(expectedLabels: string[]) {
    for (const label of expectedLabels) {
      await expect(this.page.locator(`[aria-label*="${label}"]`)).toBeVisible();
    }
  }

  async checkFormLabels() {
    const inputs = await this.page.locator('input, textarea, select').all();
    
    for (const input of inputs) {
      const inputId = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      // Each input should have either a proper label, aria-label, or aria-labelledby
      if (inputId) {
        const label = this.page.locator(`label[for="${inputId}"]`);
        await expect(label).toBeVisible();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  }

  async checkHeadingStructure() {
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    
    if (headings.length === 0) return;
    
    // First heading should be h1
    const firstHeading = headings[0];
    const firstTagName = await firstHeading.evaluate(el => el.tagName);
    expect(firstTagName).toBe('H1');
    
    // Check that we don't skip heading levels
    for (let i = 1; i < headings.length; i++) {
      const currentLevel = parseInt((await headings[i].evaluate(el => el.tagName)).substring(1));
      const previousLevel = parseInt((await headings[i-1].evaluate(el => el.tagName)).substring(1));
      
      expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
    }
  }

  async checkKeyboardNavigation() {
    // Test tab navigation
    let tabCount = 0;
    const maxTabs = 20;
    const focusedElements = [];
    
    while (tabCount < maxTabs) {
      await this.page.keyboard.press('Tab');
      tabCount++;
      
      const focusedElement = this.page.locator(':focus');
      if (await focusedElement.count() === 0) break;
      
      const tagName = await focusedElement.evaluate(el => el.tagName);
      const role = await focusedElement.getAttribute('role');
      
      focusedElements.push({ tagName, role });
      
      // Verify element is interactive
      const isInteractive = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || 
                           role === 'button' || role === 'link';
      expect(isInteractive).toBeTruthy();
    }
    
    expect(focusedElements.length).toBeGreaterThan(2);
  }

  async checkColorContrast() {
    // Get all text elements
    const textElements = await this.page.locator('p, span, a, button, label, h1, h2, h3, h4, h5, h6').all();
    
    for (const element of textElements) {
      if (!(await element.isVisible())) continue;
      
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight
        };
      });
      
      // Ensure colors are properly defined
      expect(styles.color).toBeTruthy();
      expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
    }
  }
}

/**
 * Touch Target Test Helpers
 */
export class TouchTargetTestHelpers {
  constructor(private page: Page) {}

  async checkTouchTargetSizes() {
    const interactiveElements = await this.page.locator('button, a, input[type="checkbox"], input[type="radio"], [role="button"]').all();
    
    for (const element of interactiveElements) {
      if (!(await element.isVisible())) continue;
      
      const boundingBox = await element.boundingBox();
      if (!boundingBox) continue;
      
      expect(boundingBox.width).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.width);
      expect(boundingBox.height).toBeGreaterThanOrEqual(touchTargetRequirements.minimum.height);
    }
  }

  async checkTouchTargetSpacing() {
    const buttons = await this.page.locator('button, a[role="button"]').all();
    
    for (let i = 0; i < buttons.length - 1; i++) {
      const currentButton = buttons[i];
      const nextButton = buttons[i + 1];
      
      if (!(await currentButton.isVisible()) || !(await nextButton.isVisible())) continue;
      
      const currentBox = await currentButton.boundingBox();
      const nextBox = await nextButton.boundingBox();
      
      if (!currentBox || !nextBox) continue;
      
      // Calculate distance between elements
      const horizontalDistance = Math.abs(currentBox.x - nextBox.x);
      const verticalDistance = Math.abs(currentBox.y - nextBox.y);
      
      // If elements are on the same row (similar Y position)
      if (Math.abs(currentBox.y - nextBox.y) < 10) {
        const spacing = horizontalDistance - currentBox.width;
        expect(spacing).toBeGreaterThanOrEqual(touchTargetRequirements.spacing);
      }
      
      // If elements are in the same column (similar X position)
      if (Math.abs(currentBox.x - nextBox.x) < 10) {
        const spacing = verticalDistance - currentBox.height;
        expect(spacing).toBeGreaterThanOrEqual(touchTargetRequirements.spacing);
      }
    }
  }
}

/**
 * Security Test Helpers
 */
export class SecurityTestHelpers {
  constructor(private page: Page) {}

  async testXSSPrevention(payloads: string[]) {
    for (const payload of payloads) {
      // Try to inject XSS in email field
      await this.page.getByLabel(/email/i).fill(payload);
      await this.page.getByRole('button', { name: /sign in/i }).click();
      
      // Check that the payload is not executed
      const alertDialogs = await this.page.locator('dialog[role="alertdialog"]').count();
      expect(alertDialogs).toBe(0);
      
      // Check that the payload is properly escaped in the DOM
      const emailField = this.page.getByLabel(/email/i);
      const value = await emailField.inputValue();
      expect(value).toBe(payload); // Should be the literal string, not executed
      
      // Clear the field for next test
      await emailField.fill('');
    }
  }

  async testCSRFProtection() {
    // Try to make a request without CSRF token
    const response = await this.page.request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    // Should be rejected due to missing CSRF protection
    expect(response.status()).toBe(403);
  }

  async checkSecureHeaders() {
    const response = await this.page.request.get('/auth');
    const headers = response.headers();
    
    // Check for security headers
    expect(headers['x-frame-options']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-xss-protection']).toBeTruthy();
  }
}

/**
 * Mobile Test Helpers
 */
export class MobileTestHelpers {
  constructor(private page: Page) {}

  async setMobileViewport(width: number, height: number) {
    await this.page.setViewportSize({ width, height });
  }

  async checkMobileLayout() {
    // Check that mobile navigation is visible
    const mobileMenu = this.page.getByRole('button', { name: /menu|navigation/i });
    await expect(mobileMenu).toBeVisible();
    
    // Check that desktop navigation is hidden
    const desktopNav = this.page.locator('nav.desktop-nav, .desktop-navigation');
    if (await desktopNav.count() > 0) {
      await expect(desktopNav).toBeHidden();
    }
  }

  async testMobileFormUsability() {
    // Check that form fields are large enough for mobile input
    const inputs = await this.page.locator('input, textarea').all();
    
    for (const input of inputs) {
      if (!(await input.isVisible())) continue;
      
      const boundingBox = await input.boundingBox();
      if (!boundingBox) continue;
      
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  }
}

/**
 * Performance Test Helpers
 */
export class PerformanceTestHelpers {
  constructor(private page: Page) {}

  async measureFormSubmissionTime(formSubmitFn: () => Promise<void>) {
    const startTime = Date.now();
    await formSubmitFn();
    const endTime = Date.now();
    
    const submissionTime = endTime - startTime;
    
    // Form submission should complete within reasonable time
    expect(submissionTime).toBeLessThan(5000); // 5 seconds
    
    return submissionTime;
  }

  async checkPageLoadTime() {
    const startTime = Date.now();
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 seconds
    
    return loadTime;
  }
}

/**
 * Test data generators
 */
export const generateTestUser = (override: Partial<TestUser> = {}): TestUser => ({
  ...testUsers.valid,
  ...override,
  email: `test-${Date.now()}@example.com`, // Ensure unique email
});

export const generateLoginCredentials = (override: Partial<LoginCredentials> = {}): LoginCredentials => ({
  email: testUsers.valid.email,
  password: testUsers.valid.password,
  rememberMe: false,
  ...override,
});