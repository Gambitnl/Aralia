/** Registers companion commentary, opt-in paused banter, town announcements, gossip and the local-model check in their existing order. The global shell receives controls without owning another conversation state. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:42:47
 * Dependents: App.tsx, components/layout/AppShell.tsx
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, type Dispatch } from "react";
import type { GameState } from "../../types/state";
import type { AppAction } from "../../state/actionTypes";
import { useCompanionCommentary } from "../useCompanionCommentary";
import { useCompanionBanter } from "../useCompanionBanter";
import { useTownCrierAnnouncements } from "../useTownCrierAnnouncements";
import { useOverheardGossip } from "../useOverheardGossip";
import { useOllamaCheck } from "../useOllamaCheck";

export function useAppAmbientDialogue(gameState: GameState, dispatch: Dispatch<AppAction>) {
  // 💕 Heartkeeper: Companion Commentary (Reactions 2.0)
  useCompanionCommentary(gameState, dispatch);
  // Companion Banter — starts PAUSED: auto-generation is opt-in, toggled via the
  // "Active/Paused" control in the Banter & AI Inspector (gated in useCompanionBanter).
  const [isBanterPaused, setIsBanterPaused] = useState(true);
  const {
    forceBanter,
    isBanterActive,
    isWaitingForNextLine,
    isGenerating,
    generatingSpeakerName,
    secondsUntilNextLine,
    playerInterrupt,
    endBanter,
    banterHistory,
    isPlayerDirected,
    isWaitingForPlayerResponse,
    playerResponseDeadlineSeconds,
    extendPlayerResponseDeadline,
    extendNpcLineDelay,
  } = useCompanionBanter(gameState, dispatch, isBanterPaused);
  // Town Crier — periodic proclamation of the current town's recent headline.
  useTownCrierAnnouncements(gameState, dispatch);
  // Overheard public gossip — periodic light chatter about the current town's recent minor happenings.
  useOverheardGossip(gameState, dispatch);
  // Ollama Dependency Check
  // Keep the check side-effect active; UI wiring can consume this state later.
  const {
    ollamaWarningDismissed: _ollamaWarningDismissed,
    setOllamaWarningDismissed,
  } = useOllamaCheck(dispatch);

  return { forceBanter, isBanterActive, isWaitingForNextLine, isGenerating, generatingSpeakerName, secondsUntilNextLine, playerInterrupt, endBanter, banterHistory, isPlayerDirected, isWaitingForPlayerResponse, playerResponseDeadlineSeconds, extendPlayerResponseDeadline, extendNpcLineDelay, isBanterPaused, setIsBanterPaused, setOllamaWarningDismissed };
}
