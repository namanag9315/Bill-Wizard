export type TaxCategoryKey = 'food' | 'alcohol' | 'water';

export const PERSON_COLORS = {
  NA: { bg: '#E1F5EE', text: '#0F6E56', ring: '#BBE9D9' },
  RK: { bg: '#E6F1FB', text: '#185FA5', ring: '#C5DEF8' },
  PJ: { bg: '#FAEEDA', text: '#854F0B', ring: '#F5D9B0' },
  SV: { bg: '#FAECE7', text: '#993C1D', ring: '#F4D4C8' }
} as const;

const FALLBACK_PERSON_COLORS = [
  { bg: '#E1F5EE', text: '#0F6E56', ring: '#BBE9D9' },
  { bg: '#E6F1FB', text: '#185FA5', ring: '#C5DEF8' },
  { bg: '#FAEEDA', text: '#854F0B', ring: '#F5D9B0' },
  { bg: '#FAECE7', text: '#993C1D', ring: '#F4D4C8' }
] as const;

export const TAX_PILLS: Record<TaxCategoryKey, { bg: string; text: string; label: string }> = {
  food: { bg: '#FEF3C7', text: '#92400E', label: 'Food' },
  alcohol: { bg: '#FEE2E2', text: '#B91C1C', label: 'Alcohol' },
  water: { bg: '#CCFBF1', text: '#0F766E', label: 'Water' }
};

export function getPersonColors(initials: string) {
  const upper = initials.toUpperCase() as keyof typeof PERSON_COLORS;
  if (PERSON_COLORS[upper]) return PERSON_COLORS[upper];

  const hash = initials
    .toUpperCase()
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_PERSON_COLORS[hash % FALLBACK_PERSON_COLORS.length];
}

