/**
 * Generates a unique identifier.
 * Uses `crypto.randomUUID()` where available for stronger uniqueness,
 * falling back to a timestamp + random string combination.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (e.g. older browsers/Node)
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}
