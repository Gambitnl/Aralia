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
import { type SeedPath } from '../worldforge/seedPath';
import type { RoutePlan } from './routePlanning';
export interface TravelEncounterMonster {
    name: string;
    quantity: number;
    cr: string;
    description: string;
}
/**
 * Choose the monster group for a travel ambush. Deterministic from the route's
 * endpoints + length so the same trip always fights the same foes. Group size
 * scales gently with the route's danger (1 on a calm road, up to 3 on a bad one)
 * and is capped so an early-game party can win.
 */
export declare function pickTravelEncounterMonsters(route: RoutePlan, seedPath: SeedPath): TravelEncounterMonster[];
