import React from 'react';
import { useForm } from 'react-hook-form';
import FormInput from './FormInput';
import LoadingButton from './LoadingButton';
import AlertMessage from './AlertMessage';

interface ForgotPasswordFormData {
  email: string;
}

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordFormData) => Promise<void>;
  onBackToLogin: () => void;
  isLoading?: boolean;
  error?: string;
  success?: string;
  className?: string;
}

export default function ForgotPasswordForm({
  onSubmit,
  onBackToLogin,
  isLoading = false,
  error,
  success,
  className = ''
}: ForgotPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      email: ''
    }
  });

  const handleFormSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await onSubmit(data);
    } catch {
      // Error handling is done in parent component
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-neutral-800">
          Reset Your Password
        </h2>
        <p className="text-neutral-600 leading-relaxed">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {/* Success Alert */}
      {success && (
        <AlertMessage
          type="success"
          title="Reset Link Sent"
          message={success}
          className="mb-6"
        />
      )}

      {/* Error Alert */}
      {error && (
        <AlertMessage
          type="error"
          title="Reset Failed"
          message={error}
          className="mb-6"
        />
      )}

      {!success && (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
          {/* Email Field */}
          <FormInput
            label="Email Address"
            type="email"
            autoComplete="email"
            placeholder="your.email@example.com"
            error={errors.email?.message}
            helperText="We&apos;ll send password reset instructions to this email"
            required
            {...register('email', {
              required: 'Email address is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Please enter a valid email address'
              }
            })}
          />

          {/* Submit Button */}
          <LoadingButton
            type="submit"
            loading={isFormLoading}
            loadingText="Sending reset link..."
            variant="primary"
            size="lg"
            className="w-full text-primary-content"
            aria-label="Send password reset email"
          >
            Send Reset Link
          </LoadingButton>
        </form>
      )}

      {/* Back to Login */}
      <div className="text-center">
        <button
          onClick={onBackToLogin}
          className="text-sm text-primary hover:text-primary-focus underline transition-colors min-h-[44px] px-2"
          disabled={isFormLoading}
        >
          ← Back to Sign In
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-base-200/50 rounded-lg p-4 text-center">
        <div className="text-sm text-neutral-600 space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="font-medium text-primary">Secure Process</span>
          </div>
          <p>
            For your security, password reset links expire after 1 hour and can only be used once.
          </p>
          <p>
            If you don&apos;t receive an email within a few minutes, please check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
}