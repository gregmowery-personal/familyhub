"use client";

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingButton from '@/components/LoadingButton';
import MembershipTiers from '@/components/MembershipTiers';

function DashboardContent() {
  const { user, profile, families, signOut } = useAuth();
  const router = useRouter();
  
  // Check if this is a new user (no families)
  const isNewUser = !families || families.length === 0;

  const handleSignOut = async () => {
    await signOut();
  };

  const handleStartHere = () => {
    router.push('/family/create');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-[#87A89A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {/* Logo matching login/signup */}
              <svg
                width="36"
                height="36"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="50" cy="50" r="18" fill="#C5DAD1" stroke="#6B7280" strokeWidth="2" opacity="0.9" />
                <circle cx="30" cy="25" r="10" fill="#9B98B0" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                <circle cx="70" cy="25" r="12" fill="#87A89A" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                <circle cx="25" cy="75" r="11" fill="#9B98B0" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                <circle cx="75" cy="75" r="10" fill="#87A89A" stroke="#6B7280" strokeWidth="1.5" opacity="0.85" />
                <g stroke="#87A89A" strokeWidth="2" strokeLinecap="round" opacity="0.4">
                  <path d="M38 35 L42 42" />
                  <path d="M62 35 L58 42" />
                  <path d="M32 65 L42 58" />
                  <path d="M68 65 L58 58" />
                </g>
                <path d="M47 47 Q47 44 50 44 Q53 44 53 47 Q53 49 50 52 Q47 49 47 47" fill="#6B7280" opacity="0.7" />
              </svg>
              <h1 className="text-xl font-semibold bg-gradient-to-r from-[#87A89A] to-[#9B98B0] bg-clip-text text-transparent">FamilyHub Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Welcome, {profile?.first_name || user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-[#9B98B0] hover:text-[#87A89A] hover:bg-purple-50 rounded-xl transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* New User Hero Section */}
          {isNewUser && (
            <div className="bg-gradient-to-br from-[#87A89A]/10 via-purple-50/40 to-[#9B98B0]/10 rounded-3xl shadow-xl border border-[#87A89A]/30 overflow-hidden">
              <div className="p-8 lg:p-12">
                <div className="max-w-3xl mx-auto text-center">
                  {/* Welcome Icon */}
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#87A89A]/20 to-[#9B98B0]/20 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-[#87A89A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  
                  <h1 className="text-3xl lg:text-4xl font-bold mb-4">
                    <span className="text-slate-800">Welcome to </span>
                    <span className="bg-gradient-to-r from-[#87A89A] to-[#9B98B0] bg-clip-text text-transparent">FamilyHub!</span>
                  </h1>
                  
                  <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                    You&apos;re all set up and ready to start coordinating with your family. 
                    Let&apos;s begin by creating your first family group - it only takes a minute!
                  </p>
                  
                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-[#87A89A]/20">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">Getting Started is Easy:</h2>
                    <div className="grid md:grid-cols-3 gap-4 text-left">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-[#87A89A]/20 rounded-full flex items-center justify-center">
                          <span className="text-[#87A89A] font-semibold text-sm">1</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">Create Your Family</h3>
                          <p className="text-sm text-slate-600 mt-1">Set up your family group with a name and timezone</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-[#9B98B0]/20 rounded-full flex items-center justify-center">
                          <span className="text-[#9B98B0] font-semibold text-sm">2</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">Invite Members</h3>
                          <p className="text-sm text-slate-600 mt-1">Add family members, caregivers, and trusted contacts</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-[#87A89A]/20 rounded-full flex items-center justify-center">
                          <span className="text-[#87A89A] font-semibold text-sm">3</span>
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">Start Coordinating</h3>
                          <p className="text-sm text-slate-600 mt-1">Share calendars, tasks, and important information</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleStartHere}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#87A89A] to-[#9B98B0] hover:from-[#7A9A8D] hover:to-[#8E8BA3] text-white font-semibold text-lg rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Start Here - Create Your Family
                  </button>
                  
                  <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#87A89A]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                      <span>100% Private & Secure</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#87A89A]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Free to Get Started</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#87A89A]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span>Built for Families</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Welcome Section - Show for existing users */}
          {!isNewUser && (
            <div className="bg-gradient-to-br from-purple-50 via-white to-emerald-50 rounded-3xl shadow-xl p-8 border border-purple-100">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-black mb-3">
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-emerald-500 bg-clip-text text-transparent">
                  Welcome to FamilyHub!
                </span>
                <span className="ml-3 text-4xl">🎉</span>
              </h2>
              <div className="flex justify-center mb-4">
                <div className="h-1 w-32 bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 rounded-full"></div>
              </div>
              <p className="text-lg text-slate-700 font-medium max-w-2xl mx-auto">
                You&apos;ve successfully connected to your authentication system. Here&apos;s your account information:
              </p>
            </div>

            {/* User Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Details Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  Account Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Email:</span>
                    <span className="text-sm text-slate-800 font-medium">{user?.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-600">User ID:</span>
                    <span className="text-xs text-slate-600 font-mono bg-slate-50 px-2 py-1 rounded">{user?.id?.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm font-medium text-slate-600">Email Verified:</span>
                    <span className={`text-sm font-semibold ${user?.email_confirmed_at ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {user?.email_confirmed_at ? '✓ Yes' : '⏳ Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-slate-600">Member Since:</span>
                    <span className="text-sm text-slate-800 font-medium">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Information Card */}
              {profile && (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-emerald-100">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📝</span>
                    Profile Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Name:</span>
                      <span className="text-sm text-slate-800 font-medium">
                        {profile.first_name || profile.last_name 
                          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                          : 'Not set'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Display Name:</span>
                      <span className="text-sm text-slate-800 font-medium">{profile.display_name || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Phone:</span>
                      <span className="text-sm text-slate-800 font-medium">{profile.phone_number || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm font-medium text-slate-600">Language:</span>
                      <span className="text-sm text-slate-800 font-medium">{profile.preferred_language || 'English'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-slate-600">Timezone:</span>
                      <span className="text-sm text-slate-800 font-medium">{profile.timezone || 'UTC'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Families Section */}
          {families && families.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 via-white to-purple-50 rounded-3xl shadow-xl p-8 border border-emerald-100">
              <h3 className="text-2xl font-bold text-center text-slate-800 mb-6">Your Families</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {families.map((family) => (
                  <div key={family.id} className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all border border-emerald-100 hover:border-emerald-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl">👨‍👩‍👧‍👦</span>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                        Active
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-slate-800 mb-2">{family.name}</h4>
                    <p className="text-sm text-purple-600 font-medium capitalize mb-3">
                      {family.family_type?.replace('_', ' ') || 'Family'}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-600 font-medium">
                        Members: <span className="font-bold text-slate-800">{family.member_count || 1}</span>
                      </span>
                      <button 
                        onClick={() => router.push(`/family/${family.id}`)}
                        className={`text-xs px-3 py-1 font-semibold rounded-lg transition-colors ${
                          (family.member_count || 1) === 1 
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                        }`}>
                        {(family.member_count || 1) === 1 ? 'Setup Family →' : 'View Family →'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Membership Tiers Section */}
          <div className="rounded-3xl overflow-hidden">
            <MembershipTiers />
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