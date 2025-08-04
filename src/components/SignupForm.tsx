import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
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

interface SignupFormProps {
  onSubmit: (data: Omit<SignupFormData, 'confirmPassword'>) => Promise<void>;
  onTermsClick: () => void;
  onPrivacyClick: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export default function SignupForm({
  onSubmit,
  onTermsClick,
  onPrivacyClick,
  isLoading = false,
  error,
  className = ''
}: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<SignupFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      subscribeNewsletter: false
    }
  });

  const password = watch('password');

  const handleFormSubmit = async (data: SignupFormData) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword, ...submitData } = data;
      await onSubmit(submitData);
    } catch {
      // Error handling is done in parent component
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  // Password strength indicator
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
          title="Account Creation Failed"
          message={error}
          className="mb-6"
        />
      )}

      {/* Name Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="First Name"
          type="text"
          autoComplete="given-name"
          placeholder="Your first name"
          error={errors.firstName?.message}
          required
          {...register('firstName', {
            required: 'First name is required',
            minLength: {
              value: 2,
              message: 'First name must be at least 2 characters'
            },
            pattern: {
              value: /^[A-Za-z\s'-]+$/,
              message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
            }
          })}
        />

        <FormInput
          label="Last Name"
          type="text"
          autoComplete="family-name"
          placeholder="Your last name"
          error={errors.lastName?.message}
          required
          {...register('lastName', {
            required: 'Last name is required',
            minLength: {
              value: 2,
              message: 'Last name must be at least 2 characters'
            },
            pattern: {
              value: /^[A-Za-z\s'-]+$/,
              message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
            }
          })}
        />
      </div>

      {/* Email Field */}
      <FormInput
        label="Email Address"
        type="email"
        autoComplete="email"
        placeholder="your.email@example.com"
        error={errors.email?.message}
        helperText="We'll use this to send you important updates about your family's account"
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
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
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

      {/* Terms and Conditions */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-1 flex-shrink-0"
            {...register('acceptTerms', {
              required: 'You must accept the terms and conditions to create an account'
            })}
          />
          <span className="text-sm text-neutral-700 leading-relaxed">
            I agree to the{' '}
            <button
              type="button"
              onClick={onTermsClick}
              className="text-primary hover:text-primary-focus underline"
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              onClick={onPrivacyClick}
              className="text-primary hover:text-primary-focus underline"
            >
              Privacy Policy
            </button>
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="text-error text-sm font-medium" role="alert">
            {errors.acceptTerms.message}
          </p>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-1 flex-shrink-0"
            {...register('subscribeNewsletter')}
          />
          <span className="text-sm text-neutral-700 leading-relaxed">
            Send me helpful tips and updates about FamilyHub (optional)
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <LoadingButton
        type="submit"
        loading={isFormLoading}
        loadingText="Creating your account..."
        variant="primary"
        size="lg"
        className="w-full text-primary-content"
        aria-label="Create your FamilyHub account"
      >
        Create Account
      </LoadingButton>
    </form>
  );
}