/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 20:25:28
 * Dependents: components/World3D/World3DScene.tsx, components/Worldforge/AgentSim3DPreview.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GroundAgents.tsx
 * @description Instanced townsfolk that walk the streets in WF ground mode — the
 * render rung of the agent-sim (every layer beneath is pure + tested:
 * schedule → motion → `groundAgentScenePositions` → `crowdInstancePlan`).
 *
 * Figures are BAKED generated entities (src/systems/entities3d/three/crowdBake):
 * one representative body per ancestry group, baked once into
 * [idle, walk phase 0…N] keyframe geometries with vertex colors. Each agent is
 * an instance in the (group, phase) bucket its gait currently occupies, so a
 * street of walkers cycles through keyframes at instancing cost — no live
 * metaball fields. Replaced the unit-box figures 2026-07-11 (entity generator
 * slice 5).
 *
 * Renders NOTHING unless the ground world exposes agent inputs
 * (`townPlans`/`boundsFeet`) — inert in continent/PLAYING mode.
 *
 * Clock source priority: `window.__wfAgentClock` (capture/scrub override) → the
 * `clock` prop (live game time) → a default commute hour.
 */
import React from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { LoadedChunk } from '@/systems/world3d/types';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { type GroundAgentSceneNode } from '@/systems/worldforge/bridge/groundAgentMotion';
import type { TownRoster } from '@/systems/worldforge/roster/types';
import { type ResidentHandoffRecord } from './InteriorOccupants';
interface GroundAgentsProps {
    ground?: GroundWorld | null;
    /** Loaded interior packets that can currently own joined resident bodies. */
    loaded: LoadedChunk[];
    /** Fractional hour (live game clock). Overridden by window.__wfAgentClock. */
    clock?: number;
    sceneOrigin: SceneOrigin;
    /** Visual size multiplier for figures (preview exaggeration). Default 1. */
    figureScale?: number;
}
/**
 * Remove only roster instances whose joined interior packet owns the resident
 * at this clock. Unmatched/legacy residents remain street-owned, and the stable
 * member-key equality prevents a coincident numeric id from hiding a stranger.
 */
export declare function streetOwnedAgentNodes(nodes: GroundAgentSceneNode[], rosters: TownRoster[], handoffs: ReadonlyMap<string, ResidentHandoffRecord>, clock: number): GroundAgentSceneNode[];
declare const GroundAgents: React.FC<GroundAgentsProps>;
export default GroundAgents;
