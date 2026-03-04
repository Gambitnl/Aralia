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
