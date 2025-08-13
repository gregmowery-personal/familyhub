"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import InviteFamilyMemberWizard from '@/components/family/InviteFamilyMemberWizard';
import PendingInvitations from '@/components/family/PendingInvitations';
import LoadingButton from '@/components/LoadingButton';
import ProtectedRoute from '@/components/ProtectedRoute';

interface FamilyMember {
  id: string;
  display_name: string | null;
  relationship: string | null;
  email: string;
  role: {
    name: string;
    type: string;
  };
  joined_at: string;
}

interface Family {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  created_at: string;
  member_count: number;
}

function FamilyPageContent() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const familyId = params.id as string;
  
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteWizard, setShowInviteWizard] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (familyId) {
      fetchFamilyData();
    }
  }, [familyId]);

  const fetchFamilyData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch family details
      const familyResponse = await fetch(`/api/families/${familyId}`);
      const familyResult = await familyResponse.json();
      
      if (familyResult.success) {
        setFamily(familyResult.family);
      } else {
        setError(familyResult.error || 'Failed to load family');
      }
      
      // Fetch family members
      const membersResponse = await fetch(`/api/families/${familyId}/members`);
      const membersResult = await membersResponse.json();
      
      if (membersResult.success) {
        setMembers(membersResult.members || []);
      }
    } catch (err) {
      console.error('Error fetching family data:', err);
      setError('Unable to load family information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteSent = () => {
    setShowInviteWizard(false);
    fetchFamilyData(); // Refresh the member list
  };

  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    adult: 'bg-blue-100 text-blue-700',
    teen: 'bg-green-100 text-green-700',
    child: 'bg-yellow-100 text-yellow-700',
    senior: 'bg-orange-100 text-orange-700'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading family information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Family</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (showInviteWizard) {
    return (
      <InviteFamilyMemberWizard
        familyId={familyId}
        onInviteSent={handleInviteSent}
        onClose={() => setShowInviteWizard(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-[#87A89A]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Back to dashboard"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-slate-800">{family?.name || 'Family'}</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowInviteWizard(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#87A89A] to-[#9B98B0] text-white font-medium rounded-lg hover:shadow-md transition-all"
              >
                + Invite Member
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Family Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{family?.name}</h2>
                {family?.description && (
                  <p className="text-slate-600 mb-4">{family.description}</p>
                )}
                <div className="flex items-center gap-6 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{members.length} {members.length === 1 ? 'Member' : 'Members'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{family?.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Created {family?.created_at ? new Date(family.created_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Family Members</h3>
            </div>
            <div className="p-6">
              {members.length <= 1 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-slate-800 mb-2">
                    {members.length === 0 ? 'Getting started with your family' : 'You\'re the only member so far'}
                  </h4>
                  <p className="text-slate-600 mb-6">
                    Invite family members to start coordinating together. They'll receive an email invitation to join.
                  </p>
                  <button
                    onClick={() => setShowInviteWizard(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#87A89A] to-[#9B98B0] text-white font-medium rounded-lg hover:shadow-md transition-all"
                  >
                    Invite Family Members
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map((member) => (
                    <div key={member.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {member.display_name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-800">
                              {member.display_name || member.email.split('@')[0]}
                            </h4>
                            <p className="text-xs text-slate-500">{member.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {member.relationship && (
                          <div className="text-sm text-slate-600">
                            <span className="font-medium">Relationship:</span> {member.relationship}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[member.role.type as keyof typeof roleColors] || 'bg-gray-100 text-gray-700'}`}>
                            {member.role.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pending Invitations */}
          <PendingInvitations familyId={familyId} />
        </div>
      </main>
    </div>
  );
}

export default function FamilyPage() {
  return (
    <ProtectedRoute requireEmailVerification={false}>
      <FamilyPageContent />
    </ProtectedRoute>
  );
}