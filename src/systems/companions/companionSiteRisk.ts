/** Elara's travel promise reaches a particular temple, not every danger below
 * it. These selectors use only her disclosed destination and the actual party.
 * They never generate the interior or reveal encounters to obtain an answer. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 03/11/2026, 01:34:27
 * Dependents: components/ConversationPanel/CompanionTravelChoices.tsx, components/World3D/DungeonExpeditionOverlay.tsx, components/World3D/hooks/useInteriorTransition.ts, state/reducers/companionTravelReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { DungeonIdentity } from '@/systems/worldforge/dungeon/world/dungeonIdentity';
import { planRestMeals } from '@/systems/gameplay/restMeals';
import { exhaustionLevelFromConditions } from '@/utils/combat/physicsUtils';
import { resourceDays, WATER_ITEM_ID } from '@/systems/travel/provisioning';

export const ENTRANCE_SURVEY_TERMS = [
  'Inspect the entrance floor together for my restoration work.',
  'Keep the entrance as our way back; either of us may call for retreat.',
  'The purpose is an account for my restoration work, not a promise of treasure.',
  'This agreement does not include descending to another floor.',
] as const;

/** A conversation must still pass the existing contact selector. This extra
 * check establishes the source place and joined person's physical presence. */
export function companionSiteRiskContext(state: GameState, id: string) {
  const companion = state.companions?.[id], agreement = companion?.travelAgreement;
  const person = state.party.find(member => member.id === id);
  if (id !== 'elara_vance' || !companion?.inParty || !person || agreement?.response !== 'accepted' || agreement.worldSeed !== state.worldSeed) return undefined;
  const goal = companion.goals.find(goal => goal.id === agreement.goalId && !goal.isSecret);
  const destination = goal?.disclosedDestination;
  if (!destination || destination.worldSeed !== state.worldSeed || destination.sourceId !== agreement.sourceId || destination.sitePath !== agreement.sitePath || destination.cellId !== state.playerCell?.cellId || state.currentLocationId !== `cell_${destination.cellId}`) return undefined;
  const here = companion.whereabouts, feet = state.playerGroundPos, p = here?.position;
  if (here?.worldSeed !== state.worldSeed || here.locationId !== state.currentLocationId || !feet || !p || ![feet.xM, feet.yM, feet.zM, p.xM, p.yM, p.zM].every(Number.isFinite) || Math.hypot(feet.xM-p.xM, feet.zM-p.zM, feet.yM!-p.yM) > 3) return undefined;
  return { companion, agreement, person, destination };
}

/** Own bags remain owned. Previewing one return-day meal neither consumes food
 * nor treats a companion's surplus as permission to feed somebody else. */
export function companionSiteRiskConcerns(state: GameState, id: string): string[] {
  const context = companionSiteRiskContext(state, id);
  if (!context) return ['We must discuss this together at the temple we agreed to visit.'];
  const concerns: string[] = [];
  if ((context.companion.relationships.player?.approval ?? 0) < 0) concerns.push('I do not trust our decisions enough to take this risk together.');
  const exhausted = state.party.filter(person => exhaustionLevelFromConditions(person.conditions) > 0);
  if (exhausted.length) concerns.push(`${exhausted.map(person => person.name).join(', ')} must recover from exhaustion before we add another risk.`);
  const hurt = state.party.filter(person => person.hp <= 0 || person.hp < person.maxHp / 2);
  if (hurt.length) concerns.push(`${hurt.map(person => person.name).join(', ')} needs care before we go inside.`);
  const meals = planRestMeals(state);
  const without = state.party.filter(person => !meals.fedIds.includes(person.id));
  if (without.length) concerns.push(`${without.map(person => person.name).join(', ')} has no complete day of food and water reserved for the way back. My own supplies are not a shared pantry.`);
  return concerns;
}

/** A compassionate return offer uses the person's real remaining road water.
 * Half a day is a stated reserve for this offer, not a promise that a route is
 * safe or supplied. Water stays with its owner until a reviewed return actually
 * consumes it. The map still quotes time, hazards and ration choices. */
export function companionReturnWaterOffer(state: GameState, id: string) {
  const context = companionSiteRiskContext(state, id);
  if (!context) return undefined;
  const {companion: c} = context, home = c.publicActivity, departure = c.journeyDeparture, leg = c.journey;
  if (!home || home.worldSeed !== state.worldSeed || home.companionId !== id
    || departure?.worldSeed !== state.worldSeed || departure.locationId !== home.locationId
    || home.locationId !== `cell_${home.cellId}` || home.cellId === state.playerCell?.cellId
    || leg?.status !== 'arrived' || leg.worldSeed !== state.worldSeed || leg.to.locationId !== state.currentLocationId
    || !c.memories.some(m => m.id === `${leg.id}:arrived` && m.tags.includes('shared-journey'))) return undefined;
  const amount = Math.max(0, 0.5 - resourceDays(state.inventory, WATER_ITEM_ID));
  // These legacy provisions are actual transferable water. A filled private
  // vessel is not silently donated or duplicated by this handover.
  const waterIndex = (c.inventory ?? []).findIndex(i => i.id === WATER_ITEM_ID && Number.isFinite(i.quantity ?? 1) && (i.quantity ?? 1) > 0);
  const water = c.inventory?.[waterIndex];
  const reason = (c.relationships.player?.approval ?? 0) < 10 ? 'I do not trust this plan enough to share my reserve.'
    : !amount ? 'You already carry at least half a water-day. Let us review the return route before using more of my reserve.'
    : !water || (water.quantity ?? 1) - amount < 0.5 ? 'I will not promise water that would leave me without my own half-day reserve.' : undefined;
  return {context, home, amount, water, waterIndex, reason};
}

/** Both the live doorway and stair action check the saved answer. An existing
 * deeper visit is never deleted; retreat/ascent remain available. Other
 * companions and unrelated dungeons retain their existing entry behavior. */
export function companionDungeonRiskError(state: GameState, identity: DungeonIdentity, depth = 0): string | null {
  const companion = state.companions?.elara_vance, agreement = companion?.travelAgreement;
  if (!companion?.inParty || !state.party.some(person => person.id === companion.id) || agreement?.worldSeed !== state.worldSeed || agreement.sitePath !== identity.seedPath) return null;
  if (agreement.response !== 'accepted') return `${companion.identity.name} has not agreed to this expedition.`;
  if (agreement.exploration?.response !== 'accepted') {
    // A refusal already discussed is not an undiscovered conversation. Show
    // current concerns, and require a new mutual decision if they are resolved.
    const decision = agreement.exploration;
    if (decision && ['declined','withdrawn'].includes(decision.response)) {
      const concerns = companionSiteRiskConcerns(state, companion.id);
      return `${companion.identity.name}: I have not agreed to enter. ${concerns.length ? concerns.join(' ') : 'Our last decision was to stay outside. Talk with me again before entering together.'}`;
    }
    return `${companion.identity.name}: We agreed to inspect the way inside. Discuss the next risks with me before entering together.`;
  }
  if (depth > 0) return `${companion.identity.name}: Our agreement covers the entrance floor. We have not agreed to descend further.`;
  const concerns = companionSiteRiskConcerns(state, companion.id);
  return concerns.length ? `${companion.identity.name}: ${concerns.join(' ')}` : null;
}
