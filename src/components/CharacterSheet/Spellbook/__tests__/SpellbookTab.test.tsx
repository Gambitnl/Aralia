/**
 * This file verifies the Character Sheet Spellbook tab's visible spell tiers,
 * preparation states, and detail selection behavior. It keeps deep layout
 * children small so the assertions focus on the tab's own routing decisions,
 * including compiled glossary details, nested rule navigation, and the legacy
 * fallback for spells that are not compiled.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpellbookTab from '../SpellbookTab';
import SpellbookOverlay from '../SpellbookOverlay';
import shield from '@/data/spells/level-1/shield.json';
import SpellContext from '../../../../context/SpellContext';
import GlossaryContext from '../../../../context/GlossaryContext';
import { CLASSES_DATA } from '../../../../constants';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';
import type { GlossaryEntry, PlayerCharacter, Spell } from '../../../../types';
import guidance from '@/data/spells/level-0/guidance.json';
import bless from '@/data/spells/level-1/bless.json';
import guidingBolt from '@/data/spells/level-1/guiding-bolt.json';
import spiritualWeapon from '@/data/spells/level-2/spiritual-weapon.json';
import revivify from '@/data/spells/level-3/revivify.json';
import magicMissile from '@/data/spells/level-1/magic-missile.json';

// The detail pane and slot display are not what this test is proving. We keep
// the real spellbook component mounted and replace only the deep children that
// would otherwise add unrelated layout noise to the assertion surface.
vi.mock('../SpellDetailPane', () => ({
  default: ({ spell }: { spell: Spell }) => <div data-testid="spell-detail">{spell.id}</div>,
}));

vi.mock('../SpellSlotDisplay', () => ({
  default: () => <div data-testid="spell-slots">slots</div>,
}));

// The real renderer has its own focused tests. This stand-in proves that the
// Spellbook tab chooses a compiled entry and forwards nested rule navigation.
vi.mock('../../../Glossary/FullEntryDisplay', () => ({
  FullEntryDisplay: ({ entry, onNavigate }: { entry: GlossaryEntry; onNavigate?: (termId: string) => void }) => (
    <div data-testid="compiled-spell-detail">
      <span>{entry.id}</span>
      <button type="button" onClick={() => onNavigate?.('concentration')}>Concentration</button>
    </div>
  ),
}));

// JSON-backed spell entries use the shared structured spell card. Its own
// layout has separate tests; this stand-in keeps the navigation contract live.
vi.mock('../../../Glossary/SpellCardTemplate', () => ({
  default: ({ spell, onNavigateToGlossary }: { spell: Spell; onNavigateToGlossary?: (termId: string) => void }) => (
    <div data-testid="compiled-spell-card">
      <span>{spell.id}</span>
      <button type="button" onClick={() => onNavigateToGlossary?.('bright_light')}>Bright Light</button>
    </div>
  ),
}));

vi.mock('../../../ui/WindowFrame', () => ({
  WindowFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const spellData: Record<string, Spell> = {
  guidance: guidance as Spell,
  bless: bless as Spell,
  'guiding-bolt': guidingBolt as Spell,
  'spiritual-weapon': spiritualWeapon as Spell,
  revivify: revivify as Spell,
  'magic-missile': magicMissile as Spell,
};

// Guidance stands in for a spell that has completed the glossary compilation
// pipeline. The production entry carries richer generated fields, but the tab
// only needs the shared identity fields to choose the structured renderer.
const compiledGlossaryEntries: GlossaryEntry[] = [{
  id: 'guidance',
  title: 'Guidance',
  category: 'Spells',
  hasSpellJson: true,
}];

// File-backed entries remain supported through FullEntryDisplay, matching the
// established Spellbook overlay path if the compiler adds such spell records.
const fileBackedGlossaryEntries: GlossaryEntry[] = [{
  id: 'guidance',
  title: 'Guidance',
  category: 'Spells',
  filePath: '/data/glossary/entries/spells/guidance.json',
}];

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
  it.each(['tab', 'overlay'] as const)('keeps the Shield spell identity when equipment owns the same glossary id in the %s', async surface => {
    const character = {...clericCharacter, class: CLASSES_DATA.sorcerer, spellbook: {
      cantrips: [], knownSpells: ['shield'], preparedSpells: ['shield'],
    }} as PlayerCharacter;
    const equipment: GlossaryEntry = {id:'shield', title:'Shield', category:'Equipment',
      filePath:'/data/glossary/entries/equipment/shield.json'};
    render(<SpellContext.Provider value={{shield:shield as Spell}}>
      <GlossaryContext.Provider value={[equipment]}>
        {surface === 'tab' ? <SpellbookTab character={character} onAction={vi.fn()} /> :
          <SpellbookOverlay isOpen character={character} onClose={vi.fn()} onAction={vi.fn()} />}
      </GlossaryContext.Provider>
    </SpellContext.Provider>);
    fireEvent.click(screen.getByRole('button', {name:'Lvl 1'}));
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('shield');
    expect(screen.queryByTestId('compiled-spell-detail')).not.toBeInTheDocument();
  });

  it('shows saved future choices separately from active spells and offers an explicit reset', () => {
    const onAction = vi.fn();
    const active = ['bless'];
    const character = {...clericCharacter, spellbook: {cantrips: [], knownSpells: [], preparedSpells: active,
      preparationPlan: {basePreparedSpells: active, preparedSpells: ['guiding-bolt'], rulesEdition: '2024' as const,
        spellLevels: {bless: 1, 'guiding-bolt': 1}}}};
    render(<SpellContext.Provider value={spellData}><SpellbookTab character={character} onAction={onAction} /></SpellContext.Provider>);
    fireEvent.click(screen.getByRole('button', {name: 'Lvl 1'}));
    expect(screen.getByText(/Current spells stay available until an eligible long rest/)).toBeVisible();
    expect(screen.getByText('After rest')).toBeVisible();
    expect(screen.getByText('Remove after rest')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Reset planned changes'}));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({type: 'TOGGLE_PREPARED_SPELL',
      payload: {characterId: character.id, spellId: '', resetPlan: true}}));
    expect(character.spellbook.preparedSpells).toEqual(['bless']);
  });
  it('lets a cleric prepare an available class spell outside the initial known selection', () => {
    const onAction = vi.fn();
    const character = { ...clericCharacter, spellbook: { cantrips: ['guidance'], knownSpells: ['bless'], preparedSpells: ['bless'] } };
    render(<SpellContext.Provider value={spellData}><SpellbookTab character={character} onAction={onAction} /></SpellContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Lvl 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show All Class Spells' }));
    const card = screen.getByRole('button', { name: /Guiding Bolt/ });
    fireEvent.click(within(card).getByRole('button', { name: 'Plan prepare' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TOGGLE_PREPARED_SPELL', payload: { characterId: character.id, spellId: 'guiding-bolt' },
    }));
    expect(screen.queryByRole('button', { name: 'Lvl 4' })).not.toBeInTheDocument();
  });

  it('does not turn browsing a wizard class spell into learning it', () => {
    const character = { ...clericCharacter, class: CLASSES_DATA.wizard, spellbook: { cantrips: [], knownSpells: [], preparedSpells: [] } } as PlayerCharacter;
    render(<SpellContext.Provider value={spellData}><SpellbookTab character={character} onAction={vi.fn()} /></SpellContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Lvl 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show All Class Spells' }));
    const card = screen.getByRole('button', { name: /Magic Missile/ });
    expect(within(card).queryByRole('button', { name: 'Plan prepare' })).not.toBeInTheDocument();
  });

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

  it('renders a compiled spell entry and sends its nested rule link through the glossary route', async () => {
    const onNavigateToGlossary = vi.fn();

    render(
      <SpellContext.Provider value={spellData}>
        <GlossaryContext.Provider value={compiledGlossaryEntries}>
          <SpellbookTab
            character={clericCharacter}
            onAction={vi.fn()}
            onNavigateToGlossary={onNavigateToGlossary}
          />
        </GlossaryContext.Provider>
      </SpellContext.Provider>
    );

    // A compiled match replaces the legacy pane without changing which spell
    // the list selected, then its rule link leaves through the parent route.
    expect(await screen.findByTestId('compiled-spell-card')).toHaveTextContent('guidance');
    expect(screen.queryByTestId('spell-detail')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bright Light' }));
    expect(onNavigateToGlossary).toHaveBeenCalledWith('bright_light');
  });

  it('keeps file-backed compiled entries on the shared FullEntryDisplay path', async () => {
    render(
      <SpellContext.Provider value={spellData}>
        <GlossaryContext.Provider value={fileBackedGlossaryEntries}>
          <SpellbookTab character={clericCharacter} onAction={vi.fn()} />
        </GlossaryContext.Provider>
      </SpellContext.Provider>
    );

    expect(await screen.findByTestId('compiled-spell-detail')).toHaveTextContent('guidance');
    expect(screen.queryByTestId('spell-detail')).not.toBeInTheDocument();
  });

  it('preserves the legacy detail pane when the selected spell has no compiled entry', async () => {
    render(
      <SpellContext.Provider value={spellData}>
        <GlossaryContext.Provider value={[]}>
          <SpellbookTab character={clericCharacter} onAction={vi.fn()} />
        </GlossaryContext.Provider>
      </SpellContext.Provider>
    );

    // An empty compiled index is a normal migration state, so Guidance still
    // receives its complete legacy spell detail instead of an error placeholder.
    expect(await screen.findByTestId('spell-detail')).toHaveTextContent('guidance');
    expect(screen.queryByTestId('compiled-spell-detail')).not.toBeInTheDocument();
  });
});
