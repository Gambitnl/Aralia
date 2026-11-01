/**
 * @file src/state/reducers/questReducer.ts
 * Reducer for managing quest state.
 *
 * Quest state machine (all transitions are idempotent and safe to re-run):
 *  - Offers are Available without a start date; accepting creates an obligation.
 *  - Withdrawn obligations stay in history and cannot progress or grant rewards.
 *  - Companion entrance observations and personally delivered reports remain
 *    separate; generic completion cannot invent the latter conversation.
 *  - Pending/unknown quests become Active when ACCEPT_QUEST is dispatched.
 *  - Active quests move to Completed automatically when every objective is
 *    marked complete, or explicitly via COMPLETE_QUEST.
 *  - Failed status is preserved if external systems ever flag it, and
 *    objective updates will not resurrect a failed quest.
 *  - Accepted, completed, and failed transitions also queue matching journal
 *    events so the quest log and the journal can stay in sync later.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:50:00
 * Dependents: state/appState.ts, state/reducers/companionGoalWorkReducer.ts, state/reducers/companionPreparationReducer.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, QuestStatus, Quest, GameMessage, WorldRumor } from '../../types';
import { AppAction } from '../actionTypes';
import { ITEMS } from '../../constants';
import { generateId } from '../../utils/core/idGenerator';
import { appendQuestJournalEvent, createQuestJournalEvent } from '../../systems/quests/questJournal';
import { appendAdventureLogEntry } from '../../systems/adventureLog/adventureLog';
import { instantiateItem } from './characterReducer';
import { applyXpAndHandleLevelUps } from '../../utils/character';
import { getRulesEdition } from '../../config/rulesEdition';
import { FactionManager } from '../../systems/world/FactionManager';
import { companionWorkAccount, verifiedCompanionWorkReport } from '../../systems/companions/companionGoalWork';

type NotificationTuple = Pick<GameState, 'notifications'>;

/**
 * Deep-clone and normalize a quest payload to avoid mutating the blueprint
 * imported from src/data/quests. This keeps runtime copies isolated.
 */
const hydrateQuestPayload = (quest: Quest): Quest => ({
  ...quest,
  status: quest.status ?? QuestStatus.Active,
  dateStarted: quest.status === QuestStatus.Available ? undefined : quest.dateStarted ?? Date.now(),
  objectives: quest.objectives.map(obj => ({ ...obj })),
});

const pushNotification = (
  state: GameState,
  message: string,
  type: NotificationTuple['notifications'][number]['type'] = 'info',
  duration = 4000
): NotificationTuple => ({
  notifications: [
    ...state.notifications,
    {
      id: generateId(),
      type,
      message,
      duration,
    },
  ],
});

const applyQuestCompletion = (
  state: GameState,
  questIndex: number,
  quest: Quest
): Partial<GameState> => {
  // Complete the quest once so manual completion and auto-complete from the
  // objective tracker leave the same reward path and the same journal trail.
  const completedQuest: Quest = {
    ...quest,
    status: QuestStatus.Completed,
    dateCompleted: quest.dateCompleted ?? Date.now(),
    objectives: quest.objectives.map(obj => ({ ...obj, isCompleted: true })),
  };

  const newQuestLog = [...state.questLog];
  newQuestLog[questIndex] = completedQuest;

  let updatedParty = state.party;
  let updatedInventory = state.inventory;
  let updatedGold = state.gold;
  let updatedStandings = state.playerFactionStandings;
  const extraMessages: GameMessage[] = [];
  const extraRumors: WorldRumor[] = [];

  if (completedQuest.rewards) {
    const { gold, xp, items, reputation } = completedQuest.rewards;
    if (gold) {
      updatedGold = (state.gold || 0) + gold;
    }
    if (items?.length) {
      const rewardItems = items
        .map(id => ITEMS[id])
        .filter(Boolean)
        .map(item => instantiateItem(item));
      if (rewardItems.length) {
        updatedInventory = [...state.inventory, ...rewardItems];
      }
    }
    if (xp) {
      const rulesEdition = getRulesEdition(state);
      updatedParty = state.party.map(member => applyXpAndHandleLevelUps(member, xp, undefined, rulesEdition));
    }
    if (reputation?.length) {
      let stateForFaction = {
        ...state,
        playerFactionStandings: updatedStandings ?? {},
      };
      for (const rep of reputation) {
        if (!rep.factionId || !rep.change) continue;
        const result = FactionManager.applyReputationChange(
          stateForFaction,
          rep.factionId,
          rep.change,
          `Completed quest "${completedQuest.title}"`
        );
        updatedStandings = result.standings;
        stateForFaction = {
          ...stateForFaction,
          playerFactionStandings: updatedStandings,
        };
        extraMessages.push(...result.logs);
        extraRumors.push(...result.rumors);
      }
    }
  }

  const completionJournalEvent = createQuestJournalEvent(state, {
    type: 'quest_completed',
    quest: completedQuest,
    title: `Quest Completed: ${completedQuest.title}`,
    description: `Completed "${completedQuest.title}" and claimed its rewards.`,
  });

  const isOpening = /situation in|opening/i.test(completedQuest.title) || completedQuest.questType === 'Main';

  return {
    questLog: newQuestLog,
    gold: updatedGold,
    inventory: updatedInventory,
    party: updatedParty,
    ...(updatedStandings !== state.playerFactionStandings ? { playerFactionStandings: updatedStandings } : {}),
    ...(extraRumors.length ? { activeRumors: [...(state.activeRumors || []), ...extraRumors] } : {}),
    ...(extraMessages.length ? { messages: [...(state.messages || []), ...extraMessages] } : {}),
    ...appendQuestJournalEvent(state, completionJournalEvent),
    ...appendAdventureLogEntry(state, {
      kind: isOpening ? 'opening' : 'quest',
      summary: `Completed the quest "${completedQuest.title}".`,
      npcIds: completedQuest.giverId ? [completedQuest.giverId] : undefined,
    }),
    ...pushNotification(state, `Quest Completed: ${completedQuest.title}`, 'success', 5000),
  };
};

export function questReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'ADD_DISCOVERY_ENTRY': {
      let changed = false;
      const questLog = state.questLog.map(quest => {
        if (quest.status !== QuestStatus.Active || !quest.companionWork || !companionWorkAccount(state, quest, action.payload)) return quest;
        if (!quest.objectives.some(objective => objective.id === 'find_entrance' && !objective.isCompleted)) return quest;
        changed = true;
        // Finding the entrance completes the observation only. The companion
        // learns it when the player actually returns and gives the report.
        return { ...quest, objectives: quest.objectives.map(objective => objective.id === 'find_entrance' ? { ...objective, isCompleted: true } : objective) };
      });
      return changed ? { questLog } : {};
    }
    case 'OFFER_QUEST': {
      const prior = state.questLog.find(quest => quest.id === action.payload.id);
      if (prior && prior.status !== QuestStatus.Abandoned) return {};
      const offered = hydrateQuestPayload({ ...action.payload, status: QuestStatus.Available,
        dateOffered: state.gameTime.getTime(), dateStarted: undefined, dateAbandoned: undefined });
      return {
        questLog: prior ? state.questLog.map(quest => quest.id === offered.id ? offered : quest) : [...state.questLog, offered],
        ...appendQuestJournalEvent(state, createQuestJournalEvent(state, { type: 'npc_conversation', quest: offered,
          title: `Work Offered: ${offered.title}`, description: `This work is available. You have not promised to undertake it.` })),
      };
    }
    case 'ACCEPT_QUEST': {
      const prior = state.questLog.find(quest => quest.id === action.payload.id);
      if (prior && prior.status !== QuestStatus.Available) return {};
      // A retained offer is authoritative. Accepting cannot replace its terms,
      // source or rewards with a stale caller's copy of the same quest id.
      const incomingQuest = hydrateQuestPayload(prior
        ? { ...prior, status: QuestStatus.Active, dateStarted: state.gameTime.getTime() }
        : { ...action.payload, status: QuestStatus.Active });
      if (incomingQuest.companionWork && companionWorkAccount(state, incomingQuest)) {
        incomingQuest.objectives = incomingQuest.objectives.map(objective => objective.id === 'find_entrance' ? { ...objective, isCompleted: true } : objective);
      }

      const acceptJournalEvent = createQuestJournalEvent(state, {
        type: 'quest_accepted',
        quest: incomingQuest,
        title: `Quest Accepted: ${incomingQuest.title}`,
        description: `Accepted "${incomingQuest.title}" and added it to the quest log.`,
      });

      return {
        questLog: prior ? state.questLog.map(quest => quest.id === incomingQuest.id ? incomingQuest : quest) : [...state.questLog, incomingQuest],
        ...appendQuestJournalEvent(state, acceptJournalEvent),
        ...pushNotification(state, `Quest Accepted: ${incomingQuest.title}`, 'info'),
      };
    }

    case 'ABANDON_QUEST': {
      const prior = state.questLog.find(quest => quest.id === action.payload.questId);
      if (!prior || prior.status !== QuestStatus.Active) return {};
      const abandoned = { ...prior, status: QuestStatus.Abandoned, dateAbandoned: state.gameTime.getTime(),
        notes: [prior.notes, action.payload.reason].filter(Boolean).join('\n') };
      return {
        questLog: state.questLog.map(quest => quest.id === prior.id ? abandoned : quest),
        ...appendQuestJournalEvent(state, createQuestJournalEvent(state, { type: 'quest_failed', quest: abandoned,
          title: `Promise Withdrawn: ${prior.title}`, description: action.payload.reason })),
      };
    }

    case 'UPDATE_QUEST_OBJECTIVE': {
      const { questId, objectiveId, isCompleted } = action.payload;

      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      const objectiveIndex = quest.objectives.findIndex(o => o.id === objectiveId);

      if (objectiveIndex === -1) return {};
      if (quest.objectives[objectiveIndex].isCompleted === isCompleted) return {};
      if (quest.status !== QuestStatus.Active) return {};
      if (quest.companionWork) {
        if (!isCompleted) return {};
        if (objectiveId === 'find_entrance') { if (!companionWorkAccount(state, quest)) return {}; }
        else if (objectiveId !== 'report_to_elara' || !verifiedCompanionWorkReport(state, quest)) return {};
      }

      const updatedObjectives = [...quest.objectives];
      updatedObjectives[objectiveIndex] = {
        ...updatedObjectives[objectiveIndex],
        isCompleted,
      };

      const updatedQuest = {
        ...quest,
        objectives: updatedObjectives,
      };

      const allObjectivesDone = updatedObjectives.length > 0 && updatedObjectives.every(obj => obj.isCompleted);

      if (allObjectivesDone && (!quest.companionWork || verifiedCompanionWorkReport(state, quest))) {
        // Promote to completion and award rewards.
        return applyQuestCompletion(state, questIndex, updatedQuest);
      }

      const newQuestLog = [...state.questLog];
      newQuestLog[questIndex] = updatedQuest;

      return {
        questLog: newQuestLog,
        ...pushNotification(state, `Quest Updated: ${quest.title}`, 'success', 3000),
      };
    }

    case 'COMPLETE_QUEST': {
      const { questId } = action.payload;
      const questIndex = state.questLog.findIndex(q => q.id === questId);
      if (questIndex === -1) return {};

      const quest = state.questLog[questIndex];
      if (quest.status !== QuestStatus.Active) return {};
      if (quest.companionWork && !verifiedCompanionWorkReport(state, quest)) return {};

      return applyQuestCompletion(state, questIndex, quest);
    }

    default:
      return {};
  }
}
