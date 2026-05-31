import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WizardFeatureSelection from '../WizardFeatureSelection';
import { CLASSES_DATA } from '../../../../constants';
import type { Class as CharClass, Spell } from '../../../../types';
import fireBolt from '../../../../../public/data/spells/level-0/fire-bolt.json';
import mageHand from '../../../../../public/data/spells/level-0/mage-hand.json';
import minorIllusion from '../../../../../public/data/spells/level-0/minor-illusion.json';
import magicMissile from '../../../../../public/data/spells/level-1/magic-missile.json';
import shield from '../../../../../public/data/spells/level-1/shield.json';

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

const spellbook: Record<string, Spell> = {
  'fire-bolt': fireBolt as Spell,
  'mage-hand': mageHand as Spell,
  'minor-illusion': minorIllusion as Spell,
  'magic-missile': magicMissile as Spell,
  shield: shield as Spell,
};

const wizardSpellcastingInfo = {
  ability: 'Intelligence',
  knownCantrips: 2,
  knownSpellsL1: 1,
  spellList: ['fire-bolt', 'mage-hand', 'minor-illusion', 'magic-missile', 'shield'],
} as NonNullable<CharClass['spellcasting']>;

describe('WizardFeatureSelection', () => {
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
  });
});
