"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AuthService } from '@/lib/auth-service';
import FormInput from '@/components/FormInput';
import LoadingButton from '@/components/LoadingButton';
import AlertMessage from '@/components/AlertMessage';
import Logo from '@/components/Logo';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

function ResetPasswordContent() {
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordFormData>({
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const password = watch('password');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [token]);

  const handleFormSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;

    setStatus('loading');
    setError('');

    try {
      const result = await AuthService.resetPassword(token, data.password);

      if (result.success) {
        setStatus('success');
        // Redirect to login after showing success message
        setTimeout(() => {
          router.push('/auth?mode=login');
        }, 3000);
      } else {
        setStatus('error');
        setError(result.error?.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setStatus('error');
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, text: '', color: '' };
    
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    const strengthMap = {
      0: { text: '', color: '' },
      1: { text: 'Very weak', color: 'text-error' },
      2: { text: 'Weak', color: 'text-warning' },
      3: { text: 'Fair', color: 'text-warning' },
      4: { text: 'Good', color: 'text-success' },
      5: { text: 'Strong', color: 'text-success' }
    };

    return { strength, ...strengthMap[strength as keyof typeof strengthMap] };
  };

  const passwordStrength = getPasswordStrength(password);

  const getContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center space-y-6">
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-base-content">
                Updating Your Password...
              </h2>
              <p className="text-base-content/70">
                Please wait while we update your password.
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
                Password Updated Successfully!
              </h2>
              <p className="text-base-content/70">
                Your password has been updated. Redirecting to sign in...
              </p>
            </div>
            <div className="loading loading-spinner loading-sm text-primary"></div>
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
                Password Reset Failed
              </h2>
              <AlertMessage
                type="error"
                message={error}
                className="text-left"
              />
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/auth?mode=forgot-password')}
                  className="btn btn-primary w-full"
                  aria-label="Request new password reset"
                >
                  Request New Reset Link
                </button>
                <button
                  onClick={() => router.push('/auth')}
                  className="btn btn-ghost w-full"
                  aria-label="Return to sign in"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          </div>
        );

      case 'form':
      default:
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-neutral-800">
                Create New Password
              </h2>
              <p className="text-neutral-600 leading-relaxed">
                Enter your new password below. Make sure it&apos;s strong and secure.
              </p>
            </div>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
              {/* Password Field */}
              <div className="relative">
                <FormInput
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  error={errors.password?.message}
                  required
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters long'
                    },
                    validate: {
                      hasLowerCase: (value) =>
                        /[a-z]/.test(value) || 'Password must contain at least one lowercase letter',
                      hasUpperCase: (value) =>
                        /[A-Z]/.test(value) || 'Password must contain at least one uppercase letter',
                      hasNumber: (value) =>
                        /[0-9]/.test(value) || 'Password must contain at least one number'
                    }
                  })}
                />
                
                {/* Show/Hide Password Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-12 p-2 text-neutral-500 hover:text-neutral-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.818 8.818m1.06 1.06a3 3 0 013.026.159m-3.086 7.097l-.085-.085m-1.061 1.061L8.818 15.182m5.657 5.657L16.818 18.586m-2.343-2.343a3 3 0 01-4.243-4.243m7.086-.085L15.182 8.818m2.343 2.343L19.778 8.91" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>

                {/* Password Strength Indicator */}
                {password && passwordStrength.text && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Password strength:</span>
                      <span className={`font-medium ${passwordStrength.color}`}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    <div className="w-full bg-base-200 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          passwordStrength.strength <= 2 ? 'bg-error' :
                          passwordStrength.strength <= 3 ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="relative">
                <FormInput
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  error={errors.confirmPassword?.message}
                  required
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: {
                      matchesPassword: (value) =>
                        value === password || 'Passwords do not match'
                    }
                  })}
                />
                
                {/* Show/Hide Confirm Password Toggle */}
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-12 p-2 text-neutral-500 hover:text-neutral-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={0}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.818 8.818m1.06 1.06a3 3 0 013.026.159m-3.086 7.097l-.085-.085m-1.061 1.061L8.818 15.182m5.657 5.657L16.818 18.586m-2.343-2.343a3 3 0 01-4.243-4.243m7.086-.085L15.182 8.818m2.343 2.343L19.778 8.91" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Submit Button */}
              <LoadingButton
                type="submit"
                loading={isSubmitting}
                loadingText="Updating password..."
                variant="primary"
                size="lg"
                className="w-full text-primary-content"
                aria-label="Update password"
              >
                Update Password
              </LoadingButton>
            </form>

            {/* Back to Login */}
            <div className="text-center">
              <button
                onClick={() => router.push('/auth')}
                className="text-sm text-primary hover:text-primary-focus underline transition-colors min-h-[44px] px-2"
              >
                ← Back to Sign In
              </button>
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
          {getContent()}
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo showTagline={false} />
          </div>
          <div className="bg-base-100 rounded-lg shadow-xl p-8">
            <div className="text-center space-y-6">
              <div className="loading loading-spinner loading-lg text-primary"></div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-base-content">
                  Loading...
                </h2>
                <p className="text-base-content/70">
                  Please wait while we load the password reset page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}