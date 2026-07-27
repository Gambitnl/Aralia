/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:36:53
 * Dependents: App.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file AgentSimPreview.tsx — standalone preview for the WF-AGENTSIM motion slice.
 *
 * Reachable at `?phase=agentsim`. Generates a deterministic demo burg + roster
 * (same recipe as the in-game AgentSimDevOverlay) and renders its townsfolk via
 * `TownAgentSnapshotView`. There is ONE mode: the behaviour sim. Townsfolk decide
 * by their needs (sleep, eat, work, socialise, shop) and walk the streets to wherever
 * that sends them. Scrubbing the clock deterministically RE-SIMULATES the day from its
 * anchor to the chosen hour (`simulateMindsTo`), so scrub-anywhere lands on one truthful
 * state; pressing play advances that same state smoothly. The old fixed-schedule motion
 * (`townMotionSnapshotAt`) is retired from this preview — it survives as an internal
 * fallback for other consumers (dev overlay, 3D), not as a competing mode here.
 *
 * `window.__agentSimPreview` exposes `setClock(h)` and `current()` for headless
 * proof. Pure presentation over deterministic generators — no game state.
 */
import React from 'react';
declare const AgentSimPreview: React.FC;
export default AgentSimPreview;
