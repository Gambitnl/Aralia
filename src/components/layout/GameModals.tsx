/**
 * @file GameModals.tsx
 * @description
 * This component functions as a "Modal Manager" for the application.
 * It is responsible for the conditional rendering of all full-screen modals, overlays, and dialogs.
 * 
 * By separating this logic from `App.tsx`, we declutter the main render function and centralize
 * the logic for what overlays are active on top of the main game view.
 */
import React, { lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { GameState, Action, Location, NPC, Item, PlayerCharacter, MissingChoice, MapTile } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { NPCS } from '../../constants';
import { canUseDevTools } from '../../utils/permissions';
import { LoadingSpinner } from '../ui/LoadingSpinner';
// TODO(lint-intent): 'GeminiService' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import * as _GeminiService from '../../services/geminiService';
import { useDialogueSystem } from '../../hooks/useDialogueSystem';

import ErrorBoundary from '../ErrorBoundary';

// Lazy load heavy/conditional components to improve initial bundle size
const MapPane = lazy(() => import('../MapPane'));
const QuestLog = lazy(() => import('../QuestLog'));
const SubmapPane = lazy(() => import('../Submap/SubmapPane'));
const CharacterSheetModal = lazy(() => import('../CharacterSheet/CharacterSheetModal'));
const DevMenu = lazy(() => import('../debug/DevMenu'));
const PartyOverlay = lazy(() => import('../Party/PartyOverlay'));
const PartyEditorModal = lazy(() => import('../Party/PartyEditorModal'));
const GeminiLogViewer = lazy(() => import('../debug/GeminiLogViewer'));
const NpcInteractionTestModal = lazy(() => import('../NpcInteractionTestModal'));
const DossierPane = lazy(() => import('../DossierPane'));
const DiscoveryLogPane = lazy(() => import('../DiscoveryLogPane'));
// Glossary exports a named component from its index barrel
const Glossary = lazy(() => import('../Glossary').then(module => ({ default: module.Glossary })));
const EncounterModal = lazy(() => import('../EncounterModal'));
const MerchantModal = lazy(() => import('../Trade/MerchantModal'));
const GameGuideModal = lazy(() => import('../GameGuideModal'));
const MissingChoiceModal = lazy(() => import('../MissingChoiceModal'));
const TempleModal = lazy(() => import('../TempleModal'));
// REVIEW: Verify that DialogueInterface is indeed a named export. If it is the default export, this lazy loading pattern .then(module => ({ default: module.DialogueInterface })) will fail. (Consistency check with Glossary import at line 35).
const DialogueInterface = lazy(() => import('../Dialogue/DialogueInterface').then(module => ({ default: module.DialogueInterface })));
const ThievesGuildInterface = lazy(() => import('../Crime/ThievesGuild/ThievesGuildInterface'));

interface GameModalsProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    onAction: (action: Action) => void;
    onTileClick: (x: number, y: number, tile: MapTile) => void;
    currentLocation: Location;
    npcsInLocation: NPC[];
    itemsInLocation: Item[];
    isUIInteractive: boolean;
    submapPaneDisabled: boolean;
    missingChoiceModal: {
        isOpen: boolean;
        character: PlayerCharacter | null;
        missingChoice: MissingChoice | null;
    };
    onCloseMissingChoice: () => void;
    onConfirmMissingChoice: (choiceId: string, extraData?: unknown) => void;
    onFixMissingChoice: (character: PlayerCharacter, missing: MissingChoice) => void;
    handleCloseCharacterSheet: () => void;
    handleClosePartyOverlay: () => void;
    handleDevMenuAction: (action: string) => void;
    handleModelChange: (model: string | null) => void;
    handleNavigateToGlossaryFromTooltip: (termId: string) => void;
    handleOpenGlossary: (initialTermId?: string) => void;
    handleOpenCharacterSheet: (character: PlayerCharacter) => void;
}

const GameModals: React.FC<GameModalsProps> = ({
    gameState,
    dispatch,
    onAction,
    onTileClick,
    currentLocation,
    npcsInLocation,
    itemsInLocation,
    // TODO(lint-intent): 'isUIInteractive' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    isUIInteractive: _isUIInteractive,
    submapPaneDisabled,
    missingChoiceModal,
    onCloseMissingChoice,
    onConfirmMissingChoice,
    onFixMissingChoice,
    handleCloseCharacterSheet,
    handleClosePartyOverlay,
    handleDevMenuAction,
    handleModelChange,
    handleNavigateToGlossaryFromTooltip,
    handleOpenGlossary,
    handleOpenCharacterSheet,
}) => {

    const { generateResponse, handleTopicOutcome } = useDialogueSystem(gameState, dispatch);

    return (
        <AnimatePresence>
            {/* World Map Overlay */}
            {gameState.isMapVisible && gameState.mapData && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying the World Map.">
                        <MapPane
                            mapData={gameState.mapData}
                            onTileClick={onTileClick}
                            onClose={() => onAction({ type: 'toggle_map', label: 'Close Map' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Quest Log Overlay */}
            {gameState.isQuestLogVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Quest Log.">
                        <QuestLog
                            isOpen={gameState.isQuestLogVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_QUEST_LOG' })}
                            quests={gameState.questLog}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Submap / Tactical View Overlay */}
            {gameState.isSubmapVisible && gameState.party[0] && gameState.mapData && gameState.subMapCoordinates && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying the Submap.">
                        <SubmapPane
                            currentLocation={currentLocation}
                            currentWorldBiomeId={currentLocation.biomeId}
                            playerSubmapCoords={gameState.subMapCoordinates}
                            onClose={() => onAction({ type: 'toggle_submap_visibility', label: 'Close Submap' })}
                            submapDimensions={SUBMAP_DIMENSIONS}
                            parentWorldMapCoords={currentLocation.mapCoordinates || { x: 0, y: 0 }}
                            onAction={onAction}
                            disabled={submapPaneDisabled}
                            inspectedTileDescriptions={gameState.inspectedTileDescriptions}
                            mapData={gameState.mapData}
                            gameTime={gameState.gameTime}
                            playerCharacter={gameState.party[0]}
                            worldSeed={gameState.worldSeed}
                            npcsInLocation={npcsInLocation}
                            itemsInLocation={itemsInLocation}
                            geminiGeneratedActions={gameState.geminiGeneratedActions}
                            isDevDummyActive={canUseDevTools()}
                            unreadDiscoveryCount={gameState.unreadDiscoveryCount}
                            hasNewRateLimitError={gameState.hasNewRateLimitError}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Character Sheet Modal */}
            {gameState.characterSheetModal.isOpen && gameState.characterSheetModal.character && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying Character Sheet.">
                        <CharacterSheetModal
                            isOpen={gameState.characterSheetModal.isOpen}
                            character={gameState.characterSheetModal.character}
                            inventory={gameState.inventory}
                            gold={gameState.gold}
                            onClose={handleCloseCharacterSheet}
                            onAction={onAction}
                            onNavigateToGlossary={handleNavigateToGlossaryFromTooltip}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Developer Tools Menu */}
            {gameState.isDevMenuVisible && canUseDevTools() && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Developer Menu.">
                        <DevMenu
                            isOpen={gameState.isDevMenuVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_DEV_MENU' })}
                            onDevAction={handleDevMenuAction}
                            hasNewRateLimitError={gameState.hasNewRateLimitError}
                            currentModelOverride={gameState.devModelOverride}
                            onModelChange={handleModelChange}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Party Overview Overlay */}
            {gameState.isPartyOverlayVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error displaying Party Overlay.">
                        <PartyOverlay
                            isOpen={gameState.isPartyOverlayVisible}
                            onClose={handleClosePartyOverlay}
                            party={gameState.party}
                            onViewCharacterSheet={handleOpenCharacterSheet}
                            onFixMissingChoice={onFixMissingChoice}
                            companions={gameState.companions}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Party Editor (Dev Tool) */}
            {gameState.isPartyEditorVisible && canUseDevTools() && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Party Editor.">
                        <PartyEditorModal
                            isOpen={gameState.isPartyEditorVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_PARTY_EDITOR_MODAL' })}
                            initialParty={gameState.party}
                            onSave={(newParty) => dispatch({ type: 'SET_PARTY_COMPOSITION', payload: newParty })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* AI Log Viewer (Dev Tool) */}
            {gameState.isGeminiLogViewerVisible && canUseDevTools() && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Gemini Log Viewer.">
                        <GeminiLogViewer
                            isOpen={gameState.isGeminiLogViewerVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_GEMINI_LOG_VIEWER' })}
                            logEntries={gameState.geminiInteractionLog}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* NPC AI Test Modal (Dev Tool) */}
            {gameState.isNpcTestModalVisible && canUseDevTools() && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in NPC Test Plan Modal.">
                        <NpcInteractionTestModal
                            isOpen={gameState.isNpcTestModalVisible}
                            onClose={() => dispatch({ type: 'TOGGLE_NPC_TEST_MODAL' })}
                            onAction={onAction}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Character Logbook (Journal) */}
            {gameState.isLogbookVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Character Logbook.">
                        <DossierPane
                            isOpen={gameState.isLogbookVisible}
                            onClose={() => onAction({ type: 'TOGGLE_LOGBOOK', label: 'Close Logbook' })}
                            metNpcIds={gameState.metNpcIds}
                            npcMemory={gameState.npcMemory}
                            allNpcs={NPCS}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Discovery Log (Exploration Journal) */}
            {gameState.isDiscoveryLogVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Discovery Journal.">
                        <DiscoveryLogPane
                            isOpen={gameState.isDiscoveryLogVisible}
                            entries={gameState.discoveryLog}
                            unreadCount={gameState.unreadDiscoveryCount}
                            onClose={() => dispatch({ type: 'TOGGLE_DISCOVERY_LOG_VISIBILITY' })}
                            onMarkRead={(entryId) => dispatch({ type: 'MARK_DISCOVERY_READ', payload: { entryId } })}
                            onMarkAllRead={() => dispatch({ type: 'MARK_ALL_DISCOVERIES_READ' })}
                            npcMemory={gameState.npcMemory}
                            allNpcs={NPCS}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Glossary (Compendium) */}
            {gameState.isGlossaryVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Glossary.">
                        <Glossary
                            isOpen={gameState.isGlossaryVisible}
                            onClose={handleOpenGlossary}
                            initialTermId={gameState.selectedGlossaryTermForModal}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Combat Encounter Generation Modal */}
            {gameState.isEncounterModalVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Encounter Modal.">
                        <EncounterModal
                            isOpen={gameState.isEncounterModalVisible}
                            onClose={() => dispatch({ type: 'HIDE_ENCOUNTER_MODAL' })}
                            encounter={gameState.generatedEncounter}
                            sources={gameState.encounterSources}
                            error={gameState.encounterError}
                            isLoading={gameState.isLoading}
                            onAction={onAction}
                            partyUsed={gameState.tempParty || undefined}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Merchant / Trading Interface */}
            {gameState.merchantModal.isOpen && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Merchant Interface.">
                        <MerchantModal
                            isOpen={gameState.merchantModal.isOpen}
                            merchantName={gameState.merchantModal.merchantName}
                            merchantInventory={gameState.merchantModal.merchantInventory}
                            playerInventory={gameState.inventory}
                            playerGold={gameState.gold}
                            onClose={() => dispatch({ type: 'CLOSE_MERCHANT' })}
                            onAction={onAction}
                            regionId={currentLocation.regionId}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Temple / Religion Interface */}
            {gameState.templeModal?.isOpen && gameState.templeModal.temple && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Temple Interface.">
                        <TempleModal
                            isOpen={gameState.templeModal.isOpen}
                            temple={gameState.templeModal.temple}
                            playerGold={gameState.gold}
                            onClose={() => dispatch({ type: 'CLOSE_TEMPLE' })}
                            onAction={onAction}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Game Guide (AI Assistant) Modal */}
            {gameState.isGameGuideVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Game Guide.">
                        <GameGuideModal
                            isOpen={gameState.isGameGuideVisible}
                            onClose={() => onAction({ type: 'TOGGLE_GAME_GUIDE', label: 'Close Game Guide' })}
                            gameContext={`Current Location: ${currentLocation.name}. Game Time: ${gameState.gameTime.toLocaleString()}.`}
                            devModelOverride={gameState.devModelOverride}
                            onAction={dispatch}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Missing Choice Modal (Level Up / Character Options) */}
            {missingChoiceModal.isOpen && missingChoiceModal.character && missingChoiceModal.missingChoice && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Selection Modal.">
                        <MissingChoiceModal
                            isOpen={missingChoiceModal.isOpen}
                            characterName={missingChoiceModal.character.name}
                            missingChoice={missingChoiceModal.missingChoice}
                            onClose={onCloseMissingChoice}
                            onConfirm={onConfirmMissingChoice}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Dialogue Interface (Conversation) */}
            {gameState.isDialogueInterfaceOpen && gameState.activeDialogueSession && gameState.party[0] && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Conversation.">
                        <DialogueInterface
                            isOpen={gameState.isDialogueInterfaceOpen}
                            session={gameState.activeDialogueSession}
                            gameState={gameState}
                            npc={NPCS[gameState.activeDialogueSession.npcId]}
                            playerCharacter={gameState.party[0]}
                            onClose={() => dispatch({ type: 'END_DIALOGUE_SESSION' })}
                            onUpdateSession={(newSession) => dispatch({ type: 'UPDATE_DIALOGUE_SESSION', payload: { session: newSession } })}
                            // TODO: Verify if DialogueInterface relies on this callback. If state updates are required during dialogue (e.g. relationship changes), this empty implementation needs to be connected to the dispatch function.
                            
                            /* TODO(lint-intent): 'updates' is an unused parameter, which suggests a planned input for this flow.
                            TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
                            TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
                            */
                            
                            onUpdateGameState={(_updates) => { /* TODO: Implement partial updates if needed */ }}
                            onTopicOutcome={handleTopicOutcome}
                            onGenerateResponse={generateResponse}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}

            {/* Thieves Guild Interface */}
            {gameState.isThievesGuildVisible && (
                <Suspense fallback={<LoadingSpinner />}>
                    <ErrorBoundary fallbackMessage="Error in Thieves Guild Interface.">
                        <ThievesGuildInterface
                            onClose={() => dispatch({ type: 'TOGGLE_THIEVES_GUILD' })}
                        />
                    </ErrorBoundary>
                </Suspense>
            )}
        </AnimatePresence>
    );
};

export default GameModals;
