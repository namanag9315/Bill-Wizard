import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { getPersonColors, TAX_PILLS, TaxCategoryKey } from '@/components/billwizardTokens';

export type ItemRowParticipant = {
  id: string;
  name: string;
  initials: string;
};

export type ItemRowModel = {
  id: string;
  name: string;
  basePrice: number;
  finalPrice: number;
  taxCategory: TaxCategoryKey;
  totalShares: number;
  qtyMap: Record<string, number>;
};

export type ItemEditDraft = {
  name: string;
  basePrice: string;
  taxCategory: TaxCategoryKey;
};

type ItemRowProps = {
  item: ItemRowModel;
  participants: ItemRowParticipant[];
  activePanelParticipantId: string | null;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  editDraft: ItemEditDraft | null;
  onOpenPanel: (itemId: string, participantId: string) => void;
  onIncrease: (itemId: string, participantId: string) => void;
  onDecrease: (itemId: string, participantId: string) => void;
  onDelete: (itemId: string) => void;
  onStartEditing: (itemId: string) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditDraftChange: (patch: Partial<ItemEditDraft>) => void;
};

const money = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function toInr(value: number) {
  return `₹${money.format(value)}`;
}

function firstName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? name;
}

export default function ItemRow({
  item,
  participants,
  activePanelParticipantId,
  isEditing,
  isSaving,
  isDeleting,
  editDraft,
  onOpenPanel,
  onIncrease,
  onDecrease,
  onDelete,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditDraftChange
}: ItemRowProps) {
  const totalShares = Math.max(item.totalShares, 0);
  const sharePerPortion = totalShares > 0 ? item.finalPrice / totalShares : 0;
  const taxPill = TAX_PILLS[item.taxCategory];

  const activePerson = participants.find((participant) => participant.id === activePanelParticipantId) ?? null;
  const activeQty = activePerson ? Math.max(item.qtyMap[activePerson.id] ?? 0, 0) : 0;
  const activeShareAmount = totalShares > 0 ? (item.finalPrice * activeQty) / totalShares : 0;

  return (
    <article
      className={[
        'border-b border-[#F7F4EE] px-[18px] py-[13px] last:border-b-0',
        isEditing ? 'bg-[#FFFBEF]' : 'bg-card'
      ].join(' ')}
    >
      {isEditing ? (
        <div>
          <div className="mb-[10px] inline-flex items-center gap-[5px] rounded-pill bg-amber-light px-[8px] py-[3px] text-[10px] font-medium text-amber-dark">
            <Pencil className="h-[10px] w-[10px]" />
            Editing item
          </div>

          <div className="space-y-[8px]">
            <div className="flex items-center gap-[8px]">
              <label className="w-[48px] text-[11px] text-muted">Name</label>
              <input
                value={editDraft?.name ?? ''}
                onChange={(event) => onEditDraftChange({ name: event.target.value })}
                className="h-[31px] w-full rounded-[7px] border border-amber bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
            </div>

            <div className="flex items-center gap-[8px]">
              <label className="w-[48px] text-[11px] text-muted">Base ₹</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editDraft?.basePrice ?? ''}
                onChange={(event) => onEditDraftChange({ basePrice: event.target.value })}
                className="h-[31px] w-full max-w-[90px] rounded-[7px] border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
              <select
                value={editDraft?.taxCategory ?? item.taxCategory}
                onChange={(event) =>
                  onEditDraftChange({ taxCategory: event.target.value as TaxCategoryKey })
                }
                className="h-[31px] flex-1 rounded-[7px] border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              >
                <option value="food">Food</option>
                <option value="alcohol">Alcohol</option>
                <option value="water">Water</option>
              </select>
            </div>
          </div>

          <div className="mt-[10px] flex items-center justify-end gap-[8px]">
            <button
              type="button"
              onClick={onCancelEditing}
              className="h-[31px] rounded-[7px] border border-border bg-white px-[12px] text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEditing}
              disabled={isSaving}
              className="h-[31px] rounded-[7px] bg-[#1C1917] px-[12px] text-[11px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#44403C]"
            >
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="inline-flex h-[21px] min-w-[26px] items-center justify-center rounded-[5px] bg-dim text-[10px] font-medium text-[#78716C]">
                {totalShares}x
              </span>
              <p className="truncate text-[13px] font-medium text-[#1C1917]">{item.name}</p>
              <span
                className="inline-flex items-center rounded-pill px-[7px] py-[2px] text-[10px] font-medium"
                style={{ backgroundColor: taxPill.bg, color: taxPill.text }}
              >
                {taxPill.label}
              </span>
            </div>
            <p className="mt-[5px] text-[11px] text-muted">
              Base {toInr(item.basePrice)} · Final {toInr(item.finalPrice)} · {toInr(sharePerPortion)}
              /share
            </p>
          </div>

          <div className="flex items-center gap-[6px]">
            <button
              type="button"
              aria-label="Edit item"
              onClick={() => onStartEditing(item.id)}
              className="flex h-[27px] w-[27px] items-center justify-center rounded-[7px] bg-transparent text-[#C7C3BD] transition-[background-color] duration-150 ease-linear hover:bg-dim hover:text-[#1C1917]"
            >
              <Pencil className="h-[14px] w-[14px]" />
            </button>
            <button
              type="button"
              aria-label="Delete item"
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
              className="flex h-[27px] w-[27px] items-center justify-center rounded-[7px] bg-transparent text-[#C7C3BD] transition-[background-color] duration-150 ease-linear hover:bg-settle-redLight hover:text-settle-red disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-[14px] w-[14px]" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-[9px] flex flex-wrap items-center gap-[7px]">
        {participants.map((participant) => {
          const qty = Math.max(item.qtyMap[participant.id] ?? 0, 0);
          const isSelected = qty > 0;
          const isPanelPill = activePanelParticipantId === participant.id;
          const personColor = getPersonColors(participant.initials);

          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => {
                onOpenPanel(item.id, participant.id);
                if (qty <= 0) onIncrease(item.id, participant.id);
              }}
              title={participant.name}
              className="group relative flex items-center gap-[7px] rounded-full border bg-slate-50 pl-[2px] pr-[10px] transition-[background-color,border-color,box-shadow] duration-150 ease-linear"
              style={{
                borderColor: isPanelPill ? personColor.text : isSelected ? '#F59E0B' : 'transparent',
                boxShadow: isPanelPill ? `0 0 0 3px ${personColor.ring}` : 'none',
                backgroundColor: isSelected ? '#FFF7E6' : '#F5F4F1'
              }}
            >
              <span
                className="relative flex h-[32px] w-[32px] items-center justify-center rounded-full text-[10px] font-semibold transition-[background-color,color] duration-150 ease-linear"
                style={{
                  backgroundColor: isSelected ? personColor.bg : '#E7E5E4',
                  color: isSelected ? personColor.text : '#A8A29E',
                  opacity: isSelected ? 1 : 0.85
                }}
              >
                {participant.initials}
                {qty > 1 && (
                  <span className="absolute -bottom-[3px] -right-[3px] flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-amber text-[9px] font-semibold text-[#412402]">
                    {qty}
                  </span>
                )}
              </span>

              <span
                className="max-w-[86px] truncate text-[11px] font-medium"
                style={{ color: isSelected ? '#1C1917' : '#78716C' }}
              >
                {firstName(participant.name)}
              </span>
            </button>
          );
        })}
      </div>

      {activePerson && (
        <div className="mt-[9px] rounded-[8px] border border-border bg-canvas px-[14px] py-[10px]">
          <div className="flex items-center justify-between gap-[10px]">
            <p
              className="text-[12px] font-medium"
              style={{ color: getPersonColors(activePerson.initials).text }}
            >
              {activePerson.name}
            </p>

            <div className="flex items-center gap-[9px]">
              <button
                type="button"
                onClick={() => onDecrease(item.id, activePerson.id)}
                disabled={activeQty <= 0}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-border bg-white text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:text-muted"
              >
                <Minus className="h-[14px] w-[14px]" />
              </button>
              <span className="min-w-[24px] text-center text-[20px] font-medium leading-none text-[#1C1917]">
                {activeQty}
              </span>
              <button
                type="button"
                onClick={() => onIncrease(item.id, activePerson.id)}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-border bg-white text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                <Plus className="h-[14px] w-[14px]" />
              </button>
            </div>
          </div>

          <p className="mt-[8px] text-right text-[11px] text-muted">
            Share: {toInr(activeShareAmount)} · {activeQty} of {totalShares} total portions
          </p>
        </div>
      )}
    </article>
  );
}
