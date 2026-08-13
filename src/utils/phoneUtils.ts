/**
 * Phone number and WhatsApp validation utilities
 */

export interface PhoneWhatsAppInfo {
  digits: string;
  displayFormatted: string;
  isValidWhatsApp: boolean;
  statusLabel: 'WA Válido' | 'Fijo (Sin WA)' | 'Sin Teléfono' | 'Inválido';
  whatsappUrl: string | null;
}

export function analyzePhoneWhatsApp(phoneRaw: string | number | undefined | null): PhoneWhatsAppInfo {
  if (!phoneRaw) {
    return {
      digits: '',
      displayFormatted: '—',
      isValidWhatsApp: false,
      statusLabel: 'Sin Teléfono',
      whatsappUrl: null
    };
  }

  let str = String(phoneRaw).trim();
  if (!str || str === '—' || str === '-') {
    return {
      digits: '',
      displayFormatted: '—',
      isValidWhatsApp: false,
      statusLabel: 'Sin Teléfono',
      whatsappUrl: null
    };
  }

  // Clean all non-digit characters
  let clean = str.replace(/\D/g, '');

  if (!clean) {
    return {
      digits: '',
      displayFormatted: str,
      isValidWhatsApp: false,
      statusLabel: 'Sin Teléfono',
      whatsappUrl: null
    };
  }

  // Strip leading zero if 11+ digits (e.g., 0381154883074 -> 381154883074)
  if (clean.length >= 11 && clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // Landline detection: 6, 7, 8 digits (e.g. 4368175 is 7 digits)
  if (clean.length >= 6 && clean.length <= 8) {
    return {
      digits: clean,
      displayFormatted: clean,
      isValidWhatsApp: false,
      statusLabel: 'Fijo (Sin WA)',
      whatsappUrl: null
    };
  }

  // Format international WhatsApp number (Argentina default +549)
  let fullIntl = clean;
  if (clean.startsWith('549')) {
    fullIntl = clean;
  } else if (clean.startsWith('54') && !clean.startsWith('549')) {
    fullIntl = '549' + clean.slice(2);
  } else {
    fullIntl = '549' + clean;
  }

  // Mobile validation: 10 digits standard area+line (e.g. 3814883074) or 12-13 digits with 549
  const isValidWhatsApp = (clean.length === 10) || (clean.startsWith('549') && clean.length >= 12 && clean.length <= 13);

  return {
    digits: clean,
    displayFormatted: clean,
    isValidWhatsApp,
    statusLabel: isValidWhatsApp ? 'WA Válido' : (clean.length < 6 ? 'Sin Teléfono' : 'Inválido'),
    whatsappUrl: isValidWhatsApp ? `https://wa.me/${fullIntl}` : null
  };
}
