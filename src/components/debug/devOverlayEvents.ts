// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/08/2026, 17:25:48
 * Dependents: components/World3D/World3DWrapper.tsx, components/debug/AgentSimDevOverlay.tsx, components/debug/TownHistoryDevOverlay.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file devOverlayEvents.ts
 * Small UI bridge between the World 3D Controls menu and developer inspectors
 * that are mounted by GameModals elsewhere in the application tree.
 *
 * The events carry no game data and write no state. They only ask an already
 * mounted dev overlay to reveal itself, avoiding a second copy of either tool
 * inside the World 3D wrapper.
 */

export const OPEN_AGENT_SIM_EVENT = 'aralia:open-agent-sim';
export const OPEN_TOWN_HISTORY_EVENT = 'aralia:open-town-history';
export type DevOverlayEvent = typeof OPEN_AGENT_SIM_EVENT | typeof OPEN_TOWN_HISTORY_EVENT;

/** Ask one mounted developer inspector to open from an unrelated UI branch. */
export function requestDevOverlay(eventName: DevOverlayEvent): void {
  window.dispatchEvent(new Event(eventName));
}
