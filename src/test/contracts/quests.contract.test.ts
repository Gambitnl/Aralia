import { describe, it, expectTypeOf } from 'vitest';
import { Quest, QuestObjective, QuestObjectiveProgress, QuestStatus } from '@/types/quests';

describe('contract: quests', () => {
  it('QuestObjective requires id/description/type/isCompleted', () => {
    const objective: QuestObjective = {
      id: 'obj1',
      description: 'Do the thing',
      type: 'Talk',
      isCompleted: false,
    };
    expectTypeOf(objective).toMatchTypeOf<QuestObjective>();
  });

  it('QuestObjectiveProgress tracks id/description with optional counts', () => {
    const progress: QuestObjectiveProgress = {
      id: 'obj1',
      description: 'Legacy progress',
      isCompleted: false,
      requiredCount: 3,
      currentCount: 1,
    };
    expectTypeOf(progress).toMatchTypeOf<QuestObjectiveProgress>();
  });

  it('Quest carries status and objectives array', () => {
    const quest: Quest = {
      id: 'quest1',
      title: 'Contract Quest',
      description: 'Test quest',
      status: QuestStatus.Active,
      objectives: [
        {
          id: 'obj1',
          description: 'Do it',
          isCompleted: false,
        },
      ],
    };
    expectTypeOf(quest).toMatchTypeOf<Quest>();
  });
});
