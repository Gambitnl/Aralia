import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeaponMasterySelection from './WeaponMasterySelection';
import { Class as CharClass } from '../../types';

// The fixture uses martial proficiency so the test covers the real mastery list
// without driving the entire character creator flow.
const fighterClass: CharClass = {
  id: 'fighter',
  name: 'Fighter',
  description: 'A master of martial combat.',
  hitDie: 10,
  primaryAbility: ['Strength'],
  savingThrowProficiencies: ['Strength', 'Constitution'],
  skillProficienciesAvailable: [],
  numberOfSkillProficiencies: 2,
  armorProficiencies: [],
  weaponProficiencies: ['Simple weapons', 'Martial weapons'],
  weaponMasterySlots: 2,
  features: [],
} as CharClass;

describe('WeaponMasterySelection', () => {
  it('shows weapon details when a weapon is clicked or focused', () => {
    render(
      <WeaponMasterySelection
        charClass={fighterClass}
        onMasteriesSelect={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Hover, focus, or tap an item for details.')).toBeInTheDocument();

    expect(screen.queryByRole('checkbox', { name: /Rusty Sword/i })).not.toBeInTheDocument();

    const longsword = screen.getByRole('checkbox', { name: /Longsword/i });
    fireEvent.focus(longsword);

    expect(screen.getByRole('heading', { name: 'Longsword' })).toBeInTheDocument();
    expect(screen.getByText('1d8 Slashing')).toBeInTheDocument();

    const greataxe = screen.getByRole('checkbox', { name: /Greataxe/i });
    fireEvent.click(greataxe);

    expect(screen.getByRole('heading', { name: 'Greataxe' })).toBeInTheDocument();
    expect(screen.getByText('1d12 Slashing')).toBeInTheDocument();
  });
});
