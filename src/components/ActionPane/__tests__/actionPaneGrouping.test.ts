import { describe, it, expect } from 'vitest';
import { groupActionPaneActions, shortPersonActionLabel } from '../actionPaneGrouping';
import type { Action, NPC } from '../../../types';

const npc = (id: string, name: string): NPC => ({ id, name } as NPC);

const talk = (id: string, name: string): Action => ({
  type: 'talk', label: `Talk to ${name}`, payload: { targetNpcId: id }, targetId: id,
});
const askJoin = (id: string, name: string): Action => ({
  type: 'talk', label: `Ask ${name} to join you`, payload: { targetNpcId: id, recruitOffer: { targetNpcId: id } }, targetId: id,
});
const browse = (id: string, store: string): Action => ({
  type: 'OPEN_DYNAMIC_MERCHANT', label: `Browse Goods — ${store}`, payload: { merchantType: 'shop_general', buildingId: id, seedKey: `biz_${id}` },
});
const hire = (id: string, name: string): Action => ({
  type: 'OPEN_DYNAMIC_MERCHANT', label: `Hire ${name}`, payload: { merchantType: 'shop_tavern', buildingId: id, seedKey: `biz_${id}`, hire: true },
});

describe('groupActionPaneActions', () => {
  it('collects each NPC\'s talk + invite under one person group, name-once', () => {
    const npcs = [npc('a', 'Camblexe'), npc('b', 'Clifton')];
    const actions = [talk('a', 'Camblexe'), askJoin('a', 'Camblexe'), talk('b', 'Clifton'), askJoin('b', 'Clifton')];
    const { people } = groupActionPaneActions(actions, npcs);
    expect(people).toHaveLength(2);
    expect(people[0].name).toBe('Camblexe');
    expect(people[0].talk).toBeDefined();
    expect(people[0].secondary).toHaveLength(1); // ask-to-join
  });

  it('routes Browse Goods to shops, not under the person', () => {
    const npcs = [npc('a', 'Camblexe')];
    const { people, shops } = groupActionPaneActions([talk('a', 'Camblexe'), browse('a', 'The Humble Imports')], npcs);
    expect(shops).toHaveLength(1);
    expect(shops[0].label).toContain('The Humble Imports');
    expect(people[0].secondary).toHaveLength(0); // browse did NOT land on the person
  });

  it('keeps Hire as a person secondary (it is about the keeper), separate from Browse', () => {
    const npcs = [npc('t', 'Quatletown')];
    const { people, shops } = groupActionPaneActions(
      [talk('t', 'Quatletown'), hire('t', 'Quatletown'), browse('t', 'The Drunken Raven')],
      npcs,
    );
    expect(people[0].secondary.some((a) => a.label === 'Hire Quatletown')).toBe(true);
    expect(shops).toHaveLength(1); // the tavern's browse is a shop
  });

  it('preserves NPC order and drops people with no actions', () => {
    const npcs = [npc('a', 'Amy'), npc('b', 'Bob'), npc('c', 'Cid')];
    const { people } = groupActionPaneActions([talk('c', 'Cid'), talk('a', 'Amy')], npcs);
    expect(people.map((p) => p.name)).toEqual(['Amy', 'Cid']); // Bob dropped, order kept
  });

  it('sends non-NPC, non-shop actions to other', () => {
    const take: Action = { type: 'take_item', label: 'Take Old Map', payload: { itemId: 'i1' }, targetId: 'i1' };
    const search: Action = { type: 'SEARCH_AREA', label: 'Search the Area' };
    const { other } = groupActionPaneActions([take, search], []);
    expect(other).toHaveLength(2);
  });
});

describe('shortPersonActionLabel', () => {
  it('shortens the repeated-name labels', () => {
    expect(shortPersonActionLabel(talk('a', 'Camblexe'))).toBe('Talk');
    expect(shortPersonActionLabel(askJoin('a', 'Camblexe'))).toBe('Ask to join');
    expect(shortPersonActionLabel(hire('t', 'Quatletown'))).toBe('Hire');
  });
});
