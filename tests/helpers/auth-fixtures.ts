/**
 * Authentication Test Fixtures and Utilities
 * Provides reusable test data and helper functions for authentication testing
 */

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  validPassword?: string;
  invalidPassword?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Valid test users for different scenarios
export const testUsers: Record<string, TestUser> = {
  valid: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe+test@example.com',
    password: 'SecurePass123!',
    validPassword: 'SecurePass123!',
    invalidPassword: 'wrongpassword'
  },
  unverified: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith+unverified@example.com',
    password: 'AnotherPass456!',
  },
  blocked: {
    firstName: 'Bob',
    lastName: 'Wilson',
    email: 'bob.wilson+blocked@example.com',
    password: 'BlockedUser789!',
  },
  socialUser: {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson+social@example.com',
    password: '', // Social users don't have passwords
  }
};

// Invalid email formats for testing validation
export const invalidEmails = [
  '',
  'not-an-email',
  '@example.com',
  'user@',
  'user..double.dot@example.com',
  'user@.com',
  'user@com',
  'user name@example.com', // space
  'user+tag@example', // no TLD
];

// Invalid password formats for testing validation
export const invalidPasswords = [
  '',
  '123', // too short
  'password', // no uppercase, no numbers, no special chars
  'PASSWORD', // no lowercase, no numbers, no special chars
  'Password', // no numbers, no special chars
  'Password123', // no special chars
  'password123!', // no uppercase
  'PASSWORD123!', // no lowercase
];

// Valid password formats for testing validation
export const validPasswords = [
  'SecurePass123!',
  'MyP@ssw0rd',
  'Test123#Pass',
  'Strong9$Password',
  'Complex@Pass1',
];

// Form field test data
export const formTestData = {
  names: {
    valid: ['John', 'Jane', "O'Connor", 'Van Der Berg', 'José', '李明'],
    invalid: ['', 'A', 'John123', 'Jane@', 'Test<script>']
  },
  emails: {
    valid: [
      'test@example.com',
      'user+tag@domain.co.uk',
      'firstname.lastname@company.org',
      'test123@test-domain.com'
    ],
    invalid: invalidEmails
  },
  passwords: {
    valid: validPasswords,
    invalid: invalidPasswords
  }
};

// API response mocks
export const apiResponses = {
  loginSuccess: {
    user: {
      id: 'user-123',
      email: 'john.doe+test@example.com',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
    },
    profile: {
      id: 'profile-123',
      first_name: 'John',
      last_name: 'Doe',
      avatar_url: null,
    },
    families: [],
    session_id: 'session-123',
  },
  loginFailure: {
    error: 'Invalid email or password',
    code: 'INVALID_CREDENTIALS',
    details: null,
  },
  signupSuccess: {
    user: {
      id: 'user-456',
      email: 'jane.smith+test@example.com',
      email_confirmed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    message: 'Account created successfully. Please check your email to verify your account.',
  },
  forgotPasswordSuccess: {
    message: 'Password reset instructions have been sent to your email address.',
  },
  rateLimited: {
    error: 'Too many requests. Please try again later.',
    code: 'TOO_MANY_REQUESTS',
    retryAfter: 300,
  },
};

// Error messages for validation testing
export const errorMessages = {
  required: {
    email: 'Email address is required',
    password: 'Password is required',
    firstName: 'First name is required',
    lastName: 'Last name is required',
    confirmPassword: 'Please confirm your password',
  },
  invalid: {
    email: 'Please enter a valid email address',
    passwordTooShort: 'Password must be at least 8 characters long',
    passwordNoLowercase: 'Password must contain at least one lowercase letter',
    passwordNoUppercase: 'Password must contain at least one uppercase letter',
    passwordNoNumber: 'Password must contain at least one number',
    passwordMismatch: 'Passwords do not match',
    nameTooShort: 'must be at least 2 characters',
    nameInvalidChars: 'can only contain letters, spaces, hyphens, and apostrophes',
  },
  auth: {
    invalidCredentials: 'Invalid email or password',
    emailNotVerified: 'Please verify your email address before signing in',
    accountLocked: 'Account temporarily locked due to suspicious activity',
    tooManyRequests: 'Too many login attempts. Please try again later.',
  },
  terms: {
    mustAccept: 'You must accept the terms and conditions to create an account',
  }
};

// Accessibility test data
export const accessibilityTestData = {
  requiredAriaLabels: [
    'Sign in to your FamilyHub account',
    'Create your FamilyHub account',
    'Send password reset email',
    'Continue with Google',
    'Continue with Apple',
    'Show password',
    'Hide password',
  ],
  requiredRoles: ['form', 'button', 'textbox', 'checkbox', 'link'],
  landmarkRoles: ['banner', 'main', 'navigation', 'form'],
  headingStructure: ['h1', 'h2', 'h3'], // Expected heading levels
};

// Security test data
export const securityTestData = {
  xssPayloads: [
    '<script>alert("xss")</script>',
    '"><script>alert("xss")</script>',
    "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//",
    '"><img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
  ],
  sqlInjectionPayloads: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "admin'/*",
  ],
  csrfTokens: {
    valid: 'csrf-token-123',
    invalid: 'invalid-token',
    missing: null,
  },
};

// Mobile viewport configurations
export const mobileViewports = [
  { name: 'iPhone SE', width: 320, height: 568 },
  { name: 'iPhone 12', width: 375, height: 812 },
  { name: 'iPhone 12 Pro Max', width: 414, height: 896 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
];

// Desktop viewport configurations
export const desktopViewports = [
  { name: 'MacBook Air', width: 1366, height: 768 },
  { name: 'Desktop HD', width: 1920, height: 1080 },
  { name: 'Desktop 4K', width: 2560, height: 1440 },
];

// Browser configurations for cross-browser testing
export const browserConfigs = [
  { name: 'Chrome', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
  { name: 'Firefox', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0' },
  { name: 'Safari', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15' },
  { name: 'Edge', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59' },
];

// Rate limiting test configurations
export const rateLimitConfigs = {
  login: { limit: 5, window: 300 }, // 5 attempts per 5 minutes
  signup: { limit: 3, window: 3600 }, // 3 attempts per hour
  forgotPassword: { limit: 3, window: 3600 }, // 3 attempts per hour
  resetPassword: { limit: 5, window: 900 }, // 5 attempts per 15 minutes
};

// Touch target minimum sizes (WCAG AA compliance)
export const touchTargetRequirements = {
  minimum: { width: 44, height: 44 }, // CSS pixels
  spacing: 8, // Minimum spacing between targets
  tolerance: 2, // Acceptable variance in pixels
};

// Color contrast requirements (WCAG AA)
export const contrastRequirements = {
  normalText: 4.5, // 4.5:1 ratio for normal text
  largeText: 3.0, // 3.0:1 ratio for large text (18pt+ or 14pt+ bold)
  uiComponents: 3.0, // 3.0:1 ratio for UI components
};