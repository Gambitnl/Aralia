/**
 * Escape-key modal close audit (UI-2 / agora-a95f.2).
 *
 * WHAT THIS PROVES. `useModalOrchestration` is the single registry that decides
 * which overlays Escape can dismiss (`src/hooks/useModalOrchestration.ts`), and
 * `GameModals.tsx` builds that registry. An overlay that is rendered but absent
 * from `modalEntries` — or present with only a scroll-lock entry while its child
 * binds nothing — traps the player with no keyboard way out, and nothing failed.
 *
 * The 2026-09-09 audit found eleven such overlays. `economyModalRouting.test.tsx`
 * (agora-52f1) already covers the three economy modals; this file covers the rest,
 * one case per newly Escape-closeable modal, driven through the REAL `appReducer`
 * so a toggle case that only ever sets `true` would fail here too.
 *
 * IT ALSO GUARDS THE OTHER DIRECTION. Overlays that bind Escape themselves
 * (ModalDialog's focus trap, DossierPane, DiscoveryLogPane, DevMenu) must NOT
 * also be in the fallback chain, or one key press dismisses two overlays. The
 * fallback used to run in the capture phase, which made its own
 * `event.defaultPrevented` guard unreachable; the last cases here pin the
 * bubble-phase behavior that makes deferral work.
 *
 * Modals deliberately NOT Escape-closeable are asserted as such, so the decision
 * is a test rather than a comment: Heist Planning's only close action is
 * ABORT_HEIST, which discards the planned job.
 */

import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import { appReducer } from '../../../state/appState';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState, Location } from '../../../types';
import type { ComponentType } from 'react';

let currentState: GameState;
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

// The dev-tool overlays are part of the audit, so the gate has to be open.
vi.mock('../../../utils/core/permissions', () => ({
    canUseDevTools: () => true,
}));

vi.mock('../../ui/LoadingSpinner', () => ({
    LoadingSpinner: () => <div>Loading...</div>,
}));

vi.mock('../../MapPane', () => ({ default: () => <div data-testid="map-pane" /> }));

/**
 * The audited overlays are stubbed down to a labelled dialog with a close
 * button. What is under test is the SHARED registry in GameModals, not each
 * overlay's body: the fallback `close` lives in `modalEntries`, so a stub proves
 * the wiring exactly as well as the real component while keeping the case
 * independent of every overlay's own data requirements (a guild membership, an
 * active ship, a dialogue graph fetch).
 *
 * `LongRestModal` is deliberately NOT stubbed — that case exists to prove the
 * fallback defers to a child that handles Escape itself, which only its real
 * ModalDialog focus trap can demonstrate.
 */
const stubModal = (label: string) => ({ onClose }: { onClose?: () => void }) => (
    <div role="dialog" aria-label={label}>
        <button type="button" aria-label="Close" onClick={() => onClose?.()}>x</button>
    </div>
);

vi.mock('../../CharacterSheet/CharacterSheetModal', () => ({ default: stubModal('Character Sheet') }));
vi.mock('../../Party/PartyOverlay', () => ({ default: stubModal('Party Overlay') }));
vi.mock('../../Dialogue/DialogueInterface', () => ({ DialogueInterface: stubModal('Conversation') }));
vi.mock('../../Crime/ThievesGuild/ThievesGuildInterface', () => ({ default: stubModal('Thieves Guild') }));
vi.mock('../../Crime/ThievesGuild/ThievesGuildSafehouse', () => ({ ThievesGuildSafehouse: stubModal('Shadow Hands Safehouse') }));
vi.mock('../../Crime/ThievesGuild/HeistPlanningModal', () => ({ HeistPlanningModal: stubModal('Heist Planning') }));
vi.mock('../../Naval/ShipPane', () => ({ ShipPane: stubModal("Captain's Dashboard") }));
vi.mock('../../Party/PartyEditorModal', () => ({ default: stubModal('Party Editor') }));
vi.mock('../../debug/GeminiLogViewer', () => ({ default: stubModal('AI Log Viewer') }));
vi.mock('../../debug/UnifiedDebugLogViewer', () => ({ UnifiedDebugLogViewer: stubModal('Unified Debug Log') }));
vi.mock('../../debug/NpcInteractionTestModal', () => ({ default: stubModal('NPC Test Plan') }));
vi.mock('../../debug/NobleHouseList', () => ({ default: stubModal('Noble Houses') }));

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

/** Prop-driven close handlers are spied on: they are the modal's real close path. */
let handleCloseCharacterSheet: ReturnType<typeof vi.fn>;
let handleClosePartyOverlay: ReturnType<typeof vi.fn>;

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
    handleCloseCharacterSheet,
    handleClosePartyOverlay,
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

/**
 * Every overlay flag GameModals reads, forced shut, so each case opens exactly
 * one modal and the Escape priority chain cannot be satisfied by a neighbor.
 */
const closedState = (overrides: Partial<GameState> = {}) => createMockGameState({
    // Several overlays only mount with a party member to show (the character
    // sheet needs one, the dialogue interface needs a speaker, both rest
    // dialogs need someone to rest).
    party: [createMockPlayerCharacter({ id: 'hero', name: 'Hero' })],
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
    isDevModeEnabled: false,
    isPartyEditorVisible: false,
    isNobleHouseListVisible: false,
    isCommerceDeskVisible: false,
    isEconomyLedgerVisible: false,
    isCourierPouchVisible: false,
    isInvestmentBoardVisible: false,
    isThievesGuildVisible: false,
    isThievesGuildSafehouseVisible: false,
    isNavalDashboardVisible: false,
    isDialogueInterfaceOpen: false,
    isLongRestModalVisible: false,
    isShortRestModalVisible: false,
    characterSheetModal: { isOpen: false, character: null },
    ...overrides,
} as Partial<GameState>);

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

const pressEscape = () => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

/**
 * Every overlay here is behind `React.lazy`, and the child's own Escape binding
 * (ModalDialog's focus trap) only exists once that chunk has resolved. Two
 * macrotask turns inside `act` are enough for the dynamic import plus the
 * re-render it schedules.
 */
const flushLazy = async () => {
    for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
};

/**
 * Waits for the overlay to actually mount. Where the overlay exposes a dialog
 * name, that presence check IS the wait; the inline naval panel has none, so it
 * falls back to flushing the lazy boundary.
 */
const mountOverlay = async (dialogName?: RegExp) => {
    if (dialogName) {
        await screen.findByRole('dialog', { name: dialogName });
        return;
    }
    await flushLazy();
};

beforeEach(() => {
    vi.clearAllMocks();
    handleCloseCharacterSheet = vi.fn();
    handleClosePartyOverlay = vi.fn();
});

/**
 * Overlays whose close routes through a reducer action. Opening them by setting
 * the flag directly (rather than dispatching the toggle) keeps the case about
 * Escape rather than about the entry point.
 */
type ReducerModalCase = {
    name: string;
    /** State that mounts the overlay. */
    open: Partial<GameState>;
    /** The flag Escape must clear. */
    flag: keyof GameState;
    /** The action the registry must dispatch. */
    action: AppAction;
    /**
     * Accessible name of the mounted dialog. Omitted for the Captain's
     * Dashboard: with no active ship GameModals renders its inline
     * "No Active Ship" panel instead of ShipPane, and that panel is still an
     * overlay Escape has to be able to dismiss.
     */
    dialogName?: RegExp;
};

const guildMembership = {
    memberId: 'player',
    guildId: 'shadow_hands',
    rank: 1,
    reputation: 10,
    activeJobs: [],
    availableJobs: [],
    completedJobs: [],
    servicesUnlocked: [],
};

const reducerCases: ReducerModalCase[] = [
    {
        name: 'Thieves Guild Interface',
        open: { isThievesGuildVisible: true } as Partial<GameState>,
        flag: 'isThievesGuildVisible',
        action: { type: 'TOGGLE_THIEVES_GUILD' } as AppAction,
        dialogName: /Thieves Guild/i,
    },
    {
        name: 'Thieves Guild Safehouse',
        open: {
            isThievesGuildSafehouseVisible: true,
            thievesGuild: guildMembership,
        } as unknown as Partial<GameState>,
        flag: 'isThievesGuildSafehouseVisible',
        action: { type: 'TOGGLE_THIEVES_GUILD_SAFEHOUSE' } as AppAction,
        dialogName: /Shadow Hands Safehouse/i,
    },
    {
        name: "Captain's Dashboard",
        open: { isNavalDashboardVisible: true } as Partial<GameState>,
        flag: 'isNavalDashboardVisible',
        action: { type: 'TOGGLE_NAVAL_DASHBOARD' } as AppAction,
    },
    {
        name: 'Party Editor',
        open: { isPartyEditorVisible: true } as Partial<GameState>,
        flag: 'isPartyEditorVisible',
        action: { type: 'TOGGLE_PARTY_EDITOR_MODAL' } as AppAction,
        dialogName: /Party Editor/i,
    },
    {
        name: 'Noble House List',
        open: { isNobleHouseListVisible: true } as Partial<GameState>,
        flag: 'isNobleHouseListVisible',
        action: { type: 'TOGGLE_NOBLE_HOUSE_LIST' } as AppAction,
        dialogName: /Noble Houses/i,
    },
    {
        name: 'AI Log Viewer',
        open: { isGeminiLogViewerVisible: true } as Partial<GameState>,
        flag: 'isGeminiLogViewerVisible',
        action: { type: 'TOGGLE_GEMINI_LOG_VIEWER' } as AppAction,
        dialogName: /AI Log Viewer/i,
    },
    {
        name: 'Unified Debug Log Viewer',
        open: { isUnifiedLogViewerVisible: true } as Partial<GameState>,
        flag: 'isUnifiedLogViewerVisible',
        action: { type: 'TOGGLE_UNIFIED_LOG_VIEWER' } as AppAction,
        dialogName: /Unified Debug Log/i,
    },
    {
        name: 'NPC Test Modal',
        open: { isNpcTestModalVisible: true } as Partial<GameState>,
        flag: 'isNpcTestModalVisible',
        action: { type: 'TOGGLE_NPC_TEST_MODAL' } as AppAction,
        dialogName: /NPC Test Plan/i,
    },
];

describe('Escape-key modal close audit: reducer-backed overlays', () => {
    it.each(reducerCases)('$name closes on Escape through the shared registry', async ({ open, flag, action, dialogName }) => {
        const { dispatched } = renderWithLiveReducer(closedState(open));

        expect(currentState[flag]).toBe(true);
        // Let the lazy chunk resolve so the overlay is genuinely mounted, not
        // merely flagged, when Escape arrives.
        await mountOverlay(dialogName);

        dispatched.length = 0;
        pressEscape();

        expect(dispatched).toContainEqual(action);
        expect(currentState[flag]).toBe(false);
        if (dialogName) expect(screen.queryByRole('dialog', { name: dialogName })).toBeNull();
    });

    it.each(reducerCases)('$name does not close twice on one Escape', async ({ open, flag, action, dialogName }) => {
        const { dispatched } = renderWithLiveReducer(closedState(open));
        await mountOverlay(dialogName);

        dispatched.length = 0;
        pressEscape();

        // A second dispatch of a toggle action would flip the flag back on and
        // strand the overlay open — the exact failure a child that binds its own
        // Escape produces when it is also listed in the fallback chain.
        expect(dispatched.filter((a) => a.type === action.type)).toHaveLength(1);
        expect(currentState[flag]).toBe(false);
    });
});

describe('Escape-key modal close audit: dialogue', () => {
    it('ends the dialogue session on Escape', async () => {
        const base = closedState();
        const session = {
            npcId: 'old_hermit',
            discussedTopicIds: [],
        };
        const { dispatched } = renderWithLiveReducer({
            ...base,
            isDialogueInterfaceOpen: true,
            activeDialogueSession: session,
        } as unknown as GameState);

        expect(currentState.isDialogueInterfaceOpen).toBe(true);
        await screen.findByRole('dialog', { name: /Conversation/i });

        dispatched.length = 0;
        pressEscape();

        expect(dispatched).toContainEqual({ type: 'END_DIALOGUE_SESSION' });
    });
});

describe('Escape-key modal close audit: prop-driven overlays', () => {
    it('Character Sheet closes on Escape', async () => {
        const base = closedState();
        renderWithLiveReducer({
            ...base,
            characterSheetModal: { isOpen: true, character: base.party[0] },
        } as unknown as GameState);

        await screen.findByRole('dialog', { name: /Character Sheet/i });
        pressEscape();

        expect(handleCloseCharacterSheet).toHaveBeenCalledTimes(1);
    });

    it('Party Overlay closes on Escape', async () => {
        renderWithLiveReducer(closedState({ isPartyOverlayVisible: true } as Partial<GameState>));

        await screen.findByRole('dialog', { name: /Party Overlay/i });
        pressEscape();

        expect(handleClosePartyOverlay).toHaveBeenCalledTimes(1);
    });

    it('closes the Character Sheet first when it sits over the Party Overlay', async () => {
        const base = closedState({ isPartyOverlayVisible: true } as Partial<GameState>);
        renderWithLiveReducer({
            ...base,
            characterSheetModal: { isOpen: true, character: base.party[0] },
        } as unknown as GameState);

        await screen.findByRole('dialog', { name: /Character Sheet/i });
        pressEscape();

        // Registry order is nesting order: Escape peels one layer at a time
        // instead of dismissing the whole stack.
        expect(handleCloseCharacterSheet).toHaveBeenCalledTimes(1);
        expect(handleClosePartyOverlay).not.toHaveBeenCalled();
    });
});

describe('Escape-key modal close audit: overlays that handle Escape themselves', () => {
    it('lets the Long Rest dialog consume Escape instead of closing the Party Overlay under it', async () => {
        const { dispatched } = renderWithLiveReducer(closedState({
            isPartyOverlayVisible: true,
            isLongRestModalVisible: true,
        } as Partial<GameState>));

        await screen.findByRole('dialog', { name: /Long Rest/i });

        dispatched.length = 0;
        pressEscape();

        // LongRestModal closes itself through ModalDialog's focus trap, which
        // calls preventDefault(). The fallback runs in the bubble phase and so
        // actually observes that; in the old capture-phase order it fired first
        // and took the Party Overlay down with the rest dialog.
        expect(dispatched).toContainEqual({ type: 'TOGGLE_LONG_REST_MODAL' });
        expect(currentState.isLongRestModalVisible).toBe(false);
        expect(handleClosePartyOverlay).not.toHaveBeenCalled();
    });

    it('leaves Heist Planning open on Escape so a stray key cannot abort the job', async () => {
        const { dispatched } = renderWithLiveReducer(closedState({
            activeHeist: {
                phase: 'Planning',
                approaches: [],
            },
        } as unknown as Partial<GameState>));

        await screen.findByRole('dialog', { name: /Heist Planning/i });

        dispatched.length = 0;
        pressEscape();

        expect(dispatched).not.toContainEqual({ type: 'ABORT_HEIST' });
    });
});
