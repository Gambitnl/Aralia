/** Real economy owners, household facts and saved memory must survive the same
 * registration on either entry surface. The fixtures use the played Sypege.
 * Plot numbers re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to
 * re-lay out every world): Bryn Hartdown works plot 47, b3 keeps plot 0.
 * GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
 * ruling q2, layout revision 2). A played save keeps the layout it was made
 * with, so this played Sypege reads layout revision 1 everywhere. */
import { describe, expect, it } from 'vitest';
import { computeBurgMerchants } from '../registerBurgMerchants';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';
import { createHouseholdResidentNpc } from '../../../../components/World3D/groundResidentInteraction';
import { generateTownRoster } from '../../roster/generateTownRoster';
import { canonicalArtifactTownForSiteFromAtlas, canonicalTownSeedPath } from '../../town/canonicalTown';
import { getBridgeAtlas, getBurgNamer } from '../../bridge/legacySubmapBridge';
import { npcReducer } from '../../../../state/reducers/npcReducer';
import { createMockGameState } from '../../../../utils/core/factories';
const SEED = 1793146029630, BURG = 10;
const LIFE = {layoutRevision: 1 as const, villagers: {}};
const byId = <T extends {id: string}>(rows: T[]) => Object.fromEntries(rows.map(row => [row.id, row]));

describe('canonical keeper identity', () => {
  it('reserves explicit proprietors before filling nearby unowned jobs', () => {
    const atlas = getBridgeAtlas(SEED);
    const {plan} = canonicalArtifactTownForSiteFromAtlas(atlas, SEED, {burgId: BURG, envelope: {x: 0, y: 0, width: 0, height: 0}, gates: []}, LIFE.layoutRevision);
    const roster = generateTownRoster(plan, canonicalTownSeedPath(SEED, BURG), {nameFor: getBurgNamer(SEED, BURG)});
    expect(roster.occupants.find(o => o.householdMemberId === 'b1:head')).toMatchObject({name: 'Bryn Hartdown', homePlotId: 1, workPlotId: 47, occupation: 'shopkeeper'});
    expect(roster.occupants.find(o => o.workPlotId === 0)?.householdMemberId).toBe('b3:head');
    for (const plot of plan.plots.filter(p => p.pop?.proprietorHomeId && ['market', 'workshop'].includes(p.role))) {
      const head = roster.occupants.find(o => o.householdMemberId === `${plot.pop!.proprietorHomeId}:head`);
      if (head) expect(head.workPlotId, `owner ${plot.pop!.proprietorHomeId}`).toBe(plot.id);
    }
  });
  it('uses the actual owner and household in keeper names, ages and dialogue', () => {
    const home = townBuildingVisit(SEED, BURG, 3, undefined, undefined, LIFE.layoutRevision).household!;
    const result = computeBurgMerchants(SEED, BURG, 1, {}, {}, LIFE);
    const keeper = result.npcs.find(n => n.id === 'npc_burg_10_plot_0')!;
    expect(keeper.name).toBe(home.members[0].name);
    expect(keeper.biography.age).toBe(home.members[0].age);
    expect(keeper.baseDescription).toContain(home.members[0].occupation);
    expect(keeper.initialPersonalityPrompt).toContain(home.members[1].name);
    expect(result.npcs.find(n => n.id === 'npc_burg_10_plot_47')!.name).toBe('Bryn Hartdown');
  });
  it('repairs a legacy name and family while retaining id, stock, capabilities and authoritative meeting memory', () => {
    const first = computeBurgMerchants(SEED, BURG, 1, {}, {}, LIFE), npcs = byId(first.npcs), businesses = byId(first.businesses);
    const original = {...npcs.npc_burg_10_plot_0, name: 'Senekus'};
    delete (original as typeof original & {worldforgeHousehold?: unknown}).worldforgeHousehold;
    npcs[original.id] = original;
    const memory = {...original.memory!, knownFacts: [{id: 'saved-meeting', text: 'Met Sana.', factKey: 'player_met_npc'} as never], lastInteractionTimestamp: 1234};
    const state = createMockGameState({generatedNpcs: npcs, worldBusinesses: businesses, npcMemory: {[original.id]: memory}, metNpcIds: [original.id]});
    const result = computeBurgMerchants(SEED, BURG, 8, npcs, businesses, LIFE);
    const repaired = result.npcs.find(n => n.id === original.id)!;
    expect(repaired).toBeDefined();
    expect(repaired.name).not.toBe('Senekus');
    expect(repaired.id).toBe(original.id);
    expect(repaired.stats).toBe(original.stats);
    expect(repaired.equippedItems).toBe(original.equippedItems);
    expect(repaired.memory).toBe(original.memory);
    expect(original.name).toBe('Senekus');
    expect(result.businesses).toEqual([]);
    const patch = npcReducer(state, {type: 'REGISTER_GENERATED_NPC', payload: {npc: repaired}});
    expect(patch.npcMemory).toBe(state.npcMemory);
    expect(patch.npcMemory![original.id]).toBe(memory);
    expect(state.metNpcIds).toEqual([original.id]);
    const again = computeBurgMerchants(SEED, BURG, 9, {...npcs, ...byId(result.npcs)}, businesses, LIFE);
    expect(again).toEqual({npcs: [], businesses: []});
  });
  it('links an already-met child’s parent to the same keeper id without resetting the child', () => {
    const visit = townBuildingVisit(SEED, BURG, 1, undefined, undefined, LIFE.layoutRevision);
    const child = createHouseholdResidentNpc(visit, 4, 'npc_burg_10_member_b1:child:3', SEED, BURG);
    const first = computeBurgMerchants(SEED, BURG, 1, {}, {}, LIFE);
    const result = computeBurgMerchants(SEED, BURG, 1, {...byId(first.npcs), [child.id]: child}, byId(first.businesses), LIFE);
    const revised = result.npcs.find(n => n.id === child.id)!;
    expect(revised.biography.family.find(m => m.relation === 'parent')).toMatchObject({id: 'npc_burg_10_plot_47', name: 'Bryn Hartdown', occupation: 'innkeeper'});
    expect(revised.memory).toBe(child.memory);
    expect(revised.stats).toBe(child.stats);
  });
});
