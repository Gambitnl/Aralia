/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 01:25:29
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, devtools/buildingIdentityLab/BuildingIdentityLab.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file PreviewBuilding3D.tsx
 * @description Orbitable 3D realization of the EXACT BlueprintPlan the 2D
 * blueprint drawer shows — the standing eyeball tool for the roofscapes phase.
 *
 * All render decisions live in the PURE, unit-tested `buildingSceneModel`
 * (src/systems/world3d/buildingSceneModel.ts): floor peel (basement..selected,
 * open-topped; 'all' = closed), per-kind colors, lit window panes 17–23h when
 * occupied, hearth glow from `hearthLitHours`, and occupant dots per at-home
 * member. This component only maps that data onto meshes + lights, following
 * the Town3DScene R3F pattern. Units are PLAN FEET throughout (scale is
 * arbitrary in an isolated viewer); plan (x, y, z0) → three (x, z0, y).
 *
 * The viewer also gives those unchanged meshes a storybook presentation. It
 * reuses Aralia's shared three-step toon ramp, draws dark architectural edges,
 * lays a faint procedural paper grain over the finished frame, and grounds the
 * model with one bounded shadow-casting sun plus a small contact-shadow pass.
 * These are render-only choices: they do not alter the blueprint, generated
 * geometry, named random draws, or any other deterministic building data.
 */
/**
 * ARCHITECTURAL COMMENTARY:
 * WHAT CHANGED: Added automated bounds-based camera framing (calculateModelBounds and computeCameraConfig)
 * that incorporates all mesh boxes, solved roof heights, and motifs. Aimed the orbit target at the real
 * vertical center of the bounds. Set a lower 28-degree default camera angle for closed buildings
 * to render facades, foundations, trim, and motifs legibly. Added a straight-down vertical fill light to
 * resolve roof blackness. Configured same-color emissive lighting on the roof material that preserves
 * model.roof.color exactly while ensuring legibility in daylight and keeping the night darker.
 * WHY: The default camera was at 51 degrees (looking almost straight down, hiding the facade), aimed too
 * low based on hardcoded plan height, cropped roofs on 1440x900/1920x1080 screens, and rendered slate/clay
 * roofs as near-black voids.
 * WHAT WAS PRESERVED: The exact blueprint geometry, dressing-part generation, day/night transitions,
 * emissive window/hearth lighting, dot positions, and OrbitControls interactivity were preserved.
 * WHAT REMAINS DEFERRED: Broader production-world facade readability and future material surfaces remain
 * deferred to subsequent development phases.
 *
 * LIGHTING COMMENTARY:
 * WHAT CHANGED: The existing daytime/nighttime key light now casts a bounded soft shadow map, visible
 * building parts participate as casters and receivers, and a one-frame contact-shadow pass darkens only
 * the small patch where the isolated model meets its ground apron.
 * WHY: The lab previously lit every face but produced no ground silhouette or local occlusion, making the
 * generated mass appear detached from the site even when its geometry was correct.
 * WHAT WAS PRESERVED: The four-light day/night recipe, camera, controls, colors, geometry, toon bands,
 * ink edges, roof emissive lift, and paper grain are unchanged; production World3D lighting stays separate.
 * WHAT REMAINS DEFERRED: Production roof occlusion continues to belong to World3DLighting rather than this
 * isolated inspection canvas, and full-screen post-processing remains intentionally out of scope.
 */
import React from 'react';
import type { BlueprintPlan } from '../../../systems/worldforge/interior/blueprintTypes';
import type { BuildingOccupancy } from '../../../systems/worldforge/interior/occupancy';
import { type PeelLevel, type BuildingSceneModel } from '../../../systems/world3d/buildingSceneModel';
/** Bounding box coordinates in Three.js world space, where Y is the vertical axis. */
export interface WorldBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
}
/**
 * Calculates the bounding box of all visible components in world space.
 *
 * It accounts for mesh boxes (walls, windows, trim, motifs, etc.), solved roof vertices,
 * and occupant dots, all translated to align with the orbit target origin.
 *
 * @param model The pure 3D building scene model data
 * @param origin The site origin coordinates used to recenter the plan
 */
export declare function calculateModelBounds(model: Pick<BuildingSceneModel, 'boxes' | 'roof' | 'dots'>, origin: {
    x: number;
    y: number;
}): WorldBounds;
/**
 * Computes the optimal camera position and focus target to cleanly frame the model.
 *
 * It uses a perspective-fitting algorithm that projects the bounding box corners into
 * camera space, determining the exact distance required to fit the model horizontally
 * and vertically with a solid safety margin.
 *
 * @param bounds The calculated boundaries of the visible building geometry
 * @param upToLevel The current level slice being inspected
 * @param aspect The aspect ratio of the viewport (defaults to conservative 1.3)
 */
export declare function computeCameraConfig(bounds: WorldBounds, upToLevel: PeelLevel, aspect?: number): {
    target: [number, number, number];
    cameraPosition: [number, number, number];
    dist: number;
    elevationDeg: number;
};
export interface PreviewBuilding3DProps {
    plan: BlueprintPlan;
    /** Floor peel level slice ('all' = closed building). */
    upToLevel: PeelLevel;
    /** Hour slider value, 0-23 (controls light colors and window glow). */
    hour: number;
    /** Active occupancy detail, if toggled on. */
    occupancy?: BuildingOccupancy;
}
declare const PreviewBuilding3D: React.FC<PreviewBuilding3DProps>;
export default PreviewBuilding3D;
