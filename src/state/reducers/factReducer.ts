// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:55:07
 * Dependents: state/appState.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/factReducer.ts
 * Slice reducer for the durable, world-level fact store (DIAL-002 + DIAL-004).
 *
 * Facts are world knowledge the PLAYER has durably learned (e.g. an NPC told
 * you something that unlocks topics with other NPCs). They are global, survive
 * save/reload (the store serializes with GameState), and are healed on the fly
 * for saves created before the store existed.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import {
  hasWorldFact,
  learnWorldFact,
  normalizeWorldFactStore,
} from '../../systems/facts/worldFactStore';
import {
  findTownSituationOutcome,
  townSituationKey,
} from '../../systems/worldforge/townsim/townSituation';
import {
  clearUnlockFlag,
  setUnlockFlag,
  unlockFlagKey,
} from '../../systems/dialogue/unlockRegistry';

export function factReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'LEARN_WORLD_FACT': {
      const { fact } = action.payload;
      // A fact is learned once — first provenance wins, re-learning is a no-op.
      if (hasWorldFact(state.worldFacts, fact.key)) return {};
      // Heal-on-write: legacy saves have no store; malformed ones are dropped.
      const store = normalizeWorldFactStore(state.worldFacts);
      return { worldFacts: learnWorldFact(store, fact) };
    }

    // ------------------------------------------------------------------
    // Unlock-flag registry (DIAL-004).
    //
    // Flags are facts under the reserved `unlock:` namespace in the SAME
    // `worldFacts` store, so they persist through saves with zero new state
    // and zero migration. `setUnlockFlag` is heal-on-write like the case
    // above, and returns the same reference on a true no-op so a repeated
    // dialogue effect does not churn state.
    // ------------------------------------------------------------------
    case 'SET_UNLOCK_FLAG': {
      const { flag, ...options } = action.payload;
      if (!flag) return {};
      const next = setUnlockFlag(state.worldFacts, flag, {
        // Default the unlock moment to game time, not wall clock, so a flag's
        // timestamp lines up with everything else recorded in the save.
        setAt: state.gameTime?.getTime?.() ?? Date.now(),
        ...options,
      });
      return next === state.worldFacts ? {} : { worldFacts: next };
    }

    case 'CLEAR_UNLOCK_FLAG': {
      const { flag } = action.payload;
      // Nothing set means nothing to do; avoids allocating a new store (and a
      // re-render) for a clear of a flag that was never granted.
      if (!flag || !hasWorldFact(state.worldFacts, unlockFlagKey(flag))) return {};
      return { worldFacts: clearUnlockFlag(state.worldFacts, flag) };
    }

    case 'RESOLVE_TOWN_SITUATION': {
      // worldReducer runs before this reducer in the root pipeline. Only learn
      // the player's action if the canonical town receipt is now present and
      // matches the requested choice; rejected or forged actions learn nothing.
      const key = townSituationKey(action.payload.burgId, action.payload.sourceEventId);
      if (hasWorldFact(state.worldFacts, key)) return {};
      const town = state.townSim?.[action.payload.burgId];
      const outcome = town ? findTownSituationOutcome(town, key) : undefined;
      if (outcome?.provenance?.resolutionId !== action.payload.resolutionId) return {};

      const store = normalizeWorldFactStore(state.worldFacts);
      return {
        worldFacts: learnWorldFact(store, {
          key,
          value: action.payload.resolutionId,
          scope: 'region',
          regionId: `burg:${action.payload.burgId}`,
          learnedAt: state.gameTime.getTime(),
        }),
      };
    }

    default:
      return {};
  }
}
