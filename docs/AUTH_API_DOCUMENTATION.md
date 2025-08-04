# FamilyHub Authentication API Documentation

## Overview

The FamilyHub Authentication API provides secure authentication and authorization endpoints for the multi-generational family coordination platform. Built with Next.js 15 App Router and Supabase, it offers comprehensive security features including rate limiting, audit logging, and family-based access control.

## Base URL

```
Production: https://familyhub.care/api/auth
Development: http://localhost:3000/api/auth
```

## Authentication Flow

1. **Registration**: Users sign up with email/password or social providers
2. **Email Verification**: New users verify their email addresses
3. **Login**: Authenticated users receive JWT tokens
4. **Session Management**: Tokens can be refreshed and sessions tracked
5. **Family Integration**: Users can join families via invitation tokens

## Security Features

- **Rate Limiting**: Prevents brute force attacks with configurable limits
- **Input Validation**: All inputs validated using Zod schemas
- **CORS Protection**: Configurable cross-origin resource sharing
- **Audit Logging**: Comprehensive security event tracking
- **IP Blocking**: Automatic blocking of suspicious IP addresses
- **Password Strength**: Enforced strong password requirements
- **Session Management**: Device tracking and session invalidation

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error information
    }
  }
}
```

### Validation Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "errors": {
        "field_name": ["Error message 1", "Error message 2"]
      }
    }
  }
}
```

## Rate Limiting

All endpoints are protected by rate limiting with the following default limits:

- **Login**: 5 attempts per 5 minutes per IP
- **Signup**: 3 attempts per hour per IP  
- **Forgot Password**: 3 attempts per hour per IP
- **Reset Password**: 5 attempts per 15 minutes per IP
- **Email Verification**: 10 attempts per hour per IP
- **Token Refresh**: 20 attempts per hour per IP
- **Social Auth**: 10 attempts per 10 minutes per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
Retry-After: 300 (when rate limited)
```

## API Endpoints

### 1. POST /api/auth/signup

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1234567890",
  "family_invitation_token": "uuid-token-here"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": null,
      "created_at": "2024-01-01T00:00:00Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890,
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "needs_email_verification": true,
    "family_joined": false
  },
  "message": "Account created successfully. Please check your email to verify your account."
}
```

**Error Codes:**
- `DISPOSABLE_EMAIL_BLOCKED`: Disposable email address rejected
- `WEAK_PASSWORD`: Password doesn't meet strength requirements
- `USER_ALREADY_EXISTS`: Email already registered
- `INVALID_INVITATION_TOKEN`: Family invitation token invalid

### 2. POST /api/auth/login

Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "device_info": {
    "device_id": "device-fingerprint",
    "device_name": "John's iPhone",
    "device_type": "mobile",
    "platform": "iOS",
    "browser_name": "Safari"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890,
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "profile": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "display_name": "John Doe",
      "timezone": "UTC"
    },
    "families": [
      {
        "id": "family-uuid",
        "name": "The Doe Family",
        "family_type": "nuclear",
        "role": "admin",
        "is_family_admin": true
      }
    ],
    "session_id": "session-uuid"
  },
  "message": "Login successful"
}
```

**Error Codes:**
- `INVALID_CREDENTIALS`: Invalid email or password
- `EMAIL_NOT_VERIFIED`: Email address not verified
- `ACCOUNT_LOCKED`: Account temporarily locked due to suspicious activity

### 3. POST /api/auth/logout

Log out the current user and invalidate session.

**Headers:**
```
Authorization: Bearer jwt-token
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "logged_out": true
  },
  "message": "Logged out successfully"
}
```

### 4. GET /api/auth/session

Get current session information.

**Headers:**
```
Authorization: Bearer jwt-token
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890,
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "profile": {
      "first_name": "John",
      "last_name": "Doe",
      "timezone": "UTC"
    },
    "families": [
      {
        "id": "family-uuid",
        "name": "The Doe Family",
        "role": "admin"
      }
    ]
  },
  "message": "Session active"
}
```

### 5. GET /api/auth/user

Get comprehensive user profile information.

**Headers:**
```
Authorization: Bearer jwt-token
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "profile": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "display_name": "John Doe",
      "phone_number": "+1234567890",
      "profile_image_url": "https://example.com/avatar.jpg",
      "preferred_language": "en",
      "timezone": "America/New_York",
      "two_factor_enabled": false
    },
    "families": [
      {
        "id": "family-uuid",
        "name": "The Doe Family",
        "family_type": "nuclear",
        "role": "admin",
        "is_family_admin": true,
        "member_count": 4
      }
    ],
    "session_info": {
      "active_sessions_count": 2
    },
    "account_status": {
      "email_verified": true,
      "phone_verified": false,
      "profile_complete": true,
      "has_families": true,
      "two_factor_enabled": false
    }
  },
  "message": "User profile retrieved successfully"
}
```

**Error Codes:**
- `AUTHENTICATION_REQUIRED`: Valid JWT token required

### 6. POST /api/auth/forgot-password

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "redirect_url": "https://familyhub.care/auth/reset-password"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "email_sent": true,
    "message": "If an account with that email exists, a password reset link has been sent."
  },
  "message": "Password reset email sent if account exists"
}
```

### 7. POST /api/auth/reset-password

Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "password_updated": true,
    "sessions_invalidated": true,
    "message": "Password updated successfully. Please log in with your new password."
  },
  "message": "Password reset completed successfully"
}
```

**Error Codes:**
- `INVALID_RESET_TOKEN`: Token is invalid or expired
- `WEAK_PASSWORD`: New password doesn't meet requirements

### 8. POST /api/auth/verify-email

Verify email address using verification token.

**Request Body:**
```json
{
  "token": "verification-token-from-email",
  "type": "signup"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "email_verified": true,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890
    },
    "verification_type": "signup"
  },
  "message": "Email verified successfully"
}
```

**Error Codes:**
- `INVALID_VERIFICATION_TOKEN`: Token is invalid or expired
- `TOKEN_EXPIRED`: Verification token has expired

### 9. POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "refresh-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "new-jwt-token",
      "refresh_token": "new-refresh-token",
      "expires_at": 1234567890,
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "Token refreshed successfully"
}
```

**Error Codes:**
- `INVALID_REFRESH_TOKEN`: Refresh token is invalid or expired
- `TOKEN_REVOKED`: Refresh token has been revoked

### 10. POST /api/auth/social/[provider]

Authenticate with social providers (Google, Apple, Facebook, etc.).

**Supported Providers:**
- `google`
- `apple` 
- `facebook`
- `microsoft`
- `github`
- `twitter`
- `linkedin`

**Request Body:**
```json
{
  "code": "oauth-authorization-code",
  "state": "csrf-state-token",
  "redirect_uri": "https://familyhub.care/auth/callback"
}
```

**Response (200/201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": 1234567890
    },
    "profile": {
      "first_name": "John",
      "last_name": "Doe",
      "profile_image_url": "https://avatar.url"
    },
    "families": [],
    "provider": "google",
    "is_new_user": true,
    "session_id": "session-uuid"
  },
  "message": "Account created via google"
}
```

**OAuth Redirect Response (for browser flows):**
```json
{
  "success": true,
  "data": {
    "auth_url": "https://accounts.google.com/oauth/authorize?...",
    "provider": "google",
    "redirect_required": true
  },
  "message": "Redirect to social provider for authentication"
}
```

**Error Codes:**
- `UNSUPPORTED_PROVIDER`: Social provider not supported
- `INVALID_AUTH_CODE`: Authorization code is invalid
- `ACCESS_DENIED`: User denied access

## Error Handling

### HTTP Status Codes

- `200`: Success
- `201`: Created (successful signup)
- `400`: Bad Request (validation errors, invalid input)
- `401`: Unauthorized (authentication required, invalid credentials)
- `404`: Not Found (user not found)
- `409`: Conflict (user already exists)
- `423`: Locked (account/IP temporarily locked)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_REQUIRED`: Valid authentication required
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `IP_BLOCKED`: IP address blocked due to suspicious activity
- `INTERNAL_ERROR`: Unexpected server error

## Security Considerations

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character
- Password strength score of 5+ required

### Session Security

- JWT tokens with configurable expiration
- Refresh tokens for seamless experience
- Device tracking and fingerprinting
- Automatic session invalidation on password reset
- Concurrent session limits

### Rate Limiting Strategy

- IP-based rate limiting with sliding windows
- Separate limits for different endpoint types
- Automatic IP blocking for high-risk behavior
- Failed attempt tracking and analysis
- Progressive penalty increases

### Audit and Monitoring

- Comprehensive audit logging for all security events
- Anomaly detection for suspicious patterns
- Risk scoring for authentication attempts
- Security incident tracking and investigation
- Retention policies for compliance

## Family Integration

### Family Invitation Flow

1. Family admin generates invitation token
2. Invitation sent via email with unique token
3. New user signs up with invitation token
4. User automatically added to family with specified role
5. Welcome email sent with family information

### Role-Based Access

- **Admin**: Full family management permissions
- **Adult**: Standard family member access
- **Teen**: Age-appropriate interface and permissions
- **Child**: Simplified interface with limited access
- **Senior**: Optional simplified interface

## Development Setup

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=https://familyhub.care
```

### Database Setup

1. Run Supabase migrations in order:
```bash
# Core schema
supabase db push

# Apply custom migrations
supabase migration up
```

2. Configure RLS policies and functions
3. Set up social auth providers in Supabase dashboard
4. Configure email templates

### Testing

```bash
# Run all tests
npm test

# Test authentication flows
npm run test:auth

# Test rate limiting
npm run test:rate-limit
```

## Monitoring and Maintenance

### Health Checks

- `GET /api/health`: Basic health check
- `GET /api/auth/health`: Authentication system status
- Monitor rate limit effectiveness
- Track authentication success rates

### Maintenance Tasks

- Regular cleanup of expired tokens and sessions
- Monitor and adjust rate limits based on usage
- Review audit logs for security incidents  
- Update blocked IP lists
- Database maintenance and optimization

### Performance Optimization

- Index optimization for frequent queries
- Connection pooling configuration
- Caching strategies for session data
- CDN configuration for static assets
- Database query optimization

## Support and Troubleshooting

### Common Issues

1. **Rate Limited**: Wait for rate limit window to reset
2. **Email Not Verified**: Check spam folder, request new verification
3. **Social Auth Fails**: Verify provider configuration
4. **Token Expired**: Use refresh token to get new access token
5. **Family Invitation Invalid**: Request new invitation from admin

### Support Channels

- Documentation: https://docs.familyhub.care
- Support Email: support@familyhub.care
- Status Page: https://status.familyhub.care

### Debug Information

When reporting issues, include:
- Request/response headers and body
- Error codes and messages
- Timestamp of the issue
- User agent and IP address (if relevant)
- Steps to reproduce the problem