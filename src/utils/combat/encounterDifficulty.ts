// DMG-based encounter difficulty calculator.
// Thresholds from the 2014 Dungeon Master's Guide, p. 82.

export type DifficultyTier = 'Easy' | 'Medium' | 'Hard' | 'Deadly';

interface Thresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

// Per-level party XP thresholds (one character at that level).
const THRESHOLDS_BY_LEVEL: Thresholds[] = [
  /* 0  */ { easy: 0,    medium: 0,    hard: 0,    deadly: 0 },
  /* 1  */ { easy: 25,   medium: 50,   hard: 75,   deadly: 100 },
  /* 2  */ { easy: 50,   medium: 100,  hard: 150,  deadly: 200 },
  /* 3  */ { easy: 75,   medium: 150,  hard: 225,  deadly: 400 },
  /* 4  */ { easy: 125,  medium: 250,  hard: 375,  deadly: 500 },
  /* 5  */ { easy: 250,  medium: 500,  hard: 750,  deadly: 1100 },
  /* 6  */ { easy: 300,  medium: 600,  hard: 900,  deadly: 1400 },
  /* 7  */ { easy: 350,  medium: 750,  hard: 1100, deadly: 1700 },
  /* 8  */ { easy: 450,  medium: 900,  hard: 1400, deadly: 2100 },
  /* 9  */ { easy: 550,  medium: 1100, hard: 1600, deadly: 2400 },
  /* 10 */ { easy: 600,  medium: 1200, hard: 1900, deadly: 2800 },
  /* 11 */ { easy: 800,  medium: 1600, hard: 2400, deadly: 3600 },
  /* 12 */ { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  /* 13 */ { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  /* 14 */ { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  /* 15 */ { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  /* 16 */ { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  /* 17 */ { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  /* 18 */ { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  /* 19 */ { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  /* 20 */ { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
];

// CR → XP award (DMG p. 274)
const CR_TO_XP: Record<string, number> = {
  '0':    10,   '1/8': 25,  '1/4': 50,  '1/2': 100,
  '1':    200,  '2':   450, '3':   700, '4':   1100,
  '5':    1800, '6':   2300,'7':   2900,'8':   3900,
  '9':    5000, '10':  5900,'11':  7200,'12':  8400,
  '13':   10000,'14':  11500,'15': 13000,'16': 15000,
  '17':   18000,'18':  20000,'19': 22000,'20': 25000,
  '21':   33000,'22':  41000,'23': 50000,'24': 62000,
  '25':   75000,'26':  90000,'27': 105000,'28': 120000,
  '29':   135000,'30': 155000,
};

// Encounter multipliers based on total monster count (DMG p. 82).
function encounterMultiplier(monsterCount: number): number {
  if (monsterCount === 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6)  return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

export interface DifficultyResult {
  /** Raw XP (sum of individual monster awards). */
  rawXp: number;
  /** Adjusted XP (raw × encounter multiplier). */
  adjustedXp: number;
  /** Encounter multiplier applied. */
  multiplier: number;
  /** Party thresholds (summed across all characters). */
  thresholds: Thresholds;
  /** Difficulty tier: Easy / Medium / Hard / Deadly. */
  tier: DifficultyTier;
}

export interface CombatantForDifficulty {
  cr: string;
  quantity: number;
  crLair?: string;
  xpLair?: number;
  isLair?: boolean;
}

/** Returns the XP award for a single monster of the given CR. */
export function crToXp(cr: string, xpLair?: number): number {
  if (xpLair !== undefined) return xpLair;
  return CR_TO_XP[cr] ?? 0;
}

/**
 * Calculates encounter difficulty against a party of given levels.
 * @param monsters - list of combatants
 * @param partyLevels - one number per character (e.g. [5, 5, 4, 6])
 */
export function calculateDifficulty(
  monsters: CombatantForDifficulty[],
  partyLevels: number[],
): DifficultyResult {
  const partyThresholds: Thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const level of partyLevels) {
    const t = THRESHOLDS_BY_LEVEL[Math.min(level, 20)] ?? THRESHOLDS_BY_LEVEL[1];
    partyThresholds.easy   += t.easy;
    partyThresholds.medium += t.medium;
    partyThresholds.hard   += t.hard;
    partyThresholds.deadly += t.deadly;
  }

  let rawXp = 0;
  let totalMonsters = 0;
  for (const m of monsters) {
    const activeCr = m.isLair && m.crLair ? m.crLair : m.cr;
    const activeXpLair = m.isLair && m.xpLair !== undefined ? m.xpLair : undefined;
    const xp = crToXp(activeCr, activeXpLair);
    rawXp += xp * m.quantity;
    totalMonsters += m.quantity;
  }

  const multiplier = encounterMultiplier(totalMonsters);
  const adjustedXp = Math.round(rawXp * multiplier);

  let tier: DifficultyTier = 'Easy';
  if (adjustedXp >= partyThresholds.deadly) tier = 'Deadly';
  else if (adjustedXp >= partyThresholds.hard)   tier = 'Hard';
  else if (adjustedXp >= partyThresholds.medium)  tier = 'Medium';

  return {
    rawXp,
    adjustedXp,
    multiplier,
    thresholds: partyThresholds,
    tier,
  };
}
