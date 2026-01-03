/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/puzzles/types.ts
 * Defines types for Locks, Traps, Puzzles, and Pressure Plates.
 */
// TODO(lint-intent): 'CharacterStats' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { CharacterStats as _CharacterStats } from '../../types/combat';
// TODO(lint-intent): 'Item' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Item as _Item } from '../../types/items';
import { AbilityScoreName } from '../../types/core';

export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force'
  | 'lightning' | 'necrotic' | 'piercing' | 'poison'
  | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export interface DiceRoll {
  count: number;
  sides: number;
  bonus: number;
}

export interface StatusCondition {
  name: string;
  duration?: number; // Rounds
}

export interface TrapEffect {
  damage?: DiceRoll;
  damageType?: DamageType;
  condition?: StatusCondition;
  saveDC?: number;
  saveType?: AbilityScoreName;
  /**
   * Legacy discriminator carried by earlier trap implementations (e.g., teleport/condition/restrain).
   * TODO(lint-preserve): Replace this loose string with a refined union once trap effects are standardized.
   */
  type?: string;
}

export type TriggerCondition = 'touch' | 'proximity' | 'interaction' | 'timer' | 'magic' | 'glyph';

export type TrapType = 'mechanical' | 'magical';

export interface Trap {
  id: string;
  name: string;
  type?: TrapType; // Defaults to 'mechanical' if undefined
  detectionDC: number;  // Perception/Investigation (Mech) or Arcana (Magic)
  disarmDC: number;  // Thieves' tools (Mech) or Arcana (Magic)
  triggerCondition: TriggerCondition;
  effect: TrapEffect;
  resetable: boolean;
  isDisarmed: boolean;
  isTriggered: boolean;
}

export interface Lock {
  id: string;
  dc: number;  // Picking difficulty
  keyId?: string;  // Key that opens it
  breakDC?: number;  // DC to break (Strength)
  breakHP?: number;  // HP to destroy
  currentHP?: number; // Current HP if breakable
  isTrapped?: boolean;
  trap?: Trap; // Embed the trap definition if trapped
  isLocked: boolean;
  isBroken: boolean;
}

export interface LockpickResult {
  success: boolean;
  margin: number;
  triggeredTrap: boolean;
  trapEffect?: TrapEffect; // Only present if triggered
}

export interface BreakResult {
  success: boolean;
  margin: number;
  damageDealt?: number;
  isBroken: boolean;
}

export interface TrapDetectionResult {
  success: boolean;
  margin: number;
  trapDetected: boolean;
}

export interface TrapDisarmResult {
  success: boolean;
  margin: number;
  triggeredTrap: boolean;
  trapEffect?: TrapEffect;
}

// --- PUZZLE SYSTEM ---

export type PuzzleType = 'sequence' | 'combination' | 'riddle' | 'item_placement';

export interface PuzzleResult {
  success: boolean;
  isSolved: boolean;
  isFailed: boolean;
  message: string;
  consequence?: {
    damage?: DiceRoll;
    trapId?: string;
  };
}

export interface Puzzle {
  id: string;
  name: string;
  type: PuzzleType;
  description: string;
  hint?: string;
  hintDC: number; // Intelligence (Investigation) check to get the hint

  // Logic
  maxAttempts?: number; // If defined, puzzle fails permanently after X tries

  // Solutions
  // Sequence: Ordered list of IDs (e.g. ['lever1', 'lever2'])
  solutionSequence?: string[];
  // Riddle: List of accepted text answers (case-insensitive)
  acceptedAnswers?: string[];
  // Item Placement: List of required Item IDs
  requiredItems?: string[];

  // State
  isSolved: boolean;
  isFailed: boolean;
  currentAttempts: number;
  currentInputSequence: string[]; // Tracks user inputs for sequence puzzles

  // Connections
  onSuccess: {
    unlockId?: string; // Unlocks this lock
    triggerEvent?: string;
    message: string;
  };
  onFailure?: {
    trapId?: string; // Trigger this trap
    damage?: DiceRoll; // Or just deal damage
    message: string;
  };
}

// --- PRESSURE PLATE SYSTEM ---

export type SizeCategory = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export interface PressurePlate {
  id: string;
  name: string;
  description: string;

  // Detection
  isHidden: boolean;
  detectionDC: number; // Wisdom (Perception) to spot

  // Trigger Logic
  minSize: SizeCategory; // Minimum creature size to trigger
  triggerWeight?: number; // Optional numeric weight check (future proofing)

  // State
  isPressed: boolean;
  isJammed: boolean; // Disarmed/Stuck safely

  // Mechanics
  resetBehavior: 'manual' | 'auto_instant' | 'auto_delayed';
  jamDC: number; // Thieves Tools / Investigation to jam

  // Effects
  linkedTrapId?: string; // Triggers this trap
  linkedLockId?: string; // Toggles/Unlocks this lock
  linkedPuzzleId?: string; // Sends input to this puzzle
  puzzleSignal?: string; // The input string to send (e.g. "plate_A")
}

export interface PressurePlateResult {
  triggered: boolean;
  trapEffect?: TrapEffect; // If linked to a trap and triggered
  signalSent?: { puzzleId: string; signal: string }; // If linked to a puzzle
  lockUpdate?: { lockId: string; action: 'unlock' | 'toggle' }; // If linked to a lock
  message: string;
}

export interface PressurePlateJamResult {
  success: boolean;
  triggered: boolean; // Did we accidentally step on it/trigger it while jamming?
  message: string;
}

// --- SECRET DOOR SYSTEM ---

export type SecretDoorState = 'hidden' | 'detected' | 'open' | 'closed';

export interface SecretDoor {
  id: string;
  name: string;
  tileId: string; // The wall tile that hides the door

  // Detection
  detectionDC: number; // Perception check to spot seams/drafts

  // Mechanism
  mechanismDC: number; // Investigation check to understand how to open
  mechanismDescription: string; // "A loose brick", "A sconce that pulls down"

  // Security
  isLocked: boolean;
  linkedLockId?: string; // If locked, links to a Lock definition

  // State
  state: SecretDoorState;
}

export interface SecretDoorResult {
  success: boolean;
  state: SecretDoorState;
  message: string;
  xpAward?: number; // Discovery XP
}

// --- MECHANISM SYSTEM ---

export type MechanismType = 'lever' | 'winch' | 'wheel' | 'button' | 'valve' | 'console';
export type MechanismState = 'active' | 'inactive' | 'locked' | 'jammed' | 'broken';

export interface Mechanism {
  id: string;
  name: string;
  type: MechanismType;
  description: string;

  // Operation Requirements
  requiresCheck: boolean;
  checkAbility?: AbilityScoreName; // e.g. 'Strength' for a heavy winch
  checkDC?: number;

  // Tool requirement
  requiredToolId?: string; // e.g. 'crowbar' or 'wrench'

  // Current State
  state: MechanismState;

  // Continuous values (optional)
  currentValue?: number; // 0-100 (e.g., valve openness)
  targetValue?: number;  // Value needed to trigger effect

  // Outcomes
  linkedEventId?: string; // ID of the event triggered when operated
  linkedMechanismIds?: string[]; // Chain reactions

  // Audio/Visual hints
  noiseLevel?: 'silent' | 'quiet' | 'loud' | 'deafening';
}

export interface MechanismOperationResult {
  success: boolean;
  newState: MechanismState;
  message: string;
  triggeredEventId?: string;
  noiseLevel?: 'silent' | 'quiet' | 'loud' | 'deafening';
  damageTaken?: number; // e.g., operating a hot valve
}

// --- SKILL CHALLENGE SYSTEM ---

export interface ChallengeSkill {
  skillName: AbilityScoreName | string; // e.g. 'Athletics', 'Arcana'
  description: string; // "Climb the crumbling wall"
  dcModifier?: number; // e.g. -2 (Easier) or +5 (Harder) relative to baseDC
  maxUses?: number; // Can only use this approach X times
  uses: number;
}

export type ChallengeStatus = 'active' | 'success' | 'failure';

export interface SkillChallenge {
  id: string;
  name: string;
  description: string;

  // Goal
  requiredSuccesses: number;
  maxFailures: number;

  // Mechanics
  baseDC: number;
  availableSkills: ChallengeSkill[]; // Specific approaches allowed
  allowCreativeSkills: boolean; // If true, GM/System can accept other skills at hard DC

  // State
  currentSuccesses: number;
  currentFailures: number;
  status: ChallengeStatus;
  log: string[]; // History of actions taken

  // Outcomes
  onSuccess: {
    message: string;
    rewards?: { xp?: number; items?: string[] };
  };
  onFailure: {
    message: string;
    consequence?: { damage?: DiceRoll; condition?: StatusCondition };
  };
}

export interface SkillChallengeResult {
  success: boolean; // Did the individual roll succeed?
  challengeStatus: ChallengeStatus; // Did the whole challenge end?
  message: string;
  challengeState: SkillChallenge;
}
