import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFeatureSelection from '../WizardFeatureSelection';
import type { Class as CharClass, Spell } from '../../../../types';

/**
 * Tests for the Wizard Feature Selection component.
 *
 * Wizard heroes choose their initial Cantrips and Level 1 spells to transcribe into
 * their spellbook during character creation according to their spellcasting info.
 *
 * Connected to: CharacterCreator (Step 2b: Wizard Spell Selection)
 * Tests: Cantrip limits, Level 1 spell limits, disabled state for unselected cards once full, confirm callback.
 */

// ============================================================================
// Mock Spellbook Data
// ============================================================================

const spellbook: Record<string, Spell> = {
  'fire-bolt': {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    classes: [],
    subClasses: [],
    description: 'A bright streak of flame.',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'self' },
    components: { verbal: true, somatic: false, material: false },
    duration: { duration: 'Instantaneous', concentration: false },
    effects: [],
  },
  'mage-hand': {
    id: 'mage-hand',
    name: 'Mage Hand',
    level: 0,
    school: 'Conjuration',
    classes: [],
    subClasses: [],
    description: 'Create a spectral hand.',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { duration: '1 minute', concentration: false },
    effects: [],
  },
  'minor-illusion': {
    id: 'minor-illusion',
    name: 'Minor Illusion',
    level: 0,
    school: 'Illusion',
    classes: [],
    subClasses: [],
    description: 'Create a small illusion.',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'self' },
    components: { verbal: true, somatic: false, material: true },
    duration: { duration: '1 minute', concentration: false },
    effects: [],
  },
  'magic-missile': {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    classes: [],
    subClasses: [],
    description: 'Unerring darts of force.',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false },
    duration: { duration: 'Instantaneous', concentration: false },
    effects: [],
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    classes: [],
    subClasses: [],
    description: 'A burst of arcane force.',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'self' },
    components: { verbal: true, somatic: false, material: false },
    duration: { duration: '1 minute', concentration: false },
    effects: [],
  },
} as unknown as Record<string, Spell>;

// The selector only needs a thin layout shell in tests. We keep the real spell
// picking logic mounted, but replace the surrounding page chrome with a small
// harness so the assertions stay focused on selection behavior.
vi.mock('../../ui/CreationStepLayout', () => ({
  CreationStepLayout: ({
    title,
    children,
    onBack,
    onNext,
    canProceed,
    nextLabel,
  }: {
    title: string;
    children: React.ReactNode;
    onBack?: () => void;
    onNext?: () => void;
    canProceed?: boolean;
    nextLabel?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onNext} disabled={!canProceed}>
        {nextLabel}
      </button>
    </div>
  ),
}));

const wizardSpellcastingInfo = {
  ability: 'Intelligence',
  knownCantrips: 2,
  knownSpellsL1: 1,
  spellList: ['fire-bolt', 'mage-hand', 'minor-illusion', 'magic-missile', 'shield'],
} as NonNullable<CharClass['spellcasting']>;

describe('WizardFeatureSelection', () => {
  // ============================================================================
  // Spell Selection & Submit Tests
  // ============================================================================

  it('limits cantrip and level 1 choices and submits the selected spell IDs', () => {
    const onWizardFeaturesSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <WizardFeatureSelection
        spellcastingInfo={wizardSpellcastingInfo}
        allSpells={spellbook}
        onWizardFeaturesSelect={onWizardFeaturesSelect}
        onBack={onBack}
      />
    );

    expect(screen.getByRole('heading', { name: 'Wizard Spell Selection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Spells' })).toBeDisabled();

    // Spell cards use the visible card content as the checkbox name, so the
    // test selects by spell title instead of an older hidden "Select ..." label.
    fireEvent.click(screen.getByRole('checkbox', { name: /Fire Bolt/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mage Hand/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Magic Missile/i }));

    expect(screen.getByRole('checkbox', { name: /Minor Illusion/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm Spells' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Spells' }));

    expect(onWizardFeaturesSelect).toHaveBeenCalledTimes(1);
    const [selectedCantrips, selectedSpellsL1] = onWizardFeaturesSelect.mock.calls[0];
    expect(selectedCantrips.map((spell: Spell) => spell.id)).toEqual(['fire-bolt', 'mage-hand']);
    expect(selectedSpellsL1.map((spell: Spell) => spell.id)).toEqual(['magic-missile']);

    // The back button is not part of the selection proof, but the harness keeps
    // it visible so the real step layout contract stays intact while the test
    // focuses on spell selection and submit gating.
    expect(onBack).not.toHaveBeenCalled();
  }, 15000);

  // agora-f821.59 (Remy, Agora 8335): under the 2014 rules the creator holds a
  // level 2 step for the Arcane Tradition; under 2024 the tradition waits.
  const traditions = [
    { id: 'evocation', name: 'School of Evocation', description: 'Sculpt destructive magic.' },
    { id: 'abjuration', name: 'School of Abjuration', description: 'Ward and protect.' },
  ];

  const pickSpells = () => {
    fireEvent.click(screen.getByRole('checkbox', { name: /Fire Bolt/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mage Hand/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Magic Missile/i }));
  };

  it('2024: shows no tradition step and sends no tradition', () => {
    const onWizardFeaturesSelect = vi.fn();
    render(
      <WizardFeatureSelection
        spellcastingInfo={wizardSpellcastingInfo}
        traditions={traditions}
        rulesEdition="2024"
        allSpells={spellbook}
        onWizardFeaturesSelect={onWizardFeaturesSelect}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Level 2 Step/)).not.toBeInTheDocument();
    expect(screen.getByText('You choose an Arcane Tradition at level 3.')).toBeInTheDocument();
    pickSpells();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Spells' }));
    expect(onWizardFeaturesSelect.mock.calls[0][2]).toBeUndefined();
  }, 15000);

  it('2014: the level 2 step blocks confirm until a tradition is chosen, then sends it', () => {
    const onWizardFeaturesSelect = vi.fn();
    render(
      <WizardFeatureSelection
        spellcastingInfo={wizardSpellcastingInfo}
        traditions={traditions}
        rulesEdition="2014"
        allSpells={spellbook}
        onWizardFeaturesSelect={onWizardFeaturesSelect}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Level 2 Step: Choose Your Arcane Tradition' })).toBeInTheDocument();
    pickSpells();
    const confirm = screen.getByRole('button', { name: 'Confirm Spells' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /School of Abjuration/ }));
    expect(screen.getByRole('button', { name: /School of Abjuration/ })).toHaveAttribute('aria-pressed', 'true');
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onWizardFeaturesSelect.mock.calls[0][2]).toBe('abjuration');
  }, 15000);
});
