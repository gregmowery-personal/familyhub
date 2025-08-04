import { test, expect } from '@playwright/test';

test.describe('Touch Target Size Validation', () => {
  const mobileViewports = [
    { name: 'iPhone SE', width: 320, height: 568 },
    { name: 'iPhone 12', width: 375, height: 812 },
    { name: 'iPhone 12 Pro Max', width: 414, height: 896 },
    { name: 'iPad', width: 768, height: 1024 }
  ];

  mobileViewports.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
      });

      test('should have minimum 44px touch targets for all interactive elements', async ({ page }) => {
        // Get all interactive elements that are visible and not sr-only
        const interactiveElements = await page.locator('button, a, input, textarea, select, [role="button"], [tabindex="0"]').all();
        
        // Check each interactive element meets minimum touch target size
        for (const element of interactiveElements) {
          // Skip hidden elements and sr-only elements
          const isVisible = await element.isVisible();
          const hasAriaHidden = await element.getAttribute('aria-hidden');
          const hasSrOnlyClass = await element.evaluate(el => 
            el.classList.contains('sr-only') || 
            getComputedStyle(el).position === 'absolute' && getComputedStyle(el).width === '1px'
          );
          
          if (isVisible && hasAriaHidden !== 'true' && !hasSrOnlyClass) {
            const boundingBox = await element.boundingBox();
            if (boundingBox && boundingBox.width > 1 && boundingBox.height > 1) {
              // WCAG AA standard: minimum 44x44 CSS pixels for touch targets
              expect(boundingBox.width).toBeGreaterThanOrEqual(44);
              expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
        
        for (const element of interactiveElements) {
          // Skip if element is not visible
          if (!(await element.isVisible())) {
            continue;
          }
          
          const boundingBox = await element.boundingBox();
          if (!boundingBox) {
            continue;
          }
          
          // Check minimum touch target size (44px x 44px for WCAG AA)
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      });

      test('should have adequate spacing between touch targets', async ({ page }) => {
        const buttons = await page.locator('button, a[role="button"]').all();
        
        for (let i = 0; i < buttons.length - 1; i++) {
          const currentButton = buttons[i];
          const nextButton = buttons[i + 1];
          
          if (!(await currentButton.isVisible()) || !(await nextButton.isVisible())) {
            continue;
          }
          
          const currentBox = await currentButton.boundingBox();
          const nextBox = await nextButton.boundingBox();
          
          if (!currentBox || !nextBox) {
            continue;
          }
          
          // Calculate distance between elements
          const horizontalDistance = Math.abs(currentBox.x - nextBox.x);
          const verticalDistance = Math.abs(currentBox.y - nextBox.y);
          
          // If elements are on the same row (similar Y position)
          if (Math.abs(currentBox.y - nextBox.y) < 10) {
            // Should have at least 8px spacing between elements
            const spacing = horizontalDistance - currentBox.width;
            expect(spacing).toBeGreaterThanOrEqual(8);
          }
          
          // If elements are in the same column (similar X position)
          if (Math.abs(currentBox.x - nextBox.x) < 10) {
            // Should have at least 8px spacing between elements
            const spacing = verticalDistance - currentBox.height;
            expect(spacing).toBeGreaterThanOrEqual(8);
          }
        }
      });

      test('should have proper touch target sizes for navigation elements', async ({ page }) => {
        // Test navigation links
        const navLinks = page.getByRole('navigation').getByRole('link');
        const linkCount = await navLinks.count();
        
        for (let i = 0; i < linkCount; i++) {
          const link = navLinks.nth(i);
          if (!(await link.isVisible())) {
            continue;
          }
          
          const boundingBox = await link.boundingBox();
          if (!boundingBox) {
            continue;
          }
          
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      });

      test('should have proper touch target sizes for CTA buttons', async ({ page }) => {
        // Test main CTA buttons
        const ctaButtons = page.getByRole('button').filter({ hasText: /start organizing|see how it works|get started/i });
        const buttonCount = await ctaButtons.count();
        
        for (let i = 0; i < buttonCount; i++) {
          const button = ctaButtons.nth(i);
          if (!(await button.isVisible())) {
            continue;
          }
          
          const boundingBox = await button.boundingBox();
          if (!boundingBox) {
            continue;
          }
          
          // CTA buttons should be even larger for better UX
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      });

      test('should have proper touch target size for mobile menu button', async ({ page }) => {
        // Only test on mobile sizes
        if (width > 768) return;
        
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu|close navigation menu/i });
        
        if (await mobileMenuButton.isVisible()) {
          const boundingBox = await mobileMenuButton.boundingBox();
          expect(boundingBox).not.toBeNull();
          
          if (boundingBox) {
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      });

      test('should maintain touch target sizes when elements have focus', async ({ page }) => {
        const interactiveElements = await page.locator('button, a').all();
        
        for (const element of interactiveElements) {
          if (!(await element.isVisible())) {
            continue;
          }
          
          // Get size before focus
          const beforeFocus = await element.boundingBox();
          if (!beforeFocus) continue;
          
          // Focus the element
          await element.focus();
          
          // Get size after focus
          const afterFocus = await element.boundingBox();
          if (!afterFocus) continue;
          
          // Size should not decrease when focused
          expect(afterFocus.width).toBeGreaterThanOrEqual(beforeFocus.width - 2); // Allow 2px tolerance
          expect(afterFocus.height).toBeGreaterThanOrEqual(beforeFocus.height - 2);
          
          // Should still meet minimum requirements
          expect(afterFocus.width).toBeGreaterThanOrEqual(44);
          expect(afterFocus.height).toBeGreaterThanOrEqual(44);
        }
      });

      test('should have touch-friendly hit areas for small visual elements', async ({ page }) => {
        // Test elements that might appear small but should have larger hit areas
        const smallElements = page.locator('[role="img"], .text-3xl, .text-2xl').filter({ hasText: /[📅🤝🔒🛡️💚📱🌟]/ });
        const elementCount = await smallElements.count();
        
        for (let i = 0; i < elementCount; i++) {
          const element = smallElements.nth(i);
          
          // Check if the element or its parent is clickable
          const isClickable = await element.evaluate((el) => {
            // Check if element or parent has click handlers
            return (
              el.onclick !== null ||
              el.getAttribute('href') !== null ||
              el.getAttribute('role') === 'button' ||
              el.tagName === 'BUTTON' ||
              el.tagName === 'A'
            );
          });
          
          if (isClickable) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              expect(boundingBox.width).toBeGreaterThanOrEqual(44);
              expect(boundingBox.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
      });
    });
  });

  test.describe('Desktop Touch Target Validation', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/');
    });

    test('should maintain reasonable touch targets on desktop', async ({ page }) => {
      // Even on desktop, touch targets should be reasonable for touch screen laptops
      const interactiveElements = await page.locator('button, a').all();
      
      for (const element of interactiveElements) {
        if (!(await element.isVisible())) {
          continue;
        }
        
        const boundingBox = await element.boundingBox();
        if (!boundingBox) {
          continue;
        }
        
        // Desktop targets can be smaller but should still be reasonable
        expect(boundingBox.width).toBeGreaterThanOrEqual(32);
        expect(boundingBox.height).toBeGreaterThanOrEqual(32);
      }
    });
  });
});