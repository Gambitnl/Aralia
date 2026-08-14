// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 13/08/2026, 13:09:09
 * Dependents: None (Orphan)
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState } from 'react';
import { getRacialTraitLibrary } from '../../../../../data/races';
import spellBundle from '../../../../../data/spells_bundle.json';
import {
  applyRacialSpellGrantsByLevel,
  resolveRacialResourceId,
} from '../../../../../utils/character/characterUtils';
import {
  canAffordActionCost,
  consumeActionCost,
  resetEconomy,
} from '../../../../../utils/combat/actionEconomyUtils';
import {
  createPlayerCombatCharacter,
} from '../../../../../utils/combat/combatUtils';
import {
  createQuickCharacter,
} from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { Race, RacialSpellGrant, LimitedUseAbility, Spell } from '../../../../../types';
import type { CombatCharacter } from '../../../../../types/combat';
import type {
  RaceDomainLeafProps,
  RaceDomainLeafRegistration,
} from '../raceDomainTypes';

/**
 * This file gives the canonical Beastborn Human one deterministic Primal
 * Connection transaction inside the Tactical Sandbox Race domain.
 *
 * It assembles a real PlayerCharacter through the quick-character path, reads
 * the parsed racial spell grants from the production trait library, and pays
 * the native action-economy plus the shared Primal Connection feature resource.
 * The preview deliberately stops before SpellCommand execution because Animal Friendship
 * and Speak with Animals still need a mounted utility-spell result surface.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Beastborn Human data, racial trait parsing, production
 * character assembly, and the native racial spell cost helpers.
 */

// ============================================================================
// Canonical Beastborn Human Facts
// ============================================================================
// The supplied Race remains the source of truth for the displayed trait text.
// Spell IDs and usage rules come from the production racial trait library so
// this leaf does not create a second copy of the Mark of Handling rules.
// ============================================================================

export const BEASTBORN_HUMAN_PRIMAL_CONNECTION_CONTROL_ID = 'resolve-beastborn-human-primal-connection';
export const BEASTBORN_HUMAN_PRIMAL_CONNECTION_SPELL_CONTROL_ID = 'beastborn-human-primal-connection-spell';
export const BEASTBORN_HUMAN_PRIMAL_CONNECTION_TARGET_CONTROL_ID = 'beastborn-human-primal-connection-target';
export const BEASTBORN_HUMAN_ACTOR_ID = 'beastborn-human-primal-connection-actor';
export const BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID = resolveRacialResourceId(
  'feature',
  'beastborn_human__primal_connection__resource',
);

export type BeastbornHumanPrimalSpellId = 'animal-friendship' | 'speak-with-animals';

export type BeastbornHumanPrimalTargetId =
  | 'self'
  | 'beast-low-intelligence'
  | 'beast-high-intelligence'
  | 'monstrosity-low-intelligence'
  | 'monstrosity-high-intelligence'
  | 'humanoid-low-intelligence';

export interface BeastbornHumanPrimalTarget {
  id: BeastbornHumanPrimalTargetId;
  label: string;
  creatureType: 'self' | 'Beast' | 'Monstrosity' | 'Humanoid';
  intelligence: number | null;
}

export const BEASTBORN_HUMAN_PRIMAL_TARGETS: readonly BeastbornHumanPrimalTarget[] = [
  { id: 'self', label: 'Self - Speak with Animals', creatureType: 'self', intelligence: null },
  { id: 'beast-low-intelligence', label: 'Beast, Intelligence 2', creatureType: 'Beast', intelligence: 2 },
  { id: 'beast-high-intelligence', label: 'Beast, Intelligence 4', creatureType: 'Beast', intelligence: 4 },
  { id: 'monstrosity-low-intelligence', label: 'Monstrosity, Intelligence 2', creatureType: 'Monstrosity', intelligence: 2 },
  { id: 'monstrosity-high-intelligence', label: 'Monstrosity, Intelligence 4', creatureType: 'Monstrosity', intelligence: 4 },
  { id: 'humanoid-low-intelligence', label: 'Humanoid, Intelligence 2', creatureType: 'Humanoid', intelligence: 2 },
];

const BEASTBORN_HUMAN_PRIMAL_SPELL_IDS: readonly BeastbornHumanPrimalSpellId[] = [
  'animal-friendship',
  'speak-with-animals',
];

const CANONICAL_PRIMAL_CONNECTION_TRAIT = /^Primal Connection:\s*/i;
const CANONICAL_BIGGER_THEY_ARE_TRAIT = /^The Bigger They Are:\s*/i;

// The runtime spell bundle is the same source used by the combat context. The
// JSON module has the authored records but no generated TypeScript declaration,
// so this narrow cast only supplies the shared Spell map expected by assembly.
const CANONICAL_SPELLS = spellBundle as unknown as Record<string, Spell>;

/** Read one exact canonical Beastborn Human trait from the supplied race. */
export function getCanonicalBeastbornHumanTrait(
  race: Race,
  traitPattern: RegExp,
): string | null {
  return race.traits.find(trait => traitPattern.test(trait.trim())) ?? null;
}

/** Return the production-parsed grants for the two Primal Connection spells. */
export function getCanonicalBeastbornHumanPrimalGrants(
  race: Race,
): readonly RacialSpellGrant[] {
  if (race.id !== 'beastborn_human') return [];

  return getRacialTraitLibrary().byRaceId[race.id]
    .filter((trait): trait is Extract<typeof trait, { type: 'spell' }> => (
      trait.type === 'spell'
      && BEASTBORN_HUMAN_PRIMAL_SPELL_IDS.includes(trait.spellId as BeastbornHumanPrimalSpellId)
    ))
    .map(trait => ({
      sourceRaceId: trait.sourceRaceId,
      sourceRaceName: trait.sourceRaceName,
      minLevel: trait.minLevel,
      spellId: trait.spellId,
      castingMethod: trait.castingMethod,
      spellAbility: trait.spellAbility,
      maxCastLevel: trait.maxCastLevel,
      upcastable: trait.upcastable,
      countsAsPrepared: trait.countsAsPrepared,
      traitName: trait.traitName,
    }));
}

/** Confirm that canonical data still provides both intended Primal spells. */
export function hasCanonicalBeastbornHumanPrimalConnection(race: Race): boolean {
  const primalTrait = getCanonicalBeastbornHumanTrait(race, CANONICAL_PRIMAL_CONNECTION_TRAIT);
  const biggerTrait = getCanonicalBeastbornHumanTrait(race, CANONICAL_BIGGER_THEY_ARE_TRAIT);
  const grants = getCanonicalBeastbornHumanPrimalGrants(race);
  const grantBySpell = new Map(grants.map(grant => [grant.spellId, grant]));

  return race.id === 'beastborn_human'
    && !!primalTrait
    && !!biggerTrait
    && /Animal Friendship/i.test(primalTrait)
    && /Speak with Animals/i.test(primalTrait)
    && /no material component/i.test(primalTrait)
    && /Short Rest or Long Rest/i.test(primalTrait)
    && /Wisdom/i.test(primalTrait)
    && /3rd level/i.test(biggerTrait)
    && /beast or monstrosity/i.test(biggerTrait)
    && grantBySpell.has('animal-friendship')
    && grantBySpell.has('speak-with-animals');
}

/** Apply the canonical level-three target boundary without resolving a spell effect. */
export function isBeastbornHumanPrimalTargetLegal(
  spellId: BeastbornHumanPrimalSpellId,
  target: BeastbornHumanPrimalTarget,
  actorLevel: number,
): boolean {
  if (spellId === 'speak-with-animals') return target.id === 'self';
  if (target.creatureType === 'self' || target.intelligence === null || target.intelligence > 3) return false;
  if (target.creatureType === 'Beast') return true;
  return actorLevel >= 3 && target.creatureType === 'Monstrosity';
}

// ============================================================================
// Production Assembly And Resource Projection
// ============================================================================
// The shared bridge currently allows legacy Race.knownSpells entries to win
// over the structured trait-library grants. The canonical apply helper still
// assembles the real shared Primal Connection resource, but its spell grants
// remain at-will and therefore cannot be consumed by the native racial-spell
// payer. This leaf keeps that boundary visible and only spends the real
// limited-use field after the native action guard succeeds.
// ============================================================================

function createBeastbornHumanActor(race: Race): {
  actor: CombatCharacter | null;
  grants: readonly RacialSpellGrant[];
  outcome: string;
} {
  const grants = getCanonicalBeastbornHumanPrimalGrants(race);
  const quickCharacter = createQuickCharacter({
    name: 'Beastborn Human - Primal Connection Tester',
    raceId: race.id,
    classId: 'wizard',
    level: 3,
    stats: [10, 10, 10, 10, 14, 10],
  });
  if (!quickCharacter || !hasCanonicalBeastbornHumanPrimalConnection(race)) {
    return {
      actor: null,
      grants,
      outcome: 'Primal Connection unavailable: canonical trait parsing or production quick-character assembly was incomplete.',
    };
  }

  const assembledCharacter = applyRacialSpellGrantsByLevel(quickCharacter, quickCharacter.level ?? 1);
  const canonicalSpellbook = assembledCharacter.spellbook ?? {
    knownSpells: [],
    preparedSpells: [],
    cantrips: [],
  };
  const generatedActor = createPlayerCombatCharacter({
    ...assembledCharacter,
    spellbook: canonicalSpellbook,
  }, CANONICAL_SPELLS);
  const actor = resetEconomy({
    ...generatedActor,
    id: BEASTBORN_HUMAN_ACTOR_ID,
    name: `${race.name} - Primal Connection Tester`,
    spellbook: canonicalSpellbook,
    limitedUses: assembledCharacter.limitedUses,
  });

  return {
    actor,
    grants,
    outcome: `Ready: ${actor.name}; level ${actor.level}; Wisdom racial spellcasting; ${grants.length} canonical Primal Connection grants assembled.`,
  };
}

// ============================================================================
// Native Cast-Cost Transaction
// ============================================================================
// The transaction uses the production action-economy guard and payer. It does
// not call a generic spell command because that would claim an effect result
// without a mounted utility-spell target/result surface in this leaf.
// ============================================================================

export interface BeastbornHumanPrimalResolution {
  status: 'committed' | 'rejected';
  reason: 'committed' | 'assembly_unavailable' | 'missing_grant' | 'invalid_target' | 'resource_unavailable' | 'action_unavailable';
  spellId: BeastbornHumanPrimalSpellId;
  targetId: BeastbornHumanPrimalTargetId;
  actor: CombatCharacter | null;
}

export interface BeastbornHumanPrimalScenarioState {
  actor: CombatCharacter | null;
  grants: readonly RacialSpellGrant[];
  outcome: string;
  lastResolution: BeastbornHumanPrimalResolution | null;
}

function getPrimalResource(actor: CombatCharacter | null): LimitedUseAbility | undefined {
  return actor?.limitedUses?.[BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID];
}

/** Spend the real shared limited-use field after native action legality passes. */
function consumePrimalConnectionResource(actor: CombatCharacter): CombatCharacter {
  const resource = getPrimalResource(actor);
  if (!resource) return actor;

  return {
    ...actor,
    limitedUses: {
      ...actor.limitedUses,
      [BEASTBORN_HUMAN_PRIMAL_CONNECTION_RESOURCE_ID]: {
        ...resource,
        current: Math.max(0, resource.current - 1),
      },
    },
  };
}

/** Resolve only the native action/resource payment and leave spell effects unclaimed. */
export function resolveBeastbornHumanPrimalConnection(
  scenario: BeastbornHumanPrimalScenarioState,
  race: Race,
  spellId: BeastbornHumanPrimalSpellId,
  targetId: BeastbornHumanPrimalTargetId,
): BeastbornHumanPrimalScenarioState {
  const actor = scenario.actor;
  const target = BEASTBORN_HUMAN_PRIMAL_TARGETS.find(candidate => candidate.id === targetId);
  const grant = scenario.grants.find(candidate => candidate.spellId === spellId);

  if (!actor || !hasCanonicalBeastbornHumanPrimalConnection(race)) {
    return {
      ...scenario,
      outcome: 'Primal Connection rejected atomically: production-assembled actor or canonical trait is unavailable.',
      lastResolution: { status: 'rejected', reason: 'assembly_unavailable', spellId, targetId, actor },
    };
  }
  if (!grant) {
    return {
      ...scenario,
      outcome: `Primal Connection rejected atomically: canonical ${spellId} grant is unavailable.`,
      lastResolution: { status: 'rejected', reason: 'missing_grant', spellId, targetId, actor },
    };
  }
  if (!target || !isBeastbornHumanPrimalTargetLegal(spellId, target, actor.level)) {
    return {
      ...scenario,
      outcome: `Primal Connection rejected atomically: ${target?.label ?? 'target'} is outside the canonical ${spellId} target boundary; action and resource unchanged.`,
      lastResolution: { status: 'rejected', reason: 'invalid_target', spellId, targetId, actor },
    };
  }

  const resource = getPrimalResource(actor);
  if (!resource || resource.current <= 0) {
    return {
      ...scenario,
      outcome: `Primal Connection rejected atomically: ${spellId} resource is empty; action unchanged.`,
      lastResolution: { status: 'rejected', reason: 'resource_unavailable', spellId, targetId, actor },
    };
  }

  const cost = {
    type: 'action' as const,
    spellSlotLevel: 0,
    castSource: { type: 'racial' as const, spellId, allowSlotFallback: false },
  };
  if (!canAffordActionCost(actor, cost)) {
    return {
      ...scenario,
      outcome: `Primal Connection rejected atomically: Action unavailable; ${spellId} resource unchanged.`,
      lastResolution: { status: 'rejected', reason: 'action_unavailable', spellId, targetId, actor },
    };
  }

  const actionPaidActor = consumeActionCost(actor, cost);
  const paidActor = consumePrimalConnectionResource(actionPaidActor);
  const resourceAfterPayment = getPrimalResource(paidActor);
  const nextScenario: BeastbornHumanPrimalScenarioState = {
    ...scenario,
    actor: paidActor,
    outcome: `Native cast-cost transaction committed: ${spellId}; Action paid; resource ${resourceAfterPayment?.current ?? 0}/1 (${resourceAfterPayment?.resetOn ?? 'unknown'}). Spell effect result is not claimed by this preview leaf.`,
    lastResolution: { status: 'committed', reason: 'committed', spellId, targetId, actor: paidActor },
  };

  return nextScenario;
}

/** Build the baseline restored whenever the parent shell increments resetCount. */
export function createBeastbornHumanPrimalScenario(race: Race): BeastbornHumanPrimalScenarioState {
  const assembled = createBeastbornHumanActor(race);
  return {
    actor: assembled.actor,
    grants: assembled.grants,
    outcome: assembled.outcome,
    lastResolution: null,
  };
}

// ============================================================================
// Beastborn Human Leaf UI
// ============================================================================
// The controls expose canonical traits, the production actor, spell grants,
// target boundary, native payment result, event output, and exact unsupported
// cast-effect/rest boundaries. Parent Reset remounts this keyed content.
// ============================================================================

const BeastbornHumanRaceLeafContent: React.FC<RaceDomainLeafProps> = ({ race, onScenarioEvent }) => {
  const [spellId, setSpellId] = useState<BeastbornHumanPrimalSpellId>('animal-friendship');
  const [targetId, setTargetId] = useState<BeastbornHumanPrimalTargetId>('beast-low-intelligence');
  const [scenario, setScenario] = useState(() => createBeastbornHumanPrimalScenario(race));
  const actor = scenario.actor;
  const target = BEASTBORN_HUMAN_PRIMAL_TARGETS.find(candidate => candidate.id === targetId);
  const primalTrait = getCanonicalBeastbornHumanTrait(race, CANONICAL_PRIMAL_CONNECTION_TRAIT);
  const biggerTrait = getCanonicalBeastbornHumanTrait(race, CANONICAL_BIGGER_THEY_ARE_TRAIT);
  const selectedResource = getPrimalResource(actor);

  // Resolve the selected target boundary and native cast cost, then publish the
  // exact result to the shell without rewriting it into a fabricated cast log.
  const handleResolve = () => {
    const nextScenario = resolveBeastbornHumanPrimalConnection(scenario, race, spellId, targetId);
    setScenario(nextScenario);
    onScenarioEvent(nextScenario.lastResolution?.status === 'committed'
      ? `Beastborn Human PRIMAL CONNECTION COMMITTED: ${nextScenario.outcome}`
      : `Beastborn Human PRIMAL CONNECTION REJECTED ATOMICALLY: ${nextScenario.outcome}`);
  };

  return (
    <section aria-labelledby="beastborn-human-primal-connection-title" data-testid="beastborn-human-race-leaf">
      {/* The heading names the canonical Beastborn Human transaction. */}
      <h4 id="beastborn-human-primal-connection-title">Beastborn Human - Primal Connection</h4>
      <p data-testid="beastborn-human-canonical-traits">
        Canonical Primal Connection: {primalTrait ?? 'trait missing'} The Bigger They Are: {biggerTrait ?? 'trait missing'}
      </p>

      {/* These selectors choose only deterministic proof inputs; native helpers own payment and legality. */}
      <label htmlFor={BEASTBORN_HUMAN_PRIMAL_CONNECTION_SPELL_CONTROL_ID}>Primal Connection spell</label>
      <select
        id={BEASTBORN_HUMAN_PRIMAL_CONNECTION_SPELL_CONTROL_ID}
        value={spellId}
        onChange={event => setSpellId(event.target.value as BeastbornHumanPrimalSpellId)}
      >
        <option value="animal-friendship">Animal Friendship</option>
        <option value="speak-with-animals">Speak with Animals</option>
      </select>
      <label htmlFor={BEASTBORN_HUMAN_PRIMAL_CONNECTION_TARGET_CONTROL_ID}>Target boundary</label>
      <select
        id={BEASTBORN_HUMAN_PRIMAL_CONNECTION_TARGET_CONTROL_ID}
        value={targetId}
        onChange={event => setTargetId(event.target.value as BeastbornHumanPrimalTargetId)}
      >
        {BEASTBORN_HUMAN_PRIMAL_TARGETS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      <Button type="button" onClick={handleResolve}>Resolve Primal Connection cast cost</Button>

      {/* These facts expose the assembled actor, canonical grants, resources, and action state together. */}
      <p data-testid="beastborn-human-actor">
        Actor: {actor?.name ?? 'missing'}; Level {actor?.level ?? 'unknown'}; Wisdom spellcasting; Action {actor?.actionEconomy.action.used ? 'used' : 'ready'}; Selected resource {selectedResource?.current ?? 0}/{selectedResource?.max ?? 0} ({selectedResource?.resetOn ?? 'unknown'}).
      </p>
      <p data-testid="beastborn-human-spell-facts">
        Grants: {scenario.grants.length > 0
          ? scenario.grants.map(grant => `${grant.spellId} ${grant.castingMethod}, ${grant.spellAbility ?? 'ability unresolved'}`).join('; ')
          : 'none'}; no material component is canonical.
      </p>
      <p data-testid="beastborn-human-target-facts">
        Target: {target?.label ?? 'missing'}; level-3 Beast/Monstrosity expansion {actor && actor.level >= 3 ? 'active' : 'inactive'}; Intelligence must be 3 or lower.
      </p>
      <p aria-live="polite" role="status" data-testid="beastborn-human-outcome">{scenario.outcome}</p>

      {/* This explains the adapter boundary instead of hiding the legacy grant collision. */}
      <p data-testid="beastborn-human-assembly-boundary">
        Assembly boundary: production quick character assembly and applyRacialSpellGrantsByLevel are used; the production parser currently exposes at-will spell grants plus one shared limited-use resource, so this leaf keeps that real resource visible instead of claiming independent spell charges.
      </p>
      <p data-testid="beastborn-human-unsupported-boundary">
        Unsupported boundary: canonical prose promises independent per-spell Short Rest or Long Rest charges, but the current parser/bridge exposes one shared feature resource and at-will grants. This leaf proves native Action payment plus atomic shared-resource consumption only; it does not claim spell effect resolution, material-component execution, or direct rest dispatch.
      </p>
    </section>
  );
};

// Parent resetCount changes remount the content, restoring spell, target, action, and resources.
export const BeastbornHumanRaceLeaf: React.FC<RaceDomainLeafProps> = props => (
  <BeastbornHumanRaceLeafContent
    key={`${props.race.id}-${props.state.resetCount}`}
    {...props}
  />
);

// Automatic discovery requires this exact named registration export.
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'beastborn-human-primal-connection',
  raceId: 'beastborn_human',
  label: 'Beastborn Human - Primal Connection',
  description: 'Resolve canonical Primal Connection target boundaries and native racial cast-cost payment.',
  Component: BeastbornHumanRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
