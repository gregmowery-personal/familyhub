"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import EmailVerificationPage from '@/components/auth/EmailVerificationPage';
import LoadingSpinner from '@/components/LoadingSpinner';
import Logo from '@/components/Logo';

function VerifyEmailContent() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get email from URL params or sessionStorage
    const emailParam = searchParams.get('email');
    const storedEmail = sessionStorage.getItem('verification_email');
    
    if (emailParam) {
      setEmail(emailParam);
      sessionStorage.setItem('verification_email', emailParam);
    } else if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // No email found, redirect to signup
      router.push('/auth?mode=signup');
      return;
    }
    
    setLoading(false);
  }, [searchParams, router]);

  const handleSuccess = () => {
    // Clean up stored email
    sessionStorage.removeItem('verification_email');
    
    // Show success and redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  };

  const handleError = (error: string) => {
    console.error('Verification error:', error);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo showTagline={false} />
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center space-y-6">
              <LoadingSpinner size="lg" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-800">
                  Loading...
                </h2>
                <p className="text-slate-600">
                  Preparing your verification page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo showTagline={false} />
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-800">
                  No Email to Verify
                </h2>
                <p className="text-slate-600">
                  It looks like you don&apos;t have a verification code waiting. 
                  Let&apos;s start by creating your account.
                </p>
                <button
                  onClick={() => router.push('/auth?mode=signup')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmailVerificationPage
      email={email}
      onSuccess={handleSuccess}
      onError={handleError}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo showTagline={false} />
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <div className="text-center space-y-6">
              <LoadingSpinner size="lg" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-800">
                  Loading...
                </h2>
                <p className="text-slate-600">
                  Preparing your verification page.
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