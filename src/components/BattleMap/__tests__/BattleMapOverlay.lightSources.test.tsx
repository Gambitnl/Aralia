import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BattleMapOverlay from '../BattleMapOverlay';
import type { ActiveAnimatedObject, ActiveSpellGuardian, BattleMapData, LightSource } from '../../../types/combat';

/**
 * These tests protect the map overlay pieces that make live light sources
 * readable on the 2D tactical board.
 *
 * The visibility hook owns which tiles are bright, dim, or hidden. This overlay
 * owns the human-facing explanation layer: the light rings and the small marker
 * that names where the light actually comes from.
 */

describe('BattleMapOverlay light sources', () => {
  it('renders a visible origin marker for each light source', () => {
    const mapData: BattleMapData = {
      dimensions: { width: 8, height: 8 },
      tiles: new Map(),
      theme: 'dungeon',
      seed: 1
    };
    const torch: LightSource = {
      id: 'cover-sandbox-torch',
      sourceSpellId: 'sandbox-torch',
      casterId: 'player-ranger',
      brightRadius: 15,
      dimRadius: 15,
      attachedTo: 'point',
      position: { x: 4, y: 5 },
      color: '#fbbf24',
      createdTurn: 0
    };

    render(
      <BattleMapOverlay
        mapData={mapData}
        characters={[]}
        damageNumbers={[]}
        animations={[]}
        activeLightSources={[torch]}
      />
    );

    // Radius circles show the area affected by light, but the sandbox also
    // needs a small origin marker so users can tell what created the light.
    expect(screen.getByTitle('sandbox-torch light source')).toHaveTextContent('✦');
  });

  it('renders non-creature spell artifacts and removes inactive records', () => {
    const mapData: BattleMapData = {
      dimensions: { width: 8, height: 8 },
      tiles: new Map(),
      theme: 'dungeon',
      seed: 1
    };
    const tinyServant: ActiveAnimatedObject = {
      id: 'tiny-servant-cup',
      spellId: 'tiny-servant',
      spellName: 'Tiny Servant',
      casterId: 'wizard',
      sourceObjectId: 'cup',
      sourceObjectName: 'Cup',
      sourceObjectPosition: { x: 2, y: 3 },
      size: 'tiny',
      sizeCost: 1,
      creatureType: 'construct',
      allegiance: 'ally',
      initiativePolicy: 'shared',
      armorClass: 15,
      maxHitPoints: 10,
      currentHitPoints: 10,
      speedFeet: 30,
      lifecycle: { reversion: 'object' },
      active: true,
      createdTurn: 1
    };
    const guardian: ActiveSpellGuardian = {
      id: 'guardian-of-faith-marker',
      spellId: 'guardian-of-faith',
      spellName: 'Guardian of Faith',
      casterId: 'cleric',
      kind: 'guardian_of_faith',
      position: { x: 5, y: 4 },
      size: 'large',
      occupiesSpace: false,
      invulnerable: true,
      threatRadiusFeet: 10,
      active: true,
      createdTurn: 1,
      triggerPolicy: {
        targets: 'enemy_creatures',
        damageAmount: 60,
        damageType: 'radiant'
      },
      damageCap: {
        maxTotalDamage: 60,
        dealtDamage: 0,
        vanishWhenReached: true
      }
    };

    const { rerender } = render(
      <BattleMapOverlay
        mapData={mapData}
        characters={[]}
        damageNumbers={[]}
        animations={[]}
        spellMapArtifacts={{
          animatedObjects: [tinyServant],
          guardians: [guardian]
        }}
      />
    );

    expect(screen.getByTitle('Tiny Servant animated object: Cup')).toHaveTextContent('C');
    expect(screen.getByTitle('Guardian of Faith guardian, 10 ft threat')).toHaveTextContent('GO');

    rerender(
      <BattleMapOverlay
        mapData={mapData}
        characters={[]}
        damageNumbers={[]}
        animations={[]}
        spellMapArtifacts={{
          animatedObjects: [{ ...tinyServant, active: false }],
          guardians: [{ ...guardian, active: false }]
        }}
      />
    );

    expect(screen.queryByTitle('Tiny Servant animated object: Cup')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Guardian of Faith guardian, 10 ft threat')).not.toBeInTheDocument();
  });
});
