# Documentation Review Ledger

**Last Updated**: 2026-03-11  
**Purpose**: Track manual, file-by-file documentation audits so review status, evidence, and disposition do not drift across long-running cleanup work.

## Mandatory Processing Gate

A file only qualifies as `processed` when all of the following are true:
- the file has been read as a whole rather than skimmed or inferred from filename alone
- its concrete claims, assumptions, and role have been extracted or summarized
- those claims have been checked against the current repo, docs tree, or both
- the evidence basis is recorded in the row notes
- a disposition has been chosen intentionally: `keep in place`, `rewrite in place`, `split`, `move to archive`, `move`, or `retire`
- any required rewrite, move, archive, pointer, or link follow-through has already been applied

Additional enforcement rules:
- archive-note-only edits improve provenance, but they do not by themselves satisfy `processed`
- a file that was handled below this standard must be downgraded and re-queued rather than left marked complete
- subagent audits can inform the process, but only the orchestrator marks a file `processed`
- every `processed` row should make the verification basis visible enough that the file can be re-audited later without guessing what was checked

## Roadmap Signal Rule

For docs that describe app capabilities rather than pure workflow/process/history, the review pass should also record a roadmap interpretation signal.

Allowed signals:
- `none_process_only`: no roadmap output; workflow/process/history only
- `branch_evidence`: confirms or corrects an existing branch-level capability
- `leaf_evidence`: confirms a concrete end-node capability
- `integration_witness`: confirms that one concrete leaf proves several shared systems are wired through one path
- `crosslink_candidate`: feature/leaf should connect to multiple branches
- `stale_roadmap_correction`: current roadmap node shape or status is misleading

Interpretation defaults:
- documents do not become roadmap nodes directly
- spells are usually `leaf_evidence`, not branch roots
- multi-effect spells can remain leaves while also emitting `integration_witness` or `crosslink_candidate`
- workflow, migration, validation, and coordination docs should usually emit `none_process_only`

## Status Legend

- `not started`
- `in review`
- `reviewed`
- `updated`
- `processed`
- `archived`

## Canonical Root Docs

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/@PROJECT-OVERVIEW.README.md` | `index` | `processed` | `keep in place` | Rewritten 2026-03-10 after claim-by-claim repo verification against `package.json`, `index.html`, `index.tsx`, `src`, `public/data/glossary`, and service/component surfaces. |
| `docs/ARCHITECTURE.md` | `index` + `reference` | `processed` | `keep in place` | Manual audit verified. Rewritten in place on 2026-03-10 to remove overclaims about file ownership, correct service-layer wording, and broaden the source-tree summary while preserving the file's root architecture-map role. |
| `docs/DEVELOPMENT_GUIDE.md` | `workflow` | `processed` | `keep in place` | Manual audit verified. Minor wording tightened on 2026-03-10 so the file no longer overstates `src/state/appState.ts` as the sole center of state while preserving its role as day-to-day development orientation. |
| `docs/@DOCUMENTATION-GUIDE.md` | `workflow` + `registry` | `processed` | `keep in place` | Manual audit verified. Rewritten in place on 2026-03-10 to clarify target-state taxonomy, distinguish repo-root `generated/` from `docs/generated/`, align the active-work start surface with `@ACTIVE-DOCS.md`, and reconcile its naming guidance with the older numbered-doc rules. |
| `docs/@README-INDEX.md` | `registry` | `processed` | `keep in place` | Orchestrator verified current navigation claims against the post-move docs tree on 2026-03-10. File remains the canonical navigation surface and did not require further rewrite beyond the earlier migration update. |

## Next Priority Registry Docs

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/@ACTIVE-DOCS.md` | `registry` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a curated active-work entry surface instead of a stale global status dashboard. Roadmap-tooling references were removed from maintained scope and retired-work references were synced with `@RETIRED-DOCS.md`. |
| `docs/@DOC-NAMING-CONVENTIONS.md` | `workflow` + `registry` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 so it now governs legacy numbered work-doc systems honestly, acknowledges mixed numbering eras, and stops equating all stable docs with the `@` prefix. |
| `docs/@DOC-REGISTRY.md` | `registry` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a scoped registry for tracked numbered work-doc families, with truthful cautions about duplicate identifiers, dotted descendants, and excluded roadmap-tooling docs. |
| `docs/@RETIRED-DOCS.md` | `registry` | `processed` | `rewrite in place` | Rewritten 2026-03-11 to sync the retirement ledger with the retired numbered docs currently referenced by `@DOC-REGISTRY.md` and `@ACTIVE-DOCS.md`. |
| `docs/@DOC-INVENTORY.md` | `registry` + `generated` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a truthful inventory surface that points to generated exhaustive listings instead of pretending to be a hand-maintained per-file timestamp ledger. |
| `docs/registry/@DOC-SCOPE.md` | `registry` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to distinguish the active first-wave `docs/` review scope from the deferred `src` README wave while preserving the audited inclusion and exclusion snapshot numbers from 2026-03-09. |
| `docs/registry/@DOC-MIGRATION-LEDGER.md` | `registry` | `processed` | `rewrite in place` | Manual audit verified. Updated through 2026-03-11 to capture the registry-layer rewrite, the current preservation rule, the deferred `src` README wave, and the current queue direction for the remaining root and subtree passes. |
| `docs/registry/@DOC-REVIEW-LEDGER.md` | `registry` | `processed` | `rewrite in place` | Self-maintained during the full first-wave pass. Re-verified and updated through 2026-03-14 so status rows, mandatory processing rules, and roadmap-signal rules continue to match the active review workflow. |

## Next Root Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/@AI-PROMPT-GUIDE.md` | `workflow` | `processed` | `rewrite in place` | Rewritten 2026-03-11 after verifying the current stack and workflow reality against `package.json`, `index.html`, and root `AGENTS.md`. File now briefs AI collaborators for the current Vite/TypeScript repo instead of the older static-app architecture. |
| `docs/AGENT.md` | `workflow` + `compatibility` | `processed` | `keep in place` | Manual audit verified. This file remains a compatibility pointer only and correctly redirects readers to root `AGENTS.md`, `DEVELOPMENT_GUIDE.md`, `ARCHITECTURE.md`, and `@DOCUMENTATION-GUIDE.md`. |
| `docs/@JULES-WORKFLOW-GUIDE.md` | `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a situational Jules-specific coordination note rather than a universal workflow authority for the repo. |
| `docs/@POTENTIAL-TOOL-INTEGRATIONS.README.md` | `reference` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to distinguish already-adopted tools from still-hypothetical candidates and to remove stale future-tense statements about Vite, Vitest, Framer Motion, and Playwright. |
| `docs/@TROUBLESHOOTING.md` | `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to distinguish current troubleshooting guidance from historical fix notes, especially around Gemini parsing, fallback icons, and older architectural rationale. |
| `docs/@VERIFICATION-OF-CHANGES-GUIDE.md` | `workflow` | `processed` | `rewrite in place` | Rewritten 2026-03-11 to replace the obsolete XML-handoff instructions with the current verification model: structural, behavioral, and visual checks matched to the change type. |
| `docs/CHANGELOG.md` | `archive` + `reference` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a concise historical top-level changelog after confirming the older `docs/changelogs/` split-links were no longer live in the current docs tree. |
| `docs/CODE_WALKTHROUGH.md` | `reference` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to describe the current `index.html` -> `index.tsx` bootstrap path without the obsolete Tailwind-CDN and import-map assumptions. |
| `docs/FEATURES_TODO.md` | `work-item` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to remove merge-conflict artifacts and stale branch-review notes, leaving a clean live feature backlog that points completed work to the archive surface. |
| `docs/QOL_TODO.md` | `work-item` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a focused quality-of-life backlog distinct from the main feature backlog, while preserving the live pending polish and QA items. |
| `docs/SPELL_INTEGRATION_STATUS.md` | `reference` + `work-item` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a high-level orientation doc grounded in the current manifest and linked spell surfaces, without repeating stale percentage dashboards that were not freshly re-verified. |
| `docs/VISION.md` | `reference` | `processed` | `rewrite in place` | Manual audit verified. Updated 2026-03-11 to clarify that it is a living product-direction document mixing verified current surfaces with long-horizon aspiration, rather than a claim that every listed system is already implemented. |

## Spell System Overhaul Entry Surfaces

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/tasks/spell-system-overhaul/README.md` | `workflow` + `index` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a truthful subtree map that acknowledges the mixed documentation eras and stops presenting the old 27-task plan as the whole folder's current execution model. |
| `docs/tasks/spell-system-overhaul/START-HERE.md` | `index` + `workflow` | `processed` | `rewrite in place` | Manual and audit verification completed. Updated 2026-03-11 to frame the file as preserved historical execution context, repair broken architecture links, and correct stale command names without deleting the older plan content. |
| `docs/tasks/spell-system-overhaul/00-TASK-INDEX.md` | `work-item` + `registry` | `processed` | `rewrite in place` | Manual verification completed. Updated 2026-03-11 to frame the 27-task index as a preserved historical phased plan and to repair its primary architecture reference. |
| `docs/tasks/spell-system-overhaul/1A-PROJECT-MASTER-SPRINGBOARD.md` | `work-item` + `index` | `processed` | `rewrite in place` | Manual verification completed. Rewritten 2026-03-11 as the honest current springboard for the subtree, with stale counts, missing-file assumptions, and outdated command references removed or softened. |
| `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md` | `workflow` | `processed` | `rewrite in place` | Manual verification completed. Rewritten 2026-03-11 as the current conversion workflow, with stale glossary-location and single-source workflow assumptions removed. |
| `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md` | `workflow` | `processed` | `rewrite in place` | Manual verification completed. Rewritten 2026-03-11 as a compact guardrail sheet using current commands and schema references instead of stale migration assumptions. |
| `docs/tasks/spell-system-overhaul/TASK-TEMPLATE.md` | `workflow` + `template` | `processed` | `rewrite in place` | Manual verification completed. Rewritten 2026-03-11 to replace the missing spell-research reference with the current spell-system architecture reference and to keep the template usable under the current repo shape. |
| `docs/archive/spell-docs-2025-12/FINAL_SUMMARY.md` | `archive` + `summary` | `processed` | `move to archive` | Manual audit verified. Moved out of the live spell-overhaul task tree on 2026-03-11 because it is a PR-era milestone recap with stale coordination references; preserved in the existing spell archive lane with archive framing. |
| `docs/archive/spell-docs-2025-12/UPDATES-SUMMARY.md` | `archive` + `summary` | `processed` | `move to archive` | Manual audit verified. Moved out of the live spell-overhaul task tree on 2026-03-11 because it is a dated batch-fix summary with stale command references; preserved in the existing spell archive lane with archive framing. |
| `docs/tasks/spell-system-overhaul/VALIDATION-ALIGNMENT-ANALYSIS.md` | `work-item` + `analysis` | `processed` | `rewrite in place` | Manual audit verified. Kept as a preserved analysis brief and rewritten 2026-03-11 to state explicitly that no `VALIDATION-VS-CRITERIA-REPORT.md` deliverable was found during the current pass. |
| `docs/tasks/spell-system-overhaul/BATCH-CREATION-GUIDE.md` | `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to remove the missing `SALVAGED_SPELL_CONTEXT.md` dependency, stop assuming a nonexistent spell-glossary markdown lane, and clarify that it is subtree-specific batch-authoring guidance. |
| `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md` | `workflow` + `policy` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to keep the strict migration contract while removing false glossary-path assumptions, softening overclaims about universally enforced rules, and correcting the verified `creatureTypes` targeting field name. |
| `docs/tasks/spell-system-overhaul/GAP_REGISTRY.md` | `reference` + `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a convention-level gap-code registry with explicit cautions about schema-backed features that now exist and about codes that still require runtime re-verification. |
| `docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md` | `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to keep the level-by-level migration playbook while removing missing `docs/spells/reference/LEVEL-{N}-REFERENCE.md` targets, removing false spell-glossary markdown assumptions, and clarifying that it is for unfinished levels rather than proof that every level artifact already exists. |
| `docs/tasks/spell-system-overhaul/LEVEL-1-BATCHES.md` | `work-item` + `summary` | `processed` | `rewrite in place` | Manual audit verified. Reframed 2026-03-11 as a preserved Level 1 rollup summary after spot-verifying nested Level 1 JSON file presence while avoiding unverified claims about glossary coverage or fresh green validation results. |
| `docs/tasks/spell-system-overhaul/SPELL_MIGRATION_PROMPT.md` | `workflow` + `template` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 as a reusable subtree prompt template that no longer claims a nonexistent spell-glossary markdown lane and now matches the current acceptance criteria and gaps-file handling. |
| `docs/archive/spell-system/@SPELL-SYSTEM-OVERHAUL-TODO.md` | `archive` + `reference` | `processed` | `move to archive` | Manual audit verified. The old "Gold Standard" guide was moved into `docs/archive/spell-system/` on 2026-03-11 because it mixed broken links, stale flat-file assumptions, and outdated migration-state claims while presenting itself as current authority. |
| `docs/tasks/spell-system-overhaul/@SPELL-SYSTEM-OVERHAUL-TODO.md` | `compatibility` + `index` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a narrow compatibility pointer so existing links keep working while routing readers to the current subtree entry surfaces and the archived historical guide. |
| `docs/tasks/spell-system-overhaul/@DISPATCH-SPELLS-TO-JULES.md` | `workflow` | `processed` | `rewrite in place` | Manual audit verified. Rewritten 2026-03-11 to collapse duplicated stale prompt blocks into a narrow Jules-dispatch wrapper around the current prompt template and acceptance docs. |
| `docs/tasks/spell-system-overhaul/TODO.md` | `work-item` + `backlog` | `processed` | `rewrite in place` | Manual audit verified. Updated 2026-03-11 to mark it as the live mixed backlog, retire the obsolete flat-root migration item, correct the repeat-save schema claim, and repair the completed-item reference away from the removed live `FINAL_SUMMARY.md` path. |
| `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md` | `reference` + `roadmap` | `processed` | `rewrite in place` | Manual audit verified. Kept as the live rebased roadmap and tightened 2026-03-11 so the rechecked counts remain explicit while roadmap interpretation sections stop overclaiming full implementation proof. |
| `docs/archive/spell-system/TASK_STRATEGY_UPDATE.md` | `archive` + `strategy` | `processed` | `move to archive` | Manual audit verified. The older cantrip-first / PR-choreography strategy was moved into `docs/archive/spell-system/` on 2026-03-11 because it depended on broken template paths and historical coordination assumptions. |
| `docs/tasks/spell-system-overhaul/TASK_STRATEGY_UPDATE.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a historical pointer that routes readers to the current roadmap and workflow docs while preserving the old path. |
| `docs/archive/spell-system/SPELL_MIGRATION_PATH.md` | `archive` + `strategy` | `processed` | `move to archive` | Manual audit verified. The long-form V2 migration strategy was moved into `docs/archive/spell-system/` on 2026-03-11 because it contained stale totals, obsolete command names, and outdated milestone assumptions. |
| `docs/tasks/spell-system-overhaul/SPELL_MIGRATION_PATH.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a historical pointer that keeps older links alive while routing readers to the current rebased roadmap and live backlog. |
| `docs/tasks/spell-system-overhaul/LEVEL-2-BATCHES.md` | `work-item` + `summary` | `processed` | `rewrite in place` | Manual audit verified. Reframed 2026-03-11 as a preserved Level 2 rollup summary after confirming the current level-2 folder contains more spell JSON files than the batch rollup lists, so the file cannot stand as a complete current-coverage proof. |
| `docs/archive/spell-system/00-AGENT-COORDINATION.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual audit verified. The older parallel-agent coordination plan was moved into `docs/archive/spell-system/` on 2026-03-11 because its blocker assumptions and phase-status claims had become historical. |
| `docs/tasks/spell-system-overhaul/00-AGENT-COORDINATION.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a historical pointer that routes readers to the current subtree entry docs while preserving the old path. |
| `docs/archive/spell-system/00-DATA-VALIDATION-STRATEGY.md` | `archive` + `design` | `processed` | `move to archive` | Manual audit verified. The older validation design document was moved into `docs/archive/spell-system/` on 2026-03-11 because it overclaimed current infrastructure and referenced validation surfaces that no longer match the current repo. |
| `docs/tasks/spell-system-overhaul/00-DATA-VALIDATION-STRATEGY.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a historical pointer that routes readers to the current acceptance/workflow surfaces while preserving the old path. |
| `docs/tasks/spell-system-overhaul/00-GAP-ANALYSIS.md` | `reference` + `gap-registry` | `processed` | `rewrite in place` | Manual audit verified. Kept in place and corrected again on 2026-03-11 after the AI-gap slice confirmed that input UI surfaces now exist, so the doc now frames GAP-01 as a wiring/proof-of-life issue rather than total UI absence. |
| `docs/archive/spell-system/00-PARALLEL-ARCHITECTURE.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual audit verified. Moved into `docs/archive/spell-system/` on 2026-03-11 because its five-agent delivery contract, module map, and broken architecture reference had become historical rather than current execution authority. |
| `docs/tasks/spell-system-overhaul/00-PARALLEL-ARCHITECTURE.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual audit verified. Replaced 2026-03-11 with a historical pointer so the old path survives while routing readers to current subtree entry docs and the archived parallel-plan body. |
| `docs/tasks/spell-system-overhaul/0-PRIORITY-SCHEMA-EVOLUTION.md` | `reference` + `gap-audit` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 as a rebased gap-audit note after confirming that many originally claimed schema gaps now exist in `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts`, while some runtime questions still remain open. |
| `docs/tasks/spell-system-overhaul/01-typescript-interfaces.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 as preserved task context with a current-status note after confirming the requested type layer and tests now exist, while the old research path and some original design assumptions no longer match the live repo. |
| `docs/tasks/spell-system-overhaul/03-command-pattern-base.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 as preserved task context with a current-status note after confirming the command base, executor, factory, and `useAbilitySystem` integration already exist, while the older module-map assumptions no longer match the live repo. |
| `docs/tasks/spell-system-overhaul/19-ai-spell-arbitrator.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 as preserved task context with a current-status note after confirming that the arbitrator already exists under `src/systems/spells/ai`, while the older service-path, provider-stack, and research-reference assumptions no longer match the live repo. |
| `docs/tasks/spell-system-overhaul/IMPLEMENT-AI-ARBITRATION-SERVICE.md` | `work-item` + `follow-through` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 as a live follow-through brief after confirming the arbitrator backend exists, while UI proof-of-life, caching, prompt quality, and terrain fallback remain the real open concerns. |
| `docs/tasks/spell-system-overhaul/GAP-01-AI-INPUT-UI.md` | `reference` + `gap-note` | `processed` | `rewrite in place` | Manual audit and repo verification completed. Rewritten 2026-03-11 after confirming that `AISpellInputModal.tsx` and `useAbilitySystem` input-request handling already exist, so the gap is now wiring/proof-of-life rather than total UI absence. |
| `docs/tasks/spell-system-overhaul/GAP-02-EXAMPLE-AI-SPELLS.md` | `reference` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that AI-tagged spell JSON already exists, while the remaining issue is curating stronger proof-of-life examples with meaningful prompts and input requirements. |
| `docs/tasks/spell-system-overhaul/GAP-03-AI-CACHING.md` | `reference` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Kept live and tightened 2026-03-11 after confirming the arbitrator exists but no `ArbitrationCache.ts` was found in the current AI surface. |
| `docs/tasks/spell-system-overhaul/GAP-04-REAL-TERRAIN-DATA.md` | `reference` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that `MaterialTagService` already uses concrete submap tile information when available, while the real remaining risk is the biome-level fallback path. |
| `docs/archive/spell-system/AGENT-ALPHA-TYPES.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a historical single-agent ownership brief tied to the older parallel spell-system plan. |
| `docs/tasks/spell-system-overhaul/AGENT-ALPHA-TYPES.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so existing references keep resolving while the full brief lives in archive. |
| `docs/archive/spell-system/AGENT-BETA-TARGETING.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a historical single-agent ownership brief tied to the older parallel spell-system plan. |
| `docs/tasks/spell-system-overhaul/AGENT-BETA-TARGETING.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so existing references keep resolving while the full brief lives in archive. |
| `docs/archive/spell-system/AGENT-GAMMA-COMMANDS.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a historical single-agent ownership brief tied to the older parallel spell-system plan. |
| `docs/tasks/spell-system-overhaul/AGENT-GAMMA-COMMANDS.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so existing references keep resolving while the full brief lives in archive. |
| `docs/archive/spell-system/AGENT-DELTA-MECHANICS.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a historical single-agent ownership brief tied to the older parallel spell-system plan. |
| `docs/tasks/spell-system-overhaul/AGENT-DELTA-MECHANICS.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so existing references keep resolving while the full brief lives in archive. |
| `docs/archive/spell-system/AGENT-EPSILON-AI.md` | `archive` + `coordination` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a historical single-agent ownership brief tied to the older parallel spell-system plan. |
| `docs/tasks/spell-system-overhaul/AGENT-EPSILON-AI.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so existing references keep resolving while the full brief lives in archive. |
| `docs/archive/spell-system/AGENT-PROMPTS-STUB-COMPLETION.md` | `archive` + `prompt-pack` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it is a completed prompt pack for an older stub-completion phase rather than a current task-tree authority. |
| `docs/tasks/spell-system-overhaul/AGENT-PROMPTS-STUB-COMPLETION.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Manual repo verification completed. Replaced 2026-03-11 with a historical pointer so the old path survives while the full prompt pack lives in archive. |
| `docs/archive/spell-system/cantrips/@SPELL-AUDIT-CANTRIPS.md` | `archive` + `audit` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 because its coverage tables had become stale against the current `public/data/spells/level-0/` folder. |
| `docs/archive/spell-system/cantrips/CANTRIP-MIGRATION-KNOWLEDGE.md` | `archive` + `knowledge` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 because it preserved useful project history, but its batch-status table and workflow assumptions were no longer current. |
| `docs/archive/spell-system/cantrips/1I-MIGRATE-CANTRIPS-BATCH-1.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1J-MIGRATE-CANTRIPS-BATCH-2.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1K-MIGRATE-CANTRIPS-BATCH-3.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1L-MIGRATE-CANTRIPS-BATCH-4.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1M-MIGRATE-CANTRIPS-BATCH-5.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1N-MIGRATE-CANTRIPS-BATCH-6.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1O-MIGRATE-CANTRIPS-BATCH-7.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1P-MIGRATE-CANTRIPS-BATCH-8.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/archive/spell-system/cantrips/1Q-MIGRATE-CANTRIPS-BATCH-9.md` | `archive` + `batch-record` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/cantrips/` on 2026-03-11 as a completed historical batch record from the cantrip migration phase. |
| `docs/tasks/spell-system-overhaul/COMPLETE-STUB-COMMANDS.md` | `work-item` + `completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming `HealingCommand` already handles `isTemporaryHp`, `StatusConditionCommand` still carries the live condition-expiry TODO, and the remaining defensive gaps are lifecycle concerns rather than missing temp-HP overlap handling. |
| `docs/tasks/spell-system-overhaul/TASK-01.5-TYPE-PATCHES.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 as preserved task context after confirming the requested type, validator, and schema surfaces already exist, while the older validator path, script names, and spell-wizard assumptions no longer match the live repo. |
| `docs/tasks/spell-system-overhaul/IMPLEMENT-REMAINING-EFFECT-COMMANDS.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that movement, summoning, terrain, utility, and defensive command files already exist and are routed by `SpellCommandFactory`, while deeper runtime coverage still needs follow-through. |
| `docs/tasks/spell-system-overhaul/IMPLEMENT-AOE-ALGORITHMS.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming the AoE suite already exists under `src/systems/spells/targeting`, the utility-layer imports are now deprecated bridges, and the older cone/test-path assumptions no longer describe the live implementation. |
| `docs/tasks/spell-system-overhaul/IMPLEMENT-CONCENTRATION-TRACKING.md` | `work-item` + `implementation-spec` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that concentration tracking now exists across combat types, concentration commands, damage-triggered checks, helper utilities, and UI-adjacent surfaces, while full end-to-end voluntary-drop proof and cleanup breadth still merit follow-through. |
| `docs/tasks/spell-system-overhaul/TODO_OBJECT_TARGETING.md` | `reference` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 as an active rebased gap note after confirming that the spell target filter knows about `objects` but the live resolver remains `CombatCharacter`-only and currently rejects object targeting through the verified path. |
| `docs/tasks/spell-system-overhaul/11A-DYNAMIC-LIGHTING-SUPPORT.md` | `work-item` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that `light.json` already uses a structured `light` block, combat state already stores `activeLightSources`, `UtilityCommand` already creates light sources, and the real remaining gap is expiration/renderer follow-through rather than schema absence. |
| `docs/tasks/spell-system-overhaul/11B-SAVE-PENALTY-RIDER.md` | `work-item` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that `mind-sliver.json` already uses `savePenalty`, combat types already define `SavePenaltyRider`, `UtilityCommand` already registers penalties, and `SavePenaltySystem` already handles consumption/expiry. |
| `docs/tasks/spell-system-overhaul/11C-TERRAIN-UTILITY-STRUCTURES.md` | `work-item` + `gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that `mold-earth.json` already uses structured `manipulation` blocks and `TerrainCommand` already handles excavation, difficult terrain, normalization, and cosmetic shaping; the remaining gap is deeper persistence/integration proof. |
| `docs/tasks/spell-system-overhaul/1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md` | `work-item` + `status-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the package-metadata fix is already done in `package.json` and `tsconfig.json`, while the UI version-display idea remains only a possible future UI task. |
| `docs/archive/spell-system/1D-ARCHIVE-OLD-SPELL-DOCS.md` | `archive` + `task-brief` | `processed` | `move to archive` | Manual repo/docs verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it described an earlier archive/salvage phase whose `SALVAGED_SPELL_CONTEXT.md` and local archive-lane assumptions never became the maintained workflow. |
| `docs/tasks/spell-system-overhaul/1D-ARCHIVE-OLD-SPELL-DOCS.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Replaced 2026-03-11 with a compatibility pointer so numbered-task references keep resolving while the full historical brief lives in archive. |
| `docs/archive/spell-system/1E-CONSOLIDATE-JULES-WORKFLOW.md` | `archive` + `task-brief` | `processed` | `move to archive` | Manual repo/docs verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because the current workflow surfaces already exist and the brief's missing-file references and deliverable language had become historical. |
| `docs/tasks/spell-system-overhaul/1E-CONSOLIDATE-JULES-WORKFLOW.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Replaced 2026-03-11 with a compatibility pointer so numbered-task references keep resolving while the full historical brief lives in archive. |
| `docs/archive/spell-system/1F-AUDIT-SPELL-SCOPE.md` | `archive` + `task-brief` | `processed` | `move to archive` | Manual repo/docs verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because it belonged to the earlier cantrip-audit phase and pointed at a deliverable that is now itself historical. |
| `docs/tasks/spell-system-overhaul/1F-AUDIT-SPELL-SCOPE.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Replaced 2026-03-11 with a compatibility pointer so numbered-task references keep resolving while the full historical brief lives in archive. |
| `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md` | `plan` + `tooling-concept` | `processed` | `move` | Manual doc-tree verification completed. Moved on 2026-03-11 out of the spell subtree because it is a future tooling/versioning concept, not a spell-system implementation task. |
| `docs/tasks/spell-system-overhaul/1F-VERSION-REVIEW-AGENT-CONCEPT.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Replaced 2026-03-11 with a compatibility pointer so numbered-task references keep resolving while the full concept note lives under `docs/plans/tooling/`. |
| `docs/archive/spell-system/1G-REORGANIZE-SPELL-FILES.md` | `archive` + `task-brief` | `processed` | `move to archive` | Manual repo verification completed. Moved into `docs/archive/spell-system/` on 2026-03-11 because the flat-to-level-folder spell-file reorganization is already reflected in `public/data/spells/level-*` and the live manifest/loader flow. |
| `docs/tasks/spell-system-overhaul/1G-REORGANIZE-SPELL-FILES.md` | `compatibility` + `pointer` | `processed` | `rewrite in place` | Replaced 2026-03-11 with a compatibility pointer so numbered-task references keep resolving while the full historical brief lives in archive. |

## Spell Completeness Audit Entry Surface

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md | work-item + gap-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the shared glossary loader and tooltip already exist, while the spell-specific template file, spell metadata field, and spell-detail lazy-link integration do not. |
| docs/tasks/spell-completeness-audit/@PROJECT-INDEX.md | index + work-item | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 after confirming the audit outputs still exist, the downstream spell migration guide still exists, and no LEVEL-*.md reference files were found under docs/spells/reference during this pass. |
| docs/tasks/spell-completeness-audit/@WORKFLOW.md | workflow | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 to preserve the historical audit procedure while correcting the current-state warnings around missing spell glossary markdown paths and absent level reference outputs. |
| docs/tasks/spell-completeness-audit/@SPELL-COMPLETENESS-REPORT.md | reference + historical snapshot | processed | rewrite in place | Manual docs-tree verification completed. Preserved as a Dec 2025 audit snapshot on 2026-03-11 after confirming that its supporting LOCAL-INVENTORY and PHB-2024-REFERENCE source files still exist, without claiming a fresh PHB rerun. |

| docs/tasks/spell-completeness-audit/1A~INVENTORY-LOCAL-SPELLS.md | work-item + completion-note | processed | rewrite in place | Manual docs-tree verification completed. Rewritten 2026-03-11 as a preserved completion note after confirming that output/LOCAL-INVENTORY.md still exists. |
| docs/tasks/spell-completeness-audit/1B~RESEARCH-PHB-2024-LIST.md | work-item + completion-note | processed | rewrite in place | Manual docs-tree verification completed. Rewritten 2026-03-11 as a preserved completion note after confirming that output/PHB-2024-REFERENCE.md still exists, without claiming a fresh external-source rerun. |
| docs/tasks/spell-completeness-audit/1C~GAP-ANALYSIS.md | work-item + completion-note | processed | rewrite in place | Manual docs-tree verification completed. Rewritten 2026-03-11 as a preserved completion note after confirming that its input outputs still exist and that @SPELL-COMPLETENESS-REPORT.md remains preserved as a Dec 2025 snapshot. |

| docs/tasks/spell-completeness-audit/2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md | work-item + extraction-plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 as a preserved extraction plan after confirming that docs/spells/reference exists but no LEVEL-1-REFERENCE.md file was found during this pass. |
| docs/tasks/spell-completeness-audit/2B-EXTRACT-REMAINING-LEVELS.md | work-item + extraction-plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 as a preserved extraction plan after confirming that no LEVEL-2 through LEVEL-9 reference markdown files were found under docs/spells/reference during this pass. |

| docs/tasks/spell-completeness-audit/PROPOSED_SCHEMA_V2.md | reference + design-note | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 after confirming that the granular field-by-field format it proposes is already reflected in the current per-spell reference lane under docs/spells/reference/level-*. |

## Town Description System Project Docs

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/projects/town-description-system/README.md` | `index` + `project-overview` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 to preserve the project intent while correcting the current-state baseline against `TownCanvas.tsx`, `useTownController.ts`, `villageGenerator.ts`, `settlementGeneration.ts`, `state.ts`, and `saveLoadService.ts`. |
| `docs/projects/town-description-system/QUICK_START.md` | `workflow` + `project-reentry` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 as a safe re-entry guide after confirming that several originally proposed files and types do not exist, while core town rendering, deterministic seeding, layout generation, and save/load infrastructure do. |
| `docs/projects/town-description-system/IMPLEMENTATION_PLAN.md` | `plan` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 to preserve the intended multi-phase direction while removing the false week-by-week implication that the listed architecture still reflected the live repo exactly. |
| `docs/projects/town-description-system/TASKS.md` | `work-item` + `backlog` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 as a verified backlog tied to the current town, world, and save surfaces instead of the older speculative file-creation plan. |
| `docs/projects/town-description-system/TECHNICAL_SPEC.md` | `reference` + `design-spec` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 to separate live foundations from proposed additions after confirming that current town rendering, layout generation, and save/load infrastructure exist, while `TownMetadata`, `TownDescription`, `DetailLevel`, and the dedicated town-description services do not. |
## Improvements Slice A

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/improvements/09_remove_obsolete_files.md` | `historical completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the old deletion targets no longer exist at the listed paths, so the file now serves as provenance rather than a live cleanup checklist. |
| `docs/improvements/12_expand_village_system.md` | `improvement-brief` + `historical plan` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that town/village generation, town rendering, and settlement-flavor scaffolding already exist in `App.tsx`, `VillageScene.tsx`, `TownCanvas.tsx`, `useTownController.ts`, `villageGenerator.ts`, and `settlementGeneration.ts`, while deeper persistence and town-description layers remain open. |
| `docs/improvements/CREATURE-TYPE-ENUM-AND-REQUIREMENT.md` | `improvement-brief` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that creature-type strings are already used across combat and spell validation/targeting surfaces, but no single canonical enum/schema source currently governs them. |
## Improvements Slice B

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/improvements/SETTINGS_MENU_PLAN.md` | `plan` + `ui-feature` | `processed` | `rewrite in place` | Manual repo verification completed. Verified 2026-03-11 against `MainMenu.tsx` and the current `src` tree; the file's rebased wording correctly treats a dedicated settings surface as still missing while preserving the feature need. |
| `docs/improvements/MALLEABLE_WORLD_DEV_NOTES.md` | `reference` + `experimental-subsystem-note` | `processed` | `rewrite in place` | Manual repo verification completed. Verified 2026-03-11 against the experimental ThreeD deformation stack (`DeformationManager.ts`, `DeformableTerrain.tsx`, `OverlayMesh.tsx`, `types.ts`, `DeformableScene.tsx`); the file now accurately describes an existing experimental lane rather than a purely hypothetical one. |
| `docs/improvements/SPRITE-POSE-CONTROL-VARIANTS.md` | `feature-request` + `presentation-gap-note` | `processed` | `rewrite in place` | Manual repo verification completed. Verified 2026-03-11 against `UtilityCommand.ts` and repo-wide search; the control-option gameplay hook exists, but no pose-variant manifest, sprite-swap lane, or bestiary variant system was found. |
| `docs/improvements/DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md` | `tooling-plan` + `process-note` | `processed` | `rewrite in place` | Manual repo/docs verification completed. Verified 2026-03-11 against `AGENTS.md`, the active registry ledgers, the roadmap orchestration contract, and `.agent/roadmap-local/tooling_state.sqlite`; the file now reads as a preserved tooling-improvement note instead of a literal backlog for speculative scripts. |

## Improvements Completed Slice A

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| `docs/improvements/completed/01_consolidate_repetitive_components.md` | `historical completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the shared `RacialSpellAbilitySelection.tsx` component exists, the old race-specific spellcasting components are gone, and the live character-creator flow now uses shared racial-selection structures. |
| `docs/improvements/completed/02_decouple_configuration.md` | `historical completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the `src/config/` lane and the targeted config modules already exist, while the older note's larger dynamic-config ambitions remain aspirational rather than completed product behavior. |
| `docs/improvements/completed/03_refactor_player_character_type.md` | `historical completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the live `PlayerCharacter` model in `src/types/character.ts` now uses `racialSelections`, making the older `src/types.ts` targeting historical. |
| `docs/improvements/completed/04_externalize_css.md` | `historical completion-note` | `processed` | `rewrite in place` | Manual repo verification completed. Rewritten 2026-03-11 after confirming that `public/styles.css` exists, `index.html` links it, and the stylesheet has since grown into a modular external CSS lane beyond the original extraction step. |

## Improvements Completed Slice B

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/improvements/completed/05_standardize_api_error_handling.md | historical completion-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that StandardizedResult<T> now lives in src/services/gemini/types.ts, the Gemini service facade returns that contract across the active API surface, and the broader AI-service lane has already converged on that standardized result shape. |
| docs/improvements/completed/06_optimize_submap_rendering.md | historical completion-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the extracted memoized tile component exists at src/components/Submap/SubmapTile.tsx, SubmapPane.tsx renders it directly, and the current implementation uses memoized derived data plus stable callbacks rather than the older inline-grid approach. |
| docs/improvements/completed/07_invert_reducer_action_logic.md | historical completion-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that handleItemInteraction.ts now constructs the DiscoveryEntry and dispatches APPLY_TAKE_ITEM_UPDATE, while appState.ts applies the prepared payload rather than reconstructing the business logic for the take_item example. |
| docs/improvements/completed/10_enhance_loading_transition.md | historical completion-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that LoadGameTransition now lives under src/components/SaveLoad, LOAD_GAME_SUCCESS enters GamePhase.LOAD_TRANSITION, and App.tsx performs the timed handoff from transition state to PLAYING. |
## Architecture Slice A

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/README.md | architecture-guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that docs/architecture/_generated and scripts/generate-architecture-compendium.ts still exist, while the older guide overclaimed a validate:spells npm script that is not present in the current package.json. |
| docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md | architecture-note + reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live spell data, validation, loading, and execution surfaces, while correcting the stale spellAbilityFactory path, the missing manifest-generator script reference, and the nonexistent validate:spells command. |
| docs/architecture/VISIBILITY_SYSTEM.md | architecture-note + reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that VisibilitySystem and useVisibility exist, but the live APIs are calculateLightLevels and calculateVisibility rather than the older calculateLightLevels ambientLight and getVisibleTiles wording, and current battle-map integration remains unverified in this pass. |
## Architecture Domain Slice A

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/spells.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live spell data, validation, service, context, gate-check, and spell-ability-factory surfaces, while removing stale path and migration-status claims. |
| docs/architecture/domains/combat.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live combat UI, hooks, systems, events, and utility lanes, while softening stale over-precise ownership claims. |
| docs/architecture/domains/world-map.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the live MapPane is now an Azgaar-embed world-map bridge rather than the older pure CSS-scaled grid model described in the original file. |
## Architecture Domain Slice B

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/glossary.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that GlossaryContext.tsx now loads glossary entries from public/data/glossary/index/main.json and nested index files, while the older src/data/glossaryData.ts claim had drifted into a submap icon-meanings file and the old glossaryUtils path now acts as a deprecated bridge. |
| docs/architecture/domains/submap.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that SubmapPane.tsx, useSubmapProceduralData.ts, and the colocated helper/config split now define the live submap architecture, while the older hook-directory and all-Pixi wording had drifted from the current repo shape. |
| docs/architecture/domains/town-map.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live TownCanvas plus VillageScene split, the RealmSmith generator stack, townReducer.ts, and town types, while removing the stale lowercase services/realmsmith lane and the nonexistent MerchantModal test claim. |
## Architecture Domain Slice C

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/character-creator.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live CharacterCreator subtree now owns the main assembly hook, reducer-driven step flow, persisted creator state, and the broader age/background/visuals/class-feature/weapon-mastery path that the older doc had under-described. |
| docs/architecture/domains/character-sheet.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live CharacterSheetModal now lives under src/components/CharacterSheet/, the tabbed CharacterSheet subtree is the real architecture unit, and the older top-level modal, Party, SpellbookOverlay, and utility-path assumptions had drifted. |
| docs/architecture/domains/battle-map.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that CombatView is the live battle-map entry surface, useBattleMapGeneration.ts is now a stateless generation utility, and the BattleMap subtree now includes a broader cluster of UI surfaces than the older doc described. |
## Working Rules

- No file is marked `processed` until its claims have been checked against the repo and any required rewrite, move, archive, or ledger follow-through is complete.
- Archive-note-only changes are metadata improvements, not full file processing, unless the full claim audit and disposition work also happened.
- Historical value is preserved by moving or archiving docs, not by leaving false claims inside canonical docs.
- Scripts may help list files or confirm path existence, but reasoning, interpretation, and disposition remain manual.
- The first-wave task does not stop when one review band is cleared. Work continues until every in-scope first-wave doc under `docs/` has a final ledger status, unless a hard blocker or explicit user redirect intervenes.










## Architecture Domain Slice D

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/commands.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the live command lane now spans both spell and combat-ability execution through SpellCommandFactory.ts, AbilityCommandFactory.ts, AbilityEffectMapper.ts, CommandExecutor.ts, and the current src/commands test suite. |
| docs/architecture/domains/core-systems.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming App.tsx, GameContext.tsx, appState.ts, initialState.ts, constants.ts, and the shared services/config/types lane, while removing the older doc's catch-all ownership claims and stale generated test inventory. |
| docs/architecture/domains/data-pipelines.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the main tooling lane lives under top-level scripts/, package.json exposes validate plus charset commands, and the current script tree is broader than the older narrow build-pipeline description. |
## Architecture Domain Slice E

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/glossary-data.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the live glossary data lane is centered on public/data/glossary/ entries plus index files and glossaryData.test.ts, while public/data/spells and cantrip audit markdown remain adjacent but separate content lanes. |
| docs/architecture/domains/items-trade-inventory.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the modern Trade component subtree, Organization dashboard lane, systems/economy stack, merchant action hook, loot service, and the moved MerchantModal path under src/components/Trade/. |
| docs/architecture/domains/npcs-companions.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live systems/companions subtree, companion and dialogue reducers, useCompanionCommentary.ts, dialogueService.ts, and the supporting companion plus world-data plus entity-resolution lanes. |
## Architecture Domain Slice F

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/intrigue.md | reference + architecture-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the intrigue lane now has real implementation surfaces in IdentityManager.ts, LeverageSystem.ts, NobleHouseGenerator.ts, SecretGenerator.ts, and TavernGossipSystem.ts rather than only a conceptual future plan. |
| docs/architecture/domains/intrigue-crime.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live intrigue and crime subtrees, thieves-guild UI surfaces, crime and identity reducers, and the moved TempleModal path under src/components/Religion/. |
| docs/architecture/domains/time-world-events.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live time and world manager subtrees, world and religion reducers, landmark and stronghold services, and the newer namespaced time and faction utility paths. |
## Architecture Domain Slice G

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/naval-underdark.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live naval and underdark system subtrees, ShipPane UI, underdark service, and the current naval plus underdark test surfaces. |
| docs/architecture/domains/planes-travel.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the broader planar subtree, the current travel subtree, travel services, travel calculator utilities, and the modern planar plus travel test surface. |
| docs/architecture/domains/puzzles-quests-rituals.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming QuestManager, the QuestLog component subtree, the expanded puzzle-system lane, RitualManager, ritualReducer.ts, and the current quest plus puzzle plus ritual tests. |
## Architecture Domain Slice H

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/domains/crafting-economy.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the broad live crafting subtree, Crafting UI surfaces, and the real economy adjacency, while removing the older contradiction that claimed both pure-crafting ownership and overall-economy ownership. |
| docs/architecture/domains/creature-taxonomy.md | reference + architecture-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that CreatureTaxonomy.ts is real and tested, while correcting the stale implication that all runtime spell targeting already routes through it instead of still using TargetResolver, TargetValidationUtils, and SpellCommandFactory filtering. |
| docs/architecture/domains/environment-physics.md | reference + domain-map | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live environment, physics, and visibility system surfaces plus the current biome-data anchors and combat-physics utility tests, while removing unsupported ownership and dependency claims. |
## Architecture Feature Slice I

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/architecture/BIOME_DNA_API.md | architecture-note + experimental reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live experimental biome-generation stack in useBiomeGenerator.ts, DeformableTerrain.tsx, DeformationManager.ts, ProceduralScatter.tsx, and the BiomeWater, fog, weather, and fauna surfaces, while correcting the older implication that this was already a fully stabilized shared gameplay contract. |
| docs/architecture/features/COMPANION_FACTORY.md | feature-architecture note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that CompanionGenerator.ts, characterGenerator.ts, npcGenerator.ts, and the Ollama client stack already exist, while marking broader dynamic-party flow and persistence as only partially verified in this pass. |
## Feature And Guide Slice J

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/features/GLOSSARY-SPELL-TEMPLATE-PROPOSAL.md | feature-proposal + historical note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the glossary is already JSON-driven and generateGlossaryIndex.js already contains spell-specific manifest logic, making the old proposal partially superseded while still useful as preserved problem framing. |
| docs/blueprints/RACE_HIERARCHY_BLUEPRINT.md | blueprint + planning note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that the live race-data lane is still mostly flat under src/data/races/ and that many specialized race-selection UI components the blueprint planned to remove are still present. |
| docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md | workflow + contributor guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live JSON glossary entry format, the current glossary entry tree, and the spell-aware index-generator flow, while removing the stale external file-URL reference and older markdown-lane assumptions. |
## Spell Guide Slice K

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md | workflow + guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the real spell JSON layout, spell manifest, validation schema, and spell maintenance scripts, while removing the stale validate:spells workflow claim. |
| docs/guides/SPELL_DATA_CREATION_GUIDE.md | reference + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current spell data anchors, manifest, validator, and spell scripts, while narrowing older migration wording and removing reliance on the nonexistent validate:spells package script. |
| docs/guides/SPELL_TESTING_PROCEDURES.md | workflow + testing guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the repo's actual validate plus typecheck plus build flow and the current spell-specific scripts, while removing the stale validate:spells-first testing workflow. |

## Spell Guide Slice L

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/guides/SPELL_CONTRIBUTOR_ONBOARDING.md | onboarding guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current spell file layout, manifest, validator, spell-maintenance scripts, and status/reference docs, while removing the stale validate:spells command and the older generic external-contributor framing. |
| docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md | workflow + checklist | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current validator-required root fields, manifest regeneration flow, spell-integrity script, and broader validate plus typecheck plus build workflow, while removing stale validate:spells and older simplified field assumptions. |
| docs/guides/SPELL_TROUBLESHOOTING_GUIDE.md | troubleshooting guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the actual spell troubleshooting command surface, validator location, manifest regeneration script, and current doc drift risks, while removing stale validate:spells-first diagnostics and speculative recovery steps. |

## Guide Slice M

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/guides/@NPC-GOSSIP-SYSTEM-GUIDE.md | implementation guide + preserved reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live gossip and long-rest world-event handlers, NPC-memory reducer actions, config tuning surface, and structured KnownFact plus SuspicionLevel model, while removing the stale all-boxes-complete implementation-plan framing. |
| docs/guides/@NPC-MECHANICS-IMPLEMENTATION-GUIDE.md | implementation guide + preserved reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the live disposition, suspicion, goals, gossip, and batch-memory update lanes, while shifting the guide from a phased speculative plan to a current implementation-reference surface. |
| docs/guides/@RACE-ADDITION-DEV-GUIDE.md | workflow + developer guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that src/data/races/index.ts now auto-discovers race files, raceGroups.ts remains the grouping surface, raceNames.ts and physicalTraits.ts remain NPC-generation anchors, and scripts/generateGlossaryIndex.js exists while a glossary:index package script does not. |

## Guide Slice N

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/guides/CLASS_ADDITION_GUIDE.md | workflow + developer guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current class-data, character-creator state, assembly, and glossary-json surfaces, while removing stale single-types-file and markdown-glossary assumptions. |
| docs/guides/FEAT_SELECTION_IMPLEMENTATION_GUIDE.md | implementation guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that FeatSelection.tsx, featChoices state, and assembly-time feat application already exist, while removing the stale future-implementation framing and the nonexistent useCombatSystem hook reference. |
| docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md | design guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current JSON-entry glossary shape, generator-driven spell index, class/race grouping logic in generateGlossaryIndex.js, and the presence of scripts/add_spell.js, while removing stale markdown-entry assumptions. |

## Guide Slice O

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/guides/MCP_INTEGRATION.md | tooling guide + reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current .mcp.json config, scripts/mcp-util.ts, scripts/test-mcp-servers.ts, generate-race-images workflow, and package-level mcp scripts, while removing older over-detailed installation and server-behavior assumptions. |
| docs/guides/RACE_ADDITION_GUIDE.md | workflow + guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current race auto-discovery path, race group metadata lane, NPC generation support files, and JSON glossary race surfaces, while removing stale manual-index and markdown-glossary assumptions. |
| docs/guides/RACE_ENRICHMENT_WORKFLOW.md | workflow + sync guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current sync, audit, and verification scripts plus npm run audit:races, while narrowing the guide to the active glossary-character-creator alignment workflow. |
| docs/guides/TABLE_CREATION_GUIDE.md | design guide + workflow | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current JSON glossary-entry model and GlossaryContentRenderer path, while removing stale renderer-path and index.html-centered assumptions. |

## Spell Reference Slice P

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/CRITICAL_TYPE_GAPS_SUMMARY.md | historical audit note + spell reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming that ritual, rarity, combat/exploration casting costs, and the formerly stubbed effect lanes are now present in the current spell validator surface, so the file now reads as preserved migration history rather than an active blocker report. |
| docs/spells/SPELL_INTEGRATION_AUDIT_REPORT.md | historical audit note | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-11 after confirming that the older spell totals and maturity percentages were not freshly re-verified in this pass and should no longer present themselves as current metrics. |
| docs/spells/SPELL_PROPERTIES_REFERENCE.md | spell reference + orientation guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-11 after confirming the current validator-first spell shape, the now-present ritual and rarity fields, current casting-cost structure, and modern effect lanes, while removing the older exhaustive-schema and open-gap framing. |

## Spell Status Slice Q

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/SPELL_INTEGRATION_CHECKLIST.md | checklist + spell integration reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming the current validator, manifest, integrity script, SpellContext, SpellService, glossary spell index, and the moved spell-to-ability bridge at src/utils/character/spellAbilityFactory.ts, while removing the stale src/utils/spellAbilityFactory.ts and markdown-glossary assumptions. |
| docs/spells/SPELL_JSON_EXAMPLES.md | reference + example guide | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming real example files in public/data/spells for fire-bolt, shield, absorb-elements, magic-missile, find-familiar, light, mind-sliver, and mold-earth, while replacing the older hand-written complete-reference framing with validator-first guidance. |
| docs/spells/STATUS_LEVEL_0.md | level status note + preserved migration reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 44 level-0 spell JSON files and the live glossary spell index, while replacing the stale all-data-only framing with an inventory note plus verified cross-cutting cantrip evidence for Light, Mind Sliver, and Mold Earth. |
| docs/spells/STATUS_LEVEL_1.md | level status note + preserved migration reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 68 level-1 spell JSON files and the manifest-backed level-1 lane, while dropping the older Complete-per-spell shorthand that was stronger than this pass could honestly support. |
| docs/spells/STATUS_LEVEL_2.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 65 level-2 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_3.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 68 level-3 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |

## Spell Status Slice R

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/STATUS_LEVEL_3_PLUS.md | aggregate level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming folder counts for levels 3 through 9 and replacing the stale combined Gold-Silver-Bronze dashboard with an umbrella inventory-plus-caveat note for 292 higher-level spell JSON files. |
| docs/spells/STATUS_LEVEL_4.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 47 level-4 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_5.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 59 level-5 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_6.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 45 level-6 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_7.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 27 level-7 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_8.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 24 level-8 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |
| docs/spells/STATUS_LEVEL_9.md | level status note + historical maturity reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming 22 level-9 spell JSON files and replacing the stale Gold-Silver-Bronze grid with a current inventory-plus-caveat note. |

## Spell Status Slice S

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/SPELL_INTEGRATION_STATUS.md | reference + work-item | processed | rewrite in place | Manual repo verification completed again on 2026-03-12 after the full docs/spells status-band refresh. Updated to reflect that the level-status surface has now been re-audited, to retain the verified manifest count of 469 spell keys, and to stop warning about stale level dashboards that no longer exist in that form. |

## Plan Slice T

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/plans/2026-02-27-codex-terminal-dev-hub.md | plan + design-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming misc/dev_hub.html now contains the CODEX TERMINAL surface and vite.config.ts now contains codexChatManager, while the live implementation has drifted from the original raw-stdin design into a broader PTY plus app-server bridge shape. |
| docs/plans/2026-02-27-codex-terminal-dev-hub-impl.md | plan + implementation-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as a historical implementation note after confirming that the feature already exists in misc/dev_hub.html and vite.config.ts, while the original task-by-task insertion script is no longer the safest current execution guide. |
| docs/plans/2026-02-27-roadmap-audit-corrections.md | plan + correction-log | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that devtools/roadmap/scripts/roadmap-engine/generate.ts remains the live roadmap status-source lane, while the document now reads as one preserved correction wave rather than the sole current roadmap authority. |
| docs/plans/2026-02-27-roadmap-branch-completion-design.md | plan + design-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that the roadmap visualizer and health-signals lane now live under devtools/roadmap/src/components/debug/roadmap and that the health-signal feature set described as future work has partly landed. |
| docs/plans/2026-02-27-roadmap-branch-completion-plan.md | plan + implementation-note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that the roadmap health-signal files and tests already exist, making the original task sequence partially superseded while preserving the branch-completion intent. |

## Plan Slice U

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/plans/features/SLASHER_FEAT_DESIGN.md | feature design note + plan | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that combat-character feat ownership and feat-usage tracking already exist in src/types/combat.ts and that Slasher-specific condition names already appear in the type lane, making the older prerequisite-gap framing partially stale. |
| docs/plans/refactors/ARCH_TYPES_REFACTOR.md | refactor plan + architecture note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that src/types/core.ts, items.ts, and character.ts already exist, so the file now reads as preserved modularization rationale rather than a still-unstarted split plan. |
| docs/plans/refactors/CONFIG_REFACTOR_PLAN.md | refactor plan + research note | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that src/config/env.ts already exports ENV and assetUrl and that the remaining issue is incomplete consolidation, not total absence of a config layer. |
| docs/plans/refactors/PROPOSED_TIME_REFACTOR.md | refactor proposal | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that the repo now has a shared time utility under src/utils/core/timeUtils and active callers, making the older no-utility assumption stale. |
| docs/plans/refactors/TYPES_REFACTOR_PLAN.md | refactor plan | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that src/types/core.ts, items.ts, and character.ts already exist, so the note now serves as preserved circular-dependency rationale rather than a fresh decomposition task list. |

## Archive Reports Slice V

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/reports/@CLEANUP-CLASSIFICATION-REPORT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the report only surveyed a limited December 2025 docs slice, that its classifications and path assumptions no longer cover the current docs tree, and that current authority now lives in the active index, guide, review ledger, and migration ledger surfaces. |
| docs/archive/reports/@CONSOLIDATION-LOG.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its no-consolidation-needed conclusion applied only to an older smaller docs corpus and is superseded by the ongoing first-wave consolidation work tracked in the migration ledger. |
| docs/archive/reports/@DOCUMENTATION-SYSTEM-STATUS.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its system-ready and 100 percent pass framing is stale against the current docs tree and that live readiness must now be read from the active docs surfaces plus the review and migration ledgers. |
| docs/archive/reports/@LINK-VERIFICATION-REPORT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its link counts and broken-link classes are tied to the December 2025 docs layout and no longer serve as current link truth after the 2026 first-wave rewrites and moves. |

## Archive Reports Slice W

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/reports/DOCS_OVERVIEW.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its 78-file overview, freshness judgments, and architecture assumptions apply only to a late-2025 docs snapshot and are superseded by the ongoing first-wave ledgers. |
| docs/archive/reports/DOCS_OVERVIEW_COMPLETE_AUDIT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its gradecard, file counts, and action plan are tied to a smaller earlier docs tree and are no longer safe to treat as current status. |
| docs/archive/reports/AUDIT_ACTIONS_COMPLETED.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its claimed completed actions belong to a late-2025 audit wave and cannot stand in for current repo verification or current overhaul state. |
| docs/archive/reports/SCOUT_RUN_SUMMARY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its PR verdicts and conflict cluster are time-bound scout results, not current roadmap or branch truth. |

## Archive Reports Slice X

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/reports/DEAD_CODE_REPORT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the cited legacy merchant strings are not present in the current useGameActions.ts file and that the cited src/components/ActionPane.tsx path no longer exists, so the file now serves as historical cleanup provenance rather than a live dead-code queue. |
| docs/archive/reports/LEGACY_CODE_REPORT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that mergeWithLegacySaves and getDurationInRounds still exist, while the older useAbilitySystem dual-path warning is partly stale because the file now explicitly notes that applyAbilityEffects was removed and the logic moved into AbilityCommandFactory. |
| docs/archive/reports/REMOVAL_LOGIC.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the root components directory is absent in the current repo, so the file now acts as historical proof for an already completed removal. |
| docs/archive/reports/TESTING_SUMMARY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the current AbilityScoreAllocation.tsx file has since removed handleScoreSelect and that the original report never met the current visual-verification bar for UI claims because browser verification was unavailable. |

## Archive Reports Slice Y

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/reports/CONTRIBUTING_MANUS.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its Manus-specific sync and push-to-master workflow is not the current authoritative agent contract and now survives only as historical workflow provenance. |
| docs/archive/reports/NEXT-DOC-REVIEW-PROMPT.md | historical prompt artifact | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the active first-wave queue now lives in the review and migration ledgers, not in per-file review-prompt artifacts like this one. |
| docs/archive/reports/NEXT-DOC-REVIEW.md | historical prompt artifact | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that this prompt's review-routing assumptions belong to the December 2025 audit wave and should not compete with the current ledger-driven process. |
| docs/archive/reports/review_worklogs.md | historical worklog synthesis | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that it aggregates time-bound worklog fragments and future ideas rather than representing a current backlog or roadmap surface. |
| docs/archive/reports/V1.1_BUG_VERIFICATION_REPORT.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that although some findings remain historically grounded, the report's bug-status conclusions are dated and cannot stand in for current subsystem verification. |

## Spell Archive Slice Z

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-docs-2025-12/README.md | archive index + historical reference | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 so the folder README now clearly frames the lane as preserved spell-migration provenance and points readers back to the live spell status, checklist, examples, and spell-overhaul entry docs. |
| docs/archive/spell-docs-2025-12/COMPONENT_DEPENDENCIES.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its older dependency plan is no longer the maintained integration guide and that current spell-integration guidance now lives in the refreshed live spell docs. |
| docs/archive/spell-docs-2025-12/FINAL_SUMMARY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its PR 38 and PR 39 workflow handoff belongs to a late-2025 milestone moment and is no longer the live spell-workflow entry point. |
| docs/archive/spell-docs-2025-12/UPDATES-SUMMARY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its batch-fix commands and workflow assumptions belong to a late-2025 spell workflow and no longer match the maintained current spell guidance. |

## Spell Archive Slice AA

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-system/README.md | archive index + historical reference | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 so the folder README now frames the lane as historical spell-system provenance and points readers back to the maintained spell status, checklist, examples, and spell-overhaul entry docs. |
| docs/archive/spell-system/@SPELL-SYSTEM-OVERHAUL-TODO.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its Gold Standard framing preserves real architecture intent but no longer serves as the live spell-overhaul hub because its paths, counts, and implementation-state assumptions drifted. |
| docs/archive/spell-system/SPELL_SYSTEM_MERGE_SUMMARY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its branch and merge guidance is inherently time-bound and no longer a current spell-system status surface. |
| docs/archive/spell-system/SPELL_MIGRATION_PATH.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its totals, milestones, and tooling assumptions belong to an older spell-migration strategy snapshot rather than the maintained current workflow. |
| docs/archive/spell-system/TASK_STRATEGY_UPDATE.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its cantrip-first coordination strategy depended on PR-specific choreography and older template assumptions that no longer define the current spell workflow. |

## Spell Archive Slice AB

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-system/00-AGENT-COORDINATION.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its standups, blocker tasks, ownership table, and phase rules belong to the late-2025 parallel spell push rather than the current ledger-driven spell workflow. |
| docs/archive/spell-system/00-DATA-VALIDATION-STRATEGY.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that spellValidator.ts and spell.schema.json do exist and now cover ritual, rarity, combatCost, and explorationCost, while the broader tooling and workflow claims in the original note are no longer the maintained validation contract. |
| docs/archive/spell-system/00-PARALLEL-ARCHITECTURE.md | historical report + archive snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that parts of the proposed modular split landed, but the full module map did not become the current repo shape and the original ownership and standup rules are now historical only. |
| docs/archive/spell-system/AGENT-ALPHA-TYPES.md | historical ownership brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the live repo still uses src/types/spells.ts plus the spell validator and schema surfaces, while this brief now serves only as historical ownership provenance. |
| docs/archive/spell-system/AGENT-BETA-TARGETING.md | historical ownership brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that AoECalculator.ts exists under src/systems/spells/targeting, while the brief's active ownership and handoff language belongs to the late-2025 parallel-agent phase. |
| docs/archive/spell-system/AGENT-GAMMA-COMMANDS.md | historical ownership brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the command migration landed along a different path than the brief prescribed, including the live factory at src/commands/factory/SpellCommandFactory.ts and the current useAbilitySystem note about applyAbilityEffects having been removed. |

## Spell Archive Slice AC

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-system/AGENT-DELTA-MECHANICS.md | historical ownership brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that mechanics surfaces such as ScalingEngine.ts and SavingThrowResolver.ts do exist, while the brief's ownership and sequencing language belongs to the late-2025 parallel-agent phase. |
| docs/archive/spell-system/AGENT-EPSILON-AI.md | historical ownership brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/systems/spells/ai/AISpellArbitrator.ts exists, while the brief itself now serves only as historical AI-lane provenance rather than current tasking authority. |
| docs/archive/spell-system/AGENT-PROMPTS-STUB-COMPLETION.md | historical prompt pack | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the prompt bundle belongs to a completed stub-command phase and should no longer read as live execution guidance. |
| docs/archive/spell-system/1D-ARCHIVE-OLD-SPELL-DOCS.md | historical task brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its salvage-path and local archive assumptions did not become the maintained current workflow surface. |
| docs/archive/spell-system/1E-CONSOLIDATE-JULES-WORKFLOW.md | historical task brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the workflow consolidation work it described has already landed in the maintained spell-overhaul subtree. |
| docs/archive/spell-system/1F-AUDIT-SPELL-SCOPE.md | historical task brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that it points toward a cantrip-audit deliverable that is now itself historical and that current cantrip status lives elsewhere. |
| docs/archive/spell-system/1G-REORGANIZE-SPELL-FILES.md | historical task brief | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the public/data/spells/level-* layout already exists and that this file now serves only as provenance for that one-time reorganization. |

## Spell Archive Slice AD

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-system/cantrips/README.md | archive index + historical reference | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that public/data/spells/level-0 now contains 44 cantrip JSON files, that multiple once-missing cantrips now exist there, and that the maintained cantrip status surface is docs/spells/STATUS_LEVEL_0.md rather than this archive lane. |
| docs/archive/spell-system/cantrips/@SPELL-AUDIT-CANTRIPS.md | historical audit snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its missing-locally section drifted because guidance, light, mind-sliver, mold-earth, primal-savagery, sapping-sting, shape-water, and sword-burst now exist under public/data/spells/level-0. |
| docs/archive/spell-system/cantrips/CANTRIP-MIGRATION-KNOWLEDGE.md | historical coordination note | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that several batch-status claims and glossary-entry assumptions drifted, while preserving the migration-wave knowledge about early cantrip schema pressure. |
| docs/archive/spell-system/cantrips/1I-MIGRATE-CANTRIPS-BATCH-1.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 1's listed spells already exist in public/data/spells/level-0 and that the file now serves as provenance for early trigger and target-filter gap discovery rather than live tasking. |
| docs/archive/spell-system/cantrips/1J-MIGRATE-CANTRIPS-BATCH-2.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that guidance.json now exists under public/data/spells/level-0 and that the file's glossary-path and missing-spell instructions no longer describe the maintained lane. |
| docs/archive/spell-system/cantrips/1K-MIGRATE-CANTRIPS-BATCH-3.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that light, mind-sliver, mold-earth, primal-savagery, and sapping-sting now all exist under public/data/spells/level-0 and that later spell-overhaul docs already verified the lighting, save-rider, and terrain lanes this batch once framed as missing. |
| docs/archive/spell-system/cantrips/1L-MIGRATE-CANTRIPS-BATCH-4.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 4's listed spells now exist under public/data/spells/level-0 and that its older glossary-entry path and validation-wave instructions are historical only. |

## Spell Archive Slice AE

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/spell-system/cantrips/1M-MIGRATE-CANTRIPS-BATCH-5.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 5's listed spells now exist under public/data/spells/level-0 and that the file's remaining value is its historical note about stealth, noise, and illusion-style schema pressure. |
| docs/archive/spell-system/cantrips/1N-MIGRATE-CANTRIPS-BATCH-6.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 6's listed spells now exist under public/data/spells/level-0 and that its resistance/save-bonus discussion is preserved as historical schema pressure rather than current missing-feature truth. |
| docs/archive/spell-system/cantrips/1O-MIGRATE-CANTRIPS-BATCH-7.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 7's listed spells now exist under public/data/spells/level-0 and that the batch now serves only as provenance for touch, stabilization, and pull-effect migration work. |
| docs/archive/spell-system/cantrips/1P-MIGRATE-CANTRIPS-BATCH-8.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that Batch 8's listed spells now exist under public/data/spells/level-0 and that the file now serves as historical provenance for the 2024 true-strike rewrite and related cantrip migration handling. |
| docs/archive/spell-system/cantrips/1Q-MIGRATE-CANTRIPS-BATCH-9.md | historical batch-execution record | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that elementalism and starry-wisp now exist under public/data/spells/level-0 and that the file should be read only as the preserved extras-lane batch record. |

## Archive Root Slice AF

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/@README.md | archive index + historical reference | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the archive now contains additional preserved report and spell-migration lanes beyond the older short folder list, and that current documentation authority lives in the active docs tree and registry ledgers instead of this archive root README. |
| docs/archive/@FEATURES-COMPLETED.md | historical feature snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its December 2025 completion language is too time-bound to act as the current feature register and that current backlog surfaces now live in the active docs tree. |
| docs/archive/AGENT-COORDINATION-REVIEW.md | historical review report | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the spell coordination files it reviewed have since been re-audited directly and now live as archive/provenance material rather than active workflow authority. |
| docs/archive/DOCUMENT-REVIEW-SUMMARY.md | historical review summary | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its next-review routing and task-file creation guidance belong to the December 2025 review wave, while the current queue of record lives in the registry ledgers. |
| docs/archive/SPELL-SYSTEM-RESEARCH-REVIEW.md | historical review report | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that it captures an early-December 2025 spell-status assessment and should now be read only as review provenance rather than the current spell capability report. |

## Archive Branch Cleanup Slice AG

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/2025-12-branch-cleanup/BRANCH_CLEANUP_SUMMARY.md | historical branch-maintenance snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its branch names, branch counts, and next-step guidance are tied to a single December 2025 cleanup wave and cannot stand as current remote-branch truth. |
| docs/archive/2025-12-branch-cleanup/QUICK_WINS_MERGE_SUMMARY.md | historical branch-maintenance snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its merge outcomes and conflict notes are valuable provenance for one quick-wins merge wave, but no longer define the current branch queue. |
| docs/archive/2025-12-branch-cleanup/REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md | historical branch-analysis summary | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its delete commands, duplicate warnings, and merge-order recommendations were tied to one remote snapshot and should not be treated as current branch-management truth. |
| docs/archive/2025-12-branch-cleanup/REMOTE_BRANCH_ANALYSIS.md | historical branch-analysis snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that its ahead-behind lines, activity times, and branch counts are time-bound raw snapshot data and that the file also carries encoding noise that makes it unsuitable as a current operational surface. |

## Archive Bug Slice AH

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/bugs/2025-11-submap-rendering/CRITICAL_BUG_SUBMAP_RENDERING.md | historical bug report | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the originally cited path src/components/SubmapRendererPixi.tsx is absent from the current repo and that the present submap lane now lives under src/components/Submap, so the file now serves as historical incident provenance rather than a current bug ticket. |
| docs/archive/bugs/2025-11-submap-rendering/FIX_APPLIED_SUBMAP.md | historical fix snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the old Pixi renderer path is absent, which means the note cannot stand as current proof of a modern visual fix; the file now preserves one past fix attempt and explicitly marks that the current visual-verification standard was not re-satisfied by this archive note. |

## Archive Improvements Slice AI

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/improvements/01_consolidate_repetitive_components.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx exists, so the file now serves as preserved rationale for a landed character-creator consolidation rather than an active plan. |
| docs/archive/improvements/02_decouple_configuration.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/config plus submapVisualsConfig.ts, npcBehaviorConfig.ts, mapConfig.ts, and characterCreationConfig.ts all exist, so the file now serves as preserved rationale for a landed config-layer refactor rather than an active extraction brief. |
| docs/archive/improvements/03_refactor_player_character_type.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that racialSelections now appears in src/types/character.ts and is documented in src/types/README.md, while the plan's old single-file types path assumption is no longer current. |
| docs/archive/improvements/04_externalize_css.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that public/styles.css exists, while also marking that the plan's older no-build-tool architecture framing drifted from the current broader frontend/tooling reality. |
| docs/archive/improvements/05_standardize_api_error_handling.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/services/geminiService.ts and src/state/actionTypes.ts still exist, while narrowing the file to preserved error-handling rationale instead of current service-contract authority. |

## Archive Improvements Slice AJ

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/improvements/06_optimize_submap_rendering.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the submap lane now lives under src/components/Submap and that src/components/Submap/SubmapTile.tsx exists, making the old root-level file-path assumptions historical. |
| docs/archive/improvements/07_invert_reducer_action_logic.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that APPLY_TAKE_ITEM_UPDATE appears in src/state/actionTypes.ts, while narrowing the file to preserved reducer-pattern rationale instead of current reducer-architecture authority. |
| docs/archive/improvements/08_improve_point_buy_ui.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that AbilityScoreAllocation.tsx now explicitly comments that the unused handleScoreSelect function was removed, so the file preserves design intent rather than describing the current UI. |
| docs/archive/improvements/10_enhance_loading_transition.md | historical completed improvement plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that App.tsx still uses LOAD_TRANSITION and renders LoadGameTransition, while the implementation now loads through the SaveLoad module instead of the standalone file path proposed by the plan. |
| docs/archive/improvements/QOL_TODO_COMPLETED.md | historical completed-backlog snapshot | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that it functions as a time-bound completed-QOL snapshot rather than the current backlog authority. |

## Archive Improvements Slice AK

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/archive/improvements/11_submap_generation_deep_dive/@PLAN_CELLULAR_AUTOMATA.md | historical deep-dive plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/services/cellularAutomataService.ts exists, so the file now serves as preserved rationale for a landed CA generation enhancement rather than an active plan. |
| docs/archive/improvements/11_submap_generation_deep_dive/PLAN_BIOME_BLENDING.md | historical deep-dive plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that the current submap lane now lives in the live Submap component and data surfaces, while this file now serves as preserved biome-transition design provenance rather than maintained implementation guidance. |
| docs/archive/improvements/11_submap_generation_deep_dive/PLAN_PIXIJS_RENDERING.md | historical deep-dive plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/components/SubmapRendererPixi.tsx is absent and that the current submap lane now lives under src/components/Submap, so the file now reads as rendering-architecture exploration rather than a live renderer plan. |
| docs/archive/improvements/11_submap_generation_deep_dive/PLAN_WAVE_FUNCTION_COLLAPSE.md | historical deep-dive plan | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming that src/services/waveFunctionCollapseService.ts is absent, so the file now reads as preserved research and design provenance for an unrealized direction. |
| docs/archive/improvements/11_submap_generation_deep_dive/SUBMAP_SYSTEM_ANALYSIS.md | historical deep-dive analysis | processed | rewrite in place | Manual repo/docs verification completed. Rewritten 2026-03-12 after confirming a mixed outcome across the submap exploration packet: CA landed, WFC did not, and the live submap lane now centers on src/components/Submap plus current data and visuals files. |

## Spell Task Slice AL

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md | work-item + gap-note | processed | rewrite in place | Manual repo verification re-ran on 2026-03-12 against GlossaryContext.tsx, GlossaryTooltip.tsx, SpellDetailPane.tsx, and the current glossary data tree. The file stayed live but was tightened into a concrete capability note for Spell Description Glossary Linking and explicitly records that the template file, spell-specific glossary-entry lane, and structured spell-term metadata are still absent. |
| docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md | eference + oadmap | processed | rewrite in place | Manual repo verification re-ran on 2026-03-12 against the live levelized spell tree, the current level-2 count, 
pm run validate, and the glossary index. The file stayed live, but was rebased more concretely around Spell Data File Topology, Spell Manifest Integrity, Spell Description Glossary Linking, Migration Phase Gates, and Level Rollup Coverage Metrics. |
| docs/tasks/spell-system-overhaul/SPELL_MIGRATION_PATH.md | compatibility + pointer | processed | rewrite in place | Manual repo/docs verification re-ran on 2026-03-12. The file remains a historical pointer only and now more explicitly routes readers to the rebased roadmap, live README, TODO backlog, and leveled migration guide rather than sounding like a current strategy surface. |
| docs/tasks/spell-system-overhaul/TASK_STRATEGY_UPDATE.md | compatibility + pointer | processed | rewrite in place | Manual repo/docs verification re-ran on 2026-03-12. The file remains a historical pointer and now more explicitly retires the older PR choreography and cantrip-first execution language in favor of the current rebased roadmap and workflow surfaces. |
| docs/tasks/spell-system-overhaul/LEVEL-2-BATCHES.md | work-item + summary | processed | rewrite in place | Manual repo verification re-ran on 2026-03-12 against public/data/spells/level-2/ and the current validation lane. The file stayed live as historical rollup provenance, but now explicitly records the drift between the live 65-file folder and the rollup's 59 listed spell IDs. |
| docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md | workflow | processed | rewrite in place | Manual repo verification re-ran on 2026-03-12 against the spell-overhaul archive template, completeness-audit outputs, gaps docs, and current levelized spell folders. The file stayed live, but was tightened into a bridge playbook centered on Level-Based Spell Migration Workflow, Batch Gap Logging, Level Rollup Coverage Metrics, and Migration Phase Gates. |

## Spell Task Slice AL Correction

The earlier Spell Task Slice AL table was transport-mangled during append, so this clean correction restates the verified outcomes in plain text.

- docs/tasks/spell-system-overhaul/1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md
  Class: work-item + gap-note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification re-ran on 2026-03-12 against GlossaryContext.tsx, GlossaryTooltip.tsx, SpellDetailPane.tsx, and the current glossary data tree. The file stayed live but was tightened into a concrete capability note for Spell Description Glossary Linking and explicitly records that the template file, spell-specific glossary-entry lane, and structured spell-term metadata are still absent.

- docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md
  Class: reference + roadmap
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification re-ran on 2026-03-12 against the live levelized spell tree, the current level-2 count, npm run validate, and the glossary index. The file stayed live, but was rebased more concretely around Spell Data File Topology, Spell Manifest Integrity, Spell Description Glossary Linking, Migration Phase Gates, and Level Rollup Coverage Metrics.

- docs/tasks/spell-system-overhaul/SPELL_MIGRATION_PATH.md
  Class: compatibility + pointer
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification re-ran on 2026-03-12. The file remains a historical pointer only and now more explicitly routes readers to the rebased roadmap, live README, TODO backlog, and leveled migration guide rather than sounding like a current strategy surface.

- docs/tasks/spell-system-overhaul/TASK_STRATEGY_UPDATE.md
  Class: compatibility + pointer
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification re-ran on 2026-03-12. The file remains a historical pointer and now more explicitly retires the older PR choreography and cantrip-first execution language in favor of the current rebased roadmap and workflow surfaces.

- docs/tasks/spell-system-overhaul/LEVEL-2-BATCHES.md
  Class: work-item + summary
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification re-ran on 2026-03-12 against public/data/spells/level-2/ and the current validation lane. The file stayed live as historical rollup provenance, but now explicitly records the drift between the live 65-file folder and the rollup's 59 listed spell IDs.

- docs/tasks/spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md
  Class: workflow
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification re-ran on 2026-03-12 against the spell-overhaul archive template, completeness-audit outputs, gaps docs, and current levelized spell folders. The file stayed live, but was tightened into a bridge playbook centered on Level-Based Spell Migration Workflow, Batch Gap Logging, Level Rollup Coverage Metrics, and Migration Phase Gates.

## Spell Task Slice AM

- docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md
  Class: compatibility + pointer
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification completed on 2026-03-12 after confirming that the preserved Batch 1 record already exists in docs/archive/spell-system/cantrips/1I-MIGRATE-CANTRIPS-BATCH-1.md and that the listed cantrips already exist under public/data/spells/level-0.

- docs/tasks/spell-system-overhaul/archive/@README.md
  Class: archive index + historical reference
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification completed on 2026-03-12 after confirming that SALVAGED_SPELL_CONTEXT.md is absent from this subtree and that this local archive lane should now point readers to the maintained spell examples, checklist, roadmap, and leveled migration guide.

- docs/tasks/spell-system-overhaul/archive/SPELL_DATA_CREATION_GUIDE.md
  Class: archive guide + historical reference
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification completed on 2026-03-12 after confirming that the guide still describes an older flat or engineHook-era authoring model and no longer matches the current levelized validator-first spell lane.

- docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md
  Class: gap-note + active capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against src/types/spells.ts, spellValidator.ts, blindness-deafness.json, enhance-ability.json, and hex.json. The file stayed live, but was rebased around the verified Modal Spell Choice Handling gap: partial choice structures exist, but no general structured choice effect exists.

- docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md
  Class: gap-rollup + pointer
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification completed on 2026-03-12 against TODO.md, STATUS_LEVEL_1.md, hex.json, and find-familiar.json. The file stayed live, but was rebased into a narrow rollup pointer instead of an empty or implied full level-1 dashboard.

## Spell Completeness Output Slice AN

- docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md
  Class: historical inventory snapshot
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo/docs verification completed on 2026-03-12 after confirming that the preserved 2025 output still reports 337 level-1-through-9 spell files, while the current live levelized tree now contains 425 level-1-through-9 spell files and 469 total spell JSON files.

- docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md
  Class: historical external reference snapshot
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the file still serves as the preserved reference side of the 2025 completeness-audit packet, but should not be treated as proof that the PHB comparison has been rerun against a fresh source.

## Feature Capability Slice AO

- docs/tasks/feature-capabilities/character-creator.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against CharacterCreator.tsx, BackgroundSelection.tsx, sidebarSteps.ts, and characterCreatorState.ts. The file stayed live, but was rewritten to use current Character Creator Multi-Step Flow, Character Creator Background Confirmation, and Character Creator Step Completion Controls naming instead of generic wizard wording or overclaiming strict sidebar locks.

- docs/tasks/feature-capabilities/companion-banter.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against useCompanionBanter.ts, data/banter.ts, actionTypes.ts, and the live UI surfaces. The file stayed live, but was rewritten to reflect the implemented NPC_TO_NPC mode, PLAYER_DIRECTED mode, and ignored-player escalation path instead of implying that companion banter is still only aspirational.

- docs/tasks/feature-capabilities/merchant-pricing-economy.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against MerchantModal.tsx, economyUtils.ts, RegionalEconomySystem.ts, and FactionEconomyManager.ts. The file stayed live, but was rewritten around Merchant Price Calculation, Regional Price Modifiers, Merchant Modal Price Wiring, and Faction Trade Price Modifiers because those capabilities already exist in code.

- docs/tasks/feature-capabilities/noble-house-generation.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against noble.ts, nobleHouseGenerator.ts, and NobleIntrigueManager.ts. The file stayed live, but was rewritten to reflect implemented Noble House Seeded Variation, Noble House Identity Composition, and Noble Intrigue Event Generation foundations rather than treating the system as absent.

- docs/tasks/feature-capabilities/url-history-state-sync.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against useHistorySync.ts, actionTypes.ts, and appState.ts. The file stayed live, but was rewritten around URL Initial Mount Guard, Deep Link Restoration, and Browser Navigation Consistency because the baseline hook is already implemented.

- docs/tasks/feature-capabilities/voyage-management.md
  Class: feature capability note
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against naval.ts, actionTypes.ts, appState.ts, navalReducer.ts, travelEventService.ts, and VoyageManager.ts. The file stayed live, but was rewritten to show partial Voyage Management foundations: Voyage State Model, Voyage Action Wiring, Voyage State Progression, and Voyage Event Generation are real, while full player-facing orchestration remains less certain.

## Roadmap Task Slice AP

- docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md
  Class: roadmap handover + historical vision
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against package.json, .agent/roadmap-local/README.md, tooling_state.sqlite, roadmap-storage.ts, roadmap-session-close.ts, roadmap-process-game-docs.ts, and roadmap-derive-structured-doc.ts. The file stayed live, but was rebased into a preserved vision handover that no longer overclaims layout.json or processing_manifest.json as the whole current storage story.

- docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md
  Class: roadmap implementation plan
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against package.json and the live roadmap scripts. The file stayed live, but was rewritten to reflect the current SQLite-backed processing-state layer, the live roadmap scripts, and the remaining open plan items that still read as genuinely unfinished.

- docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md
  Class: roadmap contract
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against roadmap-storage.ts, roadmap-session-close.ts, roadmap-process-game-docs.ts, roadmap-derive-structured-doc.ts, and the packet-schema surfaces. The file stayed live, but was tightened so its storage and signal wording now matches the current repo.

- docs/tasks/roadmap/@HANDOVER-CREATION-GUIDE.md
  Class: workflow guide
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs and repo verification completed on 2026-03-12. The file stayed live, but was rewritten into a narrower process guide that no longer pretends to outrank the active roadmap contract or the live code.

- docs/tasks/roadmap/ROADMAP-TOOL-NODE-AUDIT.md
  Class: historical audit snapshot
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12. The file stayed in place, but now explicitly marks itself as a preserved 2026-03-02 audit export rather than a live node-authority surface.

- docs/tasks/roadmap/ROADMAP-TOOL-REFERENCE.md
  Class: roadmap reference
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual repo verification completed on 2026-03-12 against package.json, .agent/roadmap-local/README.md, tooling_state.sqlite, roadmap-storage.ts, roadmap-session-close.ts, roadmap-process-game-docs.ts, and roadmap-derive-structured-doc.ts. The file stayed live, but was rewritten into a narrower current-state reference that keeps only code-reverified roadmap-tool claims.

## Documentation Cleanup Slice AQ

- docs/tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that its output now belongs to docs/archive/reports/@CLEANUP-CLASSIFICATION-REPORT.md and that its old scope exclusions no longer match the current first-wave pass.

- docs/tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that it describes a December 2025 rename wave rather than the current naming authority for the docs tree.

- docs/tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive surface has evolved well beyond the file's original single-batch archive assumptions.

- docs/tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that its no-consolidation-required conclusion is a December 2025 snapshot rather than current truth.

- docs/tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that its broken-link counts and fixes are historical only after subsequent renames, moves, and archive work.

- docs/tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md
  Class: historical task brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that its December 2025 sign-off task cannot serve as current proof of documentation-system health.

## Documentation Cleanup Slice AR

- docs/tasks/documentation-cleanup/1G-MIGRATE-IMPROVEMENT-DOCS.md
  Class: historical migration campaign
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that it records a December 2025 migration wave from archive improvement docs into source-adjacent READMEs, but no longer serves as the live authority for those targets.

- docs/tasks/documentation-cleanup/1G.1-COMMON-COMPONENTS.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists and the named target README exists, but the brief's own common-components label mismatches the highly specific target path.

- docs/tasks/documentation-cleanup/1G.2-CONFIG-DECOUPLING.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists and src/config/README.md exists, making the brief historical migration provenance rather than current work instructions.

- docs/tasks/documentation-cleanup/1G.3-PLAYER-TYPES.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists and src/types/README.md exists.

- docs/tasks/documentation-cleanup/1G.4-EXTERNALIZE-CSS.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists and src/styles/README.md exists.

- docs/tasks/documentation-cleanup/1G.5-API-ERROR-HANDLING.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists and src/services/README.md exists.

- docs/tasks/documentation-cleanup/1G.6-SUBMAP-RENDERING.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the older flat target path no longer exists and the current submap README now lives under src/components/Submap/SubmapPane.README.md.

## Documentation Cleanup Slice AS

- docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists but the named target README is currently missing at src/context/README.md.

- docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists but the named target README is currently missing at src/components/CharacterCreator/README.md.

- docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive source exists but the named target README is currently missing at src/components/LoadGameTransition.README.md.

- docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md
  Class: historical migration brief
  Review status: processed
  Disposition: rewrite in place
  Evidence: Manual docs verification completed on 2026-03-12 after confirming that the archive deep-dive folder exists but the named target README is currently missing at src/features/SubmapGeneration/README.md.

## Audits Slice AU

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/audits/level-1-targeting-audit.md | audit-note + spells reference | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 after confirming that Charm Person and Animal Friendship now encode their creature-type filters, Cure Wounds and Healing Word still omit Undead and Construct exclusions, Sleep remains only partially represented, and TargetingPresets.ts plus the live runtime filter enforcement already exist. |
| docs/audits/source-references-inventory.md | generated audit snapshot | processed | rewrite in place | Manual verification completed. Reframed 2026-03-12 as a preserved generated inventory snapshot rather than a live status surface, with explicit cautions that the 2026-02-13 counts and matches include generated and historical noise. |

## Portraits Slice AV

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/portraits/race_portrait_regen_backlog.md | workflow aid + asset backlog | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 to keep the readable category backlog while clarifying that current truth now lives in the JSON backlog seed, race-image status log, and slice-of-life QA ledger. |
| docs/portraits/race_portrait_regen_handoff.md | tooling handoff + workflow | processed | rewrite in place | Manual repo verification completed. Rebased 2026-03-12 onto the still-live Gemini regen, QA, and research scripts, while removing the false impression that the old fixed snapshot counts or persisted race-profile policy already describe current output cleanly. |
| docs/portraits/race_profiles/aarakocra.md | generated portrait-profile stub | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as an explicit incomplete generated stub preserving batch metadata and QA snapshot instead of pretending to be a completed lore profile. |
| docs/portraits/race_profiles/abyssal_tiefling.md | generated portrait-profile stub | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as an explicit incomplete generated stub preserving batch metadata and QA snapshot instead of pretending to be a completed lore profile. |
| docs/portraits/race_profiles/air_genasi.md | generated portrait-profile stub | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as an explicit incomplete generated stub; this one still lacks even observed-activity capture in the stub snapshot. |
| docs/portraits/race_profiles/astral_elf.md | generated portrait-profile stub | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as an explicit incomplete generated stub preserving only useful batch metadata and QA snapshot. |
| docs/portraits/race_profiles/half_elf_aquatic.md | generated portrait-profile stub | processed | rewrite in place | Manual repo verification completed. Rewritten 2026-03-12 as an explicit incomplete generated stub preserving only useful batch metadata and QA snapshot. |

## Weapon Proficiency Slice AW

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/weapon-proficiency-system/README.md | subtree landing page | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that the subtree is no longer a greenfield plan: the helper, permissive equip rule, inventory wiring, mannequin warning, and mastery gate already exist. |
| docs/tasks/weapon-proficiency-system/START-HERE.md | subtree overview | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that the older planning-phase framing was stale and that the remaining gaps are narrower combat-facing items. |
| docs/tasks/weapon-proficiency-system/@PROJECT-INDEX.md | subtree status index | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after reconciling the subtree against current code anchors and replacing the old phase fiction with a file-by-file current-state map. |
| docs/tasks/weapon-proficiency-system/@WORKFLOW.md | subtree workflow guide | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that this subtree should now be worked as preserved implementation history plus narrow combat follow-through, not from task 01 upward. |
| docs/tasks/weapon-proficiency-system/TASK-TEMPLATE.md | generic task template | processed | keep in place | Manual review completed on 2026-03-12. The file is a reusable template rather than a truth surface and does not need rewriting for the current subtree pass. |
| docs/tasks/weapon-proficiency-system/weapon-audit-report.md | audit evidence packet | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that its December 2025 remove-isMartial recommendation is historical only because the live helper still uses category first and isMartial as fallback. |
| docs/tasks/weapon-proficiency-system/01-add-weapon-proficiency-helper.md | historical implementation note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that src/utils/character/weaponUtils.ts and its dedicated tests already exist. |
| docs/tasks/weapon-proficiency-system/02-integrate-proficiency-check.md | historical implementation note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that canEquipItem() already carries the permissive weapon warning path. |
| docs/tasks/weapon-proficiency-system/03-update-inventory-filtering.md | historical verification note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that CharacterSheet Overview InventoryList routes filtering through canEquipItem(). |
| docs/tasks/weapon-proficiency-system/04-equipped-weapon-warnings.md | historical UI implementation note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that EquipmentMannequin already renders the non-proficient weapon mismatch state in code. |
| docs/tasks/weapon-proficiency-system/05-update-tooltips.md | historical UI implementation note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that tooltip content already consumes the shared warning reason. |
| docs/tasks/weapon-proficiency-system/06-inventory-indicators.md | historical UI implementation note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that inventory warning support exists, though the current surface is tooltip-driven rather than a dedicated always-visible badge system. |
| docs/tasks/weapon-proficiency-system/07-audit-weapon-data.md | historical audit task note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that the old one-field cleanup direction did not fully become current repo truth. |
| docs/tasks/weapon-proficiency-system/08-fix-proficiency-flags.md | historical data-change note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that the dataset still preserves compatibility rather than fully standardizing onto explicit isMartial flags. |
| docs/tasks/weapon-proficiency-system/09-attack-roll-penalties.md | active gap note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that combat abilities carry isProficient, but the final attack-roll modifier path still does not have a verified proficiency-bonus strip. |
| docs/tasks/weapon-proficiency-system/10-weapon-mastery-integration.md | active partial-gap note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after confirming that combat ability generation already gates mastery on proficiency. |
| docs/tasks/weapon-proficiency-system/11-combat-ui-warnings.md | active gap note | processed | rewrite in place | Manual repo verification completed on 2026-03-12 after failing to find proof of a dedicated combat warning surface for non-proficient weapon use. |
| docs/decision_logs/race_glossary_sync_questions.md | decision log + open-questions record | processed | keep in place | Manual repo verification completed on 2026-03-12 after confirming that it already reads as a current-state decision log tied to live race grouping, image, and trait-inheritance questions rather than a stale instruction packet. |
| docs/Prompts/Google Stitch Prompting.md | prompt artifact + historical transcript | processed | rewrite in place | Manual review completed on 2026-03-13 after confirming that the file is a captured prompting conversation, not a source of live repo or product truth, so it now reads as a preserved prompt artifact. |

## Spell Reference Level 1 Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/reference/level-1/alarm.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/alarm.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/animal-friendship.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/animal-friendship.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/armor-of-agathys.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/armor-of-agathys.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/arms-of-hadar.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/arms-of-hadar.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/bane.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/bane.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/bless.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/bless.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/charm-person.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/charm-person.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/color-spray.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/color-spray.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/command.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/command.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/compelled-duel.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/compelled-duel.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/comprehend-languages.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/comprehend-languages.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/create-or-destroy-water.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/create-or-destroy-water.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/cure-wounds.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/cure-wounds.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/detect-evil-and-good.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/detect-evil-and-good.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/detect-magic.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/detect-magic.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/detect-poison-and-disease.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/detect-poison-and-disease.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/disguise-self.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/disguise-self.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/dissonant-whispers.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/dissonant-whispers.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/divine-favor.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/divine-favor.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/divine-smite.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/divine-smite.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/ensnaring-strike.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/ensnaring-strike.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/entangle.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/entangle.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/expeditious-retreat.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/expeditious-retreat.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/faerie-fire.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/faerie-fire.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/false-life.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/false-life.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/feather-fall.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/feather-fall.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/find-familiar.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/find-familiar.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/fog-cloud.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/fog-cloud.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/goodberry.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/goodberry.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/grease.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/grease.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/guiding-bolt.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/guiding-bolt.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/healing-word.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/healing-word.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/hellish-rebuke.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/hellish-rebuke.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/heroism.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/heroism.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/hex.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/hex.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/hunters-mark.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/hunters-mark.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/ice-knife.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/ice-knife.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/identify.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/identify.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/illusory-script.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/illusory-script.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/inflict-wounds.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/inflict-wounds.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/jump.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/jump.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/longstrider.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/longstrider.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/mage-armor.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/mage-armor.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/magic-missile.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/magic-missile.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/protection-from-evil-and-good.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/protection-from-evil-and-good.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/purify-food-and-drink.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/purify-food-and-drink.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/ray-of-sickness.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/ray-of-sickness.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/sanctuary.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/sanctuary.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/searing-smite.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/searing-smite.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/shield-of-faith.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/shield-of-faith.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/silent-image.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/silent-image.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/sleep.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/sleep.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/speak-with-animals.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/speak-with-animals.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/tashas-hideous-laughter.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/tashas-hideous-laughter.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/tensers-floating-disk.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/tensers-floating-disk.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/thunderous-smite.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/thunderous-smite.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/thunderwave.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/thunderwave.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/unseen-servant.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/unseen-servant.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/witch-bolt.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/witch-bolt.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/wrathful-smite.md | spell reference + leaf | processed | rewrite in place | Manual repo verification completed against matching public/data/spells/level-1/wrathful-smite.json during the 2026-03-13 level-1 batch. Rewritten in place where the markdown drifted from the current JSON spell shape. |
| docs/spells/reference/level-1/burning-hands.md | spell reference + leaf | processed | keep in place | Manual repo verification completed against matching public/data/spells/level-1/burning-hands.json during the 2026-03-13 level-1 batch. Kept in place because the markdown already matched the current JSON spell shape closely enough. |
| docs/spells/reference/level-1/chromatic-orb.md | spell reference + leaf | processed | keep in place | Manual repo verification completed against matching public/data/spells/level-1/chromatic-orb.json during the 2026-03-13 level-1 batch. Kept in place because the markdown already matched the current JSON spell shape closely enough. |
| docs/spells/reference/level-1/hail-of-thorns.md | spell reference + leaf | processed | keep in place | Manual repo verification completed against matching public/data/spells/level-1/hail-of-thorns.json during the 2026-03-13 level-1 batch. Kept in place because the markdown already matched the current JSON spell shape closely enough. |
| docs/spells/reference/level-1/shield.md | spell reference + leaf | processed | keep in place | Manual repo verification completed against matching public/data/spells/level-1/shield.json during the 2026-03-13 level-1 batch. Kept in place because the markdown already matched the current JSON spell shape closely enough. |

## Non-Spell Control And Singleton Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/@ROADMAP-SYSTEM-GUIDE.md | reference + tooling-governance | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against devtools/roadmap scripts, Vite roadmap integration, and .agent/roadmap-local/README.md. Rewritten to reflect the current roadmap-visualizer storage split, including tooling_state.sqlite as local source of truth for processing artifacts. |
| docs/generated/@ALL-MD-FILES.md | generated inventory artifact | processed | rewrite in place | Manual docs-system verification completed on 2026-03-14 against @DOC-INVENTORY.md and the current generated/ surface. Rewritten as a preserved generated inventory pointer instead of leaving the stale exhaustive dump to masquerade as maintained prose. |
| docs/guides/completed/NPC_GOSSIP_SYSTEM_GUIDE.md | preserved completion guide | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against handleWorldEvents.ts, npcBehaviorConfig.ts, npcReducer.ts, appState.ts, handleNpcInteraction.ts, and handleGeminiCustom.ts. Rewritten to acknowledge that the core gossip lane is implemented while avoiding overclaims about fresh UI verification. |
| docs/guides/completed/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md | preserved completion guide | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against state, reducer, handler, and type surfaces for NPC memory, suspicion, goals, and gossip. Rewritten as preserved subsystem context rather than an active build plan for missing mechanics. |
| docs/tasks/character-creator-styling-audit.md | preserved UI audit note | processed | rewrite in place | Manual file-surface verification completed on 2026-03-14 against the current Character Creator component set and src/styles/buttonStyles.ts. Rewritten to preserve the audit as historical context while explicitly refusing to treat it as rendered-current truth. |
| docs/tasks/CONFIG_REFACTOR_PROPOSAL.md | preserved architecture-improvement note | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against src/config/env.ts and the remaining raw BASE_URL consumer in src/hooks/useDiceBox.ts. Rewritten to record that centralized ENV.BASE_URL already exists while the migration is still incomplete. |

## Spell-Adjacent Non-Leaf Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/audit/AUDIT_LEVEL_2.md | spell audit placeholder | processed | rewrite in place | Manual repo verification completed on 2026-03-14 after confirming that public/data/spells/level-2 and docs/spells/reference/level-2 both exist while this file had no completed audit content. Rewritten as an explicit placeholder note rather than an implied finished audit. |
| docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md | historical inventory snapshot | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming that the preserved 2025 inventory body still has historical value while its counts drift from the current 469-file spell dataset. |
| docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md | historical external reference snapshot | processed | keep in place | Manual docs verification completed on 2026-03-14 after confirming that the file still functions as the preserved external-reference side of the completeness-audit packet. |
| docs/tasks/spells/CHARACTER_POLICY.md | active charset policy | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against scripts/validate-data.ts and the charset-validation flow. Rewritten into a clean current policy note after the older prose and examples carried encoding-garble risk. |
| docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming the prompt packet still points at the live spell validator and manifest surfaces, while the execution-order assumptions remain historical. |
| docs/tasks/spells/agent_prompts/01_missing_references_and_json.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming this is a preserved migration prompt rather than a current queue of truth. |
| docs/tasks/spells/agent_prompts/02_non_ascii_guardrails.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming its guardrail topic still maps to the current charset-validation lane. |
| docs/tasks/spells/agent_prompts/03_aoe_shapes_schema_and_mechanics.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming it remains a preserved schema-evolution prompt rather than a completed implementation record. |
| docs/tasks/spells/agent_prompts/04_targeting_type_and_attack_save_mechanics.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming it remains a preserved targeting-normalization prompt rather than a maintained design standard. |
| docs/tasks/spells/agent_prompts/05_material_components_split_model.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming it remains a preserved material-components prompt rather than a proof of current schema convergence. |
| docs/tasks/spells/agent_prompts/06_subclass_spell_access_glossary_feature.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming it remains a preserved glossary-feature prompt. |
| docs/tasks/spells/agent_prompts/07_feat_spell_access_glossary_feature.md | preserved prompt artifact | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming it remains a preserved glossary-feature prompt. |
| docs/tasks/combat-messaging-enhancement/README.md | feature overview + preserved current-state packet | processed | keep in place | Manual repo verification completed on 2026-03-14 against src/types/combatMessages.ts, src/utils/combat/messageFactory.ts, src/hooks/combat/useCombatMessaging.ts, CombatLog.tsx, CombatView.tsx, and CombatMessagingDemo.tsx. The rebased file already matched current reality and was kept in place. |
| docs/tasks/combat-messaging-enhancement/IMPLEMENTATION_PLAN.md | preserved implementation plan | processed | keep in place | Manual repo verification completed on 2026-03-14 against the current combat-messaging code surfaces. The rebased file now correctly treats the base infrastructure as already landed while preserving narrower follow-through work. |
| docs/tasks/combat-messaging-enhancement/SUMMARY.md | preserved completion summary | processed | keep in place | Manual repo verification completed on 2026-03-14 against the current combat-messaging code surfaces. The rebased file now reads as a partial-completion summary rather than a blanket proof that every integration step is done. |
| docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md | compatibility pointer | processed | keep in place | Manual repo verification completed on 2026-03-14 after confirming the preserved archive target exists and the Batch 1 cantrips already exist in public/data/spells/level-0. |

## 3D Exploration Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/3d-exploration/1A-3D-EXPLORATION-ROADMAP.md | active roadmap + subsystem index | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against ThreeDModal.tsx, Scene3D.tsx, MapPane.tsx, useSubmapProceduralData.ts, mapService.ts, and azgaarDerivedMapService.ts. Rewritten into a current roadmap entry that acknowledges the partial implementation baseline. |
| docs/tasks/3d-exploration/2B-3D-INTEGRATION-DESIGN-PLAN.md | preserved design plan | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current 3D exploration and map-integration surfaces. Rewritten as preserved design context rather than a greenfield plan. |
| docs/tasks/3d-exploration/implementation_plan.md | active implementation plan | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current atlas bridge, map generation, submap, and 3D scene surfaces. Rewritten so it treats the current lane as partially landed rather than untouched. |
| docs/tasks/3d-exploration/world-map-rewire-mapping.md | active coupling map | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against MapPane.tsx, mapService.ts, azgaarDerivedMapService.ts, reducer/state contracts, and submap anchoring surfaces. Rewritten so the renderer bridge is treated as landed while parity remains open. |
| docs/tasks/3d-exploration/feature-capabilities/3d-exploration-combat/INDEX.md | branch index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still honestly defines the 3D exploration and combat branch as a sibling to world-map work. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/INDEX.md | branch index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still functions as a truthful branch index for world-map capability notes. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/INDEX.md | capability-group index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still truthfully scopes the deterministic world-generation capability group. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/azgaar-world-generation-backbone.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against mapService.ts and azgaarDerivedMapService.ts. The capability note still matches the current Azgaar-primary direction. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/INDEX.md | capability-group index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still truthfully scopes the world-map navigation capability group. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/travel-precision-overlay-controls.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against the current atlas interaction modes in MapPane.tsx. The file remains a truthful capability note about precision overlays staying pending/default-sensitive. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/submap-continuity/INDEX.md | capability-group index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still truthfully scopes the submap continuity branch. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/INDEX.md | capability-group index | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. The file still truthfully scopes the world-map visuals branch. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/azgaar-layer-controls-political-borders-toggleable.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against the current Azgaar atlas path in MapPane.tsx. The note remains truthful as a toggleable visual-layer decision. |
| docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/continuous-world-map-view-no-visible-tile-grid.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against the current atlas-default presentation in MapPane.tsx. The note remains truthful as a feature-first decision. |

## Feature Capability Notes Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/feature-capabilities/character-creator.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against CharacterCreator.tsx, BackgroundSelection.tsx, sidebarSteps.ts, and characterCreatorState.ts. The file already matched current implemented baseline behavior and was kept in place. |
| docs/tasks/feature-capabilities/companion-banter.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against useCompanionBanter.ts, banter.ts, and actionTypes.ts. The file already matched the current hook-level implementation and was kept in place. |
| docs/tasks/feature-capabilities/merchant-pricing-economy.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against MerchantModal.tsx, economyUtils.ts, RegionalEconomySystem.ts, and FactionEconomyManager.ts. The file already matched the current implemented pricing baseline and was kept in place. |
| docs/tasks/feature-capabilities/noble-house-generation.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against noble.ts, nobleHouseGenerator.ts, and NobleIntrigueManager.ts. The file already matched the current noble-house foundation and was kept in place. |
| docs/tasks/feature-capabilities/url-history-state-sync.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against useHistorySync.ts, actionTypes.ts, and appState.ts. The file already matched the current baseline history-sync implementation and was kept in place. |
| docs/tasks/feature-capabilities/voyage-management.md | capability note | processed | keep in place | Manual repo verification completed on 2026-03-14 against naval.ts, appState.ts, navalReducer.ts, travelEventService.ts, and VoyageManager.ts. The file already matched the current partial voyage-management baseline and was kept in place. |
| docs/tasks/spell-system-overhaul/archive/@README.md | historical archive packet index | processed | keep in place | Manual docs verification completed on 2026-03-14 against the preserved archive packet and current spell workflow docs. The file already honestly described the archive lane and was kept in place. |
| docs/tasks/spell-system-overhaul/archive/SPELL_DATA_CREATION_GUIDE.md | historical guide snapshot | processed | keep in place | Manual repo/docs verification completed on 2026-03-14 against the current levelized spell layout and current spell workflow docs. The file already honestly described itself as a legacy guide and was kept in place. |
| docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md | active capability gap note | processed | keep in place | Manual repo verification completed on 2026-03-14 against current spell types and the current enhance-ability structured-data situation. The file already matched the current modal-choice gap and was kept in place. |
| docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md | active rollup pointer | processed | keep in place | Manual repo/docs verification completed on 2026-03-14 against the current spell-overhaul TODO surface and current level-1 status surfaces. The file already matched the current narrow gap-rollup role and was kept in place. |

## Spell Meta Prompt Packet

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/spells/audit/AUDIT_LEVEL_2.md | spell audit placeholder | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against public/data/spells/level-2 and docs/spells/reference/level-2. The file was empty, so it was rewritten into an explicit placeholder note instead of being left to imply a completed audit. |
| docs/tasks/spells/CHARACTER_POLICY.md | workflow + encoding policy | processed | keep in place | Manual repo verification completed on 2026-03-14 against scripts/check-non-ascii.ts and scripts/validate-data.ts. Kept in place because the charset policy and enforcement references still match the current spell tooling lane. |
| docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against spellValidator.ts, update-spell-json-from-references.ts, regenerate-manifest.ts, generateGlossaryIndex.js, and validate-data.ts. Rewritten with a preserved-prompt header so the file no longer reads like an automatically current execution order. |
| docs/tasks/spells/agent_prompts/01_missing_references_and_json.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator, spell tooling scripts, and docs/spells/reference lane. Rewritten with a preserved-prompt header because its task assumptions are historically useful but may already be partially resolved. |
| docs/tasks/spells/agent_prompts/02_non_ascii_guardrails.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against scripts/check-non-ascii.ts and validate-data.ts. Rewritten with a preserved-prompt header so the file remains useful without pretending the guardrail task is still wholly untouched. |
| docs/tasks/spells/agent_prompts/03_aoe_shapes_schema_and_mechanics.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator and spell-data tooling family. Rewritten with a preserved-prompt header because it is still useful as schema/mechanics context but not a guaranteed current task queue. |
| docs/tasks/spells/agent_prompts/04_targeting_type_and_attack_save_mechanics.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator and spell-data tooling family. Rewritten with a preserved-prompt header because it should be read as historical guidance rather than an automatically current work order. |
| docs/tasks/spells/agent_prompts/05_material_components_split_model.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator and spell-data tooling family. Rewritten with a preserved-prompt header to preserve the design guidance without overstating present task state. |
| docs/tasks/spells/agent_prompts/06_subclass_spell_access_glossary_feature.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator and spell-data tooling family. Rewritten with a preserved-prompt header because the prompt remains useful as a feature note but not as self-proving current execution truth. |
| docs/tasks/spells/agent_prompts/07_feat_spell_access_glossary_feature.md | preserved spell-task prompt | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the current spell validator and spell-data tooling family. Rewritten with a preserved-prompt header because the prompt remains useful as a feature note but not as self-proving current execution truth. |

## Combat Messaging And Spell-Meta Batch

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/combat-messaging-enhancement/README.md | feature-overview | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against src/types/combatMessages.ts, src/utils/combat/messageFactory.ts, src/hooks/combat/useCombatMessaging.ts, src/components/BattleMap/CombatLog.tsx, src/components/Combat/CombatView.tsx, and src/components/demo/CombatMessagingDemo.tsx. Rewritten so it reflects an implemented baseline instead of a greenfield proposal. |
| docs/tasks/combat-messaging-enhancement/IMPLEMENTATION_PLAN.md | implementation-plan | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the live combat-messaging files. Rewritten as a preserved plan note that now points at remaining follow-through rather than claiming the foundations are unbuilt. |
| docs/tasks/combat-messaging-enhancement/SUMMARY.md | completion-summary | processed | rewrite in place | Manual repo verification completed on 2026-03-14 against the live combat-messaging surfaces. Rewritten so the completion summary matches what was actually verified in code. |
| docs/spells/audit/AUDIT_LEVEL_2.md | audit placeholder | processed | keep in place | Manual docs-tree verification completed on 2026-03-14. File already functions as an explicit placeholder note rather than a misleading completed audit packet. |
| docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md | historical inventory snapshot | processed | keep in place | Manual repo/docs verification completed on 2026-03-14. Existing preserved header correctly distinguishes the 2025 inventory snapshot from the current live spell counts. |
| docs/tasks/spell-completeness-audit/output/PHB-2024-REFERENCE.md | historical external reference snapshot | processed | keep in place | Manual docs verification completed on 2026-03-14. Existing preserved header already frames this as a frozen reference corpus rather than a fresh completeness rerun. |
| docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against spellValidator.ts, package.json validation scripts, and the current docs/spells/reference lane. Kept as a preserved prompt packet and cleaned the literal newline-separator corruption left by an earlier write path. |
| docs/tasks/spells/agent_prompts/01_missing_references_and_json.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator and reference lane. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/02_non_ascii_guardrails.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against package.json validate:charset and fix:charset scripts plus the current spell validator. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/03_aoe_shapes_schema_and_mechanics.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator and spell mechanics surfaces. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/04_targeting_type_and_attack_save_mechanics.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator, creature-type guidance, and current reference lane. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/05_material_components_split_model.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator and spell-data tooling context. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/06_subclass_spell_access_glossary_feature.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator and class-list references. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/agent_prompts/07_feat_spell_access_glossary_feature.md | preserved task prompt | processed | rewrite in place | Manual repo/docs verification completed on 2026-03-14 against the current spell validator, feat data references, and glossary-task context. Preserved as a historical prompt packet and cleaned the literal newline-separator corruption. |
| docs/tasks/spells/CHARACTER_POLICY.md | policy | processed | keep in place | Manual repo verification completed on 2026-03-14 against package.json validation scripts. File still matches the current repository-wide charset policy for spell references and spell JSON. |
| docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md | compatibility pointer | processed | keep in place | Manual docs-tree verification completed on 2026-03-14. File already functions as a compatibility pointer to the archived batch record and current cantrip status surfaces. |

## Control And Generated Meta Docs

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/@ROADMAP-SYSTEM-GUIDE.md | eference + oadmap-governance | processed | ewrite in place | Manual repo verification completed. Verified 2026-03-14 against ite.config.ts, devtools/roadmap/scripts/roadmap-storage.ts, devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx, and .agent/roadmap-local/README.md; the file now correctly reflects SQLite-backed local tooling state instead of the older manifest-only storage wording. |
| docs/generated/@ALL-MD-FILES.md | generated + historical snapshot | processed | ewrite in place | Manual docs-scope verification completed. Rewritten 2026-03-14 as a preserved generated snapshot note after confirming the old exhaustive inline list was a stale 2026-02-12 repo-wide capture rather than a maintained first-wave inventory surface. |
| docs/guides/completed/NPC_GOSSIP_SYSTEM_GUIDE.md | completed guide + historical implementation record | processed | ewrite in place | Manual repo verification completed. Verified 2026-03-14 against src/state/appState.ts, src/state/actionTypes.ts, src/config/npcBehaviorConfig.ts, and current NPC memory/dialogue surfaces; file now clearly reads as a preserved completion record instead of a live build checklist. |
| docs/guides/completed/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md | completed guide + historical implementation record | processed | ewrite in place | Manual repo verification completed. Verified 2026-03-14 against src/types/world.ts, src/state/appState.ts, src/state/actionTypes.ts, and active NPC memory/suspicion/goal surfaces; file now reads as a preserved implementation record rather than a current step-by-step backlog. |
| docs/spells/audit/AUDIT_LEVEL_2.md | udit placeholder + historical stub | processed | ewrite in place | Manual docs-tree verification completed. File was empty on 2026-03-14, so it was rewritten as a minimal historical placeholder that points readers toward public/data/spells/level-2 and docs/spells/reference/level-2 instead of pretending to contain active audit output. |

## Documentation Cleanup Task Packet

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/documentation-cleanup/1A-SURVEY-AND-CLASSIFICATION.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as an already-rebased historical survey note that points to archive/report outputs and no longer claims current classification authority. |
| docs/tasks/documentation-cleanup/1B-APPLY-PREFIX-TO-ROOT-DOCS.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as an already-rebased rename-history note rather than a live naming policy. |
| docs/tasks/documentation-cleanup/1C-ARCHIVE-OBSOLETE-DOCS.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as an already-rebased archive-history note, with current archive practice now governed elsewhere. |
| docs/tasks/documentation-cleanup/1D-CONSOLIDATE-DUPLICATE-CONTENT.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as a time-bound no-consolidation snapshot rather than current system truth. |
| docs/tasks/documentation-cleanup/1E-VERIFY-DOC-LINKS.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as a preserved link-audit brief rather than current proof of link health. |
| docs/tasks/documentation-cleanup/1F-CREATE-SYSTEM-STATUS-REPORT.md | historical task brief | processed | keep in place | Manual docs-tree verification completed. Verified 2026-03-14 as historical status-report provenance rather than current sign-off authority. |
| docs/tasks/documentation-cleanup/1G-MIGRATE-IMPROVEMENT-DOCS.md | historical migration campaign | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 as preserved campaign provenance after checking live source-adjacent README targets and archive improvement sources. |
| docs/tasks/documentation-cleanup/1G.1-COMMON-COMPONENTS.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming the archive source exists and the named target README exists, while the brief's title-to-target mismatch makes it historical rather than live. |
| docs/tasks/documentation-cleanup/1G.2-CONFIG-DECOUPLING.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming both the archive source and src/config/README.md exist. |
| docs/tasks/documentation-cleanup/1G.3-PLAYER-TYPES.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming both the archive source and src/types/README.md exist. |
| docs/tasks/documentation-cleanup/1G.4-EXTERNALIZE-CSS.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming both the archive source and src/styles/README.md exist. |
| docs/tasks/documentation-cleanup/1G.5-API-ERROR-HANDLING.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming both the archive source and src/services/README.md exist. |
| docs/tasks/documentation-cleanup/1G.6-SUBMAP-RENDERING.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming path drift from the old flat target to src/components/Submap/SubmapPane.README.md. |
| docs/tasks/documentation-cleanup/1G.7-REDUCER-LOGIC.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming the archive source exists while the named src/context/README.md target does not. |
| docs/tasks/documentation-cleanup/1G.8-POINT-BUY-UI.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming the archive source exists while the named src/components/CharacterCreator/README.md target does not. |
| docs/tasks/documentation-cleanup/1G.9-LOADING-TRANSITION.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming the archive source exists while the named flat loading-transition README target does not. |
| docs/tasks/documentation-cleanup/1G.10-SUBMAP-GENERATION.md | historical migration brief | processed | keep in place | Manual repo/docs verification completed. Verified 2026-03-14 after confirming the archive deep-dive packet exists while src/features/SubmapGeneration/README.md is currently missing. |

## Testing Overhaul Packet

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/testing-overhaul/00-MASTER-PLAN.md | plan + 	esting backlog | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after checking the current test tree under src/** and src/test/contracts; file now acknowledges broad existing test coverage instead of implying the repo only has a handful of tests. |
| docs/tasks/testing-overhaul/01-CORE-UI.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming existing tests for MainMenu, CharacterSheetModal, ConfirmationModal, and ActionPane-adjacent surfaces. |
| docs/tasks/testing-overhaul/02-CHARACTER-CREATOR.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming existing Character Creator tests under src/components/CharacterCreator/**/__tests__ and related files. |
| docs/tasks/testing-overhaul/02-COMPLEX-INTERACTIVE.md | historical alternate phase slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 to mark it as overlapping historical decomposition rather than the authoritative current phase plan. |
| docs/tasks/testing-overhaul/03-CANVAS-MAP.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming current SubmapPane and TownCanvas tests in the repo. |
| docs/tasks/testing-overhaul/03-GAMEPLAY-SYSTEMS.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming broad combat, spell, inventory-adjacent, and action-system tests. |
| docs/tasks/testing-overhaul/04-MAP-SYSTEMS.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming current map/town tests and calling out renderer/path drift risk. |
| docs/tasks/testing-overhaul/05-UTILITIES.md | 	esting backlog slice | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming broad hooks/utils/contracts coverage in the live test tree. |

## Combat Messaging Enhancement Packet

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/combat-messaging-enhancement/README.md | eature packet + overview | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming src/types/combatMessages.ts, src/utils/combat/messageFactory.ts, src/hooks/combat/useCombatMessaging.ts, and src/components/demo/CombatMessagingDemo.tsx exist, while treating full live-game integration as only partially verified. |
| docs/tasks/combat-messaging-enhancement/IMPLEMENTATION_PLAN.md | eature packet + plan | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 so it now reads as a plan against a partially landed system rather than a blank-slate proposal. |
| docs/tasks/combat-messaging-enhancement/SUMMARY.md | eature packet + summary | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 so the summary remains useful without overstating end-to-end live integration. |

## Singleton Task And Capability Docs - 2026-03-14 Sweep

| Path | Class | Review Status | Disposition | Evidence / Notes |
|------|-------|---------------|-------------|------------------|
| docs/tasks/CONFIG_REFACTOR_PROPOSAL.md | improvement note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 against src/config/env.ts, ssetUrl, and current raw import.meta.env.BASE_URL usage; file already had truthful rebased wording and was kept as a preserved improvement note. |
| docs/tasks/CRAFTING_UI_TODO.md | eature backlog note | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming src/systems/crafting/craftingSystem.ts and src/systems/crafting/salvageSystem.ts exist while the old flat src/components/Inventory/InventoryList.tsx target path does not. |
| docs/tasks/feat-implementation-plan.md | eature plan | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming the referenced feat-selection and assembly surfaces still exist and the feat data-model groundwork already landed in current type surfaces. |
| docs/tasks/feat-system-gaps.md | gap inventory | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming selectable feat metadata fields are present in current character type surfaces. |
| docs/tasks/feat-ui-implementation-plan.md | eature plan | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming the feat UI and character-assembly surfaces still exist while the data-model lane is no longer hypothetical. |
| docs/tasks/lint-setup.md | 	ooling proposal | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 as a preserved lint-adoption note rather than current proof of absent tooling. |
| docs/tasks/ORACLE_REACTIVE_EFFECT_TYPES.md | 	argeted improvement note | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming ReactiveEffectCommand.ts and src/utils/factories.ts exist, making the old blocker wording time-bound rather than current truth. |
| docs/tasks/TOWN_REFACTOR_PLAN.md | historical refactor plan | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming the town components now live under src/components/Town/. |
| docs/tasks/worldsmith-economy-plan.md | capability plan + acklog | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming economy state, utility, market-event, and merchant pricing surfaces exist while broader business/investment ideas remain backlog. |
| docs/tasks/character-creator-styling-audit.md | udit note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased styling audit note that correctly avoids claiming rendered verification. |
| docs/tasks/ui-features/TASK_SALVAGE_UI.md | eature backlog note | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming the salvage backend exists while the old inventory target path does not. |
| docs/tasks/investigations/DICE_ROLLER_ANALYSIS.md | 	echnical investigation | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming the dice modal, overlay, context, service, and hook surfaces still exist. |
| docs/tasks/action-system-refactor/1A-ARCHITECTURAL-PROPOSALS.md | rchitectural proposal | processed | ewrite in place | Manual repo verification completed. Rebased 2026-03-14 after confirming current ActionMetadata surfaces already exist in the repo. |
| docs/tasks/architecture/agent_prompts/01_architecture_compendium.md | historical agent prompt | processed | ewrite in place | Manual repo/docs verification completed. Rebased 2026-03-14 after confirming docs/ARCHITECTURE.md and docs/architecture/ now exist, so this file serves as prompt provenance rather than a live task brief. |
| docs/tasks/feature-capabilities/character-creator.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
| docs/tasks/feature-capabilities/companion-banter.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
| docs/tasks/feature-capabilities/merchant-pricing-economy.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
| docs/tasks/feature-capabilities/noble-house-generation.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
| docs/tasks/feature-capabilities/url-history-state-sync.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
| docs/tasks/feature-capabilities/voyage-management.md | capability note | processed | keep in place | Manual repo verification completed. Verified 2026-03-14 as an already-rebased current-state capability note. |
