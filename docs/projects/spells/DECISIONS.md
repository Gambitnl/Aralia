# Spells Decisions

Status: active
Last updated: 2026-06-22

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
- Project folder: `docs/projects/spells`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- Current North Star last updated date: `2026-06-05`

Follow-up:
Record future durable project decisions here instead of hiding them in chat handoffs.

### D2: Close G2 with no current canonical allocation row

Date: 2026-06-10

Owner: working agent

Decision point:
G2 asked whether target allocation should stay open until Sleep, Color Spray, or another HP-pool spell row uses `targeting.allocation`.

Decision made:
Close G2 as done for the current corpus. The target allocation bridge remains implemented and tested, but no current canonical spell JSON row contains `targeting.allocation`, so there is no honest spell-data migration to perform in this slice.

Rationale and evidence:
- A corpus scan of `public/data/spells` found 0 spell rows with `targeting.allocation`.
- `public/data/spells/level-1/sleep.json` currently models Sleep as caster-chosen area targets, not an HP-pool allocation row.
- `public/data/spells/level-1/color-spray.json` currently models Color Spray as a Constitution-save Blinded cone, not an HP-pool allocation row.
- Target allocation bridge tests passed on 2026-06-10: `TargetAllocator.test.ts`, `TargetResolver.test.ts`, and `targetingAllocation.test.ts`.
- Spell corpus validation passed after the Color Spray description fill: 459 valid / 0 invalid.

Reopen condition:
Reopen G2 or create a successor gap only when a concrete canonical spell row needs pool allocation semantics again, or when product/rules direction explicitly requires converting a spell to `targeting.allocation`.

### D3: Spells parent is a scoped routing dashboard

Date: 2026-06-22

Owner: Codex

Decision point:
The Spells project now contains child lanes for runtime, completeness audit, UI, data taxonomy, automation, documentation, mechanics discovery, and linked support. The parent page needed to stop reading like one executable implementation project.

Decision made:
Treat `docs/projects/spells` as the parent scoped-dashboard. Child packets selected through `SUBPROJECTS.md` own executable pass status, active agent, proof, and local gaps. The parent owns routing, ownership decisions, imported parent-visible gaps, and dashboard discoverability.

Rationale and evidence:
- Parent template: `misc/project_ui_template.html`
- Parent protocol: `docs/agent-workflows/living-project-task-protocol/PARENT_PROJECT_WITH_SUBPROJECTS.md`
- Child registry: `docs/projects/spells/SUBPROJECTS.md`

Follow-up:
When a future agent wants to implement spell runtime/data/UI/audit work, route to the child packet first and update this parent only for cross-lane visibility or ownership changes.
