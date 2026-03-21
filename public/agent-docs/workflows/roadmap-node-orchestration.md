---
description: Autonomously derive roadmap node and branch updates from the just-completed coding session.
---

# /roadmap-node-orchestration Workflow

This workflow is the dedicated roadmap maintenance phase for tidy-up.
It runs against the exact coding work that just happened in the active conversation session.

## Mission

1. Inspect files touched in the just-finished conversational coding session.
2. Decide whether each change belongs to an existing roadmap branch or requires a new branch/node.
3. Ensure roadmap placement follows capability-first hierarchy and existing branch structure.
4. Audit whether touched implementation code is atomized (single component/concern per file).
5. Keep roadmap evidence and test routing aligned with node/module structure.

## Required Inputs

1. Conversation-grounded change list from the active session.
2. Git-grounded change list from `git status --porcelain` (cross-check only).
3. Current roadmap structure and docs under `devtools/roadmap/`.
4. Roadmap ingestion surfaces:
   - `docs/tasks/...` for capability docs the roadmap may ingest
   - `.agent/roadmap-local/processing_manifest.json` for processed doc registration
   - `devtools/roadmap/scripts/roadmap-engine/generate.ts` for curated allowlists/details
   - `devtools/roadmap/scripts/roadmap-engine/text.ts` for name normalization rules

## Execution

1. Build the session touched-file set (create/modify/rename/delete).
2. Classify capability impact per file (`existing-capability-update`, `new-subcapability`, `new-top-level-capability`, `non-roadmap-impact`).
3. Resolve branch placement:
   - Update existing branch nodes when branch already exists and is correct.
   - Create new branch/node only when no existing branch fits.
4. Preserve stable node identity for existing nodes (label changes must not imply identity changes).
5. Run atomization audit on touched implementation files (`atomized`, `acceptable-orchestrator`, `needs-split`).
6. Verify module/end-node test definition routing for touched module leaves.
7. Run `npm run roadmap:audit-all` and capture summary metrics.

## Roadmap Addition Guardrails

When adding or updating gameplay/app capability nodes, do not treat that as `Roadmap Tool` work unless the feature is literally part of the roadmap tool itself.

Use this sequence:

**For Roadmap Tool capability nodes** (the tool itself, not game features):
1. Add the full label hierarchy to `CURATED_SUBFEATURES['roadmap tool']` in `devtools/roadmap/scripts/roadmap-engine/generate.ts`. This is the direct gate — the node will not appear without an explicit entry here.
2. Optionally back it with a capability doc under `docs/tasks/roadmap/` (good practice, not required for the node to render).
3. Check `text.ts` normalization for acronym/casing drift that can cause duplicate IDs or silent label changes.
4. Verify emitted nodes in `/api/roadmap/data` or direct generator output before trusting the browser.
5. Verify final pillar placement, not just node existence.

**For game/app capability nodes** (gameplay features, not tooling):
1. Add or update a capability-focused doc under `docs/tasks/...`.
2. Register or update the processed-doc entry in `.agent/roadmap-local/processing_manifest.json`.
3. If the node still does not appear, check `generate.ts` allowlists/details — manifest registration alone is not sufficient if the allowlist does not include the label.
4. Check `text.ts` normalization for acronym/casing drift that can cause duplicate IDs or silent label changes.
5. Verify emitted nodes in `/api/roadmap/data` or direct generator output before trusting the browser.
6. Verify final pillar placement, not just node existence.

## Common Failure Modes

1. **Missing allowlist entry (most common for Roadmap Tool nodes):** the `CURATED_SUBFEATURES` entry in `generate.ts` was not added — neither a capability doc nor a manifest entry will make the node appear without it.
2. Manifest-only registration: doc and manifest exist, but generator still drops the node because the allowlist in `generate.ts` is the real gate.
3. Wrong branch family: gameplay/runtime work was added under `Roadmap Tool`.
4. Normalization collisions: acronym/casing rewrite creates duplicate node IDs.
5. Correct API, stale UI: server/browser is still showing pre-patch code or stale visibility state.
6. Wrong pillar placement: `featureGroup` / `feature` text was too weak for pillar inference.

## Verification Minimum

Do not mark roadmap addition complete until:

1. the capability doc exists or was deliberately updated,
2. the processing manifest contains the intended labels,
3. the generator emits those labels,
4. the node is parented under the intended pillar, and
5. the live roadmap UI can render or navigate to the branch.

## Required Output Block

- `Roadmap Node Orchestration: yes|no (with reason)`
- `Session Touched Files Reviewed: <paths>`
- `Existing Branch Updates: <list or none>`
- `New Branches Created: <list or none>`
- `New Nodes Created: <list or none>`
- `Nodes Modified: <list or none>`
- `Atomization Findings: <list or none>`
- `Module Leaves Missing Test Definitions: <list or none>`
- `Roadmap Audit Summary: both=<n>, programOnly=<n>, docsOnly=<n>, neither=<n>, moduleLeavesMissingTestDefinitions=<n>`
- `Open Follow-ups: <list or none>`

If this block is missing, tidy-up is incomplete.
