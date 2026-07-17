/**
 * These tests keep player-facing elevation language tied to the same encoded
 * WorldForge relief consumed by the 3D terrain renderer.
 */
import { describe, expect, it } from "vitest";
import {
  describeBattleMapElevation,
  elevationContourBand,
  elevationUnitsToFeet,
  findBattleMapElevationBaseline,
} from "../elevationPresentation";

describe("battle-map elevation presentation", () => {
  it("recovers feet from the 0.3-metre renderer encoding", () => {
    expect(elevationUnitsToFeet(10)).toBeCloseTo(9.8425, 3);
  });

  it("describes higher, lower, and level terrain relative to a creature", () => {
    expect(describeBattleMapElevation(20, 10, "Dev", 5)).toMatchObject({
      relation: "higher",
      relativeFeet: 10,
      localReliefFeet: 15,
      referenceLocalReliefFeet: 5,
      badgeText: "\u2191 10 ft",
      relativeText: "10 ft higher",
      primaryText: "10 ft higher than Dev",
    });
    expect(describeBattleMapElevation(10, 20, "Dev", 5)).toMatchObject({
      relation: "lower",
      relativeFeet: -10,
      localReliefFeet: 5,
      referenceLocalReliefFeet: 15,
      badgeText: "\u2193 10 ft",
      relativeText: "10 ft lower",
      primaryText: "10 ft lower than Dev",
    });
    expect(describeBattleMapElevation(20.2, 20, "Dev", 5)).toMatchObject({
      relation: "level",
      relativeFeet: 0,
      referenceLocalReliefFeet: 15,
      badgeText: "= 0 ft",
      relativeText: "same height",
      primaryText: "Level with Dev",
    });
  });

  it("falls back to truthful local relief when no creature is available", () => {
    expect(describeBattleMapElevation(10)).toMatchObject({
      relation: "unreferenced",
      relativeFeet: null,
      referenceLocalReliefFeet: null,
      badgeText: "10 ft",
      relativeText: null,
      primaryText: "10 ft above this map's lowest ground",
      secondaryText: "Lowest ground on this map = 0 ft",
    });
  });

  it("uses the tactical crop's real lowest tile as the zero-foot baseline", () => {
    const baseline = findBattleMapElevationBaseline([
      { elevation: 31 },
      { elevation: 22 },
      { elevation: 50 },
      { elevation: Number.NaN },
    ]);

    expect(baseline).toBe(22);
    expect(describeBattleMapElevation(22, 34, "Dev", baseline)).toMatchObject({
      localReliefFeet: 0,
      relativeFeet: -12,
      secondaryText: "0 ft above this map's lowest ground (0 ft)",
    });
    expect(describeBattleMapElevation(33, 34, "Dev", baseline)).toMatchObject({
      localReliefFeet: 11,
      relativeFeet: -1,
      relativeText: "1 ft lower",
    });
  });

  it("places terrain in stable five-foot contour bands", () => {
    expect(elevationContourBand(0)).toBe(0);
    expect(elevationContourBand(5)).toBe(0);
    expect(elevationContourBand(5.1)).toBe(1);
    expect(elevationContourBand(10.2)).toBe(2);
  });
});
