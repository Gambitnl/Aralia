/**
 * @file scenarios.test.ts — the visual-test scenario registry is well-formed.
 * A broken scenario should fail here, not silently skip in the runner.
 */
import { describe, it, expect } from "vitest";
import { SCENARIOS, validateScenarios, type VisScenario } from "../scenarios";

const GROUPS = ["entities", "combat", "world", "interiors", "crowds"] as const;

describe("vistest scenario registry", () => {
  it("has scenarios and validateScenarios finds no problems", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(8);
    expect(validateScenarios(SCENARIOS)).toEqual([]);
  });

  it("keeps the authored hostile opening in the permanent visual harness", () => {
    const opening = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-hostile-opening",
    );

    expect(opening?.url).toContain("scenario=legium-hostile-opening");
    expect(
      opening?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("opening-threat-body") &&
          step.expr.includes("opening-threat-carried-salvage-pack") &&
          step.expr.includes("Body silhouettes4 authored / 4 postures") &&
          step.expr.includes("opening-track-trail") &&
          step.expr.includes("opening-terrain-imprint") &&
          step.expr.includes("territorial-scrape") &&
          step.expr.includes(
            "flattened-ground / trampled-run / drag-furrow / refuse-scatter",
          ) &&
          step.expr.includes("opening-monster-site") &&
          step.expr.includes("scenario-opening-source-facts"),
      ),
    ).toBe(true);
  });

  it("keeps the resolved opening return in the permanent visual harness", () => {
    const aftermath = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-hostile-opening-aftermath",
    );

    expect(aftermath?.url).toContain(
      "scenario=legium-hostile-opening-aftermath",
    );
    expect(
      aftermath?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("Source enemy positions2 physical / 4 resolved") &&
          step.expr.includes("downed / withdrew / withdrew / downed") &&
          step.expr.includes("opening-combat-disturbance") &&
          step.expr.includes("opening-aftermath-body-fact") &&
          step.expr.includes("abandoned-disturbed") &&
          step.expr.includes("bodies.length === 2"),
      ),
    ).toBe(true);
  });

  it("requires 3D aftermath facts and a nonblank canvas before readback", () => {
    const aftermath3D = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-hostile-opening-aftermath-3d",
    );

    expect(aftermath3D?.url).toContain("render=3d");
    expect(
      aftermath3D?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("opening-threat-scene-3d-facts") &&
          step.expr.includes("data-body-count") &&
          step.expr.includes("data-terrain-imprint-count") &&
          step.expr.includes("abandoned-disturbed") &&
          step.expr.includes("data-has-disturbance") &&
          step.expr.includes("data-focus-ground-y") &&
          step.expr.includes("poseAtHeight"),
      ),
    ).toBe(true);
    expect(
      aftermath3D?.capture.some(
        (step) =>
          step.kind === "eval" &&
          step.js.includes("missing canvas contrast") &&
          step.js.includes("missing opening scene meshes") &&
          step.js.includes("sceneBreakdown") &&
          step.js.includes("api.capture"),
      ),
    ).toBe(true);
    expect(
      aftermath3D?.capture.some(
        (step) =>
          step.kind === "eval" &&
          step.js.includes("missing camera movement") &&
          step.js.includes("poseAtHeight"),
      ),
    ).toBe(true);
    expect(aftermath3D?.capture.at(-1)?.kind).toBe("readback");
  });

  it("keeps relative river-bank elevation in the permanent visual harness", () => {
    const elevation = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-river-elevation",
    );

    expect(elevation?.url).toContain("scenario=river-bridge-crossing");
    expect(
      elevation?.capture.some(
        (step) =>
          step.kind === "eval" &&
          step.js.includes("data-relative-elevation-feet") &&
          step.js.includes("missing raised terrain probe"),
      ),
    ).toBe(true);
    expect(
      elevation?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("battle-map-elevation-readout") &&
          step.expr.includes("Math.min(...heights) === 0") &&
          step.expr.includes("data-tile-height-feet") &&
          step.expr.includes("data-reference-height-feet") &&
          step.expr.includes("data-relative-height-feet") &&
          step.expr.includes("tileFeet - referenceFeet === relativeFeet") &&
          step.expr.includes("This tile") &&
          step.expr.includes("Dev Player") &&
          step.expr.includes("Map floor") &&
          step.expr.includes("0 ft is the lowest visible ground") &&
          step.expr.includes("Each contour is a 5 ft step") &&
          step.expr.includes("elevation-legend") &&
          step.expr.includes("Elev:"),
      ),
    ).toBe(true);
  });

  it("keeps the authored-town no-roster boundary in the permanent visual harness", () => {
    const sourceGap = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-authored-town-watch-gap",
    );

    expect(sourceGap?.url).toContain("dev_static_town_watch_source_gap=1");
    expect(
      sourceGap?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("authored-town-watch-no-worldforge-location") &&
          step.expr.includes("Not fabricated") &&
          step.expr.includes("WorldForge cell") &&
          step.expr.includes("!document.body.textContent?.includes('Turn Order')"),
      ),
    ).toBe(true);
  });

  it("keeps both remaining unsupported launchers in the permanent visual harness", () => {
    const seaGap = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-sea-encounter-gap",
    );
    const simulationGap = SCENARIOS.find(
      (scenario) => scenario.id === "combat-world-location-free-encounter-gap",
    );

    expect(seaGap?.url).toContain("dev_sea_encounter_source_gap=1");
    expect(
      seaGap?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("sea-encounter-no-worldforge-battlefield") &&
          step.expr.includes("vessel deck geometry") &&
          step.expr.includes("!text.includes('Bandit')"),
      ),
    ).toBe(true);

    expect(simulationGap?.url).toContain(
      "dev_location_free_encounter_source_gap=1",
    );
    expect(
      simulationGap?.capture.some(
        (step) =>
          step.kind === "waitHook" &&
          step.expr.includes("location-free-simulation-no-worldforge-location") &&
          step.expr.includes("selected WorldForge cell") &&
          step.expr.includes("Not fabricated"),
      ),
    ).toBe(true);
  });

  it("ids are unique and kebab-case", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("urls are relative (no leading slash, no host)", () => {
    for (const s of SCENARIOS) {
      expect(s.url.startsWith("/"), `${s.id} url has leading slash`).toBe(
        false,
      );
      expect(s.url.includes("://"), `${s.id} url has a host`).toBe(false);
    }
  });

  it("every capture recipe ends with exactly one terminal step", () => {
    for (const s of SCENARIOS) {
      expect(s.capture.length, `${s.id} has an empty recipe`).toBeGreaterThan(
        0,
      );
      const terminals = s.capture.filter(
        (c) => c.kind === "readback" || c.kind === "screenshot",
      );
      expect(
        terminals.length,
        `${s.id} must have exactly one terminal step`,
      ).toBe(1);
      const last = s.capture[s.capture.length - 1];
      expect(
        last.kind === "readback" || last.kind === "screenshot",
        `${s.id} terminal step must be last`,
      ).toBe(true);
    }
  });

  it("waitHook/eval steps carry non-empty code", () => {
    for (const s of SCENARIOS) {
      for (const step of s.capture) {
        if (step.kind === "waitHook")
          expect(
            step.expr.trim().length,
            `${s.id} empty waitHook`,
          ).toBeGreaterThan(0);
        if (step.kind === "eval")
          expect(step.js.trim().length, `${s.id} empty eval`).toBeGreaterThan(
            0,
          );
      }
    }
  });

  it("groups are from the fixed set and notes are present", () => {
    for (const s of SCENARIOS) {
      expect(GROUPS).toContain(s.group);
      expect(s.notes.trim().length, `${s.id} has no notes`).toBeGreaterThan(10);
    }
  });

  it("validateScenarios reports duplicates and bad recipes", () => {
    const bad: VisScenario[] = [
      {
        id: "dup",
        title: "A",
        group: "world",
        url: "x.html",
        notes: "long enough note here",
        capture: [{ kind: "readback" }],
      },
      {
        id: "dup",
        title: "B",
        group: "world",
        url: "/abs.html",
        notes: "long enough note here",
        capture: [],
      },
    ];
    const problems = validateScenarios(bad);
    expect(problems.some((p) => p.includes("duplicate"))).toBe(true);
    expect(problems.some((p) => p.includes("leading slash"))).toBe(true);
    expect(problems.some((p) => p.includes("terminal"))).toBe(true);
  });
});

// --- runner pure helpers ----------------------------------------------------
import { scenarioUrl, captureCommand, outputPath } from "../runnerCore";

describe("vistest runner helpers", () => {
  const s: VisScenario = {
    id: "demo-one",
    title: "Demo",
    group: "world",
    url: "misc/design.html?step=vistest",
    notes: "long enough note here",
    capture: [{ kind: "screenshot" }],
  };

  it("joins base and relative url without double slashes", () => {
    expect(scenarioUrl("http://localhost:5174/Aralia/", s)).toBe(
      "http://localhost:5174/Aralia/misc/design.html?step=vistest",
    );
    expect(scenarioUrl("http://localhost:5174/Aralia", s)).toBe(
      "http://localhost:5174/Aralia/misc/design.html?step=vistest",
    );
  });

  it("builds the copyable capture command", () => {
    expect(captureCommand(s)).toBe(
      "npx tsx tools/vistest/shoot.ts --only demo-one",
    );
  });

  it("builds the output path from the id", () => {
    expect(outputPath(".agent/vistest/captures", s)).toBe(
      ".agent/vistest/captures/demo-one.png",
    );
  });
});
