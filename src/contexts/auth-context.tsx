"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthService } from '@/lib/auth-service';
import { AuthUser, UserProfile, Family, FamilyMember, UserSession } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  // State
  user: AuthUser | null;
  profile: UserProfile | null;
  families: Array<Family & { family_members: FamilyMember[] }> | null;
  session: Session | null;
  sessionInfo: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signIn: (email: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signUp: (userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    acceptTerms: boolean;
    subscribeNewsletter?: boolean;
  }) => Promise<{ success: boolean; error?: string; recovery_code?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [families, setFamilies] = useState<Array<Family & { family_members: FamilyMember[] }> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionInfo, setSessionInfo] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiryWarning, setSessionExpiryWarning] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  const isAuthenticated = Boolean(user && session);

  // Clear all auth state
  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setFamilies(null);
    setSession(null);
    setSessionInfo(null);
  }, []);

  // Initialize auth state from Supabase
  const initializeAuth = useCallback(async () => {
    try {
      // Use getUser() for security - it verifies the token with Supabase Auth server
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Only get session after confirming user is authenticated
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
        }
        
        // Get additional user data from our API
        const sessionResponse = await AuthService.getSession();
        if (sessionResponse.success && sessionResponse.data) {
          setUser(sessionResponse.data.user);
          setProfile(sessionResponse.data.profile || null);
          setFamilies(sessionResponse.data.families || []);
        } else {
          // Fallback to basic Supabase user data
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            phone: currentSession.user.phone,
            email_confirmed_at: currentSession.user.email_confirmed_at,
            phone_confirmed_at: currentSession.user.phone_confirmed_at,
            created_at: currentSession.user.created_at,
            updated_at: currentSession.user.updated_at || '',
          });
        }
      } else {
        clearAuthState();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth, clearAuthState]);

  // Sign in function - passwordless
  const signIn = useCallback(async (
    email: string, 
    rememberMe = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const securityContext = null; // Would come from getSecurityContext in production
      
      const response = await AuthService.login({
        email,
        device_info: {
          device_type: 'web',
          browser_name: navigator.userAgent.split(' ').slice(-1)[0] || 'Unknown',
          device_name: `${navigator.platform} - ${navigator.userAgent.split(' ').slice(-1)[0]}`,
        },
      });

      if (response.success && response.data) {
        // Update auth state
        setUser(response.data.user);
        setProfile(response.data.profile || null);
        setFamilies(response.data.families || []);
        
        // Set session if provided
        if (response.data.session) {
          const sessionData = response.data.session as { access_token: string; refresh_token: string };
          const { data: { session } } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });
          setSession(session);
        }

        // Handle remember me - extends session to 7 days
        if (rememberMe) {
          localStorage.setItem('familyhub_remember_me', 'true');
          
          // Create extended session record
          const { error: extensionError } = await supabase
            .from('session_extensions')
            .insert({
              user_id: response.data.user.id,
              session_token: sessionData.access_token,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
              ip_address: securityContext?.ip_address,
              user_agent: navigator.userAgent,
              is_trusted_device: true,
            });
            
          if (extensionError) {
            console.error('Failed to create session extension:', extensionError);
          }
        } else {
          localStorage.removeItem('familyhub_remember_me');
        }

        return { success: true };
      } else {
        return { 
          success: false, 
          error: response.error?.message || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  }, [supabase.auth]);

  // Sign up function
  const signUp = useCallback(async (userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    acceptTerms: boolean;
    subscribeNewsletter?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await AuthService.signup({
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone_number: userData.phoneNumber,
      });

      if (response.success && response.data) {
        // Update auth state with new user
        setUser(response.data.user);
        
        // Set session if provided (for immediate login after signup)
        if (response.data.session) {
          const sessionData = response.data.session as { access_token: string; refresh_token: string };
          const { data: { session } } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          });
          setSession(session);
        }

        return { 
          success: true,
          recovery_code: response.data.recovery_code // Pass recovery code through
        };
      } else {
        return { 
          success: false, 
          error: response.error?.message || 'Signup failed' 
        };
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  }, [supabase.auth]);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      // Call API logout
      await AuthService.logout();
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear local state
      clearAuthState();
      
      // Clear remember me
      localStorage.removeItem('familyhub_remember_me');
      
      // Redirect to auth page
      router.push('/auth');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if API call fails, clear local state
      clearAuthState();
      router.push('/auth');
    }
  }, [supabase.auth, clearAuthState, router]);


  // Refresh session function
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: newSession } } = await supabase.auth.refreshSession();
      
      if (newSession) {
        setSession(newSession);
        
        // Get updated user data
        const sessionResponse = await AuthService.getSession();
        if (sessionResponse.success && sessionResponse.data) {
          setUser(sessionResponse.data.user);
          setProfile(sessionResponse.data.profile || null);
          setFamilies(sessionResponse.data.families || []);
        }
      }
    } catch (error) {
      console.error('Refresh session error:', error);
      // If refresh fails, sign out
      await signOut();
    }
  }, [supabase.auth, signOut]);

  // Clear error function (placeholder for future error state)
  const clearError = useCallback(() => {
    // Implementation for clearing error state if needed
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          clearAuthState();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          
          // Get additional user data
          const sessionResponse = await AuthService.getSession();
          if (sessionResponse.success && sessionResponse.data) {
            setUser(sessionResponse.data.user);
            setProfile(sessionResponse.data.profile || null);
            setFamilies(sessionResponse.data.families || []);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, clearAuthState]);

  // Session management with 48-hour expiry and warnings
  useEffect(() => {
    if (!session) return;

    const now = Date.now();
    const rememberMe = localStorage.getItem('familyhub_remember_me') === 'true';
    
    // Check for extended session if Remember Me is enabled
    const sessionDuration = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000; // 7 days or 48 hours
    const expiryTime = session.expires_at! * 1000;
    const warningTime = expiryTime - (10 * 60 * 1000); // 10 minutes before expiry
    const refreshTime = expiryTime - (5 * 60 * 1000); // 5 minutes before expiry
    
    // If session is already expired
    if (expiryTime <= now) {
      console.log('Session expired');
      setSessionExpiryWarning(true);
      return;
    }

    // Set up warning notification
    const warningTimeout = setTimeout(() => {
      setSessionExpiryWarning(true);
    }, Math.max(0, warningTime - now));

    // Set up auto-refresh for Remember Me users
    if (rememberMe && refreshTime > now) {
      const refreshTimeout = setTimeout(() => {
        refreshSession();
      }, refreshTime - now);

      return () => {
        clearTimeout(warningTimeout);
        clearTimeout(refreshTimeout);
      };
    }

    // Set up session expiry
    const expiryTimeout = setTimeout(() => {
      if (!rememberMe) {
        setSessionExpiryWarning(true);
      }
    }, Math.max(0, expiryTime - now));

    return () => {
      clearTimeout(warningTimeout);
      clearTimeout(expiryTimeout);
    };
  }, [session, refreshSession]);

  const value: AuthContextType = {
    user,
    profile,
    families,
    session,
    sessionInfo,
    isLoading,
    isAuthenticated,
    sessionExpiryWarning,
    signIn,
    signUp,
    signOut,
    refreshSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}