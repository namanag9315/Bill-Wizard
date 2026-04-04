import { FileText, Home, IndianRupee, Loader2, Plus, Settings as SettingsIcon } from 'lucide-react';

export type SidebarTab = 'home' | 'past-splits' | 'settings';

type SidebarParticipant = {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
};

type SidebarUser = {
  name: string;
  initials: string;
};

type SidebarProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  currentRoomName: string;
  roomId: string;
  participants: SidebarParticipant[];
  currentUser: SidebarUser | null;
  onCreateRoom?: () => void;
  creatingRoom?: boolean;
};

type MobileTabBarProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
};

const NAV_ITEMS: Array<{
  key: SidebarTab;
  label: string;
  icon: typeof Home;
}> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'past-splits', label: 'Past Splits', icon: FileText },
  { key: 'settings', label: 'Settings', icon: SettingsIcon }
];

export function Sidebar({
  activeTab,
  onTabChange,
  currentRoomName,
  roomId,
  participants,
  currentUser,
  onCreateRoom,
  creatingRoom = false
}: SidebarProps) {
  return (
    <aside className="flex h-full flex-col bg-navy-950 text-navy-100">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-[18px] pb-[14px] pt-[18px]">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-amber">
            <IndianRupee className="h-[15px] w-[15px] text-white" strokeWidth={2.3} />
          </div>
          <span className="text-[15px] font-medium tracking-[-0.3px] text-slate-50">BillWizard</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-[8px] py-[10px]">
        <nav className="space-y-[3px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={[
                  'flex w-full items-center gap-[9px] rounded-[8px] px-[10px] py-[8px]',
                  'text-left transition-[background-color] duration-150 ease-linear',
                  isActive
                    ? 'bg-[rgba(245,158,11,0.14)]'
                    : 'hover:bg-[rgba(255,255,255,0.05)]'
                ].join(' ')}
              >
                <Icon
                  className="h-[15px] w-[15px]"
                  style={{ color: isActive ? '#F59E0B' : '#64748B' }}
                  strokeWidth={2.15}
                />
                <span
                  className="text-[13px]"
                  style={{ color: isActive ? '#F8FAFC' : '#64748B', fontWeight: isActive ? 500 : 400 }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {onCreateRoom ? (
          <div className="mt-[10px] px-[4px]">
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={creatingRoom}
              className="inline-flex h-[32px] w-full items-center justify-center gap-[6px] rounded-[8px] border border-[rgba(245,158,11,0.32)] bg-[rgba(245,158,11,0.16)] px-[10px] text-[11px] font-medium text-[#FDE68A] transition-[background-color] duration-150 ease-linear hover:bg-[rgba(245,158,11,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingRoom ? <Loader2 className="h-[11px] w-[11px] animate-spin" /> : <Plus className="h-[11px] w-[11px]" />}
              {creatingRoom ? 'Creating Room...' : 'New Room'}
            </button>
          </div>
        ) : null}

        <div className="mt-[20px] px-[4px]">
          <p className="text-[10px] uppercase tracking-[1px] text-navy-600">Current Room</p>
          <div className="mt-[8px] rounded-[9px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.04)] px-[12px] py-[10px]">
            <p className="truncate text-[12px] font-medium text-navy-200">{currentRoomName}</p>
            <p className="mt-[2px] truncate font-mono text-[10px] text-[#475569]">{roomId}</p>

            <div className="mt-[8px] flex items-center">
              <div className="flex items-center">
                {participants.slice(0, 5).map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[9px] font-semibold"
                    style={{
                      marginLeft: index === 0 ? 0 : -5,
                      zIndex: 100 - index,
                      borderColor: '#0D1B2A',
                      backgroundColor: participant.avatarBg,
                      color: participant.avatarText
                    }}
                    title={participant.name}
                  >
                    {participant.initials}
                  </div>
                ))}
              </div>
              <span className="ml-[8px] text-[10px] text-[#475569]">{participants.length} people</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.06)] px-[18px] py-[14px]">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#1B3A6B] text-[10px] font-semibold text-[#93C5FD]">
            {currentUser?.initials ?? 'BW'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-navy-200">{currentUser?.name ?? 'BillWizard'}</p>
            <p className="text-[10px] text-[#475569]">Host · Room Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <nav className="grid h-[58px] grid-cols-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            onClick={() => onTabChange(item.key)}
            className="flex items-center justify-center transition-[background-color] duration-150 ease-linear"
            style={{
              backgroundColor: isActive ? 'rgba(245, 158, 11, 0.14)' : '#FFFFFF'
            }}
          >
            <Icon
              className="h-[18px] w-[18px]"
              style={{ color: isActive ? '#F59E0B' : '#64748B' }}
              strokeWidth={2.2}
            />
          </button>
        );
      })}
    </nav>
  );
}
