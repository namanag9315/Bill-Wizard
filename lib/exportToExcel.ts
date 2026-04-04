import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export type Room = {
  id: string;
  name: string;
  url?: string;
  totalBill?: number;
};

export type Item = {
  id: string;
  expenseId?: string;
  name: string;
  category?: string;
  taxCategory?: string;
  quantity?: number;
  unitPrice?: number;
  basePrice: number;
  finalPrice: number;
  multiplier?: number;
  qtyMap?: Record<string, number>;
  createdAt?: string | null;
};

export type Person = {
  id: string;
  name: string;
  initials?: string;
  upiId?: string | null;
  totalShare: number;
  paidUpfront: number;
  netBalance: number;
  itemsShared?: number;
  isSettled?: boolean;
  lightColor?: string;
  darkColor?: string;
};

export type TaxConfig = {
  discountPct: number;
  gstPct: number;
  multiplier: number;
};

const COLORS = {
  navy: '0D1B2A',
  navyMid: '1B3A6B',
  amber: 'F59E0B',
  amberLight: 'FEF3C7',
  canvas: 'F7F6F3',
  white: 'FFFFFF',
  border: 'E8E5DE',
  green: '059669',
  red: 'DC2626',
  muted: 'A8A29E',
  textDark: '1C1917',
  greenLight: 'ECFDF5',
  redLight: 'FEE2E2'
} as const;

const FONTS = {
  heading: { name: 'Calibri', size: 20, bold: true, color: { argb: 'FF0D1B2A' } },
  subhead: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFF7F6F3' } },
  label: { name: 'Calibri', size: 10, color: { argb: 'FFA8A29E' } },
  body: { name: 'Calibri', size: 10, color: { argb: 'FF1C1917' } },
  bodyBold: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1C1917' } },
  mono: { name: 'Courier New', size: 9, color: { argb: 'FFA8A29E' } },
  amberBold: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } },
  green: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } },
  red: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } }
} as const;

const INR_NUM_FMT = '₹#,##0.00';

const PERSON_COLOR_FALLBACKS = [
  { light: 'E1F5EE', dark: '0F6E56' },
  { light: 'E6F1FB', dark: '185FA5' },
  { light: 'FAEEDA', dark: '854F0B' },
  { light: 'FAECE7', dark: '993C1D' }
];

const TAX_CATEGORY_STYLES: Record<string, { fill: string; font: string; label: string }> = {
  food: { fill: 'FEF3C7', font: '92400E', label: 'Food' },
  alcohol: { fill: 'FEE2E2', font: 'B91C1C', label: 'Alcohol' },
  water: { fill: 'CCFBF1', font: '0F766E', label: 'Water' }
};

function normalizeHex(hex: string) {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (cleaned.length === 6) return cleaned;
  if (cleaned.length === 8) return cleaned.slice(2);
  return 'FFFFFF';
}

function toArgb(hex: string) {
  return `FF${normalizeHex(hex)}`;
}

function columnLetter(index: number) {
  let value = index;
  let result = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    result = String.fromCharCode(65 + modulo) + result;
    value = Math.floor((value - modulo) / 26);
  }
  return result;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

function toInitials(name: string) {
  const clean = name.trim();
  if (!clean) return 'BW';
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'BW';
}

function styleCell(
  cell: ExcelJS.Cell,
  options: {
    font?: Partial<ExcelJS.Font>;
    fill?: string;
    align?: 'left' | 'center' | 'right';
    border?: boolean;
    numFmt?: string;
    wrapText?: boolean;
    indent?: number;
  }
) {
  const { font, fill, align, border, numFmt, wrapText, indent } = options;

  if (font) cell.font = font;
  if (fill) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: toArgb(fill) }
    };
  }
  if (align) {
    cell.alignment = {
      horizontal: align,
      vertical: 'middle',
      wrapText: Boolean(wrapText),
      indent
    };
  }
  if (border) {
    cell.border = {
      top: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
      bottom: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
      left: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
      right: { style: 'thin', color: { argb: toArgb(COLORS.border) } }
    };
  }
  if (numFmt) cell.numFmt = numFmt;
}

function getPersonColor(person: Person, index: number) {
  const light = person.lightColor ? normalizeHex(person.lightColor) : PERSON_COLOR_FALLBACKS[index % PERSON_COLOR_FALLBACKS.length].light;
  const dark = person.darkColor ? normalizeHex(person.darkColor) : PERSON_COLOR_FALLBACKS[index % PERSON_COLOR_FALLBACKS.length].dark;
  return { light, dark };
}

function computePersonNet(person: Person) {
  const fromTotals = Number((person.totalShare - person.paidUpfront).toFixed(2));
  if (Math.abs(fromTotals) > 0.0001 || person.totalShare !== 0 || person.paidUpfront !== 0) {
    return fromTotals;
  }
  return Number(person.netBalance.toFixed(2));
}

function getItemTotalShares(item: Item) {
  const qtyMap = item.qtyMap ?? {};
  return Object.values(qtyMap).reduce((sum, share) => sum + (share > 0 ? share : 0), 0);
}

function getItemShareAmount(item: Item, personId: string) {
  const qtyMap = item.qtyMap ?? {};
  const shares = qtyMap[personId] ?? 0;
  const totalShares = getItemTotalShares(item);
  if (shares <= 0 || totalShares <= 0) return null;
  return Number(((item.finalPrice * shares) / totalShares).toFixed(2));
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  room: Room,
  items: Item[],
  people: Person[],
  taxConfig: TaxConfig,
  generatedAt: Date
) {
  const sheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];

  const totalBill = Number(items.reduce((sum, item) => sum + item.finalPrice, 0).toFixed(2));
  const baseTotal = Number(items.reduce((sum, item) => sum + item.basePrice, 0).toFixed(2));
  const largestShare = people.length > 0 ? Math.max(...people.map((person) => person.totalShare)) : 0;
  const smallestShare = people.length > 0 ? Math.min(...people.map((person) => person.totalShare)) : 0;
  const unassignedItems = items.filter((item) => getItemTotalShares(item) === 0).length;

  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'BillWizard — Trip Settlement Report';
  styleCell(titleCell, {
    font: { ...FONTS.heading, color: { argb: toArgb(COLORS.white) } },
    fill: COLORS.navy,
    align: 'left',
    indent: 2
  });
  sheet.getRow(1).height = 40;

  sheet.mergeCells('A2:E2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Generated on ${formatDisplayDate(generatedAt)} · Room: ${room.id}`;
  styleCell(subtitleCell, {
    font: { ...FONTS.mono, color: { argb: toArgb(COLORS.canvas) } },
    fill: COLORS.navy,
    align: 'left',
    indent: 2
  });
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 8;

  const overviewLabel = sheet.getCell('A4');
  overviewLabel.value = 'TRIP OVERVIEW';
  styleCell(overviewLabel, { font: FONTS.label, align: 'left' });
  sheet.getRow(4).height = 16;

  const metricTiles: Array<{ title: string; value: number; isCurrency?: boolean }> = [
    { title: 'Total Bill', value: totalBill, isCurrency: true },
    { title: 'People', value: people.length },
    { title: 'Largest Share', value: largestShare, isCurrency: true },
    { title: 'Smallest Share', value: smallestShare, isCurrency: true },
    { title: 'Unassigned Items', value: unassignedItems }
  ];

  for (let index = 0; index < metricTiles.length; index += 1) {
    const column = index + 1;
    const headerCell = sheet.getCell(5, column);
    headerCell.value = metricTiles[index].title;
    styleCell(headerCell, {
      font: FONTS.subhead,
      fill: COLORS.navyMid,
      align: 'center',
      border: true
    });

    const valueCell = sheet.getCell(6, column);
    valueCell.value = metricTiles[index].value;
    styleCell(valueCell, {
      font: { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF92400E' } },
      fill: COLORS.amberLight,
      align: 'center',
      border: true,
      numFmt: metricTiles[index].isCurrency ? INR_NUM_FMT : undefined
    });

    const paddingCell = sheet.getCell(7, column);
    styleCell(paddingCell, { fill: COLORS.amberLight, border: true });
  }
  sheet.getRow(5).height = 18;
  sheet.getRow(6).height = 30;
  sheet.getRow(7).height = 10;
  sheet.getRow(8).height = 8;

  const personSectionLabel = sheet.getCell('A9');
  personSectionLabel.value = 'PER PERSON SUMMARY';
  styleCell(personSectionLabel, { font: FONTS.label, align: 'left' });

  const summaryHeaders = ['Person', 'Items Shared', 'Total Share (₹)', 'Paid Upfront (₹)', 'Net Balance (₹)'];
  for (let index = 0; index < summaryHeaders.length; index += 1) {
    const cell = sheet.getCell(10, index + 1);
    cell.value = summaryHeaders[index];
    styleCell(cell, {
      font: FONTS.subhead,
      fill: COLORS.navy,
      align: 'center',
      border: true
    });
    cell.border = {
      ...cell.border,
      bottom: { style: 'thin', color: { argb: toArgb(COLORS.white) } }
    };
  }
  sheet.getRow(10).height = 22;

  const personStartRow = 11;
  for (let index = 0; index < people.length; index += 1) {
    const rowNumber = personStartRow + index;
    const person = people[index];
    const rowFill = index % 2 === 0 ? COLORS.white : COLORS.canvas;
    const colors = getPersonColor(person, index);
    const itemsShared =
      typeof person.itemsShared === 'number'
        ? person.itemsShared
        : items.filter((item) => (item.qtyMap?.[person.id] ?? 0) > 0).length;
    const netToSettle = computePersonNet(person);

    const personCell = sheet.getCell(rowNumber, 1);
    personCell.value = `${person.initials || toInitials(person.name)}  ${person.name}`;
    styleCell(personCell, {
      font: { ...FONTS.bodyBold, color: { argb: toArgb(colors.dark) } },
      fill: colors.light,
      align: 'left',
      border: true,
      indent: 1
    });

    const itemsSharedCell = sheet.getCell(rowNumber, 2);
    itemsSharedCell.value = itemsShared;
    styleCell(itemsSharedCell, { font: FONTS.body, fill: rowFill, align: 'center', border: true });

    const totalShareCell = sheet.getCell(rowNumber, 3);
    totalShareCell.value = person.totalShare;
    styleCell(totalShareCell, {
      font: FONTS.body,
      fill: rowFill,
      align: 'right',
      border: true,
      numFmt: INR_NUM_FMT
    });

    const paidCell = sheet.getCell(rowNumber, 4);
    paidCell.value = person.paidUpfront;
    styleCell(paidCell, { font: FONTS.body, fill: rowFill, align: 'right', border: true, numFmt: INR_NUM_FMT });

    const netCell = sheet.getCell(rowNumber, 5);
    netCell.value = netToSettle;
    if (netToSettle > 0.0001) {
      styleCell(netCell, { font: FONTS.red, fill: COLORS.redLight, align: 'right', border: true, numFmt: INR_NUM_FMT });
    } else if (netToSettle < -0.0001) {
      styleCell(netCell, { font: FONTS.green, fill: COLORS.greenLight, align: 'right', border: true, numFmt: INR_NUM_FMT });
    } else {
      styleCell(netCell, { font: FONTS.body, fill: rowFill, align: 'right', border: true, numFmt: INR_NUM_FMT });
    }

    sheet.getRow(rowNumber).height = 20;
  }

  const totalsRow = personStartRow + people.length;
  for (let column = 1; column <= 5; column += 1) {
    const cell = sheet.getCell(totalsRow, column);
    if (column === 1) cell.value = 'TOTAL';
    if (column === 2) cell.value = { formula: `SUM(B${personStartRow}:B${totalsRow - 1})` };
    if (column === 3) cell.value = { formula: `SUM(C${personStartRow}:C${totalsRow - 1})` };
    if (column === 4) cell.value = { formula: `SUM(D${personStartRow}:D${totalsRow - 1})` };
    if (column === 5) cell.value = { formula: `SUM(E${personStartRow}:E${totalsRow - 1})` };
    styleCell(cell, {
      font: FONTS.amberBold,
      fill: COLORS.amber,
      align: column === 1 ? 'left' : 'right',
      border: true,
      numFmt: column >= 3 ? INR_NUM_FMT : undefined
    });
    cell.border = {
      ...cell.border,
      top: { style: 'medium', color: { argb: toArgb(COLORS.navyMid) } }
    };
  }
  sheet.getRow(totalsRow).height = 22;

  const taxStartRow = totalsRow + 2;
  const discountAmount = Number(((baseTotal * taxConfig.discountPct) / 100).toFixed(2));
  const discountedBase = Number((baseTotal - discountAmount).toFixed(2));
  const gstAmount = Number(((discountedBase * taxConfig.gstPct) / 100).toFixed(2));
  const finalTotal = totalBill > 0 ? totalBill : Number((baseTotal * taxConfig.multiplier).toFixed(2));
  const taxRows: Array<{ label: string; value: number }> = [
    { label: 'Base Total', value: baseTotal },
    { label: `Discount Applied (${taxConfig.discountPct}%)`, value: -discountAmount },
    { label: `GST Added (${taxConfig.gstPct}%)`, value: gstAmount },
    { label: 'Final Total', value: finalTotal }
  ];

  for (let index = 0; index < taxRows.length; index += 1) {
    const rowNumber = taxStartRow + index;
    const labelCell = sheet.getCell(rowNumber, 1);
    const valueCell = sheet.getCell(rowNumber, 2);

    labelCell.value = taxRows[index].label;
    styleCell(labelCell, {
      font: FONTS.body,
      fill: COLORS.canvas,
      align: 'left',
      border: true
    });

    valueCell.value = taxRows[index].value;
    styleCell(valueCell, {
      font: FONTS.amberBold,
      fill: COLORS.white,
      align: 'right',
      border: true,
      numFmt: INR_NUM_FMT
    });
  }
}

function buildItemBreakdownSheet(
  workbook: ExcelJS.Workbook,
  items: Item[],
  people: Person[],
  taxConfig: TaxConfig
) {
  const personColumns = people.length;
  const totalColumns = 6 + personColumns;
  const sheet = workbook.addWorksheet('Item Breakdown', { views: [{ showGridLines: false }] });

  sheet.columns = [
    { width: 4 },
    { width: 28 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    ...new Array(personColumns).fill(null).map(() => ({ width: 12 })),
    { width: 14 }
  ];

  const lastColumnLetter = columnLetter(totalColumns);
  sheet.mergeCells(`A1:${lastColumnLetter}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Item Breakdown — Who Ate What';
  styleCell(titleCell, {
    font: { name: 'Calibri', size: 16, bold: true, color: { argb: toArgb(COLORS.white) } },
    fill: COLORS.navy,
    align: 'left',
    border: true,
    indent: 1
  });
  sheet.getRow(1).height = 32;
  sheet.getRow(2).height = 8;

  const headers = ['#', 'Item', 'Category', 'Base ₹', 'Final ₹', ...people.map((person) => person.name), 'Unassigned'];
  for (let index = 0; index < headers.length; index += 1) {
    const cell = sheet.getCell(3, index + 1);
    cell.value = headers[index];

    if (index >= 5 && index < 5 + personColumns) {
      const personIndex = index - 5;
      const colors = getPersonColor(people[personIndex], personIndex);
      styleCell(cell, {
        font: { ...FONTS.subhead, color: { argb: toArgb(COLORS.white) } },
        fill: colors.dark,
        align: 'center',
        border: true
      });
    } else {
      styleCell(cell, { font: FONTS.subhead, fill: COLORS.navy, align: 'center', border: true });
    }
  }
  sheet.getRow(3).height = 22;

  const itemStartRow = 4;
  for (let index = 0; index < items.length; index += 1) {
    const rowNumber = itemStartRow + index;
    const item = items[index];
    const rowFill = index % 2 === 0 ? COLORS.white : COLORS.canvas;
    const totalShares = getItemTotalShares(item);
    const taxStyle = TAX_CATEGORY_STYLES[item.taxCategory?.toLowerCase() ?? 'food'] ?? TAX_CATEGORY_STYLES.food;

    const indexCell = sheet.getCell(rowNumber, 1);
    indexCell.value = index + 1;
    styleCell(indexCell, {
      font: { ...FONTS.body, color: { argb: toArgb(COLORS.muted) } },
      fill: rowFill,
      align: 'center',
      border: true
    });

    const nameCell = sheet.getCell(rowNumber, 2);
    nameCell.value = item.name;
    styleCell(nameCell, { font: FONTS.bodyBold, fill: rowFill, align: 'left', border: true });

    const categoryCell = sheet.getCell(rowNumber, 3);
    categoryCell.value = taxStyle.label;
    styleCell(categoryCell, {
      font: { ...FONTS.bodyBold, color: { argb: toArgb(taxStyle.font) } },
      fill: taxStyle.fill,
      align: 'center',
      border: true
    });

    const baseCell = sheet.getCell(rowNumber, 4);
    baseCell.value = item.basePrice;
    styleCell(baseCell, { font: FONTS.body, fill: rowFill, align: 'right', border: true, numFmt: INR_NUM_FMT });

    const finalCell = sheet.getCell(rowNumber, 5);
    finalCell.value = item.finalPrice;
    styleCell(finalCell, { font: FONTS.bodyBold, fill: rowFill, align: 'right', border: true, numFmt: INR_NUM_FMT });

    for (let personIndex = 0; personIndex < people.length; personIndex += 1) {
      const person = people[personIndex];
      const column = 6 + personIndex;
      const cell = sheet.getCell(rowNumber, column);
      const shareAmount = getItemShareAmount(item, person.id);

      if (shareAmount === null) {
        cell.value = '';
        styleCell(cell, { font: FONTS.body, fill: COLORS.canvas, align: 'right', border: true });
      } else {
        const colors = getPersonColor(person, personIndex);
        cell.value = shareAmount;
        styleCell(cell, {
          font: FONTS.body,
          fill: colors.light,
          align: 'right',
          border: true,
          numFmt: INR_NUM_FMT
        });
      }
    }

    const unassignedColumn = 6 + people.length;
    const unassignedCell = sheet.getCell(rowNumber, unassignedColumn);
    if (totalShares === 0) {
      unassignedCell.value = item.finalPrice;
      styleCell(unassignedCell, {
        font: FONTS.amberBold,
        fill: COLORS.amber,
        align: 'right',
        border: true,
        numFmt: INR_NUM_FMT
      });
    } else {
      unassignedCell.value = '';
      styleCell(unassignedCell, { font: FONTS.body, fill: rowFill, align: 'right', border: true });
    }

    sheet.getRow(rowNumber).height = 19;
  }

  const lastItemRow = itemStartRow + Math.max(items.length - 1, 0);
  const subtotalRow = itemStartRow + items.length;
  for (let column = 1; column <= totalColumns; column += 1) {
    const cell = sheet.getCell(subtotalRow, column);
    if (column === 2) cell.value = 'Subtotal';
    if (column === 4) cell.value = { formula: `SUM(D${itemStartRow}:D${lastItemRow})` };
    if (column === 5) cell.value = { formula: `SUM(E${itemStartRow}:E${lastItemRow})` };
    if (column >= 6) {
      const col = columnLetter(column);
      cell.value = { formula: `SUM(${col}${itemStartRow}:${col}${lastItemRow})` };
    }
    styleCell(cell, {
      font: FONTS.amberBold,
      fill: COLORS.amberLight,
      align: column === 2 ? 'left' : 'right',
      border: true,
      numFmt: column >= 4 ? INR_NUM_FMT : undefined
    });
  }

  const discountRow = subtotalRow + 1;
  const gstRow = subtotalRow + 2;
  const finalRow = subtotalRow + 3;
  const discountRatio = taxConfig.discountPct / 100;
  const gstRatio = taxConfig.gstPct / 100;

  sheet.getCell(discountRow, 2).value = `Discount (${taxConfig.discountPct}%)`;
  sheet.getCell(discountRow, 5).value = { formula: `-D${subtotalRow}*${discountRatio}` };
  sheet.getCell(gstRow, 2).value = `GST (${taxConfig.gstPct}%)`;
  sheet.getCell(gstRow, 5).value = { formula: `(D${subtotalRow}+E${discountRow})*${gstRatio}` };
  sheet.getCell(finalRow, 2).value = 'Final Total';
  sheet.getCell(finalRow, 5).value = { formula: `D${subtotalRow}+E${discountRow}+E${gstRow}` };

  for (const rowNumber of [discountRow, gstRow, finalRow]) {
    for (let column = 2; column <= 5; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      styleCell(cell, {
        font: rowNumber === finalRow ? FONTS.amberBold : FONTS.bodyBold,
        fill: rowNumber === finalRow ? COLORS.amber : COLORS.white,
        align: column === 2 ? 'left' : 'right',
        border: true,
        numFmt: column === 5 ? INR_NUM_FMT : undefined
      });
    }
  }
}

function buildSettlementSheet(
  workbook: ExcelJS.Workbook,
  people: Person[],
  payer: Person,
  room: Room,
  generatedAt: Date
) {
  const sheet = workbook.addWorksheet('Settlement', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 40 }];

  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Settlement — Who Pays Whom';
  styleCell(titleCell, {
    font: { name: 'Calibri', size: 16, bold: true, color: { argb: toArgb(COLORS.white) } },
    fill: COLORS.navy,
    align: 'left',
    border: true,
    indent: 1
  });
  sheet.getRow(1).height = 32;

  const totalBill = room.totalBill ?? Number(people.reduce((sum, person) => sum + person.totalShare, 0).toFixed(2));
  sheet.mergeCells('A3:E3');
  const payerCell = sheet.getCell('A3');
  payerCell.value = `Payer: ${payer.name} paid ₹${totalBill.toFixed(2)} upfront`;
  styleCell(payerCell, {
    font: FONTS.amberBold,
    fill: COLORS.amberLight,
    align: 'left',
    border: true,
    indent: 1
  });
  sheet.getRow(3).height = 24;

  const headers = ['Person', 'Owes / Gets', 'Amount (₹)', 'Status', 'UPI Payment Link'];
  for (let index = 0; index < headers.length; index += 1) {
    const cell = sheet.getCell(5, index + 1);
    cell.value = headers[index];
    styleCell(cell, { font: FONTS.subhead, fill: COLORS.navy, align: 'center', border: true });
  }

  const payerNameEncoded = encodeURIComponent(payer.name);
  const rows = people.filter((person) => person.id !== payer.id);
  let totalToSettle = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = 6 + index;
    const person = rows[index];
    const net = computePersonNet(person);
    const owesAmount = Math.max(net, 0);
    const getsAmount = Math.max(-net, 0);
    const amount = owesAmount > 0 ? owesAmount : getsAmount;
    const isSettled = Boolean(person.isSettled);
    const owesText = owesAmount > 0 ? `Owes ${payer.name}` : getsAmount > 0 ? 'Gets back' : 'Settled';
    if (owesAmount > 0) totalToSettle += owesAmount;

    const personCell = sheet.getCell(rowNumber, 1);
    personCell.value = person.name;
    styleCell(personCell, { font: FONTS.bodyBold, fill: COLORS.white, align: 'left', border: true });

    const owesCell = sheet.getCell(rowNumber, 2);
    owesCell.value = owesText;
    styleCell(owesCell, { font: FONTS.body, fill: COLORS.white, align: 'left', border: true });

    const amountCell = sheet.getCell(rowNumber, 3);
    amountCell.value = amount;
    if (owesAmount > 0) {
      styleCell(amountCell, { font: FONTS.red, fill: COLORS.redLight, align: 'right', border: true, numFmt: INR_NUM_FMT });
    } else if (getsAmount > 0) {
      styleCell(amountCell, {
        font: FONTS.green,
        fill: COLORS.greenLight,
        align: 'right',
        border: true,
        numFmt: INR_NUM_FMT
      });
    } else {
      styleCell(amountCell, { font: FONTS.body, fill: COLORS.white, align: 'right', border: true, numFmt: INR_NUM_FMT });
    }

    const statusCell = sheet.getCell(rowNumber, 4);
    statusCell.value = isSettled ? 'Settled' : 'Pending';
    styleCell(statusCell, {
      font: isSettled ? FONTS.green : FONTS.amberBold,
      fill: isSettled ? COLORS.greenLight : COLORS.amberLight,
      align: 'center',
      border: true
    });

    const upiCell = sheet.getCell(rowNumber, 5);
    if (owesAmount > 0 && payer.upiId) {
      const upiLink = `upi://pay?pa=${encodeURIComponent(payer.upiId)}&pn=${payerNameEncoded}&am=${owesAmount.toFixed(2)}&cu=INR`;
      upiCell.value = { text: `Pay ₹${owesAmount.toFixed(2)}`, hyperlink: upiLink };
      upiCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF2563EB' }, underline: true };
      upiCell.alignment = { horizontal: 'left', vertical: 'middle' };
      upiCell.border = {
        top: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
        bottom: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
        left: { style: 'thin', color: { argb: toArgb(COLORS.border) } },
        right: { style: 'thin', color: { argb: toArgb(COLORS.border) } }
      };
    } else {
      upiCell.value = '';
      styleCell(upiCell, { font: FONTS.body, fill: COLORS.white, align: 'left', border: true });
    }
  }

  const summaryRow = 6 + rows.length + 1;
  sheet.mergeCells(`A${summaryRow}:E${summaryRow}`);
  const totalSettleCell = sheet.getCell(`A${summaryRow}`);
  totalSettleCell.value = `Total to settle: ₹${totalToSettle.toFixed(2)}`;
  styleCell(totalSettleCell, {
    font: FONTS.amberBold,
    fill: COLORS.amberLight,
    align: 'left',
    border: true,
    indent: 1
  });

  const owesLines = rows
    .map((person) => {
      const net = computePersonNet(person);
      const owesAmount = Math.max(net, 0);
      if (owesAmount <= 0) return null;
      return `${person.name}: owes ₹${owesAmount.toFixed(2)} to ${payer.name}`;
    })
    .filter((line): line is string => Boolean(line));

  const blockStart = summaryRow + 2;
  const messageLines = [
    'WhatsApp Summary (copy-paste ready)',
    `🧾 BillWizard Settlement — ${room.name}`,
    `📅 ${formatDisplayDate(generatedAt)}`,
    '',
    ...(owesLines.length > 0 ? owesLines : ['All members are settled.']),
    '',
    `💳 Pay via UPI: ${payer.upiId ?? 'Not set'}`,
    `🔗 Split link: ${room.url ?? ''}`
  ];

  for (let index = 0; index < messageLines.length; index += 1) {
    const rowNumber = blockStart + index;
    sheet.mergeCells(`A${rowNumber}:E${rowNumber}`);
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.value = messageLines[index];
    styleCell(cell, {
      font: index === 0 ? FONTS.bodyBold : FONTS.mono,
      fill: COLORS.canvas,
      align: 'left',
      border: true,
      wrapText: true,
      indent: 1
    });
    sheet.getRow(rowNumber).height = index === 0 ? 20 : 18;
  }
}

function buildRawDataSheet(workbook: ExcelJS.Workbook, items: Item[], people: Person[]) {
  const sheet = workbook.addWorksheet('Raw Data');

  const itemHeaders = ['id', 'name', 'base_price', 'final_price', 'tax_category', 'multiplier', 'qty_map', 'created_at'];
  const itemHeaderRow = sheet.getRow(1);
  itemHeaderRow.values = itemHeaders;
  itemHeaderRow.font = { name: 'Calibri', size: 10, bold: true };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const row = sheet.getRow(2 + index);
    row.values = [
      item.id,
      item.name,
      item.basePrice,
      item.finalPrice,
      item.taxCategory ?? '',
      item.multiplier ?? 1,
      JSON.stringify(item.qtyMap ?? {}),
      item.createdAt ?? ''
    ];
    row.font = { name: 'Calibri', size: 10 };
  }

  const secondTableStart = items.length + 5;
  const peopleHeaders = ['person_id', 'person_name', 'total_share', 'paid_upfront', 'net_balance'];
  const peopleHeaderRow = sheet.getRow(secondTableStart);
  peopleHeaderRow.values = peopleHeaders;
  peopleHeaderRow.font = { name: 'Calibri', size: 10, bold: true };

  for (let index = 0; index < people.length; index += 1) {
    const person = people[index];
    const row = sheet.getRow(secondTableStart + 1 + index);
    row.values = [person.id, person.name, person.totalShare, person.paidUpfront, computePersonNet(person)];
    row.font = { name: 'Calibri', size: 10 };
  }

  sheet.columns = [{ width: 18 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 40 }, { width: 24 }];
}

function sanitizeFilePart(value: string) {
  const cleaned = value.trim().replace(/[\\/:*?"<>|]+/g, '_');
  return cleaned || 'Trip';
}

export async function exportToExcel(
  room: Room,
  items: Item[],
  people: Person[],
  payer: Person,
  taxConfig: TaxConfig
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date();

  workbook.creator = 'BillWizard';
  workbook.created = generatedAt;

  buildSummarySheet(workbook, room, items, people, taxConfig, generatedAt);
  buildItemBreakdownSheet(workbook, items, people, taxConfig);
  buildSettlementSheet(workbook, people, payer, room, generatedAt);
  buildRawDataSheet(workbook, items, people);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const fileName = `BillWizard_${sanitizeFilePart(room.name)}_${formatFileDate(generatedAt)}.xlsx`;
  saveAs(blob, fileName);
}
