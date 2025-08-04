import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import FormInput from './FormInput';
import LoadingButton from './LoadingButton';
import AlertMessage from './AlertMessage';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  onForgotPassword: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export default function LoginForm({
  onSubmit,
  onForgotPassword,
  isLoading = false,
  error,
  className = ''
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });

  const handleFormSubmit = async (data: LoginFormData) => {
    try {
      await onSubmit(data);
    } catch {
      // Error handling is done in parent component
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)} 
      className={`space-y-6 ${className}`}
      noValidate
    >
      {/* Error Alert */}
      {error && (
        <AlertMessage
          type="error"
          title="Sign In Failed"
          message={error}
          className="mb-6"
        />
      )}

      {/* Email Field */}
      <FormInput
        label="Email Address"
        type="email"
        autoComplete="email"
        placeholder="your.email@example.com"
        error={errors.email?.message}
        required
        {...register('email', {
          required: 'Email address is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Please enter a valid email address'
          }
        })}
      />

      {/* Password Field */}
      <div className="relative">
        <FormInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          required
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters long'
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
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            {...register('rememberMe')}
          />
          <span className="text-sm text-neutral-700">Remember me</span>
        </label>
        
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-primary hover:text-primary-focus underline transition-colors min-h-[44px] px-2 -mx-2"
          disabled={isFormLoading}
        >
          Forgot password?
        </button>
      </div>

      {/* Submit Button */}
      <LoadingButton
        type="submit"
        loading={isFormLoading}
        loadingText="Signing you in..."
        variant="primary"
        size="lg"
        className="w-full text-primary-content"
        aria-label="Sign in to your FamilyHub account"
      >
        Sign In
      </LoadingButton>
    </form>
  );
}