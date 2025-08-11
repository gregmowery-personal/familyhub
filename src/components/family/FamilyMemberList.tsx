'use client';

import { useState } from 'react';
import { type FamilyMember } from '@/lib/actions/family-actions';

interface FamilyMemberListProps {
  members: FamilyMember[];
  familyId: string;
}

function MemberCard({ member }: { member: FamilyMember }) {
  const getRoleColor = (roleType: string) => {
    switch (roleType) {
      case 'family_coordinator':
        return 'bg-gradient-to-br from-purple-100 to-purple-50 text-purple-800 border-purple-200';
      case 'caregiver':
        return 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-800 border-emerald-200';
      case 'care_recipient':
        return 'bg-gradient-to-br from-blue-100 to-blue-50 text-blue-800 border-blue-200';
      case 'helper':
        return 'bg-gradient-to-br from-orange-100 to-orange-50 text-orange-800 border-orange-200';
      case 'emergency_contact':
        return 'bg-gradient-to-br from-red-100 to-red-50 text-red-800 border-red-200';
      case 'child':
        return 'bg-gradient-to-br from-yellow-100 to-yellow-50 text-yellow-800 border-yellow-200';
      case 'viewer':
        return 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-800 border-slate-200';
      default:
        return 'bg-gradient-to-br from-slate-100 to-slate-50 text-slate-800 border-slate-200';
    }
  };

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case 'family_coordinator':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        );
      case 'caregiver':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        );
      case 'care_recipient':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2L3 7v11c0 1.1.9 2 2 2h4v-6h2v6h4c1.1 0 2-.9 2-2V7l-7-5z" />
          </svg>
        );
      case 'child':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatJoinedDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDisplayName = () => {
    if (member.display_name) return member.display_name;
    return member.email.split('@')[0];
  };

  return (
    <div className="group bg-slate-50/50 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-4 transition-all duration-200 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center">
            <span className="text-emerald-700 font-semibold text-lg">
              {getDisplayName().charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Member Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-800 truncate">
                {getDisplayName()}
              </h3>
              {member.relationship && (
                <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                  {member.relationship}
                </span>
              )}
            </div>
            
            <p className="text-sm text-slate-600 truncate mb-1">
              {member.email}
            </p>
            
            <p className="text-xs text-slate-500">
              Joined {formatJoinedDate(member.joined_at)}
            </p>
          </div>
        </div>

        {/* Role Badge & Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 ${getRoleColor(member.role.type)}`}>
            {getRoleIcon(member.role.type)}
            <span className="capitalize">{member.role.name}</span>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button className="p-2 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteMemberButton({ familyId }: { familyId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full p-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-2xl text-slate-500 hover:text-emerald-600 transition-all duration-200 hover:bg-emerald-50/30 group"
      >
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 bg-slate-100 group-hover:bg-emerald-100 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-medium">Invite Family Member</p>
            <p className="text-xs opacity-75">Add someone to your family</p>
          </div>
        </div>
      </button>

      {/* TODO: Add InviteMemberModal component */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Invite Family Member</h3>
            <p className="text-sm text-slate-600 mb-4">
              Invitation functionality coming soon! You'll be able to invite family members by email.
            </p>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2 px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function FamilyMemberList({ members, familyId }: FamilyMemberListProps) {
  if (!members?.length) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No family members yet</h3>
          <p className="text-slate-600 text-sm mb-6">
            Invite family members to start coordinating together
          </p>
        </div>
        
        <InviteMemberButton familyId={familyId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Member Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
        <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
          View All Roles
        </button>
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {/* Invite Button */}
      <div className="pt-4 border-t border-slate-200">
        <InviteMemberButton familyId={familyId} />
      </div>
    </div>
  );
}