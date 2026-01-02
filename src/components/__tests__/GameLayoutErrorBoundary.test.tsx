
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock GamePhase
vi.mock('../../types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    GamePhase: {
        MAIN_MENU: 0,
        CHARACTER_CREATION: 1,
        PLAYING: 2,
        COMBAT: 3,
        VILLAGE_VIEW: 4,
        BATTLE_MAP_DEMO: 5,
        GAME_OVER: 6,
        LOAD_TRANSITION: 7,
        NOT_FOUND: 8,
        0: 'MAIN_MENU',
        1: 'CHARACTER_CREATION',
        2: 'PLAYING',
        3: 'COMBAT',
        4: 'VILLAGE_VIEW',
        5: 'BATTLE_MAP_DEMO',
        6: 'GAME_OVER',
        7: 'LOAD_TRANSITION',
        8: 'NOT_FOUND',
    },
  };
});

// Mock components to avoid deep rendering
vi.mock('../MainMenu', () => ({ default: () => <div data-testid="main-menu">Main Menu</div> }));
vi.mock('../CharacterCreator/CharacterCreator', () => ({ default: () => <div>Character Creator</div> }));
vi.mock('../Combat/CombatView', () => ({ default: () => <div>Combat View</div> }));
vi.mock('../TownCanvas', () => ({ default: () => <div>Town Canvas</div> }));
vi.mock('../BattleMapDemo', () => ({ default: () => <div>Battle Map</div> }));
vi.mock('../SaveLoad', () => ({ LoadGameTransition: () => <div>Load Game</div> }));
vi.mock('../NotFound', () => ({ default: () => <div>Not Found</div> }));
vi.mock('../../components/ui/LoadingSpinner', () => ({ LoadingSpinner: () => <div>Loading...</div> }));
vi.mock('../../components/NotificationSystem', () => ({ NotificationSystem: () => <div>Notifications</div> }));
vi.mock('../../components/layout/GameModals', () => ({ default: () => <div>Game Modals</div> }));

// Mock GameLayout to throw an error for the test
vi.mock('../layout/GameLayout', () => ({
  default: () => {
    throw new Error('Test Crash in GameLayout');
  },
}));

// Mock AppProviders
vi.mock('../providers/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock appState to set initial phase to PLAYING
vi.mock('../../state/appState', async () => {
  const actual = (await vi.importActual('../../state/appState')) as {
    initialGameState?: Record<string, unknown>;
  };
  const baseState: Record<string, unknown> = actual.initialGameState ?? {};
  return {
    ...actual,
    initialGameState: {
      ...baseState,
      phase: 2, // GamePhase.PLAYING
      party: [{ name: 'Test', id: 'p1' }],
      subMapCoordinates: { x: 5, y: 5 },
      mapData: { tiles: [], gridSize: { rows: 10, cols: 10 } },
      messages: [],
      dynamicLocationItemIds: {},
      currentLocationActiveDynamicNpcIds: [],
    }
  };
});

// Import App after mocks
import App from '../../App';

describe('App Error Handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('catches errors in GameLayout and shows fallback UI', async () => {
    // Suppress console.error for the expected crash
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<App />);

    // Since GameLayout is loaded in Suspense, we might see Loading... first.
    // We wait for the ErrorBoundary text to appear.
    // If GameLayout throws during render inside Suspense, ErrorBoundary should catch it.

    await waitFor(() => {
        expect(screen.getByText(/An error occurred in the main game view/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Oops! Something went wrong/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
