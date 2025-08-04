import { createClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
// Database type not used in current implementation
// import { Database } from '@/types/database';
import { AuthUser, UserProfile, SecurityContext } from '@/types/auth';
import { headers } from 'next/headers';
import crypto from 'crypto';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public limit: number,
    public remaining: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Get current authenticated user from server-side
 */
export async function getServerUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user as AuthUser;
  } catch (error) {
    console.error('Error getting server user:', error);
    return null;
  }
}

/**
 * Get current authenticated user from client-side
 */
export async function getBrowserUser(): Promise<AuthUser | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user as AuthUser;
  } catch (error) {
    console.error('Error getting browser user:', error);
    return null;
  }
}

/**
 * Get user profile with family information
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Get user's families with roles
 */
export async function getUserFamilies(userId: string) {
  try {
    const supabase = await createClient();
    
    const { data: families, error } = await supabase
      .rpc('get_user_families', { user_id: userId });

    if (error) {
      console.error('Error getting user families:', error);
      return [];
    }

    return families || [];
  } catch (error) {
    console.error('Error getting user families:', error);
    return [];
  }
}

/**
 * Check if user is family admin
 */
export async function isUserFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    const { data: isAdmin, error } = await supabase
      .rpc('is_family_admin', { user_id: userId, family_id: familyId });

    if (error) {
      console.error('Error checking family admin status:', error);
      return false;
    }

    return isAdmin || false;
  } catch (error) {
    console.error('Error checking family admin status:', error);
    return false;
  }
}

/**
 * Generate secure token hash
 */
export function generateTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Get security context from request headers
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  const headersList = await headers();
  
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  
  const userAgent = headersList.get('user-agent') || 'unknown';
  
  return {
    ip_address: ip,
    user_agent: userAgent,
  };
}

/**
 * Generate device fingerprint from request
 */
export function generateDeviceFingerprint(
  userAgent: string,
  acceptLanguage?: string,
  acceptEncoding?: string
): string {
  const data = [userAgent, acceptLanguage, acceptEncoding].join('|');
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Validate token format
 */
export function isValidTokenFormat(token: string): boolean {
  // Check if token is hex string of appropriate length
  return /^[a-fA-F0-9]{64}$/.test(token);
}

/**
 * Calculate password strength score
 */
export function calculatePasswordStrength(password: string): number {
  let score = 0;
  
  // Length
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character types
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  // Complexity
  if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(password)) score += 1;
  if (/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(password)) score += 1;
  
  return Math.min(score, 10);
}

/**
 * Check if email domain is disposable
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com',
    'tempmail.org',
    'guerrillamail.com',
    'mailinator.com',
    'throwaway.email',
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.includes(domain);
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Validate and sanitize phone number
 */
export function sanitizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with + if it doesn't already
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Create user session record
 */
export async function createUserSession(
  userId: string,
  sessionToken: string,
  deviceInfo?: {
    device_id?: string;
    device_name?: string;
    device_type?: string;
    platform?: string;
    browser_name?: string;
  },
  securityContext?: SecurityContext
): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data: sessionId, error } = await supabase
      .rpc('create_user_session', {
        user_id: userId,
        session_token: sessionToken,
        device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
        ip_address: securityContext?.ip_address,
        user_agent: securityContext?.user_agent,
      });

    if (error) {
      console.error('Error creating user session:', error);
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('Error creating user session:', error);
    return null;
  }
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  eventType: string,
  eventCategory: string,
  eventDescription: string,
  options?: {
    actorUserId?: string;
    targetUserId?: string;
    targetFamilyId?: string;
    eventData?: Record<string, unknown>;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    success?: boolean;
    securityContext?: SecurityContext;
  }
): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase.rpc('log_audit_event', {
      event_type: eventType,
      event_category: eventCategory,
      event_description: eventDescription,
      actor_user_id: options?.actorUserId,
      target_user_id: options?.targetUserId,
      target_family_id: options?.targetFamilyId,
      event_data: options?.eventData ? JSON.stringify(options.eventData) : null,
      severity: options?.severity || 'medium',
      success: options?.success ?? true,
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw error for audit logging failures
  }
}

/**
 * Generate magic link token
 */
export async function generateMagicLinkToken(
  email: string,
  redirectUrl?: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const token = generateSecureToken();
    const tokenHash = generateTokenHash(token);
    
    const { error } = await supabase
      .from('auth_tokens')
      .insert({
        token_hash: tokenHash,
        token_type: 'magic_link',
        email: sanitizeEmail(email),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        max_uses: 1,
        metadata: redirectUrl ? { redirect_url: redirectUrl } : null,
      });

    if (error) {
      console.error('Error creating magic link token:', error);
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error generating magic link token:', error);
    return null;
  }
}

/**
 * Verify and consume token
 */
export async function verifyAndConsumeToken(
  token: string,
  tokenType: string
): Promise<{ valid: boolean; data?: unknown; error?: string }> {
  try {
    const supabase = await createClient();
    const tokenHash = generateTokenHash(token);
    
    // Get token
    const { data: tokenData, error: fetchError } = await supabase
      .from('auth_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('token_type', tokenType)
      .eq('token_status', 'active')
      .single();

    if (fetchError || !tokenData) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      await supabase
        .from('auth_tokens')
        .update({ token_status: 'expired' })
        .eq('id', tokenData.id);
      
      return { valid: false, error: 'Token has expired' };
    }

    // Check usage limit
    if (tokenData.uses_count >= tokenData.max_uses) {
      return { valid: false, error: 'Token has been used too many times' };
    }

    // Update usage count
    const newUsesCount = tokenData.uses_count + 1;
    const newStatus = newUsesCount >= tokenData.max_uses ? 'used' : 'active';

    const { error: updateError } = await supabase
      .from('auth_tokens')
      .update({
        uses_count: newUsesCount,
        token_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    if (updateError) {
      console.error('Error updating token usage:', updateError);
      return { valid: false, error: 'Failed to process token' };
    }

    return { valid: true, data: tokenData };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { valid: false, error: 'Failed to verify token' };
  }
}

/**
 * Cleanup expired sessions and tokens
 */
export async function cleanupExpiredData(): Promise<void> {
  try {
    const supabase = await createClient();
    
    // This would typically be called by a cron job
    // The actual cleanup is handled by the database function
    await supabase.rpc('cleanup_expired_data');
  } catch (error) {
    console.error('Error cleaning up expired data:', error);
  }
}