/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:22:00
 * Dependents: commands/effects/ReactiveEffectCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { UtilityEffect } from '@/types/spells';
import { CombatState, Position } from '@/types/combat';
export declare class UtilityCommand extends BaseEffectCommand {
    constructor(effect: UtilityEffect, context: CommandContext);
    execute(state: CombatState): CombatState;
    get description(): string;
    private hasMeaningfulLight;
    private applyMinorIllusion;
    private resolveMinorIllusionMode;
    private resolveEffectExpiryRound;
    private extractKeyedPlayerInput;
    private applyMessageCommunication;
    private createMessageExchange;
    private recordMessageExchange;
    private resolveMessageBlocker;
    private parseMessageInput;
    private extractMessageOption;
    private readMessageBoolean;
    private createLightSources;
    private createLightSource;
    private createDancingLights;
    private resolvePointTarget;
    private resolveObjectTarget;
    private applyObjectRepair;
    private recordObjectRepair;
    private applyObjectAccessChange;
    private resolveObjectAccessOutcome;
    private describeObjectAccessChange;
    private isDancingLightsHumanoidForm;
    private getDancingLightsClusterPositions;
    private getDefaultHitRiderExpiryRound;
    private applyConditionBenefitSuppression;
    private applyMinorUtilityMode;
    private getMinorUtilityCreatedObject;
    private getMinorUtilityExpiryRound;
    private isInstantaneousMinorUtility;
    private applyThaumaturgy;
    private resolveThaumaturgyMode;
    private resolveThaumaturgyPoint;
    private getThaumaturgyCreatedObject;
    private applyThaumaturgyBoomingVoiceStatus;
    private describeThaumaturgyMode;
    private applyShapeWater;
    private resolveShapeWaterMode;
    private resolveShapeWaterTarget;
    private isWaterTile;
    private hasCreatureInShapeWaterCube;
    private describeShapeWaterMode;
    private applyHeldWeaponAugments;
    private applyTruePolymorphObjectCreature;
    private applyTruePolymorphCreatureCreature;
    private applyTruePolymorphCreatureObject;
    private createTruePolymorphCreatureTransformationBase;
    private withTruePolymorphTransformation;
    private getSelectedTruePolymorphCreature;
    private getTruePolymorphMode;
    private getTruePolymorphInputMode;
    private getTruePolymorphInputRecord;
    private getTruePolymorphOptionText;
    private createTruePolymorphCreature;
    private applyMageHandHelper;
    private applySpiritualWeaponForce;
    private applyDruidGroveWard;
    private applyConjureWoodlandBeingsEmanation;
    private applyMansionExtradimensionalSpace;
    private applyMightyFortressStructure;
    private applySpeakWithDeadControl;
    private applySpeakWithPlantsControl;
    private applyBigbysHandForce;
    private applyAwakenTransformation;
    private applyAnimatedObjectCreation;
    private createAnimatedObjectRecord;
    private applyCreateHomunculus;
    private createHomunculusCompanion;
    private applyFindGreaterSteed;
    private applySummonLesserDemons;
    private createSummonedDemon;
    private applySummonGreaterDemon;
    private createSummonGreaterDemon;
    private createSummonGreaterDemonControlStatus;
    private applyInfernalCalling;
    private createCalledDevil;
    private getSummonLesserDemonsInput;
    private getInfernalCallingInput;
    private rollSummonLesserDemonsCount;
    private findOffsetCompanionPosition;
    private isRecord;
    private isPosition;
    private applyDanseMacabre;
    private createDanseMacabreUndead;
    private createDanseMacabreCommandAbility;
    private applyCreateUndead;
    private createCreateUndeadActor;
    private createCreateUndeadCommandAbility;
    private getCreateUndeadTargetCount;
    private applyAnimateDeadReassertion;
    private getDanseMacabreInput;
    private getSummonGreaterDemonInput;
    private getDanseMacabreTargetCount;
    private normalizeDanseMacabreForm;
    private getDanseMacabreFormTraits;
    private formatDanseMacabreBonus;
    private applyGiantInsect;
    private createGiantInsect;
    private resolveGiantInsectForm;
    private getGiantInsectArmorClass;
    private getGiantInsectHitPoints;
    private getGiantInsectMovementSpeeds;
    private getGiantInsectFormTraits;
    private toTitleCase;
    private createFindGreaterSteedMount;
    private ensureFindGreaterSteedDismissAbility;
    private resolveFindGreaterSteedForm;
    private getGreaterSteedHitPoints;
    private getGreaterSteedSpeed;
    private findAdjacentCompanionPosition;
    private resolveAnimatedObjectSize;
    private normalizeAnimatedObjectSize;
    private getAnimatedObjectSizeCost;
    private getAnimateObjectsHitPoints;
    private resolveAnimatedObjectInitiative;
    private resolveAnimatedObjectSlamDamage;
    private resolveAnimatedObjectSlotScaling;
    private applyMagicStoneProjectiles;
    private getSpellcastingAbilityModifier;
    private getEffectExpiryRound;
    private normalizeDamageDice;
    private resolveDamageDiceScaling;
    private findEligibleHeldWeapon;
    private applyZeroHitPointStabilization;
    private createConsumableCreatedObjectAbility;
    private getCreatedObjectExpiresAtRound;
    private getCreatedObjectDuration;
    private toAbilityCost;
    private createSpellCreatedInventoryItems;
    private describeCreatedObjectShelfLife;
    private applyAbilityCheckModifier;
    private getAbilityCheckModifierDurationRounds;
    private applyControlOption;
    private resolveControlOption;
    private addCommandSkipTurnDirective;
    private addCommandGrovelDirective;
    private addCommandMovementDirective;
    private applyTaunt;
    private moveRelative;
    private buildStraightMovementPath;
    private addStatus;
}
export declare function moveMageHandHelper(state: CombatState, helperId: string, nextPosition: Position, options: {
    casterPosition: Position;
}): CombatState;
export declare function endAwakenCharmedRelationship(state: CombatState, awakenedCreatureId: string, options: {
    attitude: string;
    reason: string;
}): CombatState;
export declare function endDruidGroveWard(state: CombatState, wardId: string, reason: string): CombatState;
export declare function expireMansionExtradimensionalSpace(state: CombatState, spaceId: string): CombatState;
export declare function applyMightyFortressSectionDamage(state: CombatState, structureId: string, damage: {
    sectionId: string;
    damageAmount: number;
    damageType: string;
    thicknessInches: number;
}): CombatState;
export declare function advanceMightyFortressPermanence(state: CombatState, structureId: string, position: Position): CombatState;
export declare function crumbleMightyFortress(state: CombatState, structureId: string, reason: string): CombatState;
export declare function recordBigbysHandDamage(state: CombatState, forceId: string, damageAmount: number): CombatState;
export declare function revertAnimatedObject(state: CombatState, animatedObjectId: string, options: {
    reason: string;
    excessDamage?: number;
}): CombatState;
