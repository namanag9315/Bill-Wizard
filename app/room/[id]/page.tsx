'use client';

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Check,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
  UserPlus
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CategoryCard from '@/components/CategoryCard';
import ItemRow, { ItemEditDraft, ItemRowModel, ItemRowParticipant } from '@/components/ItemRow';
import SettlementDashboard, { SettlementEntry } from '@/components/SettlementDashboard';
import { MobileTabBar, Sidebar, SidebarTab } from '@/components/Sidebar';
import { TaxCategoryKey } from '@/components/billwizardTokens';
import { exportToExcel } from '@/lib/exportToExcel';
import { getSupabaseBrowserClient } from '@/utils/supabase';

type ParticipantRecord = {
  id: string;
  session_id: string;
  name: string;
  is_manual: boolean;
  phone_number: string | null;
  upi_id: string | null;
};

type ParticipantIdentityRecord = {
  id: string;
  name: string;
  phone_number: string | null;
  upi_id: string | null;
};

type ExpenseType = 'receipt' | 'manual';

type ExpenseRecord = {
  id: string;
  session_id: string;
  payer_id: string;
  title: string;
  expense_type: ExpenseType;
  receipt_url: string | null;
};

type ReceiptCategory =
  | 'Veg Food'
  | 'Non-Veg Food'
  | 'Breads'
  | 'Non-Alcoholic Beverages'
  | 'Alcohol';

type ItemRecord = {
  id: string;
  expense_id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalRowPrice: number;
  basePrice: number;
  finalPrice: number;
  taxMultiplier: number;
  taxCategory: TaxCategoryKey;
  categoryName: ReceiptCategory;
  qtyMapFromItem: Record<string, number>;
};

type ItemAssignmentRecord = {
  item_id: string;
  participant_id: string;
  assigned_shares: number;
};

type ScannedReceiptItem = {
  name: string;
  category: ReceiptCategory;
  quantity: number;
  unitPrice: number;
  totalRowPrice: number;
  taxMultiplier: number;
  autoSplitAll: boolean;
  taxCategory: TaxCategoryKey;
};

type CategoryViewModel = {
  key: ReceiptCategory;
  title: string;
  subtitle: string;
  taxMultiplier: number;
  items: ItemRowModel[];
};

type LedgerRow = {
  participantId: string;
  name: string;
  phoneNumber: string | null;
  totalPaidUpfront: number;
  totalConsumed: number;
  netBalance: number;
  owesAmount: number;
  receivesAmount: number;
  lineItems: Array<{ name: string; netCost: number }>;
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
};

type PastSplitSummary = {
  sessionId: string;
  tripName: string;
  totalExpense: number;
  totalPaidByYou: number;
  expenseCount: number;
  firstExpenseId: string | null;
  firstExpenseTitle: string;
};

type UpiPaymentSheet = {
  collectorName: string;
  collectorUpiId: string;
  amount: string;
  upiUrl: string;
};

type ManualSplitMode = 'equal' | 'ratio';
type ManualPayerSplit = { participantId: string; amount: string };

type CustomItemForm = {
  name: string;
  quantity: string;
  unitPrice: string;
  taxMultiplier: string;
};

const RECEIPT_CATEGORY_ORDER: ReceiptCategory[] = [
  'Veg Food',
  'Non-Veg Food',
  'Breads',
  'Non-Alcoholic Beverages',
  'Alcohol'
];

const PROFILE_STORAGE_KEY = 'billwizard_profile';

const DEFAULT_CUSTOM_ITEM_FORM: CustomItemForm = {
  name: '',
  quantity: '1',
  unitPrice: '',
  taxMultiplier: '1'
};

const WATER_REGEX =
  /\b(water|mineral water|packaged drinking water|drinking water|bisleri|aquafina|kinley|bottled water)\b/i;
const DRINK_REGEX =
  /\b(cold drink|soft drink|beverage|cola|sprite|fanta|thums up|pepsi|coke|juice|soda|mocktail|lassi|shake)\b/i;
const ALCOHOL_REGEX =
  /\b(alcohol|liquor|wine|beer|vodka|whisky|whiskey|rum|gin|tequila|brandy|champagne)\b/i;
const NON_VEG_REGEX = /\b(chicken|mutton|fish|prawn|egg|keema)\b/i;
const BREAD_REGEX = /\b(roti|naan|paratha|parotta|kulcha|chapati|phulka|bhakri|roomali)\b/i;
const TRAVEL_SUMMARY_REGEX =
  /\b(auto|taxi|cab|uber|ola|metro|bus|train|flight|airport|fuel|petrol|diesel|toll|parking|transport|travel|commute)\b/i;
const STAY_SUMMARY_REGEX =
  /\b(hotel|hostel|resort|stay|room|airbnb|accommodation|guest house|guesthouse|villa|lodge|lodging)\b/i;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function parseNumberish(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.round(parsed);
  return normalized >= 0 ? normalized : fallback;
}

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : fallback;
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getInitials(name: string) {
  const clean = name.replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'BW';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function normalizePhoneNumber(phone: string | null | undefined) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '');
}

function normalizeParticipantName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function toReceiptCategory(rawCategory: unknown, itemName = ''): ReceiptCategory {
  const normalizedCategory = String(rawCategory ?? '')
    .trim()
    .toLowerCase();
  const normalizedItemName = itemName.trim().toLowerCase();

  if (ALCOHOL_REGEX.test(normalizedCategory) || ALCOHOL_REGEX.test(normalizedItemName)) return 'Alcohol';
  if (
    normalizedCategory.includes('non-veg') ||
    normalizedCategory.includes('non veg') ||
    NON_VEG_REGEX.test(normalizedItemName)
  ) {
    return 'Non-Veg Food';
  }
  if (
    normalizedCategory.includes('bread') ||
    normalizedCategory.includes('breads') ||
    BREAD_REGEX.test(normalizedItemName)
  ) {
    return 'Breads';
  }
  if (
    normalizedCategory.includes('beverage') ||
    normalizedCategory.includes('drink') ||
    normalizedCategory.includes('water') ||
    DRINK_REGEX.test(normalizedItemName) ||
    WATER_REGEX.test(normalizedItemName)
  ) {
    return 'Non-Alcoholic Beverages';
  }

  return 'Veg Food';
}

function toTaxCategory(rawTaxCategory: unknown, categoryName: ReceiptCategory, itemName: string): TaxCategoryKey {
  const normalizedTaxCategory = String(rawTaxCategory ?? '')
    .trim()
    .toLowerCase();

  if (normalizedTaxCategory === 'alcohol' || ALCOHOL_REGEX.test(normalizedTaxCategory)) return 'alcohol';
  if (
    normalizedTaxCategory === 'water' ||
    WATER_REGEX.test(normalizedTaxCategory) ||
    WATER_REGEX.test(itemName)
  ) {
    return 'water';
  }

  if (categoryName === 'Alcohol') return 'alcohol';
  if (categoryName === 'Non-Alcoholic Beverages' && WATER_REGEX.test(itemName)) return 'water';
  return 'food';
}

function mapTaxCategoryToCategoryName(nextTaxCategory: TaxCategoryKey, currentCategoryName: ReceiptCategory) {
  if (nextTaxCategory === 'alcohol') return 'Alcohol';
  if (nextTaxCategory === 'water') return 'Non-Alcoholic Beverages';
  if (currentCategoryName === 'Alcohol') return 'Veg Food';
  if (currentCategoryName === 'Breads') return 'Breads';
  return currentCategoryName;
}

function parseQtyMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const qtyMap: Record<string, number> = {};
  for (const [participantId, shares] of Object.entries(value)) {
    qtyMap[participantId] = parseNonNegativeInteger(shares, 0);
  }
  return qtyMap;
}

function upsertById<T extends { id: string }>(rows: T[], row: T) {
  const existingIndex = rows.findIndex((entry) => entry.id === row.id);
  if (existingIndex === -1) return [...rows, row];

  const copy = [...rows];
  copy[existingIndex] = row;
  return copy;
}

function removeById<T extends { id: string }>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id);
}

function upsertAssignment(rows: ItemAssignmentRecord[], row: ItemAssignmentRecord) {
  const existingIndex = rows.findIndex(
    (entry) => entry.item_id === row.item_id && entry.participant_id === row.participant_id
  );

  if (existingIndex === -1) return [...rows, row];

  const copy = [...rows];
  copy[existingIndex] = row;
  return copy;
}

function removeAssignment(rows: ItemAssignmentRecord[], row: ItemAssignmentRecord) {
  return rows.filter(
    (entry) => !(entry.item_id === row.item_id && entry.participant_id === row.participant_id)
  );
}

function normalizeItemRow(row: Record<string, unknown>): ItemRecord {
  const name = String(row.name ?? '').trim();
  const quantity = parsePositiveInteger(row.quantity, 1);

  const totalRowPrice = parseNonNegativeAmount(
    row.base_price ?? row.totalRowPrice ?? row.total_row_price,
    parseNumberish(row.base_price ?? row.totalRowPrice, 0)
  );

  const unitPriceRaw = parseNonNegativeAmount(
    row.unit_price ?? row.unitPrice,
    Number((totalRowPrice / Math.max(quantity, 1)).toFixed(2))
  );

  const explicitFinalPrice = parseNonNegativeAmount(row.final_price ?? row.finalPrice, NaN);
  const taxMultiplierFromFinal =
    Number.isFinite(explicitFinalPrice) && totalRowPrice > 0
      ? Number(explicitFinalPrice / totalRowPrice)
      : NaN;

  const taxMultiplier = parseTaxMultiplier(
    row.tax_multiplier ?? row.taxMultiplier,
    parseTaxMultiplier(taxMultiplierFromFinal, 1)
  );

  const finalPrice =
    Number.isFinite(explicitFinalPrice) && explicitFinalPrice >= 0
      ? explicitFinalPrice
      : Number((totalRowPrice * taxMultiplier).toFixed(2));

  const categoryName = toReceiptCategory(row.category_name ?? row.category, name);
  const taxCategory = toTaxCategory(row.tax_category ?? row.taxCategory, categoryName, name);

  return {
    id: String(row.id ?? ''),
    expense_id: String(row.expense_id ?? ''),
    name,
    quantity,
    unitPrice: unitPriceRaw,
    totalRowPrice,
    basePrice: totalRowPrice,
    finalPrice,
    taxMultiplier,
    taxCategory,
    categoryName,
    qtyMapFromItem: parseQtyMap(row.qty_map)
  };
}

function extractScannedItems(payload: {
  items?: unknown;
  categories?: unknown;
}): ScannedReceiptItem[] {
  const fromCategories = Array.isArray(payload.categories)
    ? (payload.categories as Array<Record<string, unknown>>).flatMap((categoryRow) => {
        const categoryName = toReceiptCategory(categoryRow.category);
        const categoryTaxMultiplier = parseTaxMultiplier(categoryRow.taxMultiplier, 1);
        const categoryItems = Array.isArray(categoryRow.items)
          ? (categoryRow.items as Array<Record<string, unknown>>)
          : [];

        return categoryItems.map((item) => {
          const quantity = parsePositiveInteger(item.quantity, 1);
          const unitPriceCandidate = parseNonNegativeAmount(
            item.unitPrice ?? item.price ?? item.basePrice,
            NaN
          );
          const totalRowCandidate = parseNonNegativeAmount(
            item.totalRowPrice ?? item.rowPrice ?? item.basePrice,
            NaN
          );

          const unitPrice =
            Number.isFinite(unitPriceCandidate)
              ? unitPriceCandidate
              : Number.isFinite(totalRowCandidate)
                ? Number((totalRowCandidate / quantity).toFixed(2))
                : NaN;

          const totalRowPrice = Number.isFinite(unitPrice)
            ? Number((quantity * unitPrice).toFixed(2))
            : NaN;

          const name = String(item.name ?? '').trim();
          const inferredCategory = toReceiptCategory(categoryName, name);

          return {
            name,
            category: inferredCategory,
            quantity,
            unitPrice,
            totalRowPrice,
            taxMultiplier: categoryTaxMultiplier,
            taxCategory: toTaxCategory(item.taxCategory, inferredCategory, name),
            autoSplitAll: Boolean(item.autoSplitAll) || WATER_REGEX.test(name)
          } satisfies ScannedReceiptItem;
        });
      })
    : [];

  if (fromCategories.length > 0) {
    return fromCategories.filter(
      (item) =>
        item.name &&
        item.quantity > 0 &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0 &&
        Number.isFinite(item.totalRowPrice) &&
        item.totalRowPrice >= 0
    );
  }

  const fromItems = Array.isArray(payload.items)
    ? (payload.items as Array<Record<string, unknown>>).map((item) => {
        const quantity = parsePositiveInteger(item.quantity, 1);
        const unitPriceCandidate = parseNonNegativeAmount(
          item.unitPrice ?? item.price ?? item.basePrice,
          NaN
        );
        const totalRowCandidate = parseNonNegativeAmount(
          item.totalRowPrice ?? item.rowPrice ?? item.basePrice,
          NaN
        );

        const unitPrice =
          Number.isFinite(unitPriceCandidate)
            ? unitPriceCandidate
            : Number.isFinite(totalRowCandidate)
              ? Number((totalRowCandidate / quantity).toFixed(2))
              : NaN;

        const totalRowPrice = Number.isFinite(unitPrice)
          ? Number((quantity * unitPrice).toFixed(2))
          : NaN;

        const name = String(item.name ?? '').trim();
        const category = toReceiptCategory(item.category, name);

        return {
          name,
          category,
          quantity,
          unitPrice,
          totalRowPrice,
          taxMultiplier: parseTaxMultiplier(item.taxMultiplier, 1),
          taxCategory: toTaxCategory(item.taxCategory, category, name),
          autoSplitAll: Boolean(item.autoSplitAll) || WATER_REGEX.test(name)
        } satisfies ScannedReceiptItem;
      })
    : [];

  return fromItems.filter(
    (item) =>
      item.name &&
      item.quantity > 0 &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isFinite(item.totalRowPrice) &&
      item.totalRowPrice >= 0
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;

  const supabaseRef = useRef<ReturnType<typeof getSupabaseBrowserClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = getSupabaseBrowserClient();
    return supabaseRef.current;
  }, []);

  const participantStorageKey = useMemo(() => `billwizard:participant:${roomId}`, [roomId]);
  const settledStorageKey = useMemo(() => `billwizard:settled:${roomId}`, [roomId]);

  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [itemAssignments, setItemAssignments] = useState<ItemAssignmentRecord[]>([]);

  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [activeTab, setActiveTab] = useState<SidebarTab>('home');
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState<string | null>(null);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinPhone, setJoinPhone] = useState('');
  const [joinUpi, setJoinUpi] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserUpi, setNewUserUpi] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);

  const [showScanModal, setShowScanModal] = useState(false);
  const [scanExpenseTitle, setScanExpenseTitle] = useState('');
  const [scanPayerId, setScanPayerId] = useState('');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scanProgressPct, setScanProgressPct] = useState(0);
  const [scanProgressLabel, setScanProgressLabel] = useState('');

  const [showManualExpenseModal, setShowManualExpenseModal] = useState(false);
  const [manualExpenseTitle, setManualExpenseTitle] = useState('');
  const [manualExpensePayerId, setManualExpensePayerId] = useState('');
  const [manualExpenseAmount, setManualExpenseAmount] = useState('');
  const [manualExpenseRemark, setManualExpenseRemark] = useState('');
  const [manualUseMultiplePayers, setManualUseMultiplePayers] = useState(false);
  const [manualPayerSplits, setManualPayerSplits] = useState<ManualPayerSplit[]>([]);
  const [manualSplitMode, setManualSplitMode] = useState<ManualSplitMode>('equal');
  const [manualSplitParticipantIds, setManualSplitParticipantIds] = useState<string[]>([]);
  const [manualSplitRatios, setManualSplitRatios] = useState<Record<string, string>>({});
  const [creatingManualExpense, setCreatingManualExpense] = useState(false);

  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<string>>(new Set());
  const [openQtyPanelByItem, setOpenQtyPanelByItem] = useState<Record<string, string | null>>({});

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemEditDraft | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const [customItemForms, setCustomItemForms] = useState<Record<string, CustomItemForm>>({});
  const [addingCustomItemKey, setAddingCustomItemKey] = useState<string | null>(null);

  const [exportingWorkbook, setExportingWorkbook] = useState(false);
  const [settledAmountsByParticipant, setSettledAmountsByParticipant] = useState<Record<string, number>>({});

  const [pastSplitSummaries, setPastSplitSummaries] = useState<PastSplitSummary[]>([]);
  const [loadingPastSplits, setLoadingPastSplits] = useState(false);
  const [pastSplitsError, setPastSplitsError] = useState<string | null>(null);
  const [editingPastTripId, setEditingPastTripId] = useState<string | null>(null);
  const [editingPastTripName, setEditingPastTripName] = useState('');
  const [savingPastTripName, setSavingPastTripName] = useState(false);
  const [deletingPastTripId, setDeletingPastTripId] = useState<string | null>(null);

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileUpi, setProfileUpi] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [upiPaymentSheet, setUpiPaymentSheet] = useState<UpiPaymentSheet | null>(null);
  const [activeReceiptViewer, setActiveReceiptViewer] = useState<{ url: string; title: string } | null>(null);
  const [receiptZoom, setReceiptZoom] = useState(1);
  const [receiptPan, setReceiptPan] = useState({ x: 0, y: 0 });

  const publicShareBaseUrl = useMemo(() => {
    const configuredBase = String(process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
    if (configuredBase) {
      const withProtocol = /^https?:\/\//i.test(configuredBase)
        ? configuredBase
        : `https://${configuredBase}`;
      return withProtocol.replace(/\/+$/, '');
    }

    const vercelBase = String(process.env.NEXT_PUBLIC_VERCEL_URL ?? '').trim();
    if (vercelBase) {
      const withoutProtocol = vercelBase.replace(/^https?:\/\//i, '');
      return `https://${withoutProtocol}`.replace(/\/+$/, '');
    }

    return window.location.origin.replace(/\/+$/, '');
  }, []);

  const manualPayerSplitTotal = useMemo(
    () =>
      manualPayerSplits.reduce((sum, row) => {
        const amount = parseNonNegativeAmount(row.amount, 0);
        return sum + (amount > 0 ? amount : 0);
      }, 0),
    [manualPayerSplits]
  );

  const toastTimerRef = useRef<number | null>(null);
  const itemsRef = useRef<ItemRecord[]>([]);
  const assignmentsRef = useRef<ItemAssignmentRecord[]>([]);
  const expenseIdsRef = useRef<Set<string>>(new Set());
  const itemIdsRef = useRef<Set<string>>(new Set());
  const participantIdsRef = useRef<Set<string>>(new Set());
  const receiptPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const receiptGestureRef = useRef({
    startScale: 1,
    startDistance: 0,
    startCenterX: 0,
    startCenterY: 0,
    panStartX: 0,
    panStartY: 0,
    dragStartX: 0,
    dragStartY: 0
  });

  const pushToast = useCallback((type: ToastState['type'], message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast({ type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3800);
  }, []);

  const loadParticipantIdentityRows = useCallback(async () => {
    const supabase = getSupabase();
    const participantsQuery = await supabase
      .from('participants')
      .select('id, name, phone_number, upi_id')
      .eq('session_id', roomId);

    let rowsRaw = participantsQuery.data as Array<Record<string, unknown>> | null;
    if (participantsQuery.error) {
      const fallbackParticipantsQuery = await supabase
        .from('participants')
        .select('id, name')
        .eq('session_id', roomId);
      if (fallbackParticipantsQuery.error) throw new Error(fallbackParticipantsQuery.error.message);
      rowsRaw = fallbackParticipantsQuery.data as Array<Record<string, unknown>> | null;
    }

    return (rowsRaw ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      phone_number: typeof row.phone_number === 'string' ? row.phone_number : null,
      upi_id: typeof row.upi_id === 'string' ? row.upi_id : null
    })) as ParticipantIdentityRecord[];
  }, [getSupabase, roomId]);

  useEffect(() => {
    itemsRef.current = items;
    itemIdsRef.current = new Set(items.map((item) => item.id));
  }, [items]);

  useEffect(() => {
    assignmentsRef.current = itemAssignments;
  }, [itemAssignments]);

  useEffect(() => {
    expenseIdsRef.current = new Set(expenses.map((expense) => expense.id));
  }, [expenses]);

  useEffect(() => {
    participantIdsRef.current = new Set(participants.map((participant) => participant.id));
  }, [participants]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(settledStorageKey);
    if (!raw) {
      setSettledAmountsByParticipant({});
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      setSettledAmountsByParticipant(parsed && typeof parsed === 'object' ? parsed : {});
    } catch {
      setSettledAmountsByParticipant({});
    }
  }, [settledStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(settledStorageKey, JSON.stringify(settledAmountsByParticipant));
  }, [settledAmountsByParticipant, settledStorageKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return;

    try {
      const profile = JSON.parse(raw) as {
        defaultName?: string;
        whatsappNumber?: string;
        upiId?: string;
        name?: string;
        phone?: string;
        upi?: string;
      };

      const savedName = String(profile.defaultName ?? profile.name ?? '').trim();
      const savedPhone = String(profile.whatsappNumber ?? profile.phone ?? '').trim();
      const savedUpi = String(profile.upiId ?? profile.upi ?? '').trim();

      if (savedName) setJoinName((current) => current || savedName);
      if (savedPhone) setJoinPhone((current) => current || savedPhone);
      if (savedUpi) setJoinUpi((current) => current || savedUpi);
    } catch {
      // Ignore corrupt local profile and keep manual entry flow working.
    }
  }, []);

  const participantsById = useMemo(() => {
    const map: Record<string, ParticipantRecord> = {};
    for (const participant of participants) map[participant.id] = participant;
    return map;
  }, [participants]);

  const participantView = useMemo<ItemRowParticipant[]>(
    () =>
      participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
        initials: getInitials(participant.name)
      })),
    [participants]
  );

  const sidebarParticipants = useMemo(
    () =>
      participantView.map((participant) => ({
        ...participant,
        avatarBg: '#F5F4F1',
        avatarText: '#334155'
      })),
    [participantView]
  );

  const currentUser = useMemo(() => {
    if (!currentParticipantId) return null;
    const current = participantsById[currentParticipantId];
    if (!current) return null;

    return {
      name: current.name,
      initials: getInitials(current.name)
    };
  }, [currentParticipantId, participantsById]);

  const currentParticipant = useMemo(() => {
    if (!currentParticipantId) return null;
    return participantsById[currentParticipantId] ?? null;
  }, [currentParticipantId, participantsById]);

  const canManageParticipants = Boolean(currentParticipantId);

  useEffect(() => {
    setProfileName(currentParticipant?.name ?? '');
    setProfilePhone(currentParticipant?.phone_number ?? '');
    setProfileUpi(currentParticipant?.upi_id ?? '');
  }, [currentParticipant]);

  useEffect(() => {
    if (!activeReceiptViewer) return;

    const previousOverflow = document.body.style.overflow;
    const pointers = receiptPointersRef.current;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      pointers.clear();
    };
  }, [activeReceiptViewer]);

  const qtyMapByItem = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};

    // Key decision: we support both storage patterns so collaboration remains compatible
    // even if the DB currently stores shares in either `items.qty_map` or `item_assignments`.
    for (const item of items) {
      map[item.id] = { ...item.qtyMapFromItem };
    }

    for (const assignment of itemAssignments) {
      if (!map[assignment.item_id]) map[assignment.item_id] = {};
      map[assignment.item_id][assignment.participant_id] = parseNonNegativeInteger(
        assignment.assigned_shares,
        0
      );
    }

    return map;
  }, [itemAssignments, items]);

  const itemsByExpenseId = useMemo(() => {
    const map: Record<string, ItemRecord[]> = {};
    for (const item of items) {
      if (!map[item.expense_id]) map[item.expense_id] = [];
      map[item.expense_id].push(item);
    }
    return map;
  }, [items]);

  const expenseTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const expense of expenses) {
      map[expense.id] = expense.title;
    }
    return map;
  }, [expenses]);

  const expenseTotalsById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const expense of expenses) map[expense.id] = 0;
    for (const item of items) {
      map[item.expense_id] = (map[item.expense_id] ?? 0) + item.finalPrice;
    }
    return map;
  }, [expenses, items]);

  const groupedCategoriesByExpense = useMemo(() => {
    const map: Record<string, CategoryViewModel[]> = {};

    for (const expense of expenses) {
      const groups: Record<ReceiptCategory, ItemRowModel[]> = {
        'Veg Food': [],
        'Non-Veg Food': [],
        Breads: [],
        'Non-Alcoholic Beverages': [],
        Alcohol: []
      };

      const expenseItems = itemsByExpenseId[expense.id] ?? [];

      for (const item of expenseItems) {
        const qtyMap = qtyMapByItem[item.id] ?? {};
        const totalShares = Object.values(qtyMap).reduce((sum, shares) => sum + shares, 0);

        groups[item.categoryName].push({
          id: item.id,
          name: item.name,
          basePrice: item.basePrice,
          finalPrice: item.finalPrice,
          taxCategory: item.taxCategory,
          totalShares,
          qtyMap
        });
      }

      map[expense.id] = RECEIPT_CATEGORY_ORDER.map((categoryName) => {
        const categoryItems = groups[categoryName];
        const effectiveMultiplier =
          categoryItems.find((item) => item.basePrice > 0)
            ? Number(
                (
                  categoryItems.reduce((sum, item) => {
                    if (item.basePrice <= 0) return sum;
                    return sum + item.finalPrice / item.basePrice;
                  }, 0) /
                  Math.max(categoryItems.filter((item) => item.basePrice > 0).length, 1)
                ).toFixed(3)
              )
            : 1;

        return {
          key: categoryName,
          title: categoryName,
          subtitle: `Tax/Discount multiplier: x${effectiveMultiplier.toFixed(3)}`,
          taxMultiplier: effectiveMultiplier,
          items: categoryItems
        } satisfies CategoryViewModel;
      });
    }

    return map;
  }, [expenses, itemsByExpenseId, qtyMapByItem]);

  const totalExpenseSoFar = useMemo(
    () => Object.values(expenseTotalsById).reduce((sum, total) => sum + total, 0),
    [expenseTotalsById]
  );

  const expenseBreakdown = useMemo(() => {
    let food = 0;
    let drinks = 0;
    let travel = 0;
    let stay = 0;

    for (const item of items) {
      const expenseTitle = expenseTitleById[item.expense_id] ?? '';
      const contextText = `${item.name} ${expenseTitle}`;

      if (STAY_SUMMARY_REGEX.test(contextText)) {
        stay += item.finalPrice;
        continue;
      }

      if (TRAVEL_SUMMARY_REGEX.test(contextText)) {
        travel += item.finalPrice;
        continue;
      }

      if (
        item.categoryName === 'Non-Alcoholic Beverages' ||
        item.categoryName === 'Alcohol' ||
        DRINK_REGEX.test(contextText) ||
        ALCOHOL_REGEX.test(contextText)
      ) {
        drinks += item.finalPrice;
        continue;
      }

      food += item.finalPrice;
    }

    return {
      food,
      drinks,
      travel,
      stay
    };
  }, [expenseTitleById, items]);

  const participantLedger = useMemo<LedgerRow[]>(() => {
    const paidTotals: Record<string, number> = {};
    const consumedTotals: Record<string, number> = {};
    const lineItemsByParticipant: Record<string, Array<{ name: string; netCost: number }>> = {};

    for (const participant of participants) {
      paidTotals[participant.id] = 0;
      consumedTotals[participant.id] = 0;
      lineItemsByParticipant[participant.id] = [];
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
          {
            name: `${item.name} (Qty ${shares})`,
            netCost
          }
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
        phoneNumber: participant.phone_number,
        totalPaidUpfront,
        totalConsumed,
        netBalance,
        owesAmount: Math.max(-netBalance, 0),
        receivesAmount: Math.max(netBalance, 0),
        lineItems: lineItemsByParticipant[participant.id] ?? []
      };
    });
  }, [expenseTotalsById, expenses, items, participants, qtyMapByItem]);

  const settlementEntries = useMemo<SettlementEntry[]>(() => {
    const collectorId = selectedCollectorId;
    const collectorRow = collectorId
      ? participantLedger.find((row) => row.participantId === collectorId) ?? null
      : null;
    const collectorCanReceive = Boolean(collectorRow && collectorRow.receivesAmount > 0.0001);

    let settledTransferTotal = 0;
    if (collectorCanReceive && collectorId) {
      for (const row of participantLedger) {
        if (row.participantId === collectorId) continue;
        const settledAmount = Math.max(settledAmountsByParticipant[row.participantId] ?? 0, 0);
        settledTransferTotal += Math.min(settledAmount, row.owesAmount);
      }
    }

    return participantLedger.map((row) => {
      const settledAmount = Math.max(settledAmountsByParticipant[row.participantId] ?? 0, 0);
      const remainingOwed = Math.max(row.owesAmount - settledAmount, 0);

      if (collectorCanReceive && collectorId && row.participantId === collectorId) {
        const adjustedReceives = Math.max(row.receivesAmount - settledTransferTotal, 0);
        return {
          participantId: row.participantId,
          totalPaidUpfront: row.totalPaidUpfront,
          totalConsumed: row.totalConsumed,
          theirShare: row.totalConsumed,
          netBalance: adjustedReceives,
          owesAmount: 0,
          receivesAmount: adjustedReceives,
          isMarkedSettled: false
        };
      }

      return {
        participantId: row.participantId,
        totalPaidUpfront: row.totalPaidUpfront,
        totalConsumed: row.totalConsumed,
        theirShare: row.totalConsumed,
        netBalance: row.receivesAmount > 0 ? row.receivesAmount : -remainingOwed,
        owesAmount: remainingOwed,
        receivesAmount: row.receivesAmount,
        isMarkedSettled: row.owesAmount > 0 && remainingOwed === 0
      };
    });
  }, [participantLedger, selectedCollectorId, settledAmountsByParticipant]);

  useEffect(() => {
    if (participantLedger.length === 0) return;

    const receivingRows = participantLedger.filter((row) => row.receivesAmount > 0.0001);
    if (receivingRows.length === 0) return;

    const sortedReceivers = [...receivingRows].sort((a, b) => b.receivesAmount - a.receivesAmount);
    const preferredReceiverWithUpi = sortedReceivers.find((row) =>
      Boolean(participantsById[row.participantId]?.upi_id?.trim())
    );
    const preferredCollectorId = preferredReceiverWithUpi?.participantId ?? sortedReceivers[0].participantId;

    setSelectedCollectorId((current) => {
      if (!current) return preferredCollectorId;

      const currentRow = participantLedger.find((row) => row.participantId === current);
      if (!currentRow) return preferredCollectorId;
      if (currentRow.receivesAmount > 0.0001) return current;

      return preferredCollectorId;
    });
  }, [participantLedger, participantsById]);

  const updateCollectorSelection = useCallback(
    (participantRows: ParticipantRecord[]) => {
      const participantIds = participantRows.map((participant) => participant.id);
      setSelectedCollectorId((current) => {
        if (current && participantIds.includes(current)) return current;
        const withUpi = participantRows.find((participant) => Boolean(participant.upi_id?.trim()));
        if (withUpi) return withUpi.id;
        if (currentParticipantId && participantIds.includes(currentParticipantId)) return currentParticipantId;
        return participantIds[0] ?? null;
      });
    },
    [currentParticipantId]
  );

  const loadRoomSnapshot = useCallback(async () => {
    const supabase = getSupabase();
    setLoadingRoom(true);
    setRoomError(null);

    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('id', roomId)
        .maybeSingle();

      if (sessionError) throw new Error(sessionError.message);
      if (!sessionRow) {
        setRoomError('This room does not exist.');
        setLoadingRoom(false);
        return;
      }

      const participantsQuery = await supabase
        .from('participants')
        .select('id, session_id, name, is_manual, phone_number, upi_id')
        .eq('session_id', roomId);

      let participantRowsRaw = participantsQuery.data as Array<Record<string, unknown>> | null;
      if (participantsQuery.error) {
        const fallbackParticipantsQuery = await supabase
          .from('participants')
          .select('id, session_id, name, is_manual')
          .eq('session_id', roomId);

        if (fallbackParticipantsQuery.error) throw new Error(fallbackParticipantsQuery.error.message);
        participantRowsRaw = fallbackParticipantsQuery.data as Array<Record<string, unknown>> | null;
      }

      const participantRows: ParticipantRecord[] = (participantRowsRaw ?? []).map((row) => ({
        id: String(row.id),
        session_id: String(row.session_id),
        name: String(row.name),
        is_manual: Boolean(row.is_manual),
        phone_number: typeof row.phone_number === 'string' ? row.phone_number : null,
        upi_id: typeof row.upi_id === 'string' ? row.upi_id : null
      }));

      const expensesQuery = await supabase
        .from('expenses')
        .select('id, session_id, payer_id, title, expense_type, receipt_url')
        .eq('session_id', roomId);

      let expenseRowsRaw = expensesQuery.data as Array<Record<string, unknown>> | null;
      if (expensesQuery.error) {
        const fallbackExpensesQuery = await supabase
          .from('expenses')
          .select('id, session_id, payer_id, title, expense_type')
          .eq('session_id', roomId);
        if (fallbackExpensesQuery.error) throw new Error(fallbackExpensesQuery.error.message);
        expenseRowsRaw = fallbackExpensesQuery.data as Array<Record<string, unknown>> | null;
      }

      const expenseRows: ExpenseRecord[] = (expenseRowsRaw ?? []).map((row) => ({
        id: String(row.id),
        session_id: String(row.session_id),
        payer_id: String(row.payer_id),
        title: String(row.title),
        expense_type: (row.expense_type ?? 'manual') as ExpenseType,
        receipt_url: typeof row.receipt_url === 'string' ? row.receipt_url : null
      }));

      let itemRows: ItemRecord[] = [];
      if (expenseRows.length > 0) {
        const expenseIds = expenseRows.map((expense) => expense.id);

        let itemRowsRaw: Array<Record<string, unknown>> = [];
        const fullItemsQuery = await supabase
          .from('items')
          .select(
            'id, expense_id, name, quantity, unit_price, base_price, final_price, tax_multiplier, tax_category, category_name, qty_map'
          )
          .in('expense_id', expenseIds);

        if (fullItemsQuery.error) {
          const fallbackItemsQuery = await supabase
            .from('items')
            .select('id, expense_id, name, quantity, base_price, tax_multiplier, category_name')
            .in('expense_id', expenseIds);

          if (fallbackItemsQuery.error) throw new Error(fallbackItemsQuery.error.message);
          itemRowsRaw = (fallbackItemsQuery.data ?? []) as Array<Record<string, unknown>>;
        } else {
          itemRowsRaw = (fullItemsQuery.data ?? []) as Array<Record<string, unknown>>;
        }

        itemRows = itemRowsRaw.map((row) => normalizeItemRow(row)).filter((row) => row.id && row.expense_id);
      }

      let assignmentRows: ItemAssignmentRecord[] = [];
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

      setParticipants(participantRows);
      setExpenses(expenseRows);
      setItems(itemRows);
      setItemAssignments(assignmentRows);

      const savedParticipantId = window.localStorage.getItem(participantStorageKey);
      if (savedParticipantId && participantRows.some((participant) => participant.id === savedParticipantId)) {
        setCurrentParticipantId(savedParticipantId);
        setShowJoinModal(false);
      } else {
        setCurrentParticipantId(null);
        setShowJoinModal(true);
      }

      updateCollectorSelection(participantRows);

      // Keep all expenses collapsed by default as requested, but auto-expand the latest
      // when there is only one expense to reduce initial click friction.
      setExpandedExpenseIds(() => {
        if (expenseRows.length === 1) return new Set([expenseRows[0].id]);
        return new Set();
      });
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Unable to load this room.');
    } finally {
      setLoadingRoom(false);
    }
  }, [getSupabase, participantStorageKey, roomId, updateCollectorSelection]);

  useEffect(() => {
    void loadRoomSnapshot();
  }, [loadRoomSnapshot]);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel(`room:${roomId}:realtime`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${roomId}` },
      (payload) => {
        const next = payload.new as Partial<ParticipantRecord>;
        const previous = payload.old as Partial<ParticipantRecord>;

        if (payload.eventType === 'INSERT' && next.id && next.session_id && next.name) {
          setParticipants((current) =>
            upsertById(current, {
              id: String(next.id),
              session_id: String(next.session_id),
              name: String(next.name),
              is_manual: Boolean(next.is_manual),
              phone_number: typeof next.phone_number === 'string' ? next.phone_number : null,
              upi_id: typeof next.upi_id === 'string' ? next.upi_id : null
            })
          );
          return;
        }

        if (payload.eventType === 'UPDATE' && next.id && next.session_id && next.name) {
          setParticipants((current) =>
            upsertById(current, {
              id: String(next.id),
              session_id: String(next.session_id),
              name: String(next.name),
              is_manual: Boolean(next.is_manual),
              phone_number: typeof next.phone_number === 'string' ? next.phone_number : null,
              upi_id: typeof next.upi_id === 'string' ? next.upi_id : null
            })
          );
          return;
        }

        if (payload.eventType === 'DELETE' && previous.id) {
          const deletedParticipantId = String(previous.id);
          setParticipants((current) => removeById(current, deletedParticipantId));
          setItemAssignments((current) =>
            current.filter((assignment) => assignment.participant_id !== deletedParticipantId)
          );

          if (deletedParticipantId === currentParticipantId) {
            setCurrentParticipantId(null);
            setShowJoinModal(true);
            window.localStorage.removeItem(participantStorageKey);
          }
        }
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses', filter: `session_id=eq.${roomId}` },
      (payload) => {
        const next = payload.new as Partial<ExpenseRecord>;
        const previous = payload.old as Partial<ExpenseRecord>;

        if (payload.eventType === 'INSERT' && next.id && next.session_id && next.payer_id && next.title) {
          setExpenses((current) =>
            upsertById(current, {
              id: String(next.id),
              session_id: String(next.session_id),
              payer_id: String(next.payer_id),
              title: String(next.title),
              expense_type: (next.expense_type ?? 'manual') as ExpenseType,
              receipt_url: typeof next.receipt_url === 'string' ? next.receipt_url : null
            })
          );
          return;
        }

        if (payload.eventType === 'UPDATE' && next.id && next.session_id && next.payer_id && next.title) {
          setExpenses((current) =>
            {
              const existingReceiptUrl =
                current.find((expense) => expense.id === String(next.id))?.receipt_url ?? null;
              const nextReceiptUrl = Object.prototype.hasOwnProperty.call(next, 'receipt_url')
                ? typeof next.receipt_url === 'string'
                  ? next.receipt_url
                  : null
                : existingReceiptUrl;

              return upsertById(current, {
                id: String(next.id),
                session_id: String(next.session_id),
                payer_id: String(next.payer_id),
                title: String(next.title),
                expense_type: (next.expense_type ?? 'manual') as ExpenseType,
                receipt_url: nextReceiptUrl
              });
            }
          );
          return;
        }

        if (payload.eventType === 'DELETE' && previous.id) {
          const deletedExpenseId = String(previous.id);
          setExpenses((current) => removeById(current, deletedExpenseId));
          setItems((current) => current.filter((item) => item.expense_id !== deletedExpenseId));
          setExpandedExpenseIds((current) => {
            const copy = new Set(current);
            copy.delete(deletedExpenseId);
            return copy;
          });
        }
      }
    );

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
      const next = payload.new as Record<string, unknown>;
      const previous = payload.old as Record<string, unknown>;
      const expenseId = String(next.expense_id ?? previous.expense_id ?? '');

      if (!expenseId || !expenseIdsRef.current.has(expenseId)) return;

      if (payload.eventType === 'DELETE') {
        const deletedItemId = String(previous.id ?? '');
        if (!deletedItemId) return;

        setItems((current) => removeById(current, deletedItemId));
        setItemAssignments((current) => current.filter((assignment) => assignment.item_id !== deletedItemId));
        return;
      }

      const normalizedItem = normalizeItemRow(next);
      if (!normalizedItem.id || !normalizedItem.expense_id) return;
      setItems((current) => upsertById(current, normalizedItem));
    });

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'item_assignments' },
      (payload) => {
        const next = payload.new as Partial<ItemAssignmentRecord>;
        const previous = payload.old as Partial<ItemAssignmentRecord>;

        const itemId = String(next.item_id ?? previous.item_id ?? '');
        const participantId = String(next.participant_id ?? previous.participant_id ?? '');
        if (!itemId || !participantId) return;

        if (!itemIdsRef.current.has(itemId) && !participantIdsRef.current.has(participantId)) return;

        const row: ItemAssignmentRecord = {
          item_id: itemId,
          participant_id: participantId,
          assigned_shares: parseNonNegativeInteger(next.assigned_shares, 0)
        };

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          setItemAssignments((current) => upsertAssignment(current, row));
          return;
        }

        if (payload.eventType === 'DELETE') {
          setItemAssignments((current) => removeAssignment(current, row));
        }
      }
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentParticipantId, getSupabase, participantStorageKey, roomId]);

  useEffect(() => {
    updateCollectorSelection(participants);
  }, [participants, updateCollectorSelection]);

  const loadPastSplitsByPhone = useCallback(
    async (phoneNumber: string) => {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!normalizedPhone) {
        setPastSplitSummaries([]);
        setPastSplitsError(null);
        return;
      }

      setLoadingPastSplits(true);
      setPastSplitsError(null);

      try {
        const supabase = getSupabase();
        const participantsQuery = await supabase
          .from('participants')
          .select('id, session_id, phone_number')
          .eq('phone_number', normalizedPhone);

        if (participantsQuery.error) throw new Error(participantsQuery.error.message);

        let matchingParticipants = (participantsQuery.data ?? []) as Array<{
          id: string;
          session_id: string;
          phone_number: string | null;
        }>;

        if (matchingParticipants.length === 0 && normalizedPhone.length >= 10) {
          const fallbackDigits = normalizedPhone.slice(-10);
          const fallbackQuery = await supabase
            .from('participants')
            .select('id, session_id, phone_number')
            .like('phone_number', `%${fallbackDigits}`);

          if (!fallbackQuery.error) {
            matchingParticipants = (fallbackQuery.data ?? []) as Array<{
              id: string;
              session_id: string;
              phone_number: string | null;
            }>;
          }
        }

        const sessions = Array.from(
          new Set(
            matchingParticipants.map((participant) => String(participant.session_id)).filter((id) => id !== roomId)
          )
        );

        if (sessions.length === 0) {
          setPastSplitSummaries([]);
          setLoadingPastSplits(false);
          return;
        }

        const participantIdBySession: Record<string, string> = {};
        for (const participant of matchingParticipants) {
          if (!participantIdBySession[String(participant.session_id)]) {
            participantIdBySession[String(participant.session_id)] = String(participant.id);
          }
        }

        const sessionNameById: Record<string, string> = {};
        const sessionsQuery = await supabase.from('sessions').select('id, name').in('id', sessions);
        if (!sessionsQuery.error) {
          const sessionRows = (sessionsQuery.data ?? []) as Array<{ id: string; name: string | null }>;
          for (const session of sessionRows) {
            const nextName = typeof session.name === 'string' ? session.name.trim() : '';
            if (nextName) sessionNameById[String(session.id)] = nextName;
          }
        }

        const expensesQuery = await supabase
          .from('expenses')
          .select('id, session_id, title, payer_id')
          .in('session_id', sessions);

        if (expensesQuery.error) throw new Error(expensesQuery.error.message);

        const expenseRows = (expensesQuery.data ?? []) as Array<{
          id: string;
          session_id: string;
          title: string;
          payer_id: string;
        }>;

        if (expenseRows.length === 0) {
          setPastSplitSummaries([]);
          setLoadingPastSplits(false);
          return;
        }

        const expenseIds = expenseRows.map((expense) => String(expense.id));
        let itemRows: Array<Record<string, unknown>> = [];

        const fullItemsQuery = await supabase
          .from('items')
          .select('expense_id, base_price, final_price, tax_multiplier')
          .in('expense_id', expenseIds);

        if (fullItemsQuery.error) {
          const fallbackItemsQuery = await supabase
            .from('items')
            .select('expense_id, base_price, tax_multiplier')
            .in('expense_id', expenseIds);
          if (fallbackItemsQuery.error) throw new Error(fallbackItemsQuery.error.message);
          itemRows = (fallbackItemsQuery.data ?? []) as Array<Record<string, unknown>>;
        } else {
          itemRows = (fullItemsQuery.data ?? []) as Array<Record<string, unknown>>;
        }

        const expenseTotalById: Record<string, number> = {};
        for (const expense of expenseRows) expenseTotalById[String(expense.id)] = 0;

        for (const row of itemRows) {
          const expenseId = String(row.expense_id ?? '');
          if (!expenseId) continue;

          const basePrice = parseNonNegativeAmount(row.base_price, 0);
          const finalPrice = parseNonNegativeAmount(row.final_price, NaN);
          const taxMultiplier = parseTaxMultiplier(row.tax_multiplier, 1);
          const net = Number.isFinite(finalPrice) ? finalPrice : Number((basePrice * taxMultiplier).toFixed(2));

          expenseTotalById[expenseId] = (expenseTotalById[expenseId] ?? 0) + net;
        }

        const summaryBySession: Record<string, PastSplitSummary> = {};
        for (const expense of expenseRows) {
          const sessionId = String(expense.session_id);
          const expenseTotal = expenseTotalById[String(expense.id)] ?? 0;
          const isPaidByUser = String(expense.payer_id) === participantIdBySession[sessionId];

          if (!summaryBySession[sessionId]) {
            const fallbackTitle = String(expense.title ?? 'Trip expenses');
            const presetName = sessionNameById[sessionId] ?? '';

            summaryBySession[sessionId] = {
              sessionId,
              tripName: presetName || fallbackTitle,
              totalExpense: 0,
              totalPaidByYou: 0,
              expenseCount: 0,
              firstExpenseId: String(expense.id),
              firstExpenseTitle: String(expense.title ?? 'Trip expenses')
            };
          }

          summaryBySession[sessionId].totalExpense += expenseTotal;
          summaryBySession[sessionId].expenseCount += 1;
          if (isPaidByUser) summaryBySession[sessionId].totalPaidByYou += expenseTotal;
        }

        const summaries = Object.values(summaryBySession).sort((a, b) => b.totalExpense - a.totalExpense);
        setPastSplitSummaries(summaries);
      } catch (error) {
        setPastSplitsError(error instanceof Error ? error.message : 'Unable to load past splits.');
      } finally {
        setLoadingPastSplits(false);
      }
    },
    [getSupabase, roomId]
  );

  useEffect(() => {
    const phone = normalizePhoneNumber(currentParticipant?.phone_number);
    if (!phone) {
      setPastSplitSummaries([]);
      setPastSplitsError(null);
      return;
    }

    void loadPastSplitsByPhone(phone);
  }, [currentParticipant?.phone_number, loadPastSplitsByPhone]);

  const totalPastTripsExpense = useMemo(
    () => pastSplitSummaries.reduce((sum, summary) => sum + summary.totalExpense, 0),
    [pastSplitSummaries]
  );

  const totalPastTripsPaidByYou = useMemo(
    () => pastSplitSummaries.reduce((sum, summary) => sum + summary.totalPaidByYou, 0),
    [pastSplitSummaries]
  );

  const pastSplitChartData = useMemo(() => {
    return [...pastSplitSummaries].sort((a, b) => b.totalExpense - a.totalExpense).slice(0, 8);
  }, [pastSplitSummaries]);

  const maxPastSplitChartValue = useMemo(
    () =>
      pastSplitChartData.reduce((max, summary) => Math.max(max, summary.totalExpense), 0),
    [pastSplitChartData]
  );

  useEffect(() => {
    if (!editingPastTripId) return;
    if (pastSplitSummaries.some((summary) => summary.sessionId === editingPastTripId)) return;
    setEditingPastTripId(null);
    setEditingPastTripName('');
  }, [editingPastTripId, pastSplitSummaries]);

  const handleStartEditingPastTrip = useCallback((summary: PastSplitSummary) => {
    setEditingPastTripId(summary.sessionId);
    setEditingPastTripName(summary.tripName || summary.firstExpenseTitle || `Trip ${summary.sessionId.slice(0, 6)}`);
  }, []);

  const handleCancelEditingPastTrip = useCallback(() => {
    setEditingPastTripId(null);
    setEditingPastTripName('');
  }, []);

  const handleSavePastTripName = useCallback(async () => {
    if (!editingPastTripId) return;

    const nextName = editingPastTripName.trim();
    if (!nextName) {
      pushToast('error', 'Trip name cannot be empty.');
      return;
    }

    const targetSummary = pastSplitSummaries.find((summary) => summary.sessionId === editingPastTripId);
    if (!targetSummary) {
      pushToast('error', 'Unable to find this trip in your history.');
      return;
    }

    setSavingPastTripName(true);
    try {
      const supabase = getSupabase();

      let updateErrorMessage: string | null = null;
      const sessionUpdate = await supabase.from('sessions').update({ name: nextName }).eq('id', editingPastTripId);
      if (sessionUpdate.error) {
        if (targetSummary.firstExpenseId) {
          const expenseUpdate = await supabase
            .from('expenses')
            .update({ title: nextName })
            .eq('id', targetSummary.firstExpenseId);
          if (expenseUpdate.error) updateErrorMessage = expenseUpdate.error.message;
        } else {
          updateErrorMessage = sessionUpdate.error.message;
        }
      }

      if (updateErrorMessage) throw new Error(updateErrorMessage);

      setPastSplitSummaries((current) =>
        current.map((summary) =>
          summary.sessionId === editingPastTripId
            ? { ...summary, tripName: nextName, firstExpenseTitle: nextName }
            : summary
        )
      );

      setEditingPastTripId(null);
      setEditingPastTripName('');
      pushToast('success', 'Trip name updated.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to update trip name.');
    } finally {
      setSavingPastTripName(false);
    }
  }, [editingPastTripId, editingPastTripName, getSupabase, pastSplitSummaries, pushToast]);

  const handleDeletePastTrip = useCallback(
    async (summary: PastSplitSummary) => {
      const tripName = summary.tripName || summary.firstExpenseTitle || `Trip ${summary.sessionId.slice(0, 6)}`;
      const confirmed = window.confirm(
        `Delete "${tripName}" permanently from BillWizard? This action cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingPastTripId(summary.sessionId);
      try {
        const supabase = getSupabase();

        const expensesQuery = await supabase.from('expenses').select('id').eq('session_id', summary.sessionId);
        if (expensesQuery.error) throw new Error(expensesQuery.error.message);

        const expenseIds = (expensesQuery.data ?? []).map((row) => String(row.id));
        if (expenseIds.length > 0) {
          const itemsQuery = await supabase.from('items').select('id').in('expense_id', expenseIds);
          if (itemsQuery.error) throw new Error(itemsQuery.error.message);

          const itemIds = (itemsQuery.data ?? []).map((row) => String(row.id));
          if (itemIds.length > 0) {
            const assignmentsDelete = await supabase
              .from('item_assignments')
              .delete()
              .in('item_id', itemIds);
            if (assignmentsDelete.error) throw new Error(assignmentsDelete.error.message);
          }

          const itemsDelete = await supabase.from('items').delete().in('expense_id', expenseIds);
          if (itemsDelete.error) throw new Error(itemsDelete.error.message);

          const expensesDelete = await supabase.from('expenses').delete().in('id', expenseIds);
          if (expensesDelete.error) throw new Error(expensesDelete.error.message);
        }

        const participantsDelete = await supabase
          .from('participants')
          .delete()
          .eq('session_id', summary.sessionId);
        if (participantsDelete.error) throw new Error(participantsDelete.error.message);

        const sessionDelete = await supabase.from('sessions').delete().eq('id', summary.sessionId);
        if (sessionDelete.error) throw new Error(sessionDelete.error.message);

        setPastSplitSummaries((current) => current.filter((entry) => entry.sessionId !== summary.sessionId));
        if (editingPastTripId === summary.sessionId) {
          setEditingPastTripId(null);
          setEditingPastTripName('');
        }
        pushToast('success', 'Trip deleted successfully.');
      } catch (error) {
        pushToast('error', error instanceof Error ? error.message : 'Unable to delete this trip.');
      } finally {
        setDeletingPastTripId(null);
      }
    },
    [editingPastTripId, getSupabase, pushToast]
  );

  const handleToggleExpense = useCallback((expenseId: string) => {
    setExpandedExpenseIds((current) => {
      const copy = new Set(current);
      if (copy.has(expenseId)) copy.delete(expenseId);
      else copy.add(expenseId);
      return copy;
    });
  }, []);

  const handleJoinRoom = useCallback(async () => {
    const name = joinName.trim();
    if (!name) {
      pushToast('error', 'Enter your name to join this room.');
      return;
    }

    const phoneNumber = normalizePhoneNumber(joinPhone);
    const upiId = joinUpi.trim();
    const normalizedName = normalizeParticipantName(name);

    setJoiningRoom(true);
    try {
      const supabase = getSupabase();
      const identityRows = await loadParticipantIdentityRows();
      const existingParticipant = identityRows.find(
        (participant) => normalizeParticipantName(participant.name) === normalizedName
      );

      if (existingParticipant) {
        const participantId = existingParticipant.id;
        const existingPhone = normalizePhoneNumber(existingParticipant.phone_number);
        const existingUpi = (existingParticipant.upi_id ?? '').trim();
        const nextPhone = phoneNumber || existingPhone;
        const nextUpi = upiId || existingUpi;

        if (nextPhone !== existingPhone || nextUpi !== existingUpi) {
          const updateQuery = await supabase
            .from('participants')
            .update({
              phone_number: nextPhone || null,
              upi_id: nextUpi || null
            })
            .eq('id', participantId);
          if (updateQuery.error) throw new Error(updateQuery.error.message);
        }

        setCurrentParticipantId(participantId);
        window.localStorage.setItem(participantStorageKey, participantId);
        window.localStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify({
            defaultName: existingParticipant.name || name,
            whatsappNumber: nextPhone || '',
            upiId: nextUpi || ''
          })
        );
        setShowJoinModal(false);
        setJoinName('');
        setJoinPhone('');
        setJoinUpi('');
        pushToast('success', 'Welcome back. Joined using your existing participant profile.');
        return;
      }

      const { data, error } = await supabase
        .from('participants')
        .insert({
          session_id: roomId,
          name,
          is_manual: false,
          phone_number: phoneNumber || null,
          upi_id: upiId || null
        })
        .select('id')
        .single();

      if (error || !data?.id) throw new Error(error?.message ?? 'Unable to join this room.');

      const participantId = String(data.id);
      setCurrentParticipantId(participantId);
      window.localStorage.setItem(participantStorageKey, participantId);
      window.localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          defaultName: name,
          whatsappNumber: phoneNumber || '',
          upiId: upiId || ''
        })
      );
      setShowJoinModal(false);
      setJoinName('');
      setJoinPhone('');
      setJoinUpi('');
      pushToast('success', 'Joined room successfully.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to join this room.');
    } finally {
      setJoiningRoom(false);
    }
  }, [
    getSupabase,
    joinName,
    joinPhone,
    joinUpi,
    loadParticipantIdentityRows,
    participantStorageKey,
    pushToast,
    roomId
  ]);

  const handleAddUser = useCallback(async () => {
    const name = newUserName.trim();
    if (!name) {
      pushToast('error', 'Enter a name to add a user.');
      return;
    }

    if (!canManageParticipants) {
      pushToast('error', 'Join this room first before adding users.');
      return;
    }

    const normalizedName = normalizeParticipantName(name);

    setAddingUser(true);
    try {
      const supabase = getSupabase();
      const identityRows = await loadParticipantIdentityRows();
      const existingParticipant = identityRows.find(
        (participant) => normalizeParticipantName(participant.name) === normalizedName
      );

      if (existingParticipant) {
        pushToast('error', `${existingParticipant.name} is already part of this trip.`);
        return;
      }

      const { error } = await supabase.from('participants').insert({
        session_id: roomId,
        name,
        is_manual: true,
        phone_number: normalizePhoneNumber(newUserPhone) || null,
        upi_id: newUserUpi.trim() || null
      });

      if (error) throw new Error(error.message);

      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserUpi('');
      pushToast('success', 'User added to this trip ledger.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to add user.');
    } finally {
      setAddingUser(false);
    }
  }, [
    canManageParticipants,
    getSupabase,
    loadParticipantIdentityRows,
    newUserName,
    newUserPhone,
    newUserUpi,
    pushToast,
    roomId
  ]);

  const handleRemoveParticipant = useCallback(
    async (participantId: string) => {
      if (!canManageParticipants || !currentParticipantId) {
        pushToast('error', 'Join this room first before removing users.');
        return;
      }

      if (participantId === currentParticipantId) {
        pushToast('error', 'Host participant cannot remove themselves.');
        return;
      }

      const participant = participantsById[participantId];
      if (!participant) {
        pushToast('error', 'Participant not found.');
        return;
      }

      const shouldDelete = window.confirm(
        `Remove "${participant.name}" from this trip? This will remove their split assignments.`
      );
      if (!shouldDelete) return;

      setRemovingParticipantId(participantId);
      try {
        const supabase = getSupabase();
        const payerExpenseQuery = await supabase
          .from('expenses')
          .select('id')
          .eq('session_id', roomId)
          .eq('payer_id', participantId)
          .limit(1);
        if (payerExpenseQuery.error) throw new Error(payerExpenseQuery.error.message);
        if ((payerExpenseQuery.data ?? []).length > 0) {
          throw new Error(
            `${participant.name} has paid expenses. Reassign or delete those expenses before removing this user.`
          );
        }

        const deleteAssignmentsQuery = await supabase
          .from('item_assignments')
          .delete()
          .eq('participant_id', participantId);
        if (deleteAssignmentsQuery.error) throw new Error(deleteAssignmentsQuery.error.message);

        const deleteParticipantQuery = await supabase
          .from('participants')
          .delete()
          .eq('id', participantId)
          .eq('session_id', roomId);
        if (deleteParticipantQuery.error) throw new Error(deleteParticipantQuery.error.message);

        setParticipants((current) => removeById(current, participantId));
        setItemAssignments((current) =>
          current.filter((assignment) => assignment.participant_id !== participantId)
        );
        setSettledAmountsByParticipant((current) => {
          const copy = { ...current };
          delete copy[participantId];
          return copy;
        });
        pushToast('success', `${participant.name} removed from this trip.`);
      } catch (error) {
        pushToast('error', error instanceof Error ? error.message : 'Unable to remove this user.');
      } finally {
        setRemovingParticipantId(null);
      }
    },
    [
      canManageParticipants,
      currentParticipantId,
      getSupabase,
      participantsById,
      pushToast,
      roomId
    ]
  );

  const createExpense = useCallback(
    async (title: string, payerId: string, type: ExpenseType, options?: { receiptUrl?: string | null }) => {
      const supabase = getSupabase();
      const insertPayload = {
        session_id: roomId,
        payer_id: payerId,
        title,
        expense_type: type
      };

      let createQuery = await supabase
        .from('expenses')
        .insert({
          ...insertPayload,
          receipt_url: options?.receiptUrl ?? null
        })
        .select('id')
        .single();

      if (createQuery.error) {
        createQuery = await supabase.from('expenses').insert(insertPayload).select('id').single();
      }

      if (createQuery.error || !createQuery.data?.id) {
        throw new Error(createQuery.error?.message ?? 'Unable to create expense.');
      }

      return String(createQuery.data.id);
    },
    [getSupabase, roomId]
  );

  const uploadReceiptToStorage = useCallback(
    async (file: File) => {
      const supabase = getSupabase();
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeBaseName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
        .slice(0, 50) || 'receipt';

      const objectPath = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeBaseName}.${extension}`;
      const uploadQuery = await supabase.storage.from('receipts').upload(objectPath, file, {
        contentType: file.type || undefined,
        cacheControl: '3600',
        upsert: false
      });

      if (uploadQuery.error) throw new Error(uploadQuery.error.message);

      const publicUrlData = supabase.storage.from('receipts').getPublicUrl(objectPath);
      const url = publicUrlData.data.publicUrl;
      if (!url) throw new Error('Unable to generate public URL for this receipt image.');

      return url;
    },
    [getSupabase, roomId]
  );

  const handleCreateScannedExpense = useCallback(async () => {
    const payerId = scanPayerId || selectedCollectorId;
    const title = scanExpenseTitle.trim() || `Receipt ${new Date().toLocaleDateString('en-IN')}`;

    if (!scanFile) {
      pushToast('error', 'Upload a receipt image first.');
      return;
    }
    if (!payerId) {
      pushToast('error', 'Select who paid this expense.');
      return;
    }

    setScanningReceipt(true);
    setScanProgressPct(8);
    setScanProgressLabel('Uploading receipt image...');

    try {
      const receiptUrl = await uploadReceiptToStorage(scanFile);
      setScanProgressPct(40);
      setScanProgressLabel('Analyzing receipt with AI...');

      const formData = new FormData();
      formData.append('file', scanFile);
      formData.append('receipt_url', receiptUrl);

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData
      });

      const payload = (await response.json()) as {
        categories?: unknown;
        items?: unknown;
        receiptUrl?: string | null;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error ?? 'Receipt scan failed.');
      setScanProgressPct(62);
      setScanProgressLabel('Saving expense and split details...');

      const scannedItems = extractScannedItems(payload);
      if (scannedItems.length === 0) {
        throw new Error('No valid items found in this receipt.');
      }

      const supabase = getSupabase();
      const expenseId = await createExpense(title, payerId, 'receipt', {
        receiptUrl: payload.receiptUrl || receiptUrl
      });

      const insertRows = scannedItems.map((item) => ({
        expense_id: expenseId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        base_price: item.totalRowPrice,
        final_price: Number((item.totalRowPrice * item.taxMultiplier).toFixed(2)),
        tax_multiplier: item.taxMultiplier,
        tax_category: item.taxCategory,
        category_name: item.category
      }));

      // Key decision: best-effort write for mixed schemas so old projects don't break.
      let itemInsert = await supabase.from('items').insert(insertRows).select('id');
      if (itemInsert.error) {
        itemInsert = await supabase
          .from('items')
          .insert(
            insertRows.map((row) => ({
              expense_id: row.expense_id,
              name: row.name,
              quantity: row.quantity,
              base_price: row.base_price,
              tax_multiplier: row.tax_multiplier,
              category_name: row.category_name
            }))
          )
          .select('id');
      }

      if (itemInsert.error) throw new Error(itemInsert.error.message);

      const insertedIds = (itemInsert.data ?? []) as Array<{ id: string }>;
      const waterItemIds = scannedItems
        .map((item, index) => (item.autoSplitAll ? insertedIds[index]?.id : null))
        .filter((id): id is string => Boolean(id));

      if (waterItemIds.length > 0 && participants.length > 0) {
        const autoAssignments = waterItemIds.flatMap((itemId) =>
          participants.map((participant) => ({
            item_id: itemId,
            participant_id: participant.id,
            assigned_shares: 1
          }))
        );

        const assignmentInsert = await supabase
          .from('item_assignments')
          .upsert(autoAssignments, { onConflict: 'item_id,participant_id', ignoreDuplicates: true });

        if (assignmentInsert.error) throw new Error(assignmentInsert.error.message);
      }

      setScanProgressPct(100);
      setScanProgressLabel('Done.');
      setExpandedExpenseIds((current) => {
        const copy = new Set(current);
        copy.add(expenseId);
        return copy;
      });

      setShowScanModal(false);
      setScanExpenseTitle('');
      setScanPayerId('');
      setScanFile(null);
      setScanProgressPct(0);
      setScanProgressLabel('');

      pushToast(
        'success',
        `${scannedItems.length} items imported.${
          waterItemIds.length > 0
            ? ` ${waterItemIds.length} water item${waterItemIds.length > 1 ? 's' : ''} auto-split to everyone.`
            : ''
        }`
      );
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to create scanned expense.');
    } finally {
      setScanningReceipt(false);
      setScanProgressPct(0);
      setScanProgressLabel('');
    }
  }, [
    createExpense,
    getSupabase,
    participants,
    pushToast,
    scanExpenseTitle,
    scanFile,
    scanPayerId,
    selectedCollectorId,
    uploadReceiptToStorage
  ]);

  const openReceiptViewer = useCallback((url: string, title: string) => {
    setActiveReceiptViewer({ url, title });
    setReceiptZoom(1);
    setReceiptPan({ x: 0, y: 0 });
    receiptPointersRef.current.clear();
  }, []);

  const closeReceiptViewer = useCallback(() => {
    setActiveReceiptViewer(null);
    setReceiptZoom(1);
    setReceiptPan({ x: 0, y: 0 });
    receiptPointersRef.current.clear();
  }, []);

  const resetReceiptViewerTransform = useCallback(() => {
    setReceiptZoom(1);
    setReceiptPan({ x: 0, y: 0 });
  }, []);

  const zoomReceipt = useCallback((direction: 'in' | 'out') => {
    setReceiptZoom((current) => {
      const next = direction === 'in' ? current + 0.25 : current - 0.25;
      const normalized = clamp(next, 1, 5);
      if (normalized <= 1) setReceiptPan({ x: 0, y: 0 });
      return normalized;
    });
  }, []);

  const handleReceiptWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setReceiptZoom((current) => {
      const next = event.deltaY < 0 ? current + 0.18 : current - 0.18;
      const normalized = clamp(next, 1, 5);
      if (normalized <= 1) setReceiptPan({ x: 0, y: 0 });
      return normalized;
    });
  }, []);

  const handleReceiptPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      receiptPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const pointers = Array.from(receiptPointersRef.current.values());
      if (pointers.length === 1) {
        receiptGestureRef.current.dragStartX = event.clientX;
        receiptGestureRef.current.dragStartY = event.clientY;
        receiptGestureRef.current.panStartX = receiptPan.x;
        receiptGestureRef.current.panStartY = receiptPan.y;
      } else if (pointers.length >= 2) {
        const [a, b] = pointers;
        receiptGestureRef.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
        receiptGestureRef.current.startScale = receiptZoom;
        receiptGestureRef.current.startCenterX = (a.x + b.x) / 2;
        receiptGestureRef.current.startCenterY = (a.y + b.y) / 2;
        receiptGestureRef.current.panStartX = receiptPan.x;
        receiptGestureRef.current.panStartY = receiptPan.y;
      }
    },
    [receiptPan.x, receiptPan.y, receiptZoom]
  );

  const handleReceiptPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!receiptPointersRef.current.has(event.pointerId)) return;

      receiptPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pointers = Array.from(receiptPointersRef.current.values());

      if (pointers.length >= 2) {
        const [a, b] = pointers;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const centerX = (a.x + b.x) / 2;
        const centerY = (a.y + b.y) / 2;
        const baseDistance = receiptGestureRef.current.startDistance || distance || 1;
        const nextScale = clamp((receiptGestureRef.current.startScale * distance) / baseDistance, 1, 5);
        setReceiptZoom(nextScale);
        setReceiptPan({
          x: receiptGestureRef.current.panStartX + (centerX - receiptGestureRef.current.startCenterX),
          y: receiptGestureRef.current.panStartY + (centerY - receiptGestureRef.current.startCenterY)
        });
        return;
      }

      if (pointers.length === 1 && receiptZoom > 1) {
        const maxPan = Math.max((receiptZoom - 1) * 320, 0);
        const deltaX = event.clientX - receiptGestureRef.current.dragStartX;
        const deltaY = event.clientY - receiptGestureRef.current.dragStartY;
        setReceiptPan({
          x: clamp(receiptGestureRef.current.panStartX + deltaX, -maxPan, maxPan),
          y: clamp(receiptGestureRef.current.panStartY + deltaY, -maxPan, maxPan)
        });
      }
    },
    [receiptZoom]
  );

  const handleReceiptPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      receiptPointersRef.current.delete(event.pointerId);
      const pointers = Array.from(receiptPointersRef.current.values());
      if (pointers.length === 1) {
        receiptGestureRef.current.dragStartX = pointers[0].x;
        receiptGestureRef.current.dragStartY = pointers[0].y;
        receiptGestureRef.current.panStartX = receiptPan.x;
        receiptGestureRef.current.panStartY = receiptPan.y;
      }
      if (pointers.length === 0 && receiptZoom <= 1.01) {
        setReceiptPan({ x: 0, y: 0 });
      }
    },
    [receiptPan.x, receiptPan.y, receiptZoom]
  );

  const toggleManualSplitParticipant = useCallback((participantId: string) => {
    setManualSplitParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );

    setManualSplitRatios((current) =>
      current[participantId] ? current : { ...current, [participantId]: '1' }
    );
  }, []);

  const updateManualPayerSplit = useCallback(
    (index: number, patch: Partial<ManualPayerSplit>) => {
      setManualPayerSplits((current) =>
        current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const addManualPayerSplit = useCallback(() => {
    setManualPayerSplits((current) => [...current, { participantId: '', amount: '' }]);
  }, []);

  const removeManualPayerSplit = useCallback((index: number) => {
    setManualPayerSplits((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }, []);

  useEffect(() => {
    if (!showManualExpenseModal) return;

    const validParticipantIds = new Set(participants.map((participant) => participant.id));
    const allParticipantIds = participants.map((participant) => participant.id);

    setManualSplitParticipantIds((current) => {
      const filtered = current.filter((id) => validParticipantIds.has(id));
      if (filtered.length > 0) {
        if (filtered.length === current.length && filtered.every((id, index) => id === current[index])) {
          return current;
        }
        return filtered;
      }

      if (
        allParticipantIds.length === current.length &&
        allParticipantIds.every((id, index) => id === current[index])
      ) {
        return current;
      }

      return allParticipantIds;
    });

    setManualSplitRatios((current) => {
      let changed = false;
      const next: Record<string, string> = {};

      for (const participant of participants) {
        const existing = current[participant.id];
        next[participant.id] = existing && existing.trim() ? existing : '1';
        if (next[participant.id] !== existing) changed = true;
      }

      if (!changed && Object.keys(current).length === Object.keys(next).length) return current;
      return next;
    });
  }, [participants, showManualExpenseModal]);

  useEffect(() => {
    if (!showManualExpenseModal) return;

    const payerIds = manualUseMultiplePayers
      ? manualPayerSplits
          .map((row) => row.participantId)
          .filter((participantId) => Boolean(participantId && participantsById[participantId]))
      : manualExpensePayerId && participantsById[manualExpensePayerId]
        ? [manualExpensePayerId]
        : [];

    if (payerIds.length === 0) return;

    setManualSplitParticipantIds((current) => {
      const next = [...current];
      for (const payerId of payerIds) {
        if (!next.includes(payerId)) next.push(payerId);
      }
      return next;
    });

    setManualSplitRatios((current) => {
      const next = { ...current };
      let changed = false;
      for (const payerId of payerIds) {
        if (!next[payerId]) {
          next[payerId] = '1';
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [
    manualExpensePayerId,
    manualPayerSplits,
    manualUseMultiplePayers,
    participantsById,
    showManualExpenseModal
  ]);

  const handleCreateManualExpense = useCallback(async () => {
    const title = manualExpenseTitle.trim();
    const remark = manualExpenseRemark.trim();
    const selectedSplitParticipantIds = Array.from(
      new Set(manualSplitParticipantIds.filter((participantId) => Boolean(participantsById[participantId])))
    );

    if (!title) {
      pushToast('error', 'Enter an expense title.');
      return;
    }

    const payerContributions: Array<{ payerId: string; amount: number }> = [];

    if (manualUseMultiplePayers) {
      if (manualPayerSplits.length === 0) {
        pushToast('error', 'Add at least one payer row.');
        return;
      }

      const aggregated: Record<string, number> = {};
      for (const row of manualPayerSplits) {
        const payerId = row.participantId;
        if (!payerId || !participantsById[payerId]) {
          pushToast('error', 'Select a valid payer in every row.');
          return;
        }

        const amount = parseNonNegativeAmount(row.amount, NaN);
        if (!Number.isFinite(amount) || amount <= 0) {
          const payerName = participantsById[payerId]?.name ?? 'selected payer';
          pushToast('error', `Enter a valid paid amount for ${payerName}.`);
          return;
        }

        aggregated[payerId] = Number(((aggregated[payerId] ?? 0) + amount).toFixed(2));
      }

      for (const [payerId, amount] of Object.entries(aggregated)) {
        payerContributions.push({ payerId, amount: Number(amount.toFixed(2)) });
      }
    } else {
      const payerId = manualExpensePayerId || selectedCollectorId;
      const amount = parseNonNegativeAmount(manualExpenseAmount, NaN);

      if (!payerId) {
        pushToast('error', 'Select who paid this expense.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        pushToast('error', 'Enter a valid total amount.');
        return;
      }

      payerContributions.push({ payerId, amount: Number(amount.toFixed(2)) });
    }

    if (selectedSplitParticipantIds.length === 0) {
      pushToast('error', 'Select at least one participant to split this expense with.');
      return;
    }

    const splitSharesByParticipant: Record<string, number> = {};
    if (manualSplitMode === 'equal') {
      for (const participantId of selectedSplitParticipantIds) {
        splitSharesByParticipant[participantId] = 1;
      }
    } else {
      for (const participantId of selectedSplitParticipantIds) {
        const ratio = parsePositiveInteger(manualSplitRatios[participantId], NaN);
        if (!Number.isFinite(ratio) || ratio <= 0) {
          const participantName = participantsById[participantId]?.name ?? 'selected participant';
          pushToast('error', `Enter a valid ratio for ${participantName}.`);
          return;
        }
        splitSharesByParticipant[participantId] = ratio;
      }
    }

    setCreatingManualExpense(true);
    try {
      const supabase = getSupabase();
      const createdExpenseIds: string[] = [];

      for (const contribution of payerContributions) {
        const expenseId = await createExpense(title, contribution.payerId, 'manual');
        createdExpenseIds.push(expenseId);

        const payerName = participantsById[contribution.payerId]?.name ?? 'Payer';
        const paidBySuffix = payerContributions.length > 1 ? ` (Paid by ${payerName})` : '';
        const itemName = `${remark ? `${title} (${remark})` : title}${paidBySuffix}`;
        let insertedItemId = '';

        const insert = await supabase
          .from('items')
          .insert({
            expense_id: expenseId,
            name: itemName,
            quantity: 1,
            unit_price: contribution.amount,
            base_price: contribution.amount,
            final_price: contribution.amount,
            tax_multiplier: 1,
            tax_category: 'food',
            category_name: 'Veg Food'
          })
          .select('id')
          .single();

        if (insert.error) {
          const fallbackInsert = await supabase
            .from('items')
            .insert({
              expense_id: expenseId,
              name: itemName,
              quantity: 1,
              base_price: contribution.amount,
              tax_multiplier: 1,
              category_name: 'Veg Food'
            })
            .select('id')
            .single();

          if (fallbackInsert.error) throw new Error(fallbackInsert.error.message);
          insertedItemId = String(fallbackInsert.data?.id ?? '');
        } else {
          insertedItemId = String(insert.data?.id ?? '');
        }

        if (!insertedItemId) {
          throw new Error('Unable to create manual expense item.');
        }

        const splitAssignments = Object.entries(splitSharesByParticipant).map(
          ([participantId, assignedShares]) => ({
            item_id: insertedItemId,
            participant_id: participantId,
            assigned_shares: assignedShares
          })
        );

        const assignmentInsert = await supabase
          .from('item_assignments')
          .upsert(splitAssignments, { onConflict: 'item_id,participant_id' });
        if (assignmentInsert.error) throw new Error(assignmentInsert.error.message);
      }

      setExpandedExpenseIds((current) => {
        const copy = new Set(current);
        for (const expenseId of createdExpenseIds) copy.add(expenseId);
        return copy;
      });

      setShowManualExpenseModal(false);
      setManualExpenseTitle('');
      setManualExpensePayerId('');
      setManualExpenseAmount('');
      setManualExpenseRemark('');
      setManualUseMultiplePayers(false);
      setManualPayerSplits([]);
      setManualSplitMode('equal');
      setManualSplitParticipantIds([]);
      setManualSplitRatios({});

      pushToast(
        'success',
        `Expense added with ${payerContributions.length} payer${
          payerContributions.length > 1 ? 's' : ''
        } and split applied.`
      );
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to add manual expense.');
    } finally {
      setCreatingManualExpense(false);
    }
  }, [
    createExpense,
    getSupabase,
    manualExpenseAmount,
    manualExpensePayerId,
    manualExpenseRemark,
    manualExpenseTitle,
    manualPayerSplits,
    manualSplitMode,
    manualSplitParticipantIds,
    manualSplitRatios,
    manualUseMultiplePayers,
    participantsById,
    pushToast,
    selectedCollectorId
  ]);

  const getCustomItemForm = useCallback(
    (formKey: string) => customItemForms[formKey] ?? DEFAULT_CUSTOM_ITEM_FORM,
    [customItemForms]
  );

  const setCustomItemFormField = useCallback(
    (formKey: string, patch: Partial<CustomItemForm>) => {
      setCustomItemForms((current) => ({
        ...current,
        [formKey]: {
          ...(current[formKey] ?? DEFAULT_CUSTOM_ITEM_FORM),
          ...patch
        }
      }));
    },
    []
  );

  const handleAddCustomItem = useCallback(
    async (expenseId: string, categoryName: ReceiptCategory) => {
      const formKey = `${expenseId}:${categoryName}`;
      const form = getCustomItemForm(formKey);

      const name = form.name.trim();
      const quantity = parsePositiveInteger(form.quantity, NaN);
      const unitPrice = parseNonNegativeAmount(form.unitPrice, NaN);
      const taxMultiplier = parseTaxMultiplier(form.taxMultiplier, NaN);

      if (!name || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !Number.isFinite(taxMultiplier)) {
        pushToast('error', 'Fill Name, Qty, Price, and Tax values for custom item.');
        return;
      }

      setAddingCustomItemKey(formKey);
      try {
        const totalRowPrice = Number((quantity * unitPrice).toFixed(2));
        const taxCategory = toTaxCategory('', categoryName, name);

        const supabase = getSupabase();
        const insert = await supabase.from('items').insert({
          expense_id: expenseId,
          name,
          quantity,
          unit_price: unitPrice,
          base_price: totalRowPrice,
          final_price: Number((totalRowPrice * taxMultiplier).toFixed(2)),
          tax_multiplier: taxMultiplier,
          tax_category: taxCategory,
          category_name: categoryName
        });

        if (insert.error) {
          const fallbackInsert = await supabase.from('items').insert({
            expense_id: expenseId,
            name,
            quantity,
            base_price: totalRowPrice,
            tax_multiplier: taxMultiplier,
            category_name: categoryName
          });
          if (fallbackInsert.error) throw new Error(fallbackInsert.error.message);
        }

        setCustomItemForms((current) => ({
          ...current,
          [formKey]: { ...DEFAULT_CUSTOM_ITEM_FORM }
        }));

        pushToast('success', 'Custom item added.');
      } catch (error) {
        pushToast('error', error instanceof Error ? error.message : 'Unable to add custom item.');
      } finally {
        setAddingCustomItemKey(null);
      }
    },
    [getCustomItemForm, getSupabase, pushToast]
  );

  const handleBulkSplitCategory = useCallback(
    async (expenseId: string, categoryName: ReceiptCategory, participantIds: string[]) => {
      const targetItems = (itemsByExpenseId[expenseId] ?? []).filter(
        (item) => item.categoryName === categoryName
      );

      if (targetItems.length === 0) {
        pushToast('error', 'No items found in this category for bulk split.');
        return;
      }

      const validParticipantIds = Array.from(new Set(participantIds)).filter(
        (participantId) => Boolean(participantsById[participantId])
      );
      const targetItemIds = targetItems.map((item) => item.id);

      const previousAssignments = assignmentsRef.current;
      const filteredAssignments = previousAssignments.filter(
        (assignment) => !targetItemIds.includes(assignment.item_id)
      );
      const replacementAssignments: ItemAssignmentRecord[] = targetItemIds.flatMap((itemId) =>
        validParticipantIds.map((participantId) => ({
          item_id: itemId,
          participant_id: participantId,
          assigned_shares: 1
        }))
      );

      setItemAssignments([...filteredAssignments, ...replacementAssignments]);

      const supabase = getSupabase();
      const deleteResult = await supabase.from('item_assignments').delete().in('item_id', targetItemIds);
      if (deleteResult.error) {
        setItemAssignments(previousAssignments);
        pushToast('error', deleteResult.error.message);
        throw new Error(deleteResult.error.message);
      }

      if (replacementAssignments.length > 0) {
        const insertResult = await supabase.from('item_assignments').insert(replacementAssignments);
        if (insertResult.error) {
          setItemAssignments(previousAssignments);
          pushToast('error', insertResult.error.message);
          throw new Error(insertResult.error.message);
        }
      }

      pushToast(
        'success',
        `Split applied: ${targetItems.length} item${targetItems.length > 1 ? 's' : ''} updated.`
      );
    },
    [getSupabase, itemsByExpenseId, participantsById, pushToast]
  );

  const handleOpenPanel = useCallback((itemId: string, participantId: string) => {
    setOpenQtyPanelByItem((current) => ({
      ...current,
      [itemId]: current[itemId] === participantId ? null : participantId
    }));
  }, []);

  const persistShare = useCallback(
    async (itemId: string, participantId: string, nextShares: number) => {
      const supabase = getSupabase();
      const previousAssignments = assignmentsRef.current;

      setItemAssignments((current) => {
        if (nextShares <= 0) {
          return current.filter(
            (entry) => !(entry.item_id === itemId && entry.participant_id === participantId)
          );
        }

        return upsertAssignment(current, {
          item_id: itemId,
          participant_id: participantId,
          assigned_shares: nextShares
        });
      });

      let errorMessage: string | null = null;
      if (nextShares <= 0) {
        const { error } = await supabase
          .from('item_assignments')
          .delete()
          .eq('item_id', itemId)
          .eq('participant_id', participantId);
        if (error) errorMessage = error.message;
      } else {
        const { error } = await supabase.from('item_assignments').upsert(
          {
            item_id: itemId,
            participant_id: participantId,
            assigned_shares: nextShares
          },
          { onConflict: 'item_id,participant_id' }
        );
        if (error) errorMessage = error.message;
      }

      if (errorMessage) {
        setItemAssignments(previousAssignments);
        pushToast('error', errorMessage);
      }
    },
    [getSupabase, pushToast]
  );

  const handleIncreaseShare = useCallback(
    async (itemId: string, participantId: string) => {
      const currentShares = parseNonNegativeInteger(qtyMapByItem[itemId]?.[participantId], 0);
      await persistShare(itemId, participantId, currentShares + 1);
    },
    [persistShare, qtyMapByItem]
  );

  const handleDecreaseShare = useCallback(
    async (itemId: string, participantId: string) => {
      const currentShares = parseNonNegativeInteger(qtyMapByItem[itemId]?.[participantId], 0);
      await persistShare(itemId, participantId, Math.max(currentShares - 1, 0));
    },
    [persistShare, qtyMapByItem]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      const supabase = getSupabase();
      const previousItems = itemsRef.current;
      const previousAssignments = assignmentsRef.current;

      setDeletingItemId(itemId);
      setItems((current) => removeById(current, itemId));
      setItemAssignments((current) => current.filter((assignment) => assignment.item_id !== itemId));

      const assignmentDelete = await supabase.from('item_assignments').delete().eq('item_id', itemId);
      if (assignmentDelete.error) {
        setItems(previousItems);
        setItemAssignments(previousAssignments);
        setDeletingItemId(null);
        pushToast('error', assignmentDelete.error.message);
        return;
      }

      const itemDelete = await supabase.from('items').delete().eq('id', itemId);
      setDeletingItemId(null);
      if (itemDelete.error) {
        setItems(previousItems);
        setItemAssignments(previousAssignments);
        pushToast('error', itemDelete.error.message);
        return;
      }

      pushToast('success', 'Item deleted.');
    },
    [getSupabase, pushToast]
  );

  const handleStartEditing = useCallback(
    (itemId: string) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return;

      setEditingItemId(itemId);
      setEditDraft({
        name: item.name,
        basePrice: item.basePrice.toFixed(2),
        taxCategory: item.taxCategory
      });
    },
    [items]
  );

  const handleCancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditDraft(null);
  }, []);

  const handleSaveEditing = useCallback(async () => {
    if (!editingItemId || !editDraft) return;

    const targetItem = itemsRef.current.find((item) => item.id === editingItemId);
    if (!targetItem) return;

    const nextName = editDraft.name.trim() || targetItem.name;
    const nextBasePrice = parseNonNegativeAmount(editDraft.basePrice, NaN);

    if (!Number.isFinite(nextBasePrice)) {
      pushToast('error', 'Enter a valid base amount.');
      return;
    }

    const nextTaxCategory = editDraft.taxCategory;
    const nextCategoryName = mapTaxCategoryToCategoryName(nextTaxCategory, targetItem.categoryName);
    const nextFinalPrice = Number((nextBasePrice * targetItem.taxMultiplier).toFixed(2));
    const nextUnitPrice = Number((nextBasePrice / Math.max(targetItem.quantity, 1)).toFixed(2));

    const optimisticItem: ItemRecord = {
      ...targetItem,
      name: nextName,
      basePrice: nextBasePrice,
      totalRowPrice: nextBasePrice,
      unitPrice: nextUnitPrice,
      finalPrice: nextFinalPrice,
      taxCategory: nextTaxCategory,
      categoryName: nextCategoryName
    };

    setSavingItemId(editingItemId);
    setItems((current) => upsertById(current, optimisticItem));
    setEditingItemId(null);
    setEditDraft(null);

    const supabase = getSupabase();

    let update = await supabase
      .from('items')
      .update({
        name: nextName,
        unit_price: nextUnitPrice,
        base_price: nextBasePrice,
        final_price: nextFinalPrice,
        tax_category: nextTaxCategory,
        category_name: nextCategoryName
      })
      .eq('id', editingItemId);

    if (update.error) {
      update = await supabase
        .from('items')
        .update({
          name: nextName,
          base_price: nextBasePrice,
          category_name: nextCategoryName
        })
        .eq('id', editingItemId);
    }

    setSavingItemId(null);

    if (update.error) {
      setItems((current) => upsertById(current, targetItem));
      pushToast('error', update.error.message);
      return;
    }

    pushToast('success', 'Item updated.');
  }, [editDraft, editingItemId, getSupabase, pushToast]);

  const handlePayViaUpi = useCallback(
    (entry: SettlementEntry) => {
      if (entry.owesAmount <= 0) return;

      const collector = selectedCollectorId ? participantsById[selectedCollectorId] : null;
      const collectorUpiId = collector?.upi_id?.trim() ?? '';
      if (!collector || !collectorUpiId) {
        pushToast('error', 'Add UPI ID for the selected collector first.');
        return;
      }

      const amount = entry.owesAmount.toFixed(2);
      const upiUrl = `upi://pay?pa=${encodeURIComponent(collectorUpiId)}&pn=${encodeURIComponent(
        collector.name
      )}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(`BillWizard ${roomId}`)}`;

      setUpiPaymentSheet({
        collectorName: collector.name,
        collectorUpiId,
        amount,
        upiUrl
      });
    },
    [participantsById, pushToast, roomId, selectedCollectorId]
  );

  const handleCopyUpiLink = useCallback(async () => {
    if (!upiPaymentSheet) return;

    try {
      await navigator.clipboard.writeText(upiPaymentSheet.upiUrl);
      pushToast('success', 'UPI payment link copied.');
    } catch {
      pushToast('error', 'Unable to copy the UPI link on this device.');
    }
  }, [pushToast, upiPaymentSheet]);

  const handleOpenUpiPaymentApp = useCallback(() => {
    if (!upiPaymentSheet) return;
    window.location.href = upiPaymentSheet.upiUrl;
  }, [upiPaymentSheet]);

  const handleCloseUpiSheet = useCallback(() => {
    setUpiPaymentSheet(null);
  }, []);

  const upiQrCodeUrl = useMemo(
    () =>
      upiPaymentSheet
        ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiPaymentSheet.upiUrl)}`
        : '',
    [upiPaymentSheet]
  );

  const handleSendReminder = useCallback(
    (entry: SettlementEntry) => {
      const participant = participantsById[entry.participantId];
      if (!participant) return;

      if (/localhost|127\.0\.0\.1/i.test(publicShareBaseUrl)) {
        pushToast(
          'error',
          'Public share link is using localhost. Set NEXT_PUBLIC_APP_URL to your deployed domain.'
        );
      }

      const amount = entry.owesAmount.toFixed(2);
      const collectorQuery = selectedCollectorId
        ? `?collector=${encodeURIComponent(selectedCollectorId)}`
        : '';
      const summaryUrl = `${publicShareBaseUrl}/room/${encodeURIComponent(
        roomId
      )}/share/${encodeURIComponent(participant.id)}${collectorQuery}`;

      const message =
        entry.owesAmount > 0
          ? `Hey ${participant.name}, your BillWizard trip split is ready.\nAmount due: ₹${amount}\nView full calculation and pay here:\n${summaryUrl}`
          : `Hey ${participant.name}, your BillWizard trip split is currently settled.\nView full calculation here:\n${summaryUrl}`;

      const phone = normalizePhoneNumber(participant.phone_number);
      const waUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
    },
    [participantsById, publicShareBaseUrl, pushToast, roomId, selectedCollectorId]
  );

  const handleSettleAndNotify = useCallback(
    (entry: SettlementEntry) => {
      if (entry.owesAmount <= 0) return;

      const participant = participantsById[entry.participantId];
      if (!participant) return;

      const collector = selectedCollectorId ? participantsById[selectedCollectorId] : null;

      setSettledAmountsByParticipant((current) => ({
        ...current,
        [entry.participantId]: Number(((current[entry.participantId] ?? 0) + entry.owesAmount).toFixed(2))
      }));

      const message = collector
        ? `Hey ${collector.name}, I have paid ₹${entry.owesAmount.toFixed(2)} for our trip split. Please mark me settled. - ${participant.name}`
        : `I have paid ₹${entry.owesAmount.toFixed(2)} for our trip split. Please mark me settled. - ${participant.name}`;

      const collectorPhone = normalizePhoneNumber(collector?.phone_number);
      const waUrl = collectorPhone
        ? `https://wa.me/${collectorPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
      pushToast('success', `Marked ${participant.name} as settled and sent WhatsApp update.`);
    },
    [participantsById, pushToast, selectedCollectorId]
  );

  const handleSaveMyProfile = useCallback(async () => {
    if (!currentParticipantId) {
      pushToast('error', 'Join this room first to save your profile.');
      return;
    }

    const name = profileName.trim();
    if (!name) {
      pushToast('error', 'Name is required.');
      return;
    }

    const conflictingParticipant = participants.find(
      (participant) =>
        participant.id !== currentParticipantId &&
        normalizeParticipantName(participant.name) === normalizeParticipantName(name)
    );
    if (conflictingParticipant) {
      pushToast('error', `${conflictingParticipant.name} is already using this name in the room.`);
      return;
    }

    const normalizedPhone = normalizePhoneNumber(profilePhone);
    const upiId = profileUpi.trim();

    setSavingProfile(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('participants')
        .update({
          name,
          phone_number: normalizedPhone || null,
          upi_id: upiId || null
        })
        .eq('id', currentParticipantId);

      if (error) throw new Error(error.message);

      setParticipants((current) =>
        current.map((participant) =>
          participant.id === currentParticipantId
            ? {
                ...participant,
                name,
                phone_number: normalizedPhone || null,
                upi_id: upiId || null
              }
            : participant
        )
      );

      if (normalizedPhone) {
        void loadPastSplitsByPhone(normalizedPhone);
      } else {
        setPastSplitSummaries([]);
      }

      window.localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          defaultName: name,
          whatsappNumber: normalizedPhone || '',
          upiId: upiId || ''
        })
      );

      pushToast('success', 'Profile details updated.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }, [
    currentParticipantId,
    getSupabase,
    loadPastSplitsByPhone,
    participants,
    profileName,
    profilePhone,
    profileUpi,
    pushToast
  ]);

  const handleExportToExcel = useCallback(async () => {
    setExportingWorkbook(true);
    try {
      if (participants.length === 0) {
        throw new Error('Add participants before exporting the report.');
      }

      const fallbackCollectorId =
        participantLedger.find((row) => row.receivesAmount > 0.0001)?.participantId ?? participants[0]?.id ?? null;
      const payerParticipantId =
        selectedCollectorId && participantsById[selectedCollectorId] ? selectedCollectorId : fallbackCollectorId;

      if (!payerParticipantId) {
        throw new Error('Unable to identify the payer for settlement export.');
      }

      const roomName = (expenses[0]?.title ?? '').trim() || `Trip Room ${roomId.slice(0, 6)}`;
      const summaryByParticipantId = new Map(
        participantLedger.map((entry) => [entry.participantId, entry] as const)
      );
      const settlementByParticipantId = new Map(
        settlementEntries.map((entry) => [entry.participantId, entry] as const)
      );

      const exportItems = items.map((item) => ({
        id: item.id,
        expenseId: item.expense_id,
        name: item.name,
        category: item.categoryName,
        taxCategory: item.taxCategory,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        basePrice: Number(item.basePrice.toFixed(2)),
        finalPrice: Number(item.finalPrice.toFixed(2)),
        multiplier: Number(item.taxMultiplier.toFixed(3)),
        qtyMap: qtyMapByItem[item.id] ?? {},
        createdAt: null
      }));

      const exportPeople = participants.map((participant) => {
        const summary = summaryByParticipantId.get(participant.id);
        const settlement = settlementByParticipantId.get(participant.id);
        const itemsShared = items.reduce((count, item) => {
          const shares = qtyMapByItem[item.id]?.[participant.id] ?? 0;
          return shares > 0 ? count + 1 : count;
        }, 0);

        return {
          id: participant.id,
          name: participant.name,
          initials: getInitials(participant.name),
          upiId: participant.upi_id ?? null,
          itemsShared,
          totalShare: Number((summary?.totalConsumed ?? 0).toFixed(2)),
          paidUpfront: Number((summary?.totalPaidUpfront ?? 0).toFixed(2)),
          netBalance: Number(((summary?.totalConsumed ?? 0) - (summary?.totalPaidUpfront ?? 0)).toFixed(2)),
          isSettled: Boolean(settlement?.isMarkedSettled)
        };
      });

      const payer = exportPeople.find((person) => person.id === payerParticipantId);
      if (!payer) {
        throw new Error('Unable to resolve payer details for export.');
      }

      const baseTotal = exportItems.reduce((sum, item) => sum + item.basePrice, 0);
      const taxConfig = {
        discountPct: 10,
        gstPct: 5,
        multiplier: baseTotal > 0 ? totalExpenseSoFar / baseTotal : 1
      };

      const roomUrl = `${publicShareBaseUrl}/room/${encodeURIComponent(roomId)}`;
      await exportToExcel(
        {
          id: roomId,
          name: roomName,
          url: roomUrl,
          totalBill: Number(totalExpenseSoFar.toFixed(2))
        },
        exportItems,
        exportPeople,
        payer,
        taxConfig
      );

      pushToast('success', 'Excel exported: styled finance report generated.');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Unable to export Excel.');
    } finally {
      setExportingWorkbook(false);
    }
  }, [
    expenses,
    items,
    participantLedger,
    participants,
    participantsById,
    publicShareBaseUrl,
    pushToast,
    qtyMapByItem,
    roomId,
    selectedCollectorId,
    settlementEntries,
    totalExpenseSoFar
  ]);

  if (loadingRoom) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="inline-flex items-center gap-[8px] rounded-card border border-border bg-card px-[14px] py-[10px] text-[13px] text-[#1C1917]">
          <Loader2 className="h-[14px] w-[14px] animate-spin" />
          Loading BillWizard dashboard...
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            currentRoomName={expenses[0]?.title ?? `Trip Room ${roomId.slice(0, 6)}`}
            roomId={roomId}
            participants={sidebarParticipants}
            currentUser={currentUser}
          />
        }
        mobileTabs={<MobileTabBar activeTab={activeTab} onTabChange={setActiveTab} />}
        showInstallButton={activeTab === 'settings'}
      >
        <div className="min-h-dvh">
          <header className="sticky top-0 z-10 border-b border-border bg-canvas px-[22px] py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-[10px]">
              <div>
                <h1 className="text-page-title text-[#1C1917]">Smart Bill Splitter</h1>
                <p className="mt-[3px] font-mono text-[10px] text-muted">{roomId}</p>
              </div>

              <div className="flex flex-wrap items-center gap-[8px]">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  className="inline-flex h-[34px] items-center gap-[6px] rounded-input border border-[#E0DDD6] bg-white px-[11px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                >
                  <UserPlus className="h-[12px] w-[12px]" />
                  Add User
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const allParticipantIds = participants.map((participant) => participant.id);
                    const defaultRatios = Object.fromEntries(
                      allParticipantIds.map((participantId) => [participantId, '1'])
                    );

                    setShowManualExpenseModal(true);
                    setManualExpenseTitle('');
                    setManualExpenseAmount('');
                    setManualExpenseRemark('');
                    setManualExpensePayerId(selectedCollectorId ?? '');
                    setManualUseMultiplePayers(false);
                    setManualPayerSplits([{ participantId: selectedCollectorId ?? '', amount: '' }]);
                    setManualSplitMode('equal');
                    setManualSplitParticipantIds(allParticipantIds);
                    setManualSplitRatios(defaultRatios);
                  }}
                  className="inline-flex h-[34px] items-center gap-[6px] rounded-input border border-[#E0DDD6] bg-white px-[11px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                >
                  <Plus className="h-[12px] w-[12px]" />
                  Add Expense
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleExportToExcel();
                  }}
                  disabled={exportingWorkbook}
                  className="inline-flex h-[34px] items-center gap-[6px] rounded-input border border-[#E0DDD6] bg-white px-[11px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportingWorkbook ? (
                    <Loader2 className="h-[12px] w-[12px] animate-spin" />
                  ) : (
                    <Download className="h-[12px] w-[12px]" />
                  )}
                  Export Excel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowScanModal(true);
                    setScanPayerId(selectedCollectorId ?? '');
                    setScanProgressPct(0);
                    setScanProgressLabel('');
                  }}
                  className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-amber px-[11px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-[#D97706]"
                >
                  <Camera className="h-[12px] w-[12px]" />
                  Scan Receipt
                </button>
              </div>
            </div>
          </header>

          <div className="px-[22px] py-[18px]">
            {roomError && (
              <div className="mb-[12px] rounded-input border border-[#FECACA] bg-settle-redLight px-[10px] py-[8px] text-[12px] text-settle-red">
                {roomError}
              </div>
            )}

            {activeTab === 'home' && (
              <div>
                <section className="mb-[16px] grid grid-cols-2 gap-[10px] lg:grid-cols-5">
                  <article className="rounded-card border border-border bg-card px-[12px] py-[10px]">
                    <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Total Expense So Far</p>
                    <p className="mt-[4px] text-[16px] font-medium text-[#1C1917]">{inr.format(totalExpenseSoFar)}</p>
                  </article>

                  <article className="rounded-card border border-border bg-card px-[12px] py-[10px]">
                    <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Food</p>
                    <p className="mt-[4px] text-[16px] font-medium text-[#1C1917]">{inr.format(expenseBreakdown.food)}</p>
                  </article>

                  <article className="rounded-card border border-border bg-card px-[12px] py-[10px]">
                    <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Drinks</p>
                    <p className="mt-[4px] text-[16px] font-medium text-[#1C1917]">{inr.format(expenseBreakdown.drinks)}</p>
                  </article>

                  <article className="rounded-card border border-border bg-card px-[12px] py-[10px]">
                    <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Travel</p>
                    <p className="mt-[4px] text-[16px] font-medium text-[#1C1917]">{inr.format(expenseBreakdown.travel)}</p>
                  </article>

                  <article className="rounded-card border border-border bg-card px-[12px] py-[10px]">
                    <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Stay</p>
                    <p className="mt-[4px] text-[16px] font-medium text-[#1C1917]">{inr.format(expenseBreakdown.stay)}</p>
                  </article>
                </section>

                <section>
                  <div className="mb-[10px] inline-flex items-center gap-[6px] text-[10px] uppercase tracking-[0.9px] text-muted">
                    <Sparkles className="h-[12px] w-[12px]" />
                    Trip Expenses
                  </div>

                  {expenses.length === 0 ? (
                    <div className="rounded-card border border-dashed border-border bg-card p-[14px] text-[12px] text-muted">
                      No expenses yet. Add one manually or scan a receipt.
                    </div>
                  ) : (
                    <div className="space-y-[10px]">
                      {expenses.map((expense) => {
                        const isOpen = expandedExpenseIds.has(expense.id);
                        const payer = participantsById[expense.payer_id];
                        const expenseTotal = expenseTotalsById[expense.id] ?? 0;
                        const categories = groupedCategoriesByExpense[expense.id] ?? [];
                        const isManualExpense = expense.expense_type === 'manual';

                        return (
                          <article
                            key={expense.id}
                            className="overflow-hidden rounded-card border border-border bg-card"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleExpense(expense.id)}
                              className="flex w-full items-center justify-between gap-[10px] px-[14px] py-[12px] text-left transition-[background-color] duration-150 ease-linear hover:bg-dim"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[14px] font-medium text-[#1C1917]">{expense.title}</p>
                                <p className="mt-[2px] text-[11px] text-muted">
                                  Paid by {payer?.name ?? 'Unknown'} · {expense.expense_type}
                                </p>
                              </div>

                              <div className="flex items-center gap-[8px]">
                                <p className="text-[13px] font-medium text-[#1C1917]">{inr.format(expenseTotal)}</p>
                                {isOpen ? (
                                  <ChevronUp className="h-[14px] w-[14px] text-muted" />
                                ) : (
                                  <ChevronDown className="h-[14px] w-[14px] text-muted" />
                                )}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-divider bg-canvas px-[12px] py-[12px]">
                                {expense.receipt_url ? (
                                  <div className="mb-[10px] flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => openReceiptViewer(expense.receipt_url ?? '', expense.title)}
                                      className="inline-flex h-[30px] items-center gap-[6px] rounded-input border border-border bg-white px-[10px] text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                                    >
                                      <ExternalLink className="h-[11px] w-[11px]" />
                                      View Original Receipt
                                    </button>
                                  </div>
                                ) : null}

                                {categories.map((category) => {
                                  if (isManualExpense && category.items.length === 0) return null;

                                  const customFormKey = `${expense.id}:${category.key}`;
                                  const customForm = getCustomItemForm(customFormKey);

                                  return (
                                    <CategoryCard
                                      key={`${expense.id}:${category.key}`}
                                      title={isManualExpense ? 'Trip Expense Split' : category.title}
                                      subtitle={
                                        isManualExpense
                                          ? 'Split shares are editable per person below.'
                                          : category.subtitle
                                      }
                                      itemCount={category.items.length}
                                      participants={participantView}
                                      onConfirmBulkSplit={
                                        isManualExpense
                                          ? undefined
                                          : (participantIds) =>
                                              handleBulkSplitCategory(expense.id, category.key, participantIds)
                                      }
                                    >
                                      {category.items.length === 0 ? (
                                        <div className="px-[18px] py-[13px] text-[12px] text-muted">
                                          No items in this category yet.
                                        </div>
                                      ) : (
                                        category.items.map((item) => (
                                          <ItemRow
                                            key={item.id}
                                            item={item}
                                            participants={participantView}
                                            activePanelParticipantId={openQtyPanelByItem[item.id] ?? null}
                                            isEditing={editingItemId === item.id}
                                            isSaving={savingItemId === item.id}
                                            isDeleting={deletingItemId === item.id}
                                            editDraft={editingItemId === item.id ? editDraft : null}
                                            onOpenPanel={handleOpenPanel}
                                            onIncrease={handleIncreaseShare}
                                            onDecrease={handleDecreaseShare}
                                            onDelete={handleDeleteItem}
                                            onStartEditing={handleStartEditing}
                                            onCancelEditing={handleCancelEditing}
                                            onSaveEditing={() => {
                                              void handleSaveEditing();
                                            }}
                                            onEditDraftChange={(patch) => {
                                              setEditDraft((current) => (current ? { ...current, ...patch } : current));
                                            }}
                                          />
                                        ))
                                      )}

                                      {!isManualExpense && (
                                        <div className="border-t border-divider bg-card px-[18px] py-[12px]">
                                          <p className="text-[11px] font-medium text-muted">+ Add Custom Item</p>
                                          <div className="mt-[8px] grid gap-[8px] lg:grid-cols-[1fr_90px_110px_110px_auto]">
                                            <input
                                              value={customForm.name}
                                              onChange={(event) => {
                                                setCustomItemFormField(customFormKey, { name: event.target.value });
                                              }}
                                              placeholder="Name"
                                              className="h-[32px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                                            />
                                            <input
                                              type="number"
                                              min="1"
                                              step="1"
                                              value={customForm.quantity}
                                              onChange={(event) => {
                                                setCustomItemFormField(customFormKey, { quantity: event.target.value });
                                              }}
                                              placeholder="Qty"
                                              className="h-[32px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                                            />
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={customForm.unitPrice}
                                              onChange={(event) => {
                                                setCustomItemFormField(customFormKey, { unitPrice: event.target.value });
                                              }}
                                              placeholder="Price"
                                              className="h-[32px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                                            />
                                            <input
                                              type="number"
                                              min="0.01"
                                              step="0.001"
                                              value={customForm.taxMultiplier}
                                              onChange={(event) => {
                                                setCustomItemFormField(customFormKey, { taxMultiplier: event.target.value });
                                              }}
                                              placeholder="Tax x"
                                              className="h-[32px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                                            />

                                            <button
                                              type="button"
                                              onClick={() => {
                                                void handleAddCustomItem(expense.id, category.key);
                                              }}
                                              disabled={addingCustomItemKey === customFormKey}
                                              className="inline-flex h-[32px] items-center justify-center gap-[6px] rounded-input bg-[#1C1917] px-[10px] text-[11px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
                                            >
                                              {addingCustomItemKey === customFormKey ? (
                                                <Loader2 className="h-[11px] w-[11px] animate-spin" />
                                              ) : (
                                                <Plus className="h-[11px] w-[11px]" />
                                              )}
                                              Add
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </CategoryCard>
                                  );
                                })}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <SettlementDashboard
                  participants={participantView}
                  entries={settlementEntries}
                  payerId={selectedCollectorId}
                  onSelectPayer={setSelectedCollectorId}
                  onPayViaUpi={handlePayViaUpi}
                  onSendReminder={handleSendReminder}
                  onSettleAndNotify={handleSettleAndNotify}
                />
              </div>
            )}

            {activeTab === 'past-splits' && (
              <section>
                <div className="mb-[10px] inline-flex items-center gap-[6px] text-[10px] uppercase tracking-[0.9px] text-muted">
                  Past Splits
                </div>

                <div className="rounded-card border border-border bg-card px-[12px] py-[12px]">
                  {loadingPastSplits ? (
                    <div className="inline-flex items-center gap-[6px] text-[12px] text-muted">
                      <Loader2 className="h-[12px] w-[12px] animate-spin" />
                      Loading past records linked to your WhatsApp number...
                    </div>
                  ) : pastSplitsError ? (
                    <p className="text-[12px] text-settle-red">{pastSplitsError}</p>
                  ) : !currentParticipant?.phone_number ? (
                    <p className="text-[12px] text-muted">
                      Add your WhatsApp number in Settings to auto-load previous split history.
                    </p>
                  ) : pastSplitSummaries.length === 0 ? (
                    <p className="text-[12px] text-muted">No previous split records found for this WhatsApp number.</p>
                  ) : (
                    <div className="space-y-[10px]">
                      <div className="grid gap-[8px] sm:grid-cols-3">
                        <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
                          <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Total Trips</p>
                          <p className="mt-[2px] text-[16px] font-medium text-[#1C1917]">{pastSplitSummaries.length}</p>
                        </article>

                        <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
                          <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Total Expense</p>
                          <p className="mt-[2px] text-[16px] font-medium text-[#1C1917]">{inr.format(totalPastTripsExpense)}</p>
                        </article>

                        <article className="rounded-input border border-divider bg-canvas px-[10px] py-[8px]">
                          <p className="text-[10px] uppercase tracking-[0.8px] text-muted">You Paid Across Trips</p>
                          <p className="mt-[2px] text-[16px] font-medium text-[#1C1917]">{inr.format(totalPastTripsPaidByYou)}</p>
                        </article>
                      </div>

                      <div className="rounded-input border border-divider bg-canvas px-[10px] py-[10px]">
                        <p className="text-[10px] uppercase tracking-[0.8px] text-muted">Expense Graph (Top Trips)</p>
                        <div className="mt-[8px] flex h-[170px] items-end gap-[8px]">
                          {pastSplitChartData.map((summary) => {
                            const barHeight =
                              maxPastSplitChartValue > 0
                                ? Math.max((summary.totalExpense / maxPastSplitChartValue) * 100, 8)
                                : 8;
                            const tripName =
                              summary.tripName || summary.firstExpenseTitle || `Trip ${summary.sessionId.slice(0, 6)}`;

                            return (
                              <div key={`graph-${summary.sessionId}`} className="flex min-w-0 flex-1 flex-col items-center gap-[5px]">
                                <p className="text-[10px] text-muted">{inr.format(summary.totalExpense)}</p>
                                <div
                                  className="w-full rounded-t-[8px] bg-gradient-to-t from-[#D97706] to-[#FBBF24]"
                                  style={{ height: `${barHeight}%` }}
                                />
                                <p className="w-full truncate text-center text-[10px] text-[#1C1917]" title={tripName}>
                                  {tripName}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {pastSplitSummaries.map((summary) => {
                        const isEditing = editingPastTripId === summary.sessionId;
                        const tripName =
                          summary.tripName || summary.firstExpenseTitle || `Trip ${summary.sessionId.slice(0, 6)}`;

                        return (
                          <article
                            key={summary.sessionId}
                            className="rounded-input border border-divider bg-white px-[10px] py-[9px]"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-[8px]">
                              <div className="min-w-0">
                                {isEditing ? (
                                  <input
                                    value={editingPastTripName}
                                    onChange={(event) => setEditingPastTripName(event.target.value)}
                                    className="h-[32px] w-full max-w-[320px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                                  />
                                ) : (
                                  <p className="truncate text-[13px] font-medium text-[#1C1917]">{tripName}</p>
                                )}

                                <p className="mt-[2px] text-[11px] text-muted">
                                  Room: {summary.sessionId} · {summary.expenseCount} expense
                                  {summary.expenseCount > 1 ? 's' : ''} · You paid {inr.format(summary.totalPaidByYou)}
                                </p>
                              </div>

                              <div className="flex items-center gap-[6px]">
                                <p className="text-[13px] font-medium text-[#1C1917]">{inr.format(summary.totalExpense)}</p>

                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditingPastTrip}
                                      className="inline-flex h-[28px] items-center gap-[4px] rounded-input border border-border bg-white px-[8px] text-[11px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                                    >
                                      <X className="h-[11px] w-[11px]" />
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleSavePastTripName();
                                      }}
                                      disabled={savingPastTripName}
                                      className="inline-flex h-[28px] items-center gap-[4px] rounded-input bg-[#1C1917] px-[8px] text-[11px] text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
                                    >
                                      {savingPastTripName ? <Loader2 className="h-[11px] w-[11px] animate-spin" /> : <Check className="h-[11px] w-[11px]" />}
                                      Save
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => router.push(`/room/${summary.sessionId}`)}
                                      className="h-[28px] rounded-input border border-border bg-white px-[8px] text-[11px] text-[#2563EB] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                                    >
                                      Open
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditingPastTrip(summary)}
                                      className="inline-flex h-[28px] items-center gap-[4px] rounded-input border border-border bg-white px-[8px] text-[11px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                                    >
                                      <Pencil className="h-[11px] w-[11px]" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleDeletePastTrip(summary);
                                      }}
                                      disabled={deletingPastTripId === summary.sessionId}
                                      className="inline-flex h-[28px] items-center gap-[4px] rounded-input border border-[#FECACA] bg-[#FEF2F2] px-[8px] text-[11px] text-[#B91C1C] transition-[background-color] duration-150 ease-linear hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {deletingPastTripId === summary.sessionId ? (
                                        <Loader2 className="h-[11px] w-[11px] animate-spin" />
                                      ) : (
                                        <Trash2 className="h-[11px] w-[11px]" />
                                      )}
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'settings' && (
              <section className="space-y-[12px]">
                <div className="rounded-card border border-border bg-card px-[12px] py-[12px]">
                  <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Room Settings</p>
                  <p className="mt-[4px] text-[13px] text-[#1C1917]">Room ID: {roomId}</p>
                  <p className="mt-[2px] text-[12px] text-muted">
                    Primary collector: {participantsById[selectedCollectorId ?? '']?.name ?? 'Not selected'}
                  </p>
                </div>

                <div className="rounded-card border border-border bg-card px-[12px] py-[12px]">
                  <p className="text-[10px] uppercase tracking-[0.9px] text-muted">My Profile</p>
                  <p className="mt-[2px] text-[12px] text-muted">
                    Name is required. WhatsApp and UPI are optional but recommended.
                  </p>

                  <div className="mt-[8px] grid gap-[8px]">
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      placeholder="Your Name"
                      className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                    />
                    <input
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(event.target.value)}
                      placeholder="WhatsApp Number"
                      className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                    />
                    <input
                      value={profileUpi}
                      onChange={(event) => setProfileUpi(event.target.value)}
                      placeholder="UPI ID"
                      className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                    />

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSaveMyProfile();
                        }}
                        disabled={savingProfile}
                        className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
                      >
                        {savingProfile ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : null}
                        {savingProfile ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-card border border-border bg-card px-[12px] py-[12px]">
                  <p className="text-[10px] uppercase tracking-[0.9px] text-muted">Participants</p>
                  <p className="mt-[2px] text-[12px] text-muted">
                    Host can remove users who have no paid expenses linked to them.
                  </p>
                  <div className="mt-[8px] space-y-[8px]">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="rounded-input border border-divider px-[10px] py-[8px]"
                      >
                        <div className="flex items-center justify-between gap-[8px]">
                          <p className="text-[13px] font-medium text-[#1C1917]">{participant.name}</p>
                          {participant.id === currentParticipantId ? (
                            <span className="rounded-pill border border-[#BBF7D0] bg-[#F0FDF4] px-[8px] py-[3px] text-[10px] font-medium text-[#166534]">
                              Host
                            </span>
                          ) : canManageParticipants ? (
                            <button
                              type="button"
                              onClick={() => {
                                void handleRemoveParticipant(participant.id);
                              }}
                              disabled={removingParticipantId === participant.id}
                              className="inline-flex h-[26px] items-center gap-[4px] rounded-input border border-[#FECACA] bg-[#FEF2F2] px-[8px] text-[11px] text-[#B91C1C] transition-[background-color] duration-150 ease-linear hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {removingParticipantId === participant.id ? (
                                <Loader2 className="h-[11px] w-[11px] animate-spin" />
                              ) : (
                                <Trash2 className="h-[11px] w-[11px]" />
                              )}
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <p className="mt-[1px] text-[11px] text-muted">
                          Phone: {participant.phone_number || 'Not set'}
                        </p>
                        <p className="text-[11px] text-muted">UPI: {participant.upi_id || 'Not set'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </AppShell>

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-[16px]">
          <div className="w-full max-w-[360px] rounded-card border border-border bg-card p-[18px]">
            <h2 className="text-[16px] font-medium text-[#1C1917]">Join This Room</h2>
            <p className="mt-[4px] text-[12px] text-muted">
              Name is compulsory. WhatsApp number and UPI ID are optional.
            </p>

            <div className="mt-[12px] grid gap-[8px]">
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleJoinRoom();
                  }
                }}
                placeholder="Your name"
                className="h-[36px] w-full rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
              <input
                value={joinPhone}
                onChange={(event) => setJoinPhone(event.target.value)}
                placeholder="WhatsApp number (optional)"
                className="h-[36px] w-full rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
              <input
                value={joinUpi}
                onChange={(event) => setJoinUpi(event.target.value)}
                placeholder="UPI ID (optional)"
                className="h-[36px] w-full rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
            </div>

            <button
              type="button"
              disabled={joiningRoom}
              onClick={() => {
                void handleJoinRoom();
              }}
              className="mt-[10px] inline-flex h-[36px] w-full items-center justify-center gap-[6px] rounded-input bg-[#1C1917] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
            >
              {joiningRoom ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : null}
              {joiningRoom ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-[16px]">
          <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-[18px]">
            <h2 className="text-[16px] font-medium text-[#1C1917]">Add User</h2>
            <p className="mt-[4px] text-[12px] text-muted">Add participant details for reminders and payouts.</p>

            <div className="mt-[12px] grid gap-[8px]">
              <input
                value={newUserName}
                onChange={(event) => setNewUserName(event.target.value)}
                placeholder="Name"
                className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
              <input
                value={newUserPhone}
                onChange={(event) => setNewUserPhone(event.target.value)}
                placeholder="Phone Number"
                className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
              <input
                value={newUserUpi}
                onChange={(event) => setNewUserUpi(event.target.value)}
                placeholder="UPI ID"
                className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />
            </div>

            <div className="mt-[12px] flex items-center justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="h-[34px] rounded-input border border-border bg-white px-[12px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={addingUser}
                onClick={() => {
                  void handleAddUser();
                }}
                className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
              >
                {addingUser ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : <UserPlus className="h-[12px] w-[12px]" />}
                {addingUser ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-[16px]">
          <div className="w-full max-w-[560px] rounded-card border border-border bg-card p-[18px]">
            <h2 className="text-[16px] font-medium text-[#1C1917]">Scan Receipt (AI)</h2>
            <p className="mt-[4px] text-[12px] text-muted">Creates one expense card and auto-imports all detected line items.</p>

            <div className="mt-[12px] grid gap-[8px]">
              <input
                value={scanExpenseTitle}
                onChange={(event) => setScanExpenseTitle(event.target.value)}
                placeholder='Expense title (e.g., "Dinner at Yaary")'
                className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              />

              <select
                value={scanPayerId}
                onChange={(event) => setScanPayerId(event.target.value)}
                className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
              >
                <option value="">Who paid this expense?</option>
                {participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setScanFile(event.target.files?.[0] ?? null);
                }}
                className="w-full rounded-input border border-border bg-white px-[10px] py-[7px] text-[12px] text-[#1C1917] file:mr-[10px] file:rounded-input file:border-0 file:bg-dim file:px-[10px] file:py-[5px] file:text-[11px] file:font-medium"
              />
            </div>

            {scanningReceipt ? (
              <div className="mt-[10px] rounded-input border border-border bg-canvas px-[10px] py-[9px]">
                <div className="flex items-center justify-between text-[11px] text-[#1C1917]">
                  <p className="font-medium">{scanProgressLabel || 'Uploading & Analyzing...'}</p>
                  <p className="tabular-nums text-muted">{Math.round(scanProgressPct)}%</p>
                </div>
                <div className="mt-[6px] h-[7px] overflow-hidden rounded-full bg-[#E7E5E4]">
                  <div
                    className="h-full rounded-full bg-[#1C1917] transition-all duration-300 ease-linear"
                    style={{ width: `${Math.max(6, Math.round(scanProgressPct))}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-[12px] flex items-center justify-end gap-[8px]">
              <button
                type="button"
                disabled={scanningReceipt}
                onClick={() => {
                  setShowScanModal(false);
                  setScanFile(null);
                  setScanProgressPct(0);
                  setScanProgressLabel('');
                }}
                className="h-[34px] rounded-input border border-border bg-white px-[12px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={scanningReceipt}
                onClick={() => {
                  void handleCreateScannedExpense();
                }}
                className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
              >
                {scanningReceipt ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : <Camera className="h-[12px] w-[12px]" />}
                {scanningReceipt ? 'Uploading & Analyzing...' : 'Create Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeReceiptViewer && (
        <div className="fixed inset-0 z-[70] bg-black/95">
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-[8px] border-b border-white/15 bg-black/55 px-[12px] py-[10px] backdrop-blur-sm">
            <p className="truncate text-[12px] font-medium text-white">{activeReceiptViewer.title}</p>
            <div className="flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => zoomReceipt('out')}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/30 bg-black/40 text-white"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-[14px] w-[14px]" />
              </button>
              <button
                type="button"
                onClick={() => zoomReceipt('in')}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/30 bg-black/40 text-white"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-[14px] w-[14px]" />
              </button>
              <button
                type="button"
                onClick={resetReceiptViewerTransform}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/30 bg-black/40 text-white"
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-[14px] w-[14px]" />
              </button>
              <button
                type="button"
                onClick={closeReceiptViewer}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-white/30 bg-black/40 text-white"
                aria-label="Close receipt viewer"
              >
                <X className="h-[14px] w-[14px]" />
              </button>
            </div>
          </div>

          <div
            className="absolute inset-0 top-[52px] flex touch-none items-center justify-center overflow-hidden px-[12px] pb-[20px]"
            onClick={closeReceiptViewer}
            onWheel={handleReceiptWheel}
            onPointerDown={handleReceiptPointerDown}
            onPointerMove={handleReceiptPointerMove}
            onPointerUp={handleReceiptPointerUp}
            onPointerCancel={handleReceiptPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeReceiptViewer.url}
              alt={`${activeReceiptViewer.title} receipt`}
              onClick={(event) => event.stopPropagation()}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
              style={{
                transform: `translate(${receiptPan.x}px, ${receiptPan.y}px) scale(${receiptZoom})`,
                transformOrigin: 'center center',
                transition: receiptPointersRef.current.size > 0 ? 'none' : 'transform 110ms linear'
              }}
            />
          </div>

          <div className="pointer-events-none absolute bottom-[14px] left-0 right-0 px-[14px] text-center text-[11px] text-white/75">
            Pinch to zoom • Drag to pan • Tap outside to close
          </div>
        </div>
      )}

      {showManualExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-[16px]">
          <div className="w-full max-w-[620px] rounded-card border border-border bg-card p-[18px]">
            <h2 className="text-[16px] font-medium text-[#1C1917]">Add Trip Expense</h2>
            <p className="mt-[4px] text-[12px] text-muted">
              Add one amount, choose who paid, and split equally or by ratio.
            </p>

            <div className="mt-[12px] space-y-[10px]">
              <div className="grid gap-[8px]">
                <input
                  value={manualExpenseTitle}
                  onChange={(event) => setManualExpenseTitle(event.target.value)}
                  placeholder='Expense name (e.g., "Auto to hotel")'
                  className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                />

                <div className="rounded-input border border-divider bg-canvas px-[10px] py-[9px]">
                  <p className="text-[11px] font-medium text-[#1C1917]">Payment Mode</p>
                  <div className="mt-[7px] flex flex-wrap items-center gap-[8px]">
                    <button
                      type="button"
                      onClick={() => setManualUseMultiplePayers(false)}
                      className="h-[30px] rounded-pill px-[12px] text-[11px] font-medium"
                      style={{
                        backgroundColor: !manualUseMultiplePayers ? '#1C1917' : '#FFFFFF',
                        color: !manualUseMultiplePayers ? '#FFFFFF' : '#1C1917',
                        border: !manualUseMultiplePayers ? '1px solid #1C1917' : '1px solid #D6D3D1'
                      }}
                    >
                      Single payer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualUseMultiplePayers(true);
                        setManualPayerSplits((current) =>
                          current.length > 0
                            ? current
                            : [{ participantId: manualExpensePayerId || selectedCollectorId || '', amount: '' }]
                        );
                      }}
                      className="h-[30px] rounded-pill px-[12px] text-[11px] font-medium"
                      style={{
                        backgroundColor: manualUseMultiplePayers ? '#1C1917' : '#FFFFFF',
                        color: manualUseMultiplePayers ? '#FFFFFF' : '#1C1917',
                        border: manualUseMultiplePayers ? '1px solid #1C1917' : '1px solid #D6D3D1'
                      }}
                    >
                      Multiple payers
                    </button>
                  </div>
                </div>

                {!manualUseMultiplePayers ? (
                  <div className="grid gap-[8px] sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualExpenseAmount}
                      onChange={(event) => setManualExpenseAmount(event.target.value)}
                      placeholder="Total amount"
                      className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                    />

                    <select
                      value={manualExpensePayerId}
                      onChange={(event) => setManualExpensePayerId(event.target.value)}
                      className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                    >
                      <option value="">Who paid?</option>
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-input border border-divider bg-canvas px-[10px] py-[9px]">
                    <p className="text-[11px] font-medium text-[#1C1917]">Who Paid and How Much</p>
                    <div className="mt-[8px] space-y-[7px]">
                      {manualPayerSplits.map((row, index) => (
                        <div key={`${index}-${row.participantId}`} className="grid gap-[8px] sm:grid-cols-[1fr_130px_auto]">
                          <select
                            value={row.participantId}
                            onChange={(event) =>
                              updateManualPayerSplit(index, { participantId: event.target.value })
                            }
                            className="h-[34px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                          >
                            <option value="">Select payer</option>
                            {participants.map((participant) => (
                              <option key={participant.id} value={participant.id}>
                                {participant.name}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => updateManualPayerSplit(index, { amount: event.target.value })}
                            placeholder="Amount"
                            className="h-[34px] rounded-input border border-border bg-white px-[10px] text-[12px] text-[#1C1917] outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => removeManualPayerSplit(index)}
                            disabled={manualPayerSplits.length <= 1}
                            className="h-[34px] rounded-input border border-border bg-white px-[10px] text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-[8px] flex flex-wrap items-center justify-between gap-[8px]">
                      <button
                        type="button"
                        onClick={addManualPayerSplit}
                        className="h-[30px] rounded-input border border-border bg-white px-[10px] text-[11px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
                      >
                        + Add payer
                      </button>
                      <p className="text-[11px] font-medium text-[#1C1917]">
                        Total paid: {inr.format(manualPayerSplitTotal)}
                      </p>
                    </div>
                  </div>
                )}

                <input
                  value={manualExpenseRemark}
                  onChange={(event) => setManualExpenseRemark(event.target.value)}
                  placeholder="Remark (optional)"
                  className="h-[36px] rounded-input border border-border bg-white px-[10px] text-[13px] text-[#1C1917] outline-none"
                />
              </div>

              <div className="rounded-input border border-divider bg-canvas px-[10px] py-[9px]">
                <p className="text-[11px] font-medium text-[#1C1917]">Split Mode</p>
                <div className="mt-[7px] flex flex-wrap items-center gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setManualSplitMode('equal')}
                    className="h-[30px] rounded-pill px-[12px] text-[11px] font-medium"
                    style={{
                      backgroundColor: manualSplitMode === 'equal' ? '#1C1917' : '#FFFFFF',
                      color: manualSplitMode === 'equal' ? '#FFFFFF' : '#1C1917',
                      border: manualSplitMode === 'equal' ? '1px solid #1C1917' : '1px solid #D6D3D1'
                    }}
                  >
                    Equal split
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSplitMode('ratio')}
                    className="h-[30px] rounded-pill px-[12px] text-[11px] font-medium"
                    style={{
                      backgroundColor: manualSplitMode === 'ratio' ? '#1C1917' : '#FFFFFF',
                      color: manualSplitMode === 'ratio' ? '#FFFFFF' : '#1C1917',
                      border: manualSplitMode === 'ratio' ? '1px solid #1C1917' : '1px solid #D6D3D1'
                    }}
                  >
                    Ratio split
                  </button>
                </div>
              </div>

              <div className="rounded-input border border-divider bg-canvas px-[10px] py-[9px]">
                <p className="text-[11px] font-medium text-[#1C1917]">Split With</p>
                <div className="mt-[7px] flex flex-wrap gap-[8px]">
                  {participants.map((participant) => {
                    const isSelected = manualSplitParticipantIds.includes(participant.id);
                    return (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => toggleManualSplitParticipant(participant.id)}
                        className="rounded-pill px-[10px] py-[6px] text-[11px] font-medium transition-[background-color,border-color] duration-150 ease-linear"
                        style={{
                          backgroundColor: isSelected ? '#FFF7E6' : '#FFFFFF',
                          color: isSelected ? '#1C1917' : '#57534E',
                          border: isSelected ? '1px solid #F59E0B' : '1px solid #D6D3D1'
                        }}
                      >
                        {participant.name}
                      </button>
                    );
                  })}
                </div>

                {manualSplitMode === 'ratio' && manualSplitParticipantIds.length > 0 && (
                  <div className="mt-[9px] grid gap-[8px] sm:grid-cols-2">
                    {manualSplitParticipantIds
                      .filter((participantId) => Boolean(participantsById[participantId]))
                      .map((participantId) => {
                        const participant = participantsById[participantId];
                        if (!participant) return null;

                        return (
                          <label key={participantId} className="flex items-center justify-between gap-[8px]">
                            <span className="truncate text-[11px] text-[#1C1917]">{participant.name}</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={manualSplitRatios[participantId] ?? '1'}
                              onChange={(event) =>
                                setManualSplitRatios((current) => ({
                                  ...current,
                                  [participantId]: event.target.value
                                }))
                              }
                              className="h-[30px] w-[74px] rounded-input border border-border bg-white px-[8px] text-[12px] text-[#1C1917] outline-none"
                            />
                          </label>
                        );
                      })}
                  </div>
                )}

                <p className="mt-[8px] text-[11px] text-muted">
                  {manualSplitParticipantIds.length} participant
                  {manualSplitParticipantIds.length === 1 ? '' : 's'} selected
                </p>
              </div>
            </div>

            <div className="mt-[12px] flex items-center justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => setShowManualExpenseModal(false)}
                className="h-[34px] rounded-input border border-border bg-white px-[12px] text-[12px] text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingManualExpense}
                onClick={() => {
                  void handleCreateManualExpense();
                }}
                className="inline-flex h-[34px] items-center gap-[6px] rounded-input bg-[#1C1917] px-[12px] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black disabled:cursor-not-allowed disabled:bg-[#57534E]"
              >
                {creatingManualExpense ? <Loader2 className="h-[12px] w-[12px] animate-spin" /> : <Plus className="h-[12px] w-[12px]" />}
                {creatingManualExpense ? 'Saving...' : 'Create Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {upiPaymentSheet && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 px-[16px]">
          <div className="w-full max-w-[380px] rounded-card border border-border bg-card p-[18px]">
            <h2 className="text-[16px] font-medium text-[#1C1917]">Pay via UPI</h2>
            <p className="mt-[4px] text-[12px] text-muted">
              Scan this QR in any UPI app or open the payment app directly.
            </p>

            <div className="mt-[10px] rounded-input border border-divider bg-canvas p-[10px]">
              <div
                role="img"
                aria-label="UPI payment QR code"
                className="mx-auto h-[220px] w-[220px] rounded-[6px] bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${upiQrCodeUrl}")` }}
              />
            </div>

            <div className="mt-[10px] space-y-[2px] text-[12px] text-[#1C1917]">
              <p>
                <span className="text-muted">Amount:</span> {inr.format(Number(upiPaymentSheet.amount))}
              </p>
              <p>
                <span className="text-muted">Pay to:</span> {upiPaymentSheet.collectorName}
              </p>
              <p className="break-all">
                <span className="text-muted">UPI ID:</span> {upiPaymentSheet.collectorUpiId}
              </p>
            </div>

            <div className="mt-[12px] grid gap-[8px]">
              <button
                type="button"
                onClick={handleOpenUpiPaymentApp}
                className="h-[34px] rounded-input bg-[#1C1917] text-[12px] font-medium text-white transition-[background-color] duration-150 ease-linear hover:bg-black"
              >
                Open Payment App
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCopyUpiLink();
                }}
                className="h-[34px] rounded-input border border-border bg-white text-[12px] font-medium text-[#1C1917] transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                Copy UPI Link
              </button>
              <button
                type="button"
                onClick={handleCloseUpiSheet}
                className="h-[34px] rounded-input border border-divider bg-canvas text-[12px] font-medium text-muted transition-[background-color] duration-150 ease-linear hover:bg-dim"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-[74px] right-[14px] z-[60] md:bottom-[18px]">
          <div
            className="rounded-input border px-[11px] py-[8px] text-[12px] shadow-sm"
            style={{
              borderColor: toast.type === 'error' ? '#FECACA' : '#A7F3D0',
              backgroundColor: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
              color: toast.type === 'error' ? '#B91C1C' : '#065F46'
            }}
          >
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}
