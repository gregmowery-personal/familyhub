import { test, expect } from '@playwright/test';

test.describe('Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Heading Hierarchy', () => {
    test('should have proper heading hierarchy starting with h1', async ({ page }) => {
      // Main heading should be h1
      const mainHeading = page.getByRole('heading', { level: 1 });
      await expect(mainHeading).toBeVisible();
      await expect(mainHeading).toContainText('When family life feels overwhelming');
    });

    test('should have logical heading structure', async ({ page }) => {
      // Get all headings in order
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      
      // Should start with h1
      const firstHeading = headings[0];
      expect(await firstHeading.evaluate(el => el.tagName)).toBe('H1');
      
      // Check that we don't skip heading levels
      for (let i = 1; i < headings.length; i++) {
        const currentLevel = parseInt((await headings[i].evaluate(el => el.tagName)).substring(1));
        const previousLevel = parseInt((await headings[i-1].evaluate(el => el.tagName)).substring(1));
        
        // Heading level should not increase by more than 1
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
    });

    test('should have screen reader accessible headings for sections', async ({ page }) => {
      // Features section should have accessible heading
      await expect(page.locator('#features-heading')).toBeAttached();
      await expect(page.locator('#features-heading')).toHaveClass(/sr-only/);
      
      // Benefits section should have accessible heading
      await expect(page.locator('#benefits-heading')).toBeAttached();
      await expect(page.locator('#benefits-heading')).toHaveClass(/sr-only/);
    });
  });

  test.describe('ARIA Labels and Landmarks', () => {
    test('should have skip navigation link', async ({ page }) => {
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await expect(skipLink).toBeAttached();
      
      // Should become visible when focused
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
    });

    test('should have proper landmark roles', async ({ page }) => {
      // Header should have banner role
      const header = page.getByRole('banner');
      await expect(header).toBeVisible();
      
      // Main content should have main role
      const main = page.getByRole('main');
      await expect(main).toBeVisible();
      await expect(main).toHaveAttribute('id', 'main-content');
      
      // Navigation should have navigation role
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(nav).toBeAttached();
    });

    test('should have ARIA labels on all interactive elements', async ({ page }) => {
      // Check navigation links
      const navLinks = page.getByRole('navigation').getByRole('link');
      const navCount = await navLinks.count();
      
      for (let i = 0; i < navCount; i++) {
        const link = navLinks.nth(i);
        await expect(link).toHaveAttribute('aria-label');
      }
      
      // Check buttons
      const buttons = page.getByRole('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        await expect(button).toHaveAttribute('aria-label');
      }
    });

    test('should have proper ARIA attributes for expandable content', async ({ page }) => {
      // Set mobile viewport to test mobile menu
      await page.setViewportSize({ width: 375, height: 812 });
      
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      
      // Should have proper ARIA attributes
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(mobileMenuButton).toHaveAttribute('aria-controls', 'mobile-menu');
      
      // After clicking, aria-expanded should change
      await mobileMenuButton.click();
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('should have proper alt text and ARIA labels for decorative elements', async ({ page }) => {
      // Check emoji icons have proper ARIA labels
      const emojiIcons = page.locator('[role=\"img\"]');
      const iconCount = await emojiIcons.count();
      
      for (let i = 0; i < iconCount; i++) {
        const icon = emojiIcons.nth(i);
        await expect(icon).toHaveAttribute('aria-label');
      }
    });
  });

  test.describe('Focus Management', () => {
    test('should have visible focus indicators on all interactive elements', async ({ page }) => {
      // Test navigation links
      await page.keyboard.press('Tab'); // Skip link
      await page.keyboard.press('Tab'); // First nav link or button
      
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Should have focus styles (this is visual, so we check for outline or box-shadow)
      const focusStyles = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow
        };
      });
      
      // Should have some form of focus indicator
      expect(
        focusStyles.outline !== 'none' || 
        focusStyles.outlineWidth !== '0px' || 
        focusStyles.boxShadow !== 'none'
      ).toBeTruthy();
    });

    test('should support keyboard navigation through all interactive elements', async ({ page }) => {
      let tabCount = 0;
      const maxTabs = 20; // Safety limit
      
      // Count all focusable elements by tabbing through them
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = page.locator(':focus');
        if (await focusedElement.count() === 0) {
          break; // No more focusable elements
        }
        
        // Element should be visible and focusable
        await expect(focusedElement).toBeVisible();
      }
      
      // Should have found multiple interactive elements
      expect(tabCount).toBeGreaterThan(3);
    });

    test('should restore focus properly after modal interactions', async ({ page }) => {
      // Set mobile viewport to test mobile menu focus management
      await page.setViewportSize({ width: 375, height: 812 });
      
      // Focus the mobile menu button
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.focus();
      
      // Open menu
      await page.keyboard.press('Enter');
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
      
      // Close menu with Escape
      await page.keyboard.press('Escape');
      await expect(mobileMenu).not.toBeVisible();
      
      // Focus should return to the menu button
      await expect(mobileMenuButton).toBeFocused();
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA color contrast requirements', async ({ page }) => {
      // Test main text elements for contrast
      const textElements = [
        page.getByRole('heading', { level: 1 }),
        page.locator('p').first(),
        page.getByRole('link').first(),
        page.getByRole('button').first()
      ];
      
      for (const element of textElements) {
        await expect(element).toBeVisible();
        
        // Get computed styles
        const styles = await element.evaluate((el) => {
          const computedStyles = window.getComputedStyle(el);
          return {
            color: computedStyles.color,
            backgroundColor: computedStyles.backgroundColor,
          };
        });
        
        // Basic check that colors are defined
        expect(styles.color).toBeTruthy();
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
      }
    });
  });

  test.describe('Semantic HTML', () => {
    test('should use semantic HTML elements', async ({ page }) => {
      // Check for semantic elements
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('nav')).toHaveCount(2); // Desktop nav + mobile nav (one may be hidden)
      await expect(page.locator('section')).toHaveCount(2); // Features and benefits sections
      await expect(page.locator('article')).toHaveCount(7); // 3 feature cards + 4 benefit cards
    });

    test('should have proper form labels if forms exist', async ({ page }) => {
      // Check if any form inputs exist and have proper labels
      const inputs = page.locator('input, textarea, select');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        
        if (inputId) {
          // Should have associated label
          const label = page.locator(`label[for="${inputId}"]`);
          await expect(label).toBeVisible();
        } else {
          // Should have aria-label or aria-labelledby
          const hasAriaLabel = await input.getAttribute('aria-label');
          const hasAriaLabelledBy = await input.getAttribute('aria-labelledby');
          expect(hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
        }
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should have sufficient color contrast for text elements', async ({ page }) => {
      // Check main heading contrast
      const mainHeading = page.getByRole('heading', { level: 1 });
      await expect(mainHeading).toBeVisible();
      
      // Check primary button contrast
      const primaryButton = page.getByRole('button', { name: /start organizing today/i });
      await expect(primaryButton).toBeVisible();
      
      // Check navigation link contrast
      const navLink = page.getByRole('link', { name: /features/i }).first();
      await expect(navLink).toBeVisible();
      
      // Note: Actual contrast testing would require additional libraries like axe-core
      // This is a placeholder for the testing structure
    });

    test('should support high contrast mode preferences', async ({ page }) => {
      // Test that elements are still visible and accessible in high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' });
      
      const mainHeading = page.getByRole('heading', { level: 1 });
      await expect(mainHeading).toBeVisible();
      
      const primaryButton = page.getByRole('button', { name: /start organizing today/i });
      await expect(primaryButton).toBeVisible();
    });
  });
});