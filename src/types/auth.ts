export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  phone_number?: string;
  profile_image_url?: string;
  preferred_language: string;
  timezone: string;
  notification_preferences: Record<string, unknown>;
  accessibility_preferences: Record<string, unknown>;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  family_type: 'nuclear' | 'single_parent' | 'blended' | 'multigenerational' | 'extended';
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
  relationship?: string;
  birth_date?: string;
  is_primary_contact: boolean;
  is_emergency_contact: boolean;
  is_family_admin: boolean;
  access_level: 'full' | 'limited' | 'view_only';
  interface_preference: 'full' | 'simplified' | 'child_friendly';
  custody_schedule?: Record<string, unknown>;
  custody_percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  family_id?: string;
  session_token: string;
  device_id?: string;
  device_name?: string;
  device_type?: 'mobile' | 'tablet' | 'desktop' | 'web';
  platform?: string;
  browser_name?: string;
  ip_address?: string;
  country?: string;
  city?: string;
  user_agent?: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  is_active: boolean;
  is_trusted_device: boolean;
  active_family_role?: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
}

export interface AuthToken {
  id: string;
  token_hash: string;
  token_type: 'password_reset' | 'email_verification' | 'family_invitation' | 'magic_link' | 'mfa_backup' | 'account_verification' | 'session_challenge';
  token_status: 'active' | 'used' | 'expired' | 'revoked';
  user_id?: string;
  email?: string;
  family_id?: string;
  expires_at: string;
  max_uses: number;
  uses_count: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialAuthProvider {
  id: string;
  user_id: string;
  provider: 'google' | 'apple' | 'facebook' | 'microsoft' | 'github' | 'twitter' | 'linkedin';
  provider_user_id: string;
  provider_username?: string;
  provider_email?: string;
  provider_data?: Record<string, unknown>;
  display_name?: string;
  avatar_url?: string;
  link_status: 'active' | 'inactive' | 'pending' | 'error';
  linked_at: string;
  last_used_at?: string;
  is_primary_provider: boolean;
  auto_login_enabled: boolean;
}

// API Request/Response Types
export interface SignupRequest {
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  family_invitation_token?: string;
}

export interface SignupResponse {
  user: AuthUser;
  session: unknown;
  message?: string;
}

export interface LoginRequest {
  email: string;
  device_info?: {
    device_id?: string;
    device_name?: string;
    device_type?: string;
    platform?: string;
    browser_name?: string;
  };
}

export interface LoginResponse {
  user: AuthUser;
  session: unknown;
  profile?: UserProfile;
  families?: Array<Family & { family_members: FamilyMember[] }>;
}

// Password-related interfaces removed - going passwordless

export interface VerifyEmailRequest {
  token: string;
  type?: 'signup' | 'email_change';
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface SocialAuthRequest {
  provider: string;
  code?: string;
  state?: string;
  redirect_uri?: string;
}

// Error Types
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AuthError;
  message?: string;
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retry_after?: number;
}

// Security Types
export interface SecurityContext {
  ip_address: string;
  user_agent: string;
  device_fingerprint?: string;
  risk_score?: number;
  requires_mfa?: boolean;
  is_trusted_device?: boolean;
}