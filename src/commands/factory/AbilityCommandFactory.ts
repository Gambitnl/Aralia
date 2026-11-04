/**
 * ARCHITECTURAL CONTEXT:
 * This factory is responsible for bridging the gap between 'Abilities' 
 * (weapon attacks, class features) and 'Commands'. It translates raw 
 * weapon data into executable combat logic.
 *
 * Recent updates focus on 'Keyword Propagation'.
 * - In `WeaponAttackCommand`, we now extract `weapon.properties` (e.g., 
 *   'heavy', 'finesse') from the ability and pass them into the 
 *   `CommandContext`.
 * - This ensures that downstream `DamageCommands` are aware of the source 
 *   weapon's traits, enabling feat logic like GWM or HAM to function 
 *   correctly without the command needing a direct reference to the weapon.
 * - Added `hasDisadvantage` check to the attack roll, allowing status 
 *   effects (like the Slasher feat's Grievous Wound) to influence accuracy.
 * 
 * @file src/commands/factory/AbilityCommandFactory.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 20:18:49
 * Dependents: commands/factory/spell/weaponBridges.ts, commands/index.ts, components/DesignPreview/steps/spells/shieldScenario.tsx
 * Imports: 45 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getDuelingDamageBonus } from '@/utils/combat/fightingStyleDamage';
import { rangedAttackPressure, RANGED_PRESSURE_REASON } from '@/systems/combat/rangedAttackPressure';
import { getExhaustionD20Penalty } from '@/utils/combat/physicsUtils';
import { WEAPONS_DATA } from '@/data/items';
import { repeatedMultiattackOptions, selectRepeatedAttack } from '@/utils/combat/multiattackUtils';
import { CombatCharacter, Ability, CombatState, AbilityEffect, SelectedSpellTarget, AbilityCost } from '@/types/combat';
import { GameState } from '@/types';
import { getRulesEdition } from '@/config/rulesEdition';
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { DamageCommand } from '../effects/DamageCommand';
import { HealingCommand } from '../effects/HealingCommand';
import { MovementCommand } from '../effects/MovementCommand';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import { resolveDefensiveHitReaction } from '@/systems/combat/reactions/defensiveHitReaction';
import { AttackRollModifierCommand, matchingAttackRollEffects, consumeMatchedAttackRollEffects } from '../effects/AttackRollModifierCommand';
import { AbilityEffectMapper } from './AbilityEffectMapper';
import { generateId, calculateCover, resolveAttack, getDistance, hasTavernBrawler, isImprovisedWeapon, getUnarmedStrikeDamageFormula, buildTavernBrawlerShoveOffer } from '@/utils/combat';
import { rollD20, rollDice } from '@/systems/dice/rollers';
import { getAbilityModifierValue } from '@/utils/character';
import { SpellEffect, Spell, isAttackRollModifierEffect, isDamageEffect, isHealingEffect, isMovementEffect, isStatusConditionEffect } from '@/types/spells';
import { isAtLongRange, isRangedWeapon, isThrownAttackAbilityId, LONG_RANGE_REASON } from '@/utils/combat/weaponRange';
import { AttackRiderSystem, AttackContext } from '@/systems/combat/AttackRiderSystem';
// Subclass attack riders. Each module owns its whole rule; this command only
// supplies live combat state and the caller-reported surprise fact, then
// publishes whatever the module hands back (agora-f821.41).
import { resolveAssassinateAgainstTarget } from '@/utils/combat/assassinUtils';
import { resolveColossusSlayerOnHit } from '@/utils/combat/hunterUtils';
import { VisibilitySystem } from '@/systems/visibility';
import { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../effects/FamiliarPocketCommands';
import { FamiliarSharedSensesCommand } from '../effects/FamiliarSharedSensesCommand';
import { CommandedSummonCommand } from '../effects/CommandedSummonCommand';
import { GrantedActionCommand } from '../effects/GrantedActionCommand';
import { DismissSummonCommand } from '../effects/SummonDismissCommand';
import { SummonReturnHomeCommand } from '../effects/SummonReturnHomeCommand';
import { breakFriendsConcentrationForCaster } from '../effects/ConcentrationCommands';
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils';
import { combatEvents } from '@/systems/events/CombatEvents';
import { createMovementDebuff, type MovementTriggerDebuff } from '@/systems/spells/effects/triggerHandler';
import { isBoomingBladeRuntimeAbility } from './boomingBladeAttackBridge';
import { isGreenFlameBladeRuntimeAbility } from './greenFlameBladeAttackBridge';
import { canAffordActionCost, consumeActionCost } from '@/utils/combat/actionEconomyUtils';
import { breakTauntsForEvent, hasTauntAttackDisadvantage } from '@/systems/combat/tauntConstraint';
import { hasGrappledAttackDisadvantage } from '@/utils/combat/grappleUtils';
import { getCombatantAltitudeFeet, getCombatDistanceFeet } from '@/utils/spatial/elevationGeometry';
import { conditionAttackBenefits } from '@/utils/combat/statusConditionUtils';
import { isIncapacitated } from '@/utils/combat/deathSaveUtils';
import { getHighGroundAdvantage } from '@/utils/spatial/elevationSemantics';
import {
  hasUndetectedHiddenSource,
  revealHideDerivedHiddenAfterAttack,
} from '@/systems/perception/stealthResolution';

type HeldWeaponAugment = NonNullable<NonNullable<NonNullable<CombatCharacter['activeEffects']>[number]['mechanics']>['heldWeaponAugment']>;

// ============================================================================
// Attack Classification Helpers
// ============================================================================
// This section translates visible attack-button metadata into the smaller
// attack families used by riders and reaction spells. Unarmed Strike is
// intentionally separated from ordinary weapons because modern smite spells
// opt into it explicitly instead of treating every punch as a weapon object.
// ============================================================================

const isUnarmedStrikeAbility = (ability: Ability): boolean => {
  // Generated monster and player action ids commonly normalize "Unarmed
  // Strike" into `unarmed_strike`, while hand-authored fixtures often keep the
  // display name. Check both so the event bridge is not tied to one adapter.
  const normalizedId = ability.id.toLowerCase().replace(/[\s-]+/g, '_');
  const normalizedName = ability.name.toLowerCase();

  return normalizedId.includes('unarmed_strike') || normalizedName.includes('unarmed strike');
};

const getAttackEventClassification = (ability: Ability): {
  attackType: 'weapon' | 'spell' | 'unarmed';
  weaponType: 'melee' | 'ranged' | 'unarmed';
} => {
  // Unarmed Strike can be a real attack action, but it is not a held melee
  // weapon. Publishing it separately lets Shining/Blinding Smite honor their
  // explicit includesUnarmedStrike contract without widening all melee riders.
  if (ability.attackType === 'unarmed' || isUnarmedStrikeAbility(ability)) {
    return {
      attackType: 'unarmed',
      weaponType: 'unarmed'
    };
  }

  // Some attack-roll buttons are spell attacks rather than weapon attacks.
  // Lightning Arrow and similar next-weapon-attack riders must ignore those
  // buttons even when they are ranged, so honor explicit spell-attack metadata
  // before falling back to the older weapon-attack default.
  if (ability.attackType === 'spell') {
    return {
      attackType: 'spell',
      weaponType: (ability.range || 5) <= 5 ? 'melee' : 'ranged'
    };
  }

  return {
    attackType: ability.type === 'attack' ? 'weapon' : 'spell',
    weaponType: (ability.range || 5) <= 5 ? 'melee' : 'ranged'
  };
};

const isShockingGraspMetalArmorAdvantage = (ability: Ability, target: CombatCharacter): boolean => {
  // Shocking Grasp has one special attack-roll rider: melee spell attacks
  // against a creature wearing metal armor are made with advantage. Armor
  // material is not yet a full item taxonomy, so this narrow bridge reads the
  // combat-facing `hasMetalArmor` flag added for this spell slice.
  const sourceSpellId = ability.sourceSpellId ?? ability.spell?.id ?? ability.id;
  const isShockingGrasp = sourceSpellId === 'shocking-grasp';
  const isMeleeSpellAttack = ability.attackType === 'spell' && (ability.range || 5) <= 5;

  return isShockingGrasp && isMeleeSpellAttack && target.hasMetalArmor === true;
};

/**
 * Command for executing a weapon attack.
 * Handles attack rolls, critical hits, and reaction windows (conceptually).
 */
export class WeaponAttackCommand implements SpellCommand {
  public readonly id = generateId();
  public readonly description: string;
  public readonly metadata: CommandMetadata;

  private ability: Ability;
  private caster: CombatCharacter;
  private targets: CombatCharacter[];
  private context: CommandContext;

  constructor(
    ability: Ability,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    context: CommandContext
  ) {
    this.ability = ability;
    this.caster = caster;
    this.targets = targets;
    this.context = context;
    this.description = `${caster.name} attacks with ${ability.name}`;
    this.metadata = {
      spellId: ability.id,
      spellName: ability.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: targets.map(t => t.id),
      effectType: 'weapon_attack',
      timestamp: Date.now()
    };
  }

  private getLiveCaster(state: CombatState): CombatCharacter {
    return state.characters.find(character => character.id === this.caster.id) || this.caster;
  }

  private getMatchingHeldWeaponAugment(state: CombatState): HeldWeaponAugment | null {
    const liveCaster = this.getLiveCaster(state);
    const abilityWeapon = this.ability.weapon;

    if (!abilityWeapon) {
      return null;
    }

    const abilityWeaponKey = `${abilityWeapon.id} ${abilityWeapon.name}`.toLowerCase();

    const activeEffectAugments = liveCaster.activeEffects
      ?.map(effect => effect.mechanics?.heldWeaponAugment) || [];
    const itemEnchantmentAugments = (state.temporaryWeaponEnchantments || [])
      .filter(enchantment =>
        !enchantment.expiresAtRound ||
        !state.turnState?.currentTurn ||
        enchantment.expiresAtRound >= state.turnState.currentTurn
      )
      .map(enchantment => enchantment.heldWeaponAugment);

    // Shillelagh is mirrored on the caster as an active effect and stored on
    // CombatState as an item-owned enchantment. Checking both lets the original
    // caster use the old combat path while also allowing a handed-off weapon to
    // keep its spell metadata when another actor attacks with that item.
    return [...activeEffectAugments, ...itemEnchantmentAugments]
      .find((augment): augment is HeldWeaponAugment => {
        if (!augment) return false;
        if (
          augment.attackType &&
          augment.attackType !== 'melee_weapon' &&
          augment.attackType !== 'weapon' &&
          augment.attackType !== 'ranged_weapon'
        ) return false;

        const matchesRegisteredWeapon =
          Boolean(augment.sourceWeaponId && augment.sourceWeaponId === abilityWeapon.id) ||
          Boolean(augment.sourceWeaponName && augment.sourceWeaponName.toLowerCase() === abilityWeapon.name.toLowerCase());

        const matchesEligibleFamily = (augment.eligibleWeaponTypes || []).some(type =>
          abilityWeaponKey.includes(type.toLowerCase())
        );

        return matchesRegisteredWeapon || matchesEligibleFamily;
      }) || null;
  }

  private getSpellcastingAbilityModifier(caster: CombatCharacter, augment?: HeldWeaponAugment | null): number {
    if (typeof augment?.sourceSpellcastingAbilityModifier === 'number') {
      return augment.sourceSpellcastingAbilityModifier;
    }

    const spellcastingAbility = ((caster as CombatCharacter & {
      spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma'
    }).spellcastingAbility || 'wisdom').toLowerCase() as keyof CombatCharacter['stats'];
    const score = caster.stats[spellcastingAbility] || 10;

    return Math.floor(((score as number) - 10) / 2);
  }

  /**
   * The ability modifier a computed weapon attack uses: Dexterity for ranged,
   * the better of Strength and Dexterity for finesse, Strength otherwise, or
   * the spellcasting modifier when a held-weapon augment says so.
   */
  private getWeaponAttackAbilityModifier(liveCaster: CombatCharacter, heldWeaponAugment: HeldWeaponAugment | null): number {
    const strMod = Math.floor((liveCaster.stats.strength - 10) / 2);
    const dexMod = Math.floor((liveCaster.stats.dexterity - 10) / 2);
    const isRanged = this.isRangedWeaponAttack();
    // Finesse weapons may use Dexterity instead of Strength for the attack
    // (RAW: the wielder's choice → take the better modifier). Catalog weapon
    // properties are capitalized ('Finesse'), so compare case-insensitively.
    const isFinesse = Boolean(
      this.ability.weapon?.properties?.some(p => p.toLowerCase() === 'finesse')
    );
    const meleeMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
    const useSpellcastingAttackMod = Boolean(
      heldWeaponAugment?.useSpellcastingAbilityForAttack &&
      (heldWeaponAugment.attackType === 'ranged_weapon' || !isRanged)
    );
    if (useSpellcastingAttackMod) return this.getSpellcastingAbilityModifier(liveCaster, heldWeaponAugment);
    // GG-495: a thrown melee weapon keeps the modifier it uses in melee (PHB
    // Thrown property); a ranged weapon uses Dexterity, or the better of the
    // two for a finesse ranged weapon such as the dart.
    if (isThrownAttackAbilityId(this.ability.id)) return meleeMod;
    if (isRanged) return isFinesse ? Math.max(strMod, dexMod) : dexMod;
    return meleeMod;
  }

  /**
   * GG-495: whether this attack is a ranged attack. A weapon decides by its
   * category or Ammunition property, a "Throw" ability is ranged, and only a
   * weapon-less ability falls back to range > 1. The old "range > 1" test would
   * have made a 10 ft reach glaive a ranged (Dexterity) weapon.
   */
  private isRangedWeaponAttack(): boolean {
    if (isThrownAttackAbilityId(this.ability.id)) return true;
    if (this.ability.weapon) {
      return isRangedWeapon(this.ability.weapon)
        || Boolean(this.ability.weapon.properties?.some(p => p.toLowerCase() === 'range'));
    }
    return this.ability.range > 1;
  }

  /** A magic weapon's +N (magicProperties.magicalBonus), or 0. */
  private getWeaponMagicBonus(): number {
    const bonus = this.ability.weapon?.magicProperties?.magicalBonus;
    return typeof bonus === 'number' && Number.isFinite(bonus) ? bonus : 0;
  }

  /**
   * GG-496 (audit 2026-10-25): a weapon hit deals its dice PLUS the attack's
   * ability modifier and the weapon's magic bonus. Before this, a player weapon
   * hit dealt the dice alone (only unarmed strikes added Strength), so a
   * Strength 16 longsword hit for 1d8 instead of 1d8+3.
   *
   * Scope: only player weapon attacks whose attack bonus is computed here
   * (attackBonus undefined). Monster attacks carry a fixed attackBonus and
   * their dice already include the modifier, so they are left alone. Unarmed
   * strikes keep their own Strength path. An off-hand (bonus-action) hit adds
   * the ability modifier only when it is negative (PHB two-weapon fighting).
   * The bonus goes into the dice notation as a flat term, which a critical hit
   * does not double (only dice counts double in rollContract).
   */
  private applyWeaponDamageBonus(effect: SpellEffect, heldWeaponAugment: HeldWeaponAugment | null, state: CombatState, isPrimaryWeaponDamage = true): SpellEffect {
    if (!isDamageEffect(effect)) return effect;
    if (this.ability.type !== 'attack' || !this.ability.weapon) return effect;
    if (this.ability.attackBonus !== undefined || isUnarmedStrikeAbility(this.ability)) return effect;
    const abilityMod = this.getWeaponAttackAbilityModifier(this.getLiveCaster(state), heldWeaponAugment);
    const isOffHand = this.ability.id === 'attack_off' || this.ability.cost?.type === 'bonus';
    // A held-weapon augment such as Shillelagh or Magic Stone that uses the
    // spellcasting ability for damage already added that modifier to the dice
    // (applyHeldWeaponAugmentToDamageEffect); adding it again would double it.
    const augmentSetsDamageModifier = Boolean(heldWeaponAugment?.useSpellcastingAbilityForDamage);
    const abilityPart = augmentSetsDamageModifier ? 0 : (isOffHand ? Math.min(0, abilityMod) : abilityMod);
    // Dueling is a flat term on this weapon hit, not on each typed rider row.
    // Fixed authored monster attacks returned above and retain their own damage.
    const styleBonus = isPrimaryWeaponDamage ? getDuelingDamageBonus(this.getLiveCaster(state), this.ability.weapon) : 0;
    const bonus = abilityPart + this.getWeaponMagicBonus() + styleBonus;
    if (bonus === 0) return effect;
    const dice = effect.damage.dice;
    return { ...effect, damage: { ...effect.damage, dice: `${dice}${bonus > 0 ? '+' : '-'}${Math.abs(bonus)}` } };
  }

  private getHeldWeaponDamageDice(augment: HeldWeaponAugment): string {
    const level = augment.sourceCasterLevel || this.caster.level || 1;
    const diceByLevel = augment.damageDiceByLevel;

    if (level >= 17 && diceByLevel?.level17) return diceByLevel.level17;
    if (level >= 11 && diceByLevel?.level11) return diceByLevel.level11;
    if (level >= 5 && diceByLevel?.level5) return diceByLevel.level5;

    return diceByLevel?.base || this.ability.weapon?.damageDice || '1d4';
  }

  private applyHeldWeaponAugmentToDamageEffect(
    spellEffect: SpellEffect,
    augment: HeldWeaponAugment | null,
    state: CombatState
  ): SpellEffect {
    if (!augment || !isDamageEffect(spellEffect)) {
      return spellEffect;
    }

    const spellcastingDamageModifier = augment.useSpellcastingAbilityForDamage
      ? this.getSpellcastingAbilityModifier(this.getLiveCaster(state), augment)
      : 0;
    const chosenDamageType = this.context.playerInput?.trim().toLowerCase();
    const forceOption = augment.damageTypeChoice?.options.find(option =>
      String(option).toLowerCase() === 'force'
    );
    const useForce = chosenDamageType === 'force' && Boolean(forceOption);
    const weaponNormalType = this.ability.weapon?.damageType || spellEffect.damage.type;
    const dice = this.getHeldWeaponDamageDice(augment);

    // Keep Shillelagh as a normal damage command by translating its weapon
    // override into the dice/type fields the shared damage engine already
    // understands. That preserves resistance, temp HP, critical, and logging
    // behavior instead of creating a spell-specific damage shortcut.
    return {
      ...spellEffect,
      damage: {
        ...spellEffect.damage,
        dice: spellcastingDamageModifier
          ? `${dice}${spellcastingDamageModifier > 0 ? '+' : ''}${spellcastingDamageModifier}`
          : dice,
        type: (useForce ? 'Force' : weaponNormalType) as typeof spellEffect.damage.type
      }
    };
  }

  /**
   * Tavern Brawler (agora-4325.2): an Unarmed Strike by a feat holder deals
   * 1d4 + Strength instead of the flat 1 + Strength the base rules give.
   *
   * The upgrade is applied here, on the mapped damage effect, so it reaches
   * every unarmed attack the command layer resolves — the equipment-derived
   * Unarmed Strike, Flurry of Blows, and any monster or fixture ability that
   * declares attackType 'unarmed' — instead of only the one the character
   * sheet happens to build.
   */
  private applyTavernBrawlerUnarmedDamage(
    spellEffect: SpellEffect,
    attackClassification: ReturnType<typeof getAttackEventClassification>
  ): SpellEffect {
    if (!isDamageEffect(spellEffect)) return spellEffect;
    if (attackClassification.attackType !== 'unarmed') return spellEffect;
    if (!hasTavernBrawler(this.caster)) return spellEffect;

    const strengthModifier = getAbilityModifierValue(this.caster.stats.strength);

    return {
      ...spellEffect,
      damage: {
        ...spellEffect.damage,
        dice: getUnarmedStrikeDamageFormula(this.caster, strengthModifier),
      },
    };
  }

  /**
   * Which Tavern Brawler attack family this ability belongs to, or null when
   * the feat's post-hit shove does not apply to it.
   */
  private getTavernBrawlerAttackKind(
    attackClassification: ReturnType<typeof getAttackEventClassification>
  ): 'unarmed' | 'improvised' | null {
    if (attackClassification.attackType === 'unarmed') return 'unarmed';
    if (this.ability.weapon && isImprovisedWeapon(this.ability.weapon)) return 'improvised';
    return null;
  }

  private consumeOneShotHeldWeaponAugment(
    state: CombatState,
    augment: HeldWeaponAugment | null
  ): CombatState {
    if (!augment?.consumesOnAttackHitOrMiss) {
      return state;
    }

    const spellId = augment.sourceSpellId || this.context.spellId;
    const casterId = augment.sourceCasterId || this.context.caster.id;
    const spellPebblePrefix = `${spellId || 'spell'}-pebble-`;

    const spellCreatedInventoryItems = state.spellCreatedInventoryItems || [];
    const temporaryWeaponEnchantments = state.temporaryWeaponEnchantments || [];

    const nextSpellCreatedInventoryItemIndex = spellCreatedInventoryItems.findIndex(item =>
      item.id.startsWith(spellPebblePrefix)
    );
    const nextTemporaryWeaponEnchantmentIndex = temporaryWeaponEnchantments.findIndex(enchantment =>
      enchantment.spellId === spellId &&
      enchantment.casterId === casterId &&
      Boolean(enchantment.heldWeaponAugment.consumesOnAttackHitOrMiss)
    );

    if (nextSpellCreatedInventoryItemIndex < 0 && nextTemporaryWeaponEnchantmentIndex < 0) {
      return state;
    }

    return {
      ...state,
      spellCreatedInventoryItems: nextSpellCreatedInventoryItemIndex >= 0
        ? [
            ...spellCreatedInventoryItems.slice(0, nextSpellCreatedInventoryItemIndex),
            ...spellCreatedInventoryItems.slice(nextSpellCreatedInventoryItemIndex + 1)
          ]
        : spellCreatedInventoryItems,
      temporaryWeaponEnchantments: nextTemporaryWeaponEnchantmentIndex >= 0
        ? [
            ...temporaryWeaponEnchantments.slice(0, nextTemporaryWeaponEnchantmentIndex),
            ...temporaryWeaponEnchantments.slice(nextTemporaryWeaponEnchantmentIndex + 1)
          ]
        : temporaryWeaponEnchantments
    };
  }

  private async applyDefensiveHitReaction(
    state: CombatState,
    attacker: CombatCharacter,
    target: CombatCharacter,
    attackRoll: number,
    coverBonus: number,
    isCritical = false
  ): Promise<{ state: CombatState; target: CombatCharacter; targetAC: number; isHit: boolean }> {
    // NPCs decide their own defensive reactions. The authored Parry grants
    // AC against THIS melee attack only: keep it local to the hit result,
    // spend the existing Reaction, and never leave a permanent AC bonus.
    // Their named weapon attack is the current monster equipment projection;
    // a future disarm system must remove/disable that projection as well.
    const parry = target.abilities.find(option => option.id === 'parry' && option.cost.type === 'reaction');
    const parryBonus = parry?.description.match(/adds (\d+) to (?:its|their) AC against that attack/i);
    const holdsAuthoredWeapon = target.abilities.some(option => option.type === 'attack' &&
      !option.multiattackCount && (option.weapon || Object.values(WEAPONS_DATA).some(weapon => weapon.name.toLowerCase() === option.name.toLowerCase())));
    const originalAC = (target.armorClass || 10) + coverBonus;
    const bonus = parryBonus ? Number(parryBonus[1]) : 0;
    if (!isCritical && target.team === 'enemy' && target.currentHP > 0 && !isIncapacitated(target) &&
      parry && bonus > 0 && holdsAuthoredWeapon && canAffordActionCost(target, parry.cost) &&
      getAttackEventClassification(this.ability).weaponType === 'melee' &&
      attackRoll >= originalAC && attackRoll < originalAC + bonus) {
      const defended = consumeActionCost(target, parry.cost);
      return {
        state: { ...state,
          characters: state.characters.map(character => character.id === target.id ? defended : character),
          combatLog: [...state.combatLog, {
            id: generateId(), timestamp: Date.now(), type: 'action',
            message: `${target.name} uses Parry (Reaction): AC ${originalAC} + ${bonus} = ${originalAC + bonus} against this attack; ${attackRoll} misses.`,
            characterId: target.id, targetIds: [attacker.id],
            data: { abilityName: parry.name, attackRoll },
          }],
        },
        target: defended, targetAC: originalAC + bonus, isHit: false,
      };
    }
    return resolveDefensiveHitReaction(state, attacker, target, attackRoll, coverBonus, this.context, isCritical);
  }

  async execute(state: CombatState): Promise<CombatState> {
    // A repeat-only Multiattack names one leaf attack and an exact count. Its
    // aggregate effects exist for AI scoring, not as a synthetic damage hit.
    // Resolve each leaf through this same command so attack bonuses, defenses,
    // reactions and consumed riders read the state left by the preceding hit.
    // The caller has already paid the parent action; leaf commands spend none.
    // Explicit repeated alternatives share the AI's reach-aware weapon choice.
    // Fixed mixed/optional sequences still need their own authored planner.
    if (this.ability.multiattackCount && (this.ability.subAttackIds?.length === 1 ||
      repeatedMultiattackOptions(this.getLiveCaster(state), this.ability).length > 0)) {
      const count = this.ability.multiattackCount;
      const options = repeatedMultiattackOptions(this.getLiveCaster(state), this.ability);
      const leaf = options[0];
      if (!Number.isSafeInteger(count) || count < 1 || !leaf || leaf.type !== 'attack' || leaf.multiattackCount) {
        throw new Error(`${this.ability.name} has no valid authored repeat attack.`);
      }
      let sequenceState = state;
      for (let index = 0; index < count; index += 1) {
        const attacker = sequenceState.characters.find(character => character.id === this.caster.id);
        if (!attacker || attacker.currentHP <= 0 || isIncapacitated(attacker)) break;
        const targets = this.targets.flatMap(target => {
          const live = sequenceState.characters.find(character => character.id === target.id);
          // A dying player can still be attacked; a dead or removed target
          // cannot. Do not choose a new victim on behalf of the monster AI.
          return live && (live.currentHP > 0 || (live.team === 'player' && (live.deathSaves?.failures ?? 0) < 3))
            ? [live] : [];
        });
        if (targets.length === 0) break;
        const strike = selectRepeatedAttack(attacker, this.ability, targets[0]);
        // A caller cannot fan one chosen melee weapon out to a distant target
        // merely because that other target has a different legal alternative.
        if (!strike || targets.some(target => selectRepeatedAttack(attacker, this.ability, target)?.id !== strike.id)) {
          throw new Error(`${this.ability.name} has no authored attack in reach of its selected target.`);
        }
        sequenceState = {
          ...sequenceState,
          combatLog: [...sequenceState.combatLog, {
            id: generateId(), timestamp: Date.now(), type: 'status',
            message: `${attacker.name}: ${this.ability.name} — ${strike.name} (${index + 1} of ${count}).`,
            characterId: attacker.id, targetIds: targets.map(target => target.id),
          }],
        };
        sequenceState = await new WeaponAttackCommand(strike, attacker, targets, {
          ...this.context, caster: attacker, targets, spellId: strike.id, spellName: strike.name,
        }).execute(sequenceState);
      }
      return sequenceState;
    }

    let newState = { ...state };
    const riderSystem = new AttackRiderSystem();

    // 1. Process each target (Weapon attacks are usually single target, but could be cleave)
    for (const target of this.targets) {
      const tauntBreak = breakTauntsForEvent(newState.characters, {
        event: 'caster_attacks_other',
        casterId: this.caster.id,
        targetIds: [target.id]
      });
      if (tauntBreak.characters !== newState.characters) {
        newState = {
          ...newState,
          characters: tauntBreak.characters,
          combatLog: [
            ...newState.combatLog,
            ...tauntBreak.breaks.map(record => ({
              id: generateId(),
              timestamp: Date.now(),
              type: 'status' as const,
              message: `${record.spellName} ends because its caster attacks another creature.`,
              characterId: record.casterId,
              targetIds: [record.targetId],
              data: { spellId: record.spellId, tauntBreakEvent: record.event }
            }))
          ]
        };
      }

      newState = await breakFriendsConcentrationForCaster(
        newState,
        this.caster,
        this.context,
        'caster_makes_attack_roll',
        this.ability.name
      );

      // Clone target to modify
      let currentTarget = newState.characters.find(c => c.id === target.id) || target;

      // 2. Roll Attack
      // Check for Disadvantage from target's active effects (e.g., Slasher Grievous Wound)
      let hasDisadvantage = currentTarget.activeEffects?.some(e => {
        // Check if this effect imposes disadvantage on attacks
        if (e.mechanics?.disadvantageOnAttacks !== true) return false;
        // If there's an attacker filter, check if it matches
        const attackerFilter = e.mechanics?.attackerFilter;
        // The shared validator now owns filter matching for both spell and
        // ability command paths; keeping this direct call here advances the
        // runtime away from the deprecated spell-factory wrapper without
        // removing that legacy export yet.
        return !attackerFilter || TargetValidationUtils.matchesFilter(this.caster, attackerFilter);
      }) || false;

      const liveAttacker = newState.characters.find(character => character.id === this.caster.id) ?? this.caster;
      // Source viability is part of the taunt rule, not a presentation detail.
      // Passing the live roster means a downed or removed taunter cannot leave
      // one stale disadvantaged attack behind before cleanup reconciles state.
      if (hasTauntAttackDisadvantage(liveAttacker, currentTarget.id, newState.characters)) {
        hasDisadvantage = true;
      }

      // Grappled (2024 PHB): the held creature attacks anyone other than its
      // grappler with disadvantage. The grappler identity lives on the Grappled
      // condition's `sourceCasterId`, so attacking the grappler itself stays a
      // normal roll while every other target is penalized.
      if (hasGrappledAttackDisadvantage(liveAttacker, currentTarget.id)) {
        hasDisadvantage = true;
      }

      const targetConditionBenefits = conditionAttackBenefits(liveAttacker, currentTarget, newState.mapData);
      let hasAdvantage = targetConditionBenefits.advantage;

      // Hide-derived Hidden is observer-relative: it grants Advantage only
      // while this defender has not detected the source. The status is removed
      // after the roll is published below, so this attack keeps its benefit.
      const hiddenAttackerAdvantage = hasUndetectedHiddenSource(
        liveAttacker,
        currentTarget.id,
      );
      if (hiddenAttackerAdvantage) {
        hasAdvantage = true;
      }

      // ================================================================
      // PRONE ATTACK MODIFIERS (2024 PHB Rules)
      // ================================================================
      // The Prone condition affects attack rolls in two ways, depending
      // on who is prone and how close the combatants are:
      //
      // Rule 1: If the ATTACKER is Prone, they have Disadvantage on all
      //         attack rolls. You can't swing a sword well from the ground.
      //
      // Rule 2: If the TARGET is Prone, the roll modifier depends on distance:
      //   - Within 5 feet (1 tile): Advantage — it's easy to hit someone
      //     lying at your feet.
      //   - Beyond 5 feet: Disadvantage — a prone creature presents a
      //     smaller target at range.
      //
      // If both Advantage and Disadvantage apply simultaneously, they
      // cancel out and the roll is made normally (handled downstream
      // in the dice resolution logic, not here).
      // ================================================================

      // Rule 1: Attacker is Prone → Disadvantage on their attack rolls
      if (this.caster.conditions?.some(c => c.name === 'Prone')) {
        hasDisadvantage = true;
      }
      
      // Rule 2: Target is Prone → Advantage if close, Disadvantage if far
      if (currentTarget.conditions?.some(c => c.name === 'Prone')) {
         // getDistance returns grid distance in tiles (1 tile = 5 feet).
         // A distance of 1 or less means the attacker is adjacent (melee range).
         const distance = getDistance(this.caster.position, currentTarget.position);
         if (distance <= 1) {
            hasAdvantage = true;
         } else {
            hasDisadvantage = true;
         }
      }

      // ================================================================
      // SENSE ENFORCEMENT (Darkvision / Blindsight / Blinded / Invisible)
      // ================================================================
      // Per 5e rules:
      //   Blinded attacker → Disadvantage on all attack rolls.
      //   Blinded target   → Advantage for attacker (target can't dodge).
      //   Invisible target → Disadvantage (attacker can't see where to aim).
      //   Invisible/unseen attacker → Advantage (target can't anticipate).
      //   Darkness + no Darkvision → effectively can't see → Disadvantage.
      // ================================================================

      // --- Condition-based ---
      if (this.caster.conditions?.some(c => c.name === 'Blinded')) {
        hasDisadvantage = true;
      }
      if (currentTarget.conditions?.some(c => c.name === 'Blinded')) {
        hasAdvantage = true;
      }
      const invisibleBenefitSuppressed = currentTarget.activeEffects?.some(effect =>
        effect.mechanics?.suppressedConditionBenefit?.toLowerCase?.() === 'invisible'
      ) ?? false;

      if (currentTarget.conditions?.some(c => c.name === 'Invisible') && !invisibleBenefitSuppressed) {
        hasDisadvantage = true;
      }

      // Shocking Grasp gets advantage against a metal-armored target. Keep the
      // rule close to the rest of the attack-roll advantage calculation so it
      // participates in the normal advantage/disadvantage cancellation logic.
      if (isShockingGraspMetalArmorAdvantage(this.ability, currentTarget)) {
        hasAdvantage = true;
      }
      if (this.caster.conditions?.some(c => c.name === 'Invisible')) {
        hasAdvantage = true;
      }

      // --- Production visibility (dark maps only) ---
      // Cave and dungeon attacks ask the same VisibilitySystem used by both
      // battle-map renderers. This preserves exact sense radii, makes mundane
      // darkness dim through Darkvision, lets Blindsight work only inside its
      // radius, and keeps magical darkness or blocked geometry hidden.
      let targetUnseen = false;
      if (state.mapData && (state.mapData.theme === 'cave' || state.mapData.theme === 'dungeon')) {
        const lightLevels = VisibilitySystem.calculateLightLevels(
          state.mapData,
          state.activeLightSources ?? []
        );
        const targetTileId = `${currentTarget.position.x}-${currentTarget.position.y}`;
        const targetVisibility = VisibilitySystem.calculateVisibility(
          liveAttacker,
          state.mapData,
          lightLevels
        ).get(targetTileId) ?? 'hidden';

        // An unseen target can still be attacked when its location is known,
        // but the attack roll has Disadvantage. Dim visibility is sufficient
        // for an ordinary attack and remains dim for perception/rendering.
        targetUnseen = targetVisibility === 'hidden';
        if (targetUnseen) {
          hasDisadvantage = true;
        }
      }


      // --- Active Effect Riders (e.g. Bless, Bane) ---
      let attackRiderDiceTotal = 0;
      let attackRiderFlatTotal = 0;
      const attackRiderSources: string[] = [];

      const rollClassification = { ...getAttackEventClassification(this.ability),
        weaponType: this.ability.attackType === 'unarmed' || isUnarmedStrikeAbility(this.ability) ? 'unarmed' as const
          : this.isRangedWeaponAttack() ? 'ranged' as const : 'melee' as const };

        const processAttackRider = (activeEffect: any, direction: 'incoming' | 'outgoing') => {
         if (!activeEffect.mechanics || activeEffect.mechanics.attackRollDirection !== direction) return;

          // Some outgoing riders only apply against one named defender. Chill
          // Touch's Undead rider is the current case: the Undead is worse at
          // attacking the caster who hit it, not at attacking every creature.
          if (
            direction === 'outgoing' &&
            activeEffect.mechanics.attackRollTargetId &&
            activeEffect.mechanics.attackRollTargetId !== currentTarget.id
          ) {
            return;
          }

        const mod = activeEffect.mechanics.attackRollModifier;
        if (mod === 'advantage') hasAdvantage = true;
        if (mod === 'disadvantage') hasDisadvantage = true;

        if (mod === 'bonus' || mod === 'penalty') {
          const diceStr = activeEffect.mechanics.attackRollDice;
          if (diceStr) {
             const val = rollDice(diceStr, { rng: this.context.attackRollRng });
             const signedVal = mod === 'bonus' ? val : -val;
             attackRiderDiceTotal += signedVal;
             attackRiderSources.push(`${signedVal >= 0 ? '+' : ''}${signedVal} [${activeEffect.sourceName}]`);
          }
          const flat = activeEffect.mechanics.attackRollValue;
          if (typeof flat === 'number') {
             const signedFlat = mod === 'bonus' ? flat : -flat;
             attackRiderFlatTotal += signedFlat;
             attackRiderSources.push(`${signedFlat >= 0 ? '+' : ''}${signedFlat} [${activeEffect.sourceName}]`);
          }
        }
      };

      matchingAttackRollEffects(liveAttacker, 'outgoing', rollClassification, currentTarget.id).forEach(eff => processAttackRider(eff, 'outgoing'));
      matchingAttackRollEffects(currentTarget, 'incoming', rollClassification).forEach(eff => processAttackRider(eff, 'incoming'));

      // Racial Modifiers
      this.caster.modifiers?.advantage.forEach(adv => {
        if (adv.toLowerCase().includes('attack')) hasAdvantage = true;
      });
      this.caster.modifiers?.disadvantage.forEach(dis => {
        if (dis.toLowerCase().includes('attack')) hasDisadvantage = true;
      });

      // Temporary attack advantage/disadvantage from active status effects
      // (e.g. Reckless Attack, Steady Aim). Mirrors the save resolver, which
      // already reads statusEffects[].modifiers, so status-based attack buffs work.
      this.caster.statusEffects?.forEach(se => {
        if (se.modifiers?.advantage?.includes('attack')) hasAdvantage = true;
        if (se.modifiers?.disadvantage?.includes('attack')) hasDisadvantage = true;
      });
      // Reckless Attack downside: a creature that has attacked recklessly grants
      // advantage on attack rolls made against it until its next turn.
      if (currentTarget.conditions?.some(c => c.name === 'Reckless')) {
        hasAdvantage = true;
      }
      // Bardic Inspiration: an Inspired creature has advantage on its next attack
      // (this engine approximates the inspiration die with advantage).
      if (this.caster.conditions?.some(c => c.name === 'Inspired')) {
        hasAdvantage = true;
      }

      // G14 combat-elevation house rule: a melee attacker whose feet sit a
      // full five-foot band above the target presses downhill (Advantage),
      // and one fighting uphill from below suffers Disadvantage. Both flags
      // funnel through rollD20's cancel-out rule like every other source.
      // Ranged attacks stay outside the rule; sight geometry owns them. The
      // altitude helper already honors explicit flying altitudes.
      const isRangedAttackForHighGround = this.isRangedWeaponAttack(); // GG-495
      if (
        state.mapData &&
        currentTarget &&
        !isRangedAttackForHighGround
      ) {
        const elevationRoll = getHighGroundAdvantage(
          getCombatantAltitudeFeet(this.caster, state.mapData, this.caster.position),
          getCombatantAltitudeFeet(currentTarget, state.mapData, currentTarget.position),
        );
        if (elevationRoll.modifier === 'advantage') {
          hasAdvantage = true;
        } else if (elevationRoll.modifier === 'disadvantage') {
          hasDisadvantage = true;
        }
      }

      // Assassinate (Assassin rogue, level 3). The rider module owns the whole
      // rule; this supplies the two facts it cannot read out of combat state:
      // who is attacking whom, and whether the CALLER reported the target as
      // Surprised. `resolved` is false for every non-Assassin and for any state
      // whose initiative order does not contain the target, and both modifiers
      // are then false, so nothing changes for anyone else.
      const assassinate = resolveAssassinateAgainstTarget(newState, {
        assassinId: this.caster.id,
        targetId: currentTarget.id,
        targetIsSurprised: this.context.surprisedTargetIds?.includes(currentTarget.id) === true,
      });
      if (assassinate.modifiers.advantage) {
        hasAdvantage = true;
      }

      // A ranged weapon remains pressured even when this enemy has spent its
      // reaction. Sight and capability, not remaining reactions, own this rule.
      const closeCombatPressure = this.isRangedWeaponAttack() && rangedAttackPressure(newState, liveAttacker, this.ability);
      if (closeCombatPressure) hasDisadvantage = true;

      // GG-495: past the normal range but within the long range, a ranged or
      // thrown attack roll has Disadvantage (PHB). Distance uses the same
      // footprint- and altitude-aware measure as targeting (useTargetValidator).
      const longRangeShot = Boolean(state.mapData)
        && isAtLongRange(
          this.ability,
          getCombatDistanceFeet(liveAttacker, currentTarget, state.mapData!) / 5,
        );
      if (longRangeShot) hasDisadvantage = true;

      // Use centralized rollD20 with integrated advantage/disadvantage handling
      const d20 = rollD20({
        advantage: hasAdvantage && !hasDisadvantage,
        disadvantage: hasDisadvantage && !hasAdvantage,
        rng: this.context.attackRollRng,
      });

      let rollStr = `Rolled ${d20}`;
      if (hasAdvantage && !hasDisadvantage) {
        rollStr += ` (with Advantage)`;
      } else if (hasDisadvantage && !hasAdvantage) {
        rollStr += ` (with Disadvantage)`;
      } else if (hasAdvantage && hasDisadvantage) {
        rollStr += ` (Advantage and Disadvantage cancel out)`;
      }

      // Attribute the visibility rule that actually affected this attack. Keep
      // the reason even when Advantage cancels it; do not guess whether darkness,
      // a sight blocker or a sense radius caused the shared hidden result.
      if (targetUnseen) rollStr += ' (Target unseen to attacker)';
      if (targetConditionBenefits.advantage) rollStr += ` (Target ${targetConditionBenefits.condition})`;

      if (closeCombatPressure) rollStr += ` (${RANGED_PRESSURE_REASON})`;
      if (longRangeShot) rollStr += ` (${LONG_RANGE_REASON})`;

      const heldWeaponAugment = this.getMatchingHeldWeaponAugment(newState);
      const liveCaster = this.getLiveCaster(newState);
      let modifiers: number;
      if (this.ability.attackBonus !== undefined) {
        modifiers = this.ability.attackBonus;
      } else {
        const abilityMod = this.getWeaponAttackAbilityModifier(liveCaster, heldWeaponAugment);
        const pb = Math.ceil((liveCaster.level || 1) / 4) + 1;
        const proficiencyBonus = this.ability.isProficient ? pb : 0;
        // GG-496: a magic weapon's +N adds to the attack roll (it was never read).
        modifiers = abilityMod + proficiencyBonus + this.getWeaponMagicBonus();
      }

      // Re-read the live actor for every authored leaf. Exhaustion changes
      // its total once; natural faces, source bonuses and damage stay intact.
      const exhaustionPenalty = getExhaustionD20Penalty(liveCaster);
      modifiers -= exhaustionPenalty;
      if (exhaustionPenalty > 0) rollStr += ` (Exhaustion -${exhaustionPenalty})`;
      modifiers += attackRiderDiceTotal + attackRiderFlatTotal;
      if (attackRiderSources.length > 0) {
        rollStr += ` (Mods: ${attackRiderSources.join(', ')})`;
      }

      // Calculate Cover
      const coverBonus = state.mapData
        ? calculateCover(this.caster.position, currentTarget.position, state.mapData)
        : 0;
      const coverText = coverBonus > 0 ? ` (Cover +${coverBonus})` : '';

      // Determine Target AC
      const baseAC = currentTarget.armorClass || 10;
      let targetAC = baseAC + coverBonus;

      // Resolve Attack
      const preliminaryAttack = resolveAttack(d20, modifiers, targetAC, liveCaster.critThreshold ?? 20);
      let isHit = preliminaryAttack.isHit;
      let isCritical = preliminaryAttack.isCritical;
      const isAutoMiss = preliminaryAttack.isAutoMiss;
      const attackRoll = d20 + modifiers;
      if (isHit) {
        const reactionResult = await this.applyDefensiveHitReaction(
          newState,
          liveCaster,
          currentTarget,
          attackRoll,
          coverBonus,
          isCritical
        );
        newState = reactionResult.state;
        currentTarget = reactionResult.target;
        targetAC = reactionResult.targetAC;
        isHit = reactionResult.isHit;
      }

      // Assassinate turns ANY hit on a surprised creature into a critical. That
      // is a hit-time rule, not a die threshold, so it cannot ride
      // `critThreshold`, which would also turn misses into criticals. It lands
      // here, after the defensive reaction above could still turn a hit into a
      // miss, so a Shield that beats the roll also cancels the critical.
      if (isHit && !isCritical && assassinate.modifiers.criticalOnHit) {
        isCritical = true;
        newState.combatLog.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${this.caster.name}'s Assassinate turns the hit on ${currentTarget.name} into a critical.`,
          characterId: this.caster.id,
          targetIds: [currentTarget.id],
          data: { assassinate: assassinate.modifiers },
        });
      }

      // A condition promotes a confirmed hit, never a miss or an automatic
      // hit. Re-read after defenses, and use the shared footprint/height ruler
      // so reach weapons and ranged attacks obey the same five-foot boundary.
      const hitConditionBenefits = conditionAttackBenefits(this.getLiveCaster(newState), currentTarget, newState.mapData);
      const conditionCritical = isHit && !isCritical && hitConditionBenefits.criticalOnHit
        && hitConditionBenefits.condition && hitConditionBenefits.distanceFeet !== undefined
        ? { condition: hitConditionBenefits.condition, distanceFeet: hitConditionBenefits.distanceFeet }
        : undefined;
      if (conditionCritical) {
        isCritical = true;
        rollStr += ` (${conditionCritical.condition}: hit within 5 ft is critical)`;
      }

      // Publish the structured attack result at the same point the command
      // knows the real hit/miss outcome. Reactive systems and future action
      // envelope bridges should consume this event instead of scraping prose
      // combat-log messages for whether the target was actually hit.
      const attackEventClassification = rollClassification;
      combatEvents.emit({
        type: 'unit_attack',
        attackerId: this.caster.id,
        targetId: currentTarget.id,
        isHit,
        isCrit: isCritical,
        // Preserve the same weapon/spell and melee/ranged classification used
        // by rider matching so event-driven reactive spells can enforce their
        // attack filters without duplicating ability inspection elsewhere.
        attackType: attackEventClassification.attackType,
        weaponType: attackEventClassification.weaponType
      });

      // Frostbite-style outgoing riders live on the creature making the
      // attack. Spend them after they have shaped this roll so the next weapon
      // attack is penalized exactly once.
      newState = this.consumeNextAttackRollRiders(
        newState,
        this.caster.id,
        'outgoing',
        attackEventClassification, currentTarget.id
      );

      // Incoming next-attack riders live on the creature being attacked. Keep
      // this path for target-side smite-style or mark-style effects without
      // confusing them with Frostbite's outgoing rider.
      newState = this.consumeNextAttackRollRiders(
        newState,
        currentTarget.id,
        'incoming',
        attackEventClassification, currentTarget.id
      );
      currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

      // Log Attack Roll
      newState.combatLog.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${this.caster.name} attacks ${currentTarget.name}${coverText}. ${rollStr} + ${modifiers} = ${attackRoll} vs AC ${targetAC}. ${isHit ? (isCritical ? "CRITICAL HIT!" : "HIT!") : (isAutoMiss ? "CRITICAL MISS!" : "MISS.")}`,
        characterId: this.caster.id,
        targetIds: [currentTarget.id],
        // Keep the production log machine-readable as well as player-facing.
        // Scenario proof and reactive consumers can audit the resolved roll
        // without parsing the prose or reimplementing attack truth.
        data: {
          attackRoll: d20,
          attackModifier: modifiers,
          attackTotal: attackRoll,
          targetArmorClass: targetAC,
          isHit,
          isCritical,
          isAutoMiss,
          attackType: attackEventClassification.attackType,
          weaponType: attackEventClassification.weaponType,
          hiddenAttackerAdvantage,
          conditionCritical,
          // Tavern Brawler (agora-4325.2): after a hit with an Unarmed Strike
          // or an Improvised Weapon the feat OFFERS a free 5-foot shove. It is
          // published as data on the attack entry rather than applied here, so
          // the executor or the player decides; resolveTavernBrawlerShove takes
          // the offer when accepted. Absent when the feat does not apply.
          tavernBrawlerShoveOffer: buildTavernBrawlerShoveOffer({
            shover: this.caster,
            target: currentTarget,
            attackKind: this.getTavernBrawlerAttackKind(attackEventClassification),
            isHit,
          }) ?? undefined,
        },
      });

      // Attacking ends only Hide-derived sources that opted into this trigger.
      // Run after the attack result is logged so the current roll retains
      // Advantage, and preserve unrelated Hidden or Invisible state exactly.
      const liveCasterAfterRoll = newState.characters.find(
        character => character.id === this.caster.id,
      );
      if (liveCasterAfterRoll) {
        const reveal = revealHideDerivedHiddenAfterAttack(liveCasterAfterRoll);
        if (reveal.removedStatusIds.length > 0) {
          newState = {
            ...newState,
            characters: newState.characters.map(character => (
              character.id === liveCasterAfterRoll.id ? reveal.character : character
            )),
            combatLog: [
              ...newState.combatLog,
              {
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${liveCasterAfterRoll.name} reveals their position after attacking; Hide-derived Hidden ends.`,
                characterId: liveCasterAfterRoll.id,
                targetIds: [currentTarget.id],
                data: { removedStatusIds: reveal.removedStatusIds },
              },
            ],
          };
        }
      }

      if (!isHit) {
        // Some attack riders are consumed by the next matching attack even on
        // a miss. Lightning Arrow is the pilot case: the primary target takes
        // a data-declared fraction of the rider damage, and the rider is spent
        // so the spell does not wait for another attack.
        if (this.ability.type === 'attack') {
          const missAttackContext: AttackContext = {
            attackerId: this.caster.id,
            targetId: currentTarget.id,
            attackType: attackEventClassification.attackType,
            weaponType: attackEventClassification.weaponType,
            isHit: false,
            targetCreatureTypes: currentTarget.creatureTypes,
          };
          const missRiders = riderSystem.getMatchingRiders(newState, missAttackContext);

          for (const rider of missRiders) {
            if (isDamageEffect(rider.effect) && typeof rider.effect.missDamageMultiplier === 'number') {
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

              // Route miss-rider damage through the same damage command used
              // on hits. The only special part is the data-declared fraction;
              // resistance, immunity, temporary HP, concentration, and damage
              // logging stay owned by the shared damage engine.
              const missDamageContext: CommandContext = {
                ...this.context,
                spellId: rider.spellId,
                spellName: rider.sourceName,
                targets: [currentTarget],
                isCritical: false,
                isMagical: true,
                damageMultiplier: rider.effect.missDamageMultiplier
              };
              const missDamageCommand = new DamageCommand(rider.effect, missDamageContext);
              newState = await missDamageCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
            } else if (isDamageEffect(rider.effect) && rider.effect.areaOfEffect) {
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

              // Lightning Arrow-style riders can carry a secondary burst that
              // is centered on the attack target even when the attack misses.
              // Resolve all creatures in that burst through DamageCommand so
              // saving throws, mitigation, and combat logging use the normal
              // damage path instead of a spell-specific shortcut.
              const burstTargets = this.getRiderAreaTargets(newState, currentTarget, rider.effect.areaOfEffect.size);
              if (burstTargets.length > 0) {
                const burstContext: CommandContext = {
                  ...this.context,
                  spellId: rider.spellId,
                  spellName: rider.sourceName,
                  targets: burstTargets,
                  isCritical: false,
                  isMagical: true
                };
                const burstCommand = new DamageCommand(rider.effect, burstContext);
                newState = await burstCommand.execute(newState);
                currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
              }
            }
          }

          if (missRiders.length > 0) {
            newState = riderSystem.consumeRiders(newState, this.caster.id, missRiders);
          }
        }
        newState = this.consumeOneShotHeldWeaponAugment(newState, heldWeaponAugment);
        continue;
      }

      let matchingHitRiders: ReturnType<AttackRiderSystem['getMatchingRiders']> = [];
      let attackPayloadIsReplaced = false;

      if (this.ability.type === 'attack') {
        const attackContext: AttackContext = {
          attackerId: this.caster.id,
          targetId: currentTarget.id,
          attackType: attackEventClassification.attackType,
          weaponType: attackEventClassification.weaponType,
          isHit: true,
          targetCreatureTypes: currentTarget.creatureTypes,
        };

        matchingHitRiders = riderSystem.getMatchingRiders(newState, attackContext);
        attackPayloadIsReplaced = matchingHitRiders.some(rider =>
          isDamageEffect(rider.effect) &&
          rider.effect.objectTransformation?.sourceObject === 'weapon_or_ammunition_used_for_attack'
        );
      }

      // 3. Apply Base Ability Effects
      if (!attackPayloadIsReplaced) {
        for (let effectIndex = 0; effectIndex < this.ability.effects.length; effectIndex += 1) {
          const abilityEffect = this.ability.effects[effectIndex];
          const mappedSpellEffect = AbilityEffectMapper.mapToSpellEffect(abilityEffect);
          if (!mappedSpellEffect) continue;
          const augmentedSpellEffect = this.applyHeldWeaponAugmentToDamageEffect(mappedSpellEffect, heldWeaponAugment, newState);
          const brawlerSpellEffect = this.applyTavernBrawlerUnarmedDamage(augmentedSpellEffect, attackEventClassification);
          const spellEffect = this.applyWeaponDamageBonus(brawlerSpellEffect, heldWeaponAugment, newState,
            effectIndex === this.ability.effects.findIndex(effect => effect.type === 'damage'));

          const subContext: CommandContext = {
            ...this.context,
            targets: [currentTarget],
            isCritical,
            // GG-495: DamageCommand treats a 'ranged' entry as "not a melee
            // weapon attack" (Savage Attacks); item data never carries one, so
            // mark ranged and thrown attacks here.
            weaponProperties: this.isRangedWeaponAttack() && this.ability.weapon
              ? [...(this.ability.weapon.properties ?? []), 'ranged']
              : this.ability.weapon?.properties,
            // GG-496: a +N weapon is a magic weapon for resistance purposes.
            isMagical: this.ability.isMagical || heldWeaponAugment?.isMagical || this.getWeaponMagicBonus() > 0,
          };

          let command: SpellCommand | null = null;
          switch (spellEffect.type) {
            case 'DAMAGE': {
              // Consecutive typed rows belong to this one confirmed hit. A
              // Ghoul Bite's piercing and necrotic parts retain their defenses
              // while sharing reactions, HP/downing and concentration. Status
              // and other ordered effects keep their original command order.
              // Later separately dispatched class/rider damage is not silently
              // pulled into this base-ability packet.
              const damageEffects = [spellEffect];
              while (this.ability.effects[effectIndex + 1]?.type === 'damage') {
                effectIndex += 1;
                const mapped = AbilityEffectMapper.mapToSpellEffect(this.ability.effects[effectIndex]);
                if (!mapped) continue;
                const augmented = this.applyHeldWeaponAugmentToDamageEffect(mapped, heldWeaponAugment, newState);
                const brawler = this.applyTavernBrawlerUnarmedDamage(augmented, attackEventClassification);
                const nextDamage = this.applyWeaponDamageBonus(brawler, heldWeaponAugment, newState, false);
                if (isDamageEffect(nextDamage)) damageEffects.push(nextDamage);
              }
              command = DamageCommand.forWeaponHit(damageEffects, subContext);
              break;
            }
            case 'HEALING': command = new HealingCommand(spellEffect, subContext); break;
            case 'STATUS_CONDITION': command = new StatusConditionCommand(spellEffect, subContext); break;
          }

          if (command) {
            newState = await command.execute(newState);
            // Refresh target
            currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
          }
        }

        newState = this.consumeOneShotHeldWeaponAugment(newState, heldWeaponAugment);

        if (isBoomingBladeRuntimeAbility(this.ability) && this.ability.boomingBladeMovementEffects?.length) {
          // Booming Blade's delayed thunder damage belongs on the creature that
          // was actually hit, not on every creature the spell originally
          // targeted. Recording it here preserves the hit gate and gives the
          // movement executor a normal MovementTriggerDebuff to consume later.
          const movementDebuff = createMovementDebuff(
            this.ability.sourceSpellId ?? 'booming-blade',
            this.caster.id,
            currentTarget.id,
            this.ability.boomingBladeMovementEffects,
            newState.turnState.currentTurn,
            this.ability.boomingBladeDurationRounds ?? 1
          );
          const stateWithMovementDebuffs = newState as CombatState & { movementDebuffs?: MovementTriggerDebuff[] };
          newState = {
            ...newState,
            movementDebuffs: [
              ...(stateWithMovementDebuffs.movementDebuffs ?? []),
              movementDebuff
            ]
          } as CombatState;
        }

        if (isGreenFlameBladeRuntimeAbility(this.ability)) {
          // Capture the narrowed ability so the secondary-target lookup and
          // damage command read the same Green-Flame Blade fields without
          // re-widening `this.ability` inside the `find` callback.
          const gfbAbility = this.ability;
          if (
            gfbAbility.greenFlameBladeSecondaryEffect &&
            gfbAbility.greenFlameBladeSecondaryTargetId
          ) {
            const secondaryTarget = newState.characters.find(character =>
              character.id === gfbAbility.greenFlameBladeSecondaryTargetId
            );

            if (secondaryTarget) {
              // The leap spends only after the weapon hit lands, and it keeps the
              // secondary damage on the chosen adjacent creature instead of the
              // primary weapon target.
              const secondaryCommand = new DamageCommand(gfbAbility.greenFlameBladeSecondaryEffect, {
                ...this.context,
                targets: [secondaryTarget],
                isCritical,
                isMagical: true
              });

              newState = await secondaryCommand.execute(newState);
            }
          }
        }
      } else {
        // Lightning Arrow-style riders say the weapon or ammunition becomes
        // the spell payload. That means the normal weapon damage and other
        // attack payloads should not resolve first; the matched rider below is
        // the thing the target takes instead of the attack's ordinary effects.
        newState.combatLog.push({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${this.caster.name}'s attack payload is replaced by a spell rider before normal weapon effects resolve.`,
          characterId: this.caster.id,
          targetIds: [currentTarget.id]
        });
      }

      // ================================================================
      // SNEAK ATTACK TRIGGER & RESOLUTION (G9)
      // ================================================================
      // Rogue Sneak Attack trigger conditions:
      // 1. Attacker is Rogue class OR has the sneak_attack feature.
      // 2. Has not used Sneak Attack yet this turn.
      // 3. Is using a Finesse weapon or a Ranged weapon.
      // 4. Trigger requirement:
      //    - Attacker has Advantage (and not Disadvantage)
      //    OR
      //    - Attacker has an active, conscious adjacent ally to the target
      //      (within 1 tile / 5 feet) AND does not have Disadvantage.
      // ================================================================
      const isRogue = this.caster.class.id === 'rogue' || this.caster.feats?.includes('sneak_attack');
      const hasUsedSneakAttack = this.caster.featUsageThisTurn?.includes('sneak_attack');
      
      const isFinesse = this.ability.weapon?.properties?.some(p => p.toLowerCase() === 'finesse');
      const isRanged = this.isRangedWeaponAttack(); // GG-495: a reach weapon is not ranged
      const isEligibleWeapon = isFinesse || isRanged;

      if (!attackPayloadIsReplaced && isRogue && !hasUsedSneakAttack && isEligibleWeapon) {
        const hasAdv = hasAdvantage && !hasDisadvantage;
        const hasDisadv = hasDisadvantage && !hasAdvantage;

        // Check for an active, conscious adjacent ally of the attacker to the target (HP > 0 and within 1 tile)
        const adjacentAlly = newState.characters.find(c => 
          c.team === this.caster.team && 
          c.id !== this.caster.id && 
          c.currentHP > 0 && 
          getDistance(c.position, currentTarget.position) <= 1
        );

        if (hasAdv || (!!adjacentAlly && !hasDisadv)) {
          // Sneak Attack triggered!
          const rogueLevel = this.caster.level || 1;
          const sneakAttackDiceNum = Math.ceil(rogueLevel / 2);
          const sneakAttackDice = `${sneakAttackDiceNum}d6`;
          const baseWeaponDamageType = this.ability.effects.find(e => e.type === 'damage')?.damageType || 'piercing';

          const sneakAttackEffect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'immediate' },
            condition: { type: 'hit' },
            damage: {
              dice: sneakAttackDice,
              type: baseWeaponDamageType
            }
          };

          const sneakAttackContext: CommandContext = {
            ...this.context,
            targets: [currentTarget],
            isCritical
          };

          const sneakAttackCommand = new DamageCommand(sneakAttackEffect, sneakAttackContext);
          newState = await sneakAttackCommand.execute(newState);
          
          // Refresh target and caster references in the updated state
          currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

          // Mark Sneak Attack as used this turn on the caster in characters list
          newState = {
            ...newState,
            characters: newState.characters.map(c => 
              c.id === this.caster.id 
                ? { ...c, featUsageThisTurn: [...(c.featUsageThisTurn || []), 'sneak_attack'] }
                : c
            )
          };

          // Also update the local reference of caster's featUsageThisTurn for subsequent target checks in the cleave loop
          this.caster = newState.characters.find(c => c.id === this.caster.id) || this.caster;

          // Log the Sneak Attack trigger
          newState.combatLog.push({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${this.caster.name}'s Sneak Attack triggers! Dealing an extra ${sneakAttackDice} ${baseWeaponDamageType} damage.`,
            characterId: this.caster.id,
            targetIds: [currentTarget.id]
          });
        }
      }

      // ================================================================
      // COLOSSUS SLAYER (Hunter ranger, level 3)
      // ================================================================
      // Once on each of the ranger's turns, extra damage against a creature
      // already below its hit point maximum. The rider module owns eligibility,
      // the dice, and the once-per-turn ledger; it returns the bonus and the
      // state with the ledger spent. The bonus travels through DamageCommand so
      // it is one more damage packet under the shared damage engine rather than
      // a hand-subtracted hit point.
      if (!attackPayloadIsReplaced) {
        const colossus = resolveColossusSlayerOnHit(newState, {
          rangerId: this.caster.id,
          targetId: currentTarget.id,
          rng: this.context.damageRng,
        });

        if (colossus.resolved) {
          newState = colossus.state;
          const colossusDamageType = this.ability.effects
            .find(effect => effect.type === 'damage')?.damageType || 'piercing';
          const colossusCommand = new DamageCommand({
            type: 'DAMAGE',
            trigger: { type: 'immediate' },
            condition: { type: 'hit' },
            damage: { dice: String(colossus.bonusDamage), type: colossusDamageType }
          }, {
            ...this.context,
            spellName: 'Colossus Slayer',
            targets: [currentTarget],
            // The rider module already rolled its die. Doubling it here would
            // roll the same bonus twice on a critical.
            isCritical: false,
          });
          newState = await colossusCommand.execute(newState);
          currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
          this.caster = newState.characters.find(c => c.id === this.caster.id) || this.caster;

          newState.combatLog.push({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${this.caster.name}'s Colossus Slayer adds ${colossus.bonusDamage} damage.`,
            characterId: this.caster.id,
            targetIds: [currentTarget.id],
            data: { damageDealt: colossus.bonusDamage },
          });
        }
      }

      // 4. Rider System Integration (Restored)
      if (this.ability.type === 'attack') {
        const matchingRiders = matchingHitRiders;

        if (matchingRiders.length > 0) {
          for (const rider of matchingRiders) {
            // Determine effect type
            if (isDamageEffect(rider.effect)) {
              // Area riders resolve around the attack target rather than
              // replacing the attack target. Lightning Arrow uses this for
              // the 10-foot secondary burst that follows its primary hit or
              // miss damage, while single-target riders still use the target
              // that was actually attacked.
              const riderDamageTargets = rider.effect.areaOfEffect
                ? this.getRiderAreaTargets(newState, currentTarget, rider.effect.areaOfEffect.size)
                : [currentTarget];

              if (riderDamageTargets.length === 0) continue;

              // Create Damage Command for Rider
              const dmgContext: CommandContext = {
                ...this.context,
                // Rider payloads belong to the spell that registered the rider,
                // not to the weapon button that happened to trigger it. Keep
                // hit-rider command metadata aligned with the miss-rider path so
                // logs, concentration side effects, and downstream proof can
                // identify Lightning Arrow or a smite as the actual source.
                spellId: rider.spellId,
                spellName: rider.sourceName,
                isMagical: true,
                targets: riderDamageTargets,
                isCritical
              };
              const dmgCommand = new DamageCommand(rider.effect, dmgContext);
              newState = await dmgCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

              newState.combatLog.push({
                id: generateId(),
                timestamp: Date.now(),
                type: 'damage',
                message: `${this.caster.name}'s ${rider.sourceName} triggers: ${rider.effect.damage.dice} ${rider.effect.damage.type} damage.`,
                characterId: this.caster.id,
                targetIds: [currentTarget.id]
              });

            } else if (isStatusConditionEffect(rider.effect)) {
              const statusContext: CommandContext = {
                ...this.context,
                // Status riders such as Blinding Smite are produced by the
                // reaction spell even though a weapon attack delivered them.
                // Preserve that spell identity for saved condition metadata and
                // future cleanup/proof instead of attributing the condition to
                // the base attack ability.
                spellId: rider.spellId,
                spellName: rider.sourceName,
                isMagical: true,
                targets: [currentTarget],
                isCritical
              };
              const statusCommand = new StatusConditionCommand(rider.effect, statusContext);
              newState = await statusCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
            } else if (isAttackRollModifierEffect(rider.effect)) {
              // Shining Smite-style riders do not deal only damage. They also
              // leave a rule on the hit target so later attacks against that
              // target get advantage while the spell remains active. Route that
              // payload through the existing attack-roll modifier command
              // instead of hard-coding the smite inside weapon attacks.
              const modifierContext: CommandContext = {
                ...this.context,
                // Attack-roll modifier riders such as Shining Smite need their
                // active-effect and light-source records to point back to the
                // rider spell. Otherwise the shared command path can apply the
                // right behavior while leaving misleading source metadata.
                spellId: rider.spellId,
                spellName: rider.sourceName,
                isMagical: true,
                targets: [currentTarget],
                isCritical
              };
              const modifierCommand = new AttackRollModifierCommand(rider.effect, modifierContext);
              newState = await modifierCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
            }
          }

          // Handle Consumption
          newState = riderSystem.consumeRiders(newState, this.caster.id, matchingRiders);
        }
      }
    }

    return newState;
  }

  /**
   * Spend one-shot attack-roll riders only after a matching weapon attack is
   * actually rolled. Outgoing riders live on the attacker, incoming riders live
   * on the target; checking the direction keeps Frostbite and target-side
   * attack marks from consuming each other.
   */
  private consumeNextAttackRollRiders(
    state: CombatState, characterId: string, direction: 'incoming' | 'outgoing',
    attackClassification: ReturnType<typeof getAttackEventClassification>, defenderId?: string
  ): CombatState {
    const owner = state.characters.find(character => character.id === characterId);
    return owner ? consumeMatchedAttackRollEffects(state, characterId,
      matchingAttackRollEffects(owner, direction, attackClassification, defenderId)) : state;
  }

  private getRiderAreaTargets(
    state: CombatState,
    centerTarget: CombatCharacter,
    radiusFeet: number
  ): CombatCharacter[] {
    const radiusTiles = Math.ceil(radiusFeet / 5);

    // Rider area payloads are centered on the creature that was attacked, not
    // on the original caster or the spell-cast target. The center creature has
    // already received the primary rider payload, so exclude it from the burst
    // list and let the area rider cover only nearby secondary creatures.
    return state.characters.filter(character =>
      character.currentHP > 0 &&
      character.id !== centerTarget.id &&
      getDistance(centerTarget.position, character.position) <= radiusTiles
    );
  }
}

export class AbilityCommandFactory {
  // ==========================================================================
  // Non-Attack Effect Commands
  // ==========================================================================
  // This section preserves the command pipeline for simple utility abilities
  // without pretending every ability is a weapon swing. Healing and status
  // effects can use the same command layer as spells; movement effects remain
  // with useActionExecutor because Dash changes current-turn movement economy.
  // ==========================================================================

  private static createEffectCommand(effect: SpellEffect, context: CommandContext): SpellCommand | null {
    if (isDamageEffect(effect)) {
      return new DamageCommand(effect, context);
    }

    if (isHealingEffect(effect)) {
      return new HealingCommand(effect, context);
    }

    if (isStatusConditionEffect(effect)) {
      return new StatusConditionCommand(effect, context);
    }

    if (isMovementEffect(effect) && effect.movementType === 'teleport') {
      // Teleport has a concrete landing resolution, so it keeps its command
      // path even while the broader movement-economy bridge stays centralized.
      return new MovementCommand(effect, context);
    }

    // Other movement effects stay out of this path for now. Dash/Disengage are
    // current-turn rule changes, and useActionExecutor owns that resource
    // mutation so action economy stays centralized.
    return null;
  }

  private static createDirectAbilityCommand(
    effect: AbilityEffect,
    context: CommandContext
  ): SpellCommand | null {
    // Familiar pocketing is a combat action, but it is not a normal spell
    // effect such as damage or healing. Keep it in the command pipeline so the
    // runtime state change stays centralized instead of being handled by
    // `useSummons` or local component state.
    if (effect.type === 'familiar_shared_senses') {
      return new FamiliarSharedSensesCommand(context, {
        familiarId: effect.familiarId
      });
    }

    if (effect.type === 'familiar_pocket') {
      if (effect.familiarPocketAction === 'recall') {
        return new RecallFamiliarFromPocketCommand(context, {
          familiarId: effect.familiarId
        });
      }

      return new DismissFamiliarToPocketCommand(context, {
        familiarId: effect.familiarId
      });
    }

    // Commandable summons without bespoke attacks still need a real executable
    // path. Route their generated utility ability into a lightweight command so
    // using the button creates combat-log proof instead of silently producing no
    // command from an empty effect list.
    if (effect.type === 'commanded_summon') {
      return new CommandedSummonCommand(context, {
        description: effect.summonCommandDescription
      });
    }

    // Generic non-familiar summon dismissal and Planar Ally return-home actions
    // are spell-lifecycle commands, not damage/healing/status effects. Route
    // them directly so generated caster buttons remove the matching summon from
    // combat state through the same command pipeline as other abilities.
    if (effect.type === 'summon_dismiss') {
      return new DismissSummonCommand(context, {
        summonId: effect.summonId
      });
    }

    if (effect.type === 'summon_return_home') {
      return new SummonReturnHomeCommand(context, {
        summonId: effect.summonId,
        summonReturnHomeAction: effect.summonReturnHomeAction
      });
    }

    // Post-cast granted actions, such as illusion manipulation or sustained
    // spell beams, are real player choices even before their spell-specific
    // payloads are fully wired. Keep them executable and logged through the
    // command pipeline instead of leaving the generated button inert.
    if (effect.type === 'granted_action') {
      return new GrantedActionCommand(context, {
        actionLabel: effect.grantedActionLabel,
        actionCost: effect.grantedActionCost,
        frequency: effect.grantedActionFrequency,
        rangeLimit: effect.grantedActionRangeLimit,
        prerequisites: effect.grantedActionPrerequisites,
        attackType: effect.grantedActionAttackType,
        areaShape: effect.grantedActionAreaShape,
        areaSize: effect.grantedActionAreaSize,
        areaSizeUnit: effect.grantedActionAreaSizeUnit,
        damageDice: effect.grantedActionDamageDice,
        damageType: effect.grantedActionDamageType,
        saveType: effect.grantedActionSaveType,
        saveEffect: effect.grantedActionSaveEffect,
        damageAbilityModifier: effect.grantedActionDamageAbilityModifier,
        wallLengthReduction: effect.grantedActionWallLengthReduction,
        endsWhenLengthZero: effect.grantedActionEndsWhenLengthZero,
        socialServiceRequest: effect.grantedActionSocialServiceRequest,
        notes: effect.grantedActionNotes
      });
    }

    return null;
  }

  // ==========================================================================
  // Ability To Command Translation
  // ==========================================================================
  // This is the narrow bridge from battle-map Ability data into executable
  // command objects. Attack abilities get an attack roll first; non-attacks
  // only run direct effect commands that match their declared effect type.
  // ==========================================================================

  static createCommands(
    ability: Ability,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    gameState: GameState,
    selectedSpellTargets?: SelectedSpellTarget[],
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>,
    randomSources?: Pick<CommandContext, 'attackRollRng' | 'damageRng'>,
    /**
     * Facts only the calling controller knows, which no command can derive from
     * combat state. Today that is the Surprised roster Assassinate needs.
     */
    callerFacts?: Pick<CommandContext, 'surprisedTargetIds'>,
  ): SpellCommand[] {
    const context: CommandContext = {
      // Spell-created utility buttons, such as familiar dismiss/recall, have
      // their own button ids but still need the original spell id for ownership
      // checks and cleanup. Fall back to the ability id for ordinary class,
      // monster, and weapon abilities.
      spellId: ability.sourceSpellId ?? ability.spell?.id ?? ability.id,
      spellName: ability.name,
      castAtLevel: 0,
      caster,
      targets,
      selectedSpellTargets: selectedSpellTargets ?? targets.map(target => ({ kind: 'creature', id: target.id })),
      gameState,
      rulesEdition: getRulesEdition(gameState),
      requestReaction,
      attackRollRng: randomSources?.attackRollRng,
      damageRng: randomSources?.damageRng,
      surprisedTargetIds: callerFacts?.surprisedTargetIds,
    };

    // Spell-created summons can have both a normal action cost and a
    // spell-authored "commands per turn" budget. Build that command gate
    // before attack commands so bespoke summon attacks, such as spirit attacks,
    // cannot bypass the controlled-entity command cadence.
    const commandedSummonGate = ability.effects.find(effect => effect.type === 'commanded_summon');
    const commandedSummonGateCommand = commandedSummonGate
      ? AbilityCommandFactory.createDirectAbilityCommand(commandedSummonGate, context)
      : null;

    if (
      commandedSummonGateCommand &&
      caster.isSummon &&
      caster.summonMetadata &&
      (caster.summonMetadata.commandsUsedThisTurn ?? 0) >= (caster.summonMetadata.commandsPerTurn ?? 1)
    ) {
      return [commandedSummonGateCommand];
    }

    if (ability.type === 'attack') {
      const attackCommand = new WeaponAttackCommand(ability, caster, targets, context);
      return commandedSummonGateCommand
        ? [commandedSummonGateCommand, attackCommand]
        : [attackCommand];
    }

    return ability.effects
      .map(effect => {
        const directCommand = AbilityCommandFactory.createDirectAbilityCommand(effect, context);
        if (directCommand) {
          return directCommand;
        }

        // Forward the parent ability so save-bearing utility/area abilities
        // carry their saveDC and saveAbility onto the mapped damage effect.
        const spellEffect = AbilityEffectMapper.mapToSpellEffect(effect, ability);
        return spellEffect ? AbilityCommandFactory.createEffectCommand(spellEffect, context) : null;
      })
      .filter((command): command is SpellCommand => command !== null);
  }
}
