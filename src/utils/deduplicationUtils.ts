import { Lead } from '../types/crm';

/**
 * Normalizes DNI: strips dots, dashes, whitespace, and ignores placeholders like "S/D", "SD", "0", "-"
 */
export function normalizeDni(dni?: string | null): string {
  if (!dni) return '';
  const str = String(dni).trim().toUpperCase();
  if (str === 'S/D' || str === 'SD' || str === 'SIN DNI' || str === '0' || str === '-' || str === '—') {
    return '';
  }
  const clean = str.replace(/[^0-9]/g, '');
  return clean.length >= 6 ? clean : '';
}

/**
 * Normalizes phone number to standard national core (e.g. 10 digits for Argentina)
 */
export function normalizePhone(phone?: string | number | null): string {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (!clean || clean.length < 6) return '';

  // Remove leading zeros
  while (clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Remove 549 or 54 country codes if present
  if (clean.startsWith('549') && clean.length >= 12) {
    clean = clean.substring(3);
  } else if (clean.startsWith('54') && clean.length >= 12) {
    clean = clean.substring(2);
  }

  // Remove 15 mobile prefix if inside area code (e.g. 381154883074 -> 3814883074)
  if (clean.length === 11 && clean.substring(2, 4) === '15') {
    clean = clean.substring(0, 2) + clean.substring(4);
  } else if (clean.length === 12 && clean.substring(3, 5) === '15') {
    clean = clean.substring(0, 3) + clean.substring(5);
  }

  return clean;
}

/**
 * Normalizes full name (lowercases, removes accents and extra spacing)
 */
export function normalizeName(nombre?: string | null, apellido?: string | null): string {
  const full = `${nombre || ''} ${apellido || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return full;
}

/**
 * Checks if two leads represent the same physical person/client
 */
export function areLeadsDuplicate(
  a: { id?: string; nombre?: string; apellido?: string; dni?: string; telefono?: string },
  b: { id?: string; nombre?: string; apellido?: string; dni?: string; telefono?: string }
): boolean {
  if (a.id && b.id && a.id === b.id) return true;

  const dniA = normalizeDni(a.dni);
  const dniB = normalizeDni(b.dni);

  // 1. Strict Match by DNI (if both have a valid DNI >= 6 digits)
  if (dniA && dniB) {
    return dniA === dniB;
  }

  const phoneA = normalizePhone(a.telefono);
  const phoneB = normalizePhone(b.telefono);

  // 2. Strict Match by Phone (if both have a valid phone >= 7 digits)
  if (phoneA && phoneB) {
    // Check exact match or sub-suffix match (e.g. 3865595966 vs 595966)
    if (phoneA === phoneB) return true;
    if (phoneA.length >= 8 && phoneB.length >= 8 && (phoneA.endsWith(phoneB) || phoneB.endsWith(phoneA))) {
      return true;
    }
  }

  // 3. Match by Full Name AND (matching phone OR matching DNI if one is missing)
  const nameA = normalizeName(a.nombre, a.apellido);
  const nameB = normalizeName(b.nombre, b.apellido);

  if (nameA && nameB && nameA === nameB) {
    // If names are identical, and either phones match or one phone is missing
    if (phoneA && phoneB) {
      return phoneA === phoneB;
    }
    // If one has phone and other doesn't, or both don't have phone, consider duplicate if name is at least 2 words
    if (nameA.includes(' ') && nameA.length >= 8) {
      return true;
    }
  }

  return false;
}

/**
 * Merges two duplicate leads into a single master canonical lead.
 * Preserves the richest status, assigned seller, latest notes, and combined history.
 */
export function mergeDuplicateLeads(leadA: Lead, leadB: Lead): { master: Lead; duplicateId: string } {
  // Score leadA vs leadB to pick master
  let scoreA = 0;
  let scoreB = 0;

  // Status priority (engaged/closed/rejected > untouched pendiente)
  if (leadA.estado !== 'pendiente') scoreA += 10;
  if (leadB.estado !== 'pendiente') scoreB += 10;
  if (leadA.estado === 'cerrado' || leadA.estado === 'gestion_ventas') scoreA += 15;
  if (leadB.estado === 'cerrado' || leadB.estado === 'gestion_ventas') scoreB += 15;

  // Seller assigned priority
  if (leadA.vendedorId) scoreA += 5;
  if (leadB.vendedorId) scoreB += 5;

  // History & notes length priority
  if (leadA.historial && leadA.historial.length > 1) scoreA += leadA.historial.length;
  if (leadB.historial && leadB.historial.length > 1) scoreB += leadB.historial.length;
  if (leadA.notas) scoreA += 3;
  if (leadB.notas) scoreB += 3;
  if (leadA.observacionRechazo) scoreA += 3;
  if (leadB.observacionRechazo) scoreB += 3;

  // Has valid DNI
  if (normalizeDni(leadA.dni)) scoreA += 4;
  if (normalizeDni(leadB.dni)) scoreB += 4;

  const [primary, secondary] = scoreA >= scoreB ? [leadA, leadB] : [leadB, leadA];

  // Merge fields into master
  const master: Lead = {
    ...primary,
    nombre: primary.nombre || secondary.nombre,
    apellido: primary.apellido || secondary.apellido,
    dni: normalizeDni(primary.dni) ? primary.dni : (secondary.dni || primary.dni),
    telefono: primary.telefono || secondary.telefono,
    ultimoPeriodoPagado: primary.ultimoPeriodoPagado || secondary.ultimoPeriodoPagado,
    campanaId: primary.campanaId || secondary.campanaId,
    campanaNombre: primary.campanaNombre || secondary.campanaNombre,
    vendedorId: primary.vendedorId || secondary.vendedorId,
    vendedorNombre: primary.vendedorNombre || secondary.vendedorNombre,
    fechaAsignacion: primary.fechaAsignacion || secondary.fechaAsignacion,
    motivoCaida: primary.motivoCaida || secondary.motivoCaida,
    observacionRechazo: primary.observacionRechazo || secondary.observacionRechazo,
    notas: [primary.notas, secondary.notas].filter(Boolean).join('\n---\n') || undefined,
    historial: [...(primary.historial || [])]
  };

  // Combine non-duplicate history entries
  const existingHistoryNotes = new Set(master.historial.map(h => `${h.fecha}_${h.nota}`));
  if (secondary.historial) {
    for (const h of secondary.historial) {
      const key = `${h.fecha}_${h.nota}`;
      if (!existingHistoryNotes.has(key)) {
        master.historial.push(h);
        existingHistoryNotes.add(key);
      }
    }
  }

  // Sort history chronologically
  master.historial.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    master,
    duplicateId: secondary.id
  };
}
