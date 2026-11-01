// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 25/10/2026, 02:53:12
 * Dependents: commands/effects/SummoningCommand.ts, components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, data/adapters/runtimeMonsterRegistry.ts, hooks/app/useAppPreferences.ts, hooks/data/useBestiary.ts, services/geminiServiceFallback.ts, systems/combat/worldScenario/worldEncounterCombatants.ts, utils/world/bestiaryEncounterGenerator.ts, utils/world/encounterUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { MonsterData } from '../types/ui';

// ============================================================================
// Monster Data Registry
// ============================================================================
// This file is the single source of truth for all monsters available in the
// game. The combat encounter generator (combatUtils.ts), the AI fallback
// encounter system (geminiServiceFallback.ts), and the bounty hunter crime
// system all pull from MONSTERS_DATA when they need to spawn a creature.
//
// Previously, every monster was hand-written inline in this file with
// hardcoded stats and abilities. Now the data comes from 5etools bestiary
// JSON files via an automated ingestion pipeline:
//
//   vendor/5etools-src/  →  scripts/ingestMonsters.ts  →  monsters.generated.ts
//
// This file re-exports that generated data. If you need to add a manual
// override or a custom monster that doesn't exist in 5etools, you can spread
// additional entries into the MONSTERS_DATA object below.
//
// Called by: constants.ts (re-export), combatUtils.ts, BountyHunterSystem.ts
// Depends on: monsters.generated.ts (auto-generated from 5etools)
// ============================================================================

// The main monster registry. Initially holds only authored custom monsters
// (see the registry note above) so the static dependency chain to
// monsters.generated.ts stays broken during the initial page paint and Main
// Menu phase. Ingested creatures are populated in-place via Object.assign once
// loadMonstersData resolves.
//
// agora-f821.54: the Hoarfrost Wraith is the monster-side source that gives
// the Frozen and Chilled conditions something in the game that applies them.
// Its ability payloads ({type:'status'}) flow through AbilityEffectMapper,
// whose KNOWN_CONDITION_NAMES derives from ConditionType and already accepts
// both names; the mapped STATUS_CONDITION effect then executes through the
// same StatusConditionCommand path every other condition uses.
export const MONSTERS_DATA: Record<string, MonsterData> = {
  hoarfrost_wraith: {
    id: 'hoarfrost_wraith',
    name: 'Hoarfrost Wraith',
    baseStats: {
      strength: 14,
      dexterity: 16,
      constitution: 14,
      intelligence: 8,
      wisdom: 12,
      charisma: 11,
      baseInitiative: 3,
      speed: 30,
      extraMovementSpeeds: { fly: 40 },
      senses: { darkvision: 60, blindsight: 0, tremorsense: 0, truesight: 0 },
      cr: '5',
      size: 'Medium',
      legendaryActionsPerRound: 0,
      creatureTypes: ['Undead'],
      alignment: 'Neutral Evil',
    },
    maxHP: 52,
    hpFormula: '8d8 + 16',
    abilities: [
      {
        id: 'frost_talon',
        name: 'Frost Talon',
        description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (2d6) ice damage, and rime creeps over the wound leaving the target Chilled until it warms (two turn ends).',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        effects: [
          { type: 'damage', dice: '2d6', damageType: 'ice', value: 7 },
          { type: 'status', statusEffect: { id: 'chilled', name: 'Chilled', type: 'debuff', duration: 2 } },
        ],
        icon: '⚔️',
        isProficient: true,
        attackBonus: 5,
      },
      {
        id: 'grip_of_the_frozen_dark',
        name: 'Grip of the Frozen Dark',
        description: 'One creature the wraith can see within 30 feet must succeed on a DC 13 Constitution saving throw or be encased in ice (Frozen). The ice shatters if the target takes damage, and melts after two of the wraith’s turns pass.',
        type: 'utility',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 6,
        effects: [
          { type: 'status', statusEffect: { id: 'frozen', name: 'Frozen', type: 'debuff', duration: 2 } },
        ],
        icon: '❄️',
        isProficient: true,
        saveDC: 13,
        saveAbility: 'Constitution',
      },
    ],
    tags: ['undead', 'cold', 'cave', 'haunt'],
    armorClass: 13,
    armorSource: 'Rime-hardened shade',
    immunities: ['Cold'],
    conditionImmunities: ['exhaustion', 'frozen', 'chilled'],
  },
};

let loadPromise: Promise<Record<string, MonsterData>> | null = null;

/**
 * Dynamically loads the generated monster dataset.
 * Populates MONSTERS_DATA in-place to ensure references remain correct once loaded.
 * 
 * DESIGN DECISION: Mutating MONSTERS_DATA in-place allows synchronous lookups
 * in gameplay code to proceed unchanged once background loading completes.
 */
export function loadMonstersData(): Promise<Record<string, MonsterData>> {
  if (loadPromise) return loadPromise;

  loadPromise = import('./monsters.generated').then(({ INGESTED_MONSTERS }) => {
    Object.assign(MONSTERS_DATA, INGESTED_MONSTERS);
    return MONSTERS_DATA;
  });

  return loadPromise;
}