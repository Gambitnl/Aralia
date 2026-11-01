/**
 * @file weaponBridges.ts
 * Builds the existing weapon-cantrip bridges before generic spell attacks.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/spell/specialSpellRegistry.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { UtilityEffect, isUtilityEffect } from '@/types/spells'
import { SpellCommand, CommandContext } from '../../base/SpellCommand'
import { NarrativeCommand } from '../../effects/NarrativeCommand'
import { WeaponAttackCommand } from '../AbilityCommandFactory'
import { buildTrueStrikeAttack, hasTrueStrikeImmediateAttackAugment, resolveTrueStrikeAttackTarget, resolveTrueStrikeWeaponSnapshot, validateTrueStrikeWeaponSnapshot } from '../trueStrikeAttackBridge'
import { buildBoomingBladeAttack, hasBoomingBladeWeaponAttackBridge, resolveBoomingBladeAttackTarget, resolveBoomingBladeWeaponSnapshot, validateBoomingBladeWeaponSnapshot } from '../boomingBladeAttackBridge'
import { buildGreenFlameBladeAttack, hasGreenFlameBladeWeaponAttackBridge, resolveGreenFlameBladeAttackTarget, resolveGreenFlameBladeWeaponSnapshot, validateGreenFlameBladeWeaponSnapshot } from '../greenFlameBladeAttackBridge'
import { withConcentrationLifecycle } from './concentration'
import { SpellBridgeContext } from './bridgeContext'

export function buildWeaponBridgesCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, targets, context, activeEffects, playerInput, selectedSpellTargets } = input


    // Booming Blade is a blade cantrip: the spell cast is only real if it
    // creates a weapon attack first. Keep this bridge ahead of generic damage
    // command creation so the thunder payload stays gated behind hit or miss.
    if (spell.id === 'booming-blade' && hasBoomingBladeWeaponAttackBridge(spell)) {
      const weaponSnapshot = resolveBoomingBladeWeaponSnapshot(caster)
      const attackTarget = resolveBoomingBladeAttackTarget(selectedSpellTargets, targets, caster.id)
      const validation = validateBoomingBladeWeaponSnapshot(caster, weaponSnapshot)

      if (!weaponSnapshot || !attackTarget || !validation.valid) {
        const reason = validation.reason ?? 'Booming Blade needs a valid melee weapon and a creature target.'
        return [
          new NarrativeCommand(reason, context)
        ]
      }

      const builtAttack = buildBoomingBladeAttack(
        spell,
        caster,
        weaponSnapshot,
        attackTarget
      )

      const attackContext: CommandContext = {
        ...context,
        targets: [attackTarget],
        selectedSpellTargets: [
          {
            kind: 'creature',
            id: attackTarget.id
          }
        ],
        weaponProperties: weaponSnapshot.properties,
        isMagical: true
      }

      return withConcentrationLifecycle([
        new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
      ], spell, caster, context)
    }


    // Green-Flame Blade is the sibling blade cantrip with a secondary fire
    // leap. Keep its hit gate separate from Booming Blade so the weapon attack
    // can resolve first and the leap can spend only after a confirmed hit.
    if (spell.id === 'green-flame-blade' && hasGreenFlameBladeWeaponAttackBridge(spell)) {
      const weaponSnapshot = resolveGreenFlameBladeWeaponSnapshot(caster)
      const attackTarget = resolveGreenFlameBladeAttackTarget(selectedSpellTargets, targets, caster.id)
      const validation = validateGreenFlameBladeWeaponSnapshot(caster, weaponSnapshot)

      if (!weaponSnapshot || !attackTarget || !validation.valid) {
        const reason = validation.reason ?? 'Green-Flame Blade needs a valid melee weapon and a creature target.'
        return [
          new NarrativeCommand(reason, context)
        ]
      }

      const builtAttack = buildGreenFlameBladeAttack(
        spell,
        caster,
        weaponSnapshot,
        attackTarget,
        selectedSpellTargets,
        targets
      )

      const attackContext: CommandContext = {
        ...context,
        targets: [attackTarget],
        selectedSpellTargets: [
          {
            kind: 'creature',
            id: attackTarget.id
          }
        ],
        weaponProperties: weaponSnapshot.properties,
        isMagical: true
      }

      return withConcentrationLifecycle([
        new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
      ], spell, caster, context)
    }


    // True Strike is a neighboring cast-time weapon-attack cantrip, but it has
    // a different contract: the spell alters the weapon attack's ability and
    // damage type instead of leaving a target-side movement rider.
    if (spell.id === 'true-strike') {
      const trueStrikeEffect = activeEffects.find(
        effect => isUtilityEffect(effect) && effect.attackAugments?.some(augment =>
          augment.grantedAttack?.timing === 'during_cast' &&
          augment.grantedAttack.usesCastingWeapon === true
        )
      ) as UtilityEffect | undefined

      if (trueStrikeEffect && hasTrueStrikeImmediateAttackAugment(spell)) {
        const weaponSnapshot = resolveTrueStrikeWeaponSnapshot(caster)
        const attackTarget = resolveTrueStrikeAttackTarget(selectedSpellTargets, targets, caster.id)
        const augment = trueStrikeEffect.attackAugments?.find(attackAugment =>
          attackAugment.grantedAttack?.timing === 'during_cast' &&
          attackAugment.grantedAttack.usesCastingWeapon === true
        )
        const validation = validateTrueStrikeWeaponSnapshot(caster, weaponSnapshot, augment?.weaponRequirement)

        if (!weaponSnapshot || !attackTarget || !validation.valid) {
          const reason = validation.reason ?? 'True Strike needs a valid weapon and a creature target.'
          return [
            new NarrativeCommand(reason, context)
          ]
        }

        const builtAttack = buildTrueStrikeAttack(
          spell,
          caster,
          weaponSnapshot,
          attackTarget,
          playerInput
        )

        const attackContext: CommandContext = {
          ...context,
          targets: [attackTarget],
          selectedSpellTargets: [
            {
              kind: 'creature',
              id: attackTarget.id
            }
          ],
          weaponProperties: weaponSnapshot.properties,
          isMagical: true
        }

        return withConcentrationLifecycle([
          new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
        ], spell, caster, context)
      }
    }

  return undefined
}
