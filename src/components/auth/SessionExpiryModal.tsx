"use client";

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

interface SessionExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeRemaining: number; // in seconds
}

export default function SessionExpiryModal({ isOpen, onClose, timeRemaining }: SessionExpiryModalProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(timeRemaining);
  const { signIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Prefill email if user is available
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    // Update countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Send verification code
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setCodeSent(true);
      } else {
        setError('Failed to send verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn(email);
      
      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    router.push('/auth');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md bg-white rounded-2xl shadow-xl">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                {countdown > 0 ? (
                  <ClockIcon className="w-6 h-6 text-amber-600" />
                ) : (
                  <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-800">
                  {countdown > 0 ? 'Session Expiring Soon' : 'Session Expired'}
                </Dialog.Title>
                {countdown > 0 && (
                  <p className="text-sm text-slate-600">
                    Time remaining: <span className="font-mono font-bold text-amber-600">{formatTime(countdown)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-600 mb-6">
              {countdown > 0 
                ? 'Your session will expire soon. Please verify your email to continue.'
                : 'Your session has expired for security. Please verify your email to continue.'}
            </p>

            {/* Email Verification Form */}
            {!codeSent ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="session-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="session-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    placeholder="your@email.com"
                    disabled={user?.email}
                  />
                </div>

                <button
                  onClick={handleSendCode}
                  disabled={isLoading || !email}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-xl hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-sm text-emerald-800">
                    Verification code sent to {email}
                  </p>
                </div>

                <div>
                  <label htmlFor="session-code" className="block text-sm font-medium text-slate-700 mb-1">
                    Enter 6-Digit Code
                  </label>
                  <input
                    id="session-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-center font-mono text-lg tracking-wider"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <button
                  onClick={handleVerifyCode}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-xl hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Extend Session'}
                </button>

                <button
                  onClick={() => {
                    setCodeSent(false);
                    setVerificationCode('');
                  }}
                  className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Resend Code
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Alternative Actions */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <button
                onClick={handleSignOut}
                className="w-full py-2 text-slate-600 hover:text-slate-800 font-medium text-sm"
              >
                Sign Out Instead
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}