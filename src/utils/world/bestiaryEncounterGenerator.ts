// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 00:38:54
 * Dependents: components/Combat/EncounterModal.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/world/bestiaryEncounterGenerator.ts
 *
 * Offline encounter generator that selects creatures entirely from the
 * ingested 5eTools bestiary (MONSTERS_DATA) with no API dependency.
 *
 * CR-spread philosophy:
 *   Rather than filling a budget with identically-priced monsters, this
 *   generator uses D&D encounter templates that mix challenge ratings the
 *   way a real DM would. A "Deadly" threat might be one dragon; a "Medium"
 *   fight might be one caster + two melee flankers + a pack of weaklings.
 *   The DMG encounter multiplier is respected — the generator works in raw
 *   XP but the caller receives the adjusted tier for display.
 */

import type { Monster, TempPartyMember } from '../../types';
import type { MonsterData } from '../../types/ui';
import { MONSTERS_DATA } from '../../data/monsters';
import { XP_THRESHOLDS_BY_LEVEL } from '../../data/dndData';
import { crToXp, calculateDifficulty } from '../combat/encounterDifficulty';
import type { DifficultyTier } from '../combat/encounterDifficulty';
import { SeededRandom } from '../random/seededRandom';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type EncounterDifficultyTarget = 'Easy' | 'Medium' | 'Hard' | 'Deadly';

/** Returns true if the monster has at least one lair action ability. */
export function hasLairActions(monster: MonsterData): boolean {
  return monster.abilities?.some(a => (a as any).cost?.type === 'lair') ?? false;
}

export interface BestiaryEncounterResult {
  monsters: Monster[];
  /** Human-readable label for the chosen structural template. */
  templateLabel: string;
  /** Raw XP sum (before multiplier). */
  rawXp: number;
  /** Adjusted XP (after DMG encounter multiplier). */
  adjustedXp: number;
  /** Resulting difficulty tier against the provided party. */
  tier: DifficultyTier;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Shape determines how many creatures of what tier compose the encounter. */
type TemplateKey = 'solo' | 'elite_minions' | 'pack' | 'ambush';

interface EncounterTemplate {
  key: TemplateKey;
  label: string;
  /**
   * Fractions of the raw budget to allocate to each "slot".
   * 'elite' slots fill once; 'minion' slots repeat until budget exhausted.
   */
  slots: Array<{ role: 'elite' | 'minion'; budgetFraction: number; maxQty: number }>;
}

const TEMPLATES: EncounterTemplate[] = [
  {
    key: 'solo',
    label: 'Solo Threat',
    slots: [{ role: 'elite', budgetFraction: 0.85, maxQty: 1 }],
  },
  {
    key: 'elite_minions',
    label: 'Elite + Minions',
    slots: [
      { role: 'elite',  budgetFraction: 0.55, maxQty: 1 },
      { role: 'minion', budgetFraction: 0.25, maxQty: 3 },
    ],
  },
  {
    key: 'pack',
    label: 'Pack',
    // One minion slot uses nearly the full budget; qty is derived from budget ÷ creature XP.
    slots: [{ role: 'minion', budgetFraction: 0.85, maxQty: 4 }],
  },
  {
    key: 'ambush',
    label: 'Ambush',
    // Two separate elite slots (each a distinct creature) + a wave of minions.
    slots: [
      { role: 'elite',  budgetFraction: 0.35, maxQty: 1 },
      { role: 'elite',  budgetFraction: 0.35, maxQty: 1 },
      { role: 'minion', budgetFraction: 0.15, maxQty: 3 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], rng: SeededRandom | null): T | null {
  if (arr.length === 0) return null;
  const value = (rng ? rng.next() : Math.random()) * arr.length;
  return arr[Math.floor(value)];
}

function shuffleWithRandom<T>(values: T[], rng: SeededRandom | null): T[] {
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const randomValue = (rng ? rng.next() : Math.random()) * (i + 1);
    const j = Math.floor(randomValue);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Returns the raw-XP threshold for one character at a given level and
 * difficulty tier. Accounts for per-encounter multipliers by scaling down
 * the threshold: multiple-monster encounters become effectively harder via
 * the DMG multiplier, so we target a lower raw budget to roughly land in
 * the desired tier.
 *
 * Multiplier estimates: solo×1, 2×1.5, 3-4×2, 4+×2.5
 */
function getRawBudget(
  party: TempPartyMember[],
  difficulty: EncounterDifficultyTarget,
  templateKey: TemplateKey,
): number {
  const key = difficulty.toLowerCase() as 'easy' | 'medium' | 'hard' | 'deadly';

  const rawPartyBudget = party.reduce((sum, member) => {
    const level = Math.max(1, Math.min(20, member.level || 1));
    const thresholds = XP_THRESHOLDS_BY_LEVEL[level] ?? XP_THRESHOLDS_BY_LEVEL[1];
    return sum + (thresholds?.[key] ?? 50);
  }, 0);

  // Scale down to compensate for the DMG encounter multiplier that will apply
  // when the encounter is built (multiple monsters inflate effective difficulty).
  // We cap at 4 monsters, so the actual multiplier never exceeds ×2 (3-6 creatures).
  // Using 1.5 gives a healthy budget that lands near the target tier; the displayed
  // tier after generation shows the real result.
  const multiplierEstimate: Record<TemplateKey, number> = {
    solo: 1.0,
    elite_minions: 1.5,
    pack: 1.5,
    ambush: 1.5,
  };

  return Math.round(rawPartyBudget / multiplierEstimate[templateKey]);
}

/** Normalises a CR string to a numeric value for ordering. */
function crToNum(cr: string): number {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  return parseFloat(cr) || 0;
}

/** Picks monsters whose XP award falls within [minXp, maxXp]. */
function inXpRange(candidates: MonsterData[], minXp: number, maxXp: number): MonsterData[] {
  return candidates.filter(m => {
    const xp = crToXp(m.baseStats.cr);
    return xp >= minXp && xp <= maxXp;
  });
}

/** Flavour descriptions for encounter roles. */
function describe(name: string, qty: number, role: 'elite' | 'minion' | 'solo' | 'pack'): string {
  switch (role) {
    case 'solo':   return `A solitary ${name} — battle-hardened and dangerous.`;
    case 'elite':  return qty > 1
      ? `${qty} ${name}s lead the assault.`
      : `A dominant ${name} drives the attack.`;
    case 'minion': return qty > 1
      ? `${qty} ${name}s press the flanks.`
      : `A ${name} guards the perimeter.`;
    case 'pack':   return qty > 1
      ? `A pack of ${qty} ${name}s hunts in unison.`
      : `A lone ${name} blocks the path.`;
  }
}

// ─── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generates a balanced encounter from the internal 5eTools bestiary.
 *
 * Algorithm:
 *  1. Pick a random structural template (solo / elite+minions / pack / ambush).
 *  2. Calculate a raw XP budget scaled for that template's expected multiplier.
 *  3. For each slot in the template, pick a creature whose CR × qty fits the
 *     allocated budget fraction. Elite slots pick one unique creature; minion
 *     slots fill qty by dividing remaining budget by creature XP.
 *  4. Deduplicate: if a random pick duplicates an existing entry, retry up to
 *     3 times before falling back to stacking qty on the existing entry.
 *  5. Return the result with the real calculated difficulty tier.
 *
 * @param party   Party members used for budget calculation.
 * @param difficulty   Target difficulty tier (Easy / Medium / Hard / Deadly).
 * @returns Encounter result, or null if MONSTERS_DATA is empty.
 */
export interface BestiaryEncounterOptions {
  difficulty?: EncounterDifficultyTarget;
  /** When true, only monsters with lair actions are eligible. */
  lairOnly?: boolean;
  /** Optional deterministic seed for local bestiary output replay. */
  seed?: number;
}

export function generateBestiaryEncounter(
  party: TempPartyMember[],
  difficultyOrOptions: EncounterDifficultyTarget | BestiaryEncounterOptions = 'Medium',
): BestiaryEncounterResult | null {
  const options: BestiaryEncounterOptions =
    typeof difficultyOrOptions === 'string'
      ? { difficulty: difficultyOrOptions }
      : difficultyOrOptions;

  const difficulty = options.difficulty ?? 'Medium';
  const rng = options.seed === undefined ? null : new SeededRandom(options.seed);

  let allMonsters = Object.values(MONSTERS_DATA);
  if (options.lairOnly) allMonsters = allMonsters.filter(hasLairActions);
  if (allMonsters.length === 0) return null;

  // In lair mode, strongly prefer Solo Threat — a lair encounter is almost always
  // one powerful creature in its domain, not a pack. Put solo first, then shuffle the rest.
  const shuffledTemplates = options.lairOnly
    ? [
        TEMPLATES.find(t => t.key === 'solo')!,
        ...shuffleWithRandom([...TEMPLATES.filter(t => t.key !== 'solo')], rng),
      ]
    : shuffleWithRandom([...TEMPLATES], rng);

  for (const template of shuffledTemplates) {
    const budget = getRawBudget(party, difficulty, template.key);
    if (budget <= 0) continue;

    const result = tryBuildEncounter(template, budget, allMonsters, rng);
    if (result && result.monsters.length > 0) {
      const partyLevels = party.map(p => Math.max(1, p.level || 1));
      const diff = calculateDifficulty(
        result.monsters.map(m => ({ cr: m.cr, quantity: m.quantity })),
        partyLevels,
      );

      return {
        monsters: result.monsters,
        templateLabel: template.label,
        rawXp: diff.rawXp,
        adjustedXp: diff.adjustedXp,
        tier: diff.tier,
      };
    }
  }

  // Hard fallback: just pick any single monster that fits
  const cheapest = [...allMonsters].sort((a, b) => crToNum(a.baseStats.cr) - crToNum(b.baseStats.cr));
  const fallback = cheapest[0];
  if (!fallback) return null;

  const partyLevels = party.map(p => Math.max(1, p.level || 1));
  const diff = calculateDifficulty([{ cr: fallback.baseStats.cr, quantity: 1 }], partyLevels);
  return {
    monsters: [{ name: fallback.name, quantity: 1, cr: fallback.baseStats.cr, description: describe(fallback.name, 1, 'solo') }],
    templateLabel: 'Solo Threat',
    rawXp: diff.rawXp,
    adjustedXp: diff.adjustedXp,
    tier: diff.tier,
  };
}

// ─── Template Builder ─────────────────────────────────────────────────────────

interface BuildResult { monsters: Monster[] }

function tryBuildEncounter(
  template: EncounterTemplate,
  budget: number,
  allMonsters: MonsterData[],
  rng: SeededRandom | null,
): BuildResult | null {
  const monsters: Monster[] = [];
  const usedIds = new Set<string>();

  let remainingBudget = budget;

  for (const slot of template.slots) {
    const slotBudget = budget * slot.budgetFraction;

    if (slot.role === 'elite') {
      // Pick one creature whose XP fits the slot budget
      const candidates = inXpRange(allMonsters, slotBudget * 0.35, slotBudget * 1.4)
        .filter(m => !usedIds.has(m.id));

      // Prefer creatures not already in the list; retry up to 3 times
      let picked: MonsterData | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const c = pickRandom(candidates.filter(m => !usedIds.has(m.id)), rng);
        if (c) { picked = c; break; }
      }
      if (!picked) picked = pickRandom(candidates, rng); // allow duplicate type as fallback
      if (!picked) continue;

      const qty = Math.min(slot.maxQty, 1);
      const xp = crToXp(picked.baseStats.cr);

      monsters.push({
        name: picked.name,
        quantity: qty,
        cr: picked.baseStats.cr,
        description: describe(picked.name, qty, template.key === 'solo' ? 'solo' : 'elite'),
      });
      usedIds.add(picked.id);
      remainingBudget -= xp * qty;

    } else {
      // Minion slot: fill qty to spend the slot budget
      const minionBudget = Math.min(slotBudget, remainingBudget);
      if (minionBudget <= 0) continue;

      // Minions must be cheaper than any elite already in the encounter.
      // If no elite exists (e.g. pack template), allow the full XP range so
      // the pack can include decent-CR creatures constrained only by budget.
      const eliteMinXp = monsters.length > 0
        ? Math.min(...monsters.map(m => crToXp(m.cr)))
        : Infinity;
      const minionMaxXp = eliteMinXp === Infinity
        ? minionBudget          // pack: creature XP constrained only by what fits × qty
        : eliteMinXp * 0.65;    // with elites: minions should be meaningfully cheaper
      const minionMinXp = 10; // CR 0 creatures (10 XP each) are the floor

      const candidates = inXpRange(allMonsters, minionMinXp, minionMaxXp)
        .filter(m => !usedIds.has(m.id));
      if (candidates.length === 0) continue;

      const minion = pickRandom(candidates, rng);
      if (!minion) continue;

      const minionXp = crToXp(minion.baseStats.cr);
      if (minionXp <= 0) continue;

      const qty = Math.min(slot.maxQty, Math.max(1, Math.floor(minionBudget / minionXp)));

      // If a pack template is generating, all qty go as one entry
      monsters.push({
        name: minion.name,
        quantity: qty,
        cr: minion.baseStats.cr,
        description: describe(minion.name, qty, template.key === 'pack' ? 'pack' : 'minion'),
      });
      usedIds.add(minion.id);
      remainingBudget -= minionXp * qty;
    }
  }

  return monsters.length > 0 ? { monsters } : null;
}
