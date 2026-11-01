/**
 * These tests keep player-facing elevation language tied to the same encoded
 * WorldForge relief consumed by the 3D terrain renderer.
 */
import { describe, expect, it } from "vitest";
import { feetToElevationUnits } from "../../../utils/combat/elevationUnits";
import { getBattleMapTileAltitudeFeet } from "../../../utils/spatial/elevationGeometry";
import {
  describeBattleMapElevation,
  describeBattleMapTerrain,
  elevationContourBand,
  elevationUnitsToFeet,
  findBattleMapElevationBaseline,
} from "../elevationPresentation";

describe("battle-map elevation presentation", () => {
  it("uses canonical rounded altitudes across a fractional map-floor boundary", () => {
    // Model the native 65ft/66ft mismatch without claiming these invented
    // fractional samples are an exact dump of the source encounter terrain.
    const actor = feetToElevationUnits(65.4);
    const tile = feetToElevationUnits(65.6);
    const floor = feetToElevationUnits(49.3);
    const expectedDelta = getBattleMapTileAltitudeFeet({ elevation: tile }) -
      getBattleMapTileAltitudeFeet({ elevation: actor });
    expect(expectedDelta).toBe(1);
    expect(describeBattleMapElevation(tile, actor, "Mara", floor)).toMatchObject({
      relation: "higher", relativeFeet: expectedDelta,
      localReliefFeet: 17, referenceLocalReliefFeet: 16,
      primaryText: "1 ft higher than Mara",
    });
    expect(describeBattleMapElevation(actor, tile, "Mara", floor)).toMatchObject({
      relation: "lower", relativeFeet: -expectedDelta,
    });
  });
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
    // Canonical altitudes round independently: encoded 22 -> 22ft and 34 -> 33ft.
    // Subtracting the map floor first previously displayed a different 12ft delta.
    expect(describeBattleMapElevation(22, 34, "Dev", baseline)).toMatchObject({
      localReliefFeet: 0,
      relativeFeet: -11,
      secondaryText: "0 ft above this map's lowest ground (0 ft)",
    });
    expect(describeBattleMapElevation(33, 34, "Dev", baseline)).toMatchObject({
      localReliefFeet: 10,
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

  it("names tile ground for the inspector, physical facts first", () => {
    expect(describeBattleMapTerrain({ terrain: "grass" })).toBe("Grass");
    expect(describeBattleMapTerrain({ terrain: "water" })).toBe(
      "Water (impassable)",
    );
    expect(describeBattleMapTerrain({ terrain: "difficult" })).toBe(
      "Difficult ground (slow going)",
    );
    expect(describeBattleMapTerrain({ terrain: "wall" })).toBe(
      "Wall (blocks movement and sight)",
    );
    expect(
      describeBattleMapTerrain({ terrain: "grass", surface: { kind: "road" } }),
    ).toBe("Road (grass under a worn route)");
    expect(
      describeBattleMapTerrain({
        terrain: "water",
        crossing: { kind: "ford" },
      }),
    ).toBe("Water — ford crossing (passable, slow)");
    expect(
      describeBattleMapTerrain({
        terrain: "water",
        surface: { kind: "road" },
        crossing: { kind: "bridge" },
      }),
    ).toBe("Water — bridge deck (passable)");
  });
});
