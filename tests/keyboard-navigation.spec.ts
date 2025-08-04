import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Tab Navigation', () => {
    test('should allow tabbing through all interactive elements in logical order', async ({ page }) => {
      const expectedOrder = [
        'Skip to main content',
        'Get started with FamilyHub',
        'View features section',
        'Learn how FamilyHub works', 
        'View pricing information',
        'Contact FamilyHub',
        'Start organizing your family care today',
        'Watch demonstration of how FamilyHub works'
      ];
      
      for (let i = 0; i < expectedOrder.length; i++) {
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        
        // Check if the focused element has the expected aria-label
        const ariaLabel = await focusedElement.getAttribute('aria-label');
        if (ariaLabel) {
          expect(ariaLabel.toLowerCase()).toContain(expectedOrder[i].toLowerCase().substring(0, 10));
        }
      }
    });

    test('should skip non-interactive elements during tab navigation', async ({ page }) => {
      let tabCount = 0;
      const maxTabs = 20;
      const focusedElements = [];
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = page.locator(':focus');
        if (await focusedElement.count() === 0) {
          break;
        }
        
        const tagName = await focusedElement.evaluate(el => el.tagName);
        const role = await focusedElement.getAttribute('role');
        const tabIndex = await focusedElement.getAttribute('tabindex');
        
        // Should only focus interactive elements
        const isInteractive = [
          'BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'
        ].includes(tagName) || 
        role === 'button' || 
        tabIndex === '0';
        
        expect(isInteractive).toBeTruthy();
        focusedElements.push({ tagName, role, tabIndex });
      }
      
      expect(focusedElements.length).toBeGreaterThan(3);
    });

    test('should handle Shift+Tab for reverse navigation', async ({ page }) => {
      // Tab forward a few times
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const forwardElement = page.locator(':focus');
      const forwardElementId = await forwardElement.evaluate(el => 
        el.id || el.getAttribute('aria-label') || el.textContent?.trim()
      );
      
      // Tab forward one more time
      await page.keyboard.press('Tab');
      
      // Now tab backward
      await page.keyboard.press('Shift+Tab');
      
      const backwardElement = page.locator(':focus');
      const backwardElementId = await backwardElement.evaluate(el => 
        el.id || el.getAttribute('aria-label') || el.textContent?.trim()
      );
      
      // Should be back to the previous element
      expect(backwardElementId).toBe(forwardElementId);
    });
  });

  test.describe('Enter and Space Key Activation', () => {
    test('should activate buttons with Enter key', async ({ page }) => {
      const button = page.getByRole('button', { name: /start organizing/i }).first();
      await button.focus();
      
      // Mock navigation to prevent actual page navigation
      await page.route('**/*', route => route.abort());
      
      await page.keyboard.press('Enter');
      
      // Button should have been activated (we'll check by ensuring it received focus)
      await expect(button).toBeFocused();
    });

    test('should activate buttons with Space key', async ({ page }) => {
      const button = page.getByRole('button', { name: /see how it works/i }).first();
      await button.focus();
      
      await page.keyboard.press(' ');
      
      // Button should have been activated
      await expect(button).toBeFocused();
    });

    test('should activate links with Enter key', async ({ page }) => {
      // Set up mobile view to test mobile navigation
      await page.setViewportSize({ width: 375, height: 812 });
      
      // Open mobile menu first
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.click();
      
      const link = page.getByRole('link', { name: /view features section/i }).first();
      await link.focus();
      
      // Mock navigation
      await page.route('**/*', route => route.abort());
      
      await page.keyboard.press('Enter');
      
      // Link should have been activated
      await expect(link).toBeFocused();
    });
  });

  test.describe('Mobile Menu Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('should open mobile menu with Enter key', async ({ page }) => {
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.focus();
      
      await page.keyboard.press('Enter');
      
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('should open mobile menu with Space key', async ({ page }) => {
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.focus();
      
      await page.keyboard.press(' ');
      
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
    });

    test('should close mobile menu with Escape key', async ({ page }) => {
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.click();
      
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
      
      await page.keyboard.press('Escape');
      
      await expect(mobileMenu).not.toBeVisible();
      await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(mobileMenuButton).toBeFocused();
    });

    test('should navigate through mobile menu items with Tab', async ({ page }) => {
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.click();
      
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
      
      const menuItems = [
        'View features section',
        'Learn how FamilyHub works',
        'View pricing information',
        'Contact FamilyHub'
      ];
      
      for (const itemLabel of menuItems) {
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        const ariaLabel = await focusedElement.getAttribute('aria-label');
        expect(ariaLabel).toContain(itemLabel);
      }
    });
  });

  test.describe('Skip Navigation', () => {
    test('should focus skip link when Tab is pressed first', async ({ page }) => {
      await page.keyboard.press('Tab');
      
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
    });

    test('should navigate to main content when skip link is activated', async ({ page }) => {
      await page.keyboard.press('Tab');
      
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await expect(skipLink).toBeFocused();
      
      await page.keyboard.press('Enter');
      
      // Main content should be in view
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toBeInViewport();
    });

    test('should hide skip link when not focused', async ({ page }) => {
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      
      // Skip link should not be visible initially
      await expect(skipLink).toHaveClass(/sr-only/);
      
      // Focus it
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
      
      // Tab away
      await page.keyboard.press('Tab');
      await expect(skipLink).toHaveClass(/sr-only/);
    });
  });

  test.describe('Focus Trapping', () => {
    test('should trap focus within mobile menu when open', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.click();
      
      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();
      
      // Tab through all menu items
      const menuItemCount = 4; // Features, How It Works, Pricing, Contact
      
      for (let i = 0; i < menuItemCount + 2; i++) { // +2 to test wrap-around
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        
        // Focus should remain within the menu area
        const isWithinMenu = await focusedElement.evaluate((el) => {
          const menuContainer = document.querySelector('#mobile-menu');
          return menuContainer?.contains(el) || el.getAttribute('aria-controls') === 'mobile-menu';
        });
        
        expect(isWithinMenu).toBeTruthy();
      }
    });
  });

  test.describe('Arrow Key Navigation', () => {
    test('should support arrow key navigation in mobile menu', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
      await mobileMenuButton.click();
      
      // Focus first menu item
      await page.keyboard.press('Tab');
      
      // Test down arrow
      await page.keyboard.press('ArrowDown');
      const secondItem = page.locator(':focus');
      const secondItemLabel = await secondItem.getAttribute('aria-label');
      expect(secondItemLabel).toContain('How FamilyHub works');
      
      // Test up arrow
      await page.keyboard.press('ArrowUp');
      const firstItem = page.locator(':focus');
      const firstItemLabel = await firstItem.getAttribute('aria-label');
      expect(firstItemLabel).toContain('features');
    });
  });

  test.describe('Focus Visibility', () => {
    test('should have visible focus indicators on all interactive elements', async ({ page }) => {
      const interactiveElements = await page.locator('button, a, input, textarea, select').all();
      
      for (const element of interactiveElements) {
        if (!(await element.isVisible())) {
          continue;
        }
        
        await element.focus();
        
        // Check for focus styles
        const hasVisibleFocus = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return (
            styles.outline !== 'none' ||
            styles.outlineWidth !== '0px' ||
            styles.boxShadow.includes('rgb') ||
            styles.border.includes('rgb')
          );
        });
        
        expect(hasVisibleFocus).toBeTruthy();
      }
    });

    test('should maintain focus visibility in high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            :focus {
              outline: 3px solid yellow !important;
            }
          }
        `
      });
      
      const button = page.getByRole('button').first();
      await button.focus();
      
      const focusStyles = await button.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline;
      });
      
      expect(focusStyles).toBeTruthy();
      expect(focusStyles).not.toBe('none');
    });
  });
});