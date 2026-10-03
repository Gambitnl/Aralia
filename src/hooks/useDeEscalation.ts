// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 03:21:08
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 1 file
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/useDeEscalation.ts
 * Binds the visible dice tray to a single skill check.
 *
 * This hook used to also own `runDeEscalationFlow`, the hostile-opening
 * resolution. That flow now lives in `systems/intent/runIntentFlow`, which
 * handles EVERY conversation rather than only a standoff, and it keeps the
 * hostile rules intact (authored DC, any failure drops into the fight, the
 * threat clears on every terminal route). Combat launching moved with it, to
 * `systems/intent/startThreatCombat`. What remains here is the part that must
 * touch React: rolling real dice on the visible tray.
 */
import { useCallback } from 'react';
import { useDice } from '../contexts/DiceContext';
import type { CheckDiceRequest, CheckDiceResult } from '../systems/intent/runIntentFlow';

export type { CheckDiceRequest, CheckDiceResult };

export function useDeEscalation() {
  const { visualRoll, hideOverlay } = useDice();
  const rollCheckDice = useCallback(async (
    advantage: boolean,
    bonusDice: CheckDiceRequest[],
  ): Promise<CheckDiceResult> => {
    try {
      // Roll two d20s and take the better face on advantage.
      const a = await visualRoll('1d20');
      let d20 = a.rolls[0]?.value ?? a.total;
      if (advantage) {
        const b = await visualRoll('1d20');
        d20 = Math.max(d20, b.rolls[0]?.value ?? b.total);
      }
      // Then each active bonus die (Guidance's 1d4 …), sequentially — the dice
      // service rolls one at a time.
      const bonuses: CheckDiceResult['bonuses'] = [];
      for (const req of bonusDice) {
        const r = await visualRoll(req.notation);
        bonuses.push({ source: req.source, value: r.total });
      }
      return { d20, bonuses };
    } finally {
      // Hide only after the WHOLE sequence: dismissing between rolls unmounts
      // the dice canvas and a roll on a dead canvas never settles. The delay
      // gives the player a beat to read the final face.
      window.setTimeout(() => hideOverlay(), 1500);
    }
  }, [visualRoll, hideOverlay]);
  return { rollCheckDice };
}
