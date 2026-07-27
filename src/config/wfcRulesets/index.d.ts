/**
 * @file src/config/wfcRulesets/index.ts
 * Lightweight WFC rulesets for submap generation.
 * These rule definitions are intentionally compact to keep bundle size small while allowing visual variety.
 */
export interface WfcNeighborRules {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
}
export interface WfcTileDefinition {
    id: string;
    weight: number;
    neighbors: WfcNeighborRules;
    biomeHint?: string;
}
export interface WfcRuleset {
    id: string;
    tiles: WfcTileDefinition[];
    fallbackTileId: string;
}
export declare const WFC_RULESETS: Record<string, WfcRuleset>;
