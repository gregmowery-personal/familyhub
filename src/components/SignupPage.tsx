"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';
import Logo from './Logo';
import FormInput from './FormInput';
import LoadingButton from './LoadingButton';
import AlertMessage from './AlertMessage';

interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  subscribeNewsletter: boolean;
}

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    subscribeNewsletter: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [success, setSuccess] = useState('');
  
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
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
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
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        acceptTerms: formData.acceptTerms,
        subscribeNewsletter: formData.subscribeNewsletter,
      });
      
      if (result.success) {
        setSuccess('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/auth?mode=login');
        }, 2000);
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

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center px-4 py-16">
      <div className="grid lg:grid-cols-2 gap-10 w-full max-w-6xl items-center">
        {/* LEFT: Brand & Welcome */}
        <div className="px-4 lg:px-8">
          <div className="mb-8">
            <Logo showTagline={true} />
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-neutral-800 mb-4 leading-tight">
            Family life,<br />
            <span className="text-primary">beautifully organized.</span>
          </h2>
          <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
            From daily schedules to secure documents, keep your family connected and supported across generations.
          </p>

          <ul className="space-y-3 text-neutral-600">
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Always private and secure</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Easy for all generations to use</span>
            </li>
            <li className="flex items-center gap-3">
              <svg className="w-5 h-5 text-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Free to start, grow as you need</span>
            </li>
          </ul>

          <div className="mt-8 pt-8 border-t border-base-200">
            <p className="text-sm text-neutral-600">
              Already have an account?{' '}
              <a 
                href="/auth?mode=login" 
                className="text-primary hover:text-primary-focus underline font-medium"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>

        {/* RIGHT: Sign-up Form */}
        <div className="bg-white rounded-xl shadow-xl p-8 lg:p-10 border border-base-200">
          <h3 className="text-2xl font-bold mb-2 text-neutral-800">Create your FamilyHub</h3>
          <p className="text-neutral-600 mb-6">Get started in less than 2 minutes</p>

          {/* Success Message */}
          {success && (
            <AlertMessage
              type="success"
              message={success}
              className="mb-6"
            />
          )}

          {/* Error Message */}
          {generalError && (
            <AlertMessage
              type="error"
              message={generalError}
              className="mb-6"
            />
          )}

          {/* Social Login - Hidden as requested */}
          {false && (
            <>
              <div className="space-y-3 mb-6">
                <button className="btn btn-outline w-full justify-start gap-3 min-h-[48px]">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                <button className="btn btn-outline w-full justify-start gap-3 min-h-[48px]">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>
              </div>

              <div className="divider text-neutral-400 text-sm">or sign up with email</div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormInput
                  name="firstName"
                  label="First name"
                  type="text"
                  placeholder="Enter your first name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  error={errors.firstName}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <FormInput
                  name="lastName"
                  label="Last name"
                  type="text"
                  placeholder="Enter your last name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  error={errors.lastName}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>

            <FormInput
              name="email"
              label="Email address"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleInputChange}
              error={errors.email}
              required
              autoComplete="email"
            />

            <div className="relative">
              <FormInput
                name="password"
                label="Create a password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={handleInputChange}
                error={errors.password}
                required
                autoComplete="new-password"
                helperText="Must be at least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-11 p-2 text-neutral-500 hover:text-neutral-700 transition-colors"
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

            <FormInput
              name="confirmPassword"
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              error={errors.confirmPassword}
              required
              autoComplete="new-password"
            />

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="acceptTerms"
                  className="checkbox checkbox-primary mt-0.5"
                  checked={formData.acceptTerms}
                  onChange={handleInputChange}
                  required 
                />
                <span className="text-sm text-neutral-700 leading-tight">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-primary hover:text-primary-focus underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" className="text-primary hover:text-primary-focus underline">
                    Privacy Policy
                  </a>
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="text-error text-sm ml-7">{errors.acceptTerms}</p>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="subscribeNewsletter"
                  className="checkbox checkbox-primary mt-0.5"
                  checked={formData.subscribeNewsletter}
                  onChange={handleInputChange}
                />
                <span className="text-sm text-neutral-600 leading-tight">
                  Send me helpful tips and updates about caring for my family (optional)
                </span>
              </label>
            </div>

            <LoadingButton
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              loadingText="Creating account..."
              className="w-full mt-6"
            >
              Create Account
            </LoadingButton>
          </form>
        </div>
      </div>
    </div>
  );
}