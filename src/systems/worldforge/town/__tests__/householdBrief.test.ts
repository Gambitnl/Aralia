/**
 * These tests prove the town-to-blueprint brief describes the named household
 * exactly. In particular, wealthy servants must already be real people before
 * this adapter assigns stable room-program tags.
 */
import { describe, expect, it } from "vitest";
import type { TownPlan } from "../../artifacts";
import { buildingPlotInput } from "../buildingPlotInput";
import {
  briefFromHousehold,
  briefForPlot,
  householdForPlot,
  householdMemberIdentity,
  householdPopulationForPlot,
  householdPopulationsForPlan,
} from "../householdBrief";
import { generateHousehold } from "../household";
import { rootSeedPath } from "../../seedPath";

describe("householdBrief", () => {
  it("slot tags are stable and cover every member", () => {
    const hh = generateHousehold(rootSeedPath(42), "b7", 5, "cottage");
    const brief = briefFromHousehold(hh, {
      wealth: "common",
      worksAtHome: false,
    });
    expect(brief.slots.length).toBe(hh.members.length);
    expect(brief.slots[0].tag).toBe("head");
    // tags unique
    expect(new Set(brief.slots.map((s) => s.tag)).size).toBe(
      brief.slots.length,
    );
    // deterministic
    const again = briefFromHousehold(
      generateHousehold(rootSeedPath(42), "b7", 5, "cottage"),
      { wealth: "common", worksAtHome: false },
    );
    expect(again).toEqual(brief);
  });

  it("maps real wealthy servants and never fabricates servants for an unstaffed household", () => {
    const unstaffed = generateHousehold(rootSeedPath(1), "b1", 4, "townhouse");
    const staffed = generateHousehold(
      rootSeedPath(1),
      "b1",
      4,
      "townhouse",
      undefined,
      "wealthy",
    );
    const rich = briefFromHousehold(staffed, {
      wealth: "wealthy",
      worksAtHome: false,
    });
    const mismatched = briefFromHousehold(unstaffed, {
      wealth: "wealthy",
      worksAtHome: false,
    });
    const servantSlots = rich.slots.filter((slot) => slot.role === "servant");

    expect(servantSlots.map((slot) => slot.tag)).toEqual([
      "servant:0",
      "servant:1",
    ]);
    expect(servantSlots).toHaveLength(
      staffed.members.filter((member) => member.role === "servant").length,
    );
    expect(mismatched.slots.some((slot) => slot.role === "servant")).toBe(
      false,
    );
  });

  it("passes residential wealth into the named household before briefing it", () => {
    const home = {
      homeId: "b-rich",
      residential: true,
      occupants: 4,
      buildingType: "townhouse",
      district: "wealthy",
      polygon: [],
      frontageEdge: 0,
    } as never;
    const brief = briefForPlot(home, [home], rootSeedPath(3));

    expect(brief?.slots.filter((slot) => slot.role === "servant")).toHaveLength(
      2,
    );
  });

  it("uses architecture wealth consistently for household, brief, and building style", () => {
    const plan: TownPlan = {
      burgId: 3,
      streets: [],
      plots: [
        {
          id: 10,
          role: "house",
          storeys: 2,
          footprint: [
            [0, 0],
            [40, 0],
            [40, 50],
            [0, 50],
          ],
          pop: {
            homeId: "b-architecture-rich",
            residential: true,
            occupants: 4,
            buildingType: "townhouse",
            district: "common",
          },
          // The architecture stamp is the final building-level decision. This
          // intentionally disagrees with the older population district.
          architecture: { wealth: "wealthy" } as never,
        },
      ],
    };
    const populations = householdPopulationsForPlan(plan);
    const population = householdPopulationForPlot(plan.plots[0])!;
    const resolved = householdForPlot(
      population,
      populations,
      rootSeedPath(3),
    )!;
    const input = buildingPlotInput(plan, plan.plots[0], rootSeedPath(3), {
      cultureType: "Generic",
      climate: "temperate",
    });

    const servants = resolved.household.members
      .map((member, index) => ({
        member,
        id: householdMemberIdentity(resolved.household, index),
      }))
      .filter(({ member }) => member.role === "servant");
    expect(resolved.wealth).toBe("wealthy");
    expect(servants.map(({ id }) => id)).toEqual([
      "b-architecture-rich:servant:0",
      "b-architecture-rich:servant:1",
    ]);
    expect(
      input.household?.slots.filter((slot) => slot.role === "servant"),
    ).toHaveLength(2);
    expect(input.household?.wealth).toBe("wealthy");
    expect(input.style?.wealth).toBe("wealthy");
  });

  it("a workplace plot resolves to the proprietor family with worksAtHome", () => {
    const home = {
      homeId: "b1",
      residential: true,
      occupants: 4,
      buildingType: "cottage",
      district: "common",
      workplaceId: "b2",
      workRole: "proprietor",
      polygon: [],
      frontageEdge: 0,
    } as never;
    const smithy = {
      homeId: "b2",
      residential: false,
      occupants: 0,
      buildingType: "smithy",
      district: "common",
      proprietorHomeId: "b1",
      polygon: [],
      frontageEdge: 0,
    } as never;
    const brief = briefForPlot(smithy, [home, smithy], rootSeedPath(3));
    expect(brief?.worksAtHome).toBe(true);
    expect(brief?.trade).toBe("blacksmith");
  });

  it("keeps proprietor household wealth and servant identities owned by the home across districts", () => {
    const plan: TownPlan = {
      burgId: 8,
      streets: [],
      plots: [
        {
          id: 1,
          role: "house",
          storeys: 2,
          footprint: [
            [0, 0],
            [40, 0],
            [40, 50],
            [0, 50],
          ],
          pop: {
            homeId: "owner-home",
            residential: true,
            occupants: 4,
            buildingType: "townhouse",
            district: "common",
            workplaceId: "owner-smithy",
            workRole: "proprietor",
          },
          architecture: { wealth: "wealthy" } as never,
        },
        {
          id: 2,
          role: "workshop",
          storeys: 1,
          footprint: [
            [50, 0],
            [90, 0],
            [90, 50],
            [50, 50],
          ],
          pop: {
            homeId: "owner-smithy",
            residential: false,
            occupants: 0,
            buildingType: "smithy",
            district: "poor",
            proprietorHomeId: "owner-home",
          },
          architecture: { wealth: "poor" } as never,
        },
      ],
    };
    const populations = householdPopulationsForPlan(plan);
    const homePopulation = householdPopulationForPlot(plan.plots[0])!;
    const workPopulation = householdPopulationForPlot(plan.plots[1])!;
    const home = householdForPlot(
      homePopulation,
      populations,
      rootSeedPath(8),
    )!;
    const work = householdForPlot(
      workPopulation,
      populations,
      rootSeedPath(8),
    )!;
    const workInput = buildingPlotInput(plan, plan.plots[1], rootSeedPath(8), {
      cultureType: "Generic",
      climate: "temperate",
    });

    // The workplace keeps its own poor architectural finish, but the family
    // and its two named servants stay byte-identical to the wealthy home.
    expect(work.wealth).toBe("wealthy");
    expect(work.household.members).toEqual(home.household.members);
    expect(
      work.household.members.filter((member) => member.role === "servant"),
    ).toHaveLength(2);
    expect(workInput.household?.wealth).toBe("wealthy");
    expect(workInput.style?.wealth).toBe("poor");
  });
});
