'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  History,
  Loader2,
  ReceiptText,
  Save,
  Split,
  UserCog,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { MobileTabBar, Sidebar, SidebarTab } from '@/components/Sidebar';
import type { ActivityLogRecord } from '@/lib/activityLog';
import { getSupabaseBrowserClient } from '@/utils/supabase';

const PROFILE_STORAGE_KEY = 'billwizard_profile';
const USER_ID_STORAGE_KEYS = [
  'billwizard_user_id',
  'billwizard:current_user_id',
  'billwizard_profile_user_id',
  'billwizard-current-user'
] as const;

type StoredProfile = {
  defaultName: string;
  whatsappNumber: string;
  upiId: string;
};

type SettingsViewTab = 'profile' | 'activity';

type TimelineVisual = {
  icon: LucideIcon;
  iconClassName: string;
  nodeClassName: string;
};

function readStoredProfile(): StoredProfile {
  if (typeof window === 'undefined') {
    return { defaultName: '', whatsappNumber: '', upiId: '' };
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { defaultName: '', whatsappNumber: '', upiId: '' };
    const parsed = JSON.parse(raw) as Partial<StoredProfile>;
    return {
      defaultName: String(parsed.defaultName ?? '').trim(),
      whatsappNumber: String(parsed.whatsappNumber ?? '').trim(),
      upiId: String(parsed.upiId ?? '').trim()
    };
  } catch {
    return { defaultName: '', whatsappNumber: '', upiId: '' };
  }
}

function getInitials(name: string) {
  const clean = name.trim();
  if (!clean) return 'BW';
  const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'BW';
}

function readStoredUserId() {
  if (typeof window === 'undefined') return null;
  for (const key of USER_ID_STORAGE_KEYS) {
    const value = String(window.localStorage.getItem(key) ?? '').trim();
    if (value) return value;
  }
  return null;
}

function formatRelativeTime(createdAt: string) {
  const createdTs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTs)) return 'Just now';

  const nowTs = Date.now();
  const diffMs = nowTs - createdTs;
  const diffSeconds = Math.max(1, Math.round(diffMs / 1000));

  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffHours < 48) return 'Yesterday';

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return new Date(createdTs).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function buildMockActivityLogs(displayName: string): ActivityLogRecord[] {
  const actor = displayName.trim() || 'You';
  const now = Date.now();

  return [
    {
      id: 'mock-1',
      user_id: null,
      session_id: 'GOA-HTL-9A',
      action_type: 'payment_sent',
      description: `${actor} paid Shujal ₹500 via UPI`,
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-2',
      user_id: null,
      session_id: 'GOA-HTL-9A',
      action_type: 'expense_added',
      description: `${actor} added a ₹4,500 expense for Goa Hotel`,
      created_at: new Date(now - 6 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-3',
      user_id: null,
      session_id: 'GOA-HTL-9A',
      action_type: 'split_equally',
      description: `${actor} applied split equally across 5 people`,
      created_at: new Date(now - 26 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'mock-4',
      user_id: null,
      session_id: 'MUM-TAXI-44',
      action_type: 'participant_added',
      description: `${actor} added Harisharnam to Mumbai Taxi room`,
      created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

function resolveTimelineVisual(actionType: string): TimelineVisual {
  const normalized = actionType.trim().toLowerCase();

  if (
    normalized === 'expense_added' ||
    normalized === 'receipt_scanned' ||
    normalized.includes('expense') ||
    normalized.includes('receipt')
  ) {
    return {
      icon: ReceiptText,
      iconClassName: 'text-[#B45309]',
      nodeClassName: 'border-amber-200 bg-amber-50'
    };
  }

  if (
    normalized === 'payment_sent' ||
    normalized === 'payment_received' ||
    normalized.includes('payment') ||
    normalized.includes('settle')
  ) {
    return {
      icon: Banknote,
      iconClassName: 'text-[#065F46]',
      nodeClassName: 'border-emerald-200 bg-emerald-50'
    };
  }

  if (normalized === 'split_equally' || normalized === 'split_customized' || normalized.includes('split')) {
    return {
      icon: Split,
      iconClassName: 'text-[#1D4ED8]',
      nodeClassName: 'border-blue-200 bg-blue-50'
    };
  }

  if (
    normalized === 'participant_added' ||
    normalized === 'participant_removed' ||
    normalized.includes('participant') ||
    normalized.includes('user')
  ) {
    return {
      icon: Users,
      iconClassName: 'text-[#7C3AED]',
      nodeClassName: 'border-violet-200 bg-violet-50'
    };
  }

  return {
    icon: History,
    iconClassName: 'text-slate-600',
    nodeClassName: 'border-slate-200 bg-slate-50'
  };
}

export default function SettingsPage() {
  const router = useRouter();

  const [activeView, setActiveView] = useState<SettingsViewTab>('profile');
  const [profile, setProfile] = useState<StoredProfile>(() => readStoredProfile());
  const [toast, setToast] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activitySource, setActivitySource] = useState<'database' | 'mock'>('mock');

  const handleTabChange = (tab: SidebarTab) => {
    if (tab === 'home') {
      router.push('/');
      return;
    }
    if (tab === 'past-splits') {
      router.push('/past');
      return;
    }
    router.push('/settings');
  };

  const handleSaveProfile = () => {
    const payload: StoredProfile = {
      defaultName: profile.defaultName.trim(),
      whatsappNumber: profile.whatsappNumber.trim(),
      upiId: profile.upiId.trim()
    };

    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
    setToast('Profile saved successfully. It will auto-fill room join forms.');
    window.setTimeout(() => setToast(null), 2400);
  };

  const fetchActivityLogs = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const storedUserId = readStoredUserId();

      let query = supabase
        .from('activity_logs')
        .select('id, user_id, session_id, action_type, description, created_at')
        .order('created_at', { ascending: false })
        .limit(80);

      if (storedUserId) {
        query = query.eq('user_id', storedUserId);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const normalizedRows: ActivityLogRecord[] = ((data ?? []) as Array<Record<string, unknown>>)
        .map((row, index) => ({
          id: String(row.id ?? `activity-${index}`),
          user_id: typeof row.user_id === 'string' ? row.user_id : null,
          session_id: typeof row.session_id === 'string' ? row.session_id : null,
          action_type: String(row.action_type ?? 'activity'),
          description: String(row.description ?? '').trim(),
          created_at:
            typeof row.created_at === 'string' && row.created_at.trim()
              ? row.created_at
              : new Date().toISOString()
        }))
        .filter((row) => row.description.length > 0);

      if (normalizedRows.length === 0) throw new Error('No activity rows yet');

      setActivityLogs(normalizedRows);
      setActivitySource('database');
    } catch {
      setActivityLogs(buildMockActivityLogs(profile.defaultName));
      setActivitySource('mock');
    } finally {
      setLoadingActivity(false);
    }
  }, [profile.defaultName]);

  useEffect(() => {
    if (activeView !== 'activity') return;
    void fetchActivityLogs();
  }, [activeView, fetchActivityLogs]);

  const sidebarParticipants = useMemo(
    () => [
      { id: 'na', name: 'Naman', initials: 'NA', avatarBg: '#E1F5EE', avatarText: '#0F6E56' },
      { id: 'rk', name: 'Rohit', initials: 'RK', avatarBg: '#E6F1FB', avatarText: '#185FA5' },
      { id: 'pj', name: 'Pranjal', initials: 'PJ', avatarBg: '#FAEEDA', avatarText: '#854F0B' }
    ],
    []
  );

  return (
    <AppShell
      sidebar={
        <Sidebar
          activeTab="settings"
          onTabChange={handleTabChange}
          currentRoomName="Trip Ledger"
          roomId="GLOBAL"
          participants={sidebarParticipants}
          currentUser={{
            name: profile.defaultName || 'BillWizard User',
            initials: getInitials(profile.defaultName || 'BillWizard User')
          }}
        />
      }
      mobileTabs={<MobileTabBar activeTab="settings" onTabChange={handleTabChange} />}
      showInstallButton
    >
      <div className="min-h-dvh px-[22px] py-[18px]">
        <header className="mb-[12px] rounded-card border border-border bg-card px-[14px] py-[12px] shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
          <div className="inline-flex items-center gap-[6px] text-[10px] uppercase tracking-[0.9px] text-muted">
            <UserCog className="h-[12px] w-[12px]" />
            Settings
          </div>
          <h1 className="mt-[4px] text-[20px] font-medium tracking-[-0.3px] text-[#1C1917]">Global Settings</h1>
          <p className="mt-[2px] text-[12px] text-muted">
            Manage your profile defaults and track actions across your BillWizard sessions.
          </p>

          <div className="mt-[12px] inline-flex rounded-pill border border-slate-200 bg-slate-50 p-[3px] shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
            <button
              type="button"
              onClick={() => setActiveView('profile')}
              className={[
                'h-[30px] rounded-pill px-[14px] text-[12px] font-medium transition-all duration-150 ease-linear',
                activeView === 'profile'
                  ? 'bg-white text-[#1C1917] shadow-[0_4px_14px_rgba(15,23,42,0.09)]'
                  : 'text-slate-500 hover:text-slate-700'
              ].join(' ')}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveView('activity')}
              className={[
                'h-[30px] rounded-pill px-[14px] text-[12px] font-medium transition-all duration-150 ease-linear',
                activeView === 'activity'
                  ? 'bg-white text-[#1C1917] shadow-[0_4px_14px_rgba(15,23,42,0.09)]'
                  : 'text-slate-500 hover:text-slate-700'
              ].join(' ')}
            >
              Activity Log
            </button>
          </div>
        </header>

        {activeView === 'profile' ? (
          <section className="max-w-[620px] rounded-card border border-border bg-card px-[14px] py-[14px]">
            <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Profile Defaults</p>
            <div className="mt-[10px] grid gap-[10px]">
              <label className="space-y-[4px]">
                <span className="text-[11px] text-muted">Default Name</span>
                <input
                  value={profile.defaultName}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, defaultName: event.target.value }))
                  }
                  placeholder="Naman Agarwal"
                  className="h-[38px] w-full rounded-input border border-border bg-white px-[11px] text-[13px] text-[#1C1917] outline-none"
                />
              </label>

              <label className="space-y-[4px]">
                <span className="text-[11px] text-muted">WhatsApp Number</span>
                <input
                  value={profile.whatsappNumber}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, whatsappNumber: event.target.value }))
                  }
                  placeholder="919999999999"
                  className="h-[38px] w-full rounded-input border border-border bg-white px-[11px] text-[13px] text-[#1C1917] outline-none"
                />
              </label>

              <label className="space-y-[4px]">
                <span className="text-[11px] text-muted">UPI ID</span>
                <input
                  value={profile.upiId}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, upiId: event.target.value }))
                  }
                  placeholder="yourname@upi"
                  className="h-[38px] w-full rounded-input border border-border bg-white px-[11px] text-[13px] text-[#1C1917] outline-none"
                />
              </label>

              <div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex h-[36px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black"
                >
                  <Save className="h-[12px] w-[12px]" />
                  Save Profile
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="max-w-[760px] rounded-card border border-slate-200 bg-slate-50 px-[14px] py-[14px] shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-[8px]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.9px] text-slate-500">Global Activity Log</p>
                <p className="mt-[2px] text-[12px] text-slate-600">
                  Chronological feed of key actions across your rooms.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void fetchActivityLogs();
                }}
                disabled={loadingActivity}
                className="inline-flex h-[30px] items-center gap-[6px] rounded-input border border-slate-200 bg-white px-[10px] text-[11px] font-medium text-slate-700 shadow-sm transition-[background-color] duration-150 ease-linear hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingActivity ? <Loader2 className="h-[11px] w-[11px] animate-spin" /> : null}
                Refresh
              </button>
            </div>

            {activitySource === 'mock' ? (
              <div className="mt-[10px] inline-flex rounded-pill border border-[#FED7AA] bg-[#FFF7ED] px-[10px] py-[4px] text-[10px] text-[#9A3412]">
                Showing sample timeline data while DB logs are unavailable.
              </div>
            ) : null}

            {loadingActivity ? (
              <div className="mt-[14px] rounded-input border border-slate-200 bg-white px-[12px] py-[12px] text-[12px] text-slate-600">
                <span className="inline-flex items-center gap-[6px]">
                  <Loader2 className="h-[12px] w-[12px] animate-spin" />
                  Loading activity...
                </span>
              </div>
            ) : (
              <div className="mt-[12px] ml-4 space-y-[10px] border-l-2 border-slate-100 pl-[14px]">
                {activityLogs.map((log) => {
                  const visual = resolveTimelineVisual(log.action_type);
                  const Icon = visual.icon;
                  return (
                    <article
                      key={log.id}
                      className="relative rounded-[14px] border border-slate-200 bg-white px-[12px] py-[10px] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                    >
                      <span
                        className={`absolute -left-[31px] top-[12px] flex h-[28px] w-[28px] items-center justify-center rounded-full border ${visual.nodeClassName}`}
                      >
                        <Icon className={`h-[13px] w-[13px] ${visual.iconClassName}`} />
                      </span>
                      <p className="text-[13px] leading-[1.45] text-slate-800">{log.description}</p>
                      <p className="mt-[4px] text-[11px] text-slate-500">
                        {formatRelativeTime(log.created_at)}
                        {log.session_id ? ` · Room ${log.session_id.slice(0, 6)}` : ''}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {toast && (
          <div className="fixed bottom-[74px] right-[14px] z-[60] md:bottom-[18px]">
            <div className="rounded-input border border-[#A7F3D0] bg-[#ECFDF5] px-[11px] py-[8px] text-[12px] text-[#065F46]">
              {toast}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
