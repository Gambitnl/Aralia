# Text-to-creature: describe any monster, get a 3D body

**Date:** 2026-07-15
**Status:** approved design (Remy, this session)
**Builds on:** `src/systems/entities3d/` body v2 (segment bodies, spec `2026-07-15-entity-body-v2-segments-design.md`)

## Purpose

Races and classes stay precomputed — the existing deterministic recipes are instant at game start and cover every playable combination. The monster space is different: nobody can hand-model every D&D monster. This feature adds an on-the-fly builder: type a description ("a three-headed serpent with vestigial wings"), an LLM writes a **body plan** in a constrained JSON language, and the existing segment pipeline builds a walking, animated creature from it.

Every generated monster is stored in a **creature library** for review. Approved plans become known entities: shippable data the game compiles with zero LLM involvement. Design a dragon once, iterate on it in the library, then it is simply known.

## Non-goals (this slice)

- No in-game generation path. The brain here is the Claude CLI on the dev machine; which brain serves live gameplay is a separate later decision.
- No PixVerse integration yet. Another agent is adding the PixVerse CLI to the Agent Matrix; a later slice can add a "reference clip" button to the library review panel (video reference of the described monster next to our build). Free credits are limited — keep it out of the core loop.
- No manual JSON editing UI. Iteration happens by revise-notes (below); a plan editor can come later.
- No changes to race/class humanoid generation.

## Flow

1. The entity forge (`design.html?step=entityforge`) gains a **Describe** mode: textarea + **Imagine** button + status line.
2. Submit → `POST /devhub/api/creature-plan { text }` on the vite dev server.
3. The route spawns the Claude CLI (`claude -p`, model `claude-fable-5`, medium reasoning effort) with the body-plan schema, authoring rules, and the description. Output format: JSON.
4. The plan is validated against hard ranges. Invalid → ONE retry with the named validation errors appended to the prompt. Still invalid → the UI shows the errors verbatim (no fallback, no silent clamping).
5. Valid plans are stored in the library (status `generated`) and returned; the forge compiles the plan to an `EntityBlueprint` and the creature walks onto the yard. Wireframe/solid, action states, and the entity debugger all work unchanged.
6. Same description → same creature: the route returns the stored plan for an exact text match instead of re-asking the LLM.

## The body-plan language

What the LLM writes. Motion is **not** in the schema — animation derives from appendage kind, keeping the LLM out of tuning.

```ts
interface CreaturePlan {
  name: string;                        // 1–40 chars, display name
  frame: {
    heightFt: number;                  // 0.5–30 standing height
    lengthFt?: number;                 // 1–60 nose-to-tail; required for horizontal/serpentine
    bulk: number;                      // 0–1 radius scale
    stance: 'upright' | 'horizontal' | 'serpentine' | 'floating';
  };
  spine: {
    segments: number;                  // 2–8
    taper: number;                     // 0.3–1 rear/front radius ratio
    arch: number;                      // -0.5–0.5 curvature
  };
  appendages: Appendage[];             // 0–12 entries (0 = a serpent/ooze body)
  heads: Head[];                       // 1–5
  palette: {
    bodyHex: string;                   // #rrggbb
    accentHex?: string;
    bellyHex?: string;
    eyeHex: string;
  };
  garnish?: Array<{                    // 0–8, optional known parts (horns, shells, weapons)
    partId: string;                    // must exist in the part registry
    params?: Record<string, number>;
  }>;
}

interface Appendage {
  kind: 'leg' | 'arm' | 'tail' | 'tentacle' | 'neck' | 'wing';
  attach: number;                      // 0 (spine front) – 1 (spine rear)
  heightFrac?: number;                 // 0–1 attachment height on the body; default per kind
  perSide?: boolean;                   // true = mirrored left/right
  count: number;                       // 1–4 (per side when perSide)
  chain: Array<{ lenFt: number; r: number }>;  // 1–8 links; lenFt 0.1–12; r 0.02–1, a fraction of the frame's base body radius (from bulk + heightFt)
}

interface Head {
  neckIndex?: number;                  // index of a 'neck' appendage to ride; omitted = spine front
  sizeScale: number;                   // 0.4–2 of the frame-derived head radius
  eyes: { count: number; sizeScale: number };  // count 0–8; sizeScale 0.4–2
  snout?: { lengthScale: number; droop: number };  // 0.3–2.5 / -0.6–0.8
}
```

**Validation is total and loud:** every numeric field has the hard range above; unknown fields, unknown `partId`s, and `neckIndex` pointing at a non-neck appendage are rejected with a named error each. There is no clamping — a bad plan fails with the full error list (the retry prompt includes it).

## Compilation and the plan driver

- New recipe kind: `{ kind: 'planned', plan: CreaturePlan, seed: string }`. `generateEntityBlueprint` compiles it: feet-canon frame from `heightFt`/`lengthFt`/`bulk`, palette passthrough, garnish → `PartInstance[]`, plus a compiled `planSpec` carried on the blueprint for the driver.
- New gait driver (`plan`) in `three/gaits.ts` consumes `planSpec`:
  - **Spine:** segment chain along the stance axis (upright = vertical torso, horizontal = level, serpentine = ground-level undulation using the tentacle wave math, floating = float-driver bob with no ground contact).
  - **Legs:** treadmill stride (the proven world-pinned math), phase-distributed the way quad/hexapod legs already are; leg chains of 2 links use the existing two-bone knee solve, longer chains distribute bend evenly.
  - **Arms:** counter-swing against the nearest leg phase (biped arm math).
  - **Tails/tentacles:** existing wag/wave chain math from `chainParts`.
  - **Wings:** the flap math wing parts already use.
  - **Necks:** gentle bob; each head = ball + eyes (+ optional snout) at its neck end or the spine front.
- **Anchors:** the compiler maps plan chains onto the standard anchor set (first head → `head`, first arm ends → `handL/handR`, spine rear → `tailRoot`, and so on) so garnish parts, combat overlays, and the debugger anchor overlay work unchanged. Anchors with no plausible source get placed on the spine (documented mapping, not guesswork at runtime).

## The CLI bridge (dev server only)

- A NEW domain module `scripts/vite-plugins/devhub/creaturePlanRoutes.ts` (dispatched by `devHubApiManager.ts` via dynamic import, one added line — the vite-dynamic-import pattern means iterating on the module never restarts the dev server) provides:
  - `POST /devhub/api/creature-plan` `{ text }` → generate (or return exact-text match), store, return `{ entry }`.
  - `POST /devhub/api/creature-plan` `{ reviseId, note }` → load that entry's plan, ask the CLI for a revised plan given the note, store as a new entry with `revisedFrom`, return it.
  - `GET /devhub/api/creature-plans` → the library index.
  - `POST /devhub/api/creature-plan/approve` `{ id }` → flip status to `approved`.
- CLI invocation: `claude -p` with `--model claude-fable-5` and JSON output; medium reasoning effort (exact flag/env resolved at plan time from `claude --help`). Timeout + non-zero exit → error surfaced verbatim in the UI.
- The game never calls this route; it is dev tooling.

## The creature library

- Storage: `src/data/creatures3d/plans/<slug>.json`, one file per entry:
  `{ id, name, slug, description, plan, status: 'generated' | 'approved', createdAt, revisedFrom? }`
  (slug = kebab name + short hash; files are game-importable via `import.meta.glob`).
- Forge **Library** panel: list (name, status, created), click → compile + load on the yard, **Approve** button, **Revise** (note textarea → new linked entry). The debugger accepts `?planId=<id>` to instrument a library creature.
- Approved entries are the "known monsters" set future slices draw from; generated-but-unreviewed entries never reach game surfaces.

## Determinism

The stored plan is the source of truth — compiling it is pure. The recipe `seed` only drives per-instance variation the plan does not specify (blink offsets, idle phase). Same plan + same seed = identical creature.

## Testing

- **Schema:** accept/reject suites per rule (ranges, unknown fields, bad `neckIndex`, unknown `partId`).
- **Compiler:** plan → blueprint invariants (frame in feet canon, anchors all present, garnish resolves).
- **Driver:** for a fixture set of plans — chains emit finite, connected segments across phases; legs alternate; serpentine spines stay at ground height; floating stance never touches ground.
- **Fixtures:** canned plans (dragon, three-headed serpent, tentacled ooze, floating eye) checked into the test tree so no test ever calls the CLI.
- **Route:** tested with a fake CLI runner (inject the spawn function).
- **Visual gate (the real one):** debugger eyeball of the fixture set + fresh generations; captures via the entity debugger; vistest scenario added when `scenarios.ts` unlocks.

## Later slices

1. In-game generation path (brain choice: router models vs a queued dev-side service).
2. PixVerse reference clips in the review panel (via the Agent Matrix integration another agent is building).
3. **Meshy hero-look slice (Remy, 2026-07-15):** for *approved* library creatures, an optional text-to-3D sculpted mesh via Meshy (https://www.meshy.ai, text-to-3D mode) imported as the creature's look, draped on the segment skeleton where riggable. Plans remain the animated source of truth for the long tail; Meshy is the premium look for hero monsters. Needs Remy's account/credits; style-fit eyeball is the gate.
4. **Kimodo motion-library slice (Remy, 2026-07-16):** text-to-motion for HUMANOID bodies via NVIDIA Kimodo (reference wrapper: https://github.com/rehan-remade/nvidia-kimodo — fal serverless, 77-joint SOMA skeleton). Bake named motion clips (attacks, dodges, emotes) offline, retarget SOMA joints onto the segment skeleton (hips/knees/shoulders/elbows/head), store in the creature library with the same review/approve flow. Complements — does not replace — the plan driver (Kimodo cannot animate non-humanoids). Repo has no license; treat as technique reference, and mind NVIDIA's model terms. Needs a fal account.
5. Manual plan editing UI in the debugger.
6. Monster-stat linkage (auto-generate a plan when an unknown monster type spawns in combat).
