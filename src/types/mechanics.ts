import { AbilityScoreName } from './core';
import { DamageType, StatusCondition } from './spells';

// ==========================================
// 🔓 LOCK SYSTEM
// ==========================================

export interface Lock {
  id: string;
  dc: number;             // Difficulty Class to pick
  keyId?: string;         // ID of the item (key) that opens it automatically
  isLocked: boolean;      // Current state

  // Alternatives to picking
  breakDC?: number;       // Strength check to force open
  breakHP?: number;       // Damage required to destroy

  // Trap integration
  isTrapped?: boolean;
  trapId?: string;        // Reference to a Trap definition
}

export interface LockpickResult {
  success: boolean;
  margin: number;         // How much they succeeded/failed by
  triggeredTrap: boolean; // If they failed badly enough to trigger the trap
  details: string;        // Narrative description
}

// ==========================================
// 🪤 TRAP SYSTEM
// ==========================================

export interface Trap {
  id: string;
  name: string;
  description: string;

  // Detection & Disarm
  detectionDC: number;    // Wisdom (Perception) or Intelligence (Investigation) to spot
  disarmDC: number;       // Dexterity (Thieves' Tools) to disarm

  // Mechanics
  triggerCondition: TriggerCondition;
  effect: TrapEffect;

  // State
  isHidden: boolean;      // Can it be seen without a check?
  isActive: boolean;      // Has it been triggered/disarmed?
  resetable: boolean;     // Does it reset after triggering?
}

export type TriggerCondition =
  | 'step'                // Pressure plate / tripwire
  | 'open'                // Opening a door/chest
  | 'interact'            // Touching an object
  | 'timer'               // Time elapsed
  | 'magic';              // Spellcast nearby

export interface TrapEffect {
  type: 'damage' | 'condition' | 'alarm' | 'restrain' | 'teleport';

  // Damage
  damage?: string;      // e.g., "2d6"
  damageType?: DamageType;

  // Conditions
  condition?: StatusCondition;
  durationRounds?: number;

  // Saving Throw
  saveDC?: number;
  saveAbility?: AbilityScoreName; // e.g., 'DEX' for fireball trap, 'CON' for poison
  saveEffect?: 'none' | 'half' | 'negate'; // What happens on save success
}
