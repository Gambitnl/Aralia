/** Elara already has a restoration ambition. The player can offer a smaller
 * contribution: find its entrance and bring a firsthand account back. These
 * helpers bind that work to her disclosed source-world site, without replacing
 * Road Preparations or treating a rumor as witnessed exploration. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:50:00
 * Dependents: components/ConversationPanel/CompanionGoalWorkChoices.tsx, state/reducers/companionGoalWorkReducer.ts, state/reducers/questReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {DiscoveryType, type GameState, type DiscoveryEntry} from '@/types/state';
import {QuestStatus, type Quest} from '@/types/quests';
import {canonicalDungeonId} from '@/systems/worldforge/dungeon/world/dungeonIdentity';
import type {DungeonSite} from '@/systems/worldforge/dungeon/world/dungeonSites';
import {publicCompanionDestinations} from './companionGoalDestinations';

export function companionTempleWork(state: GameState, companionId: string) {
  const entry = publicCompanionDestinations(state, companionId).find(entry => entry.source.sourceId === 'elara_restore_temple_v1'
    && entry.goal.disclosedDestination?.worldSeed === state.worldSeed && entry.goal.disclosedDestination.sitePath === entry.site.sitePath);
  if (!entry) return undefined;
  const questId = `companion:${companionId}:restore_temple:firsthand:${state.worldSeed}`;
  const quest = state.questLog.find(quest => quest.id === questId);
  if (quest && (quest.companionWork?.companionId !== companionId || quest.companionWork.destination.worldSeed !== state.worldSeed
    || quest.companionWork.destination.sitePath !== entry.site.sitePath || quest.companionWork.destination.sourceId !== entry.source.sourceId)) return undefined;
  return {...entry, questId, quest};
}

export function templeAccountQuest(state: GameState, work: NonNullable<ReturnType<typeof companionTempleWork>>): Quest {
  return {
    id: work.questId, title: "Elara's Temple: A Firsthand Account", giverId: work.companion.id, giverName: work.companion.identity.name,
    description: `${work.companion.identity.name} intends to restore the ${work.source.name}, near ${work.source.nearbyBurgName}. She asks you to find its entrance and return with what you actually observe. A sighting does not establish a safe way inside or complete the restoration.`,
    status: QuestStatus.Available, questType: 'Companion', regionHint: work.source.nearbyBurgName, dateOffered: state.gameTime.getTime(),
    objectives: [
      // An offered task uses the public destination she named. The generator's
      // entrance subtitle is learned by reaching it, not by asking for work.
      {id:'find_entrance', description:`Find the entrance to the ${work.source.name}.`, isCompleted:false},
      {id:'report_to_elara', description:'Return to Elara and give your firsthand account.', isCompleted:false},
    ],
    companionWork: {companionId:work.companion.id, goalId:work.goal.id, destination:{...work.goal.disclosedDestination!}, response:'pending'},
  };
}

/** The normal arrived-body discovery owns this account. A bought rumor, the
 * disclosed directions, another world's receipt or a map focus is insufficient. */
export function firsthandTempleAccount(state: GameState, site: Pick<DungeonSite,'sitePath'|'cellId'>) {
  const entranceId = canonicalDungeonId(site.sitePath);
  const locationId = `world:${state.worldSeed}:cell:${site.cellId}:site:${entranceId}`;
  return state.discoveryLog.find(entry => entry.type === DiscoveryType.LOCATION_DISCOVERY && entry.source.type === 'LOCATION'
    && entry.source.id === locationId && entry.associatedLocationId === `cell_${site.cellId}`
    && entry.flags.some(flag => flag.key === 'locationId' && flag.value === locationId)
    && entry.flags.some(flag => flag.key === 'hiddenSiteId' && flag.value === entranceId));
}

/** The quest owner can recognize a real arrival discovery while Elara is far
 * away. This records the player's observation; it does not tell her the news. */
export function companionWorkAccount(state: GameState, quest: Quest, proposed?: Partial<DiscoveryEntry>) {
  const destination=quest.companionWork?.destination;
  if (!destination || destination.worldSeed!==state.worldSeed || !Number.isSafeInteger(destination.worldSeed)
    || destination.sourceId!=='elara_restore_temple_v1'
    || destination.sitePath!==`wf:${destination.worldSeed>>>0}/cell:${destination.cellId}/dungeon:temple-morning-v1`) return undefined;
  const entranceId=canonicalDungeonId(destination.sitePath);
  const locationId=`world:${state.worldSeed}:cell:${destination.cellId}:site:${entranceId}`;
  const matches=(entry:Partial<DiscoveryEntry>)=>entry.type===DiscoveryType.LOCATION_DISCOVERY&&entry.source?.type==='LOCATION'
    &&entry.source.id===locationId&&entry.associatedLocationId===`cell_${destination.cellId}`
    &&entry.flags?.some(flag=>flag.key==='locationId'&&flag.value===locationId)
    &&entry.flags.some(flag=>flag.key==='hiddenSiteId'&&flag.value===entranceId);
  if (proposed && matches(proposed)) return proposed;
  return state.discoveryLog.find(matches);
}

/** Only the deliberate conversation can record that Elara received a report.
 * Generic objective/completion actions cannot manufacture that encounter. */
export function verifiedCompanionWorkReport(state: GameState, quest: Quest): boolean {
  const binding=quest.companionWork;
  if (!binding?.reportDiscoveryId || !state.activeConversation?.isPlayerTurn || state.activeConversation.pendingResponse) return false;
  const work=companionTempleWork(state,binding.companionId);
  return !!work && work.questId===quest.id && companionWorkAccount(state,quest)?.id===binding.reportDiscoveryId;
}
