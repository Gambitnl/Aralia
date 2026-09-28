// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 26/08/2026, 16:56:37
 * Dependents: commands/effects/DamageCommand.ts, components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx, components/DesignPreview/steps/raceDomain/leaves/githyankiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/githzeraiRaceLeaf.tsx, components/DesignPreview/steps/raceDomain/leaves/grayDwarfDuergarRaceLeaf.tsx, components/DesignPreview/steps/scenarioControls/savingThrowsHalfDamageScenarioControls.ts, components/DesignPreview/steps/spells/fireBoltScenario.tsx, services/combatLogService.ts, systems/spells/mechanics/areaDamageSpellCastResolution.ts, systems/spells/mechanics/directDamageSpellCastResolution.ts, utils/combat/combatUtils.ts, utils/combat/index.ts, utils/combat/multiattackUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { DamageType } from '@/types/spells';
import type { CombatCharacter } from '@/types';
import { isPositionInArea, type ActiveSpellZone } from '@/systems/spells/effects/triggerHandler';
import { suppressesResistanceToDamageType } from '@/systems/spells/effects/onDamageSpellEffects';

type ResistanceSpellZone = Pick<
  ActiveSpellZone,
  'id' | 'spellId' | 'casterId' | 'position' | 'areaOfEffect' | 'direction' | 'effects' | 'targetingValidTargets'
>;

/**
 * Optional zone state threaded into damage resolution so protective auras can
 * affect damage the same turn they are active on the map.
 */
export interface ResistanceZoneContext {
  spellZones?: ResistanceSpellZone[];
  characters?: CombatCharacter[];
}

/**
 * Applies damage resistance/vulnerability/immunity logic based on D&D 5e rules.
 * This centralized utility ensures consistent application of rules like:
 * - Immunity > Resistance/Vulnerability
 * - Resistance and Vulnerability cancelling out (XGtE)
 * - Elemental Adept feat bypassing resistance
 */
export class ResistanceCalculator {
  /**
   * Calculate final damage after resistances, vulnerabilities, and immunities.
   *
   * @param baseDamage - Damage before resistances
   * @param damageType - Type of damage
   * @param target - Character taking damage
   * @param source - Source of damage (optional, for checking feats like Elemental Adept)
   * @returns Final damage amount
   *
   * @example
   * // Fire Elemental takes cold damage
   * const finalDamage = ResistanceCalculator.applyResistances(
   *   20,
   *   'Cold',
   *   fireElemental
   * )
   * // Returns 40 (vulnerable to cold)
   *
   * Source: docs/adr/0004-resistance-then-vulnerability-order.md - resistance
   * and vulnerability apply in sequence (2024 rules: halve, then double), not
   * the 2014 cancel rule.
   */
  static applyResistances(
    baseDamage: number,
    damageType: DamageType,
    target: CombatCharacter,
    source?: CombatCharacter | null,
    isMagical?: boolean,
    zoneContext?: ResistanceZoneContext
  ): number {
    return this.getDefenseBreakdown(baseDamage, damageType, target, source, isMagical, zoneContext).finalDamage;
  }

  /**
   * Calculates a full breakdown of defense interactions (immunity, resistance,
   * vulnerability, feat bypasses) along with structured formatting tags.
   */
  static getDefenseBreakdown(
    baseDamage: number,
    damageType: DamageType,
    target: CombatCharacter,
    source?: CombatCharacter | null,
    isMagical?: boolean,
    zoneContext?: ResistanceZoneContext
  ): {
    baseDamage: number;
    finalDamage: number;
    damageType: DamageType;
    isImmune: boolean;
    hasResistance: boolean;
    effectiveResistance: boolean;
    ignoresResistance: boolean;
    hasVulnerability: boolean;
    tags: string[];
  } {
    const formattedType = damageType ? damageType.charAt(0).toUpperCase() + damageType.slice(1).toLowerCase() : 'Untyped';
    const isImmune = this.isImmune(target, damageType, isMagical, zoneContext);
    
    if (isImmune) {
      return {
        baseDamage,
        finalDamage: 0,
        damageType,
        isImmune: true,
        hasResistance: false,
        effectiveResistance: false,
        ignoresResistance: false,
        hasVulnerability: false,
        tags: [`[Immune: ${formattedType}]`],
      };
    }

    const hasResistance = this.isResistant(target, damageType, isMagical, zoneContext);
    const hasVulnerability = this.isVulnerable(target, damageType);

    let elementalAdeptChoice: string | undefined;
    if (source?.featChoices) {
      if (Array.isArray(source.featChoices)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const feat = source.featChoices.find((f: any) => f.featId === 'elemental_adept');
        elementalAdeptChoice = feat?.selection?.selectedDamageType;
      } else {
        const legacy = (source.featChoices as Record<string, any>)['elemental_adept'];
        elementalAdeptChoice = legacy?.selectedDamageType;
      }
    }

    const ignoresResistance = Boolean(
      elementalAdeptChoice &&
      String(elementalAdeptChoice).toLowerCase() === damageType.toLowerCase()
    );

    const effectiveResistance = hasResistance && !ignoresResistance;

    let finalDamage = Math.max(0, baseDamage);
    const tags: string[] = [];

    // WHAT CHANGED (2026-09-09): the breakdown rewrite briefly collapsed
    // "resistance AND vulnerability" into a single cancellation branch that
    // returned baseDamage untouched. WHY IT CHANGED BACK: the project follows
    // the 2024 order - ordinary modifiers first, Resistance second,
    // Vulnerability third - and the two operations must stay sequenced, not
    // cancelled. Odd damage is what exposes the difference: 25 resisted is
    // floor(25 / 2) = 12, then doubled is 24, never 25. WHAT IS PRESERVED: both
    // tags are still emitted when both apply, so the breakdown consumers
    // (combat log badges, defense tooltips) still see the full interaction.
    if (effectiveResistance) {
      finalDamage = Math.floor(finalDamage / 2);
      tags.push(`[Resisted: ${formattedType} (-50%)]`);
    }

    if (hasVulnerability) {
      finalDamage = finalDamage * 2;
      tags.push(`[Vulnerable: ${formattedType} (+100%)]`);
    }

    return {
      baseDamage,
      finalDamage,
      damageType,
      isImmune: false,
      hasResistance,
      effectiveResistance,
      ignoresResistance,
      hasVulnerability,
      tags,
    };
  }

  /**
   * Check if character is immune to damage type.
   * When isMagical is explicitly false, also checks nonMagicalImmunities
   * (e.g. lycanthropes are immune to nonmagical bludgeoning/piercing/slashing).
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for immunities.
   * WHY IT CHANGED: Both status effects and active spell effects (such as Protection
   * from Energy or temporary spell shielding) can grant temporary damage immunities,
   * which are registered under statusEffects[].modifiers.immunity and activeEffects[].mechanics.damageImmunity.
   */
  static isImmune(
    character: CombatCharacter,
    damageType: DamageType,
    isMagical?: boolean,
    zoneContext?: ResistanceZoneContext
  ): boolean {
    const lowerType = damageType.toLowerCase();
    if (character.immunities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    if (isMagical === false && character.nonMagicalImmunities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary immunity modifiers applied by active status effects
    if (character.statusEffects?.some(se => se.modifiers?.immunity?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary immunity modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageImmunity?.some(dt => dt.toLowerCase() === lowerType))) return true;

    // Preserve zone defenses as live battlefield state instead of flattening
    // them into the target record. This lets auras like Silence or similar
    // spell zones grant immunity while the target remains inside the area.
    if (this.hasZoneDefense(character, damageType, zoneContext, 'immunity')) return true;

    return false;
  }

  /**
   * Check if character is resistant to damage type.
   * When isMagical is explicitly false, also checks nonMagicalResistances.
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for resistances.
   * WHY IT CHANGED: Active status effects (like Barbarian Rage) and active spell
   * effects (like Warding or Resist Elements) can grant temporary damage resistances,
   * registered in statusEffects[].modifiers.resistance or activeEffects[].mechanics.damageResistance.
   */
  static isResistant(
    character: CombatCharacter,
    damageType: DamageType,
    isMagical?: boolean,
    zoneContext?: ResistanceZoneContext
  ): boolean {
    const lowerType = damageType.toLowerCase();

    // Elemental Bane-style effects remove resistance without touching immunity
    // or vulnerability. Check the durable status before any resistance source
    // so innate, temporary, nonmagical, and zone resistance all obey the spell.
    if (suppressesResistanceToDamageType(character, damageType)) return false;

    if (character.resistances?.some(dt => dt.toLowerCase() === lowerType)) return true;
    if (isMagical === false && character.nonMagicalResistances?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary resistance modifiers applied by active status effects (e.g., Rage)
    if (character.statusEffects?.some(se => se.modifiers?.resistance?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary resistance modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageResistance?.some(dt => dt.toLowerCase() === lowerType))) return true;

    if (this.hasZoneDefense(character, damageType, zoneContext, 'resistance')) return true;

    return false;
  }

  /**
   * Check if character is vulnerable to damage type.
   * 
   * WHAT CHANGED: Added status effect and active effect modifiers check for vulnerabilities.
   * WHY IT CHANGED: Active status effects and active spell effects can impose temporary damage vulnerabilities
   * registered in statusEffects[].modifiers.vulnerability or activeEffects[].mechanics.damageVulnerability.
   */
  static isVulnerable(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    const lowerType = damageType.toLowerCase();
    if (character.vulnerabilities?.some(dt => dt.toLowerCase() === lowerType)) return true;
    
    // Check for temporary vulnerability modifiers applied by active status effects
    if (character.statusEffects?.some(se => se.modifiers?.vulnerability?.some(dt => dt.toLowerCase() === lowerType))) return true;
    
    // Check for temporary vulnerability modifiers applied by active spell effects (activeEffects)
    if (character.activeEffects?.some(ae => ae.mechanics?.damageVulnerability?.some(dt => dt.toLowerCase() === lowerType))) return true;

    return false;
  }

  /**
   * Check whether any active spell zone at the target's current tile grants the
   * requested defense. This keeps area auras and silence-style zones tied to
   * map position instead of target sheet data.
   */
  private static hasZoneDefense(
    character: CombatCharacter,
    damageType: DamageType,
    zoneContext: ResistanceZoneContext | undefined,
    defenseType: 'resistance' | 'immunity'
  ): boolean {
    const zones = zoneContext?.spellZones;
    if (!zones?.length || !character.position) return false;

    const lowerType = damageType.toLowerCase();

    return zones.some(zone => {
      if (!zone.areaOfEffect) return false;
      if (!isPositionInArea(character.position, zone.position, zone.areaOfEffect, zone.direction)) return false;
      if (!this.zoneAppliesToCharacter(zone, character, zoneContext?.characters)) return false;

      return zone.effects.some(effect => {
        if (effect.type !== 'DEFENSIVE' || effect.defenseType !== defenseType) return false;

        const damageTypes = effect.damageType;
        return Array.isArray(damageTypes) && damageTypes.some(dt => dt.toLowerCase() === lowerType);
      });
    });
  }

  /**
   * Preserve the source spell's targeting intent so ally-only auras do not
   * accidentally apply to enemies just because they share the same area.
   */
  private static zoneAppliesToCharacter(
    zone: ResistanceSpellZone,
    target: CombatCharacter,
    characters?: CombatCharacter[]
  ): boolean {
    const validTargets = zone.targetingValidTargets;
    if (!validTargets?.length) return true;

    const caster = characters?.find(candidate => candidate.id === zone.casterId);
    if (!caster) return false;

    if (target.id === zone.casterId && validTargets.includes('self')) return true;

    const sameTeam = target.team === caster.team;
    if (sameTeam && validTargets.includes('allies')) return true;
    if (!sameTeam && validTargets.includes('enemies')) return true;

    // Point/ground/creature/object zones are treated as spatially universal
    // once they are active on the map.
    if (validTargets.some(targetType => targetType === 'point' || targetType === 'ground' || targetType === 'creatures' || targetType === 'objects')) {
      return true;
    }

    return false;
  }
}
