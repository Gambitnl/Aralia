/** Exposes the existing dev-only journey summary and dispatch handle for browser proof. No state or permission gates change when App calls this hook. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: App.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, type Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { GamePhase } from "../../types";
import { canUseDevTools } from "../../utils/core";

export function useAppDeveloperProbe(gameState: GameState, dispatch: Dispatch<AppAction>) {
  // Dev-only read-only state probe for the resume-journey audit rig: lets the
  // headless harness compare the live state against the saved payload without
  // reaching into React internals. Summary fields only — never mutate.
  useEffect(() => {
    if (typeof window === "undefined" || !canUseDevTools()) return;
    (window as unknown as { __araliaState?: unknown }).__araliaState = {
      phase: GamePhase[gameState.phase],
      worldViewMode: gameState.worldViewMode ?? null,
      currentLocationId: gameState.currentLocationId,
      playerWorldPos: gameState.playerWorldPos ?? null,
      // Keep the chosen starting settlement visible to browser proof tests so
      // the post-creator flow can prove the selected village became live game
      // state, not just that play started somewhere.
      startTownName: gameState.startTownName ?? null,
      startTownRegion: gameState.startTownRegion ?? null,
      partySize: gameState.party.length,
      partyNames: gameState.party.map((p) => p.name),
      // PRV9 verification surface: HP + active conditions per member, so the
      // starvation drain / long-rest recovery can be proven headlessly.
      partyVitals: gameState.party.map((p) => ({
        name: p.name,
        hp: p.hp,
        maxHp: p.maxHp,
        conditions: p.conditions ?? [],
      })),
      gold: gameState.gold,
      inventoryCount: gameState.inventory.length,
      gameTime:
        gameState.gameTime instanceof Date
          ? gameState.gameTime.toISOString()
          : String(gameState.gameTime),
      isMapVisible: gameState.isMapVisible,
      // World identity, so a browser rig can pick a real burg cell to travel to
      // and prove town-merchant registration on arrival.
      worldSeed: gameState.worldSeed,
      playerCellId: gameState.playerCell?.cellId ?? null,
      // Cell-native discovery proof: expose only durable numeric cell flags,
      // never the full journal text, so browser rigs can verify dedupe/reload.
      exploredCellIds: gameState.discoveryLog.flatMap((entry) =>
        entry.flags
          .filter(
            (flag) => flag.key === "cellId" && typeof flag.value === "number",
          )
          .map((flag) => flag.value as number),
      ),
      discoveryCount: gameState.discoveryLog.length,
      unreadDiscoveryCount: gameState.unreadDiscoveryCount ?? 0,
      // Interactive-3D locomotion proof: the live ground-move state a click-to-walk
      // (or camera walk) writes, so a rig can confirm a 3D ground click moved the player.
      playerGroundPos: gameState.playerGroundPos ?? null,
      // Interactive-NPC proof surface: lets a browser rig confirm that clicking
      // "Talk to <npc>" actually opened a dialogue session with that NPC, not
      // just that the action button existed.
      isDialogueInterfaceOpen: gameState.isDialogueInterfaceOpen ?? false,
      activeDialogueNpcId: gameState.activeDialogueSession?.npcId ?? null,
      activeConversationIds: gameState.activeConversation?.participants ?? null,
      isLongRestModalVisible: gameState.isLongRestModalVisible ?? false,
      isThreeDVisible: gameState.isThreeDVisible ?? false,
      saveTimestamp: gameState.saveTimestamp ?? null,
      error: gameState.error ?? null,
      isLoading: gameState.isLoading,
    };
    // Dev-only action dispatch handle, for headless visual-verification rigs to
    // set up scenarios (e.g. add provisions before screenshotting the travel
    // map). Dev-gated; absent in production builds.
    (window as unknown as { __araliaDispatch?: unknown }).__araliaDispatch =
      dispatch;
  }, [gameState, dispatch]);

}
