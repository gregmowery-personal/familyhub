import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  // Test mobile navigation functionality across different screen sizes
  const mobileViewports = [
    { name: 'iPhone SE', width: 320, height: 568 },
    { name: 'iPhone 12', width: 375, height: 812 },
    { name: 'iPhone 12 Pro Max', width: 414, height: 896 }
  ];

  mobileViewports.forEach(({ name, width, height }) => {
    test.describe(`${name} (${width}x${height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
      });

      test('should show mobile hamburger menu on mobile devices', async ({ page }) => {
        // Mobile menu button should be visible
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu|close navigation menu/i });
        await expect(mobileMenuButton).toBeVisible();
        
        // Desktop navigation should be hidden
        const desktopNav = page.getByRole('navigation', { name: 'Main navigation' });
        await expect(desktopNav).toBeHidden();
      });

      test('should toggle mobile menu when hamburger button is clicked', async ({ page }) => {
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
        const mobileMenu = page.locator('#mobile-menu');

        // Menu should not be visible initially
        await expect(mobileMenu).not.toBeVisible();

        // Click to open menu
        await mobileMenuButton.click();
        await expect(mobileMenu).toBeVisible();
        
        // Button text should change to indicate it can close the menu
        await expect(page.getByRole('button', { name: /close navigation menu/i })).toBeVisible();

        // Click to close menu
        await page.getByRole('button', { name: /close navigation menu/i }).click();
        await expect(mobileMenu).not.toBeVisible();
      });

      test('should close mobile menu when navigation link is clicked', async ({ page }) => {
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
        const mobileMenu = page.locator('#mobile-menu');

        // Open menu
        await mobileMenuButton.click();
        await expect(mobileMenu).toBeVisible();

        // Click a navigation link
        await page.getByRole('link', { name: 'Features' }).first().click();
        
        // Menu should close
        await expect(mobileMenu).not.toBeVisible();
      });

      test('should have accessible mobile menu', async ({ page }) => {
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });

        // Check ARIA attributes
        await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(mobileMenuButton).toHaveAttribute('aria-controls', 'mobile-menu');

        // Open menu and check ARIA state
        await mobileMenuButton.click();
        await expect(mobileMenuButton).toHaveAttribute('aria-expanded', 'true');
      });

      test('should support keyboard navigation in mobile menu', async ({ page }) => {
        const mobileMenuButton = page.getByRole('button', { name: /open navigation menu/i });
        
        // Tab to menu button and open with Enter
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab'); // Skip "Get Started" button
        await page.keyboard.press('Enter');
        
        const mobileMenu = page.locator('#mobile-menu');
        await expect(mobileMenu).toBeVisible();

        // Navigate through menu items with Tab
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Features' }).first()).toBeFocused();
        
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'How It Works' }).first()).toBeFocused();
      });
    });
  });

  test.describe('Desktop Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/');
    });

    test('should show desktop navigation on larger screens', async ({ page }) => {
      // Desktop navigation should be visible
      const desktopNav = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(desktopNav).toBeVisible();
      
      // Mobile menu button should be hidden
      const mobileMenuButton = page.getByRole('button', { name: /open navigation menu|close navigation menu/i });
      await expect(mobileMenuButton).toBeHidden();
    });

    test('should have all navigation links accessible', async ({ page }) => {
      const navLinks = [
        { name: 'Features', href: '#features' },
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'Contact', href: '#contact' }
      ];

      for (const link of navLinks) {
        const linkElement = page.getByRole('link', { name: link.name }).first();
        await expect(linkElement).toBeVisible();
        await expect(linkElement).toHaveAttribute('href', link.href);
        await expect(linkElement).toHaveAttribute('aria-label');
      }
    });
  });
});