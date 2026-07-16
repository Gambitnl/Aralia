/**
 * @file travelEncounterMonsters.ts — pick the foes for a "danger on the road" fight.
 *
 * When rollTravelEncounter says an ambush happens, this chooses a small,
 * level-1-appropriate monster group deterministically from the trip seed so the
 * same trip always yields the same foes. Kept pure (no React/bestiary import):
 * it returns lightweight monster stubs ({name, quantity, cr}) that
 * handleStartBattleMapEncounter resolves against the runtime bestiary. Actor
 * selection does not authorize terrain; the travel caller must independently
 * provide the destination's WorldForge tactical projection.
 *
 * Before this, a rolled encounter only PRINTED "danger finds you — an encounter!"
 * and no fight ever started; the fake message was worse than none.
 */
import { rngFromPath, streamPath, type SeedPath } from '../worldforge/seedPath';
import type { RoutePlan } from './routePlanning';

export interface TravelEncounterMonster {
  name: string;
  quantity: number;
  cr: string;
  description: string;
}

/** Low-CR road threats sized for a fresh level 1–3 party. */
const ROAD_THREATS: Array<Omit<TravelEncounterMonster, 'quantity'>> = [
  { name: 'Wolf', cr: '1/4', description: 'A lean grey wolf, ribs showing, hunting along the road.' },
  { name: 'Goblin', cr: '1/4', description: 'A snarling goblin brandishing a crude blade.' },
  { name: 'Bandit', cr: '1/8', description: 'A desperate highway robber demanding your coin.' },
  { name: 'Giant Rat', cr: '1/8', description: 'A dog-sized rat with filthy yellow teeth.' },
  { name: 'Kobold', cr: '1/8', description: 'A skittering kobold with a stolen spear.' },
];

/**
 * Choose the monster group for a travel ambush. Deterministic from the route's
 * endpoints + length so the same trip always fights the same foes. Group size
 * scales gently with the route's danger (1 on a calm road, up to 3 on a bad one)
 * and is capped so an early-game party can win.
 */
export function pickTravelEncounterMonsters(route: RoutePlan, seedPath: SeedPath): TravelEncounterMonster[] {
  const sig = `encmon:${route.cells[0]}-${route.cells[route.cells.length - 1]}:${route.cells.length}`;
  const rng = rngFromPath(streamPath(seedPath, sig));

  const threat = ROAD_THREATS[Math.floor(rng.next() * ROAD_THREATS.length)];
  const danger = Math.max(0, Math.min(1, route.danger));
  const quantity = Math.min(3, 1 + Math.floor(rng.next() * (1 + Math.round(danger * 2))));

  return [{ name: threat.name, quantity, cr: threat.cr, description: threat.description }];
}
