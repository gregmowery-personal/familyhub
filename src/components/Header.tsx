"use client";

import { useState, useEffect, useRef } from 'react';
import Logo from '@/components/Logo';
import LoadingButton from '@/components/LoadingButton';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    // Return focus to the menu button when closing
    if (mobileMenuButtonRef.current) {
      mobileMenuButtonRef.current.focus();
    }
  };

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Skip Navigation Link for Accessibility */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-primary text-white px-4 py-2 z-[100] rounded-br-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      
      <header className="navbar bg-white border-b border-base-300 sticky top-0 z-50 shadow-sm" role="banner">
        <div className="container mx-auto px-4">
          <div className="flex-1">
            <Logo showTagline={false} className="scale-90" />
          </div>
          
          {/* Desktop Navigation */}
          <div className="flex-none hidden md:flex">
            <nav role="navigation" aria-label="Main navigation">
              <ul className="menu menu-horizontal px-1">
                <li>
                  <a 
                    href="#features" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="View features section"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a 
                    href="#how-it-works" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Learn how FamilyHub works"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a 
                    href="#pricing" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="View pricing information"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a 
                    href="/privacy" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Read our Privacy Policy"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a 
                    href="/terms" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Read our Terms and Conditions"
                  >
                    Terms
                  </a>
                </li>
                <li>
                  <a 
                    href="#contact" 
                    className="text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Contact FamilyHub"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
            <a href="/signup">
              <LoadingButton
                variant="primary"
                size="md"
                className="ml-4"
                aria-label="Get started with FamilyHub"
              >
                Get Started
              </LoadingButton>
            </a>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="flex-none md:hidden">
            <a href="/signup">
              <LoadingButton
                variant="primary"
                size="md"
                className="mr-2"
                aria-label="Get started with FamilyHub"
              >
                Get Started
              </LoadingButton>
            </a>
            <button
              ref={mobileMenuButtonRef}
              onClick={toggleMobileMenu}
              className="btn btn-ghost min-h-[44px] min-w-[44px] p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMobileMenuOpen ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div 
            id="mobile-menu"
            className="absolute top-full left-0 right-0 bg-white border-b border-base-300 shadow-lg md:hidden"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <nav className="container mx-auto px-4 py-4">
              <ul className="flex flex-col space-y-2">
                <li>
                  <a 
                    href="#features" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="View features section"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a 
                    href="#how-it-works" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="Learn how FamilyHub works"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a 
                    href="#pricing" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="View pricing information"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a 
                    href="/privacy" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="Read our Privacy Policy"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a 
                    href="/terms" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="Read our Terms and Conditions"
                  >
                    Terms
                  </a>
                </li>
                <li>
                  <a 
                    href="#contact" 
                    onClick={closeMobileMenu}
                    className="block text-gray-800 hover:text-primary focus:text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md min-h-[44px] px-4 py-3 font-medium transition-colors"
                    aria-label="Contact FamilyHub"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}