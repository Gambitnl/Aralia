# World 3D UI Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D4: Receive the ThreeD Modal merge — single owner of all 3D entrypoints

Date: 2026-06-10

Owner: Remy (project owner), batched decision session

Decision point:
Should ThreeD Modal remain a separate UX entrypoint owner, or merge into World 3D UI? (Recorded here from the receiving side; the merged project records the same decision in `docs/projects/three-d-modal/DECISIONS.md` D2.)

Decision made:
World 3D UI becomes the single owner of all 3D entrypoints — modal launch, phase transition, and close/focus policy — including the legacy `ThreeDModal` entrypoint contracts (`src/components/ThreeDModal/*`, `GameModals`/`SubmapPane` entry paths, `isThreeDVisible`/`TOGGLE_THREE_D_VISIBILITY` wiring). `docs/projects/three-d-modal` becomes merged-reference.

Rationale and evidence:
- The June 2026 campaign needs one owner for 3D entry/exit semantics; W3DUI-22 already gated the legacy modal against the streamed `worldViewMode` path, so the entrypoint contracts were converging here in practice.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D5).

Follow-up:
Triage the inherited three-d-modal open items (entry/close/focus policy, shared `onMove` contract, submap 3D test coverage, CMA-G14 split route) into W3DUI gap rows when scheduling work; keep `docs/projects/three-d-modal` frozen as merged-reference.

### D3: Forbid visual fallback substitutes as transition proof

Date: 2026-06-10

Owner: Codex

Decision point:
World/transition rendering can look "safe" if failures are hidden behind a
placeholder visual, alternate scene, or degraded substitute. That masks the real
camera, streaming, renderer, or lifecycle issue.

Decision made:
- Do not use visual fallback substitutes to satisfy World 3D UI acceptance or
  transition proof.
- Diagnostic loading/error/recovery messages may exist to tell the player what
  failed and how to exit, but they do not prove the intended 3D/atlas transition
  works.
- If the intended visual path fails, capture the failure and renderer/profile
  evidence instead of replacing it with a successful-looking fallback visual.

Rationale and evidence:
- This project owns atlas-to-3D transition clarity. A visual substitute can hide
  missing chunks, bad camera handoff, or failed renderer state, which are the
  actual issues the project must expose.

Follow-up:
Keep older recovery-message work as diagnostic UX only; do not treat it as visual
acceptance for the intended transition path.

### D2: Do not reopen Plan 4 from generic map-to-world research

Date: 2026-06-10

Owner: Codex

Decision point:
The external AAA-lite visual-readability report included 2D map to 3D world zoom-transition recommendations: trigger design, camera dive, LOD/streaming handoff, and position continuity.

Decision made:
Treat that research area as conceptually owned by World 3D UI, but do not open a new broad project gap from it in this pass.

Rationale and evidence:
- `docs/projects/world-3d-ui/NORTH_STAR.md` already defines this surface as the 2D atlas to 3D world transition plus HUD owner.
- `docs/projects/world-3d-ui/GAPS.md` shows Plan 4 transition, marker sync, entry routing, HUD, minimap, and nameplates as complete (`W3DUI-6` through `W3DUI-27` relevant rows).
- The researcher's output was too generic to supersede the existing Aralia-specific transition architecture. Any future work should be framed as a narrow visual-polish or camera-path acceptance issue, not as a duplicate transition project.

Follow-up:
If a future rendered review finds the current cross-fade/entry lacks drama, open a small World 3D UI gap for camera-dive or fog/cloud handoff polish with visual acceptance criteria.

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/world-3d-ui`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-08`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.
