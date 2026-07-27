import { AbilityScoreName } from './core';
import { DamageType, StatusCondition } from './spells';
export interface Lock {
    id: string;
    dc: number;
    keyId?: string;
    isLocked: boolean;
    breakDC?: number;
    breakHP?: number;
    isTrapped?: boolean;
    trapId?: string;
}
export interface LockpickResult {
    success: boolean;
    margin: number;
    triggeredTrap: boolean;
    details: string;
}
export interface Trap {
    id: string;
    name: string;
    description: string;
    detectionDC: number;
    disarmDC: number;
    triggerCondition: TriggerCondition;
    effect: TrapEffect;
    isHidden: boolean;
    isActive: boolean;
    resetable: boolean;
}
export type TriggerCondition = 'step' | 'open' | 'interact' | 'timer' | 'magic';
export interface TrapEffect {
    type: 'damage' | 'condition' | 'alarm' | 'restrain' | 'teleport';
    damage?: string;
    damageType?: DamageType;
    condition?: StatusCondition;
    durationRounds?: number;
    saveDC?: number;
    saveAbility?: AbilityScoreName;
    saveEffect?: 'none' | 'half' | 'negate';
}
