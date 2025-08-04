# FamilyHub Authentication Test Suite

This comprehensive test suite covers all aspects of the FamilyHub authentication system, ensuring WCAG AA accessibility compliance, mobile responsiveness, security, and cross-browser compatibility.

## Test Structure

```
tests/
├── helpers/
│   ├── auth-fixtures.ts      # Test data and fixtures
│   └── auth-helpers.ts       # Page objects and utilities
├── auth-ui-components.spec.ts       # UI component tests
├── auth-api-endpoints.spec.ts       # API endpoint tests
├── auth-e2e-flows.spec.ts          # End-to-end flow tests
├── auth-accessibility.spec.ts      # WCAG AA compliance tests
├── auth-security.spec.ts           # Security testing
├── auth-mobile-responsive.spec.ts  # Mobile responsiveness
├── auth-cross-browser.spec.ts      # Cross-browser compatibility
├── auth-test-config.ts             # Test configuration
└── README.md                       # This file
```

## Test Coverage

### 1. UI Component Tests (`auth-ui-components.spec.ts`)
- **LoginForm Component**
  - Form rendering and validation
  - Password visibility toggle
  - Remember me functionality
  - Loading states and error handling
- **SignupForm Component**
  - Complex form validation
  - Password strength indicator
  - Terms and conditions handling
  - Real-time validation feedback
- **ForgotPasswordForm Component**
  - Email validation
  - Success/error state handling
  - Security notices
- **SocialLoginButtons Component**
  - Button rendering and interactions
  - Loading states
  - Error handling

### 2. API Endpoint Tests (`auth-api-endpoints.spec.ts`)
- **Authentication Endpoints**
  - `/api/auth/login` - Login functionality
  - `/api/auth/signup` - User registration
  - `/api/auth/logout` - Session termination
  - `/api/auth/forgot-password` - Password reset initiation
  - `/api/auth/reset-password` - Password reset completion
  - `/api/auth/verify-email` - Email verification
  - `/api/auth/refresh` - Token refresh
  - `/api/auth/social/*` - Social authentication
- **Validation Testing**
  - Input validation and sanitization
  - Error response formatting
  - Rate limiting enforcement
- **Security Headers**
  - CORS policy validation
  - Security header presence
  - Request size limits

### 3. End-to-End Flow Tests (`auth-e2e-flows.spec.ts`)
- **Complete User Journeys**
  - Signup → Email Verification → Login
  - Password Reset Flow
  - Social Authentication Flow
  - Session Management
- **Edge Cases**
  - Network failures and recovery
  - Browser navigation during auth
  - Concurrent sessions
  - Session timeout handling
- **Mobile-Specific Flows**
  - Touch interactions
  - Keyboard handling
  - Orientation changes

### 4. Accessibility Tests (`auth-accessibility.spec.ts`)
- **WCAG AA Compliance**
  - Color contrast (4.5:1 ratio)
  - Touch targets (44px minimum)
  - Keyboard navigation
  - Screen reader compatibility
- **Form Accessibility**
  - Proper labeling and associations
  - Error announcements
  - Focus management
- **Visual Accessibility**
  - High contrast mode support
  - Reduced motion preferences
  - Forced colors mode

### 5. Security Tests (`auth-security.spec.ts`)
- **Input Security**
  - XSS prevention
  - SQL injection prevention
  - Input sanitization
- **Authentication Security**
  - Rate limiting
  - Session security
  - CSRF protection
- **Password Security**
  - Strength requirements
  - Common password prevention
- **API Security**
  - Request validation
  - Security headers
  - OAuth security

### 6. Mobile Responsiveness Tests (`auth-mobile-responsive.spec.ts`)
- **Viewport Support**
  - 320px minimum width
  - Multiple mobile device sizes
  - Orientation changes
- **Touch Interactions**
  - 44px touch targets
  - Proper spacing
  - Mobile gestures
- **Mobile Features**
  - Keyboard types (email, password)
  - Autocomplete attributes
  - Safe area handling
- **Performance**
  - Mobile network simulation
  - Memory constraints
  - Asset optimization

### 7. Cross-Browser Tests (`auth-cross-browser.spec.ts`)
- **Browser Compatibility**
  - Chrome/Chromium
  - Firefox
  - Safari
  - Edge
- **Feature Support**
  - Modern JavaScript APIs
  - CSS features (Grid, Flexbox)
  - HTML5 input types
  - Web standards compliance

## Running Tests

### Prerequisites
```bash
npm install
npm run dev  # Start development server on port 3001
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# UI Components only
npx playwright test auth-ui-components

# API Endpoints only  
npx playwright test auth-api-endpoints

# End-to-end flows
npx playwright test auth-e2e-flows

# Accessibility tests
npx playwright test auth-accessibility

# Security tests
npx playwright test auth-security

# Mobile responsiveness
npx playwright test auth-mobile-responsive

# Cross-browser compatibility
npx playwright test auth-cross-browser
```

### Run Tests with Options
```bash
# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug mode
npx playwright test --debug

# Run on specific browser
npx playwright test --project=chromium

# Run tests matching pattern
npx playwright test --grep "login"

# Generate test report
npx playwright test --reporter=html
```

### Environment Variables
```bash
# Base URL for tests
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001

# Run in headed mode
HEADED=1

# Slow down execution for debugging
SLOW_MO=1000

# Enable debug output
DEBUG=1

# Verbose logging
VERBOSE=1
```

## Test Configuration

The test suite uses `auth-test-config.ts` for centralized configuration:

- **Viewports**: Mobile, tablet, and desktop sizes
- **Browsers**: Chromium, Firefox, Safari, Edge
- **Performance**: Timeouts and thresholds
- **Accessibility**: WCAG requirements
- **Security**: Rate limits and test payloads

## Test Data Management

### Fixtures (`auth-fixtures.ts`)
- Test user accounts
- Form validation data
- API response mocks
- Security test payloads
- Accessibility test data

### Helpers (`auth-helpers.ts`)
- Page object models
- Reusable test utilities
- API mock functions
- Accessibility check functions
- Mobile test helpers

## Accessibility Requirements

All tests ensure compliance with:
- **WCAG 2.1 AA standards**
- **Color contrast ratio**: 4.5:1 for normal text
- **Touch targets**: Minimum 44x44 CSS pixels
- **Keyboard navigation**: Full functionality without mouse
- **Screen readers**: Proper ARIA labels and announcements

## Mobile Requirements

Tests verify:
- **Minimum width**: 320px (iPhone SE)
- **Touch targets**: 44px minimum with 8px spacing
- **Keyboard support**: Appropriate input types and modes
- **Orientation**: Portrait and landscape support
- **Performance**: Optimized for mobile networks

## Security Requirements

Tests validate:
- **XSS prevention**: Input sanitization and output encoding
- **CSRF protection**: Token validation and referrer checks
- **SQL injection**: Parameterized queries and input validation
- **Rate limiting**: Brute force protection
- **Session security**: Secure cookies and timeout handling

## Continuous Integration

The test suite is optimized for CI environments:
- **Parallel execution**: Tests run in parallel for speed
- **Retry logic**: Flaky tests are automatically retried
- **Screenshots**: Captured on failures for debugging
- **Video recording**: Available for failed tests
- **HTML reports**: Generated for test results

## Debugging Failed Tests

### Screenshots and Videos
Failed tests automatically capture:
- Screenshots at the point of failure
- Video recordings of the entire test
- Network activity logs
- Console error messages

### Debug Mode
```bash
# Run single test in debug mode
npx playwright test auth-ui-components --debug --grep "should render login form"

# Run with headed browser and slow motion
HEADED=1 SLOW_MO=1000 npx playwright test auth-e2e-flows
```

### Test Reports
```bash
# Generate and open HTML report
npx playwright test --reporter=html
npx playwright show-report
```

### Common Issues

1. **Server not running**: Ensure dev server is on port 3001
2. **Flaky tests**: Check network conditions and timing
3. **Browser differences**: Some tests may behave differently across browsers
4. **Mobile tests**: Verify touch target sizes and viewport settings

## Test Maintenance

### Adding New Tests
1. Choose appropriate test file based on category
2. Use existing helpers and fixtures
3. Follow established naming conventions
4. Include accessibility checks where relevant
5. Add mobile responsiveness validation

### Updating Test Data
1. Modify `auth-fixtures.ts` for new test data
2. Update `auth-test-config.ts` for configuration changes
3. Add new helpers to `auth-helpers.ts` as needed

### Performance Monitoring
Tests include performance assertions:
- Page load times
- Form submission speed  
- API response times
- Mobile network simulation

## Best Practices

1. **Use Page Objects**: Leverage helper classes for maintainability
2. **Test Real Scenarios**: Focus on actual user workflows
3. **Include Edge Cases**: Test error conditions and recovery
4. **Validate Accessibility**: Every interactive element should be accessible
5. **Test Mobile First**: Ensure mobile experience is optimal
6. **Security by Default**: Include security validations in all tests
7. **Cross-Browser Testing**: Verify compatibility across browsers
8. **Performance Awareness**: Monitor load times and responsiveness

## Contributing

When adding new authentication features:
1. Add corresponding UI component tests
2. Include API endpoint validation
3. Create end-to-end user flows
4. Verify accessibility compliance
5. Test security implications
6. Validate mobile responsiveness
7. Check cross-browser compatibility

## Support

For test-related issues:
1. Check existing test failures in CI
2. Review test configuration settings
3. Examine helper functions for reusable code
4. Consult Playwright documentation for advanced features
5. Update test data and fixtures as needed