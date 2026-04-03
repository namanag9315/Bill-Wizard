'use client';

import { Save, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { MobileTabBar, Sidebar, SidebarTab } from '@/components/Sidebar';

const PROFILE_STORAGE_KEY = 'billwizard_profile';

type StoredProfile = {
  defaultName: string;
  whatsappNumber: string;
  upiId: string;
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

export default function SettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<StoredProfile>(() => readStoredProfile());
  const [toast, setToast] = useState<string | null>(null);

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
    >
      <div className="min-h-dvh px-[22px] py-[18px]">
        <header className="mb-[12px] rounded-card border border-border bg-card px-[14px] py-[12px]">
          <div className="inline-flex items-center gap-[6px] text-[10px] uppercase tracking-[0.9px] text-muted">
            <UserCog className="h-[12px] w-[12px]" />
            Settings
          </div>
          <h1 className="mt-[4px] text-[20px] font-medium tracking-[-0.3px] text-[#1C1917]">Global Profile</h1>
          <p className="mt-[2px] text-[12px] text-muted">
            Saved details are reused across rooms for faster joining and reminders.
          </p>
        </header>

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
