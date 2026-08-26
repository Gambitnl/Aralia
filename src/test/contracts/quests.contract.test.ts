import { describe, it, expect, expectTypeOf } from 'vitest';
import { Quest, QuestObjectiveProgress, QuestStatus, QuestTemplate, QuestType } from '@/types/quests';
import { QUEST_TEMPLATES, INITIAL_QUESTS, instantiateQuest, getQuestById } from '@/data/quests';

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

// The type-level block above guards the declarations. This block guards the shipped data in
// src/data/quests/index.ts against those same declarations, so drift between the Quest type and
// the quest templates fails here instead of at runtime inside a reducer.
describe('contract: quests data (src/data/quests/index.ts)', () => {
  const VALID_QUEST_TYPES: QuestType[] = ['Main', 'Side', 'Guild', 'Dynamic', 'Companion', 'Rumor'];

  it('QUEST_TEMPLATES is keyed by each template id and matches QuestTemplate', () => {
    expectTypeOf(QUEST_TEMPLATES).toMatchTypeOf<Record<string, QuestTemplate>>();
    expect(Object.keys(QUEST_TEMPLATES).length).toBeGreaterThan(0);
    for (const [key, template] of Object.entries(QUEST_TEMPLATES)) {
      expect(template.id).toBe(key);
      expect(typeof template.title).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(Array.isArray(template.objectives)).toBe(true);
      expect(template.objectives.length).toBeGreaterThan(0);
    }
  });

  it('template objectives stay on the flat shape and omit runtime-only fields', () => {
    // QuestTemplate omits isCompleted/currentCount from its objectives; instantiateQuest stamps
    // them. A template that carries either has drifted back toward the runtime Quest shape.
    for (const template of Object.values(QUEST_TEMPLATES)) {
      const seen = new Set<string>();
      for (const objective of template.objectives) {
        expect(typeof objective.id).toBe('string');
        expect(typeof objective.description).toBe('string');
        expect(objective).not.toHaveProperty('isCompleted');
        expect(objective).not.toHaveProperty('currentCount');
        expect(seen.has(objective.id)).toBe(false);
        seen.add(objective.id);
      }
    }
  });

  it('template questType values are members of QuestType', () => {
    for (const template of Object.values(QUEST_TEMPLATES)) {
      if (template.questType !== undefined) {
        expect(VALID_QUEST_TYPES).toContain(template.questType);
      }
    }
  });

  it('template rewards use the flat QuestRewards shape, not the staged QuestReward shape', () => {
    // QuestRewards (runtime) uses `items: string[]`; the staged QuestReward uses `itemIds`.
    // Mixing them is the exact drift this contract exists to catch.
    for (const template of Object.values(QUEST_TEMPLATES)) {
      if (!template.rewards) continue;
      expect(template.rewards).not.toHaveProperty('itemIds');
      if (template.rewards.items !== undefined) {
        expect(Array.isArray(template.rewards.items)).toBe(true);
        for (const itemId of template.rewards.items) {
          expect(typeof itemId).toBe('string');
        }
      }
      for (const numericField of ['gold', 'xp'] as const) {
        const value = template.rewards[numericField];
        if (value !== undefined) expect(typeof value).toBe('number');
      }
    }
  });

  it('instantiateQuest stamps the runtime-only Quest fields', () => {
    const template = Object.values(QUEST_TEMPLATES)[0];
    const quest = instantiateQuest(template);
    expectTypeOf(quest).toMatchTypeOf<Quest>();
    expect(quest.status).toBe(QuestStatus.Active);
    expect(typeof quest.dateStarted).toBe('number');
    expect(quest.dateCompleted).toBeUndefined();
    expect(quest.objectives).toHaveLength(template.objectives.length);
    for (const objective of quest.objectives) {
      expect(objective.isCompleted).toBe(false);
    }
  });

  it('instantiateQuest returns a fresh instance so reducers can mutate safely', () => {
    // The data-layer doc comment promises immutable templates; verify the clone is deep enough
    // that mutating an instance objective cannot write back into the template.
    const template = QUEST_TEMPLATES.lost_map;
    const first = instantiateQuest(template);
    const second = instantiateQuest(template);
    expect(first).not.toBe(second);
    expect(first.objectives[0]).not.toBe(template.objectives[0]);
    first.objectives[0].isCompleted = true;
    expect(second.objectives[0].isCompleted).toBe(false);
    expect(template.objectives[0]).not.toHaveProperty('isCompleted');
  });

  it('INITIAL_QUESTS mirrors QUEST_TEMPLATES as ready-to-use Quest instances', () => {
    expectTypeOf(INITIAL_QUESTS).toMatchTypeOf<Record<string, Quest>>();
    expect(Object.keys(INITIAL_QUESTS).sort()).toEqual(Object.keys(QUEST_TEMPLATES).sort());
    for (const [key, quest] of Object.entries(INITIAL_QUESTS)) {
      expect(quest.id).toBe(key);
      expect(quest.status).toBe(QuestStatus.Active);
      expect(Array.isArray(quest.objectives)).toBe(true);
      for (const objective of quest.objectives) {
        expect(objective.isCompleted).toBe(false);
      }
    }
  });

  it('getQuestById resolves known templates and returns null otherwise', () => {
    const quest = getQuestById('lost_map');
    expect(quest).not.toBeNull();
    expect(quest?.id).toBe('lost_map');
    expect(getQuestById('definitely_not_a_quest')).toBeNull();
  });

  it('quest ids hardcoded in action handlers still resolve against the data', () => {
    // src/hooks/actions/handleItemInteraction.ts dispatches ACCEPT_QUEST for 'lost_map' and then
    // UPDATE_QUEST_OBJECTIVE for objective 'find_map'. Renaming either in the data silently
    // breaks that handler, so pin the pair here until the quest hooks become data-driven.
    const lostMap = INITIAL_QUESTS.lost_map;
    expect(lostMap).toBeDefined();
    expect(lostMap.objectives.map(objective => objective.id)).toContain('find_map');
  });
});
