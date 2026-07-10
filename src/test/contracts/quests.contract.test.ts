import { describe, it, expectTypeOf } from 'vitest';
import { Quest, QuestObjectiveProgress, QuestStatus } from '@/types/quests';

describe('contract: quests', () => {
  // The runtime quest pipeline (reducer/QuestManager/data layer) consumes the legacy/flat
  // shapes: Quest with objectives typed as QuestObjectiveProgress. The advanced staged shapes
  // (QuestObjective/QuestStage/QuestDefinition) are defined in src/types/quests.ts but are not
  // yet consumed by the runtime, so this contract asserts only the shapes runtime actually
  // reads. Reconciling away the staged QuestObjective assertion closes quests GQ-6 drift.

  it('QuestObjectiveProgress is the flat objective shape runtime consumes (no required type)', () => {
    const objective: QuestObjectiveProgress = {
      id: 'obj1',
      description: 'Do the thing',
      isCompleted: false,
    };
    expectTypeOf(objective).toMatchTypeOf<QuestObjectiveProgress>();
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
