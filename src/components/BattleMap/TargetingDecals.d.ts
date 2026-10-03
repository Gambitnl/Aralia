/**
 * @file TargetingDecals.tsx — 3D ability-targeting tile decals (gap #29).
 *
 * The 2D battle map paints red "valid target" tiles and sky-blue teleport
 * destinations the moment an ability is selected; the 3D view computed the
 * same sets (BattleMap3D's useTargetSelection) but rendered nothing — at
 * tactical zoom there was no visible response to entering targeting mode
 * (verified live 2026-06-11, GOAL #14/#15). This layer projects those tile
 * sets onto the terrain as gently pulsing tile patches.
 *
 * The hovered-AoE template (aoeSet) is also drawn here (GOAL #15). It used
 * to live in VFXSystem's AoEPreview as flat per-tile planes at y=0.06 — the
 * same buried-on-hills / floating-over-banks class of bug tasks 78-80
 * eradicated — and it never appeared anyway because nothing in the 3D view
 * called previewAoE (no tile-hover path until task 81 wired one).
 *
 * Rendering approach: one merged BufferGeometry per tile category, each tile
 * a 4×4-subdivided quad whose vertices are displaced by the terrain ground
 * sampler. Flat instanced quads were tried first and FLOATED on dune slopes
 * (a max-corner-anchored pane slicing through the unit standing on the tile
 * — see target29c capture); per-vertex conformance hugs the surface instead.
 * Sets are small (single-target: enemy tiles; area: up to ~450 tiles ≈ 14k
 * tris) and change only on ability selection, so rebuild cost is negligible.
 *
 * Preserved: 2D color vocabulary (red targets / sky teleport) so mode
 * switching keeps one visual language.
 */
import React from "react";
interface TargetingDecalsProps {
    /** Tiles a selected ability may target, keys "x-y" (useTargetSelection). */
    validTargetSet: Set<string>;
    /** Teleport destination tiles, keys "x-y". */
    teleportDestinationSet: Set<string>;
    /** Hovered AoE template tiles, keys "x-y" (useTargetSelection aoeSet). */
    aoeSet: Set<string>;
    /** Whether ability targeting is active at all. */
    targetingMode: boolean;
    /** Terrain ground-height sampler (world X/Z → world Y), or null pre-load. */
    groundSampler: ((x: number, z: number) => number) | null;
}
declare const TargetingDecals: React.FC<TargetingDecalsProps>;
export default TargetingDecals;
