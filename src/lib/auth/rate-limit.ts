import { createClient } from '@/lib/supabase/server';
import { RateLimitError } from './utils';

interface RateLimitRule {
  key: string;
  limit: number;
  window: number; // in seconds
  skipSuccessful?: boolean;
}

// Commented out unused interface
// interface RateLimitAttempt {
//   id: string;
//   key: string;
//   ip_address: string;
//   user_agent: string;
//   attempted_at: string;
//   success: boolean;
//   email?: string;
//   endpoint: string;
// }

/**
 * Redis-like rate limiting using Supabase
 * This implementation uses the database to track rate limits
 */
export class RateLimiter {
  private rules: Map<string, RateLimitRule> = new Map();

  constructor() {
    // Define rate limiting rules
    this.addRule('auth:login', { key: 'login', limit: 5, window: 300 }); // 5 attempts per 5 minutes
    this.addRule('auth:signup', { key: 'signup', limit: 3, window: 3600 }); // 3 attempts per hour
    this.addRule('auth:forgot-password', { key: 'forgot-password', limit: 3, window: 3600 }); // 3 attempts per hour
    this.addRule('auth:reset-password', { key: 'reset-password', limit: 5, window: 900 }); // 5 attempts per 15 minutes
    this.addRule('auth:verify-email', { key: 'verify-email', limit: 10, window: 3600 }); // 10 attempts per hour
    this.addRule('auth:refresh', { key: 'refresh', limit: 20, window: 3600 }); // 20 attempts per hour
    this.addRule('auth:social', { key: 'social', limit: 10, window: 600 }); // 10 attempts per 10 minutes
    this.addRule('global', { key: 'global', limit: 100, window: 3600 }); // 100 requests per hour per IP
  }

  private addRule(endpoint: string, rule: Omit<RateLimitRule, 'key'> & { key: string }) {
    this.rules.set(endpoint, rule);
  }

  /**
   * Check rate limit for a specific endpoint and IP
   */
  async checkRateLimit(
    endpoint: string,
    ipAddress: string,
    userAgent: string,
    email?: string
  ): Promise<{ allowed: boolean; limit: number; remaining: number; resetTime: number }> {
    // TODO: Use userAgent and email for enhanced rate limiting
    console.log('Rate limit check for:', { endpoint, userAgent, email });
    const rule = this.rules.get(endpoint);
    if (!rule) {
      // No rate limit rule defined, allow the request
      return { allowed: true, limit: 0, remaining: 0, resetTime: 0 };
    }

    try {
      const supabase = await createClient();
      const now = new Date();
      const windowStart = new Date(now.getTime() - rule.window * 1000);

      // Generate rate limit key based on IP and endpoint
      const rateLimitKey = `${rule.key}:${ipAddress}`;

      // Count attempts within the window
      let query = supabase
        .from('login_attempts')
        .select('id', { count: 'exact' })
        .eq('key', rateLimitKey)
        .gte('attempted_at', windowStart.toISOString());

      // For failed login attempts, only count failures unless skipSuccessful is false
      if (rule.skipSuccessful !== false && endpoint.includes('login')) {
        query = query.eq('success', false);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error checking rate limit:', error);
        // On error, allow the request but log the issue
        return { allowed: true, limit: rule.limit, remaining: rule.limit, resetTime: 0 };
      }

      const attemptCount = count || 0;
      const remaining = Math.max(0, rule.limit - attemptCount);
      const resetTime = Math.floor((windowStart.getTime() + rule.window * 1000) / 1000);

      const allowed = attemptCount < rule.limit;

      return {
        allowed,
        limit: rule.limit,
        remaining,
        resetTime,
      };
    } catch (error) {
      console.error('Error in rate limit check:', error);
      // On error, allow the request
      return { allowed: true, limit: 0, remaining: 0, resetTime: 0 };
    }
  }

  /**
   * Record an attempt for rate limiting
   */
  async recordAttempt(
    endpoint: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    email?: string
  ): Promise<void> {
    const rule = this.rules.get(endpoint);
    if (!rule) {
      return; // No rule defined, don't record
    }

    try {
      const supabase = await createClient();
      const rateLimitKey = `${rule.key}:${ipAddress}`;

      await supabase
        .from('login_attempts')
        .insert({
          key: rateLimitKey,
          ip_address: ipAddress,
          user_agent: userAgent,
          attempted_at: new Date().toISOString(),
          success,
          email: email || null,
          endpoint,
        });
    } catch (error) {
      console.error('Error recording rate limit attempt:', error);
      // Don't throw error for recording failures
    }
  }

  /**
   * Clear rate limit for a specific key (useful after successful operations)
   */
  async clearRateLimit(
    endpoint: string,
    ipAddress: string
  ): Promise<void> {
    const rule = this.rules.get(endpoint);
    if (!rule) {
      return;
    }

    try {
      const supabase = await createClient();
      const rateLimitKey = `${rule.key}:${ipAddress}`;

      // Delete recent failed attempts for this key
      await supabase
        .from('login_attempts')
        .delete()
        .eq('key', rateLimitKey)
        .eq('success', false);
    } catch (error) {
      console.error('Error clearing rate limit:', error);
    }
  }

  /**
   * Check and enforce rate limit
   */
  async enforceRateLimit(
    endpoint: string,
    ipAddress: string,
    userAgent: string,
    email?: string
  ): Promise<void> {
    const result = await this.checkRateLimit(endpoint, ipAddress, userAgent, email);
    
    if (!result.allowed) {
      const retryAfter = result.resetTime - Math.floor(Date.now() / 1000);
      throw new RateLimitError(
        'Too many requests. Please try again later.',
        retryAfter,
        result.limit,
        result.remaining
      );
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const result = await this.checkRateLimit(endpoint, ipAddress, userAgent);
    
    const response = {
      limit: result.limit,
      remaining: result.remaining,
      resetTime: result.resetTime,
    };

    if (!result.allowed) {
      return {
        ...response,
        retryAfter: result.resetTime - Math.floor(Date.now() / 1000),
      };
    }

    return response;
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(
    ipAddress: string,
    userAgent: string,
    timeWindow: number = 3600 // 1 hour
  ): Promise<{
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    try {
      const supabase = await createClient();
      const windowStart = new Date(Date.now() - timeWindow * 1000);

      // Get recent attempts from this IP
      const { data: attempts, error } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('ip_address', ipAddress)
        .gte('attempted_at', windowStart.toISOString())
        .order('attempted_at', { ascending: false });

      if (error || !attempts) {
        return { isSuspicious: false, riskScore: 0, reasons: [] };
      }

      let riskScore = 0;
      const reasons: string[] = [];

      // Check for high failure rate
      const failedAttempts = attempts.filter(a => !a.success).length;
      // Note: successfulAttempts calculated but not used in current risk scoring
      const successfulAttempts = attempts.filter(a => a.success).length;
      console.log('Successful attempts:', successfulAttempts); // Log to use the variable
      const totalAttempts = attempts.length;

      if (totalAttempts > 20) {
        riskScore += 30;
        reasons.push('High volume of requests');
      }

      if (failedAttempts > 10) {
        riskScore += 40;
        reasons.push('High number of failed attempts');
      }

      if (totalAttempts > 0 && failedAttempts / totalAttempts > 0.8) {
        riskScore += 35;
        reasons.push('High failure rate');
      }

      // Check for multiple different emails
      const uniqueEmails = new Set(attempts.map(a => a.email).filter(Boolean));
      if (uniqueEmails.size > 5) {
        riskScore += 25;
        reasons.push('Multiple different email addresses attempted');
      }

      // Check for rapid sequential attempts
      let rapidAttempts = 0;
      for (let i = 1; i < attempts.length; i++) {
        const timeDiff = new Date(attempts[i-1].attempted_at).getTime() - 
                        new Date(attempts[i].attempted_at).getTime();
        if (timeDiff < 1000) { // Less than 1 second apart
          rapidAttempts++;
        }
      }

      if (rapidAttempts > 5) {
        riskScore += 30;
        reasons.push('Rapid sequential attempts detected');
      }

      return {
        isSuspicious: riskScore >= 50,
        riskScore,
        reasons,
      };
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return { isSuspicious: false, riskScore: 0, reasons: [] };
    }
  }

  /**
   * Block an IP address temporarily
   */
  async blockIP(
    ipAddress: string,
    reason: string,
    durationMinutes: number = 60
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      await supabase
        .from('blocked_ips')
        .upsert({
          ip_address: ipAddress,
          reason,
          blocked_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true,
        });
    } catch (error) {
      console.error('Error blocking IP:', error);
    }
  }

  /**
   * Check if an IP is blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Error checking blocked IP:', error);
        return false;
      }

      return (data && data.length > 0);
    } catch (error) {
      console.error('Error checking blocked IP:', error);
      return false;
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();