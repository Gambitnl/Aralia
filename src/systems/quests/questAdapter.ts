/**
 * @file src/systems/quests/questAdapter.ts
 * Bridges rich quest authoring definitions into the legacy quest runtime shape.
 */
import type { Quest, QuestDefinition, QuestFailureCondition, QuestObjectiveProgress } from '@/types';

const getDeadlineFailure = (failureConditions: QuestDefinition['failureConditions']): QuestFailureCondition | undefined => {
  return failureConditions?.find(condition => condition.type === 'Deadline');
};

const adaptObjective = (objective: QuestDefinition['stages'][string]['objectives'][number]): QuestObjectiveProgress => ({
  id: objective.id,
  description: objective.description,
  isCompleted: objective.isCompleted,
  requiredCount: objective.requiredCount,
  currentCount: objective.currentCount,
});

/**
 * Converts a QuestDefinition into the flat Quest shape that reducers and UI
 * still consume. This is the Phase 1 migration bridge: authors can model a
 * staged quest while runtime code keeps reading the currently active stage as a
 * legacy objective list.
 */
export const adaptQuestDefinitionToQuest = (definition: QuestDefinition): Quest => {
  const activeStage = definition.stages[definition.currentStageId];

  if (!activeStage) {
    throw new Error(`QuestDefinition "${definition.id}" references missing stage "${definition.currentStageId}".`);
  }

  const deadlineFailure = getDeadlineFailure(definition.failureConditions);
  const deadline = typeof deadlineFailure?.triggerValue === 'number'
    ? deadlineFailure.triggerValue
    : undefined;

  return {
    id: definition.id,
    title: definition.title,
    description: activeStage.journalEntry || definition.description,
    giverId: definition.giverId,
    status: definition.status,
    objectives: activeStage.objectives.map(adaptObjective),
    rewards: definition.rewards ? {
      gold: definition.rewards.gold,
      xp: definition.rewards.xp,
      items: definition.rewards.itemIds,
      reputation: definition.rewards.reputation,
    } : undefined,
    questType: definition.type,
    regionHint: definition.regionId,
    deadline,
    deadlineConsequence: deadlineFailure ? {
      action: deadlineFailure.consequence === 'Fail' ? 'fail_quest' : 'fail_with_note',
      message: deadlineFailure.description,
    } : undefined,
    dateStarted: definition.dateStarted,
    dateCompleted: definition.dateCompleted,
  };
};
