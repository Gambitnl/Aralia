import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RACES } from '../../../../../../data/races';
import { CLOUD_GIANT_GOLIATH_DATA } from '../../../../../../data/races/cloud_giant_goliath';
import { createRaceDomainRegistry } from '../../raceDomainRegistry';
import { createRaceDomainScenarioState } from '../../raceDomainTypes';
import {
  CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID,
  CloudGiantGoliathRaceLeaf,
  createCloudGiantGoliathCloudsJauntScenario,
  getCanonicalCloudGiantGoliathCloudsJauntTrait,
  hasCanonicalCloudGiantGoliathCloudsJaunt,
  resolveCloudGiantGoliathCloudsJaunt,
  RACE_DOMAIN_LEAF,
} from '../cloudGiantGoliathRaceLeaf';

/**
 * This file proves that the Cloud Giant Goliath Race leaf stays linked to
 * canonical Cloud's Jaunt facts and that its narrow native-helper adapter is
 * atomic for success, invalid destinations, reset, logging, and boundaries.
 *
 * Called by: focused and cumulative Race-domain Vitest checks.
 * Depends on: ACTIVE_RACES, automatic registry discovery, and the leaf's
 * production-assembly transaction helpers.
 */

// ============================================================================
// Canonical Identity And Discovery
// ============================================================================
// These checks prevent a plausible-looking leaf from drifting away from the
// active race record or automatic ./leaves discovery contract.
// ============================================================================

describe('Cloud Giant Goliath Race domain leaf', () => {
  it('links to the active canonical race and preserves Cloud\'s Jaunt facts', () => {
    const trait = getCanonicalCloudGiantGoliathCloudsJauntTrait(CLOUD_GIANT_GOLIATH_DATA);

    expect(ACTIVE_RACES.some(race => race.id === 'cloud_giant_goliath')).toBe(true);
    expect(RACE_DOMAIN_LEAF.raceId).toBe('cloud_giant_goliath');
    expect(RACE_DOMAIN_LEAF.label).toContain('Cloud Giant Goliath');
    expect(hasCanonicalCloudGiantGoliathCloudsJaunt(CLOUD_GIANT_GOLIATH_DATA)).toBe(true);
    expect(trait).toContain('Bonus Action');
    expect(trait).toContain('30 feet');
    expect(trait).toContain('unoccupied space you can see');
    expect(trait).toContain('Proficiency Bonus');
    expect(trait).toContain('Long Rest');
    expect(CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID).toBe('racial_feature_cloud_giant_goliath__cloud_s_jaunt__resource');
  });

  it('is discovered for cloud_giant_goliath by the automatic Race registry', () => {
    const registry = createRaceDomainRegistry(ACTIVE_RACES);
    const leaves = registry.getLeavesForRace('cloud_giant_goliath');

    expect(leaves.some(leaf => leaf.id === RACE_DOMAIN_LEAF.id)).toBe(true);
  });

  // ========================================================================
  // Native Helper Transaction And Atomic Limits
  // ========================================================================
  // A successful jump pays only the Bonus Action and one canonical resource;
  // every invalid attempt returns the original actor array unchanged.
  // ========================================================================

  it('uses production assembly and resolves a legal 30-foot-subset teleport', () => {
    const baseline = createCloudGiantGoliathCloudsJauntScenario(CLOUD_GIANT_GOLIATH_DATA);
    const actor = baseline.characters.find(character => character.id.includes('clouds-jaunt-actor'))!;
    const resolved = resolveCloudGiantGoliathCloudsJaunt(baseline, 'legal');
    const movedActor = resolved.characters.find(character => character.id === actor.id)!;

    expect(actor.level).toBe(5);
    expect(actor.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]).toMatchObject({
      current: 3,
      max: 'proficiency_bonus',
      resetOn: 'long_rest',
    });
    expect(resolved.lastResolution?.status).toBe('teleported');
    expect(resolved.lastResolution?.reason).toBe('teleported');
    expect(movedActor.position).toEqual({ x: 6, y: 4 });
    expect(movedActor.actionEconomy.bonusAction.used).toBe(true);
    expect(movedActor.actionEconomy.movement.used).toBe(0);
    expect(movedActor.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]?.current).toBe(2);
    expect(resolved.outcome).toContain('Bonus Action paid');
  });

  it.each([
    ['occupied', 'destination_occupied'],
    ['out-of-range', 'destination_out_of_range'],
  ] as const)('rejects %s atomically before payment', (targetId, reason) => {
    const baseline = createCloudGiantGoliathCloudsJauntScenario(CLOUD_GIANT_GOLIATH_DATA);
    const actor = baseline.characters.find(character => character.id.includes('clouds-jaunt-actor'))!;
    const rejected = resolveCloudGiantGoliathCloudsJaunt(baseline, targetId);
    const unchangedActor = rejected.characters.find(character => character.id === actor.id)!;

    expect(rejected.lastResolution?.status).toBe('rejected');
    expect(rejected.lastResolution?.reason).toBe(reason);
    expect(rejected.characters).toBe(baseline.characters);
    expect(unchangedActor.position).toEqual(actor.position);
    expect(unchangedActor.actionEconomy.bonusAction.used).toBe(false);
    expect(unchangedActor.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]?.current).toBe(3);
  });

  it('rejects when the Bonus Action is already used without changing the resource', () => {
    const baseline = createCloudGiantGoliathCloudsJauntScenario(CLOUD_GIANT_GOLIATH_DATA);
    const actor = baseline.characters.find(character => character.id.includes('clouds-jaunt-actor'))!;
    const actionSpent = {
      ...baseline,
      characters: baseline.characters.map(character => character.id === actor.id
        ? { ...character, actionEconomy: { ...character.actionEconomy, bonusAction: { used: true, remaining: 0 } } }
        : character),
    };
    const rejected = resolveCloudGiantGoliathCloudsJaunt(actionSpent, 'legal');

    expect(rejected.lastResolution?.reason).toBe('bonus_action_unavailable');
    expect(rejected.characters).toBe(actionSpent.characters);
    expect(rejected.outcome).toContain('Bonus Action already used');
  });

  it('rejects when Proficiency Bonus uses are exhausted without changing the position', () => {
    const baseline = createCloudGiantGoliathCloudsJauntScenario(CLOUD_GIANT_GOLIATH_DATA);
    const actor = baseline.characters.find(character => character.id.includes('clouds-jaunt-actor'))!;
    const resource = actor.limitedUses?.[CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID];
    if (!resource) throw new Error('Expected the production-assembled Cloud\'s Jaunt resource.');
    const resourceEmpty = {
      ...baseline,
      characters: baseline.characters.map(character => character.id === actor.id
        ? {
            ...character,
            limitedUses: {
              ...character.limitedUses,
              [CLOUD_GIANT_GOLIATH_CLOUDS_JAUNT_RESOURCE_ID]: {
                ...resource,
                current: 0,
              },
            },
          }
        : character),
    };
    const rejected = resolveCloudGiantGoliathCloudsJaunt(resourceEmpty, 'legal');

    expect(rejected.lastResolution?.reason).toBe('insufficient_clouds_jaunt_uses');
    expect(rejected.characters).toBe(resourceEmpty.characters);
    expect(rejected.outcome).toContain('no Proficiency Bonus uses remain');
  });

  // ========================================================================
  // Visible Event, Reset, And Honest Boundary
  // ========================================================================
  // The component publishes the native result through the shell callback and
  // remounts from resetCount without claiming mounted render proof.
  // ========================================================================

  it('shows actor/resource/fact state, logs the result, resets, and labels boundaries', () => {
    const events: string[] = [];
    const { rerender } = render(
      <CloudGiantGoliathRaceLeaf
        race={CLOUD_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(CLOUD_GIANT_GOLIATH_DATA.id, 0)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('cloud-giant-goliath-canonical-trait')).toHaveTextContent('Bonus Action');
    expect(screen.getByTestId('cloud-giant-goliath-actor')).toHaveTextContent('PB +3');
    expect(screen.getByTestId('cloud-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('cloud-giant-goliath-giant-facts')).toHaveTextContent('Large Form');
    expect(screen.getByTestId('cloud-giant-goliath-giant-facts')).toHaveTextContent('Powerful Build');
    fireEvent.click(screen.getByRole('button', { name: /resolve cloud's jaunt/i }));

    expect(screen.getByTestId('cloud-giant-goliath-outcome')).toHaveTextContent('Bonus Action paid');
    expect(screen.getByTestId('cloud-giant-goliath-actor')).toHaveTextContent('Uses 2/3');
    expect(events.at(-1)).toContain("Cloud Giant Goliath CLOUD'S JAUNT RESOLVED");

    rerender(
      <CloudGiantGoliathRaceLeaf
        race={CLOUD_GIANT_GOLIATH_DATA}
        state={createRaceDomainScenarioState(CLOUD_GIANT_GOLIATH_DATA.id, 1)}
        onScenarioEvent={message => events.push(message)}
      />,
    );

    expect(screen.getByTestId('cloud-giant-goliath-actor')).toHaveTextContent('Position 2,4');
    expect(screen.getByTestId('cloud-giant-goliath-actor')).toHaveTextContent('Uses 3/3');
    expect(screen.getByTestId('cloud-giant-goliath-assembly-boundary')).toHaveTextContent('production quick character assembly');
    expect(screen.getByTestId('cloud-giant-goliath-unsupported-boundary')).toHaveTextContent('spell-only teleportation resolver');
    expect(screen.getByTestId('cloud-giant-goliath-unsupported-boundary')).toHaveTextContent('2D/3D teleportation');
  });
});
