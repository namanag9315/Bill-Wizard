'use client';

import { CalendarDays, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import AppShell from '@/components/AppShell';
import { MobileTabBar, Sidebar, SidebarTab } from '@/components/Sidebar';

type PastSessionCard = {
  id: string;
  roomId: string;
  title: string;
  date: string;
  status: string;
};

const MOCK_SESSIONS: PastSessionCard[] = [
  { id: '1', roomId: 'goa-trip-2025', title: 'Goa Trip', date: 'Oct 24', status: 'Owed ₹450' },
  { id: '2', roomId: 'manali-drive-2025', title: 'Manali Drive', date: 'Dec 14', status: 'Gets Back ₹620' },
  { id: '3', roomId: 'jaipur-weekend-2026', title: 'Jaipur Weekend', date: 'Feb 11', status: 'Owed ₹120' },
  { id: '4', roomId: 'udaipur-retreat-2026', title: 'Udaipur Retreat', date: 'Mar 06', status: 'Settled' }
];

export default function PastSplitsPage() {
  const router = useRouter();

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
          activeTab="past-splits"
          onTabChange={handleTabChange}
          currentRoomName="Past Splits"
          roomId="ARCHIVE"
          participants={sidebarParticipants}
          currentUser={{ name: 'BillWizard User', initials: 'BW' }}
        />
      }
      mobileTabs={<MobileTabBar activeTab="past-splits" onTabChange={handleTabChange} />}
    >
      <div className="min-h-dvh px-[22px] py-[18px]">
        <header className="mb-[12px] rounded-card border border-border bg-card px-[14px] py-[12px]">
          <div className="inline-flex items-center gap-[6px] text-[10px] uppercase tracking-[0.9px] text-muted">
            <FileText className="h-[12px] w-[12px]" />
            Archive
          </div>
          <h1 className="mt-[4px] text-[20px] font-medium tracking-[-0.3px] text-[#1C1917]">Past Splits</h1>
          <p className="mt-[2px] text-[12px] text-muted">Review older trips and jump directly back into any room.</p>
        </header>

        <section className="grid gap-[12px] sm:grid-cols-2 xl:grid-cols-3">
          {MOCK_SESSIONS.map((session) => {
            const isOwed = session.status.toLowerCase().includes('owed');
            const isGetsBack = session.status.toLowerCase().includes('gets back');

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => router.push(`/room/${session.roomId}`)}
                className="rounded-card border border-border bg-card px-[13px] py-[12px] text-left transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                <div className="flex items-start justify-between gap-[8px]">
                  <div>
                    <p className="text-[14px] font-medium text-[#1C1917]">{session.title}</p>
                    <div className="mt-[4px] inline-flex items-center gap-[5px] text-[11px] text-muted">
                      <CalendarDays className="h-[12px] w-[12px]" />
                      {session.date}
                    </div>
                  </div>

                  <span
                    className="rounded-pill px-[8px] py-[3px] text-[10px] font-medium"
                    style={{
                      backgroundColor: isOwed ? '#FEE2E2' : isGetsBack ? '#ECFDF5' : '#F5F4F1',
                      color: isOwed ? '#B91C1C' : isGetsBack ? '#065F46' : '#57534E'
                    }}
                  >
                    {session.status}
                  </span>
                </div>

                <p className="mt-[8px] text-[11px] text-muted">Room ID: {session.roomId}</p>
              </button>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
