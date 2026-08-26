// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: data/adapters/5eTools/index.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Converts the 5eTools `spellcasting` array into Aralia Ability objects.
// Handles three schema variants:
//   will[]          — at-will spells (both MM and XMM)
//   daily.{Ne}      — N/Day limited spells (each or shared pool)
//   spells.{level}  — slot-based prepared spells (MM 2014 format)
// The `displayAs` field (XMM only) maps to ActionCostType; absent means 'action'.

import { Ability, ActionCostType } from '../../../types/combat';
import { AbilityScoreName } from '../../../types/core';
import { Spell } from '../../../types/spells';
import { strip5eToolsMarkup } from './shared';
import { mapSpellToAbilityProperties } from './spellEffectMapper';
import type { FiveEToolsSpellcasting, MonsterSpellSlotPool } from './types';

const ABILITY_MAP: Record<string, AbilityScoreName> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

function displayAsToCostType(displayAs: string | undefined): ActionCostType {
  if (displayAs === 'bonus') return 'bonus';
  if (displayAs === 'reaction') return 'reaction';
  return 'action';
}

function extractSaveDC(headerEntries: string[]): number | undefined {
  const text = headerEntries.join(' ');
  const m = text.match(/\{@dc\s+(\d+)\}|spell save DC\s+(\d+)/i);
  if (!m) return undefined;
  return parseInt(m[1] ?? m[2]);
}

function makeSpellAbility(
  spellRef: string,
  costType: ActionCostType,
  blockDescription: string,
  saveDC: number | undefined,
  saveAbility: AbilityScoreName | undefined,
  idSuffix: string,
  spellLookup?: (name: string) => Spell | undefined,
  slotLevel?: number,
  blockIdx?: number,
): Ability {
  const rawSpellName = strip5eToolsMarkup(spellRef).trim();
  // Strip parenthetical meta-notes (e.g. "(included in AC)", "(level 4 version)") from display name
  const cleaned = rawSpellName.replace(/\s*\([^)]*\)\s*/g, '').trim() || rawSpellName;
  // Title-case: capitalize first letter of every word except minor words mid-string.
  // "inflict wounds" → "Inflict Wounds", "shield of faith" → "Shield of Faith"
  const MINOR_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'by', 'and', 'or', 'but', 'for', 'nor', 'as']);
  const spellName = cleaned
    .split(' ')
    .map((w, i) => (i === 0 || !MINOR_WORDS.has(w.toLowerCase()))
      ? w.charAt(0).toUpperCase() + w.slice(1)
      : w.toLowerCase())
    .join(' ');
  const slug = spellName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const blockPart = blockIdx != null ? `_b${blockIdx}` : '';
  const id = idSuffix ? `${slug}_${idSuffix}${blockPart}` : `${slug}${blockPart}`;

  const baseAbility: Ability = {
    id,
    name: spellName,
    description: blockDescription,
    type: 'spell',
    cost: {
      type: costType,
      ...(slotLevel != null && { spellSlotLevel: slotLevel }),
    },
    targeting: 'single_enemy',
    range: 6,
    effects: [],
    icon: '✨',
    isProficient: true,
    isMagical: true,
    tags: ['spell'],
    ...(saveDC != null && { saveDC }),
    ...(saveAbility && { saveAbility }),
  };

  if (spellLookup) {
    // spellName already has parenthetical notes stripped — use directly for lookup
    const spellData = spellLookup(spellName);
    if (spellData) {
      const enriched = mapSpellToAbilityProperties(spellData);
      // Prefer the spell's own description over the generic spellcasting block header.
      // Append higher-level scaling note if present.
      const spellDescription = spellData.higherLevels
        ? `${spellData.description}\n\nAt Higher Levels: ${spellData.higherLevels}`
        : spellData.description;
      return {
        ...baseAbility,
        // Use the registry's canonical name (e.g. "Cone of Cold" not "Cone Of Cold")
        name: spellData.name || baseAbility.name,
        description: spellDescription || baseAbility.description,
        ...enriched,
        spell: spellData,
      };
    }
  }

  return baseAbility;
}


export function parseSpellcasting(
  spellcastingBlocks: FiveEToolsSpellcasting[] | undefined,
  spellLookup?: (name: string) => Spell | undefined
): Ability[] {
  if (!spellcastingBlocks || !Array.isArray(spellcastingBlocks)) return [];
  const abilities: Ability[] = [];

  for (let blockIdx = 0; blockIdx < spellcastingBlocks.length; blockIdx++) {
    const block = spellcastingBlocks[blockIdx];
    const costType = displayAsToCostType(block.displayAs);
    const saveDC = extractSaveDC(block.headerEntries ?? []);
    const saveAbility = ABILITY_MAP[block.ability ?? ''];
    const description = strip5eToolsMarkup((block.headerEntries ?? []).join(' '));

    // At-will spells — no usage limit
    if (Array.isArray(block.will)) {
      for (const spellRef of block.will) {
        abilities.push(makeSpellAbility(spellRef, costType, description, saveDC, saveAbility, 'will', spellLookup, undefined, blockIdx));
      }
    }

    // Daily-limited spells — key format: "1e"=1/day each, "2e"=2/day each, "1"=1/day shared pool
    if (block.daily && typeof block.daily === 'object') {
      for (const [key, spells] of Object.entries(block.daily)) {
        if (!Array.isArray(spells)) continue;
        const each = key.endsWith('e');
        const count = parseInt(key);
        if (isNaN(count)) continue;
        const usesLabel = `${count}pd${each ? 'e' : ''}`;
        for (const spellRef of spells) {
          const ability = makeSpellAbility(spellRef, costType, description, saveDC, saveAbility, usesLabel, spellLookup, undefined, blockIdx);
          // Annotate name so the combat UI shows the daily limit
          const suffix = `(${count}/Day${each ? ' each' : ''})`;
          ability.name = `${ability.name} ${suffix}`;

          // Set mechanical usage limits
          ability.maxUses = count;
          ability.usesRemaining = count;

          abilities.push(ability);
        }
      }
    }

    // Slot-based prepared spells (MM 2014 format — XMM dropped this).
    // The per-level slot pool these spells draw from is parsed separately by
    // parseMonsterSpellSlots below; the note here is the stat-block display text.
    if (block.spells && typeof block.spells === 'object') {
      for (const [levelStr, levelData] of Object.entries(block.spells)) {
        const level = parseInt(levelStr);
        if (isNaN(level)) continue;
        const spellList: string[] = levelData.spells ?? [];
        const slots = levelData.slots;
        const slotsNote = slots != null ? `(${slots} slot${slots !== 1 ? 's' : ''})` : '';
        for (const spellRef of spellList) {
          const ability = makeSpellAbility(
            spellRef, costType, description, saveDC, saveAbility,
            `l${level}`, spellLookup, level, blockIdx,
          );
          if (slotsNote) {
            // Prepend slot info to the spell's actual description (not the block header).
            ability.description = `${slotsNote} ${ability.description}`.trim();
          }
          abilities.push(ability);
        }
      }
    }
  }

  return abilities;
}

/**
 * Extracts the per-level spell-slot pool a slot-based (prepared) caster monster
 * starts combat with, e.g. a Lich yields { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }.
 *
 * Cantrips are excluded: 5eTools stores them under level "0" with no `slots`
 * key, and they cost no slot to cast.
 *
 * Returns undefined when the creature has no slot-based spellcasting at all —
 * at-will and N/Day casters carry their limits on the abilities themselves.
 *
 * Across bestiary-mm.json and bestiary-xmm.json no creature has more than one
 * slot-bearing spellcasting block, so the max is only a determinism guard.
 */
export function parseMonsterSpellSlots(
  spellcastingBlocks: FiveEToolsSpellcasting[] | undefined,
): MonsterSpellSlotPool | undefined {
  if (!spellcastingBlocks || !Array.isArray(spellcastingBlocks)) return undefined;

  const pool: MonsterSpellSlotPool = {};
  for (const block of spellcastingBlocks) {
    if (!block.spells || typeof block.spells !== 'object') continue;
    for (const [levelStr, levelData] of Object.entries(block.spells)) {
      const level = parseInt(levelStr);
      if (isNaN(level) || level < 1 || level > 9) continue;
      const slots = levelData.slots;
      if (typeof slots !== 'number' || slots <= 0) continue;
      pool[level] = Math.max(pool[level] ?? 0, slots);
    }
  }

  return Object.keys(pool).length > 0 ? pool : undefined;
}

