"use client";

import React from 'react';

interface RoleSelectorProps {
  selectedRole: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
  onRoleChange: (role: 'admin' | 'adult' | 'teen' | 'child' | 'senior') => void;
}

interface RoleOption {
  value: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
  label: string;
  description: string;
  icon: string;
  ageRange?: string;
  permissions: string[];
}

const roleOptions: RoleOption[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Primary parent or guardian with full access to family coordination',
    icon: '👑',
    permissions: [
      'Manage all family settings',
      'Invite and remove family members',
      'Access all family information',
      'Control privacy settings'
    ]
  },
  {
    value: 'adult',
    label: 'Adult',
    description: 'Secondary parent, adult child, or trusted family member',
    icon: '👨‍👩‍👧‍👦',
    permissions: [
      'View and edit family calendar',
      'Manage tasks and reminders',
      'Access family documents',
      'Limited member management'
    ]
  },
  {
    value: 'teen',
    label: 'Teen',
    description: 'Age-appropriate access for teenagers',
    icon: '🧑‍🎓',
    ageRange: '13-17 years',
    permissions: [
      'View family calendar',
      'Manage their own tasks',
      'Access shared documents',
      'Teen-friendly interface'
    ]
  },
  {
    value: 'child',
    label: 'Child',
    description: 'Safe, simplified access for younger family members',
    icon: '🧒',
    ageRange: '8-12 years',
    permissions: [
      'View age-appropriate calendar items',
      'Simple task management',
      'Child-friendly interface',
      'Supervised access only'
    ]
  },
  {
    value: 'senior',
    label: 'Senior',
    description: 'Simplified interface designed for grandparents and older adults',
    icon: '👵',
    permissions: [
      'Easy-to-use interface',
      'View family updates',
      'Participate in coordination',
      'Large text and buttons'
    ]
  }
];

export default function RoleSelector({ selectedRole, onRoleChange }: RoleSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-medium text-slate-800 mb-2">
          Choose their role in your family
        </h4>
        <p className="text-sm text-slate-600 mb-4">
          This determines what they can see and do in your family coordination
        </p>
      </div>

      <div className="space-y-3">
        {roleOptions.map((role) => (
          <label
            key={role.value}
            className={`block cursor-pointer transition-all duration-200 ${
              selectedRole === role.value
                ? 'ring-2 ring-purple-500/20'
                : 'hover:ring-2 hover:ring-slate-200'
            }`}
          >
            <div
              className={`p-4 rounded-xl border-2 transition-colors ${
                selectedRole === role.value
                  ? 'border-purple-500 bg-purple-50/50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Radio Button */}
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={(e) => onRoleChange(e.target.value as any)}
                  className="mt-1 w-5 h-5 text-purple-600 bg-white border-slate-300 focus:ring-purple-500/20 focus:ring-2 cursor-pointer"
                  aria-describedby={`role-${role.value}-description`}
                />

                {/* Role Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl" aria-hidden="true">{role.icon}</span>
                    <div>
                      <h5 className="text-base font-semibold text-slate-800">
                        {role.label}
                      </h5>
                      {role.ageRange && (
                        <span className="text-xs text-slate-500 font-medium">
                          {role.ageRange}
                        </span>
                      )}
                    </div>
                  </div>

                  <p 
                    id={`role-${role.value}-description`}
                    className="text-sm text-slate-600 mb-3"
                  >
                    {role.description}
                  </p>

                  {/* Permissions List */}
                  <div className="space-y-1">
                    {role.permissions.map((permission, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full flex-shrink-0" />
                        <span>{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-slate-50 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h6 className="text-sm font-medium text-slate-800 mb-1">
              Need help choosing?
            </h6>
            <p className="text-sm text-slate-600">
              You can always change someone's role later in your family settings. 
              Start with the role that best matches their current involvement in family coordination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}