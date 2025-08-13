/**
 * 🛡️ BOROMIR'S JEST TESTING SHIELD WALL SETUP 🛡️
 * 
 * "By the Horn of Gondor, I prepare the testing realm for battle!"
 * 
 * This setup file configures Jest for all our testing needs
 * with the thoroughness of the Guard of the Citadel.
 */

import '@testing-library/jest-dom';
import { jest } from '@jest/globals'

// Global test timeout for async operations - Extended for thorough testing
jest.setTimeout(15000)

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Uncomment to silence console output in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: '/test',
    query: {},
    asPath: '/test',
    route: '/test',
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  }),
}));

// Mock Next.js navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Note: Supabase mocks will be setup per test file as needed

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Global test utilities - The weapons in our testing arsenal
global.testUtils = {
  // Helper to create mock dates
  mockDate: (date: string | Date) => {
    const mockDate = new Date(date)
    jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())
    return mockDate
  },

  // Helper to restore date mocks
  restoreDate: () => {
    jest.restoreAllMocks()
  },

  // Helper to wait for async operations
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test UUIDs consistently
  generateTestId: (prefix: string = 'test') => `${prefix}-${Math.random().toString(36).substr(2, 9)}`,

  // Mock user data
  createMockUser: (overrides = {}) => ({
    id: 'mock-user-id',
    email: 'test@familyhub.care',
    user_metadata: {
      full_name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
    },
    ...overrides,
  }),

  // Mock family data
  createMockFamily: (overrides = {}) => ({
    id: 'mock-family-id',
    name: 'Test Family',
    status: 'active',
    created_by: 'mock-user-id',
    ...overrides,
  }),

  // Mock invitation data
  createMockInvitation: (overrides = {}) => ({
    id: 'mock-invitation-id',
    family_id: 'mock-family-id',
    email: 'invitee@familyhub.care',
    role: 'caregiver',
    status: 'pending',
    invitation_token: 'mock-token',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  // Mock API responses
  createMockApiResponse: (data, success = true) => ({
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
  }),

  // Wait for async operations
  waitFor: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),

  // Console utilities for test debugging
  silenceConsole: () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  },

  restoreConsole: () => {
    jest.restoreAllMocks();
  },
}

// Global test configuration
const testConfig = {
  // Accessibility requirements
  ACCESSIBILITY: {
    CONTRAST_RATIO: 4.5,
    TOUCH_TARGET_SIZE: 44,
    FONT_SIZE_MINIMUM: 14,
  },
  
  // Performance thresholds
  PERFORMANCE: {
    MAX_LOAD_TIME: 3000,
    MAX_INTERACTION_TIME: 500,
    MAX_API_RESPONSE_TIME: 2000,
  },
  
  // Test timeouts
  TIMEOUTS: {
    NETWORK: 5000,
    ANIMATION: 300,
    USER_INTERACTION: 1000,
  },
};

// Make config available globally
global.testConfig = testConfig;

// Error boundary for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global setup for RBAC test data
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks()
})

afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear localStorage
  localStorageMock.clear();
  sessionStorageMock.clear();
  
  // Clear fetch mock
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
  }
})

// Global test reporter
const originalLog = console.log;
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('✅')) {
    originalLog('🛡️', ...args);
  } else if (args[0] && typeof args[0] === 'string' && args[0].includes('❌')) {
    originalLog('⚔️', ...args);
  } else {
    originalLog(...args);
  }
};

// Extend Jest matchers for RBAC and invitation testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinTimeRange(start: Date, end: Date): R
      toHaveValidUUID(): R
      toBeValidAuthResult(): R
      toBeValidInvitation(): R
    }
  }
  
  var testUtils: {
    mockDate: (date: string | Date) => Date
    restoreDate: () => void
    sleep: (ms: number) => Promise<void>
    generateTestId: (prefix?: string) => string
    createMockUser: (overrides?: any) => any
    createMockFamily: (overrides?: any) => any
    createMockInvitation: (overrides?: any) => any
    createMockApiResponse: (data: any, success?: boolean) => any
    waitFor: (ms?: number) => Promise<void>
    silenceConsole: () => void
    restoreConsole: () => void
  }
  
  var testConfig: {
    ACCESSIBILITY: {
      CONTRAST_RATIO: number
      TOUCH_TARGET_SIZE: number
      FONT_SIZE_MINIMUM: number
    }
    PERFORMANCE: {
      MAX_LOAD_TIME: number
      MAX_INTERACTION_TIME: number
      MAX_API_RESPONSE_TIME: number
    }
    TIMEOUTS: {
      NETWORK: number
      ANIMATION: number
      USER_INTERACTION: number
    }
  }
}

// Custom matchers for RBAC and invitation testing
expect.extend({
  toBeWithinTimeRange(received: Date, start: Date, end: Date) {
    const pass = received >= start && received <= end
    return {
      message: () => 
        pass
          ? `Expected ${received} not to be within ${start} and ${end}`
          : `Expected ${received} to be within ${start} and ${end}`,
      pass,
    }
  },
  
  toHaveValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const pass = uuidRegex.test(received)
    return {
      message: () => 
        pass
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
      pass,
    }
  },
  
  toBeValidAuthResult(received: any) {
    const hasRequiredFields = 
      typeof received === 'object' &&
      typeof received.allowed === 'boolean' &&
      typeof received.reason === 'string'
    
    return {
      message: () => 
        hasRequiredFields
          ? `Expected ${JSON.stringify(received)} not to be a valid authorization result`
          : `Expected ${JSON.stringify(received)} to be a valid authorization result with 'allowed' (boolean) and 'reason' (string)`,
      pass: hasRequiredFields,
    }
  },

  toBeValidInvitation(received: any) {
    const hasRequiredFields = 
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.email === 'string' &&
      typeof received.status === 'string' &&
      typeof received.invitation_token === 'string' &&
      typeof received.expires_at === 'string'
    
    const validStatuses = ['pending', 'accepted', 'expired', 'cancelled']
    const hasValidStatus = validStatuses.includes(received?.status)
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const hasValidEmail = emailRegex.test(received?.email || '')
    
    const isValid = hasRequiredFields && hasValidStatus && hasValidEmail
    
    return {
      message: () => 
        isValid
          ? `Expected ${JSON.stringify(received)} not to be a valid invitation`
          : `Expected ${JSON.stringify(received)} to be a valid invitation with required fields and valid email/status`,
      pass: isValid,
    }
  },
})

console.log('✅ Boromir\'s Testing Realm setup COMPLETED - The shields are raised!');

/**
 * 🏆 TESTING ENVIRONMENT READY
 * 
 * "The testing realm stands prepared! Every mock forged with precision,
 * every utility sharpened for battle, every configuration set for victory.
 * 
 * Let the tests begin - may they be as thorough as the defenses of
 * Minas Tirith and as reliable as the oath of Gondor!"
 * 
 * For comprehensive testing! For quality assurance! For FamilyHub.care!
 */