/**
 * @file src/utils/combat/xpForChallengeRating.ts
 * Maps a monster's Challenge Rating to its XP value per the 5e Monster Manual /
 * 2024 rules. Replaces the old flat "50 XP per enemy" placeholder so a CR 1/4
 * goblin and a CR 3 ogre are worth appropriately different amounts, and so the
 * pace to level 3 tracks the fights the player actually wins.
 */

/** Standard 5e XP-by-CR table (CR 0 through 30). */
const XP_BY_CR: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '0.125': 25,
  '1/4': 50,
  '0.25': 50,
  '1/2': 100,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

/**
 * XP awarded for defeating a monster of the given Challenge Rating.
 * Accepts the fractional string forms ('1/8', '1/4', '1/2'), decimal forms,
 * or a whole-number CR (string or number). Unknown/malformed CRs yield a small
 * non-zero floor so a defeated foe is never worth literally nothing.
 */
export function xpForChallengeRating(cr: string | number | null | undefined): number {
  if (cr === null || cr === undefined) return 10;
  const key = typeof cr === 'number' ? cr.toString() : cr.trim();
  if (key in XP_BY_CR) return XP_BY_CR[key];

  // Tolerate decimal strings like "0.25" that don't hit the table directly.
  const num = typeof cr === 'number' ? cr : parseFloat(key);
  if (!Number.isNaN(num)) {
    if (num >= 1) {
      const rounded = Math.round(num).toString();
      if (rounded in XP_BY_CR) return XP_BY_CR[rounded];
    }
    // Fractional CRs below 1 map to the nearest fractional band.
    if (num >= 0.5) return XP_BY_CR['1/2'];
    if (num >= 0.25) return XP_BY_CR['1/4'];
    if (num > 0) return XP_BY_CR['1/8'];
    return XP_BY_CR['0'];
  }
  return 10;
}
