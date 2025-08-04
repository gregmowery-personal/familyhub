import { z } from 'zod';

// Email validation schema
export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(255, 'Email address is too long')
  .toLowerCase()
  .trim();

// Password validation schema
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password is too long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

// Phone number validation schema
export const phoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
  .optional();

// Name validation schema
export const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(50, 'Name is too long')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

// Device info validation schema
export const deviceInfoSchema = z.object({
  device_id: z.string().optional(),
  device_name: z.string().max(100).optional(),
  device_type: z.enum(['mobile', 'tablet', 'desktop', 'web']).optional(),
  platform: z.string().max(50).optional(),
  browser_name: z.string().max(50).optional(),
}).optional();

// Signup validation schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  phone_number: phoneSchema,
  family_invitation_token: z.string().uuid().optional(),
});

// Login validation schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  device_info: deviceInfoSchema,
});

// Forgot password validation schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
  redirect_url: z.string().url().optional(),
});

// Reset password validation schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});

// Verify email validation schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  type: z.enum(['signup', 'email_change']).optional(),
});

// Refresh token validation schema
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// Social auth validation schema
export const socialAuthSchema = z.object({
  provider: z.enum(['google', 'apple', 'facebook', 'microsoft', 'github', 'twitter', 'linkedin']),
  code: z.string().optional(),
  state: z.string().optional(),
  redirect_uri: z.string().url().optional(),
});

// Security context validation schema
export const securityContextSchema = z.object({
  ip_address: z.string().min(1, 'IP address is required'),
  user_agent: z.string().max(1000),
  device_fingerprint: z.string().optional(),
  risk_score: z.number().min(0).max(100).optional(),
  requires_mfa: z.boolean().optional(),
  is_trusted_device: z.boolean().optional(),
});

// Family role validation schema
export const familyRoleSchema = z.enum(['admin', 'adult', 'teen', 'child', 'senior']);

// Access level validation schema
export const accessLevelSchema = z.enum(['full', 'limited', 'view_only']);

// Interface complexity validation schema
export const interfaceComplexitySchema = z.enum(['full', 'simplified', 'child_friendly']);

// Family type validation schema
export const familyTypeSchema = z.enum(['nuclear', 'single_parent', 'blended', 'multigenerational', 'extended']);

// Timezone validation schema
export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid timezone' }
);

// User profile validation schema
export const userProfileSchema = z.object({
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  display_name: z.string().max(100).optional(),
  phone_number: phoneSchema,
  profile_image_url: z.string().url().optional(),
  preferred_language: z.string().min(2).max(2).optional(),
  timezone: timezoneSchema.optional(),
  notification_preferences: z.record(z.string(), z.any()).optional(),
  accessibility_preferences: z.record(z.string(), z.any()).optional(),
});

// Family creation validation schema
export const familyCreationSchema = z.object({
  name: z.string().min(1, 'Family name is required').max(100, 'Family name is too long').trim(),
  family_type: familyTypeSchema.optional(),
  timezone: timezoneSchema.optional(),
});

// Family member invitation validation schema
export const familyInvitationSchema = z.object({
  family_id: z.string().uuid('Invalid family ID'),
  invited_email: emailSchema,
  invited_role: familyRoleSchema.optional(),
  relationship: z.string().max(50).optional(),
  invitation_message: z.string().max(500).optional(),
});

// Token validation schema
export const tokenSchema = z.object({
  token_type: z.enum(['password_reset', 'email_verification', 'family_invitation', 'magic_link', 'mfa_backup', 'account_verification', 'session_challenge']),
  expires_at: z.string().datetime(),
  max_uses: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Rate limiting validation schema
export const rateLimitSchema = z.object({
  limit: z.number().int().positive(),
  window: z.number().int().positive(), // in seconds
  key_generator: z.any().optional(), // Function that takes any input and returns string
});

// Audit event validation schema
export const auditEventSchema = z.object({
  event_type: z.string().min(1).max(100),
  event_category: z.string().min(1).max(50),
  event_description: z.string().min(1).max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  actor_user_id: z.string().uuid().optional(),
  target_user_id: z.string().uuid().optional(),
  target_family_id: z.string().uuid().optional(),
  event_data: z.record(z.string(), z.any()).optional(),
  success: z.boolean().optional(),
  risk_score: z.number().min(0).max(100).optional(),
  is_anomalous: z.boolean().optional(),
});

// Export all validation types
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
export type SecurityContextInput = z.infer<typeof securityContextSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type FamilyCreationInput = z.infer<typeof familyCreationSchema>;
export type FamilyInvitationInput = z.infer<typeof familyInvitationSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type RateLimitInput = z.infer<typeof rateLimitSchema>;
export type AuditEventInput = z.infer<typeof auditEventSchema>;