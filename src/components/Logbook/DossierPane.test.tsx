import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DossierPane from './DossierPane';
import { GoalStatus, NPC, SuspicionLevel } from '../../types';

function createNpc(index: number): NPC {
  return {
    id: `npc-${index}`,
    name: `NPC ${index}`,
    baseDescription: `NPC ${index} description`,
    initialPersonalityPrompt: `NPC ${index} prompt`,
    role: 'civilian',
  };
}

describe('DossierPane', () => {
  it('paginates long NPC dossier lists without hiding detail selection', () => {
    const npcs = Array.from({ length: 30 }, (_, index) => createNpc(index + 1));
    const allNpcs = Object.fromEntries(npcs.map(npc => [npc.id, npc]));
    const npcMemory = Object.fromEntries(npcs.map(npc => [
      npc.id,
      {
        disposition: 0,
        knownFacts: [],
        suspicion: SuspicionLevel.Unaware,
        goals: [{ id: `${npc.id}-goal`, description: `${npc.name} goal`, status: GoalStatus.Active }],
      },
    ]));

    render(
      <DossierPane
        isOpen
        onClose={vi.fn()}
        metNpcIds={npcs.map(npc => npc.id)}
        npcMemory={npcMemory}
        allNpcs={allNpcs}
      />
    );

    const listPane = screen.getByTestId('dossier-npc-list');

    expect(within(listPane).getByText('NPC 1')).toBeInTheDocument();
    expect(within(listPane).queryByText('NPC 26')).not.toBeInTheDocument();
    expect(within(listPane).getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(within(listPane).getByRole('button', { name: 'Next' }));

    expect(within(listPane).getByText('NPC 26')).toBeInTheDocument();
    expect(within(listPane).getByText('Page 2 of 2')).toBeInTheDocument();

    fireEvent.click(within(listPane).getByRole('button', { name: 'NPC 26' }));

    expect(screen.getByRole('heading', { name: 'NPC 26' })).toBeInTheDocument();
    expect(screen.getByText('NPC 26 goal')).toBeInTheDocument();
  });
});
