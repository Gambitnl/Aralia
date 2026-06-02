// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:22
 * Dependents: hooks/useAbilitySystem.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell } from '../types/spells';
import { CombatCharacter } from '../types/combat';

export type PerTargetChoicesByTargetId = Record<string, string>;

export type SpellWithPerTargetChoices = Spell & {
  perTargetChoicesByTargetId?: PerTargetChoicesByTargetId;
  perTargetChoicePromptTargetName?: string;
};

export const addPerTargetChoicesToSpell = (
  spell: Spell,
  perTargetChoicesByTargetId: PerTargetChoicesByTargetId
): SpellWithPerTargetChoices => ({
  ...spell,
  perTargetChoicesByTargetId
});

export const getPerTargetChoicesFromSpell = (spell: Spell): PerTargetChoicesByTargetId | undefined => (
  (spell as SpellWithPerTargetChoices).perTargetChoicesByTargetId
);

export const createPerTargetChoicePromptSpell = (spell: Spell, target: CombatCharacter): SpellWithPerTargetChoices => ({
  ...spell,
  perTargetChoicePromptTargetName: target.name
});

export const requestPerTargetChoices = (
  spell: Spell,
  targets: CombatCharacter[],
  requestInput: (spell: Spell, onConfirm: (input: string) => void) => void,
  onComplete: (choicesByTargetId: PerTargetChoicesByTargetId) => void
): void => {
  const choicesByTargetId: PerTargetChoicesByTargetId = {};

  const requestChoiceForTarget = (targetIndex: number): void => {
    const target = targets[targetIndex];

    if (!target) {
      onComplete(choicesByTargetId);
      return;
    }

    requestInput(createPerTargetChoicePromptSpell(spell, target), (input) => {
      choicesByTargetId[target.id] = input;
      requestChoiceForTarget(targetIndex + 1);
    });
  };

  requestChoiceForTarget(0);
};
