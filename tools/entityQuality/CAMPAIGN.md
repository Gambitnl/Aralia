# Entity quality campaign — operating contract

**Goal.** The procedural entity generator must produce monsters and humanoids at the level of Valheim creatures and WoW monster anatomy. Humanoids must move at Mixamo quality. Every `?step=entitydebug` contact sheet must look shippable. Low-poly is fine. Plastic, balloon-animal, or mannequin reads are failures.

**Authority.** Remy approved this campaign 2026-08-10 with no round limit. A piece is done only when its critic is utterly wowed in a blind side-by-side against the references.

## The pieces

Each piece has one owner file set, one judge axis, and one sheet set. Builders lock their file set via Agora before edits.

| id | scope | primary files | judged on |
|---|---|---|---|
| `humanoid-anatomy` | rest-pose proportions, shoulder/pelvis volumes, limb ratios, hand/foot shapes, neck-head merge | `three/skeletonBuilder.ts` (restPose), `three/smoothBipedGeometry.ts` | idle sheet silhouette + close-ups vs WoW/Valheim humanoids |
| `humanoid-motion` | clip selection, retarget quality, foot planting, arm swing, idle life, transitions | `anim/*`, `three/skinnedClipPlayer.ts`, clip drive path in `assembleEntity.ts` | walk/idle frame strips vs Mixamo reference motion |
| `creature-anatomy` | plan-driven bodies: leg articulation, haunches, spine arcs, head carriage, wing pose. INCLUDES random archetype rolls (Beast/Celestial Large, fixed seeds) — Remy flagged 2026-08-12 that generator defaults produce naked dolls and sausage lizards while the fixtures improve; the default plans must pass the same bar | `three/gaits.ts` (PlanDriver), `textPlan/compilePlan.ts` defaults + archetype plan generation | dragon/serpent/ooze + beast-large/celestial-large sheets vs Valheim creatures |
| `surface-materials` | toon ramp, countershade, outline weight, palette, anti-plastic surface variation | `three/toon.ts`, tube/collar tinting in `three/segmentBody.ts` | all sheets, close-up panels vs both references |
| `coherence` (between waves) | one look across all pieces; kill style drift | read-only pass + smallest unifying edits | the full sheet wall |

## Roles and models

- **Builder** — model `opus` (switched from `fable` 2026-08-12 on a Fable rate limit; two builders died mid-edit). Edits one piece. Reads this file + the latest `verdict.json` for its piece. Fixes THE named gap first. Ends at tests green + fresh sheets captured.
- **Critic** — model `opus` (was `fable`; same rate-limit switch), always a FRESH agent. Reads sheets + references ONLY. Never reads builder notes or diffs. Writes `verdict.json`.
- **Reference collector** — model `haiku`. Mechanical downloads only.
- **Coherence smoother** — model `opus`. Runs between waves across all sheets.

## Critic protocol (binding)

1. Read this file's goal section, the piece's sheets under `public/entity-quality/sheets/<piece>/`, and the references under `.agent/critique-refs/`.
2. Capture a fresh sheet yourself with the capture rig if the newest sheet is older than the newest verdict.
3. Compare blind, side by side: our newest sheet against the closest reference image. State which one looks better and why, in two sentences.
4. If ours loses: name the SINGLE biggest gap. One item, concrete, visual ("thighs read as equal-width tubes; reference thighs taper 2:1 knee to hip").
5. Write `public/entity-quality/verdicts/<piece>.json`:
   `{ "piece", "round", "winner": "ours"|"reference", "wowed": bool, "biggestGap": string|null, "notes": string, "at": iso }`
6. `wowed: true` requires: ours wins or credibly ties the blind comparison, AND you would ship the sheet unchanged. Be harsh. A tie you hesitate on is a loss.

## Builder protocol (binding)

1. Register with Agora (`node tools/agora/client.mjs onboard <handle> --pet <slug>`), lock your piece's file set. If a lock conflicts, reserve and wait — never edit unlocked shared files.
   - Set a per-agent identity dir: `AGORA_DIR=.agent/agora/<your-handle>` on EVERY Agora call. The shared default `client-identity.json` gets overwritten by concurrent agents; one agent's `unlock --mine` then releases another agent's locks (this happened twice).
   - Capture your token at register. Close out token-scoped only: `unlock --mine --token <t>`, `retire --token <t>`.
   - `public/entity-quality/status.json` must stay UTF-8 WITHOUT a BOM. A BOM crashed the capture updater once.
2. Read the latest verdict for your piece. Fix THE named gap before anything else.
3. Constraints that stand: no git commits, no fallbacks, determinism, triangle budgets green (`perfBudget.test.ts`), 2-draw-call skinned bodies, solid-shaded deforming bodies.
4. `npx vitest run src/systems/entities3d` must be green before you finish.
5. Capture fresh sheets: `node tools/entityQuality/capture.mjs <piece>` (needs Remy's :3000 up).
6. Append your round to `public/entity-quality/status.json` (see updater in capture.mjs — pass `--round N --note "..."`).
7. Release locks. Exit with a two-line summary: what changed, which sheets prove it.

## Render lessons (binding for builders)

- The toon shader quantizes shading into few bands. Small geometric displacement produces zero value change and is INVISIBLE at sheet distance. Surface detail must read through VALUE (darker strips, vertex tints, ink lines) or through the SILHOUETTE (edge cuts). Two wing rounds were lost to displacement-only relief.
- Verify at panel resolution, not zoomed. A feature that needs zoom does not exist for the critic.
- When a fix "lands" for the builder but the critic sees nothing twice in a row, the render path eats it — diagnose the shader or the capture, not the geometry.
- The inverse-hull ink outline (hM×0.011) is wider than creases between hand-scale forms: it inks small valleys shut and redraws them as one boulder. Round 16 added a per-vertex `aInk` scale in `toon.ts` (hands carry 0.45). Use it for any small-form detail the outline swallows.
- A feature bend aimed at the camera produces zero silhouette change in that panel. Cock small forms a few degrees so the bend profiles to at least one camera.
- A surface that renders SOLID BLACK with no shading is a winding/culling bug, not a value problem: culled front faces expose the BackSide ink hull. A whole-mesh signed-volume guard passes mixed orientations — test per-face (round 23's `flipTo` in wingParts.ts).
- Every detail part must be a solid 3D form that reads from ALL camera angles (Remy 2026-08-12: pupils and a shoulder ring vanished off-front). Pupils = inset dark spheres or lens bulges, never flat front discs. Collars and rings = closed tori or lofted bands, never one-sided planes. Verify with a 360-degree orbit in the live debugger.

## Rig and pages

- Capture rig: `tools/entityQuality/capture.mjs` — headless Chrome against `http://127.0.0.1:3000`, writes PNGs under `public/entity-quality/sheets/<piece>/round-<N>-<subject>.png`.
- Live progress page: `http://localhost:3000/Aralia/entity-quality/index.html` — reads `status.json` + `verdicts/*.json`, shows the newest sheets per piece. Remy watches this.
- References: `.agent/critique-refs/<source>/*.jpg|png` + `manifest.md` (what each image is). Gitignored; comparison use only — never ship or copy their content into the game.

## Wave order

Wave A runs `humanoid-anatomy` and `creature-anatomy` in parallel (disjoint files). Wave B runs `humanoid-motion` and `surface-materials`. A coherence pass runs between waves and at the end. The loop has no round cap.
