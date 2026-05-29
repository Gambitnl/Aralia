// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/05/2026, 17:10:53
 * Dependents: commands/index.ts
 * Imports: 11 files
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
import { CombatCharacter, Ability, CombatState } from '@/types/combat';
import { GameState } from '@/types';
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
import { DamageCommand } from '../effects/DamageCommand';
import { HealingCommand } from '../effects/HealingCommand';
import { StatusConditionCommand } from '../effects/StatusConditionCommand';
import { AbilityEffectMapper } from './AbilityEffectMapper';
import { rollDice, generateId, calculateCover, resolveAttack, getDistance } from '@/utils/combatUtils';
import { SpellEffect, isDamageEffect, isHealingEffect, isStatusConditionEffect } from '@/types/spells';
import { SpellCommandFactory } from './SpellCommandFactory';
import { AttackRiderSystem, AttackContext } from '@/systems/combat/AttackRiderSystem';
import { VisibilitySystem } from '@/systems/visibility';

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

  execute(state: CombatState): CombatState {
    let newState = { ...state };
    const riderSystem = new AttackRiderSystem();

    // 1. Process each target (Weapon attacks are usually single target, but could be cleave)
    this.targets.forEach(target => {
      // Clone target to modify
      let currentTarget = newState.characters.find(c => c.id === target.id) || target;

      // 2. Roll Attack
      // Check for Disadvantage from target's active effects (e.g., Slasher Grievous Wound)
      let hasDisadvantage = currentTarget.activeEffects?.some(e => {
        // Check if this effect imposes disadvantage on attacks
        if (e.mechanics?.disadvantageOnAttacks !== true) return false;
        // If there's an attacker filter, check if it matches
        const attackerFilter = e.mechanics?.attackerFilter;
        return !attackerFilter || SpellCommandFactory.matchesFilter(this.caster, attackerFilter);
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
      // But wait, Ability has 'attack' type, what about spells?
      // Actually, `this.ability` in WeaponAttackCommand is an Ability.
      // isMagical indicates spell attack maybe? For now just 'weapon' vs 'spell'.
      // If it's AbilityCommandFactory it's generally weapons, but it could be spell.
      const resolvedAttackKind = this.ability.isMagical ? 'spell' : weaponType;

      const processAttackRider = (activeEffect: any, direction: 'incoming' | 'outgoing') => {
        if (!activeEffect.mechanics || activeEffect.mechanics.attackRollDirection !== direction) return;

        const kind = activeEffect.mechanics.attackRollKind;
        if (kind && kind !== 'any' && kind !== 'weapon' && kind !== resolvedAttackKind) {
           // 'weapon' matches 'melee_weapon' or 'ranged_weapon'
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

      // Racial Modifiers (e.g., Kobold Pack Tactics, though that needs positioning)
      // For now, check simple 'attack' keyword in modifier buckets.
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

      // Use the explicit attackBonus from 5eTools ({@hit N}) when present.
      // This preserves accuracy for monsters with atypical bonuses (e.g. Wisdom-based attacks,
      // racial traits, or abilities that don't follow the STR/DEX + proficiency formula).
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
        return;
      }

      // 3. Apply Base Ability Effects
      this.ability.effects.forEach(abilityEffect => {
        const spellEffect = AbilityEffectMapper.mapToSpellEffect(abilityEffect);
        if (!spellEffect) return;

        const subContext: CommandContext = {
          ...this.context,
          targets: [currentTarget],
          isCritical,
          // WHAT CHANGED: Propagated weapon properties to subContext.
          // WHY IT CHANGED: To decoupling weapon data from damage logic. By 
          // "flattening" the weapon traits into the command context, we allow 
          // DamageCommand to remain weapon-agnostic while still supporting 
          // trait-specific mechanics (e.g., Heavy weapon bonuses).
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
          newState = command.execute(newState);
          // Refresh target
          currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
        }
      });

      // 4. Rider System Integration (Restored)
      if (this.ability.type === 'attack') {
        const weaponType = (this.ability.range || 5) <= 5 ? 'melee' : 'ranged'; // Simple heuristic

        const attackContext: AttackContext = {
          attackerId: this.caster.id,
          targetId: currentTarget.id,
          attackType: 'weapon',
          weaponType: weaponType,
          isHit: true
        };

        const matchingRiders = riderSystem.getMatchingRiders(newState, attackContext);

        if (matchingRiders.length > 0) {
          matchingRiders.forEach(rider => {
            // TODO(FIXME): Critical Gap - This loop ignores MOVEMENT, UTILITY, and other effect types.
            // Thunderous Smite's "Push" (MOVEMENT) is currently dropped.
            // Refactor to use a generic command creation factory (like SpellCommandFactory.createCommand)
            // to handle ALL effect types dynamically.

            // TODO(Refactor): Duplicate Logic.
            // Instead of manually switching on effect type here (and missing types), 
            // expose and use `SpellCommandFactory.createSingleCommand(effect, context)` 
            // to ensure consistent handling of all effect types (Damage, Status, Movement, etc.).

            // Determine effect type
            if (isDamageEffect(rider.effect)) {
              // Create Damage Command for Rider
              const dmgContext: CommandContext = {
                ...this.context,
                targets: [currentTarget],
                isCritical
              };
              const dmgCommand = new DamageCommand(rider.effect, dmgContext);
              newState = dmgCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;

              // TODO(Cleanup): Redundant Log.
              // DamageCommand already generates a combat log entry. 
              // This manual push creates double logs for every smite hit. Remove this block.
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
              newState = statusCommand.execute(newState);
              currentTarget = newState.characters.find(c => c.id === target.id) || currentTarget;
            }
          });

          // Handle Consumption
          newState = riderSystem.consumeRiders(newState, this.caster.id, matchingRiders);
        }
      }
    });

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
    gameState: GameState
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
      .map(effect => AbilityEffectMapper.mapToSpellEffect(effect))
      .filter((effect): effect is SpellEffect => effect !== null)
      .map(effect => AbilityCommandFactory.createEffectCommand(effect, context))
      .filter((command): command is SpellCommand => command !== null);
  }
}
