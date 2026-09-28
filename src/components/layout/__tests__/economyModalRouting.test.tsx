/**
 * Economy modal mounting & routing regressions (ui-features G2 / agora-52f1).
 *
 * WHAT THIS PROVES. The three economy overlays — LedgerBook (Enchanted Ledger),
 * CourierPouch and InvestmentBoard — were already built, exported, lazy-imported
 * into GameModals and registered in the shared overlay orchestration registry.
 * What was NOT covered anywhere was the full round trip a player actually makes:
 *
 *     toggle action -> real appReducer -> modal visible -> Escape -> modal hidden
 *
 * The pre-existing GameModals suite stops at "Escape dispatched the right
 * action" with a `vi.fn()` dispatch, so a reducer regression (a slice reducer
 * dropped from the appState pipeline, a toggle case that only ever sets `true`)
 * would not have failed a test. Here `dispatch` feeds the REAL root reducer and
 * re-renders, so the reducer, the mount conditions and the Escape registry are
 * all in the assertion path.
 *
 * The economy modals are deliberately NOT mocked: the criterion "each modal
 * shows meaningful content (not empty shells)" is checked against their real
 * render output.
 */

import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMockGameState } from '../../../utils/core/factories';
import { appReducer } from '../../../state/appState';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState, Location } from '../../../types';
import type { ComponentType } from 'react';

// GameModals reads some children through the context rather than props; the
// economy modals all pull their data from `useGameState`, so this has to track
// the same state object the reducer produces.
let currentState: GameState;
// Commerce Desk (the player-facing entry point) dispatches through the context,
// not through props, so the mocked context has to expose the same live dispatch.
let currentDispatch: (action: AppAction) => void = () => { };

vi.mock('../../../state/GameContext', () => ({
    useGameState: () => ({ state: currentState, dispatch: (action: AppAction) => currentDispatch(action) }),
}));

vi.mock('../../../hooks/useDialogueSystem', () => ({
    useDialogueSystem: vi.fn(() => ({
        generateResponse: vi.fn(),
        handleTopicOutcome: vi.fn(),
    })),
}));

vi.mock('../../../utils/core/permissions', () => ({
    canUseDevTools: () => false,
}));

// The Investment Board lists live lender offers; a deterministic lender keeps
// the "meaningful content" assertion independent of loan-system tuning.
vi.mock('../../../systems/economy/LoanSystem', () => ({
    getAvailableLenders: vi.fn(() => ([
        {
            lenderId: 'guild-1',
            lenderName: 'Merchant Guild',
            factionId: 'guild-1',
            maxAmount: 2500,
            interestRate: 0.09,
            minDuration: 7,
            maxDuration: 30,
            collateralRequired: 'none',
        },
    ])),
}));

vi.mock('../../ui/LoadingSpinner', () => ({
    LoadingSpinner: () => <div>Loading...</div>,
}));

// Siblings that stay closed in these cases but are still imported by GameModals.
vi.mock('../../MapPane', () => ({ default: () => <div data-testid="map-pane" /> }));

let GameModals: ComponentType<any>;

beforeAll(async () => {
    const module = await import('../GameModals');
    GameModals = module.default as ComponentType<any>;
});

const baseLocation: Location = {
    id: 'village-center',
    name: 'Village Center',
    baseDescription: 'A training village.',
    exits: {},
    biomeId: 'plains',
};

const createProps = (gameState: GameState, dispatch: (action: AppAction) => void) => ({
    gameState,
    dispatch,
    onAction: vi.fn(),
    onTileClick: vi.fn(),
    onEnter3DAtCell: vi.fn(),
    playerWorldPos: null,
    allow3DEntry: false,
    currentLocation: baseLocation,
    npcsInLocation: [],
    itemsInLocation: [],
    isUIInteractive: true,
    missingChoiceModal: { isOpen: false, character: null, missingChoice: null },
    onCloseMissingChoice: vi.fn(),
    onConfirmMissingChoice: vi.fn(),
    onFixMissingChoice: vi.fn(),
    handleCloseCharacterSheet: vi.fn(),
    handleClosePartyOverlay: vi.fn(),
    handleDevMenuAction: vi.fn(),
    handleModelChange: vi.fn(),
    handleNavigateToGlossaryFromTooltip: vi.fn(),
    handleOpenGlossary: vi.fn(),
    handleOpenCharacterSheet: vi.fn(),
    onOllamaDontShowAgain: vi.fn(),
    isBanterPaused: false,
    toggleBanterPause: vi.fn(),
    onClearBanterLogs: vi.fn(),
    onForceBanterTrigger: vi.fn(),
    canRegenerateWorldMap: false,
    worldGenerationLockedReason: null,
    onRegenerateWorldMap: vi.fn(),
}) as unknown as any;

const closedState = (overrides: Partial<GameState> = {}) => createMockGameState({
    isMapVisible: false,
    isQuestLogVisible: false,
    isPartyOverlayVisible: false,
    isLogbookVisible: false,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,
    isEncounterModalVisible: false,
    isDiceRollerVisible: false,
    isGeminiLogViewerVisible: false,
    isUnifiedLogViewerVisible: false,
    isNpcTestModalVisible: false,
    isDevMenuVisible: false,
    isCommerceDeskVisible: false,
    isEconomyLedgerVisible: false,
    isCourierPouchVisible: false,
    isInvestmentBoardVisible: false,
    characterSheetModal: { isOpen: false, character: null },
    ...overrides,
});

/**
 * Renders GameModals against a live reducer. `dispatch` is the real routing
 * path: every action produced by the UI (an entry-point button, the Escape
 * fallback, a modal's own close button) is folded through `appReducer` and the
 * tree re-renders from the result.
 */
const renderWithLiveReducer = (initial: GameState) => {
    currentState = initial;
    const dispatched: AppAction[] = [];

    let rerenderNow: () => void = () => { };

    const dispatch = (action: AppAction) => {
        dispatched.push(action);
        currentState = appReducer(currentState, action);
        rerenderNow();
    };

    currentDispatch = dispatch;

    const view = render(<GameModals {...createProps(currentState, dispatch)} />);
    rerenderNow = () => view.rerender(<GameModals {...createProps(currentState, dispatch)} />);

    return { dispatched, dispatch, view };
};

type EconomyModalCase = {
    name: string;
    action: AppAction;
    flag: keyof GameState;
    dialogName: RegExp;
    /** A phrase only that modal's real (non-stub) body renders. */
    content: RegExp;
};

const cases: EconomyModalCase[] = [
    {
        name: 'Ledger Book',
        // NOTE: the board text names this action TOGGLE_LEDGER_BOOK. The action
        // that actually exists (and predates the task) is TOGGLE_ECONOMY_LEDGER;
        // adding a second alias would have split the reducer state.
        action: { type: 'TOGGLE_ECONOMY_LEDGER' } as AppAction,
        flag: 'isEconomyLedgerVisible',
        dialogName: /Enchanted Ledger/i,
        content: /Magically updated/i,
    },
    {
        name: 'Courier Pouch',
        action: { type: 'TOGGLE_COURIER_POUCH' } as AppAction,
        flag: 'isCourierPouchVisible',
        dialogName: /Courier Pouch/i,
        content: /message/i,
    },
    {
        name: 'Investment Board',
        action: { type: 'TOGGLE_INVESTMENT_BOARD' } as AppAction,
        flag: 'isInvestmentBoardVisible',
        dialogName: /Investment Notice Board/i,
        content: /Merchant Guild/i,
    },
];

describe('economy modal mounting and routing', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(cases)('$name: toggle action makes it visible, Escape hides it', async ({ action, flag, dialogName }) => {
        const { dispatch, dispatched } = renderWithLiveReducer(closedState());

        expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();

        // 1. Toggle action -> reducer flips the flag -> modal mounts.
        dispatch(action);
        expect(currentState[flag]).toBe(true);
        expect(await screen.findByRole('dialog', { name: dialogName })).toBeInTheDocument();

        // 2. Escape -> shared overlay registry dispatches the same toggle ->
        //    reducer flips the flag back -> modal unmounts.
        dispatched.length = 0;
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(dispatched).toContainEqual(action);
        expect(currentState[flag]).toBe(false);
        expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();
    });

    it.each(cases)('$name: renders meaningful content, not an empty shell', async ({ action, dialogName, content }) => {
        const { dispatch } = renderWithLiveReducer(closedState({ gold: 500 } as Partial<GameState>));

        dispatch(action);

        const dialog = await screen.findByRole('dialog', { name: dialogName });
        expect(dialog).toHaveTextContent(content);
    });

    it.each(cases)('$name: the window close button routes through the reducer too', async ({ action, flag, dialogName }) => {
        const { dispatch } = renderWithLiveReducer(closedState());

        dispatch(action);
        const dialog = await screen.findByRole('dialog', { name: dialogName });

        // WindowFrame's chrome close control, i.e. the mouse path a player uses.
        const closeButton = Array.from(dialog.querySelectorAll('button'))
            .find(button => button.getAttribute('aria-label') === 'Close');
        expect(closeButton).toBeTruthy();

        fireEvent.click(closeButton!);

        expect(currentState[flag]).toBe(false);
        expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();
    });

    // SystemMenu -> TOGGLE_COMMERCE_DESK -> Commerce Desk tab -> entry button.
    // This asserts the player-reachable chain exists end to end, rather than
    // only that GameModals can render the overlays when a flag is already set.
    const entryPoints: Array<{ modal: string; tab: RegExp; button: RegExp; flag: keyof GameState }> = [
        { modal: 'Ledger Book', tab: /Ventures/i, button: /Open Full Ledger/i, flag: 'isEconomyLedgerVisible' },
        { modal: 'Courier Pouch', tab: /Couriers/i, button: /Open Courier Pouch/i, flag: 'isCourierPouchVisible' },
        { modal: 'Investment Board', tab: /Trade Map/i, button: /Investment Board/i, flag: 'isInvestmentBoardVisible' },
    ];

    it.each(entryPoints)('$modal: opens from its Commerce Desk entry point', async ({ tab, button, flag }) => {
        const { dispatch } = renderWithLiveReducer(closedState());

        dispatch({ type: 'TOGGLE_COMMERCE_DESK' } as AppAction);
        expect(currentState.isCommerceDeskVisible).toBe(true);
        await screen.findByRole('dialog', { name: /Commerce Desk/i });

        fireEvent.click(await screen.findByRole('tab', { name: tab }));
        fireEvent.click(await screen.findByRole('button', { name: button }));

        expect(currentState[flag]).toBe(true);
    });
});
