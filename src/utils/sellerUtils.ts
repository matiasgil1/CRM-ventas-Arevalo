import { User, Lead } from '../types/crm';

/**
 * Normalizes a string for loose matching (lowercased, accents stripped, trimmed)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '') // remove special punctuation
    .trim();
}

/**
 * Determines whether a lead is assigned to a specific user/seller.
 * Admins have permission to see all leads.
 * Regular sellers can ONLY see leads assigned to their user ID, email, assignedSellerName, or name.
 * If user is not approved, they have NO access to any leads.
 */
export function isLeadAssignedToUser(lead: Lead, user: User | null): boolean {
  if (!user) return false;
  if (user.status !== 'approved') return false;
  if (user.role === 'admin') return true;

  // Direct match by ID
  if (lead.vendedorId && lead.vendedorId === user.id) {
    return true;
  }

  // Check Admin-assigned Seller Entity / Profile name
  if (user.assignedSellerName && lead.vendedorNombre) {
    const assignedNorm = normalizeString(user.assignedSellerName);
    const leadVendedorNorm = normalizeString(lead.vendedorNombre);
    if (assignedNorm === leadVendedorNorm) {
      return true;
    }
    // Partial word token match with assigned seller name
    const assignedWords = assignedNorm.split(/\s+/).filter(w => w.length > 2);
    const leadWords = leadVendedorNorm.split(/\s+/).filter(w => w.length > 2);
    if (assignedWords.length > 0 && leadWords.length > 0) {
      const matchCount = assignedWords.filter(w => leadWords.includes(w)).length;
      if (matchCount >= 2 || (assignedWords.length === 1 && matchCount === 1 && leadWords.length === 1)) {
        return true;
      }
    }
  }

  // Loose match by name or email in case vendedorId wasn't set yet during batch import
  if (lead.vendedorNombre) {
    const vNorm = normalizeString(lead.vendedorNombre);
    const uNorm = normalizeString(user.name);
    const emailPrefix = normalizeString(user.email.split('@')[0]);
    const uEmail = normalizeString(user.email);

    if (vNorm === uNorm || vNorm === emailPrefix || vNorm === uEmail) {
      return true;
    }

    // Match first name or words if uniquely identifiable
    const uWords = uNorm.split(/\s+/).filter(w => w.length > 2);
    const vWords = vNorm.split(/\s+/).filter(w => w.length > 2);
    if (uWords.length > 0 && vWords.length > 0) {
      const matchCount = uWords.filter(w => vWords.includes(w)).length;
      if (matchCount >= 2 || (uWords.length === 1 && matchCount === 1 && vWords.length === 1)) {
        return true;
      }
    }
  }

  return false;
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
  const availableUsers = users.filter(u => u.status === 'approved');

  // 1. Direct match by assignedSellerName (if admin linked this seller)
  for (const user of availableUsers) {
    if (user.assignedSellerName && normalizeString(user.assignedSellerName) === rawNorm) {
      return user;
    }
  }

  // 2. Exact match by name (normalized)
  for (const user of availableUsers) {
    if (normalizeString(user.name) === rawNorm) {
      return user;
    }
  }

  // 3. Exact match by email or email prefix (e.g., carlos@arevalo -> carlos)
  for (const user of availableUsers) {
    const userEmail = user.email.toLowerCase();
    const emailPrefix = userEmail.split('@')[0];
    if (userEmail === rawNorm || normalizeString(emailPrefix) === rawNorm) {
      return user;
    }
  }

  // 4. Word token matching
  const rawWords = rawNorm.split(/\s+/).filter(w => w.length > 1);

  let bestMatch: User | null = null;
  let maxMatchedWords = 0;

  for (const user of availableUsers) {
    const targetNames = [user.name, user.assignedSellerName].filter(Boolean) as string[];
    
    for (const nameToTest of targetNames) {
      const userNorm = normalizeString(nameToTest);
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
  }

  if (bestMatch && maxMatchedWords >= 1) {
    return bestMatch;
  }

  return null;
}
