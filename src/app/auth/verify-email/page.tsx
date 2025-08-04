"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AuthService } from '@/lib/auth-service';
import LoadingSpinner from '@/components/LoadingSpinner';
import LoadingButton from '@/components/LoadingButton';
import AlertMessage from '@/components/AlertMessage';
import Logo from '@/components/Logo';

function VerifyEmailContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending');
  const [error, setError] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();

  const token = searchParams.get('token');
  const type = searchParams.get('type') || 'signup';

  const verifyEmailCallback = React.useCallback(async (verificationToken: string, verificationType: string) => {
    setStatus('loading');
    setError('');

    try {
      const result = await AuthService.verifyEmail(verificationToken, verificationType);

      if (result.success) {
        setStatus('success');
        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } else {
        setStatus('error');
        setError(result.error?.message || 'Email verification failed');
      }
    } catch (err) {
      console.error('Email verification error:', err);
      setStatus('error');
      setError('An unexpected error occurred during verification');
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      verifyEmailCallback(token, type);
    }
  }, [token, type, verifyEmailCallback]);


  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResending(true);
    setError('');

    try {
      // Note: You might need to add a resend verification endpoint
      const result = await AuthService.forgotPassword({ email: user.email });
      
      if (result.success) {
        setError('');
        // Show success message
        alert('Verification email has been resent. Please check your inbox.');
      } else {
        setError(result.error?.message || 'Failed to resend verification email');
      }
    } catch (err) {
      console.error('Resend verification error:', err);
      setError('An unexpected error occurred while resending verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getStatusContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center space-y-6">
            <LoadingSpinner size="lg" />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-base-content">
                Verifying your email...
              </h2>
              <p className="text-base-content/70">
                Please wait while we verify your email address.
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
                Email Verified Successfully!
              </h2>
              <p className="text-base-content/70">
                Your email address has been verified. Redirecting to your dashboard...
              </p>
            </div>
            <LoadingSpinner size="sm" />
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
                Verification Failed
              </h2>
              <AlertMessage
                type="error"
                message={error}
                className="text-left"
              />
              <div className="space-y-3">
                <LoadingButton
                  onClick={handleResendVerification}
                  loading={isResending}
                  loadingText="Sending..."
                  className="btn btn-primary w-full"
                  aria-label="Resend verification email"
                >
                  Resend Verification Email
                </LoadingButton>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn btn-ghost w-full"
                  aria-label="Continue to dashboard"
                >
                  Continue to Dashboard
                </button>
              </div>
            </div>
          </div>
        );

      case 'pending':
      default:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-warning/20 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-warning" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-base-content">
                Email Verification Required
              </h2>
              <div className="space-y-2">
                <p className="text-base-content/70">
                  Please check your email and click the verification link to complete your account setup.
                </p>
                {user?.email && (
                  <p className="text-sm text-base-content/60">
                    We sent a verification email to: <strong>{user.email}</strong>
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <LoadingButton
                  onClick={handleResendVerification}
                  loading={isResending}
                  loadingText="Sending..."
                  className="btn btn-primary w-full"
                  aria-label="Resend verification email"
                >
                  Resend Verification Email
                </LoadingButton>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn btn-ghost w-full"
                  aria-label="Continue to dashboard"
                >
                  Continue to Dashboard
                </button>
                <button
                  onClick={handleSignOut}
                  className="btn btn-ghost btn-sm w-full text-base-content/60"
                  aria-label="Sign out"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Logo showTagline={false} />
        </div>

        {/* Content */}
        <div className="bg-base-100 rounded-lg shadow-xl p-8">
          {getStatusContent()}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-neutral-500">
          <p>
            Didn&apos;t receive the email? Check your spam folder or contact support.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo showTagline={false} />
          </div>
          <div className="bg-base-100 rounded-lg shadow-xl p-8">
            <div className="text-center space-y-6">
              <LoadingSpinner size="lg" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-base-content">
                  Loading...
                </h2>
                <p className="text-base-content/70">
                  Please wait while we load the email verification page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}