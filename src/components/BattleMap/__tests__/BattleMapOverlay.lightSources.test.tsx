import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BattleMapOverlay from '../BattleMapOverlay';
import type { BattleMapData, LightSource } from '../../../types/combat';

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
});
