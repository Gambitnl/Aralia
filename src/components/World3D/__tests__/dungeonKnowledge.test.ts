import {expect, it} from 'vitest';
import {generateDungeon} from '../../../systems/worldforge/dungeon/generateDungeon';
import {ItemType, type Item} from '../../../types';
import {dungeonKnowledge} from '../dungeonKnowledge';
import {CellKind, OverlayKind} from '../../../systems/worldforge/dungeon/types';

it('reveals only traces at explored prop cells and only purchased accounts of this site', () => {
  const plan = generateDungeon({seed: 42, params: {theme: 'crypt'}});
  const first = plan.props.find(prop => prop.eventRef !== undefined)!;
  expect(first).toBeDefined();
  const key = `${Math.floor(first.x / plan.cellFt)},${Math.floor(first.y / plan.cellFt)}`;
  const items = [
    {id: 'bought', name: 'Rumor', type: ItemType.Service, sourceId: 'gossip_dungeon-town-wf:42/sewer-2', description: 'The paid account.'},
    {id: 'elsewhere', name: 'Rumor', type: ItemType.Service, sourceId: 'gossip_dungeon-town-wf:42/crypt-2', description: 'An unrelated secret.'},
  ] as Item[];
  const before = JSON.stringify(plan.props);
  expect(dungeonKnowledge(plan, 'wf:42/sewer', items, []).traces).toEqual([]);
  const known = dungeonKnowledge(plan, 'wf:42/sewer', items, [key]);
  expect(known.heard.map(item => item.id)).toEqual(['bought']);
  expect(known.traces).toContainEqual(expect.objectContaining({label: first.kind.replace(/[-_]+/g, ' ')}));
  expect(JSON.stringify(known)).not.toContain('An unrelated secret.');
  expect(JSON.stringify(known)).not.toContain('yearsAgo');
  expect(JSON.stringify(plan.props)).toBe(before);
});

it('records explored decay surfaces without revealing unseen history or wrapped invalid coordinates', () => {
  const plan = generateDungeon({seed: 42, params: {theme: 'crypt'}});
  const indices = [...plan.grid].flatMap((kind, index) => kind === CellKind.Floor ? [index] : []).slice(0, 2);
  const overlay = plan.overlay.slice();
  overlay[indices[0]] = OverlayKind.Bloom;
  overlay[indices[1]] = OverlayKind.Ice;
  const fixture = {...plan, props: [], overlay};
  const key = `${indices[0] % plan.W},${Math.floor(indices[0] / plan.W)}`;
  const known = dungeonKnowledge(fixture, 'site', [], [key]);
  expect(known.traces).toEqual([{label: 'fungal growth', count: 1}]);
  expect(dungeonKnowledge(fixture, 'site', [], [`${indices[1] % plan.W + plan.W},${Math.floor(indices[1] / plan.W) - 1}`]).traces).toEqual([]);
});
