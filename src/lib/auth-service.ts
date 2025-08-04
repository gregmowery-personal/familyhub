import { 
  LoginRequest, 
  LoginResponse, 
  SignupRequest, 
  SignupResponse, 
  ForgotPasswordRequest,
  ApiResponse
} from '@/types/auth';

export class AuthService {
  private static baseUrl = '/api/auth';

  private static async makeRequest<T>(
    endpoint: string, 
    options: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: 'HTTP_ERROR',
            message: data.message || `HTTP ${response.status}: ${response.statusText}`,
          },
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (error) {
      console.error(`Auth API error (${endpoint}):`, error);
      
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network error occurred',
        },
      };
    }
  }

  /**
   * Login user with email and password
   */
  static async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({
        ...credentials,
        device_info: {
          device_type: 'web',
          browser_name: navigator.userAgent.split(' ').slice(-1)[0] || 'Unknown',
          device_name: `${navigator.platform} - ${navigator.userAgent.split(' ').slice(-1)[0]}`,
        },
      }),
    });
  }

  /**
   * Register new user
   */
  static async signup(userData: SignupRequest): Promise<ApiResponse<SignupResponse>> {
    return this.makeRequest<SignupResponse>('/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * Request password reset
   */
  static async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<{ email_sent: boolean; message: string }>> {
    return this.makeRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        redirect_url: data.redirect_url || `${window.location.origin}/auth/reset-password`,
      }),
    });
  }

  /**
   * Logout user
   */
  static async logout(): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/logout', {
      method: 'POST',
    });
  }

  /**
   * Get current user session
   */
  static async getSession(): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/session', {
      method: 'GET',
    });
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  /**
   * Initiate social authentication
   */
  static async initiateSocialAuth(provider: 'google' | 'apple'): Promise<ApiResponse<{ url: string }>> {
    return this.makeRequest<{ url: string }>(`/social/${provider}`, {
      method: 'GET',
    });
  }

  /**
   * Handle social authentication callback
   */
  static async handleSocialCallback(
    provider: string,
    code: string,
    state?: string
  ): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>(`/social/${provider}`, {
      method: 'POST',
      body: JSON.stringify({
        code,
        state,
        redirect_uri: `${window.location.origin}/auth/callback`,
      }),
    });
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string, type = 'signup'): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token, type }),
    });
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: newPassword }),
    });
  }
}

/**
 * Format error message for user display
 */
export function formatAuthError(error: { code: string; message: string }): string {
  const userFriendlyMessages: Record<string, string> = {
    'INVALID_CREDENTIALS': 'Invalid email or password. Please check your credentials and try again.',
    'EMAIL_NOT_VERIFIED': 'Please verify your email address before signing in. Check your inbox for a verification link.',
    'USER_ALREADY_EXISTS': 'An account with this email address already exists. Try signing in instead.',
    'WEAK_PASSWORD': 'Password is too weak. Please choose a stronger password with at least 8 characters, including uppercase, lowercase, and numbers.',
    'DISPOSABLE_EMAIL_BLOCKED': 'Please use a valid email address from a recognized email provider.',
    'TOO_MANY_REQUESTS': 'Too many attempts. Please wait before trying again.',
    'ACCOUNT_LOCKED': 'Account temporarily locked due to suspicious activity. Please try again later.',
    'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection and try again.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'INTERNAL_ERROR': 'Something went wrong on our end. Please try again in a few moments.',
  };

  return userFriendlyMessages[error.code] || error.message || 'An unexpected error occurred';
}