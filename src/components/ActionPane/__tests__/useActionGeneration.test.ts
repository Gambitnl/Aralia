import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionGeneration } from '../useActionGeneration';
import type { Location, NPC } from '../../../types';

/**
 * Guards the contract that NPCs present in a location always get a "Talk to"
 * action — including on procedural `coord_` tiles, where the opening situation
 * places its strangers. A fresh player spawns on a coord_ tile; if these NPCs
 * render but produce no talk action, the player can see them but never interact.
 */

const coordLocation = {
  id: 'coord_12_34',
  name: 'Forest sector (12,34)',
  baseDescription: 'A procedural wilderness tile.',
  exits: {},
  npcIds: [],
  biomeId: 'forest',
} as unknown as Location;

const stranger = { id: 'stranger_1', name: 'Hooded Stranger' } as unknown as NPC;

describe('useActionGeneration — NPC talk actions', () => {
  it('generates a Talk action for a dynamically-placed NPC on a coord_ tile', () => {
    const { result } = renderHook(() =>
      useActionGeneration({
        currentLocation: coordLocation,
        npcsInLocation: [stranger],
        itemsInLocation: [],
      }),
    );

    const talk = result.current.generalActions.find((a) => a.type === 'talk');
    expect(talk).toBeDefined();
    expect(talk?.targetId).toBe('stranger_1');
    expect(talk?.label).toBe('Talk to Hooded Stranger');
  });
});
