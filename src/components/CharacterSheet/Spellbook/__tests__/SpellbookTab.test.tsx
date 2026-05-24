import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellbookTab from '../SpellbookTab';
import SpellContext from '../../../../context/SpellContext';
import { CLASSES_DATA } from '../../../../constants';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';
import type { PlayerCharacter, Spell } from '../../../../types';
import guidance from '../../../../../public/data/spells/level-0/guidance.json';
import bless from '../../../../../public/data/spells/level-1/bless.json';
import guidingBolt from '../../../../../public/data/spells/level-1/guiding-bolt.json';
import spiritualWeapon from '../../../../../public/data/spells/level-2/spiritual-weapon.json';
import revivify from '../../../../../public/data/spells/level-3/revivify.json';

// The detail pane and slot display are not what this test is proving. We keep
// the real spellbook component mounted and replace only the deep children that
// would otherwise add unrelated layout noise to the assertion surface.
vi.mock('../SpellDetailPane', () => ({
  default: ({ spell }: { spell: Spell }) => <div data-testid="spell-detail">{spell.id}</div>,
}));

vi.mock('../SpellSlotDisplay', () => ({
  default: () => <div data-testid="spell-slots">slots</div>,
}));

const spellData: Record<string, Spell> = {
  guidance: guidance as Spell,
  bless: bless as Spell,
  'guiding-bolt': guidingBolt as Spell,
  'spiritual-weapon': spiritualWeapon as Spell,
  revivify: revivify as Spell,
};

const clericCharacter = createMockPlayerCharacter({
  class: CLASSES_DATA.cleric as unknown as PlayerCharacter['class'],
  classLevels: { cleric: 5 },
  level: 5,
  spellSlots: {
    level_1: { current: 4, max: 4 },
    level_2: { current: 3, max: 3 },
    level_3: { current: 2, max: 2 },
    level_4: { current: 0, max: 0 },
    level_5: { current: 0, max: 0 },
    level_6: { current: 0, max: 0 },
    level_7: { current: 0, max: 0 },
    level_8: { current: 0, max: 0 },
    level_9: { current: 0, max: 0 },
  },
  spellbook: {
    cantrips: ['guidance'],
    preparedSpells: ['bless', 'spiritual-weapon', 'revivify'],
    knownSpells: ['guidance', 'bless', 'guiding-bolt', 'spiritual-weapon', 'revivify'],
  },
});

describe('SpellbookTab', () => {
  it('shows cantrips and levels 1-3 with prepared and known state, then lets the user switch spells', async () => {
    render(
      <SpellContext.Provider value={spellData}>
        <SpellbookTab character={clericCharacter} onAction={vi.fn()} />
      </SpellContext.Provider>
    );

    // The tab bar should reflect the available spell slot levels, including
    // the cantrip lane at level 0 and the first three leveled spell tiers.
    expect(screen.getByRole('button', { name: 'Cantrips' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lvl 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lvl 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lvl 3' })).toBeInTheDocument();

    // Default view starts on cantrips and should surface the selected cantrip.
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('guidance');
    expect(screen.getByText('Guidance')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lvl 1' }));
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('bless');
    expect(screen.getByText('Bless')).toBeInTheDocument();
    expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    expect(screen.getByText('Prep', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Unprepared')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Guiding Bolt'));
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('guiding-bolt');

    fireEvent.click(screen.getByRole('button', { name: 'Lvl 2' }));
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('spiritual-weapon');
    expect(screen.getByText('Spiritual Weapon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lvl 3' }));
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('revivify');
    expect(screen.getByText('Revivify')).toBeInTheDocument();
  });
});
