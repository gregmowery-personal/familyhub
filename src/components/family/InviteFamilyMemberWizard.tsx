"use client";

import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import RoleSelector from './RoleSelector';
import PendingInvitations from './PendingInvitations';

interface InviteFormData {
  email: string;
  roleType: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
  relationship: string;
  personalMessage: string;
}

interface InviteFamilyMemberWizardProps {
  familyId: string;
  onInviteSent?: (invitation: any) => void;
  onClose?: () => void;
}

export default function InviteFamilyMemberWizard({ 
  familyId, 
  onInviteSent, 
  onClose 
}: InviteFamilyMemberWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    roleType: 'adult',
    relationship: '',
    personalMessage: 'Hi! I\'d love to have you join our family coordination on FamilyHub. It helps us stay organized and connected.',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({});

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof InviteFormData, string>> = {};
    
    if (step === 1) {
      if (!formData.email.trim()) {
        newErrors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }
    
    if (step === 2) {
      if (!formData.relationship.trim()) {
        newErrors.relationship = 'Please describe your relationship';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof InviteFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (roleType: 'admin' | 'adult' | 'teen' | 'child' | 'senior') => {
    setFormData(prev => ({ ...prev, roleType }));
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/families/${familyId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          roleType: formData.roleType,
          relationship: formData.relationship,
          personalMessage: formData.personalMessage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Invitation sent successfully!');
        setCurrentStep(3);
        if (onInviteSent) {
          onInviteSent(result.invitation);
        }
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Invitation error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === currentStep
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                : step < currentStep
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'
            }`}
            aria-label={`Step ${step}`}
          >
            {step < currentStep ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              step
            )}
          </div>
          {step < 3 && (
            <div className={`w-12 h-0.5 mx-2 transition-colors ${
              step < currentStep ? 'bg-emerald-200' : 'bg-slate-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          Who would you like to invite?
        </h3>
        <p className="text-slate-600">
          Enter their email address to get started
        </p>
      </div>

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
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base ${
            errors.email ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
          }`}
          placeholder="their-email@example.com"
          required
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
            {errors.email}
          </p>
        )}
        <p className="mt-2 text-sm text-slate-500">
          They'll receive an email invitation to join your family on FamilyHub
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          Choose their role & relationship
        </h3>
        <p className="text-slate-600">
          This helps us provide the right experience for them
        </p>
      </div>

      <RoleSelector
        selectedRole={formData.roleType}
        onRoleChange={handleRoleChange}
      />

      <div>
        <label htmlFor="relationship" className="block text-sm font-medium text-slate-700 mb-1.5">
          How are they related to your family?
        </label>
        <input
          id="relationship"
          name="relationship"
          type="text"
          value={formData.relationship}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base ${
            errors.relationship ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
          }`}
          placeholder="e.g., My spouse, Our daughter, Grandma, Close friend"
          required
        />
        {errors.relationship && (
          <p className="mt-1 text-sm text-red-600" role="alert" aria-live="polite">
            {errors.relationship}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="personalMessage" className="block text-sm font-medium text-slate-700 mb-1.5">
          Personal message <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="personalMessage"
          name="personalMessage"
          rows={3}
          value={formData.personalMessage}
          onChange={handleInputChange}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-slate-800 text-base resize-none"
          placeholder="Add a personal note to your invitation..."
        />
        <p className="mt-2 text-sm text-slate-500">
          This message will be included in their invitation email
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          Invitation sent!
        </h3>
        <p className="text-slate-600 mb-4">
          We've sent an invitation to <strong>{formData.email}</strong>
        </p>
        <div className="bg-slate-50 rounded-xl p-4 text-left">
          <h4 className="font-medium text-slate-800 mb-2">What happens next?</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              They'll receive an email with your invitation
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              They can create their account and join your family
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              You'll see them in your family member list once they accept
            </li>
          </ul>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl" role="status" aria-live="polite">
          <p className="text-emerald-800 text-sm font-medium">{success}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                Invite Family Member
              </h2>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Close invitation wizard"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {renderStepIndicator()}
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert" aria-live="assertive">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </div>

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100">
              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    currentStep === 1
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white'
                  }`}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Back
                </button>

                {currentStep < 2 ? (
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Next
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium rounded-lg shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Invitation
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Final step actions */}
          {currentStep === 3 && (
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setFormData({
                      email: '',
                      roleType: 'adult',
                      relationship: '',
                      personalMessage: 'Hi! I\'d love to have you join our family coordination on FamilyHub. It helps us stay organized and connected.',
                    });
                    setError('');
                    setSuccess('');
                  }}
                  className="px-6 py-2 bg-white border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                >
                  Invite Another Member
                </button>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="mt-8">
          <PendingInvitations familyId={familyId} />
        </div>
      </div>
    </div>
  );
}