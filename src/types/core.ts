// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/05/2026, 23:32:21
 * Dependents: types/index.ts, types/mechanics.ts, utils/sandbox/quickCharacterGenerator.ts, utils/world/sceneUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Core ability and phase primitives shared across game domains.
 */
export enum GamePhase {
  MAIN_MENU,
  CHARACTER_CREATION,
  PLAYING,
  GAME_OVER,
  BATTLE_MAP_DEMO,
  LOAD_TRANSITION,
  VILLAGE_VIEW,
  COMBAT,
  NOT_FOUND,
  // DESIGN_PREVIEW removed - now a standalone tool at /Aralia/misc/design.html
}

// Core D&D attributes
export type AbilityScoreName =
  | 'Strength'
  | 'Dexterity'
  | 'Constitution'
  | 'Intelligence'
  | 'Wisdom'
  | 'Charisma';

export interface AbilityScores {
  Strength: number;
  Dexterity: number;
  Constitution: number;
  Intelligence: number;
  Wisdom: number;
  Charisma: number;
}

export interface Skill {
  id: string;
  name: string;
  ability: AbilityScoreName;
}

export interface CharacterSenses {
  darkvision: number; // Radius in feet (0 if none)
  blindsight: number;
  tremorsense: number;
  truesight: number;
}

/**
 * Non-walking movement speeds in feet (5e stat block).
 * Walking speed stays on {@link CharacterStats.speed} for existing movement math.
 */
export type ExtraMovementSpeeds = Partial<
  Record<'fly' | 'swim' | 'climb' | 'burrow', number>
>;

export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  baseInitiative: number;
  speed: number; // in feet
  /** Present when the creature has fly/swim/climb/burrow speeds in source data (e.g. 5eTools). */
  extraMovementSpeeds?: ExtraMovementSpeeds;
  cr: string;
  crLair?: string;
  xpLair?: number;
  size?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  alignment?: string; // TODO(preserve-lint): Monster data still carries alignment text; unify with Alignment enum when combat AI needs it.
  creatureTypes?: string[]; // TODO(preserve-lint): legacy monster data annotates taxonomy here; reconcile with creature metadata model.
  senses?: CharacterSenses;
  legendaryActionsPerRound?: number;
  /**
   * Explicit saving throw bonuses extracted from 5eTools `save` field (e.g. `{ dex: "+6", wis: "+7" }`).
   * Keys are lowercase ability names ("str","dex","con","int","wis","cha").
   * When present, these override the engine's computed `abilityMod + proficiencyBonus` formula
   * so that monsters match their published stat block values exactly.
   */
  saveBonuses?: Partial<Record<string, number>>;
}
