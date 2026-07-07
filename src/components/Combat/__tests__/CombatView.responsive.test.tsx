/**
 * @file CombatView.responsive.test.tsx
 * Focused layout coverage for the active combat shell on cramped screens.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpellContext from '../../../context/SpellContext';
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
vi.mock('../../BattleMap/CombatIntentPreview', () => ({ CombatIntentPreview: () => <div data-testid="mock-intent-preview" /> }));
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
    targetingMode: false,
    selectedAbility: null,
    startTargeting: vi.fn(),
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
    Element.prototype.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    combatOutcome.battleState = 'active';
    combatOutcome.rewards = null;
    combatOutcome.forceOutcome.mockClear();
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
