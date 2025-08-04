import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { socialAuthSchema } from '@/lib/validations/auth';
import { 
  withAuth, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationErrorResponse 
} from '@/lib/auth/middleware';
import { 
  AuthError, 
  getSecurityContext,
  logAuditEvent,
  createUserSession,
  getUserProfile,
  getUserFamilies
} from '@/lib/auth/utils';
import { rateLimiter } from '@/lib/auth/rate-limit';
import { ZodError } from 'zod';
import { Family, SecurityContext } from '@/types/auth';

const corsOptions = {
  origins: ['http://localhost:3000', 'https://familyhub.care'],
  methods: ['POST', 'GET', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization'],
};

const SUPPORTED_PROVIDERS = ['google', 'apple', 'facebook', 'microsoft', 'github', 'twitter', 'linkedin'];

export async function OPTIONS(request: NextRequest) {
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  return middlewareResponse || new Response(null, { status: 200 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const params = await context.params;
  // Apply middleware
  const middlewareResponse = await withAuth(request, {
    rateLimit: { endpoint: 'auth:social' },
    cors: corsOptions,
  });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  let requestBody: unknown;
  let securityContext: SecurityContext | null = null;
  let userId: string | null = null;

  try {
    const { provider } = params;

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new AuthError(
        `Unsupported social provider: ${provider}`,
        'UNSUPPORTED_PROVIDER',
        400
      );
    }

    // Parse request body
    requestBody = await request.json();
    securityContext = await getSecurityContext() as SecurityContext;

    // Validate input
    const validatedData = socialAuthSchema.parse({
      ...(requestBody as Record<string, unknown>),
      provider,
    });

    const supabase = await createClient();

    try {
      let authData: unknown = null;
      let authError: Error | null = null;

      // Handle different social auth flows
      if (validatedData.code) {
        // Authorization code flow (OAuth2)
        const { data, error } = await supabase.auth.exchangeCodeForSession(validatedData.code);
        authData = data;
        authError = error;
      } else {
        // Direct social sign-in (for supported providers)
        const { data, error } = await supabase.auth.signInWithOAuth({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          provider: provider as any,
          options: {
            redirectTo: validatedData.redirect_uri,
          },
        });
        
        // For OAuth, we get a URL to redirect to
        if (data?.url) {
          return createSuccessResponse(
            {
              auth_url: data.url,
              provider,
              redirect_required: true,
            },
            'Redirect to social provider for authentication',
            200,
            corsOptions
          );
        }
        
        authData = data;
        authError = error;
      }

      if (authError) {
        console.error('Supabase social auth error:', authError instanceof Error ? authError.message : "Unknown error");

        await rateLimiter.recordAttempt(
          'auth:social',
          securityContext.ip_address,
          securityContext.user_agent,
          false
        );

        // Log failed social auth attempt
        await logAuditEvent(
          'social_auth_failed',
          'authentication',
          'Social authentication failed',
          {
            eventData: {
              provider,
              error: authError.message,
              ip_address: securityContext.ip_address,
              has_code: !!validatedData.code,
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );

        let errorMessage = 'Social authentication failed';
        let errorCode = 'SOCIAL_AUTH_FAILED';

        if (authError.message.includes('invalid_code')) {
          errorMessage = 'Invalid authorization code';
          errorCode = 'INVALID_AUTH_CODE';
        } else if (authError.message.includes('invalid_state')) {
          errorMessage = 'Invalid state parameter';
          errorCode = 'INVALID_STATE';
        } else if (authError.message.includes('access_denied')) {
          errorMessage = 'Access denied by user';
          errorCode = 'ACCESS_DENIED';
        }

        throw new AuthError(errorMessage, errorCode, 400);
      }

      const typedAuthData = authData as { user?: { id: string; email?: string; created_at?: string; updated_at?: string; email_confirmed_at?: string; phone_confirmed_at?: string; user_metadata?: Record<string, unknown>; identities?: Array<{ id?: string; user_id?: string; identity_data?: Record<string, unknown> }> }; session?: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; token_type?: string } };
      
      if (!typedAuthData?.user || !typedAuthData?.session) {
        throw new AuthError('Social authentication failed', 'AUTH_FAILED', 400);
      }

      userId = typedAuthData.user.id;
      const isNewUser = !!typedAuthData.user.created_at && 
        new Date(typedAuthData.user.created_at).getTime() > (Date.now() - 5000); // Created in last 5 seconds

      try {
        // Handle social provider connection
        const providerData = typedAuthData.user.identities?.[0];
        if (providerData) {
          // Store or update social auth provider information
          const { error: providerError } = await supabase
            .from('social_auth_providers')
            .upsert({
              user_id: userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              provider: provider as any,
              provider_user_id: providerData.id || providerData.user_id,
              provider_username: providerData.identity_data?.user_name || 
                               providerData.identity_data?.login ||
                               providerData.identity_data?.username,
              provider_email: providerData.identity_data?.email,
              provider_data: providerData.identity_data || {},
              display_name: providerData.identity_data?.name || 
                           providerData.identity_data?.full_name ||
                           providerData.identity_data?.display_name,
              avatar_url: providerData.identity_data?.avatar_url || 
                         providerData.identity_data?.picture,
              link_status: 'active',
              linked_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
              is_primary_provider: isNewUser,
              auto_login_enabled: true,
            }, {
              onConflict: 'user_id,provider',
            });

          if (providerError) {
            console.error('Error storing social provider data:', providerError instanceof Error ? providerError.message : "Unknown error");
            // Don't throw error, authentication was successful
          }
        }

        // Create or update user profile for new users
        if (isNewUser) {
          const displayName = (typedAuthData.user.user_metadata?.name || 
                             typedAuthData.user.user_metadata?.full_name ||
                             typedAuthData.user.user_metadata?.display_name) as string | undefined;
          
          const firstName = typedAuthData.user.user_metadata?.given_name || 
                           displayName?.split(' ')[0];
          
          const lastName = typedAuthData.user.user_metadata?.family_name || 
                          (displayName && displayName.split(' ').length > 1 
                            ? displayName.split(' ').slice(1).join(' ') 
                            : null);

          const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              id: userId,
              first_name: firstName || null,
              last_name: lastName || null,
              display_name: displayName || null,
              profile_image_url: typedAuthData.user.user_metadata?.avatar_url || 
                               typedAuthData.user.user_metadata?.picture || null,
              preferred_language: 'en',
              timezone: 'UTC',
              notification_preferences: {},
              accessibility_preferences: {},
              two_factor_enabled: false,
            }, {
              onConflict: 'id',
            });

          if (profileError) {
            console.error('Error creating user profile for social auth:', profileError instanceof Error ? profileError.message : "Unknown error");
            // Don't throw error, authentication was successful
          }
        }

        // Get user profile and families
        if (!userId) {
          throw new AuthError('User ID is required', 'INVALID_USER_ID', 400);
        }

        const [profile, families] = await Promise.all([
          getUserProfile(userId),
          getUserFamilies(userId)
        ]);

        // Create enhanced user session record
        const sessionId = await createUserSession(
          userId,
          typedAuthData.session.access_token,
          {
            device_type: 'web',
            platform: provider,
            browser_name: `${provider}-oauth`,
          },
          securityContext
        );

        // Record successful attempt
        await rateLimiter.recordAttempt(
          'auth:social',
          securityContext.ip_address,
          securityContext.user_agent,
          true
        );

        // Clear any failed attempts for this IP
        await rateLimiter.clearRateLimit('auth:social', securityContext.ip_address);

        // Log successful social authentication
        await logAuditEvent(
          isNewUser ? 'social_signup_completed' : 'social_login_completed',
          'authentication',
          `Social ${isNewUser ? 'signup' : 'login'} completed successfully`,
          {
            actorUserId: userId || undefined,
            eventData: {
              provider,
              email: typedAuthData.user.email,
              is_new_user: isNewUser,
              session_id: sessionId,
              family_count: families.length,
            },
            securityContext,
          }
        );

        // Prepare response data
        const responseData = {
          user: {
            id: typedAuthData.user.id,
            email: typedAuthData.user.email,
            email_confirmed_at: typedAuthData.user.email_confirmed_at,
            phone_confirmed_at: typedAuthData.user.phone_confirmed_at,
            created_at: typedAuthData.user.created_at,
            updated_at: typedAuthData.user.updated_at,
          },
          session: {
            access_token: typedAuthData.session.access_token,
            refresh_token: typedAuthData.session.refresh_token,
            expires_at: typedAuthData.session.expires_at,
            expires_in: typedAuthData.session.expires_in,
            token_type: typedAuthData.session.token_type,
          },
          profile,
          families: families.map((family: Family & { role?: string; is_family_admin?: boolean }) => ({
            id: family.id,
            name: family.name,
            family_type: family.family_type,
            timezone: family.timezone,
            role: family.role,
            is_family_admin: family.is_family_admin,
          })),
          provider,
          is_new_user: isNewUser,
          session_id: sessionId,
        };

        return createSuccessResponse(
          responseData,
          `${isNewUser ? 'Account created' : 'Login successful'} via ${provider}`,
          isNewUser ? 201 : 200,
          corsOptions
        );

      } catch (postAuthError) {
        console.error('Post social auth processing error:', postAuthError instanceof Error ? postAuthError.message : "Unknown error");
        
        // Log error but still return success since auth worked
        await logAuditEvent(
          'social_auth_post_processing_error',
          'authentication',
          'Error in post social auth processing',
          {
            actorUserId: userId || undefined,
            eventData: {
              provider,
              error: postAuthError instanceof Error ? postAuthError.message : 'Unknown error',
            },
            severity: 'medium',
            success: false,
            securityContext,
          }
        );

        // Return basic success response
        return createSuccessResponse(
          {
            user: {
              id: typedAuthData.user.id,
              email: typedAuthData.user.email,
              email_confirmed_at: typedAuthData.user.email_confirmed_at,
              phone_confirmed_at: typedAuthData.user.phone_confirmed_at,
              created_at: typedAuthData.user.created_at,
              updated_at: typedAuthData.user.updated_at,
            },
            session: {
              access_token: typedAuthData.session.access_token,
              refresh_token: typedAuthData.session.refresh_token,
              expires_at: typedAuthData.session.expires_at,
              expires_in: typedAuthData.session.expires_in,
              token_type: typedAuthData.session.token_type,
            },
            profile: null,
            families: [],
            provider,
            is_new_user: isNewUser,
            session_id: null,
          },
          `Authentication successful via ${provider}`,
          200,
          corsOptions
        );
      }

    } catch (socialAuthError) {
      console.error('Social authentication processing error:', socialAuthError instanceof Error ? socialAuthError.message : "Unknown error");
      
      // Log detailed error
      await logAuditEvent(
        'social_auth_processing_error',
        'authentication',
        'Error processing social authentication',
        {
          actorUserId: userId || undefined,
          eventData: {
            provider,
            error: socialAuthError instanceof Error ? socialAuthError.message : 'Unknown error',
          },
          severity: 'high',
          success: false,
          securityContext,
        }
      );

      throw socialAuthError;
    }

  } catch (error) {
    console.error('Social auth error:', error);

    // Record failed attempt for rate limiting
    if (securityContext) {
      await rateLimiter.recordAttempt(
        'auth:social',
        securityContext.ip_address,
        securityContext.user_agent,
        false
      );
    }

    // Log failed social auth attempt
    if (securityContext) {
      await logAuditEvent(
        'social_auth_failed',
        'authentication',
        'Social authentication attempt failed',
        {
          actorUserId: userId || undefined,
          eventData: {
            provider: params.provider,
            error: error instanceof Error ? error.message : 'Unknown error',
            has_code: !!(requestBody as { code?: string })?.code,
          },
          severity: 'medium',
          success: false,
          securityContext,
        }
      );
    }

    // Handle different error types
    if (error instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return createValidationErrorResponse(errors, corsOptions);
    }

    if (error instanceof AuthError) {
      return createErrorResponse(error, corsOptions);
    }

    return createErrorResponse(
      new AuthError('An unexpected error occurred during social authentication', 'INTERNAL_ERROR', 500),
      corsOptions
    );
  }
}

// Handle GET requests for OAuth callbacks
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const params = await context.params;
  const middlewareResponse = await withAuth(request, { cors: corsOptions });
  
  if (middlewareResponse) {
    return middlewareResponse;
  }

  const { searchParams } = new URL(request.url);
  
  // Extract OAuth parameters
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return createErrorResponse(
      new AuthError(
        errorDescription || `Social authentication failed: ${error}`,
        'SOCIAL_AUTH_ERROR',
        400
      ),
      corsOptions
    );
  }

  if (!code) {
    return createErrorResponse(
      new AuthError('Missing authorization code', 'MISSING_AUTH_CODE', 400),
      corsOptions
    );
  }

  // Forward to POST handler with the code
  return POST(request, { params: Promise.resolve(params) });
}