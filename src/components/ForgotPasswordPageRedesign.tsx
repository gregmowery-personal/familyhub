"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordPageRedesign() {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  
  const router = useRouter();
  const { forgotPassword } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ForgotPasswordFormData, string>> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name as keyof ForgotPasswordFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setSuccess('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await forgotPassword(formData.email);
      
      if (result.success) {
        setSuccess(`We've sent password reset instructions to ${formData.email}. Please check your inbox and spam folder.`);
        // Clear the form
        setFormData({ email: '' });
      } else {
        setGeneralError(formatAuthError({ 
          code: 'RESET_FAILED', 
          message: result.error || 'Unable to send reset email' 
        }));
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-xl overflow-hidden">
          
          {/* LEFT SIDE - Support Message */}
          <div className="bg-gradient-to-br from-purple-50 via-emerald-50/40 to-slate-50 p-12 lg:p-16 flex flex-col justify-center">
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
                  <p className="text-sm text-slate-600 mt-0.5">We're here to help</p>
                </div>
              </div>
            </div>

            {/* Support Message */}
            <div className="space-y-6">
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
                It happens to<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-emerald-600">
                  the best of us
                </span>
              </h2>
              
              <p className="text-lg text-slate-600 leading-relaxed">
                With everything you're managing, forgotten passwords are completely normal. 
                We'll have you back to your family's hub in no time.
              </p>

              {/* What happens next */}
              <div className="pt-6 space-y-4">
                <p className="text-sm font-medium text-slate-700 uppercase tracking-wide">What happens next:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                      <span className="text-emerald-600 font-bold text-xs">1</span>
                    </div>
                    <span className="text-slate-700">Check your email for reset instructions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                      <span className="text-purple-600 font-bold text-xs">2</span>
                    </div>
                    <span className="text-slate-700">Click the secure link in the email</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                      <span className="text-emerald-600 font-bold text-xs">3</span>
                    </div>
                    <span className="text-slate-700">Create a new password and sign in</span>
                  </li>
                </ul>
              </div>

              {/* Security Note */}
              <div className="pt-8 border-t border-slate-200/50">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-600">
                    For security, reset links expire after 1 hour
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - Reset Form */}
          <div className="p-12 lg:p-16 bg-white">
            <div className="max-w-sm mx-auto">
              {/* Form Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Reset your password
                </h3>
                <p className="text-slate-600">
                  Enter your email and we'll send you instructions
                </p>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-emerald-800 text-sm">{success}</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {generalError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-800 text-sm font-medium">{generalError}</p>
                </div>
              )}

              {/* Reset Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 ${
                      errors.email ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="jane@example.com"
                    autoComplete="email"
                    required
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Enter the email address associated with your FamilyHub account
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !!success}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending instructions...
                    </span>
                  ) : (
                    'Send Reset Instructions'
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">Remember your password?</span>
                  </div>
                </div>

                {/* Back to Login */}
                <a
                  href="/auth"
                  className="block w-full py-3.5 px-6 bg-white border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 text-center transition-colors"
                >
                  Back to Sign In
                </a>
              </form>

              {/* Help Text */}
              <div className="mt-8 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600 text-center">
                  <span className="font-medium">Still having trouble?</span><br />
                  Contact us at support@familyhub.care
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}