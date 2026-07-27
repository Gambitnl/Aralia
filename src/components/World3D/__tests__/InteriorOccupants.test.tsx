/**
 * @file InteriorOccupants.test.tsx
 * Living-interiors occupant layer. Covers the load-bearing PURE resolver
 * (occupantScenePosition) — an occupant's scene position at a given hour, or
 * null when the member is OUT that hour. The station is authored in plan feet
 * (blueprint frame, 0 = min corner); the resolver maps it through the shared
 * planFeetToSiteLocal → siteLocalToScene transform, then lifts by storey. The
 * fractional-clock resolver is pinned as well: consecutive home stations
 * walk during the first half-hour instead of snapping at the boundary. The
 * nearby-body selector is also pinned because it protects the live scene
 * from mounting an unbounded number of marching-cubes residents in dense towns.
 */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useFrame } from "@react-three/fiber";
import type {
  BuildingOccupantRender,
  LoadedChunk,
} from "@/systems/world3d/types";
import type { GroundAgentSceneNode } from "@/systems/worldforge/bridge/groundAgentMotion";
import type { TownRoster } from "@/systems/worldforge/roster/types";
import {
  applyInteriorOccupantMotion,
  applyInteriorResidentFrame,
  collectResidentHandoffIndex,
  INTERIOR_WALK_FRACTION,
  InteriorOccupantNameplate,
  MAX_LIVE_INTERIOR_BODIES,
  occupantDoorScenePosition,
  occupantMotionAtClock,
  occupantScenePosition,
  readInteriorActorClock,
  residentRenderOwnerAtClock,
  selectInteriorBodyKeys,
} from "../InteriorOccupants";
import { streetOwnedAgentNodes } from "../GroundAgents";
import {
  InteriorHourProvider,
  useInteriorClockRef,
} from "../InteriorHourContext";

const frameSubscriptions = vi.hoisted(
  () =>
    [] as Array<{
      callback: () => void;
      priority: number;
    }>,
);

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: () => void, priority = 0) => {
    frameSubscriptions.push({ callback, priority });
  },
}));

vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("InteriorOccupantNameplate", () => {
  it("visibly binds the baked full name and household identity to one body id", () => {
    const occupant = {
      id: 27,
      name: "Mara Ashford",
      householdMemberId: "owner-home:servant:0",
      ageBand: "adult",
      body: {} as never,
      stationsByHour: Array(24).fill(null),
    } satisfies BuildingOccupantRender;

    render(<InteriorOccupantNameplate occupant={occupant} />);

    const label = screen.getByTestId("interior-occupant-name-27");
    expect(label).toHaveTextContent("Mara Ashford");
    expect(label).toHaveAttribute(
      "data-household-member-id",
      "owner-home:servant:0",
    );
  });
});

describe("occupantScenePosition", () => {
  it("returns null when the occupant is OUT that hour", () => {
    const occ = {
      id: 1,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: Array(24).fill(null),
    } as BuildingOccupantRender;
    expect(
      occupantScenePosition(
        occ,
        12,
        { widthFt: 20, depthFt: 30 },
        { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 },
        0,
      ),
    ).toBeNull();
  });

  it("maps a home station through plan-feet then placement", () => {
    const stations = Array(24).fill(null);
    stations[2] = { xFt: 10, yFt: 15, level: 0, activity: "sleeping" };
    const occ = {
      id: 1,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    // Center of a 20ft x 30ft frame → site-local (0,0) → scene (gx,gz).
    // y = surfaceY + level * STOREY_M = 1.0 + 0 * 3.
    const pos = occupantScenePosition(
      occ,
      2,
      { widthFt: 20, depthFt: 30 },
      { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 },
      1.0,
    );
    expect(pos).toEqual({ x: 5, y: 1.0, z: 7 });
  });

  it("lifts an upper-floor station by one storey per level", () => {
    const stations = Array(24).fill(null);
    stations[8] = { xFt: 10, yFt: 15, level: 1, activity: "working" };
    const occ = {
      id: 2,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    const pos = occupantScenePosition(
      occ,
      8,
      { widthFt: 20, depthFt: 30 },
      { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 },
      1.0,
    );
    // level 1 → surfaceY (1.0) + 1 * STOREY_M (3) = 4.0.
    expect(pos).toEqual({ x: 5, y: 4.0, z: 7 });
  });

  it("wraps the hour into 0-23 before indexing the station table", () => {
    const stations = Array(24).fill(null);
    stations[2] = { xFt: 10, yFt: 15, level: 0, activity: "sleeping" };
    const occ = {
      id: 3,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    // 26 wraps to 2; -22 wraps to 2. Both resolve the 02:00 station.
    const placement = { gx: 5, gz: 7, rotationY: 0, doorZSign: -1 } as const;
    const frame = { widthFt: 20, depthFt: 30 };
    expect(occupantScenePosition(occ, 26, frame, placement, 1.0)).toEqual({
      x: 5,
      y: 1.0,
      z: 7,
    });
    expect(occupantScenePosition(occ, -22, frame, placement, 1.0)).toEqual({
      x: 5,
      y: 1.0,
      z: 7,
    });
  });

  it("applies the site placement (offset frame maps a corner station off-origin)", () => {
    const stations = Array(24).fill(null);
    // Min corner of the frame (0,0 ft) → site-local (-w/2,-d/2) meters.
    stations[3] = { xFt: 0, yFt: 0, level: 0, activity: "idle" };
    const occ = {
      id: 4,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
    const FT = 0.3048;
    const pos = occupantScenePosition(
      occ,
      3,
      { widthFt: 20, depthFt: 30 },
      { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 },
      0,
    )!;
    // local x = (0 - 10) * FT = -10 FT; local z = (0 - 15) * FT = -15 FT.
    // doorZSign -1 → lz = localZ * 1 = -15 FT; no rotation → scene = local.
    expect(pos.x).toBeCloseTo(-10 * FT, 6);
    expect(pos.z).toBeCloseTo(-15 * FT, 6);
    expect(pos.y).toBe(0);
  });
});

describe("occupantMotionAtClock", () => {
  /** Build a resident with two different consecutive in-house stations. */
  const movingOccupant = (): BuildingOccupantRender => {
    const stations = Array(24).fill(null);
    stations[7] = { xFt: 5, yFt: 15, level: 0, activity: "sleeping" };
    stations[8] = { xFt: 15, yFt: 15, level: 0, activity: "working" };
    return {
      id: 8,
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    } as BuildingOccupantRender;
  };

  const frame = { widthFt: 20, depthFt: 30 };
  const placement = { gx: 0, gz: 0, rotationY: 0, doorZSign: -1 } as const;

  it("starts the new hour at the previous station and walks toward the destination", () => {
    const start = occupantMotionAtClock(
      movingOccupant(),
      8,
      frame,
      placement,
      0,
    )!;
    const halfway = occupantMotionAtClock(
      movingOccupant(),
      8 + INTERIOR_WALK_FRACTION / 2,
      frame,
      placement,
      0,
    )!;

    // The 07:00 and 08:00 stations sit five feet left/right of the frame
    // center. Halfway through the walk, the resident crosses that center.
    expect(start.position.x).toBeCloseTo(-5 * 0.3048, 6);
    expect(start.moving).toBe(true);
    expect(halfway.position.x).toBeCloseTo(0, 6);
    expect(halfway.moving).toBe(true);
    expect(halfway.rotationY).toBeCloseTo(Math.PI / 2, 6);
  });

  it("settles at the current station after the half-hour travel window", () => {
    const settled = occupantMotionAtClock(
      movingOccupant(),
      8 + INTERIOR_WALK_FRACTION,
      frame,
      placement,
      0,
    )!;

    expect(settled.position.x).toBeCloseTo(5 * 0.3048, 6);
    expect(settled.moving).toBe(false);
    expect(settled.rotationY).toBe(placement.rotationY);
  });

  it("does not invent an interior route when the previous slot was OUT", () => {
    const occ = movingOccupant();
    occ.stationsByHour[7] = null;
    const arrived = occupantMotionAtClock(occ, 8.1, frame, placement, 0)!;

    // Exterior travel belongs to the street-agent route. Once the household
    // schedule says HOME, the interior figure appears at its real station.
    expect(arrived.position.x).toBeCloseTo(5 * 0.3048, 6);
    expect(arrived.moving).toBe(false);
  });

  it("remains absent when the current schedule slot is OUT", () => {
    const occ = movingOccupant();
    occ.stationsByHour[8] = null;
    expect(occupantMotionAtClock(occ, 8.1, frame, placement, 0)).toBeNull();
  });

  it("hands the resident through the canonical door on leaving and entering", () => {
    const occ = movingOccupant();
    occ.stationsByHour[8] = null;
    occ.stationsByHour[9] = {
      xFt: 15,
      yFt: 15,
      level: 0,
      activity: "home",
    };
    const door = occupantDoorScenePosition(frame, placement, 0);
    const leaving = occupantMotionAtClock(occ, 7.75, frame, placement, 0, door)!;
    const entering = occupantMotionAtClock(occ, 9, frame, placement, 0, door)!;

    expect(leaving.position.z).toBeCloseTo(door.z / 2, 6);
    expect(leaving.moving).toBe(true);
    expect(entering.position).toEqual(door);
    expect(entering.moving).toBe(true);
    expect(residentRenderOwnerAtClock(occ, 7.999)).toBe("interior");
    expect(residentRenderOwnerAtClock(occ, 8)).toBe("street");
    expect(residentRenderOwnerAtClock(occ, 9)).toBe("interior");
  });
});

describe("resident handoff ownership", () => {
  const joinedOccupant = (): BuildingOccupantRender => {
    const stations = Array(24).fill(null);
    stations[7] = { xFt: 10, yFt: 15, level: 0, activity: "meal" };
    return {
      burgId: 314,
      id: 4,
      name: "Mara Ashford",
      householdMemberId: "home-10:head",
      ageBand: "adult",
      body: {} as never,
      stationsByHour: stations,
    };
  };

  const loadedWith = (occupants: BuildingOccupantRender[]): LoadedChunk[] =>
    ([
      {
        cx: 0,
        cy: 0,
        lod: "full",
        bundle: {
          cx: 0,
          cy: 0,
          terrain: {} as never,
          sites: [
            {
              id: "wf-plot-314-10",
              kind: "ruin",
              localX: 0,
              localZ: 0,
              surfaceY: 0,
              radius: 1,
              walled: false,
              occupants,
            },
          ],
        },
      },
    ] as LoadedChunk[]);

  it("conserves population while ownership crosses the hour boundary", () => {
    const occupant = joinedOccupant();
    const handoffs = collectResidentHandoffIndex(loadedWith([occupant]));
    const roster: TownRoster = {
      burgId: 314,
      occupants: [
        {
          id: 4,
          name: occupant.name,
          householdMemberId: occupant.householdMemberId,
          ageBand: "adult",
          homePlotId: 10,
          occupation: "resident",
        },
        {
          id: 5,
          name: "Unjoined Neighbor",
          ageBand: "adult",
          homePlotId: 10,
          occupation: "resident",
        },
      ],
    };
    const nodes = roster.occupants.map(
      (member) =>
        ({
          burgId: 314,
          occupantId: member.id,
          name: member.name,
          xM: 0,
          zM: 0,
          moving: false,
          activity: "home",
          gridX: 0,
          gridY: 0,
          surfaceY: 0,
        }) satisfies GroundAgentSceneNode,
    );

    const atHomeStreet = streetOwnedAgentNodes(nodes, [roster], handoffs, 7);
    const outStreet = streetOwnedAgentNodes(nodes, [roster], handoffs, 8);
    expect(atHomeStreet.map((node) => node.occupantId)).toEqual([5]);
    expect(outStreet.map((node) => node.occupantId)).toEqual([4, 5]);
    expect(atHomeStreet.length + 1).toBe(roster.occupants.length);
    expect(outStreet.length + 0).toBe(roster.occupants.length);
  });

  it("publishes the h8 override before resident actors read their owner", () => {
    const occupant = joinedOccupant();
    let observedOwner = "unread";
    frameSubscriptions.length = 0;

    const OwnerProbe = () => {
      const clockRef = useInteriorClockRef();
      useFrame(() => {
        observedOwner = residentRenderOwnerAtClock(
          occupant,
          readInteriorActorClock(clockRef),
        );
      });
      return null;
    };

    render(
      <InteriorHourProvider clock={7}>
        <OwnerProbe />
      </InteriorHourProvider>,
    );
    (window as typeof window & { __wfAgentClock?: number }).__wfAgentClock = 8;

    // Even if a renderer invokes the actor before context propagation, it must
    // read the same direct override as GroundAgents and release ownership on
    // this very first h8 frame.
    act(() => {
      frameSubscriptions.find(({ priority }) => priority === 0)?.callback();
    });
    expect(observedOwner).toBe("street");

    // The provider also runs early so its ordinary fractional ref is current
    // before the remaining default-priority consumers execute.
    act(() => {
      [...frameSubscriptions]
        .sort((left, right) => left.priority - right.priority)
        .forEach(({ callback }) => callback());
    });

    expect(frameSubscriptions.some(({ priority }) => priority === -100)).toBe(
      true,
    );
    expect(observedOwner).toBe("street");
    delete (window as typeof window & { __wfAgentClock?: number })
      .__wfAgentClock;
  });

  it("suppresses duplicate packets for the same stable household member", () => {
    const occupant = joinedOccupant();
    const duplicate = { ...occupant };
    const index = collectResidentHandoffIndex(loadedWith([occupant, duplicate]));
    expect(index.size).toBe(1);
    expect([...index.values()][0]?.stableKey).toBe("314:home-10:head");
  });

  it("chooses the same duplicate owner when replay loads chunks in reverse order", () => {
    const occupant = joinedOccupant();
    const first = loadedWith([occupant])[0]!;
    const second = {
      ...loadedWith([{ ...occupant, name: "Wrong Duplicate" }])[0]!,
      cx: 1,
      bundle: {
        ...loadedWith([{ ...occupant, name: "Wrong Duplicate" }])[0]!.bundle,
        cx: 1,
      },
    };
    const forward = collectResidentHandoffIndex([first, second]);
    const replayed = collectResidentHandoffIndex([second, first]);

    expect([...forward.values()][0]?.occupant.name).toBe("Mara Ashford");
    expect([...replayed.values()][0]?.occupant.name).toBe("Mara Ashford");
    expect([...replayed.keys()]).toEqual([...forward.keys()]);
  });

  it("keeps one R3F group mounted while visibility, transform, and gait change", () => {
    const group = {
      visible: false,
      position: { set: vi.fn() },
      rotation: { set: vi.fn() },
    };
    const motionRef = { current: { moving: false } };
    applyInteriorOccupantMotion(
      group as never,
      motionRef,
      {
        position: { x: 2, y: 3, z: 4 },
        rotationY: 1.25,
        moving: true,
      },
    );
    expect(group.visible).toBe(true);
    expect(group.position.set).toHaveBeenCalledWith(2, 3, 4);
    expect(group.rotation.set).toHaveBeenCalledWith(0, 1.25, 0);
    expect(motionRef.current.moving).toBe(true);

    applyInteriorOccupantMotion(group as never, motionRef, null);
    expect(group.visible).toBe(false);
    expect(motionRef.current.moving).toBe(false);
    expect(group.position.set).toHaveBeenCalledTimes(1);
  });

  it("advances one mounted actor set from 10 to 6 to 2 visible owners", () => {
    const motion = {
      position: { x: 1, y: 2, z: 3 },
      rotationY: 0,
      moving: false,
    };
    const actors = Array.from({ length: 10 }, (_, index) => {
      const stations = Array(24).fill({
        xFt: 5,
        yFt: 5,
        level: 0,
        activity: "work",
      });
      const interiorOwnedByHour = Array(24).fill(false);
      interiorOwnedByHour[7] = true;
      interiorOwnedByHour[8] = index < 6;
      interiorOwnedByHour[9] = index < 2;
      return {
        occupant: {
          burgId: 14,
          id: index,
          name: `Resident ${index}`,
          householdMemberId: `b1:member:${index}`,
          ageBand: "adult",
          body: {} as never,
          stationsByHour: stations,
          interiorOwnedByHour,
        } satisfies BuildingOccupantRender,
        group: {
          visible: false,
          position: { set: vi.fn() },
          rotation: { set: vi.fn() },
        },
        motionRef: { current: { moving: false } },
      };
    });

    const visibleCounts = [7, 8, 9].map((clock) => {
      for (const actor of actors) {
        applyInteriorResidentFrame(
          actor.group as never,
          actor.motionRef,
          actor.occupant,
          clock,
          motion,
        );
      }
      return actors.filter(({ group }) => group.visible).length;
    });

    // The same ten mounted groups persist; only canonical ownership changes.
    // Non-null authored work poses cannot keep a street-owned body visible.
    expect(visibleCounts).toEqual([10, 6, 2]);
    expect(actors).toHaveLength(10);
  });
});

describe("selectInteriorBodyKeys", () => {
  it("keeps only the nearest bounded set in a dense town block", () => {
    // Twenty residents all fit inside the close-detail radius. Only the ten
    // nearest may receive live generated bodies; the rest remain simulated.
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      key: `resident-${index}`,
      x: index + 1,
      y: 0,
      z: 0,
    }));
    const selected = selectInteriorBodyKeys(
      candidates,
      { x: 0, y: 0, z: 0 },
      new Set(),
    );

    expect(selected.size).toBe(MAX_LIVE_INTERIOR_BODIES);
    expect([...selected]).toEqual(
      Array.from({ length: 10 }, (_, index) => `resident-${index}`),
    );
  });

  it("uses a wider exit radius for an already-visible resident", () => {
    // A new body 20 m away stays hidden (outside the 18 m enter radius), while
    // an existing one at the same distance survives until it crosses 24 m.
    const candidate = [{ key: "resident", x: 20, y: 0, z: 0 }];
    expect(
      selectInteriorBodyKeys(candidate, { x: 0, y: 0, z: 0 }, new Set()).size,
    ).toBe(0);
    expect(
      selectInteriorBodyKeys(
        candidate,
        { x: 0, y: 0, z: 0 },
        new Set(["resident"]),
      ).has("resident"),
    ).toBe(true);
  });

  it("treats an overhead camera as far from ground-floor residents", () => {
    const candidate = [{ key: "resident", x: 0, y: 0, z: 0 }];
    expect(
      selectInteriorBodyKeys(candidate, { x: 0, y: 35, z: 0 }, new Set()).size,
    ).toBe(0);
  });

  it("keeps every HOME owner ahead of nearer OUT continuity actors", () => {
    const selected = selectInteriorBodyKeys(
      [
        { key: "out-near-1", x: 1, y: 0, z: 0, interiorOwned: false },
        { key: "out-near-2", x: 2, y: 0, z: 0, interiorOwned: false },
        { key: "home-far-1", x: 8, y: 0, z: 0, interiorOwned: true },
        { key: "home-far-2", x: 9, y: 0, z: 0, interiorOwned: true },
      ],
      { x: 0, y: 0, z: 0 },
      new Set(),
      2,
    );

    // A fresh selection spends its scarce slots on visible HOME residents,
    // even when OUT doorway placeholders are geometrically closer.
    expect([...selected]).toEqual(["home-far-1", "home-far-2"]);
  });

  it("preserves the eligible mounted cohort before admitting new HOME actors", () => {
    const previous = new Set(["prior-home", "prior-out"]);
    const selected = selectInteriorBodyKeys(
      [
        { key: "prior-home", x: 12, y: 0, z: 0, interiorOwned: true },
        { key: "prior-out", x: 13, y: 0, z: 0, interiorOwned: false },
        { key: "new-home", x: 1, y: 0, z: 0, interiorOwned: true },
      ],
      { x: 0, y: 0, z: 0 },
      previous,
      2,
    );

    // Both prior groups remain inside the wider exit radius, so lifecycle
    // continuity wins until one actually leaves hysteresis eligibility.
    expect([...selected]).toEqual(["prior-home", "prior-out"]);
  });
});
