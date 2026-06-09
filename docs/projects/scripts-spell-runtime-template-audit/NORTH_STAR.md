# NORTH_STAR: Scripts: Spell Runtime Template Audit

Status: review-required
Last updated: 2026-06-08

## Dashboard Card Schema

Project: Scripts: Spell Runtime Template Audit
Slug: scripts-spell-runtime-template-audit
Category: Scripts / Audit Projects
Status: review-required
Confidence: medium
Evidence: docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md
Gap signal: 2 open gaps
Protocol: living project doc set
Next step: Human review should decide whether this remains standalone or routes into Structured Spell Execution / scripts quality before worker assignment.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-08
Lifecycle status: merge-candidate
Deprecation confidence: weak
Deprecation reason: overlap_with_spell_system_overhaul_and_scripts_audit_ownership
Canonical owner: docs/tasks/spell-system-overhaul or docs/projects/scripts-quality pending review
Human decision required: yes

## Why This Project Exists

This area keeps the strict runtime-template contract for spell conversion visible
and operational. It documents the current state, evidence links, and follow-up
for recurring-label and parity issues that impact template stability.

## Intended Outcome

- Preserve scope and evidence continuity for the runtime-template audit surface.
- Keep this project handoff-ready with concrete next checks and gap IDs.
- Maintain a clean boundary between audit evidence and execution or engine
  implementation work.

## Current State

- Registry evidence: `docs/projects/PROJECT_TRACKER.md` row `Scripts: spell-runtime-template-audit`.
- Implementation surface:
  - `scripts/spellRuntimeTemplateAudit/vocabulary.ts`
  - `scripts/auditSpellRuntimeTemplate.ts`
  - `scripts/validateSpellTemplateContracts.ts` (contract companion)
- Output surfaces:
  - `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md`
  - `.agent/roadmap-local/spell-validation/spell-runtime-template-audit.json`
- Most recent baseline (`2026-05-31`): `459` spells, `28` warnings, `0` errors.
- All open warnings come from `structured-unregistered-label` on:
  `Recurring Mechanics` and `Recurring Mechanic Timing`.
- The project is in doc-handoff mode for the recurring-mechanics label path;
  no runtime behavior changed in this pass.

## Active Task

| Field | Value |
|---|---|
| Task | Convert existing audit output into concrete remediation handoff and next checks |
| Acceptance criteria | gap IDs are registered, ownership is clear, and next checks map to a runnable audit command |
| Allowed boundaries | `docs/projects/scripts-spell-runtime-template-audit/*`, `scripts/spellRuntimeTemplateAudit/*`, `scripts/auditSpellRuntimeTemplate.ts`, `scripts/validateSpellTemplateContracts.ts` |
| Stop condition | this project captures durable intent and backlog for the warning family without implementing engine behavior changes |
| Verification | `npm run audit:spell-template` and tracker file references |
| Owner | Worker C |
| Next action | align warning-driven follow-up to GAPS/TRACKER and the spell-system-overhaul handoff lane |

## Scope Boundaries

In scope:
- Documented handoff state for runtime template audit.
- Evidence linking, gap framing, and check cadence.
- Clarifying integration points with template contracts and spell execution programs.

Adjacent but not in this slice:
- adding new spell-logic implementation in `src/systems/spells`.

Out of scope:
- broad schema refactors in runtime engine code.
- edits outside `docs/projects/scripts-spell-runtime-template-audit` for this pass.

## File Map

| File | Purpose |
|---|---|
| `scripts/spellRuntimeTemplateAudit/vocabulary.ts` | Strict template vocabulary and accepted values used by the audit |
| `scripts/auditSpellRuntimeTemplate.ts` | Audit runner and output generation |
| `scripts/validateSpellTemplateContracts.ts` | Structured vs runtime template contract checks |
| `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` | Human-readable grouped issue summary |
| `.agent/roadmap-local/spell-validation/spell-runtime-template-audit.json` | Machine-readable issue payload |
| `package.json` | `audit:spell-template` command entry point |

## Integrations

- `scripts/auditSpellRuntimeTemplate.ts` is run via `npm run audit:spell-template`.
- Output is separate from the canonical template contract check in
  `scripts/validateSpellTemplateContracts.ts`.
- Report artifacts are consumed by the broader spell execution tracking flow in
  `docs/tasks/spells`.

## Relationship to `docs/tasks/spell-system-overhaul`

- This project is narrow: contract checks for runtime template/label parity.
- The broader schema and execution follow-through remains in
  `docs/tasks/spell-system-overhaul`; unresolved recurring-mechanics warnings should
  be routed there as a follow-up once this project formalizes acceptance criteria.
- This project should not absorb engine-level mechanics decisions; it feeds them.

## Known Gaps And Follow-Ups

| Gap ID | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| SRTA-001 | support_needed_now | Worker C | [docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md](docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md) | Decide whether `Recurring Mechanics` and `Recurring Mechanic Timing` belong in the strict vocabulary now or move to a migration follow-up, then rerun `npm run audit:spell-template` |
| SRTA-002 | adjacent_follow_up | Worker C | `scripts/spellRuntimeTemplateAudit/vocabulary.ts` | Add a corresponding handoff note in the spell-system-overhaul lane for execution ownership after this project scope captures the decision |

## Global Gap Imports

Check [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) before adding cross-project gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | these warning-level items are local to runtime-template audit ownership |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Registry row | project is recognized and scoped | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) |
| Audit implementation | strict checks are executable | `scripts/auditSpellRuntimeTemplate.ts`, `scripts/spellRuntimeTemplateAudit/vocabulary.ts` |
| Current warnings | concrete known debt | `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` |
| Command entry | reproducible refresh flow | `package.json` |

## Artifact Boundary

Keep durable project intent, gap rows, and resume context here.
Keep generated noise, full run logs, and temporary CI/Jules/runtime artifacts outside this project scope unless a short excerpt is needed.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should recurring-mechanics labels be added to strict vocabulary or handled in a separate schema migration slice? | Affects template debt, validator behavior, and scope of spell-system-overhaul follow-through | Worker C | next active slice |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/scripts-spell-runtime-template-audit/TRACKER.md`.
3. Read `docs/projects/scripts-spell-runtime-template-audit/GAPS.md`.
4. Confirm current report baseline in `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md`.
5. Continue from: register one concrete remediation decision in `TRACKER.md`, mirror it in `GAPS.md`, and re-run the audit.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
