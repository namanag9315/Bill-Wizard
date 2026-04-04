import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai';
import { NextResponse } from 'next/server';

type ReceiptCategory =
  | 'Veg Food'
  | 'Non-Veg Food'
  | 'Breads'
  | 'Non-Alcoholic Beverages'
  | 'Alcohol';

type ScannedReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  totalRowPrice: number;
  autoSplitAll: boolean;
};

type ScannedReceiptCategory = {
  category: ReceiptCategory;
  taxMultiplier: number;
  items: ScannedReceiptItem[];
};

const RECEIPT_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    categories: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: {
            type: SchemaType.STRING,
            format: 'enum' as const,
            enum: ['Veg Food', 'Non-Veg Food', 'Breads', 'Non-Alcoholic Beverages', 'Alcohol']
          },
          taxMultiplier: { type: SchemaType.NUMBER },
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                quantity: { type: SchemaType.INTEGER },
                unitPrice: { type: SchemaType.NUMBER },
                totalRowPrice: { type: SchemaType.NUMBER },
                autoSplitAll: { type: SchemaType.BOOLEAN }
              },
              required: ['name', 'quantity', 'unitPrice', 'totalRowPrice', 'autoSplitAll']
            }
          }
        },
        required: ['category', 'taxMultiplier', 'items']
      }
    }
  },
  required: ['categories']
};

const RECEIPT_PROMPT = `Analyze this receipt. Return valid JSON with an array called categories. Group items STRICTLY into: 'Veg Food', 'Non-Veg Food', 'Breads', 'Non-Alcoholic Beverages', and 'Alcohol'.
DYNAMIC MULTIPLIERS: Do NOT assume fixed tax/discount numbers. Read the receipt footer and compute the effective taxMultiplier for Food (after food discounts + GST) and for Alcohol (after VAT/liquor tax). Example: 5% GST and no discount = 1.05.
ITEM EXTRACTION: For each item, extract name, quantity (integer), unitPrice (pre-tax for ONE unit), and calculate totalRowPrice strictly as (quantity * unitPrice).
BREADS RULE: 'Breads' MUST contain Indian breads such as roti, naan, paratha, kulcha, roomali, bhakri, or tandoori roti.
BEVERAGE RULE: 'Cold Drinks', 'Soda', and 'Water' MUST be placed under 'Non-Alcoholic Beverages'.
STRICT COVERAGE CHECK: If the receipt contains cold drinks/soft drinks/soda/juice/mocktails/water lines, they MUST appear in output under 'Non-Alcoholic Beverages'. Never drop or merge away drinking water rows.
ZERO-PRICE RULE: Keep line items even if complimentary or zero-priced (unitPrice or totalRowPrice may be 0).
BOOLEAN: Add autoSplitAll: true ONLY for 'Packaged Drinking Water' or generic water, otherwise false.
OUTPUT RULE: Return ONLY valid JSON matching the schema, no extra text.`;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const BREAD_NAME_REGEX = /\b(roti|naan|paratha|parotta|kulcha|roomali|bhakri|phulka|chapati)\b/i;
const DRINK_NAME_REGEX =
  /\b(cold drink|cold drinks|soft drink|soft drinks|soda|juice|mocktail|lassi|shake|beverage)\b/i;
const WATER_NAME_REGEX =
  /\b(water|mineral water|packaged drinking water|bisleri|aquafina|kinley|bottled water)\b/i;

function parseModelJson(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    const objectFallback = rawText.match(/\{[\s\S]*\}/);
    if (objectFallback) return JSON.parse(objectFallback[0]);

    const arrayFallback = rawText.match(/\[[\s\S]*\]/);
    if (arrayFallback) return JSON.parse(arrayFallback[0]);

    throw new Error('Gemini did not return valid JSON.');
  }
}

function normalizeCategory(value: unknown): ReceiptCategory | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === 'veg food' || normalized === 'veg') return 'Veg Food';
  if (
    normalized === 'non-veg food' ||
    normalized === 'non veg food' ||
    normalized === 'nonveg food' ||
    normalized.includes('non-veg') ||
    normalized.includes('non veg')
  ) {
    return 'Non-Veg Food';
  }

  if (normalized === 'breads' || normalized.includes('bread') || BREAD_NAME_REGEX.test(normalized)) {
    return 'Breads';
  }

  if (
    normalized === 'non-alcoholic beverages' ||
    normalized === 'non alcoholic beverages' ||
    normalized.includes('non-alcoholic') ||
    normalized.includes('non alcoholic') ||
    normalized.includes('beverages') ||
    normalized.includes('drinks') ||
    normalized.includes('cold drink') ||
    normalized.includes('soft drink') ||
    normalized.includes('soda') ||
    normalized.includes('juice') ||
    DRINK_NAME_REGEX.test(normalized) ||
    normalized.includes('water bottle') ||
    normalized.includes('mineral water') ||
    normalized.includes('water')
  ) {
    return 'Non-Alcoholic Beverages';
  }

  if (normalized === 'alcohol' || normalized.includes('beer') || normalized.includes('wine')) {
    return 'Alcohol';
  }

  if (normalized.includes('alcohol')) return 'Alcohol';
  if (
    normalized.includes('beverage') ||
    normalized.includes('drink') ||
    normalized.includes('water') ||
    normalized.includes('soda') ||
    normalized.includes('juice')
  ) {
    return 'Non-Alcoholic Beverages';
  }
  if (normalized.includes('bread') || BREAD_NAME_REGEX.test(normalized)) return 'Breads';
  if (normalized.includes('food') || normalized.includes('veg')) return 'Veg Food';
  return null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string') return null;

  const numeric = Number(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function normalizeQuantity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const quantity = Math.round(value);
    return quantity > 0 ? quantity : null;
  }

  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric)) return null;
    const quantity = Math.round(numeric);
    return quantity > 0 ? quantity : null;
  }

  return null;
}

function normalizeTaxMultiplier(value: unknown): number {
  const parsed = normalizeNonNegativeNumber(value);
  return parsed && parsed > 0 ? parsed : 1;
}

function sanitizeScannedCategories(payload: unknown): ScannedReceiptCategory[] {
  const categories =
    typeof payload === 'object' &&
    payload !== null &&
    'categories' in payload &&
    Array.isArray((payload as { categories: unknown }).categories)
      ? (payload as { categories: unknown[] }).categories
      : Array.isArray(payload)
        ? payload
        : [];

  const cleaned: ScannedReceiptCategory[] = [];

  for (const categoryRow of categories) {
    if (typeof categoryRow !== 'object' || categoryRow === null) continue;

    const rawCategory = 'category' in categoryRow ? categoryRow.category : '';
    const rawTaxMultiplier = 'taxMultiplier' in categoryRow ? categoryRow.taxMultiplier : 1;
    const category = normalizeCategory(rawCategory);
    if (!category) continue;

    const taxMultiplier = normalizeTaxMultiplier(rawTaxMultiplier);

    const rawItems =
      'items' in categoryRow && Array.isArray(categoryRow.items)
        ? (categoryRow.items as unknown[])
        : [];

    const cleanedItems: ScannedReceiptItem[] = [];

    for (const itemRow of rawItems) {
      if (typeof itemRow !== 'object' || itemRow === null) continue;

      const rawName = 'name' in itemRow ? itemRow.name : '';
      const rawQuantity = 'quantity' in itemRow ? itemRow.quantity : null;
      const rawUnitPrice =
        'unitPrice' in itemRow
          ? itemRow.unitPrice
          : 'price' in itemRow
            ? itemRow.price
            : 'basePrice' in itemRow
              ? itemRow.basePrice
              : null;
      const rawTotalRowPrice =
        'totalRowPrice' in itemRow
          ? itemRow.totalRowPrice
          : 'rowPrice' in itemRow
            ? itemRow.rowPrice
            : 'basePrice' in itemRow
              ? itemRow.basePrice
              : null;

      const name = typeof rawName === 'string' ? rawName.trim() : '';
      const quantity = normalizeQuantity(rawQuantity) ?? 1;
      const parsedUnitPrice = normalizeNonNegativeNumber(rawUnitPrice);
      const parsedTotalRowPrice = normalizeNonNegativeNumber(rawTotalRowPrice);
      const unitPrice =
        parsedUnitPrice ??
        (quantity && parsedTotalRowPrice !== null
          ? Number((parsedTotalRowPrice / quantity).toFixed(2))
          : null);

      if (!name || unitPrice === null) continue;

      const totalRowPrice = Number((quantity * unitPrice).toFixed(2));
      const autoSplitAll = WATER_NAME_REGEX.test(name);

      cleanedItems.push({
        name,
        quantity,
        unitPrice,
        totalRowPrice,
        autoSplitAll
      });
    }

    if (cleanedItems.length === 0) continue;

    cleaned.push({
      category,
      taxMultiplier,
      items: cleanedItems
    });
  }

  return cleaned;
}

function flattenCategories(categories: ScannedReceiptCategory[]) {
  return categories.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      category: category.category,
      taxMultiplier: category.taxMultiplier
    }))
  );
}

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GEMINI_API_KEY on the server.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const receiptUrlRaw = formData.get('receipt_url');
    const receiptUrl =
      typeof receiptUrlRaw === 'string' && receiptUrlRaw.trim().length > 0
        ? receiptUrlRaw.trim()
        : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' in request body." }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload an image file.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image too large. Please keep receipts below 10MB.' },
        { status: 413 }
      );
    }

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const imageBase64 = imageBuffer.toString('base64');

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RECEIPT_RESPONSE_SCHEMA
      }
    });

    const result = await model.generateContent([
      { text: RECEIPT_PROMPT },
      { inlineData: { mimeType: file.type, data: imageBase64 } }
    ]);

    const parsedPayload = parseModelJson(result.response.text());
    const categories = sanitizeScannedCategories(parsedPayload);
    const items = flattenCategories(categories);

    return NextResponse.json({ categories, items, receiptUrl }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt scan failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
