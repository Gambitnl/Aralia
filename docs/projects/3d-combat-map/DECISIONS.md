# 3D Combat Map Decisions

Status: active
Last updated: 2026-06-10

Use this file for durable choices that affect project scope, required documentation,
or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and
re-openable workflow deltas in `TRACKER.md`/`GAPS.md`.

## Decision Log

### D10: Forbid visual fallback substitutes in renderer proof

Date: 2026-06-10

Owner: Codex

Decision point:
Visual fallback systems can hide the actual renderer, shader, asset, or lifecycle
failure and produce misleading acceptance evidence.

Decision made:
- Do not accept a visual fallback substitute as proof that the 3D combat renderer
  works.
- A blank-safe placeholder, alternate 2D render, simplified visual mode, hidden
  error boundary, or degraded substitute must count as a failed visual proof if
  it replaces the intended 3D surface.
- Diagnostic loading/error text is allowed only to expose the failure and preserve
  user recovery; it does not satisfy visual acceptance criteria.

Rationale and evidence:
- NC1/NC2 are meant to prove the live `BattleMap3D`/`CombatView` path. A fallback
  image or substitute renderer would obfuscate the exact WebGL, postprocessing,
  shader, or mount failure those checks are supposed to reveal.
- The project already requires console sweeps and canvas-vs-error-boundary checks;
  this decision makes the failure semantics explicit.

Follow-up:
- Future harnesses should capture the failing state, console output, and renderer
  profile instead of swapping in a successful-looking visual fallback.

### D9: Import only actor-readability gaps from AAA-lite research

Date: 2026-06-10

Owner: Codex

Decision point:
An external research report proposed outlines/rim lights, SSAO/N8AO, status/death visuals, idle animation, biome lighting, terrain micro-upgrades, foliage wind, tactical spawn placement, and 2D-to-3D transition work.

Decision made:
- Import only the remaining combat-3D actor readability items into this project: character silhouette pop and 3D status/defeat readability proof.
- Do not import the SSAO/N8AO recommendation; the current code intentionally removed the unstable SSAO/NormalPass path and uses ContactShadows for ground darkening.
- Do not open duplicate terrain, foliage, idle, or baseline lighting gaps from that report because current source already contains Aralia-specific implementations of slope rock, wet banks, macro terrain noise, grass wind, idle phases, and biome lighting.

Rationale and evidence:
- `src/components/BattleMap/BattleMap3D.tsx` documents the SSAO/NormalPass failure and current Bloom/Vignette/ContactShadows stack.
- `src/components/BattleMap/terrain/TerrainMesh.tsx` already implements slope-exposed rock and wet-bank darkening.
- `src/components/BattleMap/terrain/GrassLayer.tsx` already implements instanced grass with shader wind.
- `src/components/BattleMap/characters/CharacterActor.tsx` already implements per-character idle phase and defense badges but still lacks a durable proof for unselected-character silhouette readability and 3D condition/death readability at tactical zoom.

Mutation performed:
- Added `G9` and `G10` to `docs/projects/3d-combat-map/GAPS.md`.

Follow-up:
- Future implementation should verify rendered output before claiming a readability fix, and should keep SSAO/N8AO excluded unless a new renderer profile proves it stable on the current stack.

### D8: Close G8 required-doc accounting gap

Date: 2026-06-08

Owner: gpt-5.3-codex-spark / MCP-subagent

Decision point:
`NORTH_STAR.md` currently requires `DECISIONS.md` and `RUNBOOK.md` in
`required_docs`, but neither file was present in `docs/projects/3d-combat-map`.

Options considered:
- Remove both files from `required_docs`, which would keep the project compliant
  with its present docs but would lower the declared surface for durable evidence.
- Add concise stubs for both docs to preserve the declared contract and keep the
  living-project handoff surface complete.

Decision made:
- Add short `DECISIONS.md` and `RUNBOOK.md` stubs so required-doc accounting
  is explicit and audit-clean.

Rationale and evidence:
- `docs/projects/3d-combat-map/NORTH_STAR.md` `required_docs` currently includes
  both files.
- The folder did not contain either file, causing `missingDeclaredDocs` in the
  project audit.
- Preserving declared required docs is lower-risk than shrinking requirements in a
  live-facing project contract.

Mutation performed:
- Added `docs/projects/3d-combat-map/DECISIONS.md` and
  `docs/projects/3d-combat-map/RUNBOOK.md`.
- Updated `GAPS.md`, `TRACKER.md`, and `NORTH_STAR.md` to mark G8 as complete.

Resulting status:
- G8 required-doc accounting is now closed.

Follow-up:
- Keep `docs/projects/3d-combat-map/DECISIONS.md` and `RUNBOOK.md` present and
  in sync with `required_docs`.
