"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';
import LoadingButton from './LoadingButton';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPageRedesign() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  
  const router = useRouter();
  const { signIn } = useAuth();

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LoginFormData, string>> = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await signIn(formData.email, formData.password, formData.rememberMe);
      
      if (result.success) {
        setSuccess('Welcome back! Redirecting to your dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setGeneralError(formatAuthError({ 
          code: 'INVALID_CREDENTIALS', 
          message: result.error || 'Invalid email or password' 
        }));
      }
    } catch (err) {
      console.error('Login error:', err);
      setGeneralError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/auth?mode=forgot-password');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-xl overflow-hidden">
          
          {/* LEFT SIDE - Welcome Back Message */}
          <div className="bg-gradient-to-br from-emerald-50 via-purple-50/40 to-slate-50 p-12 lg:p-16 flex flex-col justify-center">
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

          {/* RIGHT SIDE - Login Form */}
          <div className="p-12 lg:p-16 bg-white">
            <div className="max-w-sm mx-auto">
              {/* Form Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Sign in to your account
                </h3>
                <p className="text-slate-600">
                  Enter your credentials to continue
                </p>
              </div>

              {/* Success Message */}
              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-emerald-800 text-sm font-medium">{success}</p>
                </div>
              )}

              {/* Error Message */}
              {generalError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-800 text-sm font-medium">{generalError}</p>
                </div>
              )}

              {/* Login Form */}
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
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 pr-12 ${
                        errors.password ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                      }`}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6 6m3.878 3.878l4.242 4.242m0 0L18 18" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-purple-600 bg-slate-50 border-slate-300 rounded focus:ring-purple-500/20 focus:ring-2"
                    />
                    <span className="text-sm text-slate-600">Remember me</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Forgot password?
                  </button>
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
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">New to FamilyHub?</span>
                  </div>
                </div>

                {/* Sign Up Link */}
                <a
                  href="/signup"
                  className="block w-full py-3.5 px-6 bg-white border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 text-center transition-colors"
                >
                  Create an Account
                </a>
              </form>

              {/* Privacy Note */}
              <p className="text-center text-xs text-slate-500 mt-8 leading-relaxed">
                Your privacy is our priority. We never share your family's information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}