/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 21:41:30
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, CombatLogEntry, BattleMapData, ReactiveTrigger, Position } from '../../../types/combat';
import { ActiveSpellZone, ScheduledSpellEffect, MovementTriggerDebuff } from '../../../systems/spells/effects';
type RepeatSaveRuntimeTiming = 'turn_end' | 'turn_start' | 'on_damage' | 'on_action' | 'after_forced_movement';
interface UseCombatEngineProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    onCharacterUpdate: (character: CombatCharacter) => void;
    onLogEntry: (entry: CombatLogEntry) => void;
    onMapUpdate?: (mapData: BattleMapData) => void;
    addDamageNumber: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
}
export declare const useCombatEngine: ({ characters, mapData, onCharacterUpdate, onLogEntry, onMapUpdate, addDamageNumber, }: UseCombatEngineProps) => {
    spellZones: ActiveSpellZone[];
    scheduledSpellEffects: ScheduledSpellEffect[];
    movementDebuffs: MovementTriggerDebuff[];
    reactiveTriggers: ReactiveTrigger[];
    addSpellZone: (zone: ActiveSpellZone) => void;
    removeSpellZone: (zoneId: string) => void;
    setSpellZones: import("react").Dispatch<import("react").SetStateAction<ActiveSpellZone[]>>;
    addScheduledSpellEffect: (scheduledEffect: ScheduledSpellEffect) => void;
    removeScheduledSpellEffect: (scheduledEffectId: string) => void;
    setScheduledSpellEffects: import("react").Dispatch<import("react").SetStateAction<ScheduledSpellEffect[]>>;
    addMovementDebuff: (debuff: MovementTriggerDebuff) => void;
    setMovementDebuffs: import("react").Dispatch<import("react").SetStateAction<MovementTriggerDebuff[]>>;
    addReactiveTrigger: (trigger: ReactiveTrigger) => void;
    setReactiveTriggers: import("react").Dispatch<import("react").SetStateAction<ReactiveTrigger[]>>;
    handleDamage: (character: CombatCharacter, amount: number, source: string, damageType?: string) => CombatCharacter;
    processRepeatSaves: (character: CombatCharacter, timing: RepeatSaveRuntimeTiming, actionEffectId?: string) => CombatCharacter;
    processScheduledSpellEffects: (character: CombatCharacter, timing: "turn_start" | "turn_end", currentTurnNumber: number) => CombatCharacter;
    processStartOfTurnEffects: (character: CombatCharacter, currentTurnNumber: number) => CombatCharacter;
    processTileEffects: (character: CombatCharacter, tilePos: Position) => CombatCharacter;
    processEndOfTurnEffects: (character: CombatCharacter, currentTurnNumber: number) => {
        id: string;
        name: string;
        level: number;
        creatureTypes?: string[];
        alignment?: string;
        class: import("../../../types").Class;
        savingThrowProficiencies?: import("../../../types").AbilityScoreName[];
        position: Position;
        stats: import("../../../types").CharacterStats;
        abilities: import("../../../types/combat").Ability[];
        team: "player" | "enemy";
        worldSource?: import("../../../types/combat").WorldforgeCombatantSource;
        currentHP: number;
        maxHP: number;
        critThreshold?: number;
        darkOnesBlessingTempHp?: number;
        deathSaves?: {
            successes: number;
            failures: number;
            isStable?: boolean;
        };
        savePenaltyRiders?: import("../../../types/combat").SavePenaltyRider[];
        hitPointDice?: import("../../../types").HitPointDicePool[];
        initiative: number;
        statusEffects: import("../../../types/combat").StatusEffect[];
        conditions?: import("../../../types/combat").ActiveCondition[];
        spellMemory?: import("../../../types/combat").SpellMemoryEntry[];
        socialAwareness?: import("../../../types/combat").SocialAwarenessEntry[];
        audibleTo?: string[];
        facing?: import("../../../types/combat").Direction;
        actionEconomy: import("../../../types/combat").ActionEconomyState;
        spellbook?: import("../../../types").SpellbookData;
        spellSlots?: import("../../../types").SpellSlots;
        limitedUses?: import("../../../types").LimitedUses;
        concentratingOn?: import("../../../types/combat").ConcentrationState;
        currentRitual?: import("../../../types").RitualState;
        feats?: string[];
        featChoices?: Record<string, import("../../../types").FeatChoice>;
        stateTags?: import("../../../types").StateTag[];
        isSummon?: boolean;
        summonMetadata?: {
            casterId: string;
            spellId: string;
            entityType?: string;
            formName?: string;
            sourceName?: string;
            persistent?: boolean;
            dismissAction?: "action" | "bonus_action" | "free" | "none";
            commandCost?: "action" | "bonus_action" | "free" | "none";
            commandsPerTurn?: number;
            commandsUsedThisTurn?: number;
            initiativePolicy?: "immediate" | "rolled" | "shared";
            followDistance?: number;
            hoverHeight?: number;
            carriedWeightPounds?: number;
            telepathyRange?: number;
            sharedSenses?: boolean;
            sharedSensesCost?: "action" | "bonus_action" | "free" | "none";
            travelDetails?: Record<string, unknown>;
            conditionalEndings?: import("../../../types").ConditionalEnding[];
            lifecycle?: {
                hitPointMaximum?: string;
                repairOnly?: string;
                zeroHpEnding?: string;
                recastEnding?: string;
                spellEnding?: string;
            };
            control?: {
                entityType?: string;
                source?: string;
                allegiance?: string;
                obedience?: string;
                initiative?: string;
                restrictions?: string[];
                destruction?: string;
                bargainingRequired?: boolean;
                noCompulsion?: boolean;
                serviceLimit?: string;
                return?: string;
                bondLimit?: string;
                noCommandBehavior?: string;
            };
            actionPermissions?: {
                canAttack?: boolean;
                canDeliverTouchSpells?: boolean;
                touchDeliveryRangeFeet?: number;
                touchDeliveryCost?: "reaction" | "action" | "bonus_action" | "free" | "none";
                independentInitiative?: boolean;
                obeysCasterCommands?: boolean;
                notes?: string;
            };
            bloodCircle?: {
                center: Position;
                protectedTiles: Position[];
            };
            formTraits?: Array<{
                name: string;
                appliesToForms?: string[];
                opportunityAttackPolicy?: "does_not_provoke_when_flying_out_of_reach" | "normal";
                movementModeRequired?: "fly" | "walk" | "swim" | "climb" | "any";
                notes?: string;
            }>;
            aftermathState?: Record<string, unknown>;
            durationRemaining?: number;
            dismissable?: boolean;
        };
        armorClass?: number;
        baseAC?: number;
        equipment?: import("../../../types/combat").CombatEquipmentState;
        resistances?: import("../../../types").DamageType[];
        vulnerabilities?: import("../../../types").DamageType[];
        immunities?: import("../../../types").DamageType[];
        nonMagicalResistances?: string[];
        nonMagicalImmunities?: string[];
        conditionImmunities?: import("../../../types").ConditionName[];
        tempHP?: number;
        temporaryHitPointSource?: {
            spellId: string;
            spellName: string;
            casterId: string;
        };
        hasMetalArmor?: boolean;
        activeEffects?: import("../../../types/combat").ActiveEffect[];
        riders?: import("../../../types/combat").ActiveRider[];
        damagedThisTurn?: boolean;
        weaponProficiencies?: string[];
        armorProficiencies?: string[];
        modifiers?: {
            advantage: string[];
            disadvantage: string[];
            bonuses: string[];
            baseArmorClass?: number;
            acBonus?: number;
            reachBonus?: number;
            powerfulBuild?: boolean;
            unendingBreath?: boolean;
            languages?: string[];
            skillProficiencies?: string[];
            weaponProficiencies?: string[];
            armorProficiencies?: string[];
            initiativeBonus?: number;
            initiativeProficiency?: boolean;
            ignoreDifficultTerrain?: boolean;
            breathWeapon?: import("../../../types").RacialBreathWeapon;
            savageAttacks?: boolean;
            reactions?: import("../../../types/combat").RacialReaction[];
        };
        featUsageThisTurn?: string[];
        initiativeBonus?: number;
        initiativeProficiency?: boolean;
        ignoreDifficultTerrain?: boolean;
        damageDealt?: unknown[];
        healingDone?: unknown[];
        additionalSavingThrowProficiencies?: import("../../../types").AbilityScoreName[];
    };
    updateRoundBasedEffects: (currentTurnNumber: number) => void;
    expireSavePenaltiesForCaster: (allCharacters: CombatCharacter[], casterId: string, currentTurn: number) => void;
};
export {};
