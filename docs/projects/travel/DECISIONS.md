# Travel Decisions

Status: active
Last updated: 2026-06-15

Use this file for durable choices that affect project scope, required documentation, or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and re-openable workflow deltas in `TRACKER.md` or `GAPS.md`.

## Decision Log

### D1: Required-doc surface initialized

Date: 2026-06-10

Owner: schema migration pass

Decision point:
`NORTH_STAR.md` declares `DECISIONS.md` as part of the required living-project surface.

Decision made:
Create this concise decisions file so the project folder matches the declared schema contract.

Rationale and evidence:
- Project folder: `docs/projects/travel`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Upgrade existing `travel` project for cell-native travel path

Date: 2026-06-15

Owner: Antigravity (setup agent)

Decision point:
Determine whether to create a new living project slug (e.g., `cell-native-travel`) or upgrade the existing `travel` project folder/registry row for the cell-native travel path.

Decision made:
Upgrade the existing `travel` project folder (`docs/projects/travel/`) and the corresponding row in `docs/projects/PROJECT_TRACKER.md`. Do not create a duplicate parallel project.

Rationale and evidence:
- Preflight check on `PROJECT_TRACKER.md` shows the existing "Travel System" project with folder `docs/projects/travel/`.
- Since the cell-native travel path is the logical evolution and re-routing of the movement/travel system itself, creating a parallel project would violate the README preflight rules: "Do NOT create a parallel project if `travel` already owns movement."

Follow-up:
Refresh all travel project documentation files (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`) to reflect the cell-native objective and its scope.

