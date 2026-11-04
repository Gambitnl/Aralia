/**
 * @file groundDoorStore.ts
 * GG-580 (2026-11-02): live door state for the ground scene, outside React props.
 *
 * Before this store the scene put the open-door set and the resident door
 * users into `GroundFurnishingContext`. A resident who started or stopped using
 * a door made a new context value, so every `SiteBuilding` rendered again
 * (about 250 ms for 666 buildings), about once a second in a town.
 *
 * Now the context holds one stable store per scene. A door leaf subscribes to
 * its own key only (`useDoorLeafState`), so a door change renders that leaf and
 * nothing else. Code that polls in a frame loop reads `store.read()`.
 *
 * What is preserved: the same two values (the merged open set and the users
 * map) with the same meaning. The store keeps the users array of a door that
 * did not change, so a leaf whose users are the same does not render.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/World3D/BuildingDoor.tsx, components/World3D/GroundFurnishingContext.ts, components/World3D/World3DScene.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useSyncExternalStore } from 'react';

export type DoorUsers = ReadonlyMap<string, readonly string[]>;
export interface GroundDoorState {
  /** Player-saved opens merged with doors that residents use now. */
  openDoors?: ReadonlySet<string>;
  /** Transient use by a source resident; independent of player-saved opens. */
  doorUsers?: DoorUsers;
}
export interface GroundDoorStore {
  read(): GroundDoorState;
  /** Publish a new state. Listeners hear only a real change. */
  set(next: GroundDoorState): void;
  subscribe(listener: () => void): () => void;
}

const sameNames = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((name, i) => name === b[i]));

export function createGroundDoorStore(initial: GroundDoorState = {}): GroundDoorStore {
  let state: GroundDoorState = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => state,
    set(next) {
      if (next.openDoors === state.openDoors && next.doorUsers === state.doorUsers) return;
      // Keep each unchanged door's users array, so its leaf selector is stable.
      let doorUsers = next.doorUsers;
      if (doorUsers && state.doorUsers) {
        const previous = state.doorUsers;
        const kept = new Map<string, readonly string[]>();
        for (const [key, names] of doorUsers) {
          const before = previous.get(key);
          kept.set(key, sameNames(before, names) ? before! : names);
        }
        doorUsers = kept;
      }
      state = { openDoors: next.openDoors, doorUsers };
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

const NO_STORE = (_listener: () => void) => () => {};
const EMPTY: GroundDoorState = {};

/** A building's daylight changes only when one of its own leaves opens or
 * closes. A stable string avoids rebuilding rooms for distant doors or for
 * changes in who is using an already-open door. */
export function useDoorOpenSignature(store: GroundDoorStore | undefined, keys: readonly string[]): string {
  return useSyncExternalStore(store ? store.subscribe : NO_STORE,
    () => keys.map(key => store?.read().openDoors?.has(key) ? '1' : '0').join(''));
}

/** One leaf's open flag and users. Renders only when this key changes. */
export function useDoorLeafState(store: GroundDoorStore | undefined, key: string): { open: boolean; users: readonly string[] | undefined } {
  const subscribe = store ? store.subscribe : NO_STORE;
  const open = useSyncExternalStore(subscribe, () => store?.read().openDoors?.has(key) ?? false);
  const users = useSyncExternalStore(subscribe, () => store?.read().doorUsers?.get(key));
  return { open, users };
}

/** The whole door state, for a single consumer that needs every door. */
export function useGroundDoorState(store: GroundDoorStore | undefined): GroundDoorState {
  return useSyncExternalStore(store ? store.subscribe : NO_STORE, () => store?.read() ?? EMPTY);
}
