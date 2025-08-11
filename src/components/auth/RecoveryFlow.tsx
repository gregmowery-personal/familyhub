"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, KeyIcon, EnvelopeIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

interface RecoveryFlowProps {
  email: string;
  onBack: () => void;
}

export default function RecoveryFlow({ email, onBack }: RecoveryFlowProps) {
  const [selectedMethod, setSelectedMethod] = useState<'code' | 'backup_email' | 'sms' | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleRecoveryCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Format the recovery code
    const formattedCode = recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const finalCode = formattedCode.slice(0, 5) + '-' + formattedCode.slice(5, 10);

    if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(finalCode)) {
      setError('Please enter a valid recovery code (format: XXXXX-XXXXX)');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/recovery/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          recovery_code: finalCode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Account recovered successfully! Redirecting...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(data.error?.message || 'Invalid recovery code');
      }
    } catch (err) {
      console.error('Recovery error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // This would send a verification code to the backup email
    // For now, we'll simulate it
    console.log('Sending code to backup email:', backupEmail);
    
    setIsLoading(false);
    setSuccess('Verification code sent to your backup email');
  };

  const renderMethodSelection = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-slate-800 mb-6">
        Choose Recovery Method
      </h3>
      
      {/* Recovery Code Option */}
      <button
        onClick={() => setSelectedMethod('code')}
        className="w-full p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left group"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-100 to-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <KeyIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-800 mb-1">Recovery Code</h4>
            <p className="text-sm text-slate-600">
              Use the 10-character recovery code you saved during signup
            </p>
            <p className="text-xs text-purple-600 mt-2 font-medium">
              Recommended method
            </p>
          </div>
        </div>
      </button>

      {/* Backup Email Option */}
      <button
        onClick={() => setSelectedMethod('backup_email')}
        className="w-full p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/50 transition-all text-left group"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-100 to-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <EnvelopeIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-800 mb-1">Backup Email</h4>
            <p className="text-sm text-slate-600">
              Receive a verification code at your backup email address
            </p>
          </div>
        </div>
      </button>

      {/* SMS Option - Coming Soon */}
      <div className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-xl opacity-60 cursor-not-allowed">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <DevicePhoneMobileIcon className="w-6 h-6 text-slate-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-600 mb-1">SMS Recovery</h4>
            <p className="text-sm text-slate-500">
              Receive a code via text message
            </p>
            <span className="inline-block mt-2 px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecoveryCode = () => (
    <form onSubmit={handleRecoveryCodeSubmit} className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-xl font-semibold text-slate-800">
          Enter Recovery Code
        </h3>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-purple-800">
          Enter the 10-character recovery code you saved when creating your account.
          Format: XXXXX-XXXXX
        </p>
      </div>

      <div>
        <label htmlFor="recoveryCode" className="block text-sm font-medium text-slate-700 mb-1.5">
          Recovery Code
        </label>
        <input
          id="recoveryCode"
          type="text"
          value={recoveryCode}
          onChange={(e) => {
            setRecoveryCode(e.target.value.toUpperCase());
            setError('');
          }}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-center font-mono text-lg tracking-wider"
          placeholder="XXXXX-XXXXX"
          maxLength={11}
          required
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-emerald-800 text-sm">{success}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || recoveryCode.length < 10}
        className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? 'Verifying...' : 'Recover Account'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          Try a different method
        </button>
      </div>
    </form>
  );

  const renderBackupEmail = () => (
    <form onSubmit={handleBackupEmailSubmit} className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="text-xl font-semibold text-slate-800">
          Backup Email Recovery
        </h3>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-purple-800">
          We'll send a verification code to your registered backup email address.
        </p>
      </div>

      <div>
        <label htmlFor="backupEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
          Backup Email Address
        </label>
        <input
          id="backupEmail"
          type="email"
          value={backupEmail}
          onChange={(e) => {
            setBackupEmail(e.target.value);
            setError('');
          }}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
          placeholder="backup@example.com"
          required
        />
      </div>

      {success && (
        <>
          <div>
            <label htmlFor="verificationCode" className="block text-sm font-medium text-slate-700 mb-1.5">
              Verification Code
            </label>
            <input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-center font-mono text-lg tracking-wider"
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>
        </>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-emerald-800 text-sm">{success}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? 'Sending...' : success ? 'Verify Code' : 'Send Verification Code'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          Try a different method
        </button>
      </div>
    </form>
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {!selectedMethod && renderMethodSelection()}
      {selectedMethod === 'code' && renderRecoveryCode()}
      {selectedMethod === 'backup_email' && renderBackupEmail()}
    </div>
  );
}