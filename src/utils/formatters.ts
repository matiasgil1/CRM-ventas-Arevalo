/**
 * Formatting utilities for CRM data
 */

/**
 * Formats any input (Excel serial date number, ISO string, date string, MM/YYYY, YYYY-MM, etc.)
 * into standardized MM-YYYY format (e.g. "05-2026").
 */
export function formatPeriodMMYYYY(val: string | number | Date | undefined | null): string {
  if (val === undefined || val === null) return 'S/P';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return 'S/P';
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${month}-${year}`;
  }

  const str = String(val).trim();
  if (!str || str === 'S/P' || str === '—') return 'S/P';

  // 1. Check if it's an Excel serial date number (e.g., 46174 or "46174")
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const excelNum = parseFloat(str);
    if (excelNum > 10000 && excelNum < 90000) {
      // Excel epoch: Dec 30 1899 (accounting for Excel 1900 leap year bug)
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const jsDate = new Date(excelEpoch.getTime() + excelNum * 86400 * 1000);
      if (!isNaN(jsDate.getTime())) {
        const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
        const year = jsDate.getUTCFullYear();
        return `${month}-${year}`;
      }
    }
  }

  // 2. Check if already MM-YYYY or MM/YYYY (e.g. "05-2026", "5/2026", "05/2026")
  const mmYyyyMatch = str.match(/^([0-9]{1,2})[\/\-]([0-9]{4})$/);
  if (mmYyyyMatch) {
    const month = mmYyyyMatch[1].padStart(2, '0');
    const year = mmYyyyMatch[2];
    const mNum = parseInt(month, 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${month}-${year}`;
    }
  }

  // 3. Check if YYYY-MM or YYYY/MM (e.g. "2026-05", "2026/05")
  const yyyyMmMatch = str.match(/^([0-9]{4})[\/\-]([0-9]{1,2})$/);
  if (yyyyMmMatch) {
    const year = yyyyMmMatch[1];
    const month = yyyyMmMatch[2].padStart(2, '0');
    const mNum = parseInt(month, 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${month}-${year}`;
    }
  }

  // 4. Check if DD/MM/YYYY or DD-MM-YYYY (e.g. "30/05/2026", "1/7/2025")
  const fullDdMmYyyyMatch = str.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/);
  if (fullDdMmYyyyMatch) {
    const month = fullDdMmYyyyMatch[2].padStart(2, '0');
    const year = fullDdMmYyyyMatch[3];
    const mNum = parseInt(month, 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${month}-${year}`;
    }
  }

  // 5. Check if YYYY-MM-DD or YYYY/MM/DD (e.g. "2026-05-30")
  const fullYyyyMmDdMatch = str.match(/^([0-9]{4})[\/\-]([0-9]{1,2})[\/\-]([0-9]{1,2})/);
  if (fullYyyyMmDdMatch) {
    const year = fullYyyyMmDdMatch[1];
    const month = fullYyyyMmDdMatch[2].padStart(2, '0');
    const mNum = parseInt(month, 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${month}-${year}`;
    }
  }

  // 6. Check 6-digit MMYYYY or YYYYMM (e.g. "052026")
  if (/^\d{6}$/.test(str)) {
    const firstTwo = parseInt(str.substring(0, 2), 10);
    if (firstTwo >= 1 && firstTwo <= 12) {
      return `${str.substring(0, 2)}-${str.substring(2, 6)}`;
    }
    const lastTwo = parseInt(str.substring(4, 6), 10);
    if (lastTwo >= 1 && lastTwo <= 12) {
      return `${str.substring(4, 6)}-${str.substring(0, 4)}`;
    }
  }

  // 7. Standard Date fallback
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime()) && str.length >= 6) {
    const month = String(parsedDate.getUTCMonth() + 1).padStart(2, '0');
    const year = parsedDate.getUTCFullYear();
    if (year >= 1990 && year <= 2100) {
      return `${month}-${year}`;
    }
  }

  return str;
}

/**
 * Replaces message template placeholders ({nombre}, {apellido}, {ultimoPeriodoPagado}, {periodo}, {dni}, {vendedor})
 * with formatted values from the lead.
 */
export function formatMessageTemplate(
  template: string,
  lead: {
    nombre?: string;
    apellido?: string;
    ultimoPeriodoPagado?: string;
    dni?: string;
    vendedor?: string;
    vendedorNombre?: string;
  }
): string {
  if (!template) return '';

  const periodoFormatted = formatPeriodMMYYYY(lead.ultimoPeriodoPagado);
  const periodoVal = (!periodoFormatted || periodoFormatted === 'S/P')
    ? (lead.ultimoPeriodoPagado && lead.ultimoPeriodoPagado !== 'S/P' ? lead.ultimoPeriodoPagado : 'S/P')
    : periodoFormatted;

  const nombreVal = (lead.nombre || '').trim();
  const apellidoVal = (lead.apellido || '').trim();
  const dniVal = (lead.dni || '').trim();
  const vendedorVal = (lead.vendedorNombre || lead.vendedor || '').trim();

  let formatted = template
    .replace(/{nombre}/g, nombreVal)
    .replace(/{apellido}/g, apellidoVal)
    .replace(/{ultimoPeriodoPagado}/g, periodoVal)
    .replace(/{periodo}/g, periodoVal)
    .replace(/{dni}/g, dniVal)
    .replace(/{vendedor}/g, vendedorVal);

  // Clean up double spaces or awkward spacing before punctuation when {apellido} or other variable is empty
  formatted = formatted
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();

  return formatted;
}

