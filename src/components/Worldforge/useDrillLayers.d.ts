export interface LayerDef<K extends string = string> {
    id: K;
    label: string;
    desc: string;
}
export type DrillLayerId = 'labels' | 'rivers' | 'roads';
export type DrillLayers = Record<DrillLayerId, boolean>;
export declare const DRILL_LAYER_DEFS: Array<LayerDef<DrillLayerId>>;
export declare function useDrillLayers(scope?: string | number): {
    layers: DrillLayers;
    toggle: (id: DrillLayerId) => void;
};
export type TownLayerId = 'buildings' | 'roads' | 'walls' | 'civic' | 'water';
export type TownLayers = Record<TownLayerId, boolean>;
export declare const TOWN_LAYER_DEFS: Array<LayerDef<TownLayerId>>;
export declare function useTownLayers(scope?: string | number): {
    layers: TownLayers;
    toggle: (id: TownLayerId) => void;
};
