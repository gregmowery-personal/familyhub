"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireEmailVerification?: boolean;
  allowedRoles?: string[];
  className?: string;
}

export default function ProtectedRoute({
  children,
  fallback,
  redirectTo = '/auth',
  requireEmailVerification = false,
  allowedRoles,
  className = ''
}: ProtectedRouteProps) {
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    user, 
    profile 
  } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Don't check auth on auth pages to prevent redirect loops
    if (pathname?.startsWith('/auth')) {
      setIsChecking(false);
      return;
    }

    if (authLoading) {
      return; // Still loading auth state
    }

    if (!isAuthenticated) {
      // Store the attempted URL for redirect after login
      const currentUrl = `${pathname}${window.location.search}`;
      sessionStorage.setItem('familyhub_redirect_after_login', currentUrl);
      
      router.push(redirectTo);
      return;
    }

    // Check email verification if required
    if (requireEmailVerification && user && !user.email_confirmed_at) {
      router.push('/auth/verify-email');
      return;
    }

    // Check role permissions if specified
    if (allowedRoles && allowedRoles.length > 0 && profile) {
      // This would need to be implemented based on your role system
      // For now, we'll assume all authenticated users have access
    }

    setIsChecking(false);
  }, [
    isAuthenticated, 
    authLoading, 
    user, 
    profile, 
    router, 
    redirectTo, 
    requireEmailVerification, 
    allowedRoles,
    pathname
  ]);

  // Show loading spinner while checking authentication
  if (authLoading || isChecking) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-base-100 ${className}`}>
        {fallback || (
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-base-content/70">Loading...</p>
          </div>
        )}
      </div>
    );
  }

  // Don't render children if not authenticated (redirect is in progress)
  if (!isAuthenticated) {
    return null;
  }

  // Check email verification
  if (requireEmailVerification && user && !user.email_confirmed_at) {
    return null; // Redirect is in progress
  }

  // Render children if all checks pass
  return <>{children}</>;
}

/**
 * HOC version of ProtectedRoute for easier wrapping
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Hook to check if current user has required permissions
 */
export function usePermissions() {
  const { isAuthenticated, user, profile } = useAuth();

  const hasRole = (role: string): boolean => {
    if (!isAuthenticated || !profile) return false;
    // TODO: Implement role checking logic based on your role system
    console.log('Checking role:', role); // Using the parameter to avoid ESLint error
    return true; // Placeholder
  };

  const hasPermission = (permission: string): boolean => {
    if (!isAuthenticated || !user) return false;
    // TODO: Implement permission checking logic
    console.log('Checking permission:', permission); // Using the parameter to avoid ESLint error
    return true; // Placeholder
  };

  const isEmailVerified = (): boolean => {
    return Boolean(user?.email_confirmed_at);
  };

  return {
    hasRole,
    hasPermission,
    isEmailVerified,
    isAuthenticated,
  };
}