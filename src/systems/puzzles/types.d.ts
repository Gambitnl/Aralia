import { AbilityScoreName } from '../../types/core';
export type DamageType = 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';
export interface DiceRoll {
    count: number;
    sides: number;
    bonus: number;
}
export interface StatusCondition {
    name: string;
    duration?: number;
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
    type?: TrapType;
    detectionDC: number;
    disarmDC: number;
    triggerCondition: TriggerCondition;
    effect: TrapEffect;
    resetable: boolean;
    isDisarmed: boolean;
    isTriggered: boolean;
}
export interface Lock {
    id: string;
    dc: number;
    keyId?: string;
    breakDC?: number;
    breakHP?: number;
    currentHP?: number;
    isTrapped?: boolean;
    trap?: Trap;
    isLocked: boolean;
    isBroken: boolean;
}
export interface LockpickResult {
    success: boolean;
    margin: number;
    triggeredTrap: boolean;
    trapEffect?: TrapEffect;
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
    hintDC: number;
    maxAttempts?: number;
    solutionSequence?: string[];
    acceptedAnswers?: string[];
    requiredItems?: string[];
    isSolved: boolean;
    isFailed: boolean;
    currentAttempts: number;
    currentInputSequence: string[];
    onSuccess: {
        unlockId?: string;
        triggerEvent?: string;
        message: string;
    };
    onFailure?: {
        trapId?: string;
        damage?: DiceRoll;
        message: string;
    };
}
export type SizeCategory = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
export interface PressurePlate {
    id: string;
    name: string;
    description: string;
    isHidden: boolean;
    detectionDC: number;
    minSize: SizeCategory;
    triggerWeight?: number;
    isPressed: boolean;
    isJammed: boolean;
    resetBehavior: 'manual' | 'auto_instant' | 'auto_delayed';
    jamDC: number;
    linkedTrapId?: string;
    linkedLockId?: string;
    linkedPuzzleId?: string;
    puzzleSignal?: string;
}
export interface PressurePlateResult {
    triggered: boolean;
    trapEffect?: TrapEffect;
    signalSent?: {
        puzzleId: string;
        signal: string;
    };
    lockUpdate?: {
        lockId: string;
        action: 'unlock' | 'toggle';
    };
    message: string;
}
export interface PressurePlateJamResult {
    success: boolean;
    triggered: boolean;
    message: string;
}
export type SecretDoorState = 'hidden' | 'detected' | 'open' | 'closed';
export interface SecretDoor {
    id: string;
    name: string;
    tileId: string;
    detectionDC: number;
    mechanismDC: number;
    mechanismDescription: string;
    isLocked: boolean;
    linkedLockId?: string;
    state: SecretDoorState;
}
export interface SecretDoorResult {
    success: boolean;
    state: SecretDoorState;
    message: string;
    xpAward?: number;
}
export type MechanismType = 'lever' | 'winch' | 'wheel' | 'button' | 'valve' | 'console';
export type MechanismState = 'active' | 'inactive' | 'locked' | 'jammed' | 'broken';
export interface Mechanism {
    id: string;
    name: string;
    type: MechanismType;
    description: string;
    requiresCheck: boolean;
    checkAbility?: AbilityScoreName;
    checkDC?: number;
    requiredToolId?: string;
    state: MechanismState;
    currentValue?: number;
    targetValue?: number;
    linkedEventId?: string;
    linkedMechanismIds?: string[];
    noiseLevel?: 'silent' | 'quiet' | 'loud' | 'deafening';
}
export interface MechanismOperationResult {
    success: boolean;
    newState: MechanismState;
    message: string;
    triggeredEventId?: string;
    noiseLevel?: 'silent' | 'quiet' | 'loud' | 'deafening';
    damageTaken?: number;
}
export interface ChallengeSkill {
    skillName: AbilityScoreName | string;
    description: string;
    dcModifier?: number;
    maxUses?: number;
    uses: number;
}
export type ChallengeStatus = 'active' | 'success' | 'failure';
export interface SkillChallenge {
    id: string;
    name: string;
    description: string;
    requiredSuccesses: number;
    maxFailures: number;
    baseDC: number;
    availableSkills: ChallengeSkill[];
    allowCreativeSkills: boolean;
    currentSuccesses: number;
    currentFailures: number;
    status: ChallengeStatus;
    log: string[];
    onSuccess: {
        message: string;
        rewards?: {
            xp?: number;
            items?: string[];
        };
    };
    onFailure: {
        message: string;
        consequence?: {
            damage?: DiceRoll;
            condition?: StatusCondition;
        };
    };
}
export interface SkillChallengeResult {
    success: boolean;
    challengeStatus: ChallengeStatus;
    message: string;
    challengeState: SkillChallenge;
}
