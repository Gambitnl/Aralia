/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useTownCrierAnnouncements.ts
 * Ambient hook: while the player stands in a tracked living-world town, a town
 * crier periodically proclaims the town's most recent HEADLINE into the message
 * log.
 *
 * Mirrors the ambient pattern in useCompanionBanter:
 *  - reads live state through a ref to avoid stale closures,
 *  - schedules periodic work on a self-cleaning interval,
 *  - appends a line via the same ADD_MESSAGE dispatch (sender 'npc', a banter-
 *    typed metadata entry) so it surfaces alongside other ambient lines.
 *
 * Saved message provenance remembers which real reports were heard, including
 * after reload. Historical news carries its source age; the chronicle is never
 * rewritten to manufacture fresh events. Selection remains deterministic.
 *
 * Called by: App.tsx
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 22:01:54
 * Dependents: hooks/app/useAppAmbientDialogue.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useRef } from 'react';
import { GameState, GamePhase } from '../types';
import { AppAction } from '../state/actionTypes';
import { getGameDay } from '../utils/core';
import { resolveTownForLocation } from '../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews, townNewsContext } from '../systems/worldforge/townsim/townNews';
import { getBridgeAtlas } from '../systems/worldforge/bridge/legacySubmapBridge';
import { getCanonicalTownPersonality } from '../systems/worldforge/town/canonicalTown';
import type { TownLayoutRevision } from '../systems/worldforge/town/townLayoutRevision';

// ============================================================================
// Constants
// ============================================================================

/** How often the crier checks whether there's a fresh headline to proclaim. */
const CRIER_INTERVAL_MS = 105_000; // ~90–120s real time

/**
 * The town's own STANDING business, cried when the chronicle has no headline.
 *
 * Each settlement resolves to an authored {@link VillageIntegrationProfile} whose
 * `encounterHooks` are the errands and worries that define the place — a herder
 * losing reindeer to a tundra storm, a smith after star-iron on a volcanic field.
 * Until this wiring those hooks had one caller, the retired 2D village generator,
 * so no player ever heard one (deepdive village-generator-vs-worldforge-town.md
 * finding 7). The hook is picked by GAME DAY, not at random, so the crier shares
 * today's business once and moves on tomorrow — and two players on the same
 * seed hear the same town say the same thing.
 */
function pickTownHookForDay(worldSeed: number, burgId: number, gameDay: number, layoutRevision: TownLayoutRevision): string | null {
  const { profile } = getCanonicalTownPersonality(getBridgeAtlas(worldSeed), worldSeed, burgId, layoutRevision);
  const hooks = profile.encounterHooks;
  if (hooks.length === 0) return null;
  // Non-negative modulo: game day can be 0 but never negative in practice, and a
  // negative index here would silently hand back undefined.
  return hooks[((gameDay % hooks.length) + hooks.length) % hooks.length];
}

// A report belongs to one world, settlement and unchanged chronicle entry.
// Standing business keeps its authored wording and is heard once per game day.
type CrierSource = {worldSeed:number;burgId:number} & (
  | {kind:'headline';eventId:number;sourceDay:number;eventKind:string;summary:string}
  | {kind:'standing-business';gameDay:number;summary:string}
);

function crierSourceKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const source=value as Record<string,unknown>;
  if (!Number.isSafeInteger(source.worldSeed) || !Number.isInteger(source.burgId)
    || Number(source.burgId)<=0 || typeof source.summary!=='string') return null;
  if (source.kind==='headline' && Number.isInteger(source.eventId)
    && Number.isInteger(source.sourceDay) && typeof source.eventKind==='string') {
    return JSON.stringify([source.worldSeed,source.burgId,source.kind,source.eventId,source.sourceDay,source.eventKind,source.summary]);
  }
  if (source.kind==='standing-business' && Number.isInteger(source.gameDay)) {
    return JSON.stringify([source.worldSeed,source.burgId,source.kind,source.gameDay,source.summary]);
  }
  return null;
}

// ============================================================================
// Hook
// ============================================================================

export const useTownCrierAnnouncements = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
) => {
  // Live state mirror so the interval callback never reads a stale closure.
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Avoid duplicate dispatches before React commits the appended log message.
  // A different history (including a loaded older save) clears this temporary
  // buffer; only that save's actual source-bearing messages retain knowledge.
  const pendingRef=useRef<{messages:GameState['messages'];keys:Set<string>}>(
    {messages:gameState.messages,keys:new Set()},
  );

  useEffect(() => {
    const proclaim = () => {
      const state = gameStateRef.current;
      if (state.phase !== GamePhase.PLAYING || !(state.gameTime instanceof Date)
        || !Number.isFinite(state.gameTime.getTime()) || !Number.isSafeInteger(state.worldSeed)) return;

      const town = resolveTownForLocation({
        // GRID-RETIRE: BA-2 — prefer the canonical cell.
        cellId: state.playerCell?.cellId ?? null,
        ground: state,
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        townSim: state.townSim,
        gameTime: state.gameTime,
      });
      if (!town || town.chronicle.burgId !== town.burgId) return;

      const gameDay = getGameDay(state.gameTime);
      if (pendingRef.current.messages!==state.messages) pendingRef.current={messages:state.messages,keys:new Set()};
      const heard=new Set((state.messages??[]).flatMap(message=>{
        const key=message.sender==='npc' ? crierSourceKey(message.metadata?.townCrier) : null;
        return key ? [key] : [];
      }));
      const wasHeard=(source:CrierSource)=>{
        const key=crierSourceKey(source)!;
        return heard.has(key)||pendingRef.current.keys.has(key);
      };
      const sourceFor=(item:ReturnType<typeof selectTownNews>[number]):CrierSource=>({
        worldSeed:state.worldSeed,burgId:town.burgId,kind:'headline',eventId:item.id,
        sourceDay:item.day,eventKind:item.kind,summary:item.text,
      });
      // Old unscoped prose cannot identify an event. Keep it unchanged and date
      // the first newly heard, source-backed report rather than backfilling it.
      const item=selectTownNews(town,gameDay,{minProminence:'headline'}).find(candidate=>
        town.chronicle.events.filter(event=>event.id===candidate.id).length===1 && !wasHeard(sourceFor(candidate)));
      let text:string;
      let source:CrierSource;
      if (item) {
        source=sourceFor(item);
        const age=townNewsContext(town,item,gameDay).ageLabel;
        const heading=age==='Today' ? "A town crier proclaims today's news"
          : age==='Yesterday' ? "A town crier recounts yesterday's news"
          : 'A town crier recounts town history ('+age+')';
        text=heading+': "'+item.text+'"';
      } else {
        // Recorded headlines remain available above. Standing business depends
        // on the town profile, so wait for source admission rather than crying
        // an errand from another layout into an established town's memory.
        if (town.layoutRevision===undefined) return;
        const hook=pickTownHookForDay(state.worldSeed,town.burgId,gameDay,town.layoutRevision);
        if (!hook) return;
        source={worldSeed:state.worldSeed,burgId:town.burgId,kind:'standing-business',gameDay,summary:hook};
        if (wasHeard(source)) return;
        text=`A town crier calls out the day's business: "${hook}"`;
      }
      pendingRef.current.keys.add(crierSourceKey(source)!);

      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now() + Math.random(), // collision-resistant key (matches App.tsx addMessage)
          text,
          sender: 'npc',
          timestamp: new Date(),
          metadata: { type: 'banter', townCrier: source },
        },
      });
    };

    const interval = setInterval(proclaim, CRIER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch]);
};
