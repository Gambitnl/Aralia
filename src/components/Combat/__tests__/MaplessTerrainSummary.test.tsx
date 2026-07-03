import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MaplessTerrainSummary, buildMaplessTerrainSummaries } from '../MaplessTerrainSummary';
import type { TerrainEffect } from '../../../types/spells';
import type { ActiveSpellZone } from '../../../systems/spells/effects/triggerHandler';

/**
 * These tests protect the theater-of-the-mind terrain summary.
 *
 * When combat has no battle map, terrain spells are stored as spell zones
 * instead of tile effects. The summary must make those zones visible so the
 * player can still track hazardous, difficult, obscuring, or blocking terrain.
 */

const terrainEffect = (terrainType: TerrainEffect['terrainType']): TerrainEffect => ({
  type: 'TERRAIN',
  terrainType,
  areaOfEffect: { shape: 'Sphere', size: 20, height: 0 },
  duration: { type: 'minutes', value: 10 },
  trigger: {
    type: 'immediate',
    frequency: 'every_time',
    consumption: 'unlimited',
    attackFilter: { weaponType: 'any', attackType: 'any' },
    movementType: 'any',
    sustainCost: { actionType: 'action', optional: false }
  },
  condition: {
    type: 'always',
    targetFilter: {
      creatureTypes: [],
      excludeCreatureTypes: [],
      sizes: [],
      alignments: [],
      hasCondition: [],
      isNativeToPlane: false,
      willing: 'not_applicable',
      objectEligibility: {
        wornOrCarried: 'not_applicable',
        magicalStatus: 'not_applicable',
        fixedToSurface: 'not_applicable',
        maxSize: 'not_applicable',
        maxWeightPounds: 'not_applicable',
        maxWeightScaling: 'not_applicable'
      },
      communicationPrerequisites: {
        canHearCaster: 'not_applicable',
        canUnderstandCaster: 'not_applicable',
        canSeeCaster: 'not_applicable'
      },
      abilityThreshold: { ability: 'not_applicable', operator: 'not_applicable', value: 'not_applicable' },
      selfRelation: 'not_applicable'
    },
    requiresStatus: [],
    saveModifiers: []
  }
} as TerrainEffect);

const zone = (overrides: Partial<ActiveSpellZone> = {}): ActiveSpellZone => ({
  id: 'terrain-zone-spike-growth',
  spellId: 'spike-growth',
  casterId: 'druid',
  position: { x: 2, y: 2 },
  areaOfEffect: { shape: 'Sphere', size: 20 },
  effects: [terrainEffect('damaging'), terrainEffect('difficult')],
  triggeredThisTurn: new Set(),
  triggeredEver: new Set(),
  expiresAtRound: 10,
  ...overrides
});

describe('MaplessTerrainSummary', () => {
  it('summarizes mapless terrain zones without duplicating raw effect rows', () => {
    const summaries = buildMaplessTerrainSummaries([zone()]);

    expect(summaries).toEqual([
      {
        id: 'terrain-zone-spike-growth',
        name: 'Spike Growth',
        area: '20-foot Sphere',
        expiresAtRound: 10,
        terrainLabels: ['Hazard', 'Difficult']
      }
    ]);
  });

  it('renders active mapless terrain details for player-visible combat state', () => {
    render(<MaplessTerrainSummary spellZones={[zone()]} />);

    expect(screen.getByTestId('mapless-terrain-summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spike Growth' })).toBeInTheDocument();
    expect(screen.getByText('20-foot Sphere')).toBeInTheDocument();
    expect(screen.getByText('Hazard')).toBeInTheDocument();
    expect(screen.getByText('Difficult')).toBeInTheDocument();
    expect(screen.getByText('Round 10')).toBeInTheDocument();
  });

  it('stays hidden when no terrain zones are active', () => {
    const { container } = render(<MaplessTerrainSummary spellZones={[zone({ effects: [] })]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
