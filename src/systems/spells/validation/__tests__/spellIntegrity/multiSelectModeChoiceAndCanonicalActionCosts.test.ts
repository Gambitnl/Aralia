import { describe, it, expect } from 'vitest';
import {
  CANONICAL_ACTION_COSTS,
  SpellIntegrityValidator,
  normalizeGrantedAction,
} from '../../SpellIntegrityValidator';
import { ModeChoice, MULTI_SELECT_MODE_CHOICE_TYPES } from '../../modeChoiceSchemas';
import { Spell } from '../../../../../types/spells';

/**
 * This file proves two contracts that packet PK-06 added.
 *
 * First, a mode menu can commit to several options at once. A single-select
 * menu still records its menu size in `optionCount`, while a multi-select menu
 * records a selection budget there - Commune with Nature offers 5 information
 * categories and the caster picks 3.
 *
 * Second, granted-action rows resolve onto one canonical action cost. The
 * corpus authors those rows in two spellings, `type`/`action`/`frequency` and
 * the legacy `actionType`/`name`/`timing`, and names costs in source terms such
 * as a Magic action or a free command. `CANONICAL_ACTION_COSTS` and
 * `normalizeGrantedAction` map both spellings onto the cost the action economy
 * actually spends.
 */

/** Builds the smallest spell record the validator accepts around a mode menu. */
function spellWithModeChoice(id: string, modeChoice: unknown, effects: unknown[] = []): Spell {
  return {
    id,
    duration: { concentration: false },
    tags: [],
    effects,
    aiContext: { playerInputRequired: true },
    modeChoice,
  } as unknown as Spell;
}

/** Builds the smallest spell record the validator accepts around a granted action. */
function spellWithGrantedAction(id: string, grantedAction: unknown): Spell {
  return {
    id,
    duration: { concentration: false },
    tags: [],
    effects: [
      {
        type: 'UTILITY',
        description: 'A utility effect that grants a follow-up action.',
        trigger: { type: 'immediate' },
        grantedActions: [grantedAction],
      },
    ],
  } as unknown as Spell;
}

/** Returns only the errors the named rule raised. */
function errorsMatching(spell: Spell, marker: string): string[] {
  return SpellIntegrityValidator.validate(spell).filter(error => error.includes(marker));
}

describe('Multi-select mode choice semantics', () => {
  it('names choose_multiple as the only multi-select menu shape', () => {
    expect([...MULTI_SELECT_MODE_CHOICE_TYPES]).toEqual(['choose_multiple']);
  });

  it('accepts a choose_multiple menu that picks fewer options than it offers', () => {
    const spell = spellWithModeChoice('choose-three-of-five', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Terrain', summary: 'Terrain and bodies of water.' },
        { label: 'Life', summary: 'Prevalent plants, minerals, or peoples.' },
        { label: 'Otherworldly', summary: 'One powerful otherworldly creature.' },
        { label: 'Planar', summary: 'Planar influence or a portal.' },
        { label: 'Settlements', summary: 'Settlements or constructed features.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toEqual([]);
  });

  it('fails a choose_multiple menu that selects more options than it offers', () => {
    const spell = spellWithModeChoice('choose-more-than-offered', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Terrain', summary: 'Terrain and bodies of water.' },
        { label: 'Life', summary: 'Prevalent plants, minerals, or peoples.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: multi-select optionCount 3 must select between 1 and 2 of its options'
    );
  });

  it('fails a choose_multiple menu that selects nothing', () => {
    const spell = spellWithModeChoice('choose-none', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 0,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Terrain', summary: 'Terrain and bodies of water.' },
        { label: 'Life', summary: 'Prevalent plants, minerals, or peoples.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: multi-select optionCount 0 must select between 1 and 2 of its options'
    );
  });

  it('keeps single-select menus pinned to their menu size', () => {
    const spell = spellWithModeChoice('single-select-drift', {
      type: 'choose_one',
      timing: 'on_cast',
      optionCount: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Fire', summary: 'Deal Fire damage.' },
        { label: 'Cold', summary: 'Deal Cold damage.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: optionCount 3 does not match options length 2'
    );
  });

  it('keeps a per-target single choice pinned to its menu size', () => {
    const spell = spellWithModeChoice('per-target-single-choice', {
      type: 'choose_one_per_target',
      timing: 'on_cast',
      optionCount: 2,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Bright', summary: 'The target sheds bright light.' },
        { label: 'Dim', summary: 'The target sheds dim light.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toEqual([]);
  });

  it('rejects a selection range on a single-select menu', () => {
    const spell = spellWithModeChoice('single-select-with-range', {
      type: 'choose_one',
      timing: 'on_cast',
      optionCount: 2,
      minSelections: 1,
      maxSelections: 2,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Fire', summary: 'Deal Fire damage.' },
        { label: 'Cold', summary: 'Deal Cold damage.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: single-select type "choose_one" must not declare a selection range'
    );
  });

  it('accepts a selection range that contains the selection budget', () => {
    const spell = spellWithModeChoice('choose-one-or-more', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 2,
      minSelections: 1,
      maxSelections: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Celestials', summary: 'Ward against Celestials.' },
        { label: 'Fey', summary: 'Ward against Fey.' },
        { label: 'Fiends', summary: 'Ward against Fiends.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toEqual([]);
  });

  it('fails a selection budget that sits outside its declared range', () => {
    const spell = spellWithModeChoice('budget-outside-range', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 1,
      minSelections: 2,
      maxSelections: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Celestials', summary: 'Ward against Celestials.' },
        { label: 'Fey', summary: 'Ward against Fey.' },
        { label: 'Fiends', summary: 'Ward against Fiends.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: optionCount 1 falls below minSelections 2'
    );
  });

  it('fails an inverted selection range', () => {
    const spell = spellWithModeChoice('inverted-range', {
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 2,
      minSelections: 3,
      maxSelections: 2,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Celestials', summary: 'Ward against Celestials.' },
        { label: 'Fey', summary: 'Ward against Fey.' },
        { label: 'Fiends', summary: 'Ward against Fiends.' },
      ],
    });

    expect(errorsMatching(spell, 'Mode Choice Invalid')).toContain(
      'Mode Choice Invalid: minSelections 3 exceeds maxSelections 2'
    );
  });

  it('parses a choose_multiple menu through the Zod schema', () => {
    const parsed = ModeChoice.safeParse({
      type: 'choose_multiple',
      timing: 'on_cast',
      optionCount: 3,
      optionsSource: 'effects[0].controlOptions',
      options: [
        { label: 'Terrain', summary: 'Terrain and bodies of water.' },
        { label: 'Life', summary: 'Prevalent plants, minerals, or peoples.' },
        { label: 'Otherworldly', summary: 'One powerful otherworldly creature.' },
        { label: 'Planar', summary: 'Planar influence or a portal.' },
        { label: 'Settlements', summary: 'Settlements or constructed features.' },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects a single-select menu whose optionCount drifts, through the Zod schema', () => {
    const parsed = ModeChoice.safeParse({
      type: 'choose_one',
      timing: 'on_cast',
      optionCount: 3,
      optionsSource: 'modeChoice.options',
      options: [
        { label: 'Fire', summary: 'Deal Fire damage.' },
        { label: 'Cold', summary: 'Deal Cold damage.' },
      ],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map(issue => issue.message)).toContain(
      'Single-select modeChoice "choose_one" must set optionCount to the menu size 2, found 3'
    );
  });
});

describe('Canonical action-cost mapping', () => {
  it('maps every source-backed cost label onto a canonical cost', () => {
    expect(CANONICAL_ACTION_COSTS).toEqual({
      action: 'action',
      magic_action: 'action',
      only_available_action: 'action',
      bonus_action: 'bonus_action',
      reaction: 'reaction',
      free: 'free',
      free_command: 'free',
      no_action: 'free',
      narrative_control: 'free',
      question: 'free',
      attack_action_modifier: 'special',
    });
  });

  it('normalizes a canonical granted-action row', () => {
    expect(
      normalizeGrantedAction({
        type: 'free_command',
        action: 'Verbally Command Giant Insect',
        frequency: 'each_turn',
        rangeLimit: 60,
      })
    ).toEqual({
      sourceCost: 'free_command',
      canonicalCost: 'free',
      label: 'Verbally Command Giant Insect',
      cadence: 'each_turn',
      rangeCap: 60,
    });
  });

  it('normalizes a legacy actionType/name/timing row', () => {
    expect(
      normalizeGrantedAction({
        actionType: 'magic_action',
        name: 'Exert Telekinetic Will',
        timing: 'on_cast_and_later_caster_turns_before_spell_ends',
        rangeFeet: 60,
      })
    ).toEqual({
      sourceCost: 'magic_action',
      canonicalCost: 'action',
      label: 'Exert Telekinetic Will',
      cadence: 'on_cast_and_later_caster_turns_before_spell_ends',
      rangeCap: 60,
    });
  });

  it('reads a pool-limited legacy row cadence from its cost field', () => {
    expect(
      normalizeGrantedAction({
        actionType: 'no_action',
        name: 'Query Soul',
        cost: 'one_trapped_soul_use',
      })
    ).toEqual({
      sourceCost: 'no_action',
      canonicalCost: 'free',
      label: 'Query Soul',
      cadence: 'one_trapped_soul_use',
      rangeCap: undefined,
    });
  });

  it('accepts a domain action cost that spends no action', () => {
    const spell = spellWithGrantedAction('free-command-spell', {
      type: 'free_command',
      action: 'Command Summoned Demon',
      frequency: 'each_caster_turn',
    });

    expect(errorsMatching(spell, 'Action Cost')).toEqual([]);
  });

  it('accepts a legacy granted-action row', () => {
    const spell = spellWithGrantedAction('legacy-granted-action-spell', {
      actionType: 'bonus_action',
      name: 'Launch Loose Rock',
      timing: 'caster_turn',
      rangeFeet: 60,
    });

    expect(errorsMatching(spell, 'Action Cost')).toEqual([]);
  });

  it('fails a granted action whose cost label has no canonical mapping', () => {
    const spell = spellWithGrantedAction('unmapped-cost-spell', {
      type: 'interpretive_dance',
      action: 'Dance At The Enemy',
      frequency: 'each_turn',
    });

    expect(errorsMatching(spell, 'Action Cost')).toContain(
      'Action Cost Invalid: effect 0 granted action 0 uses unmapped action cost "interpretive_dance"'
    );
  });

  it('fails a granted action that states no cadence in any spelling', () => {
    const spell = spellWithGrantedAction('cadence-free-spell', {
      actionType: 'bonus_action',
      name: 'Mentally Command Animated Undead',
      rangeFeet: 60,
      description: 'The caster can use a Bonus Action to command the Undead.',
    });

    expect(errorsMatching(spell, 'Action Cost')).toContain(
      'Action Cost Invalid: effect 0 granted action 0 must include a non-empty frequency'
    );
  });

  it('fails a granted action whose legacy range cap is not numeric', () => {
    const spell = spellWithGrantedAction('bad-range-spell', {
      actionType: 'action',
      name: 'Move Whirlwind',
      timing: 'caster_turn',
      rangeFeet: 'thirty feet',
    });

    expect(errorsMatching(spell, 'Action Cost')).toContain(
      'Action Cost Invalid: effect 0 granted action 0 rangeLimit must be numeric when present'
    );
  });
});
