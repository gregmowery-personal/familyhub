"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingButton from '@/components/LoadingButton';

function DashboardContent() {
  const { user, profile, families, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-base-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-base-content">FamilyHub Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-base-content/70">
                Welcome, {profile?.first_name || user?.email}
              </div>
              <LoadingButton
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-base-content/70 hover:text-base-content"
              >
                Sign Out
              </LoadingButton>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-base-200">
            <h2 className="text-2xl font-bold text-base-content mb-4">
              Welcome to FamilyHub! 
            </h2>
            <p className="text-base-content/70 mb-6">
              You&apos;ve successfully connected to your authentication system. Here&apos;s your account information:
            </p>

            {/* User Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-base-content">Account Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Email:</span>
                    <span className="text-base-content/70">{user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">User ID:</span>
                    <span className="text-base-content/70 font-mono text-xs">{user?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Email Verified:</span>
                    <span className={`${user?.email_confirmed_at ? 'text-success' : 'text-warning'}`}>
                      {user?.email_confirmed_at ? 'Yes' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Member Since:</span>
                    <span className="text-base-content/70">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {profile && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-base-content">Profile Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span className="text-base-content/70">
                        {profile.first_name || profile.last_name 
                          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                          : 'Not set'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Display Name:</span>
                      <span className="text-base-content/70">{profile.display_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Phone:</span>
                      <span className="text-base-content/70">{profile.phone_number || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Language:</span>
                      <span className="text-base-content/70">{profile.preferred_language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Timezone:</span>
                      <span className="text-base-content/70">{profile.timezone}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Families Section */}
          {families && families.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-base-200">
              <h3 className="text-lg font-semibold text-base-content mb-4">Your Families</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {families.map((family) => (
                  <div key={family.id} className="border border-base-200 rounded-lg p-4">
                    <h4 className="font-medium text-base-content">{family.name}</h4>
                    <p className="text-sm text-base-content/70 capitalize">{family.family_type.replace('_', ' ')}</p>
                    <p className="text-xs text-base-content/50 mt-2">
                      Members: {family.family_members?.length || 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-base-200">
            <h3 className="text-lg font-semibold text-base-content mb-4">Authentication Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Login/Signup</h4>
                <p className="text-sm text-base-content/70">Connected to API endpoints</p>
              </div>

              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Session Management</h4>
                <p className="text-sm text-base-content/70">Auto-refresh & expiry handling</p>
              </div>

              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Protected Routes</h4>
                <p className="text-sm text-base-content/70">Route protection & redirects</p>
              </div>

              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Social Auth</h4>
                <p className="text-sm text-base-content/70">Google & Apple integration</p>
              </div>

              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Password Reset</h4>
                <p className="text-sm text-base-content/70">Secure email-based reset</p>
              </div>

              <div className="text-center p-4 border border-success/20 rounded-lg bg-success/5">
                <div className="w-12 h-12 mx-auto mb-3 bg-success/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="font-medium text-base-content">✅ Remember Me</h4>
                <p className="text-sm text-base-content/70">Persistent login option</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute requireEmailVerification={false}>
      <DashboardContent />
    </ProtectedRoute>
  );
}