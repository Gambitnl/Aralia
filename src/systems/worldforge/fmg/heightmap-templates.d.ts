/**
 * @file heightmap-templates.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/public/config/heightmap-templates.js.
 * See ./ATTRIBUTION.md. Template strings are FROZEN data: every step draws
 * RNG in order, so any edit changes generated worlds.
 */
export interface HeightmapTemplate {
    id: number;
    name: string;
    template: string;
    probability: number;
}
export declare const heightmapTemplates: Record<string, HeightmapTemplate>;
