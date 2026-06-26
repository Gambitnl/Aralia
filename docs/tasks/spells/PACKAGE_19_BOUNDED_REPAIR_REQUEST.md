# Package 19 Bounded Repair Request

Status: repair commit received; mergeability repair still required.
Date: 2026-06-25

## Target

Repair Package 19 without relaunching the whole created-object/structure slice.

Active PR:

- `https://github.com/Gambitnl/Aralia/pull/1145`
- Branch: `jules/spells-package19-created-object-structure-7002417225206048513`
- Repair comment: `https://github.com/Gambitnl/Aralia/pull/1145#issuecomment-4796326159`
- Current monitor note: Jules pushed repair commit `94f13c8ddbbb4aa6b7c001805b96ea4afd0d6e3d` after the repair request, and the dashboard PR monitor shows 0 failing checks and 4 passing checks, but PR #1145 still reports `mergeStateStatus: DIRTY`.

Package packet:

- `docs/tasks/spells/PACKAGE_19_CREATED_OBJECT_STRUCTURE_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_19_CREATED_OBJECT_STRUCTURE_JULES_PROMPT.md`
- `docs/tasks/spells/PACKAGE_19_FOREMAN_REVIEW_RECEIPT.md`

## Current Evidence

GitHub currently reports PR #1145 as:

- Open.
- Not draft.
- `mergeStateStatus: DIRTY`.
- Scoped to Package 19 files.
- Repair request acknowledged with a Jules eyes reaction.
- Repair commit `94f13c8ddbbb4aa6b7c001805b96ea4afd0d6e3d` observed after the visible repair request.
- Matrix dashboard PR monitor renders the current state as `blocked`: package-scoped, 1 commit after repair request, 0 failing checks, 4 passing checks, still dirty.

Changed files on the PR:

- `docs/tasks/spells/mechanics-discovery/buckets/created_object_or_structure.md`
- `public/data/spells/level-3/create-food-and-water.json`
- `public/data/spells/level-3/galders-tower.json`
- `public/data/spells/level-3/wall-of-water.json`

Current check state:

- Passing: Lint, Poison File Check, Quality Scan, CodeQL.
- Failing: Build and Tests.

Existing Spell Phase tracker context classifies the visible Build and Tests failures as ambient CI debt outside the Package 19 touched files. Recheck this after repair rather than assuming it remains true forever.

## Required Repair

1. Resolve the remaining `DIRTY` merge state by updating, rebasing, or cleanly recreating the Package 19 branch from current `master`.
2. Keep the final file list inside the four Package 19 files unless a conflict requires a narrow documented adjustment.
3. Preserve the useful PR behavior:
   - Classify the early-game `created_object_or_structure` rows.
   - Keep broad object lifecycle, destructible wall HP, inventory lifecycle, summon/control, AI arbitration, Symphony runtime, and level 4-9 work out of scope.
   - Preserve JSON `utilityType: "creation"` for `create-food-and-water`, `galders-tower`, and `wall-of-water` if validation still accepts those values.
4. Fix the package-scoped Gemini review issue:
   - In `created_object_or_structure.md`, update the structured-state text for `create-food-and-water` from `Utility Type: other` to `Utility Type: creation`.
   - In `created_object_or_structure.md`, update the structured-state text for both `galders-tower::created_object_or_structure` rows from `Utility Type: other` or missing creation wording to `Utility Type: creation` where the row describes the utility effect.
   - In `created_object_or_structure.md`, update the structured-state text for `wall-of-water::created_object_or_structure` from `Utility Type: other` to `Utility Type: creation`.
5. Recheck package verification after repair:
   - `npm run validate:spells`
   - `node scripts\auditAtlasBuckets.mjs`
   - `npx vitest run src/systems/spells/__tests__/spellPipeline.test.ts`
6. Refresh GitHub status after repair and record whether failing checks are package-related or ambient.

## Acceptance Criteria

- PR #1145, a clean replacement PR, or a documented supersede path exists from current base.
- The file list remains package-scoped.
- Bucket doc and JSON utility classifications agree for the three changed spells.
- Verification results are recorded in the Spell Phase tracker and Mechanics Discovery Packages proof log.
- No Symphony runtime/source files, generated manifests, local run state, dashboard caches, or raw orchestration logs are committed.

## Sent Visible Repair Message

Please repair Package 19 narrowly. PR #1145 is open but dirty against `master`, and Gemini found one package-scoped consistency issue. Update or recreate the branch from current `master`, keep the file list limited to the Package 19 bucket doc and the three level-3 spell JSON files, and align `created_object_or_structure.md` so the `create-food-and-water`, `galders-tower`, and `wall-of-water` structured-state rows say `Utility Type: creation` where the JSON now uses `utilityType: "creation"`. Do not broaden into object lifecycle, destructible wall HP, inventory lifecycle, summon/control, AI arbitration, Symphony runtime, or level 4-9 work. After repair, run the Package 19 verification commands and report whether any remaining failing GitHub checks are package-related or ambient.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_19_BOUNDED_REPAIR_REQUEST.md","sha256WithoutMarker":"dd66be37af547edd6bce639e735c65d343d5a0940f4b2b08f70f50d59ee05052","markedAtUtc":"2026-06-25T22:29:38.391Z"} -->
