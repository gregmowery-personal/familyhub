"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AuthService } from '@/lib/auth-service';
import LoadingSpinner from '@/components/LoadingSpinner';
import AlertMessage from '@/components/AlertMessage';

function AuthCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const provider = searchParams.get('provider') || 'google'; // Default to google
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          setError(errorDescription || error || 'Authentication failed');
          setStatus('error');
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setStatus('error');
          return;
        }

        console.log('Processing social auth callback...', { provider, code: code.substring(0, 10) + '...' });

        // Exchange code for session
        const result = await AuthService.handleSocialCallback(provider, code, state || undefined);

        if (result.success) {
          setStatus('success');
          
          // Get redirect URL from session storage
          const redirectUrl = sessionStorage.getItem('familyhub_redirect_after_login') || '/dashboard';
          sessionStorage.removeItem('familyhub_redirect_after_login');
          
          // Small delay to show success state
          setTimeout(() => {
            router.push(redirectUrl);
          }, 1000);
        } else {
          console.error('Social auth failed:', result.error);
          setError(result.error?.message || 'Authentication failed');
          setStatus('error');
        }
      } catch (err) {
        console.error('Callback handling error:', err);
        setError('An unexpected error occurred during authentication');
        setStatus('error');
      }
    };

    // Only handle callback if not already authenticated
    if (!isAuthenticated) {
      handleCallback();
    } else {
      // Already authenticated, redirect to dashboard
      router.push('/dashboard');
    }
  }, [searchParams, router, isAuthenticated]);

  const handleRetry = () => {
    router.push('/auth');
  };

  const getStatusContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center space-y-6">
            <LoadingSpinner size="lg" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-base-content">
                Completing sign in...
              </h2>
              <p className="text-base-content/70">
                Please wait while we complete your authentication.
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-success/20 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-success" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-base-content">
                Welcome to FamilyHub!
              </h2>
              <p className="text-base-content/70">
                You&apos;ve been successfully signed in. Redirecting to your dashboard...
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-error/20 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-error" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-base-content">
                Authentication Failed
              </h2>
              <AlertMessage
                type="error"
                message={error}
                className="text-left"
              />
              <button
                onClick={handleRetry}
                className="btn btn-primary"
                aria-label="Return to sign in page"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-base-100 rounded-lg shadow-xl p-8">
          {getStatusContent()}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-base-100 rounded-lg shadow-xl p-8">
            <div className="text-center space-y-6">
              <LoadingSpinner size="lg" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-base-content">
                  Loading...
                </h2>
                <p className="text-base-content/70">
                  Please wait while we load the authentication page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}