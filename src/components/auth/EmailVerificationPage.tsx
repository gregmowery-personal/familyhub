"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingButton from '@/components/LoadingButton';
import Logo from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';

interface EmailVerificationPageProps {
  email: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function EmailVerificationPage({ 
  email, 
  onSuccess, 
  onError 
}: EmailVerificationPageProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const supabase = createClient();
  const { refreshSession } = useAuth();

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(''); // Clear error on input
    setSuccess(''); // Clear success on new input

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
      }).catch(() => {
        // Clipboard access failed, ignore silently
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
    setSuccess('');

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
        setSuccess('Email verified successfully! Welcome to FamilyHub! 🌟');
        
        // If the API returned session data, set it in Supabase
        if (data.session?.access_token && data.session?.refresh_token) {
          try {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            
            if (!sessionError) {
              console.log('✅ User session established after email verification');
              // Refresh the auth context to get updated user data
              await refreshSession();
            } else {
              console.error('Failed to set session after verification:', sessionError);
            }
          } catch (sessionError) {
            console.error('Failed to set session after verification:', sessionError);
          }
        } else {
          // If no session data returned, just refresh the auth context
          console.log('No session data returned, refreshing auth context...');
          await refreshSession();
        }
        
        // Celebrate success
        if (onSuccess) {
          onSuccess();
        } else {
          // Default: redirect to dashboard after celebration
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      } else {
        const errorMessage = data.error || 'Invalid verification code';
        setError(errorMessage);
        setCode(['', '', '', '', '', '']); // Clear code on error
        inputRefs.current[0]?.focus();
        
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = 'A shadow has passed over the realm. Please try again.';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;

    setIsResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setResendCooldown(60); // 60 second cooldown
        setCode(['', '', '', '', '', '']); // Clear code
        inputRefs.current[0]?.focus();
        
        // Show brief success message
        setSuccess('New code sent! Check your email.');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to resend verification code');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setError('Failed to resend verification code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Logo showTagline={false} />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 p-12">
          <div className="text-center space-y-8">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  ✓
                </div>
                <div className="w-12 h-0.5 bg-emerald-200"></div>
                <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
              </div>
              <div className="ml-4 text-sm text-slate-600">Step 2 of 2</div>
            </div>

            {/* Icon */}
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center">
              <svg 
                className="w-10 h-10 text-emerald-700" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                />
              </svg>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-4">
                Check your email
              </h1>
              <p className="text-slate-600 mb-2">
                We sent a 6-digit verification code to:
              </p>
              <p className="font-semibold text-emerald-700 text-lg">
                {email}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                This helps keep your family&apos;s information secure.
              </p>
            </div>

            {/* Code Input */}
            <div>
              <p className="text-slate-700 font-medium mb-6">Enter your verification code:</p>
              <div className="flex justify-center gap-3 mb-6">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`w-14 h-16 text-center text-2xl font-bold border-2 rounded-xl transition-all
                      ${digit ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white'}
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                      ${error ? 'border-red-300 bg-red-50' : ''}
                      ${success ? 'border-green-500 bg-green-50' : ''}
                    `}
                    disabled={isVerifying || !!success}
                    aria-label={`Digit ${index + 1} of verification code`}
                  />
                ))}
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-800 font-medium">{success}</p>
                <div className="mt-2 flex justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Verify Button */}
            <LoadingButton
              onClick={() => handleVerify()}
              loading={isVerifying}
              disabled={!code.every(digit => digit) || isVerifying || !!success}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              aria-label="Verify email address"
            >
              {success ? '🎉 Verified!' : 'Verify Email'}
            </LoadingButton>

            {/* Resend Section */}
            {!success && (
              <div className="text-center space-y-3 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-600">
                  Don&apos;t see the email? Check your spam folder or
                </p>
                <button
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed underline decoration-dotted underline-offset-2"
                  aria-label="Resend verification code"
                >
                  {resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : isResending 
                      ? 'Sending...' 
                      : 'we can send it again'
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>
            Code expires in 15 minutes • Need help? Contact support
          </p>
        </div>
      </div>
    </div>
  );
}