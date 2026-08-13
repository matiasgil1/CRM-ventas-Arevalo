import { User } from '../types/crm';

/**
 * Normalizes a string for loose matching (lowercased, accents stripped, trimmed)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '') // remove special punctuation
    .trim();
}

/**
 * Matches a raw seller name/string from Excel against active system users.
 */
export function findMatchingSeller(vendedorRaw: string | undefined | null, users: User[]): User | null {
  if (!vendedorRaw) return null;
  const rawClean = String(vendedorRaw).trim();
  if (!rawClean || rawClean === '—' || rawClean === '-') return null;

  const rawNorm = normalizeString(rawClean);
  if (!rawNorm) return null;

  // Active or approved users preferred
  const availableUsers = users.filter(u => u.status !== 'rejected' && u.status !== 'suspended');

  // 1. Exact match by name (normalized)
  for (const user of availableUsers) {
    if (normalizeString(user.name) === rawNorm) {
      return user;
    }
  }

  // 2. Exact match by email or email prefix (e.g., carlos@arevalo -> carlos)
  for (const user of availableUsers) {
    const userEmail = user.email.toLowerCase();
    const emailPrefix = userEmail.split('@')[0];
    if (userEmail === rawNorm || normalizeString(emailPrefix) === rawNorm) {
      return user;
    }
  }

  // 3. Word token matching
  const rawWords = rawNorm.split(/\s+/).filter(w => w.length > 1);

  let bestMatch: User | null = null;
  let maxMatchedWords = 0;

  for (const user of availableUsers) {
    const userNorm = normalizeString(user.name);
    const userWords = userNorm.split(/\s+/).filter(w => w.length > 1);

    let matchedWords = 0;
    for (const rw of rawWords) {
      if (userWords.some(uw => uw === rw || (rw.length >= 4 && (uw.startsWith(rw) || rw.startsWith(uw))))) {
        matchedWords++;
      }
    }

    if (matchedWords > maxMatchedWords) {
      maxMatchedWords = matchedWords;
      bestMatch = user;
    }
  }

  if (bestMatch && maxMatchedWords >= 1) {
    return bestMatch;
  }

  return null;
}
