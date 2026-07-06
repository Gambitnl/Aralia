# Stitch Cleanup Careful-Removal List

This list separates remaining `stitch` search hits that were not removed during the Stitch MCP cleanup. They are not the deleted Google Stitch MCP launcher/tooling path, or they need a broader owner decision before removal.

## Keep For Now

- `src/systems/worldforge/local/stitchLocalArtifacts.ts` and its tests: active worldforge seam-composition code. Removing it would break the local terrain seam probe and related 3D proof paths.
- `src/systems/worldforge/bridge/seamProbe.ts` and its tests: uses the local artifact stitcher to build two-region seam proofs. This is gameplay/world-generation work, not Google Stitch tooling.
- `src/systems/world3d/chunkGeometry.ts`, `src/systems/world3d/types.ts`, and `src/systems/world3d/__tests__/chunkStitch.test.ts`: terrain mesh border stitching. Removing this risks visible cracks or LOD seam regressions.
- `src/components/Worldforge/atlasSvg.ts`: path stitching for atlas polygon rings. This is map rendering behavior, not MCP tooling.
- `public/data/glossary/entries/equipment/black_velvet_mask_stitched_with_silver_thread.json`, its generated indexes, and matching icon: item content whose name contains "stitched". Removing it would delete game data.
- `public/data/glossary/entries/rules/pact_of_the_tome.json`, `book_of_vile_darkness.json`, and bundled/indexed copies: rules or lore text that uses the ordinary word "stitching". Not related to MCP.
- `public/data/dev/slice-of-life-settings.*`: generated character/image QA data where an NPC is stitching a quilt. Not related to MCP.

## Historical Or Generated Cleanup Candidates

- `src/components/CharacterCreator/NameAndReview.tsx`: still contains stale portrait-generation wording that says the old portrait flow uses Stitch. This file is currently locked by another agent, so it should be updated when the Character Creator owner releases the lock.
- `conductor/symphony/docs/decision-reports/archive/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS_FULL_LEDGER_2026-05-25.md`, `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`, and `docs/tasks/spells/PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`: historical records of a past dashboard/auth decision. Do not rewrite casually; remove or annotate only if the owning task history is intentionally being retired.
- `docs/tasks/backlog-retirement/WALKED_FILE_SNAPSHOT.json`, `docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md`, `docs/registry/@DOC-REVIEW-LEDGER.md`, and `docs/registry/@DOC-MIGRATION-LEDGER.md`: historical documentation-retirement ledgers that name the now-deleted Google Stitch prompt artifact. Rewriting them may weaken audit traceability.
- `.agent/agora/client-identity.codex-stitch-auth-probe-019f2faf.json`, `.agent/agora/client-identity.codex-stitch-cleanup-019f2fd5.json`, and `.agent/agora/ids/codex-stitch-launcher-fix/client-identity.json`: local coordination identity files whose names came from this cleanup/probe work. Remove only through the Agora/session cleanup workflow; deleting the active identity file during a live session can confuse lock ownership.
- `.agent/orchestration/activity.jsonl`, `.agent/agora/journal.jsonl`, and `.agent/agora/snapshot.json`: local coordination history may still contain older Stitch probe messages. Removing individual log lines is risky and unnecessary; wholesale local-state cleanup should happen through the Agora/session cleanup workflow.

## Follow-Up Rule

Before removing anything above, confirm whether it is runtime game behavior, generated output, or local operator state. Only delete it when the owning system confirms it is disposable or has a replacement.
