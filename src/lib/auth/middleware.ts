import { NextRequest, NextResponse } from 'next/server';
import { AuthError, RateLimitError, logAuditEvent } from './utils';
import { rateLimiter } from './rate-limit';

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireFamilyAdmin?: boolean;
  familyIdParam?: string;
  rateLimit?: {
    endpoint: string;
    skipSuccessful?: boolean;
  };
  cors?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
  };
}

/**
 * Authentication and authorization middleware
 */
export async function withAuth(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<NextResponse | null> {
  try {
    // Extract security context
    const securityContext = {
      ip_address: getClientIP(request),
      user_agent: request.headers.get('user-agent') || 'unknown',
    };

    // Check if IP is blocked
    if (await rateLimiter.isIPBlocked(securityContext.ip_address)) {
      await logAuditEvent(
        'access_blocked',
        'security',
        'Access blocked due to IP block',
        { securityContext, severity: 'high' }
      );
      
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message: 'Access temporarily restricted',
          },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply rate limiting
    if (options.rateLimit) {
      try {
        await rateLimiter.enforceRateLimit(
          options.rateLimit.endpoint,
          securityContext.ip_address,
          securityContext.user_agent
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          return new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: error.message,
              },
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': error.retryAfter.toString(),
                'X-RateLimit-Limit': error.limit.toString(),
                'X-RateLimit-Remaining': error.remaining.toString(),
              },
            }
          );
        }
        throw error;
      }
    }

    // Apply CORS headers
    if (options.cors) {
      const origin = request.headers.get('origin');
      const allowedOrigins = options.cors.origins || ['http://localhost:3000'];
      
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 200,
          headers: getCorsHeaders(origin, allowedOrigins, options.cors),
        });
      }
    }

    return null; // Continue to the actual handler
  } catch (error) {
    console.error('Auth middleware error:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const connectingIP = request.headers.get('x-connecting-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (connectingIP) {
    return connectingIP;
  }

  return 'unknown';
}

/**
 * Generate CORS headers
 */
function getCorsHeaders(
  origin: string | null,
  allowedOrigins: string[],
  corsOptions: NonNullable<AuthMiddlewareOptions['cors']>
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  // Set other CORS headers
  headers['Access-Control-Allow-Methods'] = (corsOptions.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']).join(', ');
  headers['Access-Control-Allow-Headers'] = (corsOptions.headers || ['Content-Type', 'Authorization']).join(', ');
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours

  return headers;
}

/**
 * Error response helper
 */
export function createErrorResponse(
  error: AuthError,
  cors?: AuthMiddlewareOptions['cors']
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add CORS headers if needed
  if (cors) {
    Object.assign(headers, getCorsHeaders(null, cors.origins || [], cors));
  }

  return new NextResponse(
    JSON.stringify({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    }),
    {
      status: error.statusCode,
      headers,
    }
  );
}

/**
 * Success response helper
 */
export function createSuccessResponse(
  data: unknown,
  message?: string,
  status: number = 200,
  cors?: AuthMiddlewareOptions['cors']
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add CORS headers if needed
  if (cors) {
    Object.assign(headers, getCorsHeaders(null, cors.origins || [], cors));
  }

  return new NextResponse(
    JSON.stringify({
      success: true,
      data,
      message,
    }),
    {
      status,
      headers,
    }
  );
}

/**
 * Validation error response helper
 */
export function createValidationErrorResponse(
  errors: Record<string, string[]>,
  cors?: AuthMiddlewareOptions['cors']
): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add CORS headers if needed
  if (cors) {
    Object.assign(headers, getCorsHeaders(null, cors.origins || [], cors));
  }

  return new NextResponse(
    JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors },
      },
    }),
    {
      status: 400,
      headers,
    }
  );
}