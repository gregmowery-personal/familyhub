"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';
import LoadingButton from './LoadingButton';
import RecoveryFlow from './auth/RecoveryFlow';

interface LoginFormData {
  email: string;
  verificationCode: string;
  rememberMe: boolean;
}

export default function LoginPageRedesign() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    verificationCode: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [isCodeStep, setIsCodeStep] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  
  const router = useRouter();
  const { signIn } = useAuth();

  const validateForm = (step: 'email' | 'code'): boolean => {
    const newErrors: Partial<Record<keyof LoginFormData, string>> = {};
    
    if (step === 'email') {
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    } else if (step === 'code') {
      if (!formData.verificationCode.trim()) {
        newErrors.verificationCode = 'Verification code is required';
      } else if (formData.verificationCode.length !== 6) {
        newErrors.verificationCode = 'Please enter a 6-digit code';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSendCode = async () => {
    setGeneralError('');
    
    if (!validateForm('email')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      
      if (response.ok) {
        setEmailSent(true);
        setIsCodeStep(true);
        setSuccess('Verification code sent! Please check your email.');
      } else {
        const data = await response.json();
        setGeneralError(data.error?.message || 'Failed to send verification code');
      }
    } catch (err) {
      console.error('Send code error:', err);
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setGeneralError('');
    
    if (!validateForm('code')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signIn(formData.email, formData.rememberMe, formData.verificationCode);
      
      if (result.success) {
        setSuccess('Welcome back! Redirecting to your dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        // Check if email needs verification
        if (result.error?.toLowerCase().includes('verify your email')) {
          sessionStorage.setItem('unverified_email', formData.email);
          setGeneralError('Please verify your email first. Redirecting...');
          setTimeout(() => {
            router.push('/auth/verify-email');
          }, 1500);
        } else {
          setGeneralError(formatAuthError({ 
            code: 'INVALID_CREDENTIALS', 
            message: result.error || 'Invalid verification code' 
          }));
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isCodeStep) {
      await handleSendCode();
    } else {
      await handleVerifyCode();
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      {/* Skip to main content link for screen readers */}
      <a href="#login-form" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50">
        Skip to login form
      </a>
      <div className="w-full max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-xl overflow-hidden">
          
          {/* LEFT SIDE - Welcome Back Message */}
          <div className="hidden lg:flex bg-gradient-to-br from-emerald-50 via-purple-50/40 to-slate-50 p-12 lg:p-16 flex-col justify-center" aria-hidden="true">
            {/* Logo */}
            <div className="mb-10">
              <div className="flex items-center gap-4">
                {/* FamilyHub Logo SVG */}
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="flex-shrink-0"
                >
                  {/* Central hub circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="18"
                    fill="#C5DAD1"
                    stroke="#6B7280"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  
                  {/* Family member circles */}
                  <circle cx="30" cy="25" r="10" fill="#9B98B0" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                  <circle cx="70" cy="25" r="12" fill="#87A89A" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                  <circle cx="25" cy="75" r="11" fill="#9B98B0" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                  <circle cx="75" cy="75" r="10" fill="#87A89A" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                  
                  {/* Connection lines */}
                  <g stroke="#87A89A" strokeWidth="2" strokeLinecap="round" opacity="0.4">
                    <path d="M38 35 L42 42" />
                    <path d="M62 35 L58 42" />
                    <path d="M32 65 L42 58" />
                    <path d="M68 65 L58 58" />
                  </g>
                  
                  {/* Heart in center */}
                  <path
                    d="M47 47 Q47 44 50 44 Q53 44 53 47 Q53 49 50 52 Q47 49 47 47"
                    fill="#6B7280"
                    opacity="0.7"
                  />
                </svg>
                
                <div>
                  <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">FamilyHub.care</h1>
                  <p className="text-sm text-slate-600 mt-0.5">Welcome back</p>
                </div>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
                Your family's<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-purple-600">
                  command center
                </span>
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                Everything your family needs in one secure place. Check schedules, 
                assign tasks, and keep everyone connected.
              </p>

              {/* What's Waiting for You */}
              <div className="pt-6 space-y-4">
                <p className="text-sm font-medium text-slate-700 uppercase tracking-wide">What's waiting for you:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                      <span className="text-purple-600 text-xs">📅</span>
                    </div>
                    <span className="text-slate-700">Today's schedule and upcoming events</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                      <span className="text-emerald-600 text-xs">✓</span>
                    </div>
                    <span className="text-slate-700">Tasks assigned to family members</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                      <span className="text-purple-600 text-xs">💬</span>
                    </div>
                    <span className="text-slate-700">Family notes and reminders</span>
                  </li>
                </ul>
              </div>

              {/* Security Assurance */}
              <div className="pt-8 border-t border-slate-200/50">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600">
                    Your family's information is always private and secure
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Login Form or Recovery */}
          <div className="p-8 sm:p-12 lg:p-16 bg-white">
            <div className="max-w-sm mx-auto">
              {showRecovery ? (
                <RecoveryFlow 
                  email={formData.email} 
                  onBack={() => setShowRecovery(false)} 
                />
              ) : (
              <>
              {/* Form Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  {!isCodeStep ? 'Sign in to your account' : 'Enter verification code'}
                </h3>
                <p className="text-slate-600">
                  {!isCodeStep ? 'We\'ll send you a secure code to sign in' : `Enter the 6-digit code sent to ${formData.email}`}
                </p>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl" role="status" aria-live="polite">
                  <p className="text-emerald-800 text-sm font-medium">{success}</p>
                </div>
              )}

              {/* Error Message */}
              {generalError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert" aria-live="assertive">
                  <p className="text-red-800 text-sm font-medium">{generalError}</p>
                </div>
              )}

              {/* Login Form */}
              <form id="login-form" onSubmit={handleSubmit} className="space-y-5" aria-label="Sign in form">
                {!isCodeStep ? (
                  /* Step 1: Email Field */
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base ${
                        errors.email ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                      }`}
                      placeholder="jane@example.com"
                      autoComplete="email"
                      required
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">{errors.email}</p>
                    )}
                  </div>
                ) : (
                  /* Step 2: Verification Code Field */
                  <>
                    <div>
                      <label htmlFor="verificationCode" className="block text-sm font-medium text-slate-700 mb-1.5">
                        6-digit verification code
                      </label>
                      <input
                        id="verificationCode"
                        name="verificationCode"
                        type="text"
                        value={formData.verificationCode}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-lg text-center font-mono tracking-wider ${
                          errors.verificationCode ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                        }`}
                        placeholder="000000"
                        maxLength={6}
                        autoComplete="one-time-code"
                        required
                      />
                      {errors.verificationCode && (
                        <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">{errors.verificationCode}</p>
                      )}
                    </div>
                    
                    {/* Back to Email Button */}
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCodeStep(false);
                          setEmailSent(false);
                          setFormData(prev => ({ ...prev, verificationCode: '' }));
                          setErrors({});
                          setSuccess('');
                        }}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        ← Use different email
                      </button>
                    </div>
                  </>
                )}


                {/* Remember Me - Only show on email step */}
                {!isCodeStep && (
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-slate-50">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        checked={formData.rememberMe}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-purple-600 bg-slate-50 border-slate-300 rounded focus:ring-purple-500/20 focus:ring-2 cursor-pointer"
                      />
                      <span className="text-sm text-slate-700">Remember me</span>
                    </label>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {!isCodeStep ? 'Sending code...' : 'Signing in...'}
                    </span>
                  ) : (
                    !isCodeStep ? 'Send Code' : 'Sign In'
                  )}
                </button>
                
                {/* Resend Code Option */}
                {isCodeStep && emailSent && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={isLoading}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>
                )}

                {/* Divider - Only show on email step */}
                {!isCodeStep && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-slate-600">New to FamilyHub?</span>
                      </div>
                    </div>

                    {/* Sign Up Link */}
                    <a
                      href="/signup"
                      className="block w-full py-3.5 px-6 bg-white border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 text-center transition-colors"
                    >
                      Create an Account
                    </a>
                  </>
                )}
              </form>

                {/* Account Recovery Link - Only show on email step */}
                {!isCodeStep && (
                  <div className="text-center mt-6">
                    <button
                      type="button"
                      onClick={() => setShowRecovery(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Can't access your email? Recover account →
                    </button>
                  </div>
                )}

                {/* Privacy Note */}
                <p className="text-center text-xs text-slate-600 mt-8 leading-relaxed">
                  Your privacy is our priority. We never share your family's information.
                </p>
              </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}