import React from 'react';
import { type DrillLayerId, type LayerDef } from './useDrillLayers';
export interface DrillLayerPanelProps<K extends string> {
    layers: Record<K, boolean>;
    toggle: (id: K) => void;
    /** Toggle definitions to show; defaults to the region/submap set. */
    defs?: ReadonlyArray<LayerDef<K>>;
}
/**
 * Compact layer toggle menu for the drill tiers (region / submap / town),
 * mirroring the atlas Layers menu but with the feature toggles that exist at that
 * tier (passed via `defs`). Top-right, above the breadcrumb/ascend controls.
 * Generic over the toggle id set so each tier keeps its own typed layers.
 */
declare function DrillLayerPanel<K extends string = DrillLayerId>({ layers, toggle, defs }: DrillLayerPanelProps<K>): React.ReactElement;
export default DrillLayerPanel;
