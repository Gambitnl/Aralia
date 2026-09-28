/**
 * This file verifies the Spellbook tab's rule-link gate (agora-65d0).
 *
 * The gap: the generated spell rule-link dataset was fetched with a silent
 * catch, so a missing or broken artifact looked exactly like a spell that cites
 * no rules. The tab now keeps the spell readable and states that its rule links
 * are unavailable, naming the generator that rebuilds them.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellContext from '../../../../context/SpellContext';
import GlossaryContext from '../../../../context/GlossaryContext';
import { CLASSES_DATA } from '../../../../constants';
import { createMockPlayerCharacter } from '../../../../utils/core/factories';
import type { GlossaryEntry, PlayerCharacter, Spell } from '../../../../types';
import guidance from '@/data/spells/level-0/guidance.json';

const fetchWithTimeoutMock = vi.fn();

vi.mock('../../../../utils/context', () => ({
  fetchWithTimeout: (...args: unknown[]) => fetchWithTimeoutMock(...args),
}));

// Deep children are not what this test proves. The spell card stand-in echoes the
// rule labels it was handed so the assertions can see whether links arrived.
vi.mock('../SpellDetailPane', () => ({
  default: ({ spell }: { spell: Spell }) => <div data-testid="spell-detail">{spell.id}</div>,
}));

vi.mock('../SpellSlotDisplay', () => ({
  default: () => <div data-testid="spell-slots">slots</div>,
}));

vi.mock('../../../Glossary/SpellCardTemplate', () => ({
  default: ({ referencedRules }: { referencedRules?: Array<{ label: string }> }) => (
    <div data-testid="compiled-spell-card">
      {(referencedRules ?? []).map((rule) => rule.label).join(',')}
    </div>
  ),
}));

const { default: SpellbookTab } = await import('../SpellbookTab');

const spellData: Record<string, Spell> = { guidance: guidance as Spell };

const compiledGlossaryEntries: GlossaryEntry[] = [{
  id: 'guidance',
  title: 'Guidance',
  category: 'Spells',
  hasSpellJson: true,
}];

const clericCharacter = createMockPlayerCharacter({
  class: CLASSES_DATA.cleric as unknown as PlayerCharacter['class'],
  classLevels: { cleric: 1 },
  level: 1,
  spellbook: {
    cantrips: ['guidance'],
    preparedSpells: [],
    knownSpells: ['guidance'],
  },
});

function renderTab() {
  return render(
    <SpellContext.Provider value={spellData}>
      <GlossaryContext.Provider value={compiledGlossaryEntries}>
        <SpellbookTab character={clericCharacter} onAction={vi.fn()} />
      </GlossaryContext.Provider>
    </SpellContext.Provider>
  );
}

describe('SpellbookTab rule-link gate', () => {
  beforeEach(() => {
    fetchWithTimeoutMock.mockReset();
  });

  it('warns visibly, names the generator, and reports the error when the dataset fails to load', async () => {
    fetchWithTimeoutMock.mockRejectedValueOnce(new Error('Request failed: 404 Not Found'));

    renderTab();

    expect(await screen.findByText('Rule links unavailable')).toBeInTheDocument();
    expect(screen.getByText(/generateSpellReferencedRulesEnrichment\.ts/)).toBeInTheDocument();
    expect(screen.getByText('Request failed: 404 Not Found')).toBeInTheDocument();
  });

  it('keeps the spell itself visible while the rule links are gated', async () => {
    fetchWithTimeoutMock.mockRejectedValueOnce(new Error('Request failed: 404 Not Found'));

    renderTab();

    expect(await screen.findByTestId('compiled-spell-card')).toBeInTheDocument();
    expect(screen.getByText('Guidance')).toBeInTheDocument();
  });

  it('shows no warning and forwards the rule links when the dataset loads', async () => {
    fetchWithTimeoutMock.mockResolvedValueOnce({
      enrichmentDataset: {
        spells: [{ spellId: 'guidance', referencedRules: [{ label: 'D20 Tests', description: '', glossaryTermId: 'd20_test' }] }],
      },
    });

    renderTab();

    expect(await screen.findByTestId('compiled-spell-card')).toHaveTextContent('D20 Tests');
    expect(screen.queryByText('Rule links unavailable')).not.toBeInTheDocument();
  });
});
