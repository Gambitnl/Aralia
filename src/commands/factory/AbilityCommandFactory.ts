// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 20:19:40
 * Dependents: commands/index.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { CombatCharacter, Ability, CombatState, AbilityEffect } from '@/types/combat';
import { GameState } from '@/types';
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { DamageCommand } from '../effects/DamageCommand';
import { HealingCommand } from '../effects/HealingCommand';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import { AbilityEffectMapper } from './AbilityEffectMapper';
import { rollDice, generateId, calculateCover, resolveAttack, getDistance, rollD20 } from '@/utils/combatUtils';
import { SpellEffect, isDamageEffect, isHealingEffect, isStatusConditionEffect } from '@/types/spells';
import { AttackRiderSystem, AttackContext } from '@/systems/combat/AttackRiderSystem';
import { VisibilitySystem } from '@/systems/visibility';
import { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../effects/FamiliarPocketCommands';
import { FamiliarSharedSensesCommand } from '../effects/FamiliarSharedSensesCommand';
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils';

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

  async execute(state: CombatState): Promise<CombatState> {
    let newState = { ...state };
    const riderSystem = new AttackRiderSystem();

    // 1. Process each target (Weapon attacks are usually single target, but could be cleave)
    for (const target of this.targets) {
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

      let hasAdvantage = false;

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
      if (currentTarget.conditions?.some(c => c.name === 'Invisible')) {
        hasDisadvantage = true;
      }
      if (this.caster.conditions?.some(c => c.name === 'Invisible')) {
        hasAdvantage = true;
      }

      // --- Lighting-based (dark maps only) ---
      // Skip on bright-ambient maps to avoid the tile-scan cost.
      if (state.mapData && (state.mapData.theme === 'cave' || state.mapData.theme === 'dungeon')) {
        const lightLevels = VisibilitySystem.calculateLightLevels(
          state.mapData,
          state.activeLightSources ?? []
        );
        const targetTileId = `${currentTarget.position.x}-${currentTarget.position.y}`;
        const lightAtTarget = lightLevels.get(targetTileId) ?? 'darkness';

        if (lightAtTarget === 'darkness' || lightAtTarget === 'magical_darkness') {
          // Need darkvision or blindsight ≥ distance (feet) to see the target.
          const distFeet = getDistance(this.caster.position, currentTarget.position) * 5;
          const darkvision = this.caster.stats.senses?.darkvision ?? 0;
          const blindsight = this.caster.stats.senses?.blindsight ?? 0;
          if (darkvision < distFeet && blindsight < distFeet) {
            hasDisadvantage = true;
          }
        }
      }


      // --- Active Effect Riders (e.g. Bless, Bane) ---
      let attackRiderDiceTotal = 0;
      let attackRiderFlatTotal = 0;
      const attackRiderSources: string[] = [];

      const weaponType = (this.ability.range || 5) <= 5 ? 'melee_weapon' : 'ranged_weapon';
      const resolvedAttackKind = this.ability.isMagical ? 'spell' : weaponType;

      const processAttackRider = (activeEffect: any, direction: 'incoming' | 'outgoing') => {
        if (!activeEffect.mechanics || activeEffect.mechanics.attackRollDirection !== direction) return;

        const kind = activeEffect.mechanics.attackRollKind;
        if (kind && kind !== 'any' && kind !== 'weapon' && kind !== resolvedAttackKind) {
           if (kind === 'weapon' && (resolvedAttackKind === 'melee_weapon' || resolvedAttackKind === 'ranged_weapon')) {
              // matches
           } else {
              return;
           }
        }

        const mod = activeEffect.mechanics.attackRollModifier;
        if (mod === 'advantage') hasAdvantage = true;
        if (mod === 'disadvantage') hasDisadvantage = true;

        if (mod === 'bonus' || mod === 'penalty') {
          const diceStr = activeEffect.mechanics.attackRollDice;
          if (diceStr) {
             const val = rollDice(diceStr);
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

      this.caster.activeEffects?.forEach(eff => processAttackRider(eff, 'outgoing'));
      currentTarget.activeEffects?.forEach(eff => processAttackRider(eff, 'incoming'));

      // Racial Modifiers
      this.caster.modifiers?.advantage.forEach(adv => {
        if (adv.toLowerCase().includes('attack')) hasAdvantage = true;
      });
      this.caster.modifiers?.disadvantage.forEach(dis => {
        if (dis.toLowerCase().includes('attack')) hasDisadvantage = true;
      });

      // Use centralized rollD20 with integrated advantage/disadvantage handling
      const d20 = rollD20({
        advantage: hasAdvantage && !hasDisadvantage,
        disadvantage: hasDisadvantage && !hasAdvantage
      });

      let rollStr = `Rolled ${d20}`;
      if (hasAdvantage && !hasDisadvantage) {
        rollStr += ` (with Advantage)`;
      } else if (hasDisadvantage && !hasAdvantage) {
        rollStr += ` (with Disadvantage)`;
      } else if (hasAdvantage && hasDisadvantage) {
        rollStr += ` (Advantage and Disadvantage cancel out)`;
      }

      let modifiers: number;
      if (this.ability.attackBonus !== undefined) {
        modifiers = this.ability.attackBonus;
      } else {
        const strMod = Math.floor((this.caster.stats.strength - 10) / 2);
        const dexMod = Math.floor((this.caster.stats.dexterity - 10) / 2);
        const isRanged = this.ability.range > 1 || this.ability.weapon?.properties?.includes('range');
        const abilityMod = isRanged ? dexMod : strMod;
        const pb = Math.ceil((this.caster.level || 1) / 4) + 1;
        const proficiencyBonus = this.ability.isProficient ? pb : 0;
        modifiers = abilityMod + proficiencyBonus;
      }

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
      const targetAC = baseAC + coverBonus;

      // Resolve Attack
      const { isHit, isCritical, isAutoMiss } = resolveAttack(d20, modifiers, targetAC);
      const attackRoll = d20 + modifiers;

      // Log Attack Roll
      newState.combatLog.push({
        id: generateId(),
        timestamp: Date.now(),
        type: 'action',
        message: `${this.caster.name} attacks ${currentTarget.name}${coverText}. ${rollStr} + ${modifiers} = ${attackRoll} vs AC ${targetAC}. ${isHit ? (isCritical ? "CRITICAL HIT!" : "HIT!") : (isAutoMiss ? "CRITICAL MISS!" : "MISS.")}`,
        characterId: this.caster.id,
        targetIds: [currentTarget.id]
      });

      if (!isHit) {
        continue;
      }

      // 3. Apply Base Ability Effects
      for (const abilityEffect of this.ability.effects) {
        const spellEffect = AbilityEffectMapper.mapToSpellEffect(abilityEffect);
        if (!spellEffect) continue;

        const subContext: CommandContext = {
          ...this.context,
          targets: [currentTarget],
          isCritical,
          weaponProperties: this.ability.weapon?.properties,
          isMagical: this.ability.isMagical,
        };

        let command: SpellCommand | null = null;
        switch (spellEffect.type) {
          case 'DAMAGE': command = new DamageCommand(spellEffect, subContext); break;
          case 'HEALING': command = new HealingCommand(spellEffect, subContext); break;
          case 'STATUS_CONDITION': command = new StatusConditionCommand(spellEffect, subContext); break;
        }

        if (command) {
          newState = await command.execute(newState);
          // Refresh target
          currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
        }
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
      
      const isFinesse = this.ability.weapon?.properties?.includes('finesse');
      const isRanged = this.ability.range > 1 || 
                       this.ability.weapon?.properties?.includes('range') || 
                       this.ability.weapon?.category?.toLowerCase().includes('ranged');
      const isEligibleWeapon = isFinesse || isRanged;

      if (isRogue && !hasUsedSneakAttack && isEligibleWeapon) {
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

      // 4. Rider System Integration (Restored)
      if (this.ability.type === 'attack') {
        const weaponTypeMatch = (this.ability.range || 5) <= 5 ? 'melee' : 'ranged'; // Simple heuristic

        const attackContext: AttackContext = {
          attackerId: this.caster.id,
          targetId: currentTarget.id,
          attackType: 'weapon',
          weaponType: weaponTypeMatch,
          isHit: true
        };

        const matchingRiders = riderSystem.getMatchingRiders(newState, attackContext);

        if (matchingRiders.length > 0) {
          for (const rider of matchingRiders) {
            // Determine effect type
            if (isDamageEffect(rider.effect)) {
              // Create Damage Command for Rider
              const dmgContext: CommandContext = {
                ...this.context,
                targets: [currentTarget],
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
                targets: [currentTarget],
                isCritical
              };
              const statusCommand = new StatusConditionCommand(rider.effect, statusContext);
              newState = await statusCommand.execute(newState);
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

    // Movement and teleport effects intentionally do not create commands here.
    // Dash/Disengage are current-turn rule changes, and useActionExecutor owns
    // that resource mutation so action economy stays centralized.
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
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>
  ): SpellCommand[] {
    const context: CommandContext = {
      spellId: ability.id,
      spellName: ability.name,
      castAtLevel: 0,
      caster,
      targets,
      gameState
    };

    if (ability.type === 'attack') {
      return [new WeaponAttackCommand(ability, caster, targets, context)];
    }

    return ability.effects
      .map(effect => {
        const directCommand = AbilityCommandFactory.createDirectAbilityCommand(effect, context);
        if (directCommand) {
          return directCommand;
        }

        const spellEffect = AbilityEffectMapper.mapToSpellEffect(effect);
        return spellEffect ? AbilityCommandFactory.createEffectCommand(spellEffect, context) : null;
      })
      .filter((command): command is SpellCommand => command !== null);
  }
}
