'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFamily, type CreateFamilyData } from '@/lib/actions/family-actions';
import LoadingButton from '@/components/LoadingButton';

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: 'Family Details',
    description: 'Tell us about your family'
  },
  {
    id: 2,
    title: 'Preferences',
    description: 'Set up your family preferences'
  },
  {
    id: 3,
    title: 'Review & Create',
    description: 'Review and create your family'
  }
];

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

export default function CreateFamilyWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState<CreateFamilyData>({
    name: '',
    description: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    primaryCaregiverEmail: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateFamilyData, string>>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name as keyof CreateFamilyData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof CreateFamilyData, string>> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Family name is required';
      } else if (formData.name.length < 2) {
        newErrors.name = 'Family name must be at least 2 characters';
      }
    }

    if (step === 2) {
      if (!formData.timezone) {
        newErrors.timezone = 'Please select a timezone';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    console.log('🎯 [CreateFamilyWizard] handleSubmit called');
    
    if (!validateStep(currentStep)) {
      console.log('❌ [CreateFamilyWizard] Validation failed for step', currentStep);
      return;
    }

    setIsLoading(true);
    setError('');

    console.log('📝 [CreateFamilyWizard] Submitting family data:', {
      name: formData.name,
      hasDescription: !!formData.description,
      descriptionLength: formData.description?.length || 0,
      timezone: formData.timezone,
      hasPrimaryCaregiverEmail: !!formData.primaryCaregiverEmail
    });

    try {
      console.log('🚀 [CreateFamilyWizard] Calling createFamily action...');
      const result = await createFamily(formData);
      console.log('📦 [CreateFamilyWizard] createFamily result:', result);

      if (result.success) {
        console.log('✅ [CreateFamilyWizard] Family created successfully!', {
          familyId: result.family?.id,
          familyName: result.family?.name
        });
        setSuccess('Family created successfully! Redirecting to your dashboard...');
        setTimeout(() => {
          console.log('🔄 [CreateFamilyWizard] Redirecting to dashboard...');
          router.push('/dashboard');
        }, 2000);
      } else {
        console.error('❌ [CreateFamilyWizard] Family creation failed:', result.error);
        setError(result.error || 'Failed to create family');
      }
    } catch (err) {
      console.error('💥 [CreateFamilyWizard] Unexpected error:', err);
      console.error('   Error details:', {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
        stack: (err as Error)?.stack
      });
      setError('An unexpected error occurred. Please try again.');
    } finally {
      console.log('🏁 [CreateFamilyWizard] handleSubmit completed');
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {WIZARD_STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-colors ${
                step.id <= currentStep
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step.id < currentStep ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                step.id
              )}
            </div>
          </div>
          {index < WIZARD_STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mx-4 transition-colors ${
                step.id < currentStep ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {WIZARD_STEPS[0].title}
        </h2>
        <p className="text-slate-600">
          {WIZARD_STEPS[0].description}
        </p>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
          Family Name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-slate-800 ${
            errors.name ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
          }`}
          placeholder="The Johnson Family"
          maxLength={200}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          This will be visible to all family members
        </p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
          Family Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-slate-800 resize-none"
          placeholder="A brief description of your family (optional)"
          maxLength={500}
        />
        <p className="mt-1 text-xs text-slate-500">
          {(formData.description || '').length}/500 characters
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {WIZARD_STEPS[1].title}
        </h2>
        <p className="text-slate-600">
          {WIZARD_STEPS[1].description}
        </p>
      </div>

      <div>
        <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-2">
          Family Timezone *
        </label>
        <select
          id="timezone"
          name="timezone"
          value={formData.timezone}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-slate-800 ${
            errors.timezone ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
          }`}
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        {errors.timezone && (
          <p className="mt-1 text-sm text-red-600">{errors.timezone}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          This will be used for scheduling and reminders
        </p>
      </div>

      <div>
        <label htmlFor="primaryCaregiverEmail" className="block text-sm font-medium text-slate-700 mb-2">
          Primary Caregiver Email
        </label>
        <input
          id="primaryCaregiverEmail"
          name="primaryCaregiverEmail"
          type="email"
          value={formData.primaryCaregiverEmail || ''}
          onChange={handleInputChange}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors text-slate-800"
          placeholder="caregiver@example.com"
        />
        <p className="mt-2 text-xs text-slate-500">
          Optional: Invite a primary caregiver when the family is created
        </p>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {WIZARD_STEPS[2].title}
        </h2>
        <p className="text-slate-600">
          {WIZARD_STEPS[2].description}
        </p>
      </div>

      <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-emerald-800 mb-4">Family Summary</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-emerald-700 font-medium">Family Name:</span>
            <span className="text-emerald-900">{formData.name}</span>
          </div>
          
          {formData.description && (
            <div className="flex justify-between items-start">
              <span className="text-emerald-700 font-medium">Description:</span>
              <span className="text-emerald-900 text-right max-w-xs">{formData.description}</span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-emerald-700 font-medium">Timezone:</span>
            <span className="text-emerald-900">
              {TIMEZONE_OPTIONS.find(tz => tz.value === formData.timezone)?.label}
            </span>
          </div>
          
          {formData.primaryCaregiverEmail && (
            <div className="flex justify-between items-center">
              <span className="text-emerald-700 font-medium">Primary Caregiver:</span>
              <span className="text-emerald-900">{formData.primaryCaregiverEmail}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">
            <p className="text-blue-800 font-medium">What happens next?</p>
            <p className="text-blue-700 mt-1">
              You'll be the family coordinator with full access to invite members, manage settings, and coordinate family activities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-50 via-green-50/40 to-slate-50 p-8 border-b border-slate-200/50">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Create Your Family</h1>
              <p className="text-slate-600">Let's set up your family coordination hub</p>
            </div>
          </div>

          <div className="p-8">
            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-800 text-sm font-medium">{success}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Step Content */}
            {renderCurrentStep()}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              {currentStep > 1 ? (
                <button
                  onClick={prevStep}
                  disabled={isLoading}
                  className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < WIZARD_STEPS.length ? (
                <button
                  onClick={nextStep}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Continue
                </button>
              ) : (
                <LoadingButton
                  onClick={handleSubmit}
                  loading={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  Create Family
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}