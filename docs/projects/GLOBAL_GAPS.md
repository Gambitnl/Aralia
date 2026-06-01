# Global Gap Tracker

Status: active
Last updated: 2026-05-31

Use this file for gaps discovered during project work that do not clearly belong
to the active project's own gap tracker. This is a repo-level surfacing and
routing file for cross-project, orphaned, or out-of-current-scope gaps.

When a living project is created or refreshed, check this file before creating
new gap rows. Import only the gaps that genuinely belong to the project after
critical scope review.

## Gap Log

| Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|

| GG-1 | untriaged | support_needed_now | World 3D rendering debug (2026-06-01) | Consolidation merge left a stale import that crashed the whole app: `characterValidation.ts` imported `SKILL_DATA` from `dndData.ts`, but skill data was relocated/renamed to `SKILLS_DATA` in `src/data/skills/`. One fix applied locally (uncommitted); other stale imports may exist. | `src/utils/character/characterValidation.ts` (fixed import), `src/data/skills/index.ts` (`SKILLS_DATA`), `src/data/dndData.ts` (no `SKILL_DATA`) | A single bad ESM import blanks the entire app with no error-boundary catch — found only because the 3D preview wouldn't load | Character/data modules (not world3d) | untriaged | none yet | Commit the `characterValidation` fix; grep `src/` for other imports of relocated `dndData`/skill symbols | `tsc --noEmit` clean + app boots to main menu with no blank-page ESM error |

## Status Vocabulary

| Status | Meaning |
|---|---|
| `untriaged` | Recorded for surfacing; no owning project has accepted it yet. |
| `candidate` | May belong to a known project, but needs critical scope review. |
| `imported` | Accepted into a project gap tracker; destination is linked. |
| `routed` | Sent to another existing subsystem tracker; destination is linked. |
| `declined` | Reviewed and intentionally not accepted; rationale is recorded. |
| `done` | Resolved with completion evidence linked or summarized. |

## Routing Rules

- Add gaps here when they are cross-project, orphaned, or outside the active
  project's current scope.
- Do not add gaps here just because they are inconvenient. If the active project
  cannot honestly complete without the gap, it belongs in the project tracker or
  project `GAPS.md`.
- When a project imports a global gap, copy the actionable context into that
  project's `GAPS.md`, then mark the global row `imported` and link the
  destination. Preserve the global row as routing history.
- When the gap clearly belongs to another established subsystem, mark the row
  `routed` and link that subsystem's tracker.
- When scope review rejects a gap, mark it `declined` with a concise reason.

## Physical object registry for combat/world targeting - 2026-05-31

Source project: Structured Spell Execution (docs/tasks/spell-system-overhaul).

Problem:
- Spell targeting now has a minimal runtime object validation envelope, but there is no shared combat/world source of positioned targetable physical objects.
- Existing battle-map decorations are visual/terrain obstacle metadata, not spell-targetable object entities.
- Existing loot generation returns unpositioned item results, not battle-map object candidates.

Needed system:
- A physical object registry or adapter that can expose positioned object candidates with stable ids, names, positions, size, weight, magical status, worn/carried/fixed state, and enough map context for line-of-sight/range checks.

Why global:
- This is not only spell execution. It also touches battle-map interaction, loot placement, object inspection, inventory/world item state, and environmental manipulation.

Spell-side dependency:
- TargetResolver.isValidObjectTarget can validate supplied candidates once such a registry exists.
