"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { formatAuthError } from '@/lib/auth-service';
import Logo from './Logo';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import SocialLoginButtons from './SocialLoginButtons';
import AlertMessage from './AlertMessage';

type AuthMode = 'login' | 'signup' | 'forgot-password';
type SocialProvider = 'google' | 'apple';

interface AuthPageProps {
  initialMode?: AuthMode;
  className?: string;
}

export default function AuthPage({ 
  initialMode = 'login', 
  className = '' 
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, forgotPassword, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Update mode based on URL parameters
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'signup') {
      // Redirect to dedicated signup page
      router.push('/signup');
    } else if (modeParam === 'forgot-password') {
      setMode('forgot-password');
    }
  }, [searchParams, router]);

  // Clear messages when mode changes
  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
  };

  // Login handler
  const handleLogin = async (data: { email: string; password: string; rememberMe: boolean }) => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await signIn(data.email, data.password, data.rememberMe);
      
      if (result.success) {
        // Redirect will happen automatically via useEffect above
        router.push('/dashboard');
      } else {
        setError(formatAuthError({ code: 'INVALID_CREDENTIALS', message: result.error || 'Login failed' }));
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Signup handler
  const handleSignup = async (data: { firstName: string; lastName: string; email: string; password: string; acceptTerms: boolean; subscribeNewsletter: boolean }) => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await signUp({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        acceptTerms: data.acceptTerms,
        subscribeNewsletter: data.subscribeNewsletter,
      });
      
      if (result.success) {
        setSuccess('Account created successfully! You can now sign in.');
        
        // Switch to login after showing success message
        setTimeout(() => {
          handleModeChange('login');
        }, 3000);
      } else {
        setError(formatAuthError({ code: 'SIGNUP_FAILED', message: result.error || 'Signup failed' }));
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password handler
  const handleForgotPassword = async (data: { email: string }) => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await forgotPassword(data.email);
      
      if (result.success) {
        setSuccess(`We've sent password reset instructions to ${data.email}. Please check your inbox and spam folder.`);
      } else {
        setError(formatAuthError({ code: 'RESET_FAILED', message: result.error || 'Unable to send reset email' }));
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Social login handler
  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    setError('');
    
    try {
      // Import AuthService dynamically to avoid SSR issues
      const { AuthService } = await import('@/lib/auth-service');
      
      const result = await AuthService.initiateSocialAuth(provider);
      
      if (result.success && result.data?.url) {
        // Redirect to the social provider's authentication page
        window.location.href = result.data.url;
      } else {
        setError(`Unable to sign in with ${provider}. Please try again.`);
      }
    } catch (err) {
      console.error(`${provider} login error:`, err);
      setError(`Unable to sign in with ${provider}. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleTermsClick = () => {
    window.open('/terms', '_blank');
  };

  const handlePrivacyClick = () => {
    window.open('/privacy', '_blank');
  };

  const getTitleAndSubtitle = () => {
    switch (mode) {
      case 'login':
        return {
          title: 'Welcome back to FamilyHub',
          subtitle: 'Sign in to access your family\'s coordination center'
        };
      case 'signup':
        return {
          title: 'Join FamilyHub',
          subtitle: 'Create your account to start organizing your family\'s life'
        };
      case 'forgot-password':
        return {
          title: 'Reset Your Password',
          subtitle: 'We\'ll help you get back into your account'
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  return (
    <div className={`min-h-screen bg-gradient-to-br from-base-100 via-secondary/10 to-accent/5 ${className}`}>
      {/* Skip to main content link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-content px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Left Side - Branding (Hidden on mobile in forms, visible in welcome) */}
        <div className="lg:w-1/2 bg-gradient-to-br from-primary/10 via-secondary/20 to-accent/10 flex items-center justify-center p-8 lg:p-12">
          <div className="max-w-md text-center lg:text-left space-y-6">
            {/* Logo */}
            <div className="flex justify-center lg:justify-start">
              <Logo showTagline={true} />
            </div>
            
            {/* Welcome Message */}
            <div className="space-y-4">
              <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-neutral-800 leading-tight">
                Family life, 
                <span className="text-primary block">beautifully organized</span>
              </h1>
              
              <p className="text-lg text-neutral-600 leading-relaxed">
                From daily schedules to important documents, keep your whole family connected across all generations.
              </p>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Always private</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Easy to use</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Free to start</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* Form Header */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl lg:text-3xl font-bold text-neutral-800">
                {title}
              </h2>
              <p className="text-neutral-600 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Global Success Message */}
            {success && (
              <AlertMessage
                type="success"
                message={success}
                className="mb-6"
              />
            )}

            <main id="main-content" role="main">
              {/* Social Login - Hidden for now but functionality preserved */}
              {false && (mode === 'login' || mode === 'signup') && (
                <div className="space-y-6">
                  <SocialLoginButtons
                    onGoogleLogin={() => handleSocialLogin('google')}
                    onAppleLogin={() => handleSocialLogin('apple')}
                    isLoading={!!socialLoading}
                    loadingProvider={socialLoading}
                  />
                  
                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-base-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-base-100 text-neutral-500">or continue with email</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Auth Forms */}
              {mode === 'login' && (
                <LoginForm
                  onSubmit={handleLogin}
                  onForgotPassword={() => handleModeChange('forgot-password')}
                  isLoading={isLoading}
                  error={error}
                />
              )}

              {mode === 'signup' && (
                <SignupForm
                  onSubmit={handleSignup}
                  onTermsClick={handleTermsClick}
                  onPrivacyClick={handlePrivacyClick}
                  isLoading={isLoading}
                  error={error}
                />
              )}

              {mode === 'forgot-password' && (
                <ForgotPasswordForm
                  onSubmit={handleForgotPassword}
                  onBackToLogin={() => handleModeChange('login')}
                  isLoading={isLoading}
                  error={error}
                  success={success}
                />
              )}
            </main>

            {/* Mode Switcher */}
            {mode !== 'forgot-password' && (
              <div className="text-center text-sm">
                {mode === 'login' ? (
                  <p className="text-neutral-600">
                    Don&apos;t have an account?{' '}
                    <a
                      href="/signup"
                      className="text-primary hover:text-primary-focus font-medium underline transition-colors"
                    >
                      Create one now
                    </a>
                  </p>
                ) : (
                  <p className="text-neutral-600">
                    Already have an account?{' '}
                    <button
                      onClick={() => handleModeChange('login')}
                      className="text-primary hover:text-primary-focus font-medium underline transition-colors min-h-[44px] px-2 -mx-2"
                      disabled={isLoading || !!socialLoading}
                    >
                      Sign in here
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Footer Text */}
            <div className="text-center text-xs text-neutral-500 leading-relaxed">
              <p>
                By using FamilyHub, you agree to our commitment to keeping your family&apos;s information private and secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}