/**
 * @file CombatView.responsive.test.tsx
 * Focused layout coverage for the active combat shell on cramped screens.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpellContext from '../../../context/SpellContext';
import { Ability } from '../../../types/combat';
import CombatView from '../CombatView';

const combatants = vi.hoisted(() => {
  const makeCharacter = (id: string, name: string, team: 'player' | 'enemy') => ({
    id,
    name,
    team,
    level: 1,
    maxHP: 10,
    currentHP: 10,
    position: { x: 0, y: 0 },
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      speed: 30,
      baseInitiative: 0,
    },
    actionEconomy: {
      action: { used: false },
      bonusAction: { used: false },
      reaction: { used: false },
      movement: { used: 0, total: 30 },
    },
    abilities: [],
    inventory: [],
    conditions: [],
    statusEffects: [],
  });

  return {
    player: makeCharacter('player-1', 'Dev Player', 'player'),
    enemy: makeCharacter('enemy-1', 'Goblin', 'enemy'),
  };
});

const combatOutcome = vi.hoisted(() => ({
  battleState: 'active' as 'active' | 'victory' | 'defeat',
  rewards: null as null | { gold: number; xp: number; items: Array<{ name: string }> },
  forceOutcome: vi.fn(),
}));

const abilityTargeting = vi.hoisted(() => ({
  targetingMode: false,
  selectedAbility: null as Ability | null,
  cancelTargeting: vi.fn(),
}));

const targetingAbility: Ability = {
  id: 'fire-bolt',
  name: 'Fire Bolt',
  description: 'Hurl a mote of fire at a creature within range.',
  type: 'spell',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 24,
  effects: [],
};

// Heavy combat children are mocked so the test exercises CombatView's layout
// rails without loading the full tactical grid, 3D renderer, or log widgets.
vi.mock('../../BattleMap/BattleMap', () => ({ default: () => <div data-testid="mock-battle-map" /> }));
vi.mock('../../BattleMap/BattleMap3D', () => ({ default: () => <div data-testid="mock-battle-map-3d" /> }));
vi.mock('../InPlaceCombatScene', () => ({ default: () => <div data-testid="mock-in-place-combat" /> }));
vi.mock('../../BattleMap/PartyDisplay', () => ({ default: () => <div data-testid="mock-party-display" /> }));
vi.mock('../../BattleMap/InitiativeTracker', () => ({ default: () => <div data-testid="mock-initiative-tracker" /> }));
vi.mock('../../BattleMap/ActionEconomyBar', () => ({ default: () => <div data-testid="mock-action-economy" /> }));
vi.mock('../../BattleMap/AbilityPalette', () => ({
  default: ({ onSelectAbility }: { onSelectAbility: (ability: { id: string; name: string }) => void }) => (
    <button type="button" data-testid="mock-ability-palette" onClick={() => onSelectAbility({ id: 'unarmed-strike', name: 'Unarmed Strike' })}>
      Select ability
    </button>
  ),
}));
vi.mock('../../BattleMap/CombatLog', () => ({ default: () => <div data-testid="mock-combat-log" /> }));
vi.mock('../../BattleMap/AISpellInputModal', () => ({ default: () => <div data-testid="mock-ai-spell-input" /> }));
vi.mock('../../BattleMap/CombatCharacterInspector', () => ({ CombatCharacterInspector: () => <div data-testid="mock-inspector" /> }));
vi.mock('../../CharacterSheet/CharacterSheetModal', () => ({ default: () => <div data-testid="mock-character-sheet" /> }));
vi.mock('../MaplessTerrainSummary', () => ({ default: () => <div data-testid="mock-mapless-summary" /> }));
vi.mock('../ReactionPrompt', () => ({ ReactionPrompt: () => <div data-testid="mock-reaction-prompt" /> }));
vi.mock('../../Crafting/CreatureHarvestPanel', () => ({ CreatureHarvestPanel: () => <div data-testid="mock-harvest-panel" /> }));

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    state: { extractedBattleMap: null },
    dispatch: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useBattleMapGeneration', () => ({
  generateBattleSetup: () => ({
    mapData: { dimensions: { width: 8, height: 8 }, tiles: [] },
    positionedCharacters: [combatants.player, combatants.enemy],
  }),
}));

vi.mock('../../../utils/combatUtils', () => ({
  createPlayerCombatCharacter: () => combatants.player,
}));

vi.mock('../../../hooks/combat/useTurnManager', () => ({
  useTurnManager: () => ({
    turnState: {
      turnOrder: [combatants.player.id, combatants.enemy.id],
      currentCharacterId: combatants.player.id,
    },
    initializeCombat: vi.fn(),
    getCurrentCharacter: () => combatants.player,
    isCharacterTurn: (id: string) => id === combatants.player.id,
    endTurn: vi.fn(),
    executeAction: vi.fn(),
    skipToCharacter: vi.fn(),
    canAffordAction: () => true,
    addDamageNumber: vi.fn(),
    reactiveTriggers: [],
    setReactiveTriggers: vi.fn(),
    activeLightSources: [],
    setActiveLightSources: vi.fn(),
    addSpellZone: vi.fn(),
    spellZones: [],
    setSpellZones: vi.fn(),
    addScheduledSpellEffect: vi.fn(),
    addMovementDebuff: vi.fn(),
    addSpellMovementVisual: vi.fn(),
    addSpellDeliveryVisual: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useAbilitySystem', () => ({
  useAbilitySystem: () => ({
    targetingMode: abilityTargeting.targetingMode,
    selectedAbility: abilityTargeting.selectedAbility,
    startTargeting: vi.fn(),
    cancelTargeting: abilityTargeting.cancelTargeting,
    executeAbility: vi.fn(),
    requestReaction: vi.fn(),
    pendingReaction: null,
  }),
}));

vi.mock('../../../hooks/combat/useCombatLog', () => ({
  useCombatLog: () => ({ logs: [], addLogEntry: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useCombatMessaging', () => ({
  useCombatMessaging: () => ({
    messages: [],
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
  }),
}));

vi.mock('../../../hooks/combat/useCombatAI', () => ({ useCombatAI: vi.fn() }));
vi.mock('../../../hooks/combat/useCombatOutcome', () => ({
  useCombatOutcome: () => combatOutcome,
}));
vi.mock('../../../systems/religion/CombatReligionAdapter', () => ({
  CombatReligionAdapter: { processLogEntry: vi.fn() },
}));
vi.mock('../../../utils/combat/combatLogToMessageAdapter', () => ({
  convertLogEntryToMessage: () => ({ id: 'message-1', text: 'Log entry' }),
}));
vi.mock('../../../systems/combat/fightInPlace/fightInPlaceHandoff', () => ({
  getFightInPlaceHandoff: () => null,
  clearFightInPlaceHandoff: vi.fn(),
}));

describe('CombatView responsive layout', () => {
  beforeEach(() => {
    // JSDOM does not implement element scrolling, but CombatView resets its
    // scroll position on mount in real browsers.
    localStorage.clear();
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    combatOutcome.battleState = 'active';
    combatOutcome.rewards = null;
    combatOutcome.forceOutcome.mockClear();
    abilityTargeting.targetingMode = false;
    abilityTargeting.selectedAbility = null;
    abilityTargeting.cancelTargeting.mockClear();
  });

  it('lets mobile combat rails expand in the page while desktop keeps bounded rail scrolling', () => {
    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    const rosterRail = screen.getByTestId('combat-roster-rail');
    const commandRail = screen.getByTestId('combat-command-rail');

    for (const rail of [rosterRail, commandRail]) {
      expect(rail).toHaveClass('max-h-none');
      expect(rail).toHaveClass('overflow-visible');
      // Desktop rails begin at lg since the 3-column layout survives down to 1024px.
      expect(rail).toHaveClass('lg:overflow-y-auto');
      expect(rail).toHaveClass('lg:max-h-none');
    }
  });

  it('keeps combat toolbar actions at mobile touch-target height', () => {
    // The toolbar is the player's primary combat command row. A cramped rendered
    // playtest found these actions at 34px tall, so the shared combat button
    // base now carries the 44px floor.
    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /New Map/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /End Turn/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /3D View/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /End Battle/i })).toHaveClass('min-h-11');
  });

  it('lets the player independently hide and restore both combat rails', () => {
    // Rail visibility is deliberately user-controlled: hiding the roster must
    // not also remove abilities, and either panel can be restored immediately.
    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    const rosterRail = screen.getByTestId('combat-roster-rail');
    const commandRail = screen.getByTestId('combat-command-rail');
    const rosterToggle = screen.getByRole('button', { name: 'Hide combat roster' });
    const commandToggle = screen.getByRole('button', { name: 'Hide combat commands' });

    fireEvent.click(rosterToggle);
    expect(rosterRail).toHaveClass('hidden');
    expect(commandRail).not.toHaveClass('hidden');
    expect(screen.getByRole('button', { name: 'Show combat roster' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(commandToggle);
    expect(commandRail).toHaveClass('hidden');
    expect(screen.getAllByRole('button', { name: 'Show combat commands' })
      .find(button => button.hasAttribute('aria-pressed')))
      .toHaveAttribute('aria-pressed', 'false');

    // The collapsed rail still leaves a small turn HUD beside the battlefield,
    // so map-focus mode cannot hide the actor, resource state, or End Turn.
    const compactTurnStrip = screen.getByTestId('compact-turn-strip');
    expect(compactTurnStrip).toHaveTextContent('Dev Player');
    expect(compactTurnStrip).toHaveTextContent('Your turn');
    expect(screen.getByLabelText('Action ready')).toBeInTheDocument();
    expect(screen.getByLabelText('30 feet of movement remaining')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "End Dev Player's turn" })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Show combat roster' }));
    fireEvent.click(within(compactTurnStrip).getByRole('button', { name: 'Show combat commands' }));
    expect(rosterRail).not.toHaveClass('hidden');
    expect(commandRail).not.toHaveClass('hidden');
    expect(screen.queryByTestId('compact-turn-strip')).not.toBeInTheDocument();
  });

  it('restores the last rail layout when combat remounts', () => {
    // A later encounter should reopen in the player's deliberate map-focus
    // layout rather than forcing both side panels open every time.
    const firstCombat = render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide combat commands' }));
    expect(screen.getByTestId('combat-command-rail')).toHaveClass('hidden');
    firstCombat.unmount();

    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    expect(screen.getByTestId('combat-command-rail')).toHaveClass('hidden');
    expect(screen.getByTestId('compact-turn-strip')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show combat commands' })
      .find(button => button.hasAttribute('aria-pressed')))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('resizes desktop rails from the keyboard and resets the panel layout', () => {
    // The separator is keyboard-operable even though it only becomes visible at
    // the desktop breakpoint. Its value and grid variable update together.
    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    const grid = screen.getByTestId('combat-layout-grid');
    const rosterHandle = screen.getByRole('separator', { name: 'Resize combat roster' });
    const resetPanels = screen.getByRole('button', { name: 'Reset combat panels' });

    expect(rosterHandle).toHaveAttribute('aria-valuenow', '230');
    expect(resetPanels).toBeDisabled();

    fireEvent.keyDown(rosterHandle, { key: 'ArrowRight' });
    expect(rosterHandle).toHaveAttribute('aria-valuenow', '238');
    expect(grid.style.getPropertyValue('--combat-roster-width')).toContain('238px');
    expect(resetPanels).toBeEnabled();

    fireEvent.click(resetPanels);
    expect(rosterHandle).toHaveAttribute('aria-valuenow', '230');
    expect(grid.style.getPropertyValue('--combat-roster-width')).toContain('230px');
    expect(resetPanels).toBeDisabled();
  });

  it('keeps targeting intent and cancellation visible after switching map renderers', () => {
    abilityTargeting.targetingMode = true;
    abilityTargeting.selectedAbility = targetingAbility;

    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    expect(screen.getByTestId('combat-targeting-hud')).toHaveTextContent('Choose an enemy');

    fireEvent.click(screen.getByRole('button', { name: /3D View/i }));
    expect(screen.getByTestId('combat-targeting-hud')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(abilityTargeting.cancelTargeting).toHaveBeenCalledTimes(1);
  });

  it('returns compact combat players to the battlefield after selecting an ability', () => {
    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    vi.mocked(Element.prototype.scrollIntoView).mockClear();

    screen.getByTestId('mock-ability-palette').click();

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({
      block: 'start',
    }));
  });

  it('keeps combat outcome modals fixed over the viewport', () => {
    combatOutcome.battleState = 'victory';
    combatOutcome.rewards = { gold: 100, xp: 100, items: [] };

    render(
      <SpellContext.Provider value={{} as any}>
        <CombatView
          party={[{ id: 'party-1', name: 'Dev Player' } as any]}
          enemies={[combatants.enemy as any]}
          biome="forest"
          onBattleEnd={vi.fn()}
        />
      </SpellContext.Provider>,
    );

    expect(screen.getByTestId('combat-outcome-modal')).toHaveClass('fixed');
  });
});
