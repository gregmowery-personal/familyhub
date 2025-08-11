"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import LoadingButton from '@/components/LoadingButton';
import Logo from '@/components/Logo';

export default function VerifyEmail() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [redirectCount, setRedirectCount] = useState(3);
  const router = useRouter();
  const { user, signOut } = useAuth();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const supabase = createClient();

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle success redirect countdown
  useEffect(() => {
    if (isVerified && redirectCount > 0) {
      const timer = setTimeout(() => {
        if (redirectCount === 1) {
          router.push('/dashboard');
        } else {
          setRedirectCount(redirectCount - 1);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isVerified, redirectCount, router]);

  // Auto-focus first input on mount and get stored email
  useEffect(() => {
    inputRefs.current[0]?.focus();
    
    // Check for stored email from login redirect
    const storedEmail = sessionStorage.getItem('unverified_email');
    if (storedEmail) {
      setUserEmail(storedEmail);
      sessionStorage.removeItem('unverified_email');
    }
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(''); // Clear error on input

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newCode.every(digit => digit)) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 6);
        if (digits) {
          const newCode = digits.split('').concat(Array(6).fill('')).slice(0, 6);
          setCode(newCode);
          
          // Focus last filled input or last input
          const lastFilledIndex = newCode.findLastIndex(d => d !== '');
          const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
          inputRefs.current[focusIndex]?.focus();
          
          // Auto-submit if complete
          if (newCode.every(digit => digit)) {
            handleVerify(newCode.join(''));
          }
        }
      });
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToVerify,
          type: 'signup'
        })
      });

      const data = await response.json();

      if (response.ok) {
        // If session tokens are provided, set them in Supabase client
        if (data.session?.access_token && data.session?.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
          
          if (sessionError) {
            console.error('Failed to set session:', sessionError);
            setError('Verification successful but failed to log in. Please try logging in manually.');
            return;
          }
          
          // Wait for auth state to update
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Success! Show celebration and start countdown
        setIsVerified(true);
        setRedirectCount(3);
      } else {
        setError(data.error || 'Invalid verification code');
        setCode(['', '', '', '', '', '']); // Clear code on error
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    const emailToUse = userEmail || user?.email;
    if (!emailToUse || resendCooldown > 0) return;

    setIsResending(true);
    setError('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse })
      });

      const data = await response.json();

      if (response.ok) {
        setResendCooldown(60); // 60 second cooldown
        setCode(['', '', '', '', '', '']); // Clear code
        inputRefs.current[0]?.focus();
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setError('Failed to resend verification code');
    } finally {
      setIsResending(false);
    }
  };

  // Success screen for verified users
  if (isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-gradient-to-br from-emerald-50 via-white to-purple-50 rounded-3xl shadow-2xl border-2 border-transparent bg-clip-padding">
            <div className="bg-gradient-to-r from-emerald-200 via-purple-200 to-pink-200 p-1 rounded-3xl">
              <div className="bg-white rounded-3xl p-8 sm:p-12">
                <div className="text-center space-y-6">
                  {/* Success Animation Icon */}
                  <div className="relative">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {/* Confetti-like sparkles */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full animate-ping"></div>
                    <div className="absolute -top-1 -right-3 w-4 h-4 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full animate-pulse"></div>
                    <div className="absolute -bottom-2 -left-3 w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="absolute -bottom-1 -right-2 w-3 h-3 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full animate-ping" style={{animationDelay: '0.4s'}}></div>
                  </div>

                  {/* Success Message */}
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4">
                      <span className="bg-gradient-to-r from-emerald-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        🎉 You're all verified!
                      </span>
                    </h1>
                    <h2 className="text-xl font-semibold text-slate-800 mb-3">
                      Welcome to FamilyHub! ✨
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed">
                      Your account is ready and we're excited to help you coordinate with your family.
                    </p>
                  </div>

                  {/* Countdown */}
                  <div className="bg-gradient-to-r from-emerald-100 via-purple-100 to-pink-100 rounded-2xl p-6 border border-emerald-200">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{redirectCount}</span>
                      </div>
                      <p className="text-emerald-800 font-medium">
                        Taking you to your dashboard in {redirectCount} second{redirectCount !== 1 ? 's' : ''}...
                      </p>
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-purple-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                        style={{width: `${((3 - redirectCount) / 3) * 100}%`}}
                      ></div>
                    </div>
                  </div>

                  {/* Trust signals */}
                  <div className="flex items-center justify-center gap-6 text-sm text-slate-600 pt-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span>Family-First</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50 flex items-center justify-center p-4 sm:p-6">
      {/* Skip to main content link for screen readers */}
      <a href="#verification-form" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50">
        Skip to verification form
      </a>
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Logo showTagline={false} />
        </div>

        {/* Progress Indicator */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-purple-100">
          <div className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2 text-emerald-600">
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
              <span>Email Sent</span>
            </div>
            <div className="flex items-center gap-2 text-purple-600">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs animate-pulse">2</div>
              <span>Enter Code</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-white text-xs">3</div>
              <span>Verified!</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1 mt-3">
            <div className="bg-gradient-to-r from-emerald-500 to-purple-500 h-1 rounded-full w-2/3 transition-all duration-300"></div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-gradient-to-br from-white via-purple-50/30 to-emerald-50/30 rounded-3xl shadow-2xl border-2 border-transparent bg-clip-padding">
          <div className="bg-gradient-to-r from-purple-200/50 via-pink-200/50 to-emerald-200/50 p-1 rounded-3xl">
            <div id="verification-form" className="bg-white rounded-3xl p-6 sm:p-8" role="main" aria-labelledby="verification-title">
              <div className="text-center space-y-6">
                {/* Animated Icon */}
                <div className="relative">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-400 via-pink-400 to-emerald-400 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  {/* Magic sparkles */}
                  <div className="absolute -top-1 -right-1 text-2xl animate-bounce" style={{animationDelay: '0.1s'}}>✨</div>
                  <div className="absolute -bottom-1 -left-1 text-xl animate-bounce" style={{animationDelay: '0.3s'}}>💫</div>
                </div>

                {/* Title */}
                <div>
                  <h2 id="verification-title" className="text-3xl font-bold mb-3">
                    <span className="bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                      We've sent a magic code! 📧
                    </span>
                  </h2>
                  <p className="text-lg text-slate-600 mb-2">
                    Almost there! Just 6 digits to go 🎯
                  </p>
                  <div className="bg-gradient-to-r from-purple-100 to-emerald-100 rounded-xl p-3 border border-purple-200">
                    <p className="text-sm text-slate-600">
                      Check your email at:
                    </p>
                    <p className="font-semibold text-slate-800 text-lg">
                      {userEmail || user?.email || 'your email'}
                    </p>
                  </div>
                </div>

                {/* Code Input */}
                <div>
                  <label htmlFor="code-input-0" className="text-lg font-semibold text-slate-700 mb-4 block">
                    Enter your magical 6-digit code ✨
                  </label>
                  <div className="flex justify-center gap-3" role="group" aria-label="Verification code input">
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        id={`code-input-${index}`}
                        ref={el => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        aria-label={`Digit ${index + 1} of 6`}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className={`w-14 h-16 text-center text-2xl font-bold border-2 rounded-2xl transition-all duration-300 transform text-base sm:text-2xl
                          ${digit 
                            ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100 scale-105 shadow-lg' 
                            : 'border-purple-300 bg-gradient-to-br from-white to-purple-50 hover:border-purple-400'
                          }
                          focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 focus:scale-105
                          ${error ? 'border-red-400 bg-gradient-to-br from-red-50 to-pink-50' : ''}
                          ${isVerifying ? 'animate-pulse' : ''}
                        `}
                        disabled={isVerifying}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 mt-3">
                    💡 Tip: You can paste all 6 digits at once!
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-4" role="alert" aria-live="assertive">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-red-800 font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Verify Button */}
                <LoadingButton
                  onClick={() => handleVerify()}
                  loading={isVerifying}
                  disabled={!code.every(digit => digit) || isVerifying}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-500 hover:from-purple-700 hover:via-pink-600 hover:to-emerald-600 text-white font-semibold text-lg rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {isVerifying ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying your magic code...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>✨ Verify & Continue</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </LoadingButton>

                {/* Help Section */}
                <div className="bg-gradient-to-r from-slate-50 to-purple-50 rounded-2xl p-6 border border-purple-100">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="text-xl">🤔</span>
                    Didn't receive the email?
                  </h3>
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="text-purple-500">📁</span>
                      <span>Check your spam/junk folder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500">⏰</span>
                      <span>Wait 2 minutes for delivery</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-pink-500">📧</span>
                      <span>Make sure {userEmail || user?.email || 'your email'} is correct</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-purple-100">
                    <button
                      onClick={handleResend}
                      disabled={isResending || resendCooldown > 0}
                      className="w-full py-3 bg-gradient-to-r from-purple-100 to-emerald-100 hover:from-purple-200 hover:to-emerald-200 text-purple-700 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-200"
                      aria-live="polite"
                      aria-label={resendCooldown > 0 ? `Resend available in ${resendCooldown} seconds` : 'Resend verification code'}
                    >
                      {resendCooldown > 0 
                        ? `🔄 Resend in ${resendCooldown}s` 
                        : isResending 
                          ? '📤 Sending magic code...' 
                          : '📨 Send me a new code'
                      }
                    </button>
                  </div>
                </div>

                {/* Sign Out Option */}
                <button
                  onClick={signOut}
                  className="text-sm text-slate-500 hover:text-slate-700 p-2 -m-2 rounded-lg hover:bg-slate-50 transition-all duration-200"
                  aria-label="Sign out and return to login"
                >
                  ← Sign out and try different email
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-purple-100" role="complementary">
          <div className="flex items-center justify-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <span className="text-amber-500">⏰</span>
              <span>Code expires in 15 minutes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-purple-500">🛡️</span>
              <span>Secure & private</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}