# Submap Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable unresolved findings that genuinely belong to Submap
UI, pre-deprecation extraction, and component ownership. The Submap surface is
not ready for deletion: first inventory dependents, extract retained functions,
and prove replacements. Route generation-internal evidence from the former
Submap Generation lane into this project unless it clearly belongs to a
separate world/town/navigation owner.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/TRACKER.md` | protocol refresh | UI contract for generated output was implicit and required formalization. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Prevents UI from inventing assumptions about generated tile semantics. | Split into G2 and G3 with explicit payload/render ownership questions. | Confirm G2 and G3 tracked in `TRACKER.md`. |
| G2 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/TRACKER.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `src/utils/spatial/submapActionContracts.ts`, `src/utils/spatial/__tests__/submapActionContracts.test.ts`, `DEPENDENCY_CONTRACT.md` | Module and tests exist; SubmapPane still duplicates payload assembly inline. | Wire SubmapPane through shared helpers (G7). | Contract tests green after SubmapPane wiring; handler behavior unchanged. |
| G3 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/TRACKER.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `DEPENDENCY_CONTRACT.md` matrix (18 rows), `rg` scan 2026-06-10 | Primary surfaces classified; secondary callers may still appear in future scans. | Spot-check matrix against new `rg` hits each extraction pass. | Matrix row count and owner routing stay current. |
| G4 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/TRACKER.md` | generation modularization | Submap generation rules are mixed with React/UI projection and may be reusable elsewhere. | `GENERATION_MODULARIZATION.md`, `useSubmapProceduralData.ts` | Plan names extraction path; core module not yet created. | Extract `generateLocalTerrainData` (G8). | Fixture parity for plains/cave/wetland. |
| G7 | active | adjacent_follow_up | future extraction agent | `docs/projects/submap/TRACKER.md` T3 | SubmapPane wiring gap | `submapActionContracts.ts` exists but `SubmapPane.tsx` still builds `QUICK_TRAVEL` and `inspect_submap_tile` payloads inline. | `SubmapPane.tsx` lines 324-363 vs `submapActionContracts.ts` | Duplicate payload rules can drift from the shared contract module during future edits. | Refactor SubmapPane dispatch paths to call `buildQuickTravelPayload` and `buildInspectSubmapTilePayload`. | SubmapPane tests and contract tests both pass; no payload field changes. |
| G8 | active | support_needed_now | future extraction agent | `docs/projects/submap/TRACKER.md` T5 | Generation core not extracted | `useSubmapProceduralData` remains the only orchestration entry for CA/WFC/path/seeded-feature output. | `GENERATION_MODULARIZATION.md`, `useSubmapProceduralData.ts`, `Minimap.tsx` | Minimap and Submap both depend on the React hook; generation cannot be reused without UI coupling. | Create `generateLocalTerrainData` and keep the hook as a thin wrapper. | Fixture parity test for three biome families. |
| G5 | active | in_scope_now | June 2026 campaign (Azgaar-continuation proc-gen submap system) | `docs/projects/submap/TRACKER.md` | replacement surface review | Replacement surface for local navigation is not named. **Decided 2026-06-10 (Remy):** the new Azgaar-continuation proc-gen submap system from the June 2026 campaign is the named replacement; see the campaign context section in `docs/projects/DECISION_BLITZ_2026-06-10.md` (D3). | `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `src/components/Town`; `src/systems/travel`; `docs/projects/DECISION_BLITZ_2026-06-10.md` | Extraction can proceed, but final component deprecation needs a target architecture. The extraction contracts (G7/G8, `submapActionContracts`, DEPENDENCY_CONTRACT.md) are the inventory the new system must honor. | Implementation lane open: build the replacement against the inventoried contracts; component deprecation only after the replacement proves contract coverage. | Replacement implementation demonstrates carried-forward behaviors against DEPENDENCY_CONTRACT.md before any Submap component removal. |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G6 | Code modularization audit routing | `SubmapDoodadPainter.ts` is a large PIXI-backed painter (~817 lines) mixing 21 doodad-type draw methods, a texture cache, emoji-to-doodad mapping, and animation helpers. Submap is a phase-out surface, so painter extraction must preserve the draw-method contracts and texture-cache lifecycle without assuming the caller lives inside the current SubmapPane shell. | `src/components/Submap/painters/SubmapDoodadPainter.ts`; `src/components/Submap/painters/shared.ts`; `docs/projects/submap/DEPENDENCY_CONTRACT.md`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G6 | If the painter is split before the dependent-system inventory (G3) is complete, extracted draw helpers may be deleted or orphaned when the Submap surface is retired. Any split must be additive and prove the texture-cache lifecycle and biome-palette contract are preserved. | Keep this routing-only until G3 (dependent-system inventory) names which draw methods are retained elsewhere; then scope a narrow painter-path extraction with a before/after texture-cache proof. | Painter export map survives submap deprecation path; focused test or proof note shows draw-method output is unchanged after any split. |
| CMA-G16 | not_started | adjacent_follow_up | submap owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G16 | Code modularization audit routing | `SubmapPane.tsx` (~679 lines), `SubmapFeaturePainter.ts` (~667 lines), and `TextureAtlasManager.ts` (~586 lines) form a cluster with legacy/orphan headers and painter helpers; a split needs painter parity and atlas contract preservation. | `src/components/Submap/SubmapPane.tsx`; `src/components/Submap/painters/SubmapFeaturePainter.ts`; `src/components/Submap/painters/TextureAtlasManager.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G16 | Splitting painter helpers or the atlas manager before G3 (dependent-system inventory) is complete risks orphaning retained contracts when the Submap surface is deprecated. | Accept or defer the inbound CMA-G16 route; if accepting, ensure G3 is complete first and create a narrow split plan with painter-parity proof. | Owner gap row exists and CMA-G16 status is updated to reflect acceptance or deferral. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
