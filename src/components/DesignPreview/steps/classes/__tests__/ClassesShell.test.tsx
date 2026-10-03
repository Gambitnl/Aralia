import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CLASSES_DATA } from '../../../../../data/classes';
import { SUBCLASSES } from '../../../../../data/classes/subclasses';
import {
  ClassesDomainShell,
  getCanonicalClassSelectors,
  getCanonicalDefaultSelection,
  resolveClassesShellSelection,
} from '..';

/**
 * This test proves the Classes shell inventory and interaction contract against the
 * production class registries. It exists to catch copied or reordered choices before the
 * Rules host mounts the shell. It calls the shell and canonical data directly, with no
 * decorative subclass mechanics or browser proof because those belong to later leaves.
 */

// ============================================================================
// Canonical inventory expectations
// ============================================================================
// This authored-order list is the acceptance inventory for the current production data.
const EXPECTED_CLASS_NAMES = [
  'Fighter',
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Ranger',
  'Rogue',
  'Paladin',
  'Monk',
  'Sorcerer',
  'Warlock',
  'Wizard',
  'Artificer',
];

// These IDs and names re-inventory every nested row while the implementation derives them
// from SUBCLASSES through subclassesForClass rather than copying this expectation into UI.
const EXPECTED_SUBCLASSES: Record<string, readonly string[]> = {
  fighter: ['Champion', 'Battle Master'],
  barbarian: ['Path of the Berserker', 'Path of the Wild Heart'],
  bard: ['College of Lore', 'College of Valor'],
  cleric: ['Life Domain', 'Light Domain'],
  druid: ['Circle of the Land', 'Circle of the Moon'],
  ranger: ['Hunter', 'Beast Master'],
  rogue: ['Thief', 'Assassin'],
  paladin: ['Oath of Devotion', 'Oath of Vengeance'],
  monk: ['Warrior of the Open Hand', 'Warrior of Shadow'],
  sorcerer: ['Draconic Sorcery', 'Wild Magic Sorcery'],
  warlock: ['Fiend Patron', 'Archfey Patron'],
  wizard: ['Evoker (School of Evocation)', 'Abjurer (School of Abjuration)'],
  artificer: ['Alchemist', 'Armorer'],
};

// ============================================================================
// Canonical data and model proof
// ============================================================================
describe('Classes shell canonical inventory', () => {
  it('exposes exactly 13 canonical class selectors in authored order', () => {
    const selectors = getCanonicalClassSelectors();

    // Compare the adapter to the source object so a UI-only list cannot silently drift.
    expect(Object.keys(CLASSES_DATA)).toHaveLength(13);
    expect(selectors).toHaveLength(13);
    expect(selectors.map((selector) => selector.name)).toEqual(EXPECTED_CLASS_NAMES);
    expect(selectors.map((selector) => selector.id)).toEqual(Object.keys(CLASSES_DATA));
  });

  it('derives the exact canonical subclass order for every class', () => {
    const selectors = getCanonicalClassSelectors();

    // Check every class against both the helper-derived UI model and raw source inventory.
    for (const selector of selectors) {
      expect(selector.subclasses.map((subclass) => subclass.name)).toEqual(EXPECTED_SUBCLASSES[selector.id]);
      expect(selector.subclasses.map((subclass) => subclass.id)).toEqual(
        SUBCLASSES[selector.id].map((subclass) => subclass.id),
      );
      expect(selector.subclasses.every((subclass) => subclass.classId === selector.id)).toBe(true);
    }
  });

  it('uses the first authored class and subclass as the canonical default', () => {
    const selectors = getCanonicalClassSelectors();

    // Reset defaults are source-derived, not guessed from display labels.
    expect(getCanonicalDefaultSelection(selectors)).toEqual({
      classId: Object.keys(CLASSES_DATA)[0],
      subclassId: SUBCLASSES[Object.keys(CLASSES_DATA)[0]][0].id,
    });
    expect(resolveClassesShellSelection(selectors, 'missing')).toEqual(getCanonicalDefaultSelection(selectors));
  });
});

// ============================================================================
// Rendered interaction proof
// ============================================================================
describe('Classes shell interaction contract', () => {
  it('renders 13 class tabs, nested subclass tabs, visible selected state, and reset', () => {
    const onSelectionChange = vi.fn();
    render(<ClassesDomainShell onSelectionChange={onSelectionChange} />);

    const classTablist = screen.getByRole('tablist', { name: 'Classes' });
    const classTabs = within(classTablist).getAllByRole('tab');

    // Only the top row is counted here, keeping the exact 13-selector assertion distinct
    // from the nested subclass row for the currently selected class.
    expect(classTabs).toHaveLength(13);
    expect(classTabs.map((tab) => tab.textContent)).toEqual(EXPECTED_CLASS_NAMES);
    expect(classTabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(classTabs[0]).toHaveAttribute('data-selected', 'true');

    // The first class starts with its first canonical nested option selected.
    const subclassTablist = screen.getByRole('tablist', { name: 'Fighter subclasses' });
    expect(within(subclassTablist).getAllByRole('tab')).toHaveLength(2);
    expect(within(subclassTablist).getByRole('tab', { name: 'Champion' })).toHaveAttribute('aria-selected', 'true');

    // Selecting another class deterministically selects that class's first subclass.
    fireEvent.click(screen.getByRole('tab', { name: 'Wizard' }));
    expect(screen.getByRole('tab', { name: 'Wizard' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('tablist', { name: 'Wizard subclasses' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Evoker (School of Evocation)' })).toHaveAttribute('aria-selected', 'true');

    // A nested selection is observable through both selected state and the host callback.
    fireEvent.click(screen.getByRole('tab', { name: 'Abjurer (School of Abjuration)' }));
    expect(screen.getByText('Selected subclass: Abjurer (School of Abjuration)')).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith({ classId: 'wizard', subclassId: 'abjuration' });

    // Reset returns to the source-authored default selection at both levels.
    // The selected subclass demo also owns a Reset control, so the first match is
    // the shell-level reset in the header and keeps this assertion scoped to shell state.
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0]);
    expect(screen.getByRole('tab', { name: 'Fighter' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Champion' })).toHaveAttribute('aria-selected', 'true');
    expect(onSelectionChange).toHaveBeenLastCalledWith({ classId: 'fighter', subclassId: 'champion' });
  });

  it('supports accessible keyboard tabs with roving focus and wrapping', () => {
    render(<ClassesDomainShell />);

    const fighterTab = screen.getByRole('tab', { name: 'Fighter' });
    fireEvent.keyDown(fighterTab, { key: 'ArrowRight' });

    // Arrow navigation selects and focuses the next canonical tab.
    const barbarianTab = screen.getByRole('tab', { name: 'Barbarian' });
    expect(barbarianTab).toHaveAttribute('aria-selected', 'true');
    expect(barbarianTab).toHaveFocus();
    expect(fighterTab).toHaveAttribute('tabindex', '-1');

    // End and Home provide deterministic boundary navigation for keyboard users.
    fireEvent.keyDown(barbarianTab, { key: 'End' });
    const artificerTab = screen.getByRole('tab', { name: 'Artificer' });
    expect(artificerTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(artificerTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Fighter' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Fighter' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Fighter' })).toHaveFocus();
  });
});
