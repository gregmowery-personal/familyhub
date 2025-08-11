import { getFamilyDashboard, getFamilyMembers } from '@/lib/actions/family-actions';
import FamilyMemberList from './FamilyMemberList';

interface FamilyDashboardProps {
  familyId: string;
}

async function FamilyStatsCard({ 
  title, 
  value, 
  subtext, 
  icon, 
  color = 'sage' 
}: { 
  title: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ReactNode; 
  color?: 'sage' | 'lavender' | 'blue' 
}) {
  const colorClasses = {
    sage: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 text-emerald-800',
    lavender: 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200 text-purple-800',
    blue: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`rounded-2xl border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-3 bg-white/60 rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium opacity-80">{title}</p>
        {subtext && (
          <p className="text-xs opacity-60">{subtext}</p>
        )}
      </div>
    </div>
  );
}

function RecentActivityItem({ activity }: { 
  activity: { 
    id: string; 
    type: string; 
    message: string; 
    timestamp: string; 
    user_name?: string; 
  } 
}) {
  const timeAgo = new Date(activity.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_joined':
        return (
          <div className="p-2 bg-emerald-100 rounded-full">
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-100 rounded-full">
            <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl">
      {getActivityIcon(activity.type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{activity.message}</p>
        <p className="text-xs text-slate-600 mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );
}

export default async function FamilyDashboard({ familyId }: FamilyDashboardProps) {
  const [dashboardResult, membersResult] = await Promise.all([
    getFamilyDashboard(familyId),
    getFamilyMembers(familyId)
  ]);

  if (!dashboardResult.success || !membersResult.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="text-red-800">
              {dashboardResult.error || membersResult.error || 'Failed to load family dashboard'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { family, stats, recentActivity } = dashboardResult.data!;
  const { members } = membersResult;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-emerald-50/10 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/50 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">
                {family.name}
              </h1>
              {family.description && (
                <p className="text-slate-600 max-w-2xl">{family.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {family.timezone}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  {family.subscription_status}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
                Invite Member
              </button>
              <button className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-xl shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-200">
                Family Settings
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FamilyStatsCard
            title="Family Members"
            value={`${stats.totalMembers}/${stats.maxMembers}`}
            subtext={`${stats.maxMembers - stats.totalMembers} spots available`}
            color="sage"
            icon={
              <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
            }
          />
          
          <FamilyStatsCard
            title="Pending Invites"
            value={stats.pendingInvitations}
            subtext="Awaiting response"
            color="lavender"
            icon={
              <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            }
          />
          
          <FamilyStatsCard
            title="Recent Activity"
            value={stats.recentActivity}
            subtext="This week"
            color="blue"
            icon={
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            }
          />
          
          <FamilyStatsCard
            title="Plan"
            value={family.subscription_tiers?.name || 'Free'}
            subtext="Active subscription"
            color="sage"
            icon={
              <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Family Members */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/50 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Family Members</h2>
                <button className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
                  Manage Roles
                </button>
              </div>
              
              <FamilyMemberList members={members} familyId={familyId} />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/50 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                <button className="text-slate-500 hover:text-slate-700 text-sm">
                  View All
                </button>
              </div>
              
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <RecentActivityItem key={activity.id} activity={activity} />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                    </svg>
                    <p className="text-slate-500 text-sm">No recent activity</p>
                    <p className="text-slate-400 text-xs mt-1">Family activity will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}