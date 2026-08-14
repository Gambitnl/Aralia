// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 13:26:19
 * Dependents: None (Orphan)
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { getRacialTraitLibrary } from '../../../../../data/races';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialResourceId,
} from '../../../../../utils/character/characterUtils';
import { calculateArmorClass } from '../../../../../utils/character/statUtils';
import {
  createPlayerCombatCharacter,
  rollDamage,
} from '../../../../../utils/combat/combatUtils';
import { resetEconomy } from '../../../../../utils/combat/actionEconomyUtils';
import {
  resolveHitPointAction,
} from '../../../../../systems/spells/mechanics/healingTemporaryHitPointResolution';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { ActiveEffect, CombatCharacter, TurnState } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file proves the Beasthide Shifter's canonical Shifting transaction in
 * the Tactical Sandbox Race domain.
 *
 * It builds the actor through the production quick-character and racial-parser
 * paths, rolls the canonical 1d6 with an injected deterministic face, and
 * delegates Bonus Action payment plus temporary-HP replacement to the native
 * hit-point resolver. The current bridge cannot make the parsed AC modifier
 * conditional on shifting, so the exact parser gap is shown in the UI and the
 * active-effect calculation is kept as an explicit shifted-state projection.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Beasthide Shifter data, racial trait parsing,
 * quick-character assembly, resolveHitPointAction, and calculateArmorClass.
 */

// ============================================================================
// Canonical Beasthide Shifter Facts
// ============================================================================
// The supplied Race remains the source of truth for the rule text. The
// resource id is resolved from the parser's own trait name so a copied string
// cannot silently drift from the production resource-key convention.
// ============================================================================

export const BEASTHIDE_SHIFTER_CONTROL_ID = 'resolve-beasthide-shifter';
export const BEASTHIDE_SHIFTER_ROLL_CONTROL_ID = 'beasthide-shifter-durability-roll';
export const BEASTHIDE_SHIFTER_ACTOR_ID = 'beasthide-shifter-actor';
export const BEASTHIDE_SHIFTER_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'beasthide_shifter__shifting__resource',
);
export const BEASTHIDE_SHIFTER_EFFECT_ID = 'feature_beasthide_shifter__bestial_durability';

export type BeasthideShifterRollFace = 1 | 2 | 3 | 4 | 5 | 6;

export interface BeasthideShifterResolution {
  status: 'committed' | 'rejected';
  reason:
    | 'committed'
    | 'assembly_unavailable'
    | 'canonical_resource_unavailable'
    | 'invalid_roll'
    | 'resource_unavailable'
    | 'native_rejected';
  rollFace: BeasthideShifterRollFace;
  proficiencyBonus: number;
  temporaryHitPoints: number;
  actor: CombatCharacter | null;
  nativeReason?: string;
}

export interface BeasthideShifterScenarioState {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  proficiencyBonus: number;
  baselineArmorClass: number | null;
  shiftedArmorClass: number | null;
  outcome: string;
  lastResolution: BeasthideShifterResolution | null;
}

const SHIFTING_TRAIT = /^Shifting:\s*/i;
const BESTIAL_DURABILITY_TRAIT = /^Bestial Durability:\s*/i;
const SHIFTING_DURATION_MINUTES = 1;
const SHIFTING_TEMP_HP_DICE = '1d6';
const SHIFTING_BONUS_ACTION = { type: 'bonus' as const };

/** Read one exact canonical Beasthide Shifter trait from the supplied race. */
export function getCanonicalBeasthideShifterTrait(
  race: Race,
  pattern: RegExp,
): string | null {
  return race.traits.find(trait => pattern.test(trait.trim())) ?? null;
}

/** Confirm that the supplied race still contains the complete authored rule. */
export function hasCanonicalBeasthideShifterRules(race: Race): boolean {
  const shifting = getCanonicalBeasthideShifterTrait(race, SHIFTING_TRAIT);
  const durability = getCanonicalBeasthideShifterTrait(race, BESTIAL_DURABILITY_TRAIT);

  return race.id === 'beasthide_shifter'
    && !!shifting
    && !!durability
    && /Bonus Action/i.test(shifting)
    && /1 minute/i.test(shifting)
    && /2 x your Proficiency Bonus/i.test(shifting)
    && /number of times equal to your Proficiency Bonus/i.test(shifting)
    && /Long Rest/i.test(shifting)
    && /1d6 additional temporary hit points/i.test(durability)
    && /\+1 bonus to your Armor Class/i.test(durability);
}

/** Return the parser-created Shifting resource rather than a hand-built use. */
export function getCanonicalBeasthideShifterResource(race: Race) {
  const parsedTraits = getRacialTraitLibrary().byRaceId[race.id] ?? [];
  const shifting = parsedTraits.find(
    trait => trait.type !== 'spell' && trait.traitName === 'Shifting',
  );
  return shifting?.type !== 'spell'
    ? shifting.resources?.find(resource => resource.id.endsWith('__shifting__resource'))
    : undefined;
}

/** Roll the canonical d6 through the native parser with a fixed injected face. */
export function rollBeasthideDurability(face: BeasthideShifterRollFace): number {
  return rollDamage(SHIFTING_TEMP_HP_DICE, false, 1, () => (face - 1) / 6);
}

// ============================================================================
// Production Assembly And AC Projection
// ============================================================================
// The quick character is assembled first, then the canonical racial parser is
// applied. The combat bridge currently omits limitedUses, so this leaf carries
// the parser result across that known boundary while keeping it visible.
// ============================================================================

function createBeasthideShifterActor(race: Race): {
  actor: CombatCharacter | null;
  assembledCharacter: PlayerCharacter | null;
  baselineArmorClass: number | null;
  outcome: string;
} {
  const quickCharacter = createQuickCharacter({
    name: 'Beasthide Shifter - Durability Tester',
    raceId: race.id,
    classId: 'fighter',
    level: 5,
    stats: [10, 14, 14, 10, 10, 10],
  });
  const parsedResource = getCanonicalBeasthideShifterResource(race);

  // A missing canonical record stops before an actor can claim a usable racial feature.
  if (!quickCharacter || !hasCanonicalBeasthideShifterRules(race) || !parsedResource) {
    return {
      actor: null,
      assembledCharacter: null,
      baselineArmorClass: null,
      outcome: 'Shifting unavailable: canonical traits, parser resource, or quick assembly is incomplete.',
    };
  }

  const assembledCharacter = applyRacialSpellGrantsByLevel(
    quickCharacter,
    quickCharacter.level ?? 1,
  );
  const resource = assembledCharacter.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID];

  // The parser must produce the same PB-scaled resource that the transaction will spend.
  if (!resource) {
    return {
      actor: null,
      assembledCharacter,
      baselineArmorClass: null,
      outcome: 'Shifting unavailable: applyRacialSpellGrantsByLevel did not expose the canonical Shifting resource.',
    };
  }

  // The current parser projects Bestial Durability's +1 AC into the persistent
  // modifier list even before shifting. Remove only that unconditional parser
  // projection for the unshifted comparison; the native ActiveEffect below
  // applies the same +1 through calculateArmorClass only after the transaction.
  const unshiftedCalculationCharacter: PlayerCharacter = {
    ...assembledCharacter,
    modifiers: assembledCharacter.modifiers
      ? { ...assembledCharacter.modifiers, acBonus: 0 }
      : assembledCharacter.modifiers,
  };
  const baselineArmorClass = calculateArmorClass(unshiftedCalculationCharacter, []);
  const generatedActor = createPlayerCombatCharacter(assembledCharacter);
  const actor = resetEconomy({
    ...generatedActor,
    id: BEASTHIDE_SHIFTER_ACTOR_ID,
    name: `${race.name} - Durability Tester`,
    position: { x: 2, y: 4 },
    armorClass: baselineArmorClass,
    baseAC: baselineArmorClass,
    activeEffects: [],
    limitedUses: { [BEASTHIDE_SHIFTER_RESOURCE_ID]: { ...resource } },
  });

  return {
    actor,
    assembledCharacter,
    baselineArmorClass,
    outcome: `Ready: ${actor.name}; level ${actor.level}; PB +${actor.level >= 5 ? 3 : 2}; Shifting ${resource.current}/${resource.max}; Bonus Action ready.`,
  };
}

function createBestialDurabilityEffect(actorId: string): ActiveEffect {
  return {
    id: BEASTHIDE_SHIFTER_EFFECT_ID,
    // The ActiveEffect schema requires a source key named spellId. This is a
    // feature key, not a Spell record, and no spell command is invoked here.
    spellId: BEASTHIDE_SHIFTER_EFFECT_ID,
    casterId: actorId,
    sourceName: 'Bestial Durability (while shifted)',
    type: 'buff',
    duration: { type: 'minutes', value: SHIFTING_DURATION_MINUTES },
    startTime: 1,
    mechanics: { acBonus: 1 },
  };
}

function createTurnState(actorId: string): TurnState {
  return {
    currentTurn: 1,
    turnOrder: [actorId],
    currentCharacterId: actorId,
    phase: 'action',
    actionsThisTurn: [],
  };
}

function getShiftedArmorClass(
  assembledCharacter: PlayerCharacter,
  effect: ActiveEffect,
): number {
  const unshiftedCalculationCharacter: PlayerCharacter = {
    ...assembledCharacter,
    modifiers: assembledCharacter.modifiers
      ? { ...assembledCharacter.modifiers, acBonus: 0 }
      : assembledCharacter.modifiers,
  };
  return calculateArmorClass(unshiftedCalculationCharacter, [effect]);
}

// ============================================================================
// Native Shifting Transaction
// ============================================================================
// Resource validation happens before the native resolver. The resolver then
// owns Bonus Action payment and applyTemporaryHitPoints; only a resolved native
// roster is allowed to receive the single atomic resource decrement and AC
// effect projection.
// ============================================================================

export function resolveBeasthideShifter(
  scenario: BeasthideShifterScenarioState,
  race: Race,
  rollFace: BeasthideShifterRollFace,
): BeasthideShifterScenarioState {
  const actor = scenario.actor;
  const resource = actor?.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID];
  const proficiencyBonus = actor?.level ? 2 + Math.floor((actor.level - 1) / 4) : 0;
  const durabilityRoll = rollFace >= 1 && rollFace <= 6 ? rollBeasthideDurability(rollFace) : 0;
  const temporaryHitPoints = proficiencyBonus * 2 + durabilityRoll;

  // Every failed precondition returns the original actor and therefore cannot spend anything.
  if (!actor || !scenario.assembledCharacter || !hasCanonicalBeasthideShifterRules(race)) {
    return {
      ...scenario,
      outcome: 'Shifting rejected atomically: canonical actor assembly or rule data is unavailable.',
      lastResolution: {
        status: 'rejected',
        reason: 'assembly_unavailable',
        rollFace,
        proficiencyBonus,
        temporaryHitPoints,
        actor,
      },
    };
  }
  if (!resource) {
    return {
      ...scenario,
      outcome: 'Shifting rejected atomically: the production parser resource is unavailable; Bonus Action and HP unchanged.',
      lastResolution: {
        status: 'rejected',
        reason: 'canonical_resource_unavailable',
        rollFace,
        proficiencyBonus,
        temporaryHitPoints,
        actor,
      },
    };
  }
  if (rollFace < 1 || rollFace > 6) {
    return {
      ...scenario,
      outcome: 'Shifting rejected atomically: the deterministic d6 face is outside 1-6; Bonus Action, resource, and HP unchanged.',
      lastResolution: {
        status: 'rejected',
        reason: 'invalid_roll',
        rollFace,
        proficiencyBonus,
        temporaryHitPoints,
        actor,
      },
    };
  }
  if (resource.current <= 0) {
    return {
      ...scenario,
      outcome: 'Shifting rejected atomically: no PB uses remain; Bonus Action, resource, HP, and AC unchanged.',
      lastResolution: {
        status: 'rejected',
        reason: 'resource_unavailable',
        rollFace,
        proficiencyBonus,
        temporaryHitPoints,
        actor,
      },
    };
  }

  // This is a feature action, represented by the generic native hit-point
  // transaction only so the shared action economy and temp-HP replacement own
  // the state change. No spell record or spell command is fabricated.
  const nativeResolution = resolveHitPointAction({
    characters: [actor],
    mapData: null,
    turnState: createTurnState(actor.id),
    casterId: actor.id,
    targetId: actor.id,
    action: {
      name: 'Shifting (feature action)',
      targeting: { type: 'self', validTargets: ['self'] },
      cost: SHIFTING_BONUS_ACTION,
    },
    mode: 'temporary_hit_points',
    amounts: [temporaryHitPoints],
  });

  if (nativeResolution.status === 'rejected') {
    return {
      ...scenario,
      outcome: `Shifting rejected atomically by native resolveHitPointAction (${nativeResolution.reason}); Bonus Action, resource, HP, and AC unchanged.`,
      lastResolution: {
        status: 'rejected',
        reason: 'native_rejected',
        rollFace,
        proficiencyBonus,
        temporaryHitPoints,
        actor,
        nativeReason: nativeResolution.reason,
      },
    };
  }

  // The resolver returned a paid actor and a native temp-HP target result. Add
  // the resource payment and shifted AC effect only to that successful copy.
  // DEBT: resolveHitPointAction's roster replacement checks caster identity
  // before target identity, so a self-targeting feature returns the paid
  // caster in its roster while keeping the temp-HP result in targetAfter.
  // Merge those two native return fields here until the shared resolver owns a
  // dedicated self-target replacement path; no HP value is recomputed locally.
  const paidActor = nativeResolution.casterAfter ?? nativeResolution.characters[0];
  const nativeTarget = nativeResolution.targetAfter;
  const nativeTempHpActor: CombatCharacter = nativeTarget?.id === actor.id
    ? {
        ...paidActor,
        tempHP: nativeTarget.tempHP,
        temporaryHitPointSource: nativeTarget.temporaryHitPointSource,
      }
    : paidActor;
  const effect = createBestialDurabilityEffect(actor.id);
  const shiftedArmorClass = getShiftedArmorClass(scenario.assembledCharacter, effect);
  const shiftedActor: CombatCharacter = {
    ...nativeTempHpActor,
    limitedUses: {
      ...paidActor.limitedUses,
      [BEASTHIDE_SHIFTER_RESOURCE_ID]: {
        ...resource,
        current: resource.current - 1,
      },
    },
    activeEffects: [...(nativeTempHpActor.activeEffects ?? []), effect],
    armorClass: shiftedArmorClass,
    baseAC: scenario.baselineArmorClass ?? shiftedArmorClass - 1,
  };

  return {
    ...scenario,
    actor: shiftedActor,
    shiftedArmorClass,
    outcome: `Shifting committed: resolveHitPointAction resolved; Bonus Action paid; ${temporaryHitPoints} temporary HP (${proficiencyBonus} PB x 2 + ${rollFace} from ${SHIFTING_TEMP_HP_DICE}); uses ${resource.current - 1}/${resource.max}; AC ${scenario.baselineArmorClass ?? 'unknown'} -> ${shiftedArmorClass} for ${SHIFTING_DURATION_MINUTES} minute.`,
    lastResolution: {
      status: 'committed',
      reason: 'committed',
      rollFace,
      proficiencyBonus,
      temporaryHitPoints,
      actor: shiftedActor,
      nativeReason: 'resolveHitPointAction resolved',
    },
  };
}

/** Build the exact baseline restored when the parent shell increments resetCount. */
export function createBeasthideShifterScenario(
  race: Race,
): BeasthideShifterScenarioState {
  const assembled = createBeasthideShifterActor(race);
  const proficiencyBonus = assembled.actor?.level
    ? 2 + Math.floor((assembled.actor.level - 1) / 4)
    : 0;

  return {
    actor: assembled.actor,
    assembledCharacter: assembled.assembledCharacter,
    proficiencyBonus,
    baselineArmorClass: assembled.baselineArmorClass,
    shiftedArmorClass: null,
    outcome: assembled.outcome,
    lastResolution: null,
  };
}

// ============================================================================
// Beasthide Shifter Leaf UI
// ============================================================================
// The controls expose canonical text, parser resource, native action state,
// deterministic dice, temporary HP, AC effect metadata, event output, and the
// exact unsupported lifecycle boundary. Parent Reset remounts this keyed leaf.
// ============================================================================

const BeasthideShifterRaceLeafContent: React.FC<RaceDomainLeafProps> = ({
  race,
  state,
  onScenarioEvent,
}) => {
  const [rollFace, setRollFace] = useState<BeasthideShifterRollFace>(4);
  const [scenario, setScenario] = useState(() => createBeasthideShifterScenario(race));
  const actor = scenario.actor;
  const resource = actor?.limitedUses?.[BEASTHIDE_SHIFTER_RESOURCE_ID];
  const shiftingTrait = getCanonicalBeasthideShifterTrait(race, SHIFTING_TRAIT);
  const durabilityTrait = getCanonicalBeasthideShifterTrait(race, BESTIAL_DURABILITY_TRAIT);

  // Publish the native result through the shell callback without inventing a combat-log entry.
  const handleResolve = () => {
    const nextScenario = resolveBeasthideShifter(scenario, race, rollFace);
    setScenario(nextScenario);
    onScenarioEvent(nextScenario.lastResolution?.status === 'committed'
      ? `Beasthide Shifter SHIFTING COMMITTED: ${nextScenario.outcome}`
      : `Beasthide Shifter SHIFTING REJECTED ATOMICALLY: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="beasthide-shifter-title" data-testid="beasthide-shifter-race-leaf">
      {/* The heading names the canonical feature transaction for assistive tools. */}
      <h4 id="beasthide-shifter-title">Beasthide Shifter - Shifting</h4>
      <p data-testid="beasthide-shifter-canonical-traits">
        Canonical Shifting: {shiftingTrait ?? 'trait missing'} Bestial Durability: {durabilityTrait ?? 'trait missing'}
      </p>

      {/* The selector chooses only a deterministic native-parser face; it does not replace the d6 parser. */}
      <label htmlFor={BEASTHIDE_SHIFTER_ROLL_CONTROL_ID}>Deterministic Bestial Durability d6 face</label>
      <select
        id={BEASTHIDE_SHIFTER_ROLL_CONTROL_ID}
        value={rollFace}
        onChange={event => setRollFace(Number(event.target.value) as BeasthideShifterRollFace)}
      >
        {[1, 2, 3, 4, 5, 6].map(face => (
          <option key={face} value={face}>Fixed face {face}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Shifting</Button>

      {/* These facts show the production actor, action ledger, parsed resource, temp HP, and AC together. */}
      <p data-testid="beasthide-shifter-actor">
        Actor: {actor?.name ?? 'missing'}; Level {actor?.level ?? 'unknown'}; PB +{scenario.proficiencyBonus}; Bonus Action {actor?.actionEconomy.bonusAction.used ? 'used' : 'ready'}; Temp HP {actor?.tempHP ?? 0}; AC {actor?.armorClass ?? 'unknown'}; Uses {resource?.current ?? 0}/{scenario.proficiencyBonus} ({resource?.resetOn ?? 'unknown'}).
      </p>
      <p data-testid="beasthide-shifter-roll">
        Deterministic roll: {rollFace} on {SHIFTING_TEMP_HP_DICE}; formula 2 x PB + 1d6 = {scenario.proficiencyBonus * 2 + rollFace} temp HP.
      </p>
      <p aria-live="polite" role="status" data-testid="beasthide-shifter-outcome">{scenario.outcome}</p>

      {/* This is the exact parser gap: the current bridge exposes AC as an unconditional modifier. */}
      <p data-testid="beasthide-shifter-assembly-boundary">
        Assembly boundary: production quick character assembly plus applyRacialSpellGrantsByLevel supplies the PB-scaled Shifting resource; the current parser also projects the +1 AC text into persistent modifiers before shift, so the leaf withholds that unconditional projection for baseline comparison and applies one native ActiveEffect only on the committed shifted state. The generic self-target resolver returns caster and target fields separately, so the leaf preserves its native temp-HP target return until the shared resolver gains a self-target roster path.
      </p>
      <p data-testid="beasthide-shifter-unsupported-boundary">
        Unsupported lifecycle boundary: the current feature bridge does not invoke timed expiry, revert-as-a-Bonus-Action, death cleanup, or Long Rest dispatch; this proof records the canonical 1-minute ActiveEffect metadata and parent Reset is the only reset path. No spell record or fabricated spell cast is used.
      </p>
      {/* state is intentionally consumed through the keyed remount below; this keeps the host contract explicit. */}
      <span hidden>{state.resetCount}</span>
    </section>
  );
};

// Parent Reset increments resetCount. A keyed content boundary restores roll, action, resource, HP, and AC state.
export const BeasthideShifterRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BeasthideShifterRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'beasthide-shifter-shifting',
  raceId: 'beasthide_shifter',
  label: 'Beasthide Shifter Shifting',
  description: 'Resolve deterministic Shifting through native Bonus Action and temporary-HP helpers with the conditional AC boundary visible.',
  Component: BeasthideShifterRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
