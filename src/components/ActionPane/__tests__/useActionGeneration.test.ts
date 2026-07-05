import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionGeneration, merchantTypeForBusiness } from '../useActionGeneration';
import { GameProvider } from '../../../state/GameContext';
import type { Location, NPC } from '../../../types';
import type { GameState } from '../../../types';
import type { WorldBusiness } from '../../../types/business';

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

/**
 * Packet B proof: a talk-target NPC who owns a business surfaces a "Browse Goods"
 * action carrying a valid OPEN_DYNAMIC_MERCHANT payload (merchantType mapped from
 * the wf business type, buildingId = NPC id, seedKey = business id). This one
 * dispatch revives the dormant MerchantModal chain.
 */
describe('useActionGeneration — Packet B/D town shop + recruit actions', () => {
  const keeper = { id: 'npc_burg_1_plot_2', name: 'Bram the Smith' } as unknown as NPC;
  const business = {
    id: 'biz_burg_1_plot_2',
    name: "Bram's Forge",
    ownerId: 'npc_burg_1_plot_2',
    burgId: 1,
    businessType: 'smithy',
  } as unknown as WorldBusiness;

  function wrapperWithState(): React.FC<{ children: React.ReactNode }> {
    const state = {
      worldSeed: 12345,
      playerCell: { cellId: 0 },
      generatedNpcs: { [keeper.id]: keeper as any },
      worldBusinesses: { [business.id]: business },
    } as unknown as GameState;
    const dispatch = () => {};
    return ({ children }) =>
      React.createElement(GameProvider, { state, dispatch: dispatch as any, children });
  }

  it('surfaces a Browse Goods action with a valid OPEN_DYNAMIC_MERCHANT payload', () => {
    const { result } = renderHook(
      () =>
        useActionGeneration({
          currentLocation: coordLocation,
          npcsInLocation: [keeper],
          itemsInLocation: [],
        }),
      { wrapper: wrapperWithState() },
    );

    const browse = result.current.generalActions.find(
      (a) => a.type === 'OPEN_DYNAMIC_MERCHANT' && !(a.payload as { hire?: boolean })?.hire,
    );
    expect(browse).toBeDefined();
    expect(browse?.label).toBe("Browse Goods — Bram's Forge");
    const payload = browse?.payload as { merchantType: string; buildingId: string; seedKey: string };
    expect(payload.merchantType).toBe('shop_blacksmith');
    expect(payload.buildingId).toBe('npc_burg_1_plot_2');
    expect(payload.seedKey).toBe('biz_burg_1_plot_2');
  });

  it('offers "Ask <name> to join you" for a generated NPC, carrying a recruitOffer', () => {
    const { result } = renderHook(
      () =>
        useActionGeneration({
          currentLocation: coordLocation,
          npcsInLocation: [keeper],
          itemsInLocation: [],
        }),
      { wrapper: wrapperWithState() },
    );

    const invite = result.current.generalActions.find((a) => a.label === `Ask ${keeper.name} to join you`);
    expect(invite).toBeDefined();
    expect((invite?.payload as { recruitOffer?: { targetNpcId: string } })?.recruitOffer?.targetNpcId).toBe(keeper.id);
  });
});

describe('merchantTypeForBusiness', () => {
  it('maps wf business types to legacy shop keys', () => {
    expect(merchantTypeForBusiness('tavern')).toBe('shop_tavern');
    expect(merchantTypeForBusiness('smithy')).toBe('shop_blacksmith');
    expect(merchantTypeForBusiness('apothecary')).toBe('shop_apothecary');
    expect(merchantTypeForBusiness('enchanter_shop')).toBe('shop_enchanter');
    expect(merchantTypeForBusiness('general_store')).toBe('shop_general');
    expect(merchantTypeForBusiness('trading_company')).toBe('shop_general');
  });
});
