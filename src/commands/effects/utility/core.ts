// Per-spell-category slice of UtilityCommand: core behaviors.
// Extracted mechanically from src/commands/effects/UtilityCommand.ts (see
// .agent/scratch/utility-split/analyze.mjs). Method bodies are byte-identical
// to the original; only visibility was promoted to protected where the
// dispatch (execute) or sibling slices call across slice boundaries.

import { BaseEffectCommand } from '../../base/BaseEffectCommand'
import type { UtilityEffect } from '@/types/spells'
import type { Item } from '@/types/items'
import type { CombatState, CombatCharacter, StatusEffect, Ability, SelectedSpellTarget, Position } from '@/types/combat'
import { generateId } from '../../../utils/idGenerator'



export abstract class UtilityCommandCore extends BaseEffectCommand {
    protected resolveEffectExpiryRound(currentTurn: number): number | undefined {
        if (this.context.effectDuration?.type === 'rounds' && typeof this.context.effectDuration.value === 'number') {
            return currentTurn + this.context.effectDuration.value
        }

        if (this.context.effectDuration?.type === 'minutes' && typeof this.context.effectDuration.value === 'number') {
            return currentTurn + this.context.effectDuration.value * 10
        }

        return undefined
    }

    protected extractKeyedPlayerInput(key: string): string | undefined {
        const input = this.context.playerInput ?? ''
        const match = input.match(new RegExp(`${key}\\s*=\\s*([^;|]+)`, 'i'))
        return match?.[1]?.trim()
    }

    protected resolvePointTarget(): Position | undefined {
        return this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'point' }> => target.kind === 'point')
            ?.position
    }

    protected resolveObjectTarget(): Extract<SelectedSpellTarget, { kind: 'object' }> | null {
        return this.context.selectedSpellTargets
            ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object') ?? null
    }

    protected isDancingLightsHumanoidForm(): boolean {
        return this.context.playerInput?.trim().toLowerCase() === 'humanoid form'
    }

    protected getDancingLightsClusterPositions(origin: Position): Position[] {
        // The four default offsets keep the linked lights within one tile of
        // each other, satisfying the 20-foot leash until a later move command
        // asks for a different legal arrangement.
        return [
            origin,
            { x: origin.x + 1, y: origin.y },
            { x: origin.x, y: origin.y + 1 },
            { x: origin.x + 1, y: origin.y + 1 }
        ]
    }

    protected getDefaultHitRiderExpiryRound(currentTurn: number): number | undefined {
        // Hit riders that say "until the end of the caster's next turn" use the
        // same round clock as other temporary command artifacts. The exact
        // caster-turn cleanup is a broader turn-manager concern; this gives the
        // light artifact a bounded expiry instead of making it permanent.
        if (this.effect.condition?.type === 'hit') {
            return currentTurn + 1
        }

        return undefined
    }

    protected isWaterTile(state: CombatState, selectedTarget: SelectedSpellTarget): selectedTarget is Extract<SelectedSpellTarget, { kind: 'point' | 'object' }> {
        const position = selectedTarget.kind === 'creature' ? undefined : selectedTarget.position
        if (!position) {
            return false
        }

        const tile = state.mapData?.tiles?.get(`${position.x},${position.y}`)
        return tile?.terrain === 'water'
    }

    protected hasCreatureInShapeWaterCube(state: CombatState, position: { x: number; y: number }): boolean {
        return state.characters.some(character =>
            character.position?.x === position.x &&
            character.position?.y === position.y
        )
    }

    protected findOffsetCompanionPosition(position: Position, offset: number): Position {
        return {
            x: position.x + offset,
            y: position.y
        }
    }

    protected isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null
    }

    protected isPosition(value: unknown): value is Position {
        return this.isRecord(value) &&
            typeof value.x === 'number' &&
            typeof value.y === 'number'
    }

    protected toTitleCase(value: string): string {
        return value
            .split(' ')
            .map(word => word.length > 0 ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
            .join(' ')
    }

    protected findAdjacentCompanionPosition(position: Position): Position {
        return {
            x: position.x + 1,
            y: position.y
        }
    }

    protected getSpellcastingAbilityModifier(caster: CombatCharacter): number {
        const spellcastingAbility = ((caster as CombatCharacter & {
            spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma'
        }).spellcastingAbility || 'wisdom').toLowerCase() as keyof CombatCharacter['stats']
        const score = (caster.stats[spellcastingAbility] as number) || 10

        return Math.floor((score - 10) / 2)
    }

    protected getEffectExpiryRound(currentTurn: number): number | undefined {
        const duration = this.context.effectDuration
        if (!duration?.value) {
            return undefined
        }
        if (duration.type === 'rounds') {
            return currentTurn + Number(duration.value)
        }
        if (duration.type === 'minutes') {
            return currentTurn + (Number(duration.value) * 10)
        }
        if ((duration as { type?: string; unit?: string }).type === 'timed') {
            const timedDuration = duration as unknown as { type: 'timed'; value?: number | string; unit?: string }
            if (timedDuration.unit === 'round' || timedDuration.unit === 'rounds') {
                return currentTurn + Number(timedDuration.value || 0)
            }
            if (timedDuration.unit === 'minute' || timedDuration.unit === 'minutes') {
                return currentTurn + (Number(timedDuration.value || 0) * 10)
            }
            if (timedDuration.unit === 'hour' || timedDuration.unit === 'hours') {
                return currentTurn + (Number(timedDuration.value || 0) * 600)
            }
        }

        return undefined
    }

    protected normalizeDamageDice(dice: string | undefined): string | undefined {
        if (!dice) {
            return undefined
        }

        return dice.trim().match(/^d\d+/i) ? `1${dice.trim()}` : dice.trim()
    }

    protected resolveDamageDiceScaling(
        augment: NonNullable<UtilityEffect['attackAugments']>[number],
        level: 5 | 11 | 17
    ): string | undefined {
        const formulaByLevel = (augment.damageDieOverride?.scaling as { formulaByLevel?: Record<string, string> } | undefined)?.formulaByLevel
        const explicitFormula = formulaByLevel?.[`level${level}`]
        if (explicitFormula) {
            return this.normalizeDamageDice(explicitFormula)
        }

        const customFormula = augment.damageDieOverride?.scaling?.customFormula?.toLowerCase() || ''
        if (level === 5 && customFormula.includes('d10')) return '1d10'
        if (level === 11 && customFormula.includes('d12')) return '1d12'
        if (level === 17 && customFormula.includes('2d6')) return '2d6'

        return undefined
    }

    protected findEligibleHeldWeapon(
        caster: CombatCharacter,
        augment: NonNullable<UtilityEffect['attackAugments']>[number]
    ): Item | null {
        const equippedItems = (caster as CombatCharacter & {
            equippedItems?: Partial<Record<string, Item | undefined>>
        }).equippedItems

        const heldWeapons = [
            equippedItems?.MainHand,
            equippedItems?.OffHand
        ].filter((item): item is Item => Boolean(item))

        const eligibleWeaponTypes = (augment.weaponRequirement?.weaponTypes || [])
            .map(type => type.toLowerCase())

        return heldWeapons.find(weapon =>
            eligibleWeaponTypes.some(type =>
                weapon.id.toLowerCase() === type ||
                weapon.name.toLowerCase() === type ||
                weapon.name.toLowerCase().includes(type)
            )
        ) || null
    }

    protected createConsumableCreatedObjectAbility(
        createdObject: NonNullable<UtilityEffect['createdObjects']>[number],
        index: number,
        currentTurn: number
    ): Ability | null {
        // Only objects with explicit healing and a real consume action become
        // combat buttons. This keeps provision stacks, towers, portals, hazards,
        // and other non-combat objects from accidentally turning into fake
        // healing buttons just because they are also "created objects."
        if (!createdObject.healingPerItem || createdObject.consumeAction === 'not_applicable') {
            return null
        }

        const actionCost = this.toAbilityCost(createdObject.consumeAction)
        if (!actionCost) {
            return null
        }

        const objName = createdObject.name ?? 'Created Object';
        const abilityId = `${this.context.spellId || 'created-object'}-${objName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`

        return {
            id: abilityId,
            sourceSpellId: this.context.spellId,
            name: `Eat ${objName}`,
            description: createdObject.notes ?? `Consume one ${objName}.`,
            type: 'utility',
            cost: { type: actionCost },
            targeting: 'single_ally',
            range: 1,
            effects: [{
                type: 'heal',
                value: createdObject.healingPerItem
            }],
            tags: ['spell-created-object', this.context.spellId || 'unknown-spell', createdObject.objectType ?? 'created_object'],
            maxUses: createdObject.count ?? 1,
            usesRemaining: createdObject.count ?? 1,
            createdObjectExpiresAtRound: this.getCreatedObjectExpiresAtRound(currentTurn),
            createdObjectDuration: this.getCreatedObjectDuration(),
            icon: '*'
        }
    }

    private getCreatedObjectExpiresAtRound(currentTurn: number): number | undefined {
        // Combat can only clean up objects that expire on the round clock.
        // Goodberry lasts for hours, so it preserves duration metadata instead
        // of pretending twenty-four hours can be counted with encounter turns.
        return this.context.effectDuration?.type === 'rounds' &&
            typeof this.context.effectDuration.value === 'number'
            ? currentTurn + this.context.effectDuration.value
            : undefined
    }

    private getCreatedObjectDuration(): Ability['createdObjectDuration'] {
        const duration = this.context.effectDuration
        if (!duration) {
            return undefined
        }

        switch (duration.type) {
            case 'rounds':
            case 'minutes':
            case 'special':
                return { type: duration.type, value: duration.value }
            default:
                return { type: 'special', value: duration.value }
        }
    }

    private toAbilityCost(
        consumeAction: NonNullable<UtilityEffect['createdObjects']>[number]['consumeAction']
    ): Ability['cost']['type'] | null {
        // Spell JSON uses rules-text action names, while battle-map abilities
        // use compact action-economy tokens. Keeping the translation here lets
        // Goodberry spend the normal bonus-action resource without changing the
        // source data spelling.
        switch (consumeAction) {
            case 'action':
                return 'action'
            case 'bonus_action':
                return 'bonus'
            case 'reaction':
                return 'reaction'
            case 'free':
                return 'free'
            default:
                return null
        }
    }

    protected createSpellCreatedInventoryItems(
        createdObject: NonNullable<UtilityEffect['createdObjects']>[number]
    ): Item[] {
        const objName = createdObject.name ?? 'Created Object';
        if (createdObject.inventoryItemId) {
            // Provisioning counts canonical inventory ids such as "rations" and
            // "water-day". Emit one stack with the requested resource-day
            // quantity so travel math can consume the spell-created supplies
            // without parsing the spell name or prose.
            return [{
                id: createdObject.inventoryItemId,
                name: objName,
                description: createdObject.notes ?? `Created by ${this.context.spellName}.`,
                type: 'food_drink',
                quantity: (createdObject.inventoryQuantity ?? createdObject.count) ?? 1,
                isConsumed: true,
                perishable: createdObject.perishable ?? createdObject.expiresWithSpell,
                shelfLife: createdObject.shelfLife ?? this.describeCreatedObjectShelfLife(),
                nutritionValue: createdObject.nourishmentDaysPerItem,
                acquiredAt: Date.now()
            }]
        }

        // Shared inventory currently consumes one item entry at a time rather
        // than decrementing stack quantity. Emit one Goodberry-like item per
        // created object so using a berry removes exactly one berry.
        if (!createdObject.healingPerItem || createdObject.consumeAction === 'not_applicable') {
            return []
        }

        return Array.from({ length: Math.max(0, createdObject.count ?? 1) }, (_, index): Item => ({
            id: `${this.context.spellId || 'spell'}-${objName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${generateId()}-${index}`,
            name: objName,
            description: createdObject.notes ?? `Created by ${this.context.spellName}.`,
            type: 'consumable',
            quantity: 1,
            effect: {
                type: 'heal',
                value: createdObject.healingPerItem || 0
            },
            isConsumed: true,
            perishable: createdObject.perishable ?? createdObject.expiresWithSpell,
            shelfLife: createdObject.shelfLife ?? this.describeCreatedObjectShelfLife(),
            nutritionValue: createdObject.nourishmentDaysPerItem,
            acquiredAt: Date.now()
        }))
    }

      private describeCreatedObjectShelfLife(): string | undefined {
          const duration = this.context.effectDuration
          if (!duration?.value) {
              return undefined
          }

        switch (duration.type) {
            case 'rounds':
            case 'minutes':
                return `${duration.value} ${duration.type}`
            case 'special':
                return 'special spell duration'
              default:
                  return undefined
          }
      }

    protected addStatus(state: CombatState, target: CombatCharacter, name: string, message: string): CombatState {
        const status: StatusEffect = {
            id: generateId(),
            name,
            type: 'debuff',
            duration: 1,
            effect: { type: 'condition' }
        }
        const updated = this.updateCharacter(state, target.id, {
            statusEffects: [...target.statusEffects, status]
        })
        return this.addLogEntry(updated, {
            type: 'status',
            message,
            characterId: target.id
        })
    }
}
