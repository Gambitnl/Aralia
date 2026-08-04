// Per-spell-category slice of UtilityCommand: minorUtility behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { UtilityCommandObjects } from './objects'
import { isExecutableControlOption } from '@/types/spells'
import type { UtilityEffect, ExecutableControlOption } from '@/types/spells'
import type { Item } from '@/types/items'
import type { CombatState, CombatCharacter, StatusEffect, SelectedSpellTarget, ShapeWaterMode, ThaumaturgyMode, ActiveMinorUtilityEffect } from '@/types/combat'
import { generateId } from '../../../utils/idGenerator'



export abstract class UtilityCommandMinorUtility extends UtilityCommandObjects {
    protected applyConditionBenefitSuppression(
        state: CombatState,
        target: CombatCharacter,
        effect: UtilityEffect
    ): CombatState {
        const liveTarget = state.characters.find(character => character.id === target.id) ?? target
        const suppressedCondition = effect.invisibilitySuppression?.suppressesConditionBenefit
        if (!suppressedCondition) {
            return state
        }

        const statusName = `${this.context.spellName || 'Spell'} ${suppressedCondition} Suppression`
        const status: StatusEffect & { suppressedConditionBenefit?: string } = {
            id: generateId(),
            name: statusName,
            type: 'debuff',
            duration: 1,
            source: this.context.spellName,
            sourceCasterId: this.context.caster.id,
            description: effect.invisibilitySuppression?.description || `${liveTarget.name} cannot benefit from ${suppressedCondition}.`,
            effect: { type: 'condition' },
            suppressedConditionBenefit: suppressedCondition
        }

        const updatedState = this.updateCharacter(state, liveTarget.id, {
            statusEffects: [
                ...(liveTarget.statusEffects || []).filter(existing =>
                    existing.source !== status.source ||
                    existing.sourceCasterId !== status.sourceCasterId ||
                    (existing as any).suppressedConditionBenefit !== status.suppressedConditionBenefit
                ),
                status
            ]
        })

        return this.addLogEntry(updatedState, {
            type: 'status',
            message: `${liveTarget.name} cannot benefit from ${suppressedCondition} while ${this.context.spellName || 'the spell'} glows on them.`,
            characterId: liveTarget.id,
            targetIds: [liveTarget.id],
            data: {
                sourceSpellId: this.context.spellId,
                statusId: status.id,
                suppressedConditionBenefit: suppressedCondition
            }
        })
    }

    protected applyMinorUtilityMode(state: CombatState, effect: UtilityEffect): CombatState {
        const controlOptions = (effect.controlOptions ?? []).filter(isExecutableControlOption)
        const chosen = this.resolveControlOption(controlOptions)
        if (!chosen) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} cannot resolve the selected utility mode "${this.context.playerInput}".`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    rejectedMinorUtilityMode: this.context.playerInput,
                    availableModes: controlOptions.map(option => option.name)
                }
            })
        }

        const createdObject = this.getMinorUtilityCreatedObject(effect, chosen)
        if (!createdObject) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'The spell'} has no structured utility artifact for ${chosen.name}.`,
                characterId: this.context.caster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    missingMinorUtilityMode: chosen.name
                }
            })
        }

        const selectedObject = this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object')
        const currentTurn = state.turnState.currentTurn
        const retainedArtifacts = this.context.spellId === 'prestidigitation'
            ? (state.activeMinorUtilityEffects || []).filter(active =>
                active.spellId !== 'prestidigitation' ||
                !active.expiresAtRound ||
                active.expiresAtRound >= currentTurn
            )
            : (state.activeMinorUtilityEffects || [])

        const expiresAtRound = this.getMinorUtilityExpiryRound(createdObject.shelfLife, currentTurn)
        const isInstantaneous = this.isInstantaneousMinorUtility(createdObject.shelfLife)

        if (this.context.spellId === 'prestidigitation' && !isInstantaneous) {
            const activePrestidigitationEffects = retainedArtifacts.filter(active =>
                active.spellId === 'prestidigitation' &&
                !active.instantaneous
            )

            if (activePrestidigitationEffects.length >= 3) {
                return this.addLogEntry({
                    ...state,
                    activeMinorUtilityEffects: retainedArtifacts
                }, {
                    type: 'status',
                    message: `${this.context.spellName || 'Prestidigitation'} cannot maintain more than three non-instantaneous effects.`,
                    characterId: this.context.caster.id,
                    data: {
                        sourceSpellId: this.context.spellId,
                        rejectedPrestidigitationMode: 'active_effect_cap',
                        rejectedMinorUtilityMode: chosen.name,
                        rejectedReason: 'max_active_non_instantaneous',
                        activeNonInstantaneousCount: activePrestidigitationEffects.length,
                        maxActiveNonInstantaneous: 3
                    }
                })
            }
        }

        const artifact: ActiveMinorUtilityEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'unknown',
            spellName: this.context.spellName,
            casterId: this.context.caster.id,
            mode: chosen.name,
            position: this.resolvePointTarget() ?? selectedObject?.position ?? this.context.caster.position,
            targetObjectId: selectedObject?.id,
            targetObjectName: selectedObject?.name ?? selectedObject?.object?.name,
            createdTurn: currentTurn,
            expiresAtRound,
            instantaneous: isInstantaneous,
            harmless: true,
            createdObject,
            sensorState: effect.sensorState,
            aftermathState: effect.aftermathState
        }

        return this.addLogEntry({
            ...state,
            activeMinorUtilityEffects: [
                ...retainedArtifacts,
                artifact
            ]
        }, {
            type: 'status',
            message: `${this.context.caster.name} creates ${createdObject.name} with ${this.context.spellName || 'a utility spell'}.`,
            characterId: this.context.caster.id,
            data: {
                sourceSpellId: this.context.spellId,
                minorUtilityEffect: artifact
            }
        })
    }

    private getMinorUtilityCreatedObject(
        effect: UtilityEffect,
        chosen: ExecutableControlOption
    ): NonNullable<UtilityEffect['createdObjects']>[number] | undefined {
        const controlIndex = effect.controlOptions?.filter(isExecutableControlOption).findIndex(option => option.name === chosen.name) ?? -1
        return controlIndex >= 0
            ? effect.createdObjects?.[controlIndex]
            : undefined
    }

    private getMinorUtilityExpiryRound(shelfLife: string | undefined, currentTurn: number): number | undefined {
        if (!shelfLife || shelfLife === 'instantaneous') {
            return undefined
        }

        const lowerShelfLife = shelfLife.toLowerCase()
        if (lowerShelfLife.includes('1 round')) {
            return currentTurn + 1
        }
        if (lowerShelfLife.includes('1 minute')) {
            return currentTurn + 10
        }
        if (lowerShelfLife.includes('1 hour')) {
            return currentTurn + 600
        }
        if (lowerShelfLife.includes('until end of next turn')) {
            return currentTurn + 1
        }

        return undefined
    }

    private isInstantaneousMinorUtility(shelfLife: string | undefined): boolean {
        return !shelfLife || shelfLife === 'instantaneous'
    }

    protected applyThaumaturgy(state: CombatState, effect: UtilityEffect): CombatState {
        const mode = this.resolveThaumaturgyMode(effect)
        const point = this.resolveThaumaturgyPoint()
        if (!point) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Thaumaturgy'} needs a point within range.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedThaumaturgyTarget: 'missing_point' }
            })
        }

        const retainedEffects = (state.activeThaumaturgyEffects || []).filter(activeEffect =>
            !activeEffect.expiresAtRound || activeEffect.expiresAtRound >= state.turnState.currentTurn
        )
        const activePersistentCount = retainedEffects.filter(activeEffect =>
            activeEffect.casterId === this.context.caster.id &&
            !activeEffect.instantaneous
        ).length
        const instantaneous = mode === 'invisible_hand' || mode === 'phantom_sound'

        if (!instantaneous && activePersistentCount >= 3) {
            return this.addLogEntry({ ...state, activeThaumaturgyEffects: retainedEffects }, {
                type: 'status',
                message: `${this.context.spellName || 'Thaumaturgy'} already has three active one-minute effects.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedThaumaturgyMode: 'active_effect_cap' }
            })
        }

        const createdObject = this.getThaumaturgyCreatedObject(effect, mode)
        const thaumaturgyEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'thaumaturgy',
            casterId: this.context.caster.id,
            mode,
            position: point.position,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: instantaneous ? state.turnState.currentTurn : state.turnState.currentTurn + 10,
            instantaneous,
            harmless: mode === 'tremors' || mode === 'fire_play' || mode === 'phantom_sound',
            sourceObjectType: createdObject?.objectType,
            targetObjectId: point.objectId,
            targetObjectName: point.objectName,
            appearanceChange: mode === 'altered_eyes' ? 'caster_eyes' : undefined,
            soundEmission: mode === 'booming_voice' || mode === 'phantom_sound' ? createdObject?.notes || createdObject?.name : undefined,
            fireStateChange: mode === 'fire_play' ? createdObject?.manipulationOptions : undefined,
            objectMotion: mode === 'invisible_hand' ? createdObject?.manipulationOptions : undefined,
            groundMotion: mode === 'tremors' ? 'harmless_ground_tremors' : undefined,
            abilityCheckModifier: mode === 'booming_voice' ? effect.abilityCheckModifier : undefined
        }

        let nextState: CombatState = {
            ...state,
            activeThaumaturgyEffects: [...retainedEffects, thaumaturgyEffect]
        }

        if (mode === 'booming_voice' && effect.abilityCheckModifier) {
            nextState = this.applyThaumaturgyBoomingVoiceStatus(nextState, effect)
        }

        return this.addLogEntry(nextState, {
            type: 'status',
            message: `${this.context.caster.name} manifests Thaumaturgy: ${this.describeThaumaturgyMode(mode)}.`,
            characterId: this.context.caster.id,
            data: { sourceSpellId: this.context.spellId, thaumaturgyEffect }
        })
    }

    private resolveThaumaturgyMode(effect: UtilityEffect): ThaumaturgyMode {
        const selected = this.context.playerInput?.trim().toLowerCase()
        const controlOptions = (effect.controlOptions ?? []).filter(isExecutableControlOption)
        const chosen = selected
            ? controlOptions.find(option =>
                option.name.toLowerCase() === selected ||
                option.name.toLowerCase().replace(/\s+/g, '_') === selected.replace(/\s+/g, '_') ||
                option.effect.toLowerCase() === selected
            )
            : controlOptions[0]
        const label = (chosen?.name || 'Altered Eyes').toLowerCase()

        if (label.includes('booming')) return 'booming_voice'
        if (label.includes('fire')) return 'fire_play'
        if (label.includes('invisible')) return 'invisible_hand'
        if (label.includes('phantom')) return 'phantom_sound'
        if (label.includes('tremor')) return 'tremors'

        return 'altered_eyes'
    }

    private resolveThaumaturgyPoint(): {
        position: { x: number; y: number };
        objectId?: string;
        objectName?: string;
    } | null {
        const selectedTarget = this.context.selectedSpellTargets?.[0]
        if (!selectedTarget || selectedTarget.kind === 'creature') {
            return null
        }

        if (selectedTarget.kind === 'object') {
            return {
                position: selectedTarget.position,
                objectId: selectedTarget.id,
                objectName: selectedTarget.object?.name || selectedTarget.name || selectedTarget.id
            }
        }

        return { position: selectedTarget.position }
    }

    private getThaumaturgyCreatedObject(
        effect: UtilityEffect,
        mode: ThaumaturgyMode
    ): NonNullable<UtilityEffect['createdObjects']>[number] | undefined {
        const modeToName: Record<ThaumaturgyMode, string> = {
            altered_eyes: 'Altered Eyes',
            booming_voice: 'Booming Voice',
            fire_play: 'Changed Flame',
            invisible_hand: 'Unlocked Door Or Window Motion',
            phantom_sound: 'Phantom Sound',
            tremors: 'Harmless Tremors'
        }

        return effect.createdObjects?.find(object => object.name === modeToName[mode])
    }

    private applyThaumaturgyBoomingVoiceStatus(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const liveCaster = this.getCaster(state)
        const sourceName = this.context.spellName || 'Thaumaturgy'
        const status: StatusEffect = {
            id: generateId(),
            name: 'Booming Voice',
            type: 'buff',
            duration: 10,
            source: sourceName,
            sourceCasterId: this.context.caster.id,
            description: 'Voice booms up to three times as loud; Charisma (Intimidation) checks have Advantage.',
            effect: { type: 'condition' },
            modifiers: { advantage: ['check'], skill: 'Intimidation' },
            abilityCheckModifier: effect.abilityCheckModifier,
            visualEffect: 'thaumaturgy-booming-voice'
        }

        return this.updateCharacter(state, liveCaster.id, {
            statusEffects: [
                ...(liveCaster.statusEffects || []).filter(existing =>
                    existing.source !== sourceName ||
                    existing.sourceCasterId !== this.context.caster.id ||
                    existing.name !== 'Booming Voice'
                ),
                status
            ]
        })
    }

    private describeThaumaturgyMode(mode: ThaumaturgyMode): string {
        switch (mode) {
            case 'booming_voice':
                return 'Booming Voice'
            case 'fire_play':
                return 'Fire Play'
            case 'invisible_hand':
                return 'Invisible Hand'
            case 'phantom_sound':
                return 'Phantom Sound'
            case 'tremors':
                return 'Tremors'
            default:
                return 'Altered Eyes'
        }
    }

    protected applyShapeWater(state: CombatState, effect: UtilityEffect): CombatState {
        const requestedMode = this.resolveShapeWaterMode(effect)
        const activeNonInstantaneous = (state.activeShapeWaterEffects || []).filter(activeEffect =>
            activeEffect.casterId === this.context.caster.id &&
            !activeEffect.instantaneous &&
            !activeEffect.dismissed &&
            (!activeEffect.expiresAtRound || activeEffect.expiresAtRound >= state.turnState.currentTurn)
        )

        if (requestedMode === 'dismiss') {
            const dismissedEffect = activeNonInstantaneous[0]
            if (!dismissedEffect) {
                return this.addLogEntry(state, {
                    type: 'status',
                    message: `${this.context.spellName || 'Shape Water'} has no active water effect to dismiss.`,
                    characterId: this.context.caster.id,
                    data: { sourceSpellId: this.context.spellId, rejectedShapeWaterDismissal: 'no_active_effect' }
                })
            }

            return this.addLogEntry({
                ...state,
                activeShapeWaterEffects: (state.activeShapeWaterEffects || []).map(activeEffect =>
                    activeEffect.id === dismissedEffect.id
                        ? { ...activeEffect, dismissed: true, expiresAtRound: state.turnState.currentTurn }
                        : activeEffect
                )
            }, {
                type: 'status',
                message: `${this.context.caster.name} dismisses a Shape Water effect.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, dismissedShapeWaterEffectId: dismissedEffect.id }
            })
        }

        const waterTarget = this.resolveShapeWaterTarget(state)
        if (!waterTarget) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} needs visible water that fits inside a 5-foot cube.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterTarget: 'dry_target' }
            })
        }

        if (requestedMode === 'freeze' && this.hasCreatureInShapeWaterCube(state, waterTarget.position)) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} cannot freeze water while a creature is in it.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterMode: 'creature_in_water' }
            })
        }

        const instantaneous = requestedMode === 'move_or_flow'
        if (!instantaneous && activeNonInstantaneous.length >= 2) {
            return this.addLogEntry(state, {
                type: 'status',
                message: `${this.context.spellName || 'Shape Water'} already has two active non-instantaneous water effects.`,
                characterId: this.context.caster.id,
                data: { sourceSpellId: this.context.spellId, rejectedShapeWaterMode: 'active_effect_cap' }
            })
        }

        const shapeWaterEffect = {
            id: generateId(),
            spellId: this.context.spellId || 'shape-water',
            casterId: this.context.caster.id,
            mode: requestedMode,
            position: waterTarget.position,
            targetObjectId: waterTarget.objectId,
            targetObjectName: waterTarget.objectName,
            volumeCubicFeet: 125,
            cubeSizeFeet: 5,
            createdTurn: state.turnState.currentTurn,
            expiresAtRound: instantaneous ? state.turnState.currentTurn : state.turnState.currentTurn + 600,
            instantaneous,
            noDamage: requestedMode === 'move_or_flow'
        }

        return this.addLogEntry({
            ...state,
            activeShapeWaterEffects: [
                ...(state.activeShapeWaterEffects || []),
                shapeWaterEffect
            ]
        }, {
            type: 'status',
            message: `${this.context.caster.name} shapes water with ${this.describeShapeWaterMode(requestedMode)}.`,
            characterId: this.context.caster.id,
            data: { sourceSpellId: this.context.spellId, shapeWaterEffect }
        })
    }

    private resolveShapeWaterMode(effect: UtilityEffect): ShapeWaterMode | 'dismiss' {
        const selected = this.context.playerInput?.trim().toLowerCase()
        if (selected === 'dismiss') {
            return 'dismiss'
        }

        const controlOptions = (effect.controlOptions ?? []).filter(isExecutableControlOption)
        const chosen = selected
            ? controlOptions.find(option =>
                option.name.toLowerCase() === selected ||
                option.effect.toLowerCase() === selected ||
                option.name.toLowerCase().replace(/\s+/g, '_') === selected.replace(/\s+/g, '_')
            )
            : controlOptions[0]

        const label = (chosen?.name || 'Move Or Flow').toLowerCase()
        if (label.includes('shape')) return 'shape_and_animate'
        if (label.includes('color') || label.includes('opacity')) return 'color_or_opacity'
        if (label.includes('freeze')) return 'freeze'

        return 'move_or_flow'
    }

    private resolveShapeWaterTarget(state: CombatState): {
        position: { x: number; y: number };
        objectId?: string;
        objectName?: string;
    } | null {
        const selectedTarget = this.context.selectedSpellTargets?.[0]
        if (!selectedTarget) {
            return null
        }

        if (selectedTarget.kind === 'object') {
            const objectName = selectedTarget.object?.name || selectedTarget.name || selectedTarget.id
            const objectKey = `${selectedTarget.id} ${objectName}`.toLowerCase()
            if (objectKey.includes('water')) {
                return {
                    position: selectedTarget.position,
                    objectId: selectedTarget.id,
                    objectName
                }
            }
        }

        if (this.isWaterTile(state, selectedTarget)) {
            return { position: selectedTarget.position }
        }

        return null
    }

    private describeShapeWaterMode(mode: ShapeWaterMode): string {
        switch (mode) {
            case 'shape_and_animate':
                return 'Shape And Animate'
            case 'color_or_opacity':
                return 'Color Or Opacity'
            case 'freeze':
                return 'Freeze'
            default:
                return 'Move Or Flow'
        }
    }

    protected applyHeldWeaponAugments(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        let nextState = state

        for (const augment of effect.attackAugments || []) {
            const liveCaster = this.getCaster(nextState)
            const eligibleWeapon = this.findEligibleHeldWeapon(liveCaster, augment)

            if (!eligibleWeapon) {
                nextState = this.addLogEntry(nextState, {
                    type: 'status',
                    message: `${this.context.spellName || 'The spell'} needs the caster to hold an eligible weapon before it can take hold.`,
                    characterId: liveCaster.id,
                    data: {
                        sourceSpellId: this.context.spellId,
                        rejectedAttackAugment: 'missing_eligible_held_weapon',
                        eligibleWeaponTypes: augment.weaponRequirement?.weaponTypes || []
                    }
                })
                continue
            }

            const sourceName = this.context.spellName || this.context.spellId || 'Spell'
            const refreshedEffects = (liveCaster.activeEffects || []).filter(activeEffect =>
                activeEffect.spellId !== this.context.spellId ||
                activeEffect.casterId !== this.context.caster.id
            )
            const expiresAtRound = this.getEffectExpiryRound(state.turnState.currentTurn)
            const heldWeaponAugment = {
                sourceWeaponId: eligibleWeapon.id,
                sourceWeaponName: eligibleWeapon.name,
                sourceSpellcastingAbilityModifier: this.getSpellcastingAbilityModifier(liveCaster),
                sourceCasterLevel: liveCaster.level || this.context.caster.level || 1,
                isMagical: true,
                eligibleWeaponTypes: augment.weaponRequirement?.weaponTypes || [],
                attackType: augment.attackType,
                useSpellcastingAbilityForAttack: augment.abilitySubstitution?.attackRoll === 'spellcasting_ability',
                useSpellcastingAbilityForDamage: augment.abilitySubstitution?.damageRoll === 'spellcasting_ability',
                damageDiceByLevel: {
                    base: this.normalizeDamageDice(augment.damageDieOverride?.dice || eligibleWeapon.damageDice || '1d4') || '1d4',
                    level5: this.resolveDamageDiceScaling(augment, 5),
                    level11: this.resolveDamageDiceScaling(augment, 11),
                    level17: this.resolveDamageDiceScaling(augment, 17)
                },
                damageTypeChoice: augment.damageTypeChoice ? {
                    chooser: augment.damageTypeChoice.chooser,
                    options: (augment.damageTypeChoice.options || []).map(option =>
                        typeof option === 'string'
                            ? option
                            : option.type || 'weapon_normal'
                    ),
                    defaultType: 'weapon_normal'
                } : undefined,
                endsOnRecast: this.context.conditionalEndings?.some(ending => ending.trigger === 'end_on_recast'),
                endsIfReleased: this.context.conditionalEndings?.some(ending => ending.trigger === 'holder_releases_item')
            }

            // Store the exact live weapon identity plus the broader eligible
            // weapon family. WeaponAttackCommand checks both, preserving the
            // current item model while leaving room for future handoff/item
            // enchantment work to move this block onto the Item itself.
            nextState = this.updateCharacter(nextState, liveCaster.id, {
                activeEffects: [
                    ...refreshedEffects,
                    {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        casterId: this.context.caster.id,
                        sourceName,
                        type: 'buff',
                        duration: this.context.effectDuration || { type: 'minutes', value: 1 },
                        startTime: state.turnState.currentTurn,
                        mechanics: { heldWeaponAugment }
                    }
                ]
            })

            nextState = {
                ...nextState,
                temporaryWeaponEnchantments: [
                    ...(nextState.temporaryWeaponEnchantments || []).filter(enchantment =>
                        enchantment.spellId !== this.context.spellId ||
                        enchantment.casterId !== this.context.caster.id ||
                        enchantment.itemId !== eligibleWeapon.id
                    ),
                    {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        sourceName,
                        casterId: this.context.caster.id,
                        itemId: eligibleWeapon.id,
                        itemName: eligibleWeapon.name,
                        createdTurn: state.turnState.currentTurn,
                        expiresAtRound,
                        heldWeaponAugment
                    }
                ]
            }

            nextState = this.addLogEntry(nextState, {
                type: 'status',
                message: `${eligibleWeapon.name} is empowered by ${sourceName}.`,
                characterId: liveCaster.id,
                data: {
                    sourceSpellId: this.context.spellId,
                    empoweredWeaponId: eligibleWeapon.id,
                    empoweredWeaponName: eligibleWeapon.name
                }
            })
        }

        return nextState
    }

    protected applyMagicStoneProjectiles(
        state: CombatState,
        effect: UtilityEffect
    ): CombatState {
        const liveCaster = this.getCaster(state)
        const sourceName = this.context.spellName || this.context.spellId || 'Spell'
        const pebbleCount = Math.max(1, Math.min(3, (effect as any).targeting?.instanceAllocation?.baseCount || 3))
        const expiresAtRound = this.getEffectExpiryRound(state.turnState.currentTurn)
        const attackAugment = effect.attackAugments?.[0]
        const spellcastingModifier = this.getSpellcastingAbilityModifier(liveCaster)
        const pebbleName = `${sourceName} Pebble`

        const refreshedInventory = (state.spellCreatedInventoryItems || []).filter(item =>
            !item.id.startsWith(`${this.context.spellId || 'magic-stone'}-pebble-`) ||
            !item.name.startsWith(pebbleName) ||
            (item as Item & { spellId?: string }).spellId !== this.context.spellId
        )

        const refreshedEnchantments = (state.temporaryWeaponEnchantments || []).filter(enchantment =>
            enchantment.spellId !== this.context.spellId ||
            enchantment.casterId !== this.context.caster.id
        )

        const projectiles = Array.from({ length: pebbleCount }, (_, index) => {
            const projectileId = `${this.context.spellId || 'magic-stone'}-pebble-${generateId()}-${index + 1}`
            const projectileName = `${pebbleName} ${index + 1}`
            const projectile: Item & { spellId?: string } = {
                id: projectileId,
                name: projectileName,
                description: `${sourceName} creates an empowered pebble that can be thrown or slung once before the magic ends.`,
                type: 'ammunition',
                quantity: 1,
                damageDice: attackAugment?.additionalDamage?.dice || attackAugment?.damageDieOverride?.dice || '1d6',
                damageType: attackAugment?.additionalDamage?.type || 'bludgeoning',
                properties: ['thrown', 'sling'],
                spellId: this.context.spellId
            }

            return {
                projectile,
                    enchantment: {
                        id: generateId(),
                        spellId: this.context.spellId || 'unknown',
                        sourceName,
                        casterId: this.context.caster.id,
                        itemId: projectileId,
                        itemName: projectileName,
                        createdTurn: state.turnState.currentTurn,
                        expiresAtRound,
                        heldWeaponAugment: {
                            sourceWeaponId: projectileId,
                            sourceWeaponName: projectileName,
                            sourceSpellId: this.context.spellId,
                            sourceCasterId: this.context.caster.id,
                            sourceSpellcastingAbilityModifier: spellcastingModifier,
                            sourceCasterLevel: liveCaster.level || this.context.caster.level || 1,
                            isMagical: true,
                            eligibleWeaponTypes: attackAugment?.weaponRequirement?.weaponTypes || ['pebble', 'sling'],
                        attackType: attackAugment?.attackType || 'ranged_weapon',
                        useSpellcastingAbilityForAttack: true,
                        useSpellcastingAbilityForDamage: true,
                        consumesOnAttackHitOrMiss: true,
                        damageDiceByLevel: {
                            base: attackAugment?.damageDieOverride?.dice || '1d6'
                        }
                    }
                }
            }
        })

        const projectileItems = projectiles.map(entry => entry.projectile)
        const projectileEnchantments = projectiles.map(entry => entry.enchantment)

        return {
            ...state,
            spellCreatedInventoryItems: [
                ...refreshedInventory,
                ...projectileItems
            ],
            temporaryWeaponEnchantments: [
                ...refreshedEnchantments,
                ...projectileEnchantments
            ]
        }
    }

}
