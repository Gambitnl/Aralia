/**
 * @file combat/state.ts
 * The aggregate combat state shared by command execution and the combat shell.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 24/10/2026, 21:16:06
 * Dependents: None (Orphan)
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Item } from '../items.js';
import type { SpellEffect, TargetFilter } from '../spells.js';
import type { Plane } from '../planes.js';
import type { Position } from './primitives.js';
import type { ReactiveTrigger, LightSource, SpellObjectImpact, SpellObjectRepair, SpellObjectAccessChange, SpellCommunicationExchange, ActiveIllusionEffect, ActiveFireEffect, SpellWeaponEnchantment, ActiveShapeWaterEffect, ActiveThaumaturgyEffect, ActiveMinorUtilityEffect, ActiveSpellHelper, ActiveSpellTargetLockout, ActiveSpellForce, ActiveSpellGuardian, ActiveSpellEmanation, ActiveCommunicationControl, ActiveEnvironmentalControl, ActiveExtradimensionalSpace, ActiveSpellStructure, ActiveSpellWard, ActiveAnimatedObject, ActiveAwakenedCreature, ActiveTruePolymorphTransformation, ActiveMoldEarthSurfaceMark } from './effects.js';
import type { CombatCharacter, PocketedSummon } from './actors.js';
import type { Ability } from './actions.js';
import type { TurnState } from './turn.js';
import type { BattleMapData } from './map.js';
import type { CombatLogEntry } from './log.js';

export interface CombatState {
  isActive: boolean;
  characters: CombatCharacter[];
  /**
   * Live spell zones carried through command execution so damage commands can
   * respect map-based resistance and immunity auras without flattening them
   * into character sheets too early.
   */
  spellZones?: Array<{
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: { shape: string; size: number };
    direction?: Position;
    remainingWallLength?: number;
    originalWallLength?: number;
    endsWhenLengthZero?: boolean;
    effects: SpellEffect[];
    targetingValidTargets?: TargetFilter[];
    /** Runtime frequency tracking retained when commands traverse existing zones. */
    triggeredThisTurn?: Set<string>;
    triggeredEver?: Set<string>;
    expiresAtRound?: number;
    saveDC?: number;
  }>;
  pocketedSummons?: PocketedSummon[];
  turnState: TurnState;
  selectedCharacterId: string | null;
  selectedAbilityId: string | null;
  actionMode: "select" | "move" | "target_ability" | "preview_aoe";
  validTargets: Position[];
  validMoves: Position[];
  aoePreview?: {
    center: Position;
    affectedTiles: Position[];
    ability: Ability;
  };
  combatLog: CombatLogEntry[];
  reactiveTriggers: ReactiveTrigger[];
  activeLightSources: LightSource[]; // Active light sources on the map
  /** Spell effects that resolved against map objects instead of creatures. */
  spellObjectImpacts?: SpellObjectImpact[];
  /** Spell effects that repaired map objects instead of damaging them. */
  spellObjectRepairs?: SpellObjectRepair[];
  /** Spell effects that changed object access, such as Knock or Arcane Lock. */
  spellObjectAccessChanges?: SpellObjectAccessChange[];
  /** Private communication exchanges created by spells such as Message. */
  spellCommunicationExchanges?: SpellCommunicationExchange[];
  /** Active illusion artifacts created by spells such as Minor Illusion. */
  activeIllusionEffects?: ActiveIllusionEffect[];
  /** Spell-created fire hazards and object ignition state. */
  activeFireEffects?: ActiveFireEffect[];
  /** Items created by spell commands that should be persisted to shared inventory. */
  spellCreatedInventoryItems?: Item[];
  /**
   * Hit-gated movement riders created during command execution.
   *
   * Booming Blade is the current pilot: the weapon attack command can only know
   * whether the delayed thunder rider exists after the melee hit is resolved.
   * The combat hook publishes these records into its live movement-debuff list
   * after the command executor returns.
   */
  movementDebuffs?: Array<{
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    effects: SpellEffect[];
    expiresAtRound: number;
    hasTriggered: boolean;
    saveDC?: number;
  }>;
  /**
   * Temporary spell enchantments that belong to an item rather than only to the
   * original caster. Shillelagh uses this bridge so the empowered club or
   * quarterstaff can be handed to another wielder before the broader inventory
   * system owns spell-duration item modifiers directly.
   */
  temporaryWeaponEnchantments?: SpellWeaponEnchantment[];
  /**
   * First-class Shape Water results. These records let combat, exploration,
   * UI, and later cleanup code inspect deterministic water-state mutations
   * instead of relying on generic narration text.
   */
  activeShapeWaterEffects?: ActiveShapeWaterEffect[];
  /**
   * First-class Thaumaturgy results. These records preserve the selected minor
   * wonder, its point of origin, expiry, and mechanical riders such as Booming
   * Voice's Intimidation advantage without asking downstream systems to parse
   * generic combat-log text.
   */
  activeThaumaturgyEffects?: ActiveThaumaturgyEffect[];
  /**
   * First-class harmless utility cantrip outcomes such as Druidcraft omens,
   * Bloom, Elementalism breezes, smoke, mist, and crude elemental shapes.
   */
  activeMinorUtilityEffects?: ActiveMinorUtilityEffect[];
  /** Active non-creature utility helpers created by spells such as Mage Hand. */
  activeSpellHelpers?: ActiveSpellHelper[];
  /** Target-specific spell lockouts that outlive one command execution. */
  activeSpellTargetLockouts?: ActiveSpellTargetLockout[];
  /** Active spell-created force objects such as Spiritual Weapon. */
  activeSpellForces?: ActiveSpellForce[];
  /** Active stationary guardian manifestations such as Guardian of Faith. */
  activeSpellGuardians?: ActiveSpellGuardian[];
  /** Active caster-following emanations such as Conjure Minor Elementals. */
  activeSpellEmanations?: ActiveSpellEmanation[];
  /** Active communication/control interfaces such as Speak with Dead and Speak with Plants. */
  activeCommunicationControls?: ActiveCommunicationControl[];
  /** Active controlled environmental areas such as Wrath of Nature. */
  activeEnvironmentalControls?: ActiveEnvironmentalControl[];
  /** Active extradimensional spaces such as Mordenkainen's Magnificent Mansion. */
  activeExtradimensionalSpaces?: ActiveExtradimensionalSpace[];
  /** Active spell-created structures such as Mighty Fortress. */
  activeSpellStructures?: ActiveSpellStructure[];
  /** Active persistent area wards such as Druid Grove. */
  activeSpellWards?: ActiveSpellWard[];
  /** Active object-to-creature records created by spells such as Tiny Servant and Animate Objects. */
  activeAnimatedObjects?: ActiveAnimatedObject[];
  /** Active Awaken transformation and post-charm relationship records. */
  activeAwakenedCreatures?: ActiveAwakenedCreature[];
  /** Active True Polymorph object-to-creature transformations and control boundaries. */
  activeTruePolymorphTransformations?: ActiveTruePolymorphTransformation[];
  /** Visible Mold Earth words, images, or patterns on dirt or stone. */
  activeMoldEarthSurfaceMarks?: ActiveMoldEarthSurfaceMark[];
  mapData?: BattleMapData;
  currentPlane?: Plane; // NEW: The plane where combat is taking place
}
