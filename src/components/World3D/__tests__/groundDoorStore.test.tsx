/**
 * GG-580 (2026-11-02): a door change renders its own door leaf only.
 *
 * The scene used to put the open-door set and the resident door users in
 * `GroundFurnishingContext`, which every building reads. One resident at one
 * door then rendered every building in the town. These tests mount memoized
 * buildings that read the context the same way `SiteBuilding` does, each with
 * a real `BuildingDoor`, and count what renders when one door changes.
 */
import React, { Profiler, useContext } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SitePart } from '@/systems/worldforge/bridge/interiorParts';
import { siteDoorKey } from '@/systems/worldforge/bridge/sitePartTransform';
import { GroundFurnishingContext } from '../GroundFurnishingContext';
import { createGroundDoorStore, type GroundDoorStore } from '../groundDoorStore';
import { BuildingDoor } from '../BuildingDoor';

// The hover label is a DOM overlay in the real canvas; it never shows here.
vi.mock('@react-three/drei', () => ({ Html: () => null }));
afterEach(cleanup);

const part = (id: string): SitePart => ({ x: 0, z: -2, w: 1, d: 0.1, h: 2, colorHex: '#6b4a2e',
  door: { id, axis: 'x', swingX: 0, swingZ: 1 } } as unknown as SitePart);
const SITES = ['wf-plot-1-10', 'wf-plot-1-11', 'wf-plot-1-12'];
const keyOf = (site: string) => siteDoorKey(site, part('front'));

function mount(store: GroundDoorStore) {
  const buildingRenders = new Map<string, number>(), doorCommits = new Map<string, number>();
  const Building = React.memo(({ site }: { site: string }) => {
    useContext(GroundFurnishingContext); // as SiteBuilding does
    buildingRenders.set(site, (buildingRenders.get(site) ?? 0) + 1);
    return <Profiler id={site} onRender={(id) => doorCommits.set(id, (doorCommits.get(id) ?? 0) + 1)}>
      <BuildingDoor part={part('front')} siteId={site} rotationY={0} doorZSign={-1} />
    </Profiler>;
  });
  const value = { origin: { x: 0, z: 0 }, onDoor: () => {}, doors: store };
  // jsdom does not know the three.js element names; their warnings are noise here.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  const view = render(<GroundFurnishingContext.Provider value={value}>
    {SITES.map(site => <Building key={site} site={site} />)}
  </GroundFurnishingContext.Provider>);
  quiet.mockRestore();
  const counts = () => ({ buildings: SITES.map(s => buildingRenders.get(s) ?? 0), doors: SITES.map(s => doorCommits.get(s) ?? 0) });
  return { view, counts };
}

describe('ground door store (GG-580)', () => {
  it('renders only the door leaf whose own state changed', () => {
    const store = createGroundDoorStore({ openDoors: new Set(), doorUsers: new Map() });
    const { counts } = mount(store);
    expect(counts()).toEqual({ buildings: [1, 1, 1], doors: [1, 1, 1] });

    // A resident opens the middle building's door.
    act(() => store.set({ openDoors: new Set([keyOf(SITES[1])]), doorUsers: new Map([[keyOf(SITES[1]), ['Fenna Hartham']]]) }));
    expect(counts()).toEqual({ buildings: [1, 1, 1], doors: [1, 2, 1] });

    // Another resident starts to use the last door; the middle one is unchanged.
    act(() => store.set({ openDoors: new Set([keyOf(SITES[1]), keyOf(SITES[2])]),
      doorUsers: new Map([[keyOf(SITES[1]), ['Fenna Hartham']], [keyOf(SITES[2]), ['Odo Brask']]]) }));
    expect(counts()).toEqual({ buildings: [1, 1, 1], doors: [1, 2, 2] });
  });

  it('keeps an unchanged door users array, so a new map with the same names renders nothing', () => {
    const names = ['Fenna Hartham'];
    const store = createGroundDoorStore({ openDoors: new Set([keyOf(SITES[0])]), doorUsers: new Map([[keyOf(SITES[0]), names]]) });
    const { counts } = mount(store);
    act(() => store.set({ openDoors: new Set([keyOf(SITES[0])]), doorUsers: new Map([[keyOf(SITES[0]), ['Fenna Hartham']]]) }));
    expect(store.read().doorUsers?.get(keyOf(SITES[0]))).toBe(names);
    expect(counts()).toEqual({ buildings: [1, 1, 1], doors: [1, 1, 1] });
  });

  it('tells listeners only of a real change', () => {
    const openDoors = new Set<string>(), doorUsers = new Map<string, readonly string[]>();
    const store = createGroundDoorStore({ openDoors, doorUsers });
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.set({ openDoors, doorUsers });
    expect(heard).not.toHaveBeenCalled();
    store.set({ openDoors: new Set(['a/front']), doorUsers });
    expect(heard).toHaveBeenCalledOnce();
    stop();
    store.set({ openDoors: new Set(), doorUsers });
    expect(heard).toHaveBeenCalledOnce();
  });
});
