// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 11/06/2026, 12:51:57
 * Dependents: components/BattleMap/CombatCharacterInspector.tsx, components/World3D/World3DWrapper.tsx, data/adapters/5eTools/shared.ts, data/adapters/5eTools/spellcastingAdapter.ts, types/index.ts, types/mechanics.ts, utils/character/checkUtils.ts, utils/sandbox/quickCharacterGenerator.ts, utils/world/sceneUtils.ts
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
  /**
   * Reserved ordinal slot — formerly VILLAGE_VIEW, the legacy 2D village screen
   * (TownCanvas), retired in the grid-retirement program (slices 1a/1b). The
   * member is kept as a placeholder so every phase after it keeps its numeric
   * index and existing saves stay index-compatible. Do NOT reuse or reference.
   */
  RESERVED_RETIRED_VILLAGE_VIEW,
  COMBAT,
  NOT_FOUND,
  // DESIGN_PREVIEW removed - now a standalone tool at /Aralia/misc/design.html
  /** 3D world chunk streaming sandbox demo phase added in Plan 2. */
  WORLD3D_DEMO,
  /**
   * Worldforge atlas cartographer demo (docs/projects/worldforge — the
   * ported-FMG native map surface). Appended LAST so existing phase indexes
   * stay save-compatible. URL slug: 'worldforge'.
   */
  WORLDFORGE_DEMO,
  /**
   * Combat messaging system demo phase, added to mount and display the
   * unified combat logging and notification system in action.
   */
  COMBAT_MESSAGING_DEMO,
  /**
   * Spawn-on-land audit harness (?phase=spawnpreview). A dedicated preview mode
   * for the reroll→spawn problem: rerolls worlds and renders the EXACT MapPane
   * marker pipeline (grid↔atlas bridge → Voronoi site) over the real atlas, with
   * a pass/fail readout and a batch iterator, so an ocean spawn is reproducible
   * and visible in isolation. Appended LAST to keep phase indexes save-compatible.
   * URL slug: 'spawnpreview'.
   */
  SPAWN_PREVIEW,
  /**
   * Agent-sim motion preview (?phase=agentsim). Standalone harness for the
   * WF-AGENTSIM street-movement slice: generates a demo burg + roster and renders
   * townsfolk walking between home and work as a clock scrubs the day — a visual
   * sign-off for the sim-LOD motion layer, reachable without a playing session.
   * Appended LAST to keep phase indexes save-compatible. URL slug: 'agentsim'.
   */
  AGENTSIM_PREVIEW,
  /**
   * 3D agent-walking proof (?phase=agentsim3d). Standalone R3F scene rendering the
   * real <GroundAgents> InstancedMesh over a demo town — townsfolk walk the streets
   * as the clock scrubs, reachable without the load-save → Enter-3D → click-cell
   * chain. Appended LAST (save-compatible). URL slug: 'agentsim3d'.
   */
  AGENTSIM_3D_PREVIEW,
  /**
   * Start Point Selection — shown after character creation, before play. The
   * player surveys the generated world and picks a *town* to begin in (the spawn
   * is always a settlement, never wilderness/ocean). Appended LAST to keep phase
   * indexes save-compatible. URL slug: 'startselect'.
   */
  START_POINT_SELECTION,
  /**
   * Living-world town sim preview (?phase=livingworld). Standalone harness that
   * generates a demo town, tags its key NPCs, and ages it N years — rendering the
   * resulting Town Chronicle (births/deaths/inheritance/succession) and current
   * institution-holders. The play-and-eyeball surface for the multi-day sim,
   * reachable without a playing session. Appended LAST (save-index compatible).
   * URL slug: 'livingworld'.
   */
  LIVING_WORLD_PREVIEW,
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
