import type { WorldData, River, Road, Site, BiomeZone, Polygon, Vec2 } from '../types';

it('WorldData shape is constructable with all required fields', () => {
  const point: Vec2 = { x: 0, y: 0 };
  const polygon: Polygon = [point, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const river: River = {
    id: 'r1',
    points: [point, { x: 1, y: 1 }],
    width: [1, 1.2],
    discharge: [10, 12],
  };
  const road: Road = {
    id: 'rd1',
    points: polygon,
    type: 'major',
    fromSiteId: 'a',
    toSiteId: 'b',
  };
  const site: Site = {
    id: 's1',
    kind: 'town',
    position: point,
    footprint: polygon,
    population: 1200,
    walled: true,
    townSeed: 42,
  };
  const biomeZone: BiomeZone = { biomeId: 'forest', polygon };

  const wd: WorldData = {
    version: 2,
    seed: 1,
    templateId: 'continents',
    gridSize: { rows: 40, cols: 60 },
    heights: [],
    temperatures: [],
    moisture: [],
    biomeIds: [],
    rivers: [river],
    roads: [road],
    sites: [site],
    coastlines: [polygon],
    lakes: [],
    biomeZones: [biomeZone],
  };

  expect(wd.version).toBe(2);
  expect(wd.rivers).toHaveLength(1);
  expect(wd.sites[0].kind).toBe('town');
});
