/**
 * Authentication Test Configuration
 * Central configuration for authentication test suite
 */

export const authTestConfig = {
  // Test environment settings
  environment: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001',
    timeout: 30000, // 30 seconds
    retries: process.env.CI ? 2 : 0,
  },

  // Viewport configurations
  viewports: {
    mobile: {
      smallest: { width: 320, height: 568 }, // iPhone SE
      typical: { width: 375, height: 812 },  // iPhone 12
      large: { width: 414, height: 896 },    // iPhone 12 Pro Max
    },
    tablet: {
      portrait: { width: 768, height: 1024 }, // iPad
      landscape: { width: 1024, height: 768 },
    },
    desktop: {
      small: { width: 1024, height: 768 },
      medium: { width: 1280, height: 720 },
      large: { width: 1920, height: 1080 },
    },
  },

  // Browser configurations
  browsers: {
    chromium: {
      name: 'chromium',
      headless: !process.env.HEADED,
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
    firefox: {
      name: 'firefox',
      headless: !process.env.HEADED,
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
    webkit: {
      name: 'webkit',
      headless: !process.env.HEADED,
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    },
  },

  // Test data configuration
  testData: {
    validUser: {
      email: 'test.user@familyhub.test',
      password: 'SecureTestPass123!',
      firstName: 'Test',
      lastName: 'User',
    },
    invalidCredentials: {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    },
    testDomain: 'familyhub.test',
  },

  // Accessibility requirements
  accessibility: {
    wcagLevel: 'AA',
    colorContrast: {
      normal: 4.5,
      large: 3.0,
      uiComponents: 3.0,
    },
    touchTargets: {
      minimum: { width: 44, height: 44 },
      spacing: 8,
    },
  },

  // Security test configuration
  security: {
    rateLimits: {
      login: { attempts: 5, window: 300 }, // 5 attempts per 5 minutes
      signup: { attempts: 3, window: 3600 }, // 3 attempts per hour
      forgotPassword: { attempts: 3, window: 3600 },
    },
    xssPayloads: [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      '\'><script>alert(String.fromCharCode(88,83,83))</script>',
      '<img src=x onerror=alert("xss")>',
    ],
    sqlInjectionPayloads: [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
    ],
  },

  // Performance thresholds
  performance: {
    pageLoad: 3000, // 3 seconds
    formSubmission: 5000, // 5 seconds
    apiResponse: 2000, // 2 seconds
    networkIdle: 1000, // 1 second
  },

  // API endpoints
  endpoints: {
    login: '/api/auth/login',
    signup: '/api/auth/signup',
    logout: '/api/auth/logout',
    forgotPassword: '/api/auth/forgot-password',
    resetPassword: '/api/auth/reset-password',
    verifyEmail: '/api/auth/verify-email',
    refresh: '/api/auth/refresh',
    session: '/api/auth/session',
    social: {
      google: '/api/auth/social/google',
      apple: '/api/auth/social/apple',
    },
  },

  // Test categories and priorities
  testCategories: {
    smoke: {
      priority: 'critical',
      timeout: 10000,
      retries: 3,
    },
    regression: {
      priority: 'high',
      timeout: 30000,
      retries: 2,
    },
    accessibility: {
      priority: 'high',
      timeout: 45000,
      retries: 1,
    },
    security: {
      priority: 'high',
      timeout: 60000,
      retries: 1,
    },
    performance: {
      priority: 'medium',
      timeout: 30000,
      retries: 1,
    },
    crossBrowser: {
      priority: 'medium',
      timeout: 45000,
      retries: 1,
    },
  },

  // Test data cleanup
  cleanup: {
    enabled: true,
    testUsers: {
      deleteAfterTest: true,
      maxAge: 3600, // 1 hour
    },
    testSessions: {
      deleteAfterTest: true,
      maxAge: 1800, // 30 minutes
    },
  },

  // Reporting configuration
  reporting: {
    screenshots: {
      mode: 'only-on-failure',
      fullPage: true,
    },
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
    },
    trace: {
      mode: 'on-first-retry',
      screenshots: true,
      snapshots: true,
    },
    html: {
      open: process.env.CI ? 'never' : 'on-failure',
      outputFolder: './playwright-report',
    },
  },

  // Parallel execution
  parallel: {
    workers: process.env.CI ? 2 : undefined,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
  },

  // Mock configurations
  mocks: {
    api: {
      delay: 100, // Add realistic delay to API responses
      successRate: 0.95, // 95% success rate in tests
    },
    network: {
      slow3G: {
        downloadThroughput: 500 * 1024 / 8, // 500 Kbps
        uploadThroughput: 500 * 1024 / 8,
        latency: 400,
      },
      fast3G: {
        downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
        uploadThroughput: 750 * 1024 / 8, // 750 Kbps
        latency: 300,
      },
    },
  },

  // Feature flags for conditional testing
  features: {
    socialLogin: true,
    passwordStrength: true,
    rememberMe: true,
    emailVerification: true,
    rateLimiting: true,
    mobileOptimization: true,
    accessibility: true,
    i18n: false, // Internationalization not yet implemented
  },

  // Test environment detection
  isCI: !!process.env.CI,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Debug settings
  debug: {
    enabled: !!process.env.DEBUG,
    verbose: !!process.env.VERBOSE,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    headed: !!process.env.HEADED,
  },
};

// Helper functions for test configuration
export const getViewportForDevice = (deviceType: 'mobile' | 'tablet' | 'desktop', size: 'small' | 'medium' | 'large' = 'medium') => {
  const viewports = authTestConfig.viewports;
  
  switch (deviceType) {
    case 'mobile':
      return size === 'small' ? viewports.mobile.smallest : 
             size === 'large' ? viewports.mobile.large : 
             viewports.mobile.typical;
    case 'tablet':
      return size === 'large' ? viewports.tablet.landscape : viewports.tablet.portrait;
    case 'desktop':
      return size === 'small' ? viewports.desktop.small :
             size === 'large' ? viewports.desktop.large :
             viewports.desktop.medium;
    default:
      return viewports.desktop.medium;
  }
};

export const shouldRunTest = (category: keyof typeof authTestConfig.testCategories) => {
  const config = authTestConfig.testCategories[category];
  
  // Skip non-critical tests in CI if time is limited
  if (authTestConfig.isCI && process.env.QUICK_CI) {
    return config.priority === 'critical';
  }
  
  return true;
};

export const getTestTimeout = (category: keyof typeof authTestConfig.testCategories) => {
  return authTestConfig.testCategories[category].timeout;
};

export const getTestRetries = (category: keyof typeof authTestConfig.testCategories) => {
  return authTestConfig.testCategories[category].retries;
};

// Test data generators
export const generateUniqueEmail = (prefix: string = 'test') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@${authTestConfig.testData.testDomain}`;
};

export const generateSecurePassword = () => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const all = lowercase + uppercase + numbers + symbols;
  const password = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  
  // Add 8 more random characters
  for (let i = 0; i < 8; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }
  
  // Shuffle the password
  return password.sort(() => Math.random() - 0.5).join('');
};

export default authTestConfig;