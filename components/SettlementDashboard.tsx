import { Monitor } from 'lucide-react';
import { getPersonColors } from '@/components/billwizardTokens';

export type SettlementParticipant = {
  id: string;
  name: string;
  initials: string;
};

export type SettlementEntry = {
  participantId: string;
  totalPaidUpfront?: number;
  totalConsumed?: number;
  theirShare: number;
  netBalance: number;
  owesAmount: number;
  receivesAmount: number;
  isMarkedSettled?: boolean;
};

type SettlementDashboardProps = {
  participants: SettlementParticipant[];
  entries: SettlementEntry[];
  payerId: string | null;
  onSelectPayer: (participantId: string) => void;
  onPayViaUpi: (entry: SettlementEntry) => void;
  onSendReminder: (entry: SettlementEntry) => void;
  onSettleAndNotify: (entry: SettlementEntry) => void;
};

const money = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function toInr(value: number) {
  return `₹${money.format(value)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

export default function SettlementDashboard({
  participants,
  entries,
  payerId,
  onSelectPayer,
  onPayViaUpi,
  onSendReminder,
  onSettleAndNotify
}: SettlementDashboardProps) {
  const payer = participants.find((person) => person.id === payerId) ?? null;
  const payerFirstName = payer?.name.trim().split(/\s+/)[0] ?? 'collector';

  return (
    <section className="mt-[18px]">
      <div className="mb-[10px] flex flex-wrap items-center justify-between gap-[10px]">
        <div className="inline-flex items-center gap-[7px]">
          <Monitor className="h-[13px] w-[13px] text-muted" />
          <p className="text-section uppercase tracking-[0.9px] text-muted">Settlement Dashboard</p>
        </div>

        <div className="flex items-center gap-[8px]">
          <span className="text-[11px] text-muted">Payer:</span>
          <div className="flex flex-wrap items-center gap-[6px]">
            {participants.map((participant) => {
              const colors = getPersonColors(participant.initials);
              const isSelected = participant.id === payerId;
              return (
                <button
                  key={participant.id}
                  type="button"
                  onClick={() => onSelectPayer(participant.id)}
                  className="flex items-center gap-2 rounded-full border bg-slate-50 pl-[2px] pr-3 transition-[background-color,border-color,box-shadow] duration-150 ease-linear"
                  style={{
                    borderColor: isSelected ? '#059669' : '#E8E5DE',
                    boxShadow: isSelected ? '0 0 0 3px #DCFCE7' : 'none',
                    backgroundColor: isSelected ? '#ECFDF5' : '#F8FAFC'
                  }}
                >
                  <span
                    className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: isSelected ? colors.bg : '#F5F4F1',
                      color: isSelected ? colors.text : '#94A3B8'
                    }}
                  >
                    {participant.initials}
                  </span>
                  <span
                    className="max-w-[78px] truncate text-[11px] font-medium"
                    style={{ color: isSelected ? '#065F46' : '#475569' }}
                  >
                    {firstName(participant.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
        {entries.map((entry) => {
          const participant = participants.find((person) => person.id === entry.participantId);
          const initials = participant?.initials ?? 'BW';
          const owesMoney = entry.owesAmount > 0.0001;
          const isMarkedSettled = Boolean(entry.isMarkedSettled);
          const getsBack = entry.receivesAmount > 0.0001;
          const amountLabel = getsBack
            ? `+${toInr(entry.receivesAmount)}`
            : owesMoney
              ? toInr(entry.owesAmount)
              : '₹0.00';
          const amountColor = getsBack ? '#059669' : owesMoney ? '#DC2626' : '#1C1917';
          const subLabel = getsBack
            ? 'gets back · paid upfront'
            : owesMoney
              ? `owes ${payerFirstName}`
              : isMarkedSettled
                ? 'paid · awaiting confirmation'
                : 'settled';
          const colors = getPersonColors(initials);

          return (
            <article key={entry.participantId} className="rounded-card border border-border bg-card px-[14px] py-[13px]">
              <div className="mb-[10px] flex h-[32px] w-[32px] items-center justify-center rounded-full text-[11px] font-semibold" style={{ backgroundColor: colors.bg, color: colors.text }}>
                {initials}
              </div>

              <p className="text-[11px] text-muted">{participant?.name ?? 'Unknown'}</p>
              <p className="mt-[3px] text-[17px] font-medium tabular-nums" style={{ color: amountColor }}>
                {amountLabel}
              </p>

              <p className="mt-[1px] text-[10px]" style={{ color: getsBack ? '#059669' : '#A8A29E' }}>
                {subLabel}
              </p>

              {getsBack ? (
                <button
                  type="button"
                  disabled
                  className="mt-[10px] h-[30px] w-full rounded-[7px] bg-settle-greenLight text-[11px] font-medium text-settle-green"
                >
                  Will Receive
                </button>
              ) : owesMoney ? (
                <div className="mt-[10px] grid grid-cols-1 gap-[6px]">
                  <button
                    type="button"
                    onClick={() => onPayViaUpi(entry)}
                    className="h-[30px] w-full rounded-[7px] bg-settle-redLight text-[11px] font-medium text-settle-red transition-[background-color] duration-150 ease-linear hover:bg-[#FECACA]"
                  >
                    Pay via UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendReminder(entry)}
                    className="h-[30px] w-full rounded-[7px] border border-border bg-white text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                  >
                    Send Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => onSettleAndNotify(entry)}
                    className="h-[30px] w-full rounded-[7px] bg-[#E0F2FE] text-[11px] font-medium text-[#0369A1] transition-[background-color] duration-150 ease-linear hover:bg-[#BAE6FD]"
                  >
                    Settle & Notify
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSendReminder(entry)}
                  className="mt-[10px] h-[30px] w-full rounded-[7px] border border-border bg-white text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                >
                  {isMarkedSettled ? 'Payment Update Sent' : 'Send Reminder'}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
