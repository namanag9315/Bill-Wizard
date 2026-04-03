import { ReactNode, useMemo, useState } from 'react';
import { Loader2, Users, X } from 'lucide-react';
import { getPersonColors } from '@/components/billwizardTokens';
import type { ItemRowParticipant } from '@/components/ItemRow';

type CategoryCardProps = {
  title: string;
  subtitle: string;
  itemCount: number;
  children: ReactNode;
  participants?: ItemRowParticipant[];
  onConfirmBulkSplit?: (participantIds: string[]) => Promise<void> | void;
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

export default function CategoryCard({
  title,
  subtitle,
  itemCount,
  children,
  participants = [],
  onConfirmBulkSplit
}: CategoryCardProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [isSubmittingBulkSplit, setIsSubmittingBulkSplit] = useState(false);

  const hasBulkSplit = Boolean(onConfirmBulkSplit) && participants.length > 0 && itemCount > 0;

  const selectedCount = useMemo(
    () => selectedParticipantIds.filter((id) => participants.some((person) => person.id === id)).length,
    [participants, selectedParticipantIds]
  );

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  };

  const openSheet = () => {
    // Key decision: preselect all users for quicker category-wide sharing in common scenarios.
    setSelectedParticipantIds(participants.map((participant) => participant.id));
    setIsSheetOpen(true);
  };

  const handleConfirmBulkSplit = async () => {
    if (!onConfirmBulkSplit) return;

    setIsSubmittingBulkSplit(true);
    try {
      // Key decision: parent callback overwrites assignments for every item in this category.
      await onConfirmBulkSplit(selectedParticipantIds);
      setIsSheetOpen(false);
    } finally {
      setIsSubmittingBulkSplit(false);
    }
  };

  return (
    <>
      <section className="mb-[18px] overflow-hidden rounded-card border border-border bg-card">
        <header className="flex items-center justify-between gap-4 border-b border-divider px-[18px] py-[13px]">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-medium text-[#1C1917]">{title}</h2>
            <p className="mt-[2px] truncate text-[11px] text-muted">{subtitle}</p>
          </div>

          <div className="flex items-center gap-[8px]">
            <span className="inline-flex h-[24px] items-center rounded-pill bg-amber-light px-[9px] text-[11px] font-medium text-amber-dark">
              {itemCount} items
            </span>

            <button
              type="button"
              onClick={openSheet}
              disabled={!hasBulkSplit}
              className="inline-flex h-[24px] items-center gap-[5px] rounded-pill border border-border bg-white px-[9px] text-[11px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="h-[12px] w-[12px]" />
              Split Category
            </button>
          </div>
        </header>
        <div>{children}</div>
      </section>

      {isSheetOpen && (
        <div className="fixed inset-0 z-[80] bg-black/35">
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              if (isSubmittingBulkSplit) return;
              setIsSheetOpen(false);
            }}
            className="h-full w-full cursor-default"
          />

          <div className="absolute inset-x-0 bottom-0 rounded-t-[16px] border border-border bg-card px-[16px] pb-[16px] pt-[14px] shadow-lg transition-[background-color] duration-150 ease-linear md:left-1/2 md:max-w-[520px] md:-translate-x-1/2">
            <div className="mb-[10px] flex items-start justify-between gap-[10px]">
              <div>
                <p className="text-[14px] font-medium text-[#1C1917]">Split {title}</p>
                <p className="mt-[2px] text-[11px] text-muted">
                  Select users who should get 1 share for every item in this category.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isSubmittingBulkSplit) return;
                  setIsSheetOpen(false);
                }}
                className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] border border-border bg-white text-muted transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                <X className="h-[14px] w-[14px]" />
              </button>
            </div>

            <div className="flex flex-wrap gap-[8px]">
              {participants.map((participant) => {
                const selected = selectedParticipantIds.includes(participant.id);
                const colors = getPersonColors(participant.initials);
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => toggleParticipant(participant.id)}
                    className="flex items-center gap-2 rounded-full border bg-slate-50 pl-[2px] pr-3 transition-[background-color,border-color,box-shadow] duration-150 ease-linear"
                    style={{
                      borderColor: selected ? colors.text : '#E8E5DE',
                      backgroundColor: selected ? '#FFF7E6' : '#F8FAFC',
                      boxShadow: selected ? `0 0 0 3px ${colors.ring}` : 'none'
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: selected ? colors.bg : '#F5F4F1',
                        color: selected ? colors.text : '#A8A29E'
                      }}
                    >
                      {participant.initials}
                    </span>
                    <span
                      className="max-w-[110px] truncate text-xs font-medium"
                      style={{ color: selected ? '#1C1917' : '#57534E' }}
                    >
                      {getFirstName(participant.name)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-[12px] flex items-center justify-between gap-[8px] rounded-[8px] border border-divider bg-canvas px-[10px] py-[8px] text-[11px] text-muted">
              <p>{selectedCount} selected</p>
              <p>{itemCount} item{itemCount > 1 ? 's' : ''} will be overwritten</p>
            </div>

            <div className="mt-[12px] flex items-center justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                disabled={isSubmittingBulkSplit}
                className="h-[34px] rounded-input border border-border bg-white px-[12px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleConfirmBulkSplit();
                }}
                disabled={isSubmittingBulkSplit}
                className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
              >
                {isSubmittingBulkSplit ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : null}
                {isSubmittingBulkSplit ? 'Applying...' : 'Confirm Bulk Split'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
