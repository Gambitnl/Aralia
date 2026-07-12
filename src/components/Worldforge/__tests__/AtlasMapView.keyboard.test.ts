/**
 * Keyboard navigation proof for the irregular Worldforge cell graph.
 * Component rendering is covered by the live audit; this unit keeps the
 * direction chooser deterministic without needing a canvas backend.
 */
import { describe, expect, it } from "vitest";
import { directionalAtlasNeighbor } from "../AtlasMapView";

describe("directionalAtlasNeighbor", () => {
  const points: Array<readonly [number, number]> = [
    [10, 10],
    [4, 10],
    [16, 11],
    [10, 3],
    [9, 17],
  ];
  const neighbors = [[1, 2, 3, 4], [0], [0], [0], [0]];

  it("selects the actual Voronoi neighbor in each requested direction", () => {
    expect(directionalAtlasNeighbor(0, "left", points, neighbors)).toBe(1);
    expect(directionalAtlasNeighbor(0, "right", points, neighbors)).toBe(2);
    expect(directionalAtlasNeighbor(0, "up", points, neighbors)).toBe(3);
    expect(directionalAtlasNeighbor(0, "down", points, neighbors)).toBe(4);
  });

  it("stays on the current cell when no neighbor lies in that direction", () => {
    expect(directionalAtlasNeighbor(1, "left", points, neighbors)).toBe(1);
  });
});
