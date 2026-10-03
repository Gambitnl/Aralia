/**
 * @file VillagerRegistry.tsx — the town's people, grouped by household.
 *
 * A scrollable census of everyone present, clustered by the home they share so
 * families read at a glance. Each villager shows identity (name · age · race ·
 * occupation) and their relational connections — spouse, parents, children,
 * siblings (clickable to jump to that person), plus kin in other towns or "no
 * known family". Selecting a villager pins + highlights them on the map; hovering
 * a row mirrors the map hover. Memoised so it doesn't re-render with the sim clock.
 */
import React from 'react';
import type { Occupant } from '../../systems/worldforge/roster/types';
import type { FamilyTies } from '../../systems/worldforge/roster/family';
export interface VillagerRegistryProps {
    occupants: Occupant[];
    families: Map<number, FamilyTies>;
    selectedId: number | null;
    hoveredId: number | null;
    onSelect: (id: number | null) => void;
    onHover: (id: number | null) => void;
    nameOf: (id: number) => string;
}
/** Memoised: the census only changes with the roster/selection, not the sim clock. */
declare const VillagerRegistry: React.NamedExoticComponent<VillagerRegistryProps>;
export default VillagerRegistry;
