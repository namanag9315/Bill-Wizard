'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/utils/supabase';

type ParticipantRow = {
  id: string;
  name: string;
  upi_id: string | null;
};

type ExpenseRow = {
  id: string;
  payer_id: string;
  title: string;
};

type ItemRow = {
  id: string;
  expense_id: string;
  name: string;
  finalPrice: number;
  qtyMapFromItem: Record<string, number>;
};

type AssignmentRow = {
  item_id: string;
  participant_id: string;
  assigned_shares: number;
};

type LedgerRow = {
  participantId: string;
  name: string;
  totalPaidUpfront: number;
  totalConsumed: number;
  netBalance: number;
  owesAmount: number;
  receivesAmount: number;
  lineItems: Array<{ name: string; netCost: number }>;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function parseNonNegativeAmount(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseTaxMultiplier(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.round(parsed);
  return normalized >= 0 ? normalized : fallback;
}

function parseQtyMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const qtyMap: Record<string, number> = {};
  for (const [participantId, shares] of Object.entries(value)) {
    qtyMap[participantId] = parseNonNegativeInteger(shares, 0);
  }
  return qtyMap;
}

function buildLedger(
  participants: ParticipantRow[],
  expenses: ExpenseRow[],
  items: ItemRow[],
  assignments: AssignmentRow[]
): LedgerRow[] {
  const paidTotals: Record<string, number> = {};
  const consumedTotals: Record<string, number> = {};
  const lineItemsByParticipant: Record<string, Array<{ name: string; netCost: number }>> = {};
  const expenseTotalsById: Record<string, number> = {};
  const qtyMapByItem: Record<string, Record<string, number>> = {};

  for (const participant of participants) {
    paidTotals[participant.id] = 0;
    consumedTotals[participant.id] = 0;
    lineItemsByParticipant[participant.id] = [];
  }

  for (const expense of expenses) {
    expenseTotalsById[expense.id] = 0;
  }

  for (const item of items) {
    expenseTotalsById[item.expense_id] = (expenseTotalsById[item.expense_id] ?? 0) + item.finalPrice;
    qtyMapByItem[item.id] = { ...item.qtyMapFromItem };
  }

  for (const assignment of assignments) {
    if (!qtyMapByItem[assignment.item_id]) qtyMapByItem[assignment.item_id] = {};
    qtyMapByItem[assignment.item_id][assignment.participant_id] = parseNonNegativeInteger(
      assignment.assigned_shares,
      0
    );
  }

  for (const expense of expenses) {
    paidTotals[expense.payer_id] = (paidTotals[expense.payer_id] ?? 0) + (expenseTotalsById[expense.id] ?? 0);
  }

  for (const item of items) {
    const qtyMap = qtyMapByItem[item.id] ?? {};
    const activeShares = Object.entries(qtyMap).filter(([, shares]) => shares > 0);
    const totalShares = activeShares.reduce((sum, [, shares]) => sum + shares, 0);
    if (totalShares <= 0) continue;

    for (const [participantId, shares] of activeShares) {
      const netCost = (item.finalPrice * shares) / totalShares;
      consumedTotals[participantId] = (consumedTotals[participantId] ?? 0) + netCost;
      lineItemsByParticipant[participantId] = [
        ...(lineItemsByParticipant[participantId] ?? []),
        { name: `${item.name} (Qty ${shares})`, netCost }
      ];
    }
  }

  return participants.map((participant) => {
    const totalPaidUpfront = paidTotals[participant.id] ?? 0;
    const totalConsumed = consumedTotals[participant.id] ?? 0;
    const netBalance = totalPaidUpfront - totalConsumed;
    return {
      participantId: participant.id,
      name: participant.name,
      totalPaidUpfront,
      totalConsumed,
      netBalance,
      owesAmount: Math.max(-netBalance, 0),
      receivesAmount: Math.max(netBalance, 0),
      lineItems: lineItemsByParticipant[participant.id] ?? []
    };
  });
}

export default function ShareSettlementPage() {
  const params = useParams<{ id: string; participantId: string }>();
  const searchParams = useSearchParams();

  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const participantId = Array.isArray(params.participantId) ? params.participantId[0] : params.participantId;
  const collectorIdFromQuery = searchParams.get('collector') ?? '';

  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const participantsQuery = await supabase
          .from('participants')
          .select('id, name, upi_id')
          .eq('session_id', roomId);
        if (participantsQuery.error) throw new Error(participantsQuery.error.message);

        const participantsRows: ParticipantRow[] = (participantsQuery.data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          upi_id: typeof row.upi_id === 'string' ? row.upi_id : null
        }));

        const expensesQuery = await supabase
          .from('expenses')
          .select('id, payer_id, title')
          .eq('session_id', roomId);
        if (expensesQuery.error) throw new Error(expensesQuery.error.message);

        const expenseRows: ExpenseRow[] = (expensesQuery.data ?? []).map((row) => ({
          id: String(row.id),
          payer_id: String(row.payer_id),
          title: String(row.title ?? 'Untitled')
        }));

        let itemRows: ItemRow[] = [];
        if (expenseRows.length > 0) {
          const expenseIds = expenseRows.map((expense) => expense.id);

          let rawItems: Array<Record<string, unknown>> = [];
          const fullItemsQuery = await supabase
            .from('items')
            .select('id, expense_id, name, final_price, base_price, tax_multiplier, qty_map')
            .in('expense_id', expenseIds);

          if (fullItemsQuery.error) {
            const fallbackItemsQuery = await supabase
              .from('items')
              .select('id, expense_id, name, base_price, tax_multiplier, qty_map')
              .in('expense_id', expenseIds);
            if (fallbackItemsQuery.error) throw new Error(fallbackItemsQuery.error.message);
            rawItems = (fallbackItemsQuery.data ?? []) as Array<Record<string, unknown>>;
          } else {
            rawItems = (fullItemsQuery.data ?? []) as Array<Record<string, unknown>>;
          }

          itemRows = rawItems.map((row) => {
            const basePrice = parseNonNegativeAmount(row.base_price, 0);
            const finalPriceCandidate = parseNonNegativeAmount(row.final_price, NaN);
            const taxMultiplier = parseTaxMultiplier(row.tax_multiplier, 1);
            const finalPrice = Number.isFinite(finalPriceCandidate)
              ? finalPriceCandidate
              : Number((basePrice * taxMultiplier).toFixed(2));

            return {
              id: String(row.id),
              expense_id: String(row.expense_id),
              name: String(row.name ?? 'Untitled item'),
              finalPrice,
              qtyMapFromItem: parseQtyMap(row.qty_map)
            };
          });
        }

        let assignmentRows: AssignmentRow[] = [];
        if (itemRows.length > 0) {
          const assignmentsQuery = await supabase
            .from('item_assignments')
            .select('item_id, participant_id, assigned_shares')
            .in(
              'item_id',
              itemRows.map((item) => item.id)
            );

          if (!assignmentsQuery.error) {
            assignmentRows = (assignmentsQuery.data ?? []).map((row) => ({
              item_id: String(row.item_id),
              participant_id: String(row.participant_id),
              assigned_shares: parseNonNegativeInteger(row.assigned_shares, 0)
            }));
          }
        }

        const nextLedger = buildLedger(participantsRows, expenseRows, itemRows, assignmentRows);

        if (!isCancelled) {
          setParticipants(participantsRows);
          setLedger(nextLedger);
        }
      } catch (nextError) {
        if (!isCancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load split summary.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      isCancelled = true;
    };
  }, [roomId]);

  const participantsById = useMemo(() => {
    const map: Record<string, ParticipantRow> = {};
    for (const participant of participants) map[participant.id] = participant;
    return map;
  }, [participants]);

  const targetLedger = useMemo(
    () => ledger.find((row) => row.participantId === participantId) ?? null,
    [ledger, participantId]
  );

  const collectorLedger = useMemo(() => {
    if (!targetLedger) return null;

    const fromQuery =
      collectorIdFromQuery && participantsById[collectorIdFromQuery]
        ? ledger.find((row) => row.participantId === collectorIdFromQuery) ?? null
        : null;

    if (fromQuery && fromQuery.receivesAmount > 0.0001) return fromQuery;

    const topReceiver = [...ledger]
      .filter((row) => row.receivesAmount > 0.0001 && row.participantId !== targetLedger.participantId)
      .sort((a, b) => b.receivesAmount - a.receivesAmount)[0];

    return topReceiver ?? null;
  }, [collectorIdFromQuery, ledger, participantsById, targetLedger]);

  const collector = collectorLedger ? participantsById[collectorLedger.participantId] ?? null : null;

  const upiUrl = useMemo(() => {
    if (!targetLedger || targetLedger.owesAmount <= 0 || !collector?.upi_id?.trim()) return '';

    return `upi://pay?pa=${encodeURIComponent(collector.upi_id)}&pn=${encodeURIComponent(
      collector.name
    )}&am=${encodeURIComponent(targetLedger.owesAmount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(
      `BillWizard ${roomId}`
    )}`;
  }, [collector, roomId, targetLedger]);

  const qrCodeUrl = useMemo(
    () =>
      upiUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiUrl)}`
        : '',
    [upiUrl]
  );

  const openPaymentApp = useCallback(() => {
    if (!upiUrl) return;
    window.location.href = upiUrl;
  }, [upiUrl]);

  const copyPaymentLink = useCallback(async () => {
    if (!upiUrl) return;
    try {
      await navigator.clipboard.writeText(upiUrl);
    } catch {
      // Ignore clipboard failures; user can still use QR / open button.
    }
  }, [upiUrl]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-[16px]">
        <div className="inline-flex items-center gap-[8px] rounded-card border border-border bg-card px-[14px] py-[10px] text-[13px] text-[#1C1917]">
          <Loader2 className="h-[14px] w-[14px] animate-spin" />
          Loading split summary...
        </div>
      </main>
    );
  }

  if (error || !targetLedger) {
    return (
      <main className="min-h-dvh bg-canvas px-[16px] py-[18px]">
        <div className="mx-auto max-w-[780px] rounded-card border border-[#FECACA] bg-[#FEF2F2] px-[14px] py-[12px] text-[13px] text-[#B91C1C]">
          {error ?? 'Unable to load this participant summary.'}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-canvas px-[16px] py-[18px]">
      <div className="mx-auto max-w-[780px]">
        <Link
          href={`/room/${roomId}`}
          className="mb-[10px] inline-flex items-center gap-[6px] text-[12px] text-[#2563EB]"
        >
          <ArrowLeft className="h-[12px] w-[12px]" />
          Back to room
        </Link>

        <section className="rounded-card border border-border bg-card px-[14px] py-[12px]">
          <p className="text-[10px] uppercase tracking-[0.9px] text-muted">BillWizard Summary</p>
          <h1 className="mt-[4px] text-[20px] font-medium text-[#1C1917]">{targetLedger.name}</h1>
          <p className="mt-[2px] text-[12px] text-muted">Room ID: {roomId}</p>

          <div className="mt-[10px] grid gap-[8px] sm:grid-cols-3">
            <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
              <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Paid Upfront</p>
              <p className="mt-[2px] text-[16px] font-medium text-[#1C1917]">{inr.format(targetLedger.totalPaidUpfront)}</p>
            </article>

            <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
              <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Consumed</p>
              <p className="mt-[2px] text-[16px] font-medium text-[#1C1917]">{inr.format(targetLedger.totalConsumed)}</p>
            </article>

            <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
              <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Net Balance</p>
              <p
                className="mt-[2px] text-[16px] font-medium"
                style={{ color: targetLedger.netBalance >= 0 ? '#059669' : '#DC2626' }}
              >
                {targetLedger.netBalance >= 0 ? '+' : '-'}
                {inr.format(Math.abs(targetLedger.netBalance))}
              </p>
            </article>
          </div>

          <div className="mt-[10px] rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
            {targetLedger.owesAmount > 0 ? (
              <p className="text-[13px] text-[#1C1917]">
                Amount to pay: <span className="font-medium text-[#DC2626]">{inr.format(targetLedger.owesAmount)}</span>
                {collector ? (
                  <>
                    {' '}
                    to <span className="font-medium">{collector.name}</span>
                  </>
                ) : null}
              </p>
            ) : targetLedger.receivesAmount > 0 ? (
              <p className="text-[13px] text-[#1C1917]">
                You should receive:{' '}
                <span className="font-medium text-[#059669]">{inr.format(targetLedger.receivesAmount)}</span>
              </p>
            ) : (
              <p className="text-[13px] text-[#1C1917]">Your balance is currently settled.</p>
            )}
          </div>
        </section>

        <section className="mt-[10px] rounded-card border border-border bg-card px-[14px] py-[12px]">
          <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Itemized Calculations</p>
          {targetLedger.lineItems.length === 0 ? (
            <p className="mt-[8px] text-[12px] text-muted">No assigned line items found.</p>
          ) : (
            <div className="mt-[8px] space-y-[6px]">
              {targetLedger.lineItems.map((line, index) => (
                <div
                  key={`${line.name}-${index}`}
                  className="flex items-center justify-between gap-[8px] rounded-input border border-divider px-[10px] py-[8px]"
                >
                  <p className="text-[12px] text-[#1C1917]">{line.name}</p>
                  <p className="text-[12px] font-medium text-[#1C1917]">{inr.format(line.netCost)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {upiUrl ? (
          <section className="mt-[10px] rounded-card border border-border bg-card px-[14px] py-[12px]">
            <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Payment</p>
            <p className="mt-[4px] text-[12px] text-[#1C1917]">
              Pay <span className="font-medium">{collector?.name}</span> via UPI.
            </p>

            <div className="mt-[8px] rounded-input border border-divider bg-canvas p-[10px]">
              <div
                role="img"
                aria-label="UPI payment QR code"
                className="mx-auto h-[220px] w-[220px] rounded-[6px] bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${qrCodeUrl}")` }}
              />
            </div>

            <div className="mt-[8px] grid gap-[8px] sm:grid-cols-2">
              <button
                type="button"
                onClick={openPaymentApp}
                className="inline-flex h-[34px] items-center justify-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black"
              >
                <ExternalLink className="h-[12px] w-[12px]" />
                Open Payment App
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyPaymentLink();
                }}
                className="h-[34px] rounded-input border border-border bg-white px-[12px] text-[12px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                Copy UPI Link
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
