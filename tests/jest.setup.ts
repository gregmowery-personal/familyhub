/**
 * Jest Setup File
 * Global test configuration and utilities for FamilyHub RBAC tests
 */

import { jest } from '@jest/globals'

// Global test timeout for async operations
jest.setTimeout(10000)

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

// Global test utilities
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
}

// Global setup for RBAC test data
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks()
})

afterEach(() => {
  // Restore all mocks after each test
  jest.restoreAllMocks()
})

// Extend Jest matchers for RBAC testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinTimeRange(start: Date, end: Date): R
      toHaveValidUUID(): R
      toBeValidAuthResult(): R
    }
  }
  
  var testUtils: {
    mockDate: (date: string | Date) => Date
    restoreDate: () => void
    sleep: (ms: number) => Promise<void>
    generateTestId: (prefix?: string) => string
  }
}

// Custom matchers for RBAC testing
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
})