"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';
import LoadingButton from './LoadingButton';
import AlertMessage from './AlertMessage';
import RecoverySetup from './auth/RecoverySetup';

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  acceptTerms: boolean;
  subscribeNewsletter: boolean;
}

export default function SignupPageRedesign() {
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    acceptTerms: false,
    subscribeNewsletter: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  
  const router = useRouter();
  const { signUp } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SignupFormData, string>> = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Please accept the terms to continue';
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
    if (errors[name as keyof SignupFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signUp({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        acceptTerms: formData.acceptTerms,
        subscribeNewsletter: formData.subscribeNewsletter,
      });
      
      if (result.success) {
        // Check if recovery code was returned from signup
        if (result.recovery_code) {
          setRecoveryCode(result.recovery_code);
          setShowRecoverySetup(true);
        } else {
          // If no recovery code, proceed to email verification
          setSuccess('Account created! Redirecting to complete setup...');
          setTimeout(() => {
            router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
          }, 1500);
        }
      } else {
        setGeneralError(formatAuthError({ 
          code: 'SIGNUP_FAILED', 
          message: result.error || 'Failed to create account' 
        }));
      }
    } catch (err) {
      console.error('Signup error:', err);
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryComplete = (backupEmail?: string) => {
    // Store backup email if provided
    if (backupEmail) {
      // This would be sent to the API to store
    }
    
    // Redirect to email verification
    router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
  };

  if (showRecoverySetup && recoveryCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
        <div className="w-full max-w-7xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Secure Your Account</h1>
            <p className="text-slate-600">Set up recovery options to ensure you never lose access</p>
          </div>
          <RecoverySetup 
            recoveryCode={recoveryCode}
            onComplete={handleRecoveryComplete}
            userEmail={formData.email}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      {/* Skip to main content link for screen readers */}
      <a href="#signup-form" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-50">
        Skip to signup form
      </a>
      <div className="w-full max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-xl overflow-hidden">
          
          {/* LEFT SIDE - Brand & Welcome */}
          <div className="hidden lg:flex bg-gradient-to-br from-purple-50 via-emerald-50/40 to-slate-50 p-12 lg:p-16 flex-col justify-center" aria-hidden="true">
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
                  <p className="text-sm text-slate-600 mt-0.5">Organize. Connect. Care.</p>
                </div>
              </div>
            </div>

            {/* Main Message */}
            <div className="space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
                Family life,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-emerald-600">
                  beautifully organized.
                </span>
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                From schedules to documents, keep your family connected across generations. 
                Simple, secure, and designed with care.
              </p>

              {/* Trust Signals */}
              <ul className="space-y-4 pt-6">
                <li className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium">Always private & secure</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium">Easy for everyone to use</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-slate-700 font-medium">Free to start, grow as needed</span>
                </li>
              </ul>

              {/* Testimonial or Trust Badge */}
              <div className="pt-8 border-t border-slate-200/50">
                <p className="text-sm text-slate-600 italic">
                  "Finally, a simple way to keep our whole family on the same page."
                </p>
                <p className="text-sm text-slate-600 mt-2">— Sarah M., caring for her parents</p>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Sign Up Form */}
          <div className="p-8 sm:p-12 lg:p-16 bg-white">
            <div className="max-w-md mx-auto">
              {/* Form Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Create your account
                </h3>
                <p className="text-slate-600">
                  Join thousands of families staying connected
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

              {/* Social Sign Up - Hidden as requested */}
              {false && (
                <>
                  <div className="space-y-3 mb-6">
                    <button className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 font-medium text-slate-700">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </button>
                    <button className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-3 font-medium text-slate-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Continue with Apple
                    </button>
                  </div>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-slate-600">or sign up with email</span>
                    </div>
                  </div>
                </>
              )}

              {/* Sign Up Form */}
              <form id="signup-form" onSubmit={handleSubmit} className="space-y-5" aria-label="Sign up form">
                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
                      First name
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base ${
                        errors.firstName ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                      }`}
                      placeholder="Jane"
                      required
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base ${
                        errors.lastName ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                      }`}
                      placeholder="Smith"
                      required
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Email Field */}
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
                    required
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">{errors.email}</p>
                  )}
                </div>


                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleInputChange}
                      className="mt-1 w-5 h-5 text-purple-600 bg-slate-50 border-slate-300 rounded focus:ring-purple-500/20 focus:ring-2 cursor-pointer"
                      required
                    />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">
                      I agree to the{' '}
                      <a href="/terms" target="_blank" className="text-purple-600 hover:text-purple-700 underline">
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" target="_blank" className="text-purple-600 hover:text-purple-700 underline">
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  {errors.acceptTerms && (
                    <p className="ml-7 text-sm text-red-600" role="alert" aria-live="polite">{errors.acceptTerms}</p>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      name="subscribeNewsletter"
                      checked={formData.subscribeNewsletter}
                      onChange={handleInputChange}
                      className="mt-1 w-5 h-5 text-purple-600 bg-slate-50 border-slate-300 rounded focus:ring-purple-500/20 focus:ring-2 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600 group-hover:text-slate-800">
                      Send me helpful caregiving tips and product updates (optional)
                    </span>
                  </label>
                </div>

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
                      Creating your account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>

                {/* Sign In Link */}
                <p className="text-center text-sm text-slate-600 pt-4">
                  Already have an account?{' '}
                  <a href="/auth" className="text-purple-600 hover:text-purple-700 font-medium">
                    Sign in
                  </a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}