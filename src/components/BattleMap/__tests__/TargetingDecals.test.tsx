import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import TargetingDecals from "../TargetingDecals";

/**
 * This test suite validates 3D ability-targeting decals and terrain-conforming AoE/target shapes.
 *
 * When a player enters targeting mode in the 3D battle map, this component projects pulsing color decals onto
 * the terrain: red frames for valid creature/object targets, sky-blue fills for teleport destinations, and
 * elevated red fills for hovered Area-of-Effect templates (spheres, cones, cylinders).
 *
 * Called by: Vitest test runner (BattleMap 3D test suite)
 * Depends on: TargetingDecals.tsx, Three.js BufferGeometry, useFrame
 */

// ============================================================================
// Mocks and Three.js Shims
// ============================================================================
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
}));

describe("TargetingDecals", () => {
  it("renders nothing when targetingMode is inactive", () => {
    const { container } = render(
      <TargetingDecals
        validTargetSet={new Set(["1-1", "2-2"])}
        teleportDestinationSet={new Set(["0-0"])}
        aoeSet={new Set(["3-3"])}
        targetingMode={false}
        groundSampler={(x, z) => 0}
      />,
    );

    // When targeting is off, no 3D decal group should be rendered into the scene
    expect(container.firstChild).toBeNull();
  });

  it("renders mesh layers for valid targets, teleport destinations, and AoE templates when targetingMode is active", () => {
    const validTargets = new Set(["1-1", "2-1"]);
    const teleportDests = new Set(["0-2", "0-3"]);
    const aoeTiles = new Set(["4-4", "4-5", "5-4", "5-5"]);

    const mockGroundSampler = (x: number, z: number) => {
      // Return synthetic terrain elevation (e.g. hill slope)
      return (x + z) * 0.1;
    };

    const { container } = render(
      <TargetingDecals
        validTargetSet={validTargets}
        teleportDestinationSet={teleportDests}
        aoeSet={aoeTiles}
        targetingMode={true}
        groundSampler={mockGroundSampler}
      />,
    );

    // Group should be rendered with targeting-decals name
    expect(container.querySelector('group[name="targeting-decals"]')).toBeInTheDocument();

    // Meshes for each active category should be present
    const meshes = container.querySelectorAll("mesh");
    expect(meshes.length).toBe(3); // 1 validTarget + 1 teleport + 1 AoE
  });

  it("handles empty tile sets gracefully without crashing", () => {
    const { container } = render(
      <TargetingDecals
        validTargetSet={new Set()}
        teleportDestinationSet={new Set()}
        aoeSet={new Set()}
        targetingMode={true}
        groundSampler={null}
      />,
    );

    // Group is rendered, but no child meshes are generated for empty sets
    const group = container.querySelector('group[name="targeting-decals"]');
    expect(group).toBeInTheDocument();
    expect(container.querySelectorAll("mesh").length).toBe(0);
  });

  it("handles flat terrain when groundSampler is null", () => {
    const validTargets = new Set(["1-2"]);

    const { container } = render(
      <TargetingDecals
        validTargetSet={validTargets}
        teleportDestinationSet={new Set()}
        aoeSet={new Set()}
        targetingMode={true}
        groundSampler={null}
      />,
    );

    const meshes = container.querySelectorAll("mesh");
    expect(meshes.length).toBe(1);
  });
});
