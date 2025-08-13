"use client";

import React, { useState, useEffect } from 'react';

interface PendingInvitation {
  id: string;
  email: string;
  roleType: 'admin' | 'adult' | 'teen' | 'child' | 'senior';
  relationship: string;
  sentAt: string;
  expiresAt: string;
  status: 'pending' | 'expired' | 'accepted' | 'cancelled';
}

interface PendingInvitationsProps {
  familyId: string;
}

const roleLabels = {
  admin: 'Admin',
  adult: 'Adult',
  teen: 'Teen',
  child: 'Child',
  senior: 'Senior'
};

const roleIcons = {
  admin: '👑',
  adult: '👨‍👩‍👧‍👦',
  teen: '🧑‍🎓',
  child: '🧒',
  senior: '👵'
};

export default function PendingInvitations({ familyId }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, [familyId]);

  const fetchInvitations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/families/${familyId}/invitations`);
      const result = await response.json();

      if (result.success) {
        setInvitations(result.invitations || []);
      } else {
        setError(result.error || 'Failed to load invitations');
      }
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setError('Unable to load pending invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    setCancellingId(invitationId);
    
    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        // Remove the cancelled invitation from the list
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      } else {
        setError(result.error || 'Failed to cancel invitation');
      }
    } catch (err) {
      console.error('Error cancelling invitation:', err);
      setError('Unable to cancel invitation');
    } finally {
      setCancellingId(null);
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        // Refresh the invitations list to get updated sent date
        fetchInvitations();
      } else {
        setError(result.error || 'Failed to resend invitation');
      }
    } catch (err) {
      console.error('Error resending invitation:', err);
      setError('Unable to resend invitation');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show the component if there are no invitations
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800">
          Pending Invitations
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Invitations you've sent that haven't been accepted yet
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Invitations List */}
      <div className="p-6">
        <div className="space-y-4">
          {invitations.map((invitation) => {
            const expired = isExpired(invitation.expiresAt);
            
            return (
              <div
                key={invitation.id}
                className={`p-4 rounded-xl border transition-colors ${
                  expired 
                    ? 'border-orange-200 bg-orange-50/50' 
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Role Icon */}
                    <div className="flex-shrink-0">
                      <span className="text-2xl" aria-hidden="true">
                        {roleIcons[invitation.roleType]}
                      </span>
                    </div>

                    {/* Invitation Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-800 truncate">
                          {invitation.email}
                        </h4>
                        <span className="flex-shrink-0 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          {roleLabels[invitation.roleType]}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>{invitation.relationship}</span>
                        <span>•</span>
                        <span>Sent {formatDate(invitation.sentAt)}</span>
                        {expired && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600 font-medium">Expired</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {expired ? (
                      <button
                        onClick={() => resendInvitation(invitation.id)}
                        className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                      >
                        Resend
                      </button>
                    ) : (
                      <button
                        onClick={() => resendInvitation(invitation.id)}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Resend
                      </button>
                    )}
                    
                    <button
                      onClick={() => cancelInvitation(invitation.id)}
                      disabled={cancellingId === invitation.id}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancellingId === invitation.id ? (
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Cancelling...
                        </span>
                      ) : (
                        'Cancel'
                      )}
                    </button>
                  </div>
                </div>

                {/* Expiration Warning */}
                {!expired && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                      Expires on {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
              <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-600">
                Invitations expire after 7 days for security. You can resend expired invitations or 
                cancel them if the person no longer needs access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}