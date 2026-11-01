/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/hooks/useOverheardGossip.ts
 * Ambient hook: while the player stands in a tracked living-world town, they
 * periodically OVERHEAR townsfolk gossiping about recent minor happenings
 * (births, courtships, festivals, who came of age, who passed) into the message
 * log.
 *
 * Mirrors the ambient pattern in useTownCrierAnnouncements:
 *  - reads live state through a ref to avoid stale closures,
 *  - schedules periodic work on a self-cleaning interval,
 *  - appends a line via the same ADD_MESSAGE dispatch (sender 'npc', a banter-
 *    typed metadata entry) so it surfaces alongside other ambient lines.
 *
 * This is the gossip-tier sibling of the crier's headline channel; a separate
 * interval keeps the two from always firing on the same tick.
 *
 * Source-bearing saved messages retain the game-time cooldown across reloads.
 * Each report carries its source age, without rewriting older prose or events.
 * All variety comes from recency + a per-source cooldown (each gossip item is
 * overheard at most once per GOSSIP_REPEAT_COOLDOWN_GAME_HOURS of game time;
 * when the whole pool is on cooldown the street goes quiet — silence beats
 * repetition) — no Math.random in the selection.
 *
 * Called by: App.tsx
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:28:48
 * Dependents: hooks/app/useAppAmbientDialogue.ts
 * Imports: 5 files
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
import { pickOverheardGossip, frameOverheardGossip, townNewsContext } from '../systems/worldforge/townsim/townNews';

// ============================================================================
// Constants
// ============================================================================

/** How often the player checks whether there's fresh gossip to overhear. */
const GOSSIP_INTERVAL_MS = 75_000; // offset from the crier so they don't always coincide

/**
 * A given gossip item may be overheard at most once per this many GAME hours.
 * Prevents a tiny gossip pool (e.g. two coming-of-age lines) from alternating
 * endlessly every tick — once everything is on cooldown, nothing is overheard.
 */
export const GOSSIP_REPEAT_COOLDOWN_GAME_HOURS = 6;
const GOSSIP_REPEAT_COOLDOWN_GAME_MS = GOSSIP_REPEAT_COOLDOWN_GAME_HOURS * 60 * 60 * 1000;

// Hearing is tied to one unchanged event in one world and town. Game dates
// can precede the Unix epoch; the saved hearing time is still a finite integer.
type GossipSource={worldSeed:number;burgId:number;eventId:number;sourceDay:number;eventKind:string;summary:string;heardAtGameMs:number};
function gossipSourceKey(value:unknown):string|null {
  if (!value || typeof value!=='object') return null;
  const source=value as Record<string,unknown>;
  if (!Number.isSafeInteger(source.worldSeed) || !Number.isInteger(source.burgId) || Number(source.burgId)<=0
    || !Number.isInteger(source.eventId) || Number(source.eventId)<0 || !Number.isInteger(source.sourceDay)
    || typeof source.eventKind!=='string' || typeof source.summary!=='string' || !Number.isSafeInteger(source.heardAtGameMs)) return null;
  return JSON.stringify([source.worldSeed,source.burgId,source.eventId,source.sourceDay,source.eventKind,source.summary]);
}

// ============================================================================
// Hook
// ============================================================================

export const useOverheardGossip = (
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
) => {
  // Live state mirror so the interval callback never reads a stale closure.
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Bridge the short gap before a dispatched log entry reaches React state.
  // A restored message history clears this buffer; future hearing is not imported.
  const pendingRef=useRef<{messages:GameState['messages'];heard:Map<string,number>}>(
    {messages:gameState.messages,heard:new Map()},
  );

  useEffect(() => {
    const overhear = () => {
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
      if (!town || town.chronicle.burgId!==town.burgId) return;

      const nowGameMs=state.gameTime.getTime(),day=getGameDay(state.gameTime);
      if (pendingRef.current.messages!==state.messages) pendingRef.current={messages:state.messages,heard:new Map()};
      const heardAt=new Map<string,number>();
      const retain=(key:string,at:number)=>{
        // Keep the newest valid hearing. Expired and future-save timestamps
        // cannot silence the present town, and no saved log entries are deleted.
        if (at<=nowGameMs && nowGameMs-at<GOSSIP_REPEAT_COOLDOWN_GAME_MS) heardAt.set(key,Math.max(at,heardAt.get(key)??-Infinity));
      };
      for (const message of state.messages??[]) {
        const source=message.sender==='npc' ? message.metadata?.townGossip : undefined;
        const key=gossipSourceKey(source);
        if (key) retain(key,(source as GossipSource).heardAtGameMs);
      }
      for (const [key,at] of pendingRef.current.heard) {
        if (at>nowGameMs || nowGameMs-at>=GOSSIP_REPEAT_COOLDOWN_GAME_MS) pendingRef.current.heard.delete(key);
        else retain(key,at);
      }
      const sourceFor=(event:{id:number;day:number;kind:string;summary:string}):GossipSource=>({
        worldSeed:state.worldSeed,burgId:town.burgId,eventId:event.id,sourceDay:event.day,
        eventKind:event.kind,summary:event.summary,heardAtGameMs:nowGameMs,
      });
      // Keep the existing picker, its 24-item window, ordering and gossip tier.
      // Translate only the admitted source identities into its town-local ID set.
      const counts=new Map<number,number>();
      for (const event of town.chronicle.events) counts.set(event.id,(counts.get(event.id)??0)+1);
      const excluded=new Set<number>();
      for (const event of town.chronicle.events) {
        const key=gossipSourceKey(sourceFor(event));
        if (!key || counts.get(event.id)!==1 || heardAt.has(key)) excluded.add(event.id);
      }
      const item=pickOverheardGossip(town,day,excluded);
      if (!item) return;
      const source=sourceFor({id:item.id,day:item.day,kind:item.kind,summary:item.text});
      const key=gossipSourceKey(source);
      if (!key) return;
      pendingRef.current.heard.set(key,nowGameMs);

      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now() + Math.random(), // collision-resistant key (matches App.tsx addMessage)
          text: frameOverheardGossip(item,townNewsContext(town,item,day).ageLabel),
          sender: 'npc',
          timestamp: new Date(),
          metadata: { type: 'banter', townGossip: source },
        },
      });
    };

    const interval = setInterval(overhear, GOSSIP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch]);
};
