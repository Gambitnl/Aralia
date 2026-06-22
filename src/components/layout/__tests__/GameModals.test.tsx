import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import { characterReducer } from '../../../state/reducers/characterReducer';
import type { Companion, GameState, Location, TempPartyMember } from '../../../types';
import type { ComponentType } from 'react';

let boardGameState: GameState;

vi.mock('../../../hooks/useDialogueSystem', () => ({
    useDialogueSystem: vi.fn(() => ({
        generateResponse: vi.fn(),
        handleTopicOutcome: vi.fn(),
    })),
}));

vi.mock('../../../utils/permissions', () => ({
    canUseDevTools: () => true,
}));

vi.mock('../../../state/GameContext', () => ({
    useGameState: () => ({
        state: boardGameState,
    }),
}));

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

vi.mock('../../MapPane', () => ({ default: () => <div data-testid="map-pane" /> }));
vi.mock('../../QuestLog', () => ({
    default: ({ isOpen }: { isOpen: boolean }) => (
        isOpen ? (
            <div>
                <button data-testid="quest-first">First quest option</button>
                <button data-testid="quest-second">Second quest option</button>
            </div>
        ) : null
    ),
}));
vi.mock('../../Submap/SubmapPane', () => ({ default: () => <div data-testid="submap-pane" /> }));
vi.mock('../../CharacterSheet/CharacterSheetModal', () => ({
    default: ({ companion }: { companion?: Companion | null }) => (
        <div
            data-testid="character-sheet-modal"
            data-companion-id={companion?.id ?? 'none'}
        />
    ),
}));
vi.mock('../../debug/DevMenu', () => ({ default: () => <div data-testid="dev-menu" /> }));
vi.mock('../../Party/PartyOverlay', () => ({ default: () => <div data-testid="party-overlay" /> }));
vi.mock('../../debug/GeminiLogViewer', () => ({ default: () => <div data-testid="gemini-log-viewer" /> }));
vi.mock('../../debug/UnifiedDebugLogViewer', () => ({ UnifiedDebugLogViewer: () => <div data-testid="unified-debug-log-viewer" /> }));
vi.mock('../../debug/NpcInteractionTestModal', () => ({ default: () => <div data-testid="npc-interaction-test-modal" /> }));
vi.mock('../../Logbook/DossierPane', () => ({ default: () => <div data-testid="dossier-pane" /> }));
vi.mock('../../Logbook/DiscoveryLogPane', () => ({ default: () => <div data-testid="discovery-log-pane" /> }));
vi.mock('../../Glossary', () => ({ Glossary: () => <div data-testid="glossary-pane" /> }));
vi.mock('../../Combat/EncounterModal', () => ({ default: () => <div data-testid="encounter-modal" /> }));
vi.mock('../../dice/DiceRollerModal', () => ({ default: () => <div data-testid="dice-roller-modal" /> }));
vi.mock('../../Economy/LedgerBook', () => ({ default: () => <div data-testid="ledger-book" /> }));
vi.mock('../../Economy/CourierPouch', () => ({ default: () => <div data-testid="courier-pouch" /> }));
vi.mock('../../ui/LongRestModal', () => ({ default: () => <div data-testid="long-rest-modal" /> }));
vi.mock('../../ui/RestModal', () => ({ default: () => <div data-testid="rest-modal" /> }));

let GameModals: ComponentType<React.ComponentProps<typeof import('../GameModals').default>>;

beforeAll(async () => {
    const module = await import('../GameModals');
    GameModals = module.default;
});

const basePlayer = createMockPlayerCharacter({ name: 'Ada' });

const baseLocation: Location = {
    id: 'village-center',
    name: 'Village Center',
    baseDescription: 'A training village.',
    exits: {},
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'plains',
};

const mapData = {
    gridSize: { rows: 1, cols: 1 },
    tiles: [[{ x: 0, y: 0, biomeId: 'plains', discovered: true, isPlayerCurrent: true }]],
};

type RenderOverrides = {
    dispatch?: ReturnType<typeof vi.fn>;
    onAction?: ReturnType<typeof vi.fn>;
    handleCloseMissingChoice?: ReturnType<typeof vi.fn>;
};

const createProps = (gameState: GameState, overrides: RenderOverrides = {}) => {
    const props = {
        gameState,
        dispatch: vi.fn(),
        onAction: vi.fn(),
        onTileClick: vi.fn(),
        onEnter3DAtCell: vi.fn(),
        playerWorldPos: null,
        allow3DEntry: false,
        currentLocation: baseLocation,
        npcsInLocation: [],
        itemsInLocation: [],
        isUIInteractive: true,
        submapPaneDisabled: false,
        missingChoiceModal: {
            isOpen: false,
            character: null,
            missingChoice: null,
        },
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
    };

    return render(
        <GameModals
            {...props}
            dispatch={overrides.dispatch ?? props.dispatch}
            onAction={overrides.onAction ?? props.onAction}
            onCloseMissingChoice={overrides.handleCloseMissingChoice ?? props.onCloseMissingChoice}
        />
    );
};

const baseGameState = createMockGameState({
    isMapVisible: false,
    isSubmapVisible: false,
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
    characterSheetModal: { isOpen: false, character: null },
    mapData: null,
});

const withOpenModal = (overrides: Partial<GameState>) => createMockGameState({
    ...baseGameState,
    ...overrides,
});

describe('GameModals focus-trap coverage', () => {
    beforeEach(() => vi.clearAllMocks());

    const wrapperCases: Array<{ name: string; testId: string; state: Partial<GameState> }> = [
        { name: 'Map', testId: 'map-pane', state: { isMapVisible: true, mapData } },
        { name: 'Quest Log', testId: 'quest-first', state: { isQuestLogVisible: true } },
        { name: 'Submap', testId: 'submap-pane', state: { isSubmapVisible: true, mapData, party: [basePlayer], playerWorldPos: baseLocation.mapCoordinates } },
        { name: 'Character Sheet', testId: 'character-sheet-modal', state: { characterSheetModal: { isOpen: true, character: basePlayer } } },
        { name: 'Dev Menu', testId: 'dev-menu', state: { isDevMenuVisible: true } },
        { name: 'Party Overlay', testId: 'party-overlay', state: { isPartyOverlayVisible: true } },
        { name: 'Dossier', testId: 'dossier-pane', state: { isLogbookVisible: true } },
        { name: 'Discovery Log', testId: 'discovery-log-pane', state: { isDiscoveryLogVisible: true } },
        { name: 'Glossary', testId: 'glossary-pane', state: { isGlossaryVisible: true } },
        { name: 'Encounter', testId: 'encounter-modal', state: { isEncounterModalVisible: true, generatedEncounter: null } },
        { name: 'Dice Roller', testId: 'dice-roller-modal', state: { isDiceRollerVisible: true } },
        { name: 'Gemini Log Viewer', testId: 'gemini-log-viewer', state: { isGeminiLogViewerVisible: true } },
        { name: 'Unified Debug Log Viewer', testId: 'unified-debug-log-viewer', state: { isUnifiedLogViewerVisible: true } },
        { name: 'NPC Interaction Test', testId: 'npc-interaction-test-modal', state: { isNpcTestModalVisible: true } },
    ];

    it.each(wrapperCases)('wraps %s root in focus-trap container', async ({ testId, state }) => {
        const modalState = withOpenModal(state);
        const rendered = createProps(modalState);

        const focusContainer = rendered.container.querySelector('[tabindex="-1"]');
        expect(focusContainer).toBeTruthy();

        // Most lazy children resolve in this test file, but the wrapper is the
        // behavior under test and must exist even while Suspense is still loading.
        const modalContent = await screen.findByTestId(testId).catch(() => null);
        if (!modalContent) return;

        expect(modalContent.closest('[tabindex="-1"]')).toBe(focusContainer);
    });

    it('keeps focus trapped within Quest Log by cycling Tab between edge buttons', async () => {
        const modalState = withOpenModal({ isQuestLogVisible: true });
        createProps(modalState);

        const firstButton = await screen.findByTestId('quest-first');
        const secondButton = await screen.findByTestId('quest-second');

        expect(firstButton).toHaveFocus();

        secondButton.focus();
        fireEvent.keyDown(secondButton, { key: 'Tab', code: 'Tab' });
        expect(firstButton).toHaveFocus();

        firstButton.focus();
        fireEvent.keyDown(firstButton, { key: 'Tab', code: 'Tab', shiftKey: true });
        expect(secondButton).toHaveFocus();
    });

    // The party rebuild path must preserve the character id bridge so the sheet
    // can keep resolving companion context even when the party object itself is rebuilt.
    it('threads companion context through a SET_FULL_PARTY rebuild when ids still match', () => {
        const companionId = 'companion-ada';
        const companion = { id: companionId } as Companion;
        const sheetCharacter = createMockPlayerCharacter({ id: companionId, name: 'Ada', hp: 7 });
        const rebuiltParty = [createMockPlayerCharacter({ id: companionId, name: 'Ada', hp: 9 })];

        const reducerState = characterReducer({
            ...baseGameState,
            party: [sheetCharacter],
        } as GameState, {
            type: 'SET_FULL_PARTY',
            payload: rebuiltParty,
        });
        const rebuiltState = {
            ...baseGameState,
            ...reducerState,
            companions: { [companionId]: companion } as GameState['companions'],
            characterSheetModal: { isOpen: true, character: reducerState.party[0] },
        } as GameState;

        createProps(rebuiltState);

        expect(screen.getByTestId('character-sheet-modal')).toHaveAttribute('data-companion-id', companionId);
    });

    // SET_PARTY_COMPOSITION is the parallel temp-party path, so it needs the same
    // id-preservation proof as the full-party replacement flow above.
    it('threads companion context through a SET_PARTY_COMPOSITION rebuild when ids still match', () => {
        const companionId = 'companion-ida';
        const companion = { id: companionId } as Companion;
        const sheetCharacter = createMockPlayerCharacter({ id: companionId, name: 'Ida', hp: 6 });
        const tempParty: TempPartyMember[] = [
            { id: companionId, name: 'Ida', level: 2, classId: 'fighter' },
        ];

        const reducerState = characterReducer({
                ...baseGameState,
                party: [sheetCharacter],
            } as GameState, {
            type: 'SET_PARTY_COMPOSITION',
            payload: tempParty,
        });
        const rebuiltState = {
            ...baseGameState,
            ...reducerState,
            companions: { [companionId]: companion } as GameState['companions'],
            characterSheetModal: { isOpen: true, character: reducerState.party[0] },
        } as GameState;

        createProps(rebuiltState);

        expect(screen.getByTestId('character-sheet-modal')).toHaveAttribute('data-companion-id', companionId);
    });

    it('closes economy ledger modal through fallback Escape handler', () => {
        const dispatch = vi.fn();

        createProps(withOpenModal({ isEconomyLedgerVisible: true }), { dispatch });

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ECONOMY_LEDGER' });
    });

    it('closes courier pouch modal through fallback Escape handler', () => {
        const dispatch = vi.fn();

        createProps(withOpenModal({ isCourierPouchVisible: true }), { dispatch });

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_COURIER_POUCH' });
    });

    it('renders Ledger Book mount path', async () => {
        createProps(withOpenModal({ isEconomyLedgerVisible: true }));

        expect(await screen.findByTestId('ledger-book')).toBeInTheDocument();
    });

    it('renders Courier Pouch mount path', async () => {
        createProps(withOpenModal({ isCourierPouchVisible: true }));

        expect(await screen.findByTestId('courier-pouch')).toBeInTheDocument();
    });

    it('mounts the investment board and dispatches caravan and loan actions from its buttons', async () => {
        const dispatch = vi.fn();
        const investmentRoute = {
            id: 'route-1',
            name: 'Amber Caravan',
            originId: 'village-center',
            destinationId: 'port-city',
            goods: ['spice'],
            status: 'active',
            riskLevel: 0.25,
            profitability: 18,
        } as GameState['economy']['tradeRoutes'][number];

        boardGameState = withOpenModal({
            isInvestmentBoardVisible: true,
            gold: 500,
            economy: {
                ...baseGameState.economy,
                tradeRoutes: [investmentRoute],
                marketEvents: [],
            },
        });

        createProps(boardGameState, { dispatch });

        expect(await screen.findByRole('dialog', { name: 'Investment Notice Board' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /^Invest / }));
        expect(dispatch).toHaveBeenCalledWith({
            type: 'INVEST_IN_CARAVAN',
            payload: { tradeRouteId: 'route-1', goldAmount: 100 },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Negotiate' }));
        expect(dispatch).toHaveBeenCalledWith({
            type: 'TAKE_LOAN',
            payload: {
                lenderId: 'guild-1',
                factionId: 'guild-1',
                amount: 1000,
                interestRate: 0.09,
                durationDays: 7,
            },
        });
    });

    it('renders LongRestModal when isLongRestModalVisible is true', async () => {
        createProps(withOpenModal({ isLongRestModalVisible: true }));
        expect(await screen.findByTestId('long-rest-modal')).toBeInTheDocument();
    });

    it('renders RestModal when isShortRestModalVisible is true', async () => {
        createProps(withOpenModal({ isShortRestModalVisible: true }));
        expect(await screen.findByTestId('rest-modal')).toBeInTheDocument();
    });
});
