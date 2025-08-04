'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import LoginPageRedesign from '@/components/LoginPageRedesign';
import ForgotPasswordPageRedesign from '@/components/ForgotPasswordPageRedesign';

// Dynamic metadata based on mode would be handled server-side
// For now, we'll use a general auth page metadata

function AuthPageContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'forgot-password'>('login');

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'forgot-password') {
      setMode('forgot-password');
    } else {
      setMode('login');
    }
  }, [searchParams]);

  if (mode === 'forgot-password') {
    return <ForgotPasswordPageRedesign />;
  }

  return <LoginPageRedesign />;
}

export default function AuthPageRoute() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}