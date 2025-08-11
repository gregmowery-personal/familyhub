"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, DocumentDuplicateIcon, ArrowDownTrayIcon, PrinterIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

interface RecoverySetupProps {
  recoveryCode: string;
  onComplete: (backupEmail?: string) => void;
  userEmail: string;
}

export default function RecoverySetup({ recoveryCode, onComplete, userEmail }: RecoverySetupProps) {
  const [backupEmail, setBackupEmail] = useState('');
  const [backupEmailError, setBackupEmailError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeDownloaded, setCodeDownloaded] = useState(false);
  const [setupBackupEmail, setSetupBackupEmail] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownloadCode = () => {
    const content = `FamilyHub.care Recovery Code
=============================
Save this code in a secure location.
You'll need it if you lose access to your email.

Recovery Code: ${recoveryCode}

Account Email: ${userEmail}
Generated: ${new Date().toLocaleDateString()}

IMPORTANT:
- Keep this code private and secure
- Store it separately from your device
- You won't be able to see this code again
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'familyhub-recovery-code.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCodeDownloaded(true);
  };

  const handlePrintCode = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>FamilyHub Recovery Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            .header {
              border-bottom: 2px solid #87A89A;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              color: #87A89A;
              font-size: 24px;
              font-weight: bold;
            }
            .code-box {
              background: #f9fafb;
              border: 2px dashed #87A89A;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
              border-radius: 12px;
            }
            .code {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 2px;
              color: #1f2937;
              font-family: 'Courier New', monospace;
            }
            .info {
              margin: 20px 0;
              color: #6b7280;
            }
            .warning {
              background: #fef3c7;
              border: 1px solid #f59e0b;
              padding: 15px;
              border-radius: 8px;
              margin-top: 30px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">FamilyHub.care</div>
            <h1>Account Recovery Code</h1>
          </div>
          
          <div class="code-box">
            <div class="code">${recoveryCode}</div>
          </div>
          
          <div class="info">
            <p><strong>Account:</strong> ${userEmail}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Information:</strong>
            <ul>
              <li>Keep this code private and secure</li>
              <li>Store it in a safe place, separate from your computer</li>
              <li>Never share this code with anyone</li>
              <li>You won't be able to see this code again</li>
            </ul>
          </div>
          
          <script>
            window.print();
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const validateBackupEmail = () => {
    if (!backupEmail.trim()) {
      setBackupEmailError('Please enter a backup email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) {
      setBackupEmailError('Please enter a valid email address');
      return false;
    }
    if (backupEmail.toLowerCase() === userEmail.toLowerCase()) {
      setBackupEmailError('Backup email must be different from your primary email');
      return false;
    }
    setBackupEmailError('');
    return true;
  };

  const handleSetupBackupEmail = async () => {
    if (!validateBackupEmail()) return;
    
    setIsVerifyingEmail(true);
    // In production, this would send a verification code to the backup email
    // For now, we'll simulate it
    console.log('Sending verification code to:', backupEmail);
    // Simulated verification would happen here
    setIsVerifyingEmail(false);
    setEmailVerified(true);
  };

  const handleComplete = () => {
    if (codeCopied || codeDownloaded) {
      onComplete(emailVerified ? backupEmail : undefined);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Step 1: Recovery Code */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-100 to-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-lg">🔐</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Your Recovery Code
            </h3>
            <p className="text-slate-600">
              This is your primary account recovery method. Save it somewhere safe - you won't be able to see it again.
            </p>
          </div>
        </div>

        {/* Recovery Code Display */}
        <div className="bg-gradient-to-br from-purple-50 to-emerald-50 border-2 border-dashed border-purple-200 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-slate-800 tracking-wider mb-4">
              {recoveryCode}
            </div>
            <p className="text-sm text-slate-600">
              Keep this code private and secure
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleCopyCode}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
              codeCopied 
                ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {codeCopied ? (
              <>
                <CheckCircleIconSolid className="w-5 h-5" />
                Copied!
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="w-5 h-5" />
                Copy Code
              </>
            )}
          </button>

          <button
            onClick={handleDownloadCode}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
              codeDownloaded 
                ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {codeDownloaded ? (
              <>
                <CheckCircleIconSolid className="w-5 h-5" />
                Downloaded!
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download
              </>
            )}
          </button>

          <button
            onClick={handlePrintCode}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all"
          >
            <PrinterIcon className="w-5 h-5" />
            Print
          </button>
        </div>

        {/* Warning */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Important:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Store this code separately from your device</li>
                <li>Consider using a password manager or safe</li>
                <li>You'll need this if you lose access to your email</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Optional Backup Methods */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-100 to-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-lg">📧</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Additional Recovery Options
              <span className="ml-2 text-sm font-normal text-slate-500">(Optional)</span>
            </h3>
            <p className="text-slate-600">
              Add backup recovery methods for extra security
            </p>
          </div>
        </div>

        {/* Backup Email Option */}
        <div className="space-y-4">
          <div className="p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">✉️</span>
                <div>
                  <h4 className="font-medium text-slate-800">Backup Email</h4>
                  <p className="text-sm text-slate-600">Use a different email address for recovery</p>
                </div>
              </div>
              {!setupBackupEmail && !emailVerified && (
                <button
                  onClick={() => setSetupBackupEmail(true)}
                  className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Set up
                </button>
              )}
              {emailVerified && (
                <CheckCircleIconSolid className="w-5 h-5 text-emerald-600" />
              )}
            </div>

            {setupBackupEmail && !emailVerified && (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="backupEmail" className="block text-sm font-medium text-slate-700 mb-1">
                    Backup Email Address
                  </label>
                  <input
                    id="backupEmail"
                    type="email"
                    value={backupEmail}
                    onChange={(e) => {
                      setBackupEmail(e.target.value);
                      setBackupEmailError('');
                    }}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors ${
                      backupEmailError ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
                    }`}
                    placeholder="backup@example.com"
                  />
                  {backupEmailError && (
                    <p className="mt-1 text-sm text-red-600">{backupEmailError}</p>
                  )}
                </div>
                <button
                  onClick={handleSetupBackupEmail}
                  disabled={isVerifyingEmail}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isVerifyingEmail ? 'Sending verification...' : 'Verify Email'}
                </button>
              </div>
            )}

            {emailVerified && (
              <div className="mt-3 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                ✓ Backup email verified: {backupEmail}
              </div>
            )}
          </div>

          {/* SMS Option - Coming Soon */}
          <div className="p-4 border border-slate-200 rounded-xl opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">📱</span>
                <div>
                  <h4 className="font-medium text-slate-800">SMS Recovery</h4>
                  <p className="text-sm text-slate-600">Recover via text message</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleComplete}
          disabled={!codeCopied && !codeDownloaded}
          className={`px-8 py-3.5 font-medium rounded-xl transition-all ${
            codeCopied || codeDownloaded
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transform hover:-translate-y-0.5 shadow-sm hover:shadow-md'
              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
          }`}
        >
          {codeCopied || codeDownloaded ? 'Continue to Dashboard' : 'Please save your recovery code first'}
        </button>
      </div>
    </div>
  );
}