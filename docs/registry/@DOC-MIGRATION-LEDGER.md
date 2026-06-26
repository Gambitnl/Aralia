# Documentation Migration Ledger

**Last Updated**: 2026-03-11  
**Purpose**: Track the active documentation normalization decisions so the migration stays consistent over time.

## Current Goal

Bring the `docs/` system into a smaller set of clear roles without breaking canonical entry paths that the repo already references.

Current default preservation rule:
- split aggressively when current truth and historical value are entangled
- preserve history through archive or retired placement rather than leaving stale claims inside canonical docs

Current execution rule:
- the first-wave overhaul covers the full `docs/` markdown surface, excluding only explicitly excluded roadmap-tooling docs
- do not stop at convenient batch boundaries
- continue until every first-wave file has been processed, unless a hard blocker or explicit user redirect makes continuation unsafe

Anti-drift enforcement rule:
- the rigorous audit standard persists for the full first-wave task and does not relax after compaction, queue shifts, or long-horizon task duration
- no file is considered complete unless its claims were checked against the current repo or docs tree and the evidence basis was captured in the review ledger
- archive-note backfills and other metadata hygiene passes are useful, but they do not substitute for full file processing
- if a file was archived or rewritten on thinner evidence than this standard requires, it must be re-opened in the review queue and corrected rather than silently left behind

## Canonical Entry Set

The current canonical root entry docs are:
- [`../PROJECT_PROJECT_ARCHITECTURE.md`](../PROJECT_PROJECT_ARCHITECTURE.md)
- [`../PROJECT_ARCHITECTURE.md`](../PROJECT_ARCHITECTURE.md)
- [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
- [`../@DOCUMENTATION-GUIDE.md`](../@DOCUMENTATION-GUIDE.md)
- [`../@README-INDEX.md`](../@README-INDEX.md)

## Explicit Decisions Already Applied

### Registry layer rewritten around actual scope

These registry and governance files were manually re-audited and rewritten on 2026-03-11 so they stop overclaiming precision while mixed task trees still exist:
- [`../@README-INDEX.md`](../@README-INDEX.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)

The new policy is:
- `@README-INDEX.md` is a curated work-entry surface, not an exhaustive status dashboard
- `@DOC-REGISTRY.md` governs legacy numbered work-doc systems honestly rather than pretending all docs follow one uniform scheme
- `@DOC-REGISTRY.md` tracks in-scope numbered work-doc families only and flags known irregularities instead of inventing false certainty
- `@DOC-REGISTRY.md` is kept in sync with explicitly logged retired numbered docs

### Root-hub pressure reduced

These report-style docs were moved out of the root hub surface into archive space:
- `@CLEANUP-CLASSIFICATION-REPORT.md`
- `@CONSOLIDATION-LOG.md`
- `@DOCUMENTATION-SYSTEM-STATUS.md`
- `@LINK-VERIFICATION-REPORT.md`
- `AUDIT_ACTIONS_COMPLETED.md`
- `CONTRIBUTING_MANUS.md`
- `DEAD_CODE_REPORT.md`
- `DOCS_OVERVIEW.md`
- `DOCS_OVERVIEW_COMPLETE_AUDIT.md`
- `LEGACY_CODE_REPORT.md`
- `NEXT-DOC-REVIEW.md`
- `NEXT-DOC-REVIEW-PROMPT.md`
- `REMOVAL_LOGIC.md`
- eview_worklogs.md`
- `SCOUT_RUN_SUMMARY.md`
- `TESTING_SUMMARY.md`
- `V1.1_BUG_VERIFICATION_REPORT.md`

New location:
- [`../archive/reports/`](../archive/reports/)

### Generated inventory separated

The generated full-markdown listing was moved out of the root surface:
- `@ALL-MD-FILES.md` -> [`../generated/@ALL-MD-FILES.md`](../generated/@ALL-MD-FILES.md)

### Root plan clutter reduced

These active plan/spec docs were moved into structured plan or reference locations. Four refactor notes were later retired on 2026-06-25 after their surviving work moved into living project gaps:
- `ARCH_TYPES_REFACTOR.md` -> moved to `../plans/refactors/ARCH_TYPES_REFACTOR.md` on 2026-03-11, then retired into [`../projects/code-modularization-audit/GAPS.md`](../projects/code-modularization-audit/GAPS.md) CMA-G20.
- `CONFIG_REFACTOR_PLAN.md` -> moved to `../plans/refactors/CONFIG_REFACTOR_PLAN.md` on 2026-03-11, then retired into [`../projects/scripts-workflows/GAPS.md`](../projects/scripts-workflows/GAPS.md) G2.
- `PROPOSED_TIME_REFACTOR.md` -> moved to `../plans/refactors/PROPOSED_TIME_REFACTOR.md` on 2026-03-11, then retired into [`../projects/time/GAPS.md`](../projects/time/GAPS.md) G5.
- `TYPES_REFACTOR_PLAN.md` -> moved to `../plans/refactors/TYPES_REFACTOR_PLAN.md` on 2026-03-11, then retired into [`../projects/code-modularization-audit/GAPS.md`](../projects/code-modularization-audit/GAPS.md) CMA-G20.
- `SLASHER_FEAT_DESIGN.md` -> [`../plans/features/SLASHER_FEAT_DESIGN.md`](../plans/features/SLASHER_FEAT_DESIGN.md)
- `BIOME_DNA_API.md` -> [`../architecture/BIOME_DNA_API.md`](../architecture/BIOME_DNA_API.md)
- `MCP_INTEGRATION.md` -> [`../guides/MCP_INTEGRATION.md`](../guides/MCP_INTEGRATION.md)

### `docs/AGENT.md` conflict reduced

The old mixed-purpose `docs/AGENT.md` doc was renamed into [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md).

[`../AGENT.md`](../AGENT.md) now exists only as a compatibility pointer so:
- root `AGENTS.md` references do not break immediately
- older TODO references can be updated gradually

### Canonical overview rewritten against the repo

[`../PROJECT_PROJECT_ARCHITECTURE.md`](../PROJECT_PROJECT_ARCHITECTURE.md) was rewritten on 2026-03-10 after claim-by-claim verification against the current repository.

The rewrite removed stale assumptions about:
- the repo being a static import-map-only app
- there being no local `node_modules` or Vite build surface
- styling living only in inline HTML styles
- the older, narrower source-tree description

### Registry and governance layer refreshed

These root registry surfaces were rewritten on 2026-03-11 after manual verification against the current docs tree:
- [`../@README-INDEX.md`](../@README-INDEX.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)

Key decisions in that refresh:
- `@README-INDEX.md` is now a narrow work-entry surface, not a stale global status dashboard
- `@DOC-REGISTRY.md` now governs legacy numbered work-doc families rather than pretending to define every naming rule in the repository
- `@DOC-REGISTRY.md` now tracks the numbered families that still rely on registry guidance and explicitly records numbering exceptions instead of hiding them
- roadmap-tooling docs remain excluded from the maintained first-wave system even if they still exist on disk

## Major Classification Calls

- root cleanup and status reports are `archive`, not current guidance
- source-adjacent READMEs under `src` are a secondary reference surface, not top-level hubs
- roadmap-tooling docs currently excluded by repo policy remain out of scope for the maintained doc system
- active task trees stay in `docs/tasks` for now, but mixed folders inside those trees will eventually be split by role where useful
- the first-wave overhaul scope is `docs/`; `src` READMEs are deferred until the `docs/` surface is stable

## High-Risk Mixed Areas Still To Normalize

- `docs/tasks/spell-system-overhaul`
- `docs/tasks/spell-completeness-audit`
- `docs/projects/town-description-system`
- `docs/improvements`
- remaining root docs that still need class, authority, and placement review

## Current Queue Direction

The next audit band after the registry refresh is:
- remaining specialized root guides and root references
- then the mixed high-risk subtrees, starting with `docs/tasks/spell-system-overhaul`

The queue is continuous rather than phase-terminal:
- clearing one band does not end the task
- the task ends only when the full first-wave `docs/` set has been processed and the stabilization criteria are met

### Spell-system subtree pass now opened

The first high-risk mixed subtree pass has now started under:
- `docs/tasks/spell-system-overhaul/`

Initial entry surfaces under review:
- `README.md`
- `START-HERE.md`
- `00-TASK-INDEX.md`
- `1A-PROJECT-MASTER-SPRINGBOARD.md`

Early read confirms this subtree mixes at least three documentation eras:
- the older 27-task phased implementation plan
- later cantrip-batch and migration-status work
- agent/workflow and prompt-heavy coordination docs

2026-06-25 update: `00-TASK-INDEX.md` was retired after the backlog-retirement
pass confirmed that it was a historical 27-task schedule whose live work is now
routed by the Spells parent docs, child-lane registry, and tracked gap rows.

2026-06-25 update: `1A-PROJECT-MASTER-SPRINGBOARD.md` was retired after the
backlog-retirement pass confirmed that its useful orientation is now duplicated
by the Structured Spell Execution north star and the Spells parent routing docs.

That means normalization here will likely require:
- keeping one stable entry path
- demoting older orchestration docs into historical or narrower workflow roles
- preserving historical implementation planning without letting it keep masquerading as current authoritative workflow

### Spell-system subtree archival split now applied

On 2026-03-11, the first explicit preservation split inside `docs/tasks/spell-system-overhaul/` was applied:
- `FINAL_SUMMARY.md` -> [`../archive/spell-docs-2025-12/FINAL_SUMMARY.md`](../archive/spell-docs-2025-12/FINAL_SUMMARY.md)
- `UPDATES-SUMMARY.md` -> [`../archive/spell-docs-2025-12/UPDATES-SUMMARY.md`](../archive/spell-docs-2025-12/UPDATES-SUMMARY.md)

Reason:
- both files preserved useful milestone history
- neither file should remain in the active task subtree as if it were the current workflow authority

Follow-through already applied:
- active subtree references were redirected away from `FINAL_SUMMARY.md`
- the archive README for `spell-docs-2025-12` now records why those files were preserved
- `VALIDATION-ALIGNMENT-ANALYSIS.md` was kept in place, but reframed as an unresolved preserved analysis brief rather than an implicitly completed audit

### Spell-system workflow/reference slice refreshed

The next bounded workflow/reference docs in `docs/tasks/spell-system-overhaul/` were manually re-audited and rewritten on 2026-03-11:
- `BATCH-CREATION-GUIDE.md`
- `JULES_ACCEPTANCE_CRITERIA.md`
- `GAP_REGISTRY.md`

Key corrections:
- removed the missing `SALVAGED_SPELL_CONTEXT.md` dependency from the batch guide
- removed false assumptions about a spell-glossary markdown lane under `public/data/glossary/entries/spells/...`
- kept strict migration policy where useful, but marked it as subtree policy when the codebase did not independently prove hard enforcement
- reframed the gap registry as a convention-level reference instead of a guarantee that every listed gap is still fully unsolved

### Spell-system level-rollup / prompt slice refreshed

The next spell-overhaul slice was manually re-audited and rewritten on 2026-03-11:
- `LEVELS-1-9-MIGRATION-GUIDE.md`
- `LEVEL-1-BATCHES.md`
- `SPELL_MIGRATION_PROMPT.md`

Key corrections:
- removed missing targets such as `docs/spells/reference/LEVEL-{N}-REFERENCE.md`
- removed false assumptions about a spell-glossary markdown lane under `public/data/glossary/entries/spells/...`
- kept the level-migration guide active because other docs route into it, but narrowed it to the current repo shape
- reframed `LEVEL-1-BATCHES.md` as a preserved rollup summary rather than a fresh proof of global green status
- turned `SPELL_MIGRATION_PROMPT.md` into a reusable current template instead of a partially outdated â€œLevel 3+â€ prompt

### Spell-system coordination / backlog slice refreshed

The next spell-overhaul coordination/backlog docs were processed on 2026-03-11:
- `@DISPATCH-SPELLS-TO-JULES.md`
- `@SPELL-SYSTEM-OVERHAUL-TODO.md`
- `TODO.md`

Key decisions:
- the old "Gold Standard" guide was split: historical body archived to `docs/archive/spell-system/@SPELL-SYSTEM-OVERHAUL-TODO.md`, original path kept as a compatibility pointer
- the Jules dispatch doc was narrowed so it no longer duplicates stale prompt blocks or teaches false glossary paths
- the live backlog kept its role, but stale claims such as the old flat-root spell-file count were retired or corrected

### Spell-system roadmap / historical-strategy slice refreshed

The next spell-overhaul planning slice was processed on 2026-03-11:
- `1B-SPELL-MIGRATION-ROADMAP.md`
- `TASK_STRATEGY_UPDATE.md`
- `SPELL_MIGRATION_PATH.md`
- `LEVEL-2-BATCHES.md`

Key decisions:
- `1B-SPELL-MIGRATION-ROADMAP.md` stays live because it contains current measured counts and is referenced by the active-doc surface
- `TASK_STRATEGY_UPDATE.md` and `SPELL_MIGRATION_PATH.md` were moved into `docs/archive/spell-system/` because they had become historical strategy documents with stale commands, stale totals, and outdated coordination assumptions
- the original task-tree paths for those two docs were preserved as compatibility pointers
- `LEVEL-2-BATCHES.md` stayed in place but was demoted to a preserved rollup summary after the current level-2 folder was confirmed to contain more spell JSON files than the rollup lists

### Spell-system "00-" coordination / validation slice refreshed

The next "00-" spell-overhaul docs were processed on 2026-03-11:
- `00-AGENT-COORDINATION.md`
- `00-DATA-VALIDATION-STRATEGY.md`
- `00-GAP-ANALYSIS.md`

Key decisions:
- `00-AGENT-COORDINATION.md` and `00-DATA-VALIDATION-STRATEGY.md` were moved into `docs/archive/spell-system/` because they had become historical design/coordination artifacts rather than current execution authorities
- the original task-tree paths for those two docs were preserved as compatibility pointers because older start docs and agent docs still reference them
- `00-GAP-ANALYSIS.md` stayed live as a narrow AI arbitration gap index in the 2026-03-11 pass, then was retired on 2026-06-25 after Package 5 and fresh hook proof closed the AI input wiring concern and the remaining AI follow-through moved into `docs/projects/spells/GAPS.md` G21-G23.

### Spell-system architecture / implementation-spec slice refreshed

The next spell-overhaul architecture/spec docs were processed on 2026-03-11:
- `00-PARALLEL-PROJECT_ARCHITECTURE.md`
- `0-PRIORITY-SCHEMA-EVOLUTION.md`
- `01-typescript-interfaces.md`
- `03-command-pattern-base.md`

Key decisions:
- `00-PARALLEL-PROJECT_ARCHITECTURE.md` was moved into `docs/archive/spell-system/` because it had become a historical five-agent delivery plan with a broken research reference and a module map that no longer matches the live repo
- the original `00-PARALLEL-PROJECT_ARCHITECTURE.md` path was preserved as a compatibility pointer
- `0-PRIORITY-SCHEMA-EVOLUTION.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its still-valid rider-consumption concern moved into `docs/projects/spells/GAPS.md` G24 and its repeat-save, area-trigger, summon, and defensive timing concerns were confirmed in existing Spells gap rows.
- `01-typescript-interfaces.md` stayed live as preserved task context with a current-status note because the requested type layer and tests now exist under `src/types`
- `03-command-pattern-base.md` stayed live as preserved task context with a current-status note because the command foundation now exists under `src/commands`, even though the older planned module map no longer matches the repo

### Spell-system AI arbitration slice refreshed

The next AI-focused spell-overhaul docs were processed on 2026-03-11:
- `19-ai-spell-arbitrator.md`
- `IMPLEMENT-AI-ARBITRATION-SERVICE.md`
- `GAP-01-AI-INPUT-UI.md`
- `GAP-02-EXAMPLE-AI-SPELLS.md`
- `GAP-03-AI-CACHING.md`
- `GAP-04-REAL-TERRAIN-DATA.md`
- `00-GAP-ANALYSIS.md`

Key decisions:
- `19-ai-spell-arbitrator.md` stayed live as preserved task context in the 2026-03-11 pass, then was retired on 2026-06-25 after the current implementation, `IMPLEMENT-AI-ARBITRATION-SERVICE.md`, and Spells G21-G23 preserved the remaining AI arbitration follow-through.
- `IMPLEMENT-AI-ARBITRATION-SERVICE.md` stayed live, but was narrowed into a current follow-through brief rather than a contradictory "already implemented but still needs to be created" task
- `GAP-01-AI-INPUT-UI.md` was rebased after verifying that the repo already contains `AISpellInputModal.tsx` plus `useAbilitySystem` input-request handling; on 2026-06-25 it was retired after fresh hook proof covered the required AI-DM input pause and factory handoff
- `GAP-02-EXAMPLE-AI-SPELLS.md` was rebased after verifying that AI-tagged spell JSON already exists; on 2026-06-25 it was retired after Package 5 made `prestidigitation` and `suggestion` curated pilot examples and the ongoing boundary moved to Spells G21
- `GAP-03-AI-CACHING.md` stayed live as a real optimization gap because no `ArbitrationCache.ts` was found; on 2026-06-25 it was retired into Spells G22 as a cache-policy follow-up rather than a standalone packet
- `GAP-04-REAL-TERRAIN-DATA.md` was narrowed after verifying that `MaterialTagService` already uses concrete tile information when available; on 2026-06-25 it was retired into Spells G23 as a fallback-confidence correctness gap
- `00-GAP-ANALYSIS.md` was corrected so it no longer repeats the stale "AI input UI is missing entirely" assumption, then retired with the AI gap cluster on 2026-06-25

### Spell-system single-agent brief slice refreshed

The next spell-overhaul coordination docs were processed on 2026-03-11:
- `AGENT-ALPHA-TYPES.md`
- `AGENT-BETA-TARGETING.md`
- `AGENT-GAMMA-COMMANDS.md`
- `AGENT-DELTA-MECHANICS.md`
- `AGENT-EPSILON-AI.md`
- `AGENT-PROMPTS-STUB-COMPLETION.md`

Key decisions:
- the five `AGENT-*` ownership briefs were moved into `docs/archive/spell-system/` because they are historical single-agent tasking artifacts from the older parallel spell-system push
- each original task-tree path was preserved as a compatibility pointer because archived reviews and a remaining spell summary still reference at least part of this cluster
- `AGENT-PROMPTS-STUB-COMPLETION.md` was also moved into archive because it is a completed prompt pack for an older stub-completion phase, not current execution guidance

### Spell-system cantrip batch family archived

The next cantrip-related spell-overhaul docs were processed on 2026-03-11:
- `@SPELL-AUDIT-CANTRIPS.md`
- `CANTRIP-MIGRATION-KNOWLEDGE.md`
- `1I-MIGRATE-CANTRIPS-BATCH-1.md` through `1Q-MIGRATE-CANTRIPS-BATCH-9.md`

Key decisions:
- the whole family was moved into `docs/archive/spell-system/cantrips/` because the live cantrip status surface is now `docs/spells/STATUS_LEVEL_0.md`
- no compatibility pointers were left in the active task tree because no current in-scope doc references were found during this pass
- the older cantrip audit had become stale against the current `public/data/spells/level-0/` folder
- the batch files are preserved as execution history, not current migration authority

### Spell-system implementation-spec slice refreshed

The next spell-overhaul implementation-spec docs were processed on 2026-03-11:
- `COMPLETE-STUB-COMMANDS.md`
- `TASK-01.5-TYPE-PATCHES.md`
- `IMPLEMENT-REMAINING-EFFECT-COMMANDS.md`
- `IMPLEMENT-AOE-ALGORITHMS.md`
- `IMPLEMENT-CONCENTRATION-TRACKING.md`
- `TODO_OBJECT_TARGETING.md`

Key decisions:
- `COMPLETE-STUB-COMMANDS.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its condition-expiry and defensive-effect lifecycle follow-through were folded into `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md` G7 and G8.
- `TASK-01.5-TYPE-PATCHES.md` stayed live as preserved task context because other spell docs still point to it, but it was rebased after verifying that the type, validator, and schema additions it demanded already exist in the current repo
- `IMPLEMENT-REMAINING-EFFECT-COMMANDS.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after the remaining defensive lifecycle, terrain mapless persistence, summon lifecycle, effect-family coverage, and mapless movement/teleport bounds follow-through were folded into tracked parent gaps `docs/projects/spells/GAPS.md` G19-G20 plus the local child-lane gap files.
- `IMPLEMENT-AOE-ALGORITHMS.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its AoE containment, geometry policy, cone/line fidelity, and bridge-ownership follow-through were folded into `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G2 and G4.
- `IMPLEMENT-CONCENTRATION-TRACKING.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its concentration cleanup, voluntary-drop, sustain-cost, and rendered-proof follow-through were folded into `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md` G4.
- `TODO_OBJECT_TARGETING.md` remained live as an active rebased gap note at the time, then was retired on 2026-06-26 after its current object-targeting decisions were folded into `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G5.

### Spell-system light / rider / terrain gap slice refreshed

The next spell-overhaul gap docs were processed on 2026-03-11:
- `11A-DYNAMIC-LIGHTING-SUPPORT.md`
- `11B-SAVE-PENALTY-RIDER.md`
- `11C-TERRAIN-UTILITY-STRUCTURES.md`

Key decisions:
- `11A-DYNAMIC-LIGHTING-SUPPORT.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its light-source expiry, concentration cleanup, renderer, and vision follow-through were folded into `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md` G4 and `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G7.
- `11B-SAVE-PENALTY-RIDER.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after current proof confirmed command-side registration and `DamageCommand` save consumption; the remaining broader save-entry/UI/AI follow-through was folded into `docs/projects/spells/subprojects/structured-spell-execution/GAPS.md` G6.
- `11C-TERRAIN-UTILITY-STRUCTURES.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after its mapless persistence, terrain integration, and rendered-feedback follow-through were folded into `docs/projects/spells/subprojects/targeting-object-area/GAPS.md` G6.

### Roadmap-local spell branch rebase applied

After the above spell docs were reverified on 2026-03-11, the local roadmap workspace was also updated so the visualizer stops treating stale doc headings as roadmap nodes for this slice.

Roadmap-local changes applied:
- `.agent/roadmap-local/processing_manifest.json`
- `.agent/roadmap-local/features/spells/open_tasks.md`
- `.agent/roadmap-local/features/spells/docs/11A-DYNAMIC-LIGHTING-SUPPORT.md`
- `.agent/roadmap-local/features/spells/docs/11B-SAVE-PENALTY-RIDER.md`
- `.agent/roadmap-local/features/spells/docs/11C-TERRAIN-UTILITY-STRUCTURES.md`
- `.agent/roadmap-local/features/spells/docs/IMPLEMENT-CONCENTRATION-TRACKING.md`
- `.agent/roadmap-local/features/spells/docs/TODO_OBJECT_TARGETING.md`

Key outcomes:
- `11A` now contributes capability nodes around light-producing spell effects, the light-source model, and remaining lifecycle / renderer follow-through instead of generic `Problem` / `Proposed Approach` pseudo-nodes
- `11B` now contributes save-rider capability nodes plus a Mind Sliver integration witness instead of generic doc-heading pseudo-nodes
- `11C` now contributes terrain-manipulation capability nodes plus a Mold Earth integration witness instead of generic doc-heading pseudo-nodes
- concentration and object-targeting roadmap entries were rebased to current capability names and state rather than old â€œmissing featureâ€ heading fragments

### Roadmap processing-state storage separated from feature branches

On 2026-03-11, the roadmap-local processing state was explicitly reclassified as dev-tooling state rather than roadmap feature topology.

Processing-state artifacts:
- `.agent/roadmap-local/processing_manifest.json`
- `.agent/roadmap-local/doc_library.json`
- `.agent/roadmap-local/path_provenance.json`

Follow-through applied:
- the local source-of-truth for those artifacts now lives in `.agent/roadmap-local/tooling_state.sqlite`
- the JSON files remain as compatibility snapshots for existing roadmap tooling during the migration
- roadmap feature branches continue to represent feature/capability truth, not doc-pass orchestration internals
- the spells open-task surface was narrowed so it now tracks remaining integration proof and cleanup work instead of repeating already-implemented schema/runtime work as if it were still absent

### Spell-system maintenance / task-history slice refreshed

The next spell-overhaul maintenance/meta docs were processed on 2026-03-11:
- `1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md`
- `1D-ARCHIVE-OLD-SPELL-DOCS.md`
- `1E-CONSOLIDATE-JULES-WORKFLOW.md`
- `1F-AUDIT-SPELL-SCOPE.md`
- `1F-VERSION-REVIEW-AGENT-CONCEPT.md`
- `1G-REORGANIZE-SPELL-FILES.md`

Key decisions:
- `1C~VERSION-DISPLAY-AND-PACKAGE-FIX.md` stayed live, but was rebased into a current-status note because the package-metadata fix is already complete while the on-screen version-display idea remains optional future UI work
- `1D-ARCHIVE-OLD-SPELL-DOCS.md` moved into `docs/archive/spell-system/` because it described an earlier archive/salvage phase whose local archive-path assumptions and `SALVAGED_SPELL_CONTEXT.md` plan never became the maintained workflow; the original task path now survives as a compatibility pointer
- `1E-CONSOLIDATE-JULES-WORKFLOW.md` moved into `docs/archive/spell-system/` because the current workflow surfaces already exist and the brief's missing-file assumptions had become historical; the original task path now survives as a compatibility pointer
- `1F-AUDIT-SPELL-SCOPE.md` moved into `docs/archive/spell-system/` because it belonged to the earlier cantrip-audit phase and pointed at deliverables that are now historical; the original task path now survives as a compatibility pointer
- `1F-VERSION-REVIEW-AGENT-CONCEPT.md` moved into `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md` because it is a future tooling/versioning concept rather than a spell-system implementation task; on 2026-06-25 the relocated concept was retired into Scripts: Workflows G4/T6, and the original task-path compatibility pointer was also deleted after `docs/@DOC-REGISTRY.md` preserved the duplicate identifier as a non-linking historical row
- `1G-REORGANIZE-SPELL-FILES.md` moved into `docs/archive/spell-system/` because the level-folder reorganization is already reflected in the live `public/data/spells/level-*` layout and loader/manifest flow; the original task path now survives as a compatibility pointer

### Spell-system glossary spillover rebased

The remaining spell-overhaul spillover doc 1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md was processed on 2026-03-11.

Key decision:
- the file stayed live, but was rebased into a current gap note after verifying that the shared glossary loader and tooltip path already exist while the spell-specific template file, spell metadata field, and spell-detail lazy-link integration are still absent
- the older instruction to modify GlossaryDisplay.tsx was retired as stale because that component is an icon-legend surface, not the spell-detail integration point

### Spell-completeness-audit entry slice refreshed

The entry surfaces for docs/tasks/spell-completeness-audit/ were processed on 2026-03-11:
- @PROJECT-INDEX.md
- @WORKFLOW.md
- @SPELL-COMPLETENESS-REPORT.md

Key decisions:
- @PROJECT-INDEX.md stayed live as a preserved project map after verifying that the audit outputs still exist and that the later migration authority now lives in spell-system-overhaul/LEVELS-1-9-MIGRATION-GUIDE.md
- @WORKFLOW.md stayed live as preserved historical procedure, but was rewritten so it no longer implies that the old spell-glossary markdown lane or level reference outputs are current facts
- @SPELL-COMPLETENESS-REPORT.md was preserved as a Dec 2025 static snapshot rather than a freshly re-run 2026 completeness verdict

### Spell-completeness-audit phase-1 task briefs refreshed

The completed phase-1 task briefs in docs/tasks/spell-completeness-audit/ were also processed on 2026-03-11:
- 1A~INVENTORY-LOCAL-SPELLS.md
- 1B~RESEARCH-PHB-2024-LIST.md
- 1C~GAP-ANALYSIS.md

Key decisions:
- all three files stayed live, but were rewritten as preserved completion notes rather than open-ended task instructions
- each brief now points back to the output it produced instead of pretending that the audit phase is still actively running from those instructions
- the gap-analysis brief now explicitly defers any future freshness claim to a new rerun rather than the preserved Dec 2025 snapshot

### Spell-completeness-audit extraction-plan slice refreshed

The extraction-planning docs in docs/tasks/spell-completeness-audit/ were also processed on 2026-03-11:
- 2A-EXTRACT-LEVEL-1-DESCRIPTIONS.md
- 2B-EXTRACT-REMAINING-LEVELS.md

Key decisions:
- both files stayed live, but were rewritten as preserved extraction plans rather than active proof that the reference outputs exist
- 2A now states explicitly that no LEVEL-1-REFERENCE.md file was found under docs/spells/reference/ during this pass
- 2B now states explicitly that no LEVEL-2 through LEVEL-9 reference markdown files were found there either

Update 2026-06-25:
- both files were retired after their surviving coverage-map work was executed in
  `docs/projects/spells/subprojects/spell-completeness-audit/LEVEL_1_2_COVERAGE_MAP.md`
- level 1 now has current inventory proof of 68 structured JSON files and 68
  per-spell reference markdown files
- level 2 now has current inventory proof of 65 structured JSON files and 65
  per-spell reference markdown files
- the old level-summary output files remain absent by current path checks; the
  maintained shape is per-spell references plus mechanic-level SSO gap rows

### Spell-completeness-audit schema note refreshed

The remaining schema note in docs/tasks/spell-completeness-audit/ was processed on 2026-03-11:
- PROPOSED_SCHEMA_V2.md

Key decisions:
- the file stayed live, but was rewritten as a preserved design note rather than an unimplemented future schema spec
- the current per-spell reference lane under docs/spells/reference/level-* already reflects much of the granular field-by-field direction the note was proposing

### Town-description-system subtree rebased onto live town code

The `docs/projects/town-description-system/` subtree was processed on 2026-03-11:
- `README.md`
- `QUICK_START.md`
- `IMPLEMENTATION_PLAN.md`
- `TASKS.md`
- `TECHNICAL_SPEC.md`

Key decisions:
- all five files stayed in place because the folder still represents a real future feature branch, but each file was rewritten to stop presenting the older proposal as if it were already the live implementation
- the subtree now anchors itself to the actual town foundations in `src/components/Town/TownCanvas.tsx`, `src/hooks/useTownController.ts`, `src/services/villageGenerator.ts`, `src/utils/world/settlementGeneration.ts`, `src/types/state.ts`, and `src/services/saveLoadService.ts`
- the docs now explicitly distinguish implemented foundations from missing town-description-specific structures such as `TownMetadata`, `TownDescription`, `DetailLevel`, `PersistentTownData`, and the previously proposed dedicated description-generation service files
- `settlementInfo` is now called out as only partially integrated because `TownCanvas.tsx` receives the prop but does not currently consume it
- the subtree remains a preserved planning lane rather than being archived, because the feature intent is still viable and the current repo already contains nearby reusable town-generation systems it should extend rather than replace
- roadmap signal for this slice is process-only: these docs describe a project branch and its verified feature gaps, but they do not themselves become roadmap nodes
### Improvements slice A rebased against current repo reality

The first `docs/improvements/` slice was processed on 2026-03-11:
- `09_remove_obsolete_files.md`
- `12_expand_village_system.md`
- `CREATURE-TYPE-ENUM-AND-REQUIREMENT.md`

Key decisions:
- `09_remove_obsolete_files.md` stayed in place in the 2026-03-11 pass, then was retired on 2026-06-25 because it explicitly carried no remaining deletion work.
- `12_expand_village_system.md` stayed in place in the 2026-03-11 pass, then was retired on 2026-06-25 after its still-valid richer-depth and persistence work was confirmed in `docs/projects/town/GAPS.md` G3 and `docs/projects/town-description-system/GAPS.md` G6.
- `CREATURE-TYPE-ENUM-AND-REQUIREMENT.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after current source inspection found `src/types/creatures.ts` already exports `CreatureType`. The surviving adoption/filter-parity concern moved into `docs/projects/spells/GAPS.md` G17.
- roadmap signal for this slice is process-only: these docs help describe improvement branches and current gaps, but they do not directly emit new roadmap nodes by themselves
### Improvements settings, malleable-world, and sprite-variant slice verified

The next `docs/improvements/` slice was processed on 2026-03-11:
- `SETTINGS_MENU_PLAN.md`
- `MALLEABLE_WORLD_DEV_NOTES.md`
- `SPRITE-POSE-CONTROL-VARIANTS.md`

Key decisions:
- `SETTINGS_MENU_PLAN.md` stayed live as a valid feature plan in the 2026-03-11 pass, then was retired on 2026-06-25 after its still-valid settings surface work moved into `docs/projects/layout/GAPS.md` G7.
- `MALLEABLE_WORLD_DEV_NOTES.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after the production-owner/gameplay-bridge question moved into `docs/projects/world3d/GAPS.md` W3D-G28.
- `SPRITE-POSE-CONTROL-VARIANTS.md` stayed live in the 2026-03-11 pass, then was retired on 2026-06-25 after the non-blocking control-option visual-state work moved into `docs/projects/battle-map/GAPS.md` G7.
- roadmap signal for this slice is process-only: these docs describe verified feature gaps and experimental lanes, but they do not directly emit roadmap nodes by themselves

### Improvements completed slice A rebased as historical completion notes

The first `docs/improvements/completed/` slice was processed on 2026-03-11:
- `01_consolidate_repetitive_components.md`
- `02_decouple_configuration.md`
- `03_refactor_player_character_type.md`
- `04_externalize_css.md`

Key decisions:
- all four files stayed in place under the completed lane, but were rewritten as historical completion notes rather than live implementation plans
- `01` was rebased after confirming the generic racial spell-ability component and shared racial-selection flow already exist while the old race-specific components are gone
- `02` was rebased after confirming the real `src/config/` layer and targeted config modules now exist, while the older future-dynamic-config ambition remains aspirational
- `03` was rebased after confirming that the scalable `racialSelections` model is live in the modern type layout, making the old `src/types.ts` targeting historical
- `04` was rebased after confirming that CSS externalization is complete and has since evolved into a modular external stylesheet lane, while the older no-build-tool framing is no longer current
- roadmap signal for this slice is process-only: these are historical completion records, not feature-topology emitters

## Working Rule For The Remaining Migration

- keep stable paths for canonical hubs where possible
- archive reports instead of deleting them
- move mixed subtrees by document role, not just by topic name
- avoid turning source-local READMEs into another competing hub layer
- do not mark a file complete in the review ledger until audit, verification, disposition, and follow-through are all finished
- do not treat a completed batch as permission to stop; continue through the remaining first-wave queue until the wave is complete

## Roadmap Extraction Guard (Active Interpretation Rule)

While reviewing docs against code, roadmap implications may be noted, but only under these rules:
- roadmap outputs are feature-first and capability-first, not document-first
- workflow docs, coordination docs, migration phases, validation chores, and agent instructions do not become roadmap nodes
- processed docs can serve as evidence sources for roadmap updates, but they are not themselves the roadmap ontology
- cross-cutting capabilities should get one primary home plus crosslinks, rather than duplicated top-level branches
- individual spells, tasks, or batches should usually count as evidence for capability nodes, not as roadmap nodes by default

### Improvements settings, malleable-world, sprite-pose, and development-flow slice refreshed

The following docs/improvements files were processed on 2026-03-11:
- SETTINGS_MENU_PLAN.md
- MALLEABLE_WORLD_DEV_NOTES.md
- SPRITE-POSE-CONTROL-VARIANTS.md
- DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md

Key decisions:
- SETTINGS_MENU_PLAN.md stayed live as a feature plan in the earlier pass, then was retired on 2026-06-25 after the dedicated settings surface work moved into Layout G7.
- MALLEABLE_WORLD_DEV_NOTES.md stayed live as an experimental subsystem note after verifying the deformation stack in the ThreeD experimental path, then was retired on 2026-06-25 after the production-owner/gameplay-bridge question moved into `docs/projects/world3d/GAPS.md` W3D-G28.
- SPRITE-POSE-CONTROL-VARIANTS.md stayed live as a feature request, then was retired on 2026-06-25 after the non-blocking control-option visual-state work moved into `docs/projects/battle-map/GAPS.md` G7.
- DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md stayed live as a tooling-improvement note in the 2026-03-11 pass, then was retired on 2026-06-25 after the surviving workflow-reconciliation checklist work moved into `docs/projects/scripts-workflows/GAPS.md` G3 and `TRACKER.md` T5. Roadmap-local feature ownership stays in `docs/projects/roadmap-maintenance/GAPS.md` G2.

### Improvements completed slice B refreshed

The next docs/improvements/completed slice was re-audited on 2026-03-11.
The four files stayed in place as preserved completion notes because the completed subtree is already the correct historical home for them.
Each file was rebased against the current repo so the preserved note explains what landed and where the repo shape drifted afterward.

### Refactor plan slice retired into living project gaps

The standalone refactor notes under `docs/plans/refactors/` were inspected during the 2026-06-25 backlog-retirement pass:
- `CONFIG_REFACTOR_PLAN.md`
- `PROPOSED_TIME_REFACTOR.md`
- `ARCH_TYPES_REFACTOR.md`
- `TYPES_REFACTOR_PLAN.md`

Key decisions:
- `CONFIG_REFACTOR_PLAN.md` was retired because the central `src/config/env.ts` lane already exists. Its remaining documentation/ownership concern moved into `docs/projects/scripts-workflows/GAPS.md` G2, focused on the env-var matrix and intentional direct `import.meta.env` exceptions.
- `PROPOSED_TIME_REFACTOR.md` was retired because `src/utils/core/timeUtils.ts` exists and has current consumers. Its remaining work moved into `docs/projects/time/GAPS.md` G5, focused on whether social-context day-part labels should be centralized without changing prompt semantics.
- `ARCH_TYPES_REFACTOR.md` and `TYPES_REFACTOR_PLAN.md` were retired because the original monolithic-type assumption is stale. Their still-valid import-graph/barrel pressure moved into `docs/projects/code-modularization-audit/GAPS.md` CMA-G20.
- No runtime code was changed in this retirement slice; the surviving work needs owner-specific proof boundaries before implementation.

### Architecture slice A opened

The architecture/reference pass has now started. VISIBILITY_SYSTEM.md was rewritten on 2026-03-11 to match the live visibility APIs and to stop overclaiming current battle-map integration.
- Architecture README.md was also rewritten to keep the maintenance guide aligned with the current generator and validation commands.

### Architecture reference slice A refreshed

The first architecture reference slice was re-audited on 2026-03-11.
README.md, SPELL_SYSTEM_PROJECT_ARCHITECTURE.md, and VISIBILITY_SYSTEM.md stayed in place as live reference docs, but each was rebased against the current repo to remove stale paths, stale APIs, and stale status claims.
The slice now distinguishes generator-maintenance guidance from true ownership decisions, corrects the spell factory path and spell-count drift, and updates the visibility guide to the current calculateVisibility plus useVisibility flow.

### Architecture domain slice A refreshed

The first architecture domain slice was re-audited on 2026-03-11.
spells.md, combat.md, and world-map.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older mini-map summaries.
This slice corrected stale spell-path and migration-status claims, softened over-precise combat ownership listings, and replaced the outdated pure-grid world-map explanation with the current Azgaar-embed bridge model.


### Architecture domain slice B refreshed

The next architecture domain slice was re-audited on 2026-03-11.
glossary.md, submap.md, and town-map.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older, cleaner ownership summaries.
This slice corrected the stale glossary data-loader claim, updated the submap doc to reflect the current hook plus helper plus config split without pretending the painter lane is gone, and rewrote the town-map doc around the live TownCanvas plus VillageScene split and the current RealmSmith generator stack.

### Architecture domain slice C refreshed

The next architecture domain slice was re-audited on 2026-03-11.
character-creator.md, character-sheet.md, and battle-map.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older path and ownership summaries.
This slice corrected the creator hook path and expanded step-flow description, rewrote the character-sheet doc around the modern CharacterSheet subtree, and updated the battle-map doc to reflect CombatView ownership plus the now-utility role of useBattleMapGeneration.ts.

### Architecture domain slice D refreshed

The next architecture domain slice was re-audited on 2026-03-11.
commands.md, core-systems.md, and data-pipelines.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older narrower ownership summaries.
This slice widened the commands doc to include the now-real combat-ability factory lane, narrowed the core-systems doc back to true shared foundation surfaces, and corrected the data-pipelines doc around the top-level scripts tree plus the current validation-command surface.

### Architecture domain slice E refreshed

The next architecture domain slice was re-audited on 2026-03-11.
glossary-data.md, items-trade-inventory.md, and npcs-companions.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older flatter ownership summaries.
This slice narrowed glossary-data back to public/data/glossary plus its integrity checks, corrected the merchant and trade doc around the Trade subtree plus economy stack, and rewrote the NPCs-companions doc around the real companion systems, dialogue, reducers, and supporting data lanes.

### Architecture domain slice F refreshed

The next architecture domain slice was re-audited on 2026-03-11.
intrigue.md, intrigue-crime.md, and time-world-events.md stayed in place as live architecture references, but each was rebased against current repo reality instead of older concept-only or flatter ownership summaries.
This slice anchored the intrigue note to the now-real leverage, identity, gossip, and noble-house systems, rewrote the combined intrigue-crime map around the concrete crime and thieves-guild lanes, and corrected the time-world-events doc around the current time managers, world managers, reducers, and namespaced utility paths.

### Architecture domain slice G refreshed

The next architecture domain slice was re-audited on 2026-03-11.
naval-underdark.md, planes-travel.md, and puzzles-quests-rituals.md stayed in place as live domain references, but each was rebased against current repo reality instead of the older narrower system lists.
This slice corrected the naval and underdark map around the live naval UI plus system managers, widened the planes-travel doc to include the full current planar lane plus tested travel services, and updated the puzzles-quests-rituals doc around the modern quest log, expanded puzzle systems, and ritual manager plus reducer surfaces.

### Architecture domain slice H refreshed

The final architecture domain slice was re-audited on 2026-03-11.
crafting-economy.md, creature-taxonomy.md, and environment-physics.md stayed in place as live references, but each was rebased against current repo reality instead of older contradictory or overclaimed summaries.
This slice narrowed crafting-economy back to the real crafting lane with economy as adjacent context, rewrote creature-taxonomy around the true current-state split between the tested taxonomy service and the still-live legacy targeting path, and corrected environment-physics around the current environment, visibility, and combat-physics utility surfaces.

### Architecture feature slice I refreshed

The remaining standalone architecture markdown files were re-audited on 2026-03-11.
BIOME_DNA_API.md and features/COMPANION_FACTORY.md stayed in place as specialized architecture notes, but each was rewritten to reflect current repo reality instead of older future-facing assumptions.
This slice reframed the biome DNA note as an experimental procedural-generation reference and rebased the companion factory note around the already-existing generator service plus the still-partial integration path.

### Feature and guide slice J refreshed

The next mixed live-doc slice was re-audited on 2026-03-11.
features/GLOSSARY-SPELL-TEMPLATE-PROPOSAL.md, blueprints/RACE_HIERARCHY_BLUEPRINT.md, and guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md all stayed in place, but each was rewritten to reflect current repo reality instead of older future-facing assumptions.
This slice reframed the spell-template proposal as a partly superseded note, kept the race hierarchy file as a planning blueprint rather than a description of the live race architecture, and updated the glossary contributor guide around the current JSON-entry plus generated-index workflow.

### Spell guide slice K refreshed

The first spell-guide slice was re-audited on 2026-03-11.
SPELL_ADDITION_WORKFLOW_GUIDE.md, SPELL_DATA_CREATION_GUIDE.md, and SPELL_TESTING_PROCEDURES.md stayed in place as live guides, but each was rewritten to reflect the current spell manifest, validator, and script surfaces instead of the older validate:spells-centric workflow wording.

### Spell guide slice L refreshed

The next spell-guide slice was re-audited on 2026-03-11.
SPELL_CONTRIBUTOR_ONBOARDING.md, SPELL_IMPLEMENTATION_CHECKLIST.md, and SPELL_TROUBLESHOOTING_GUIDE.md stayed in place as live guides, but each was rewritten to reflect the current spell manifest, validator, spell-maintenance scripts, and status-doc surface instead of the older validate:spells-centric contributor workflow.

### Guide slice M refreshed

The next guide slice was re-audited on 2026-03-11.
@NPC-GOSSIP-SYSTEM-GUIDE.md, @NPC-MECHANICS-IMPLEMENTATION-GUIDE.md, and @RACE-ADDITION-DEV-GUIDE.md stayed in place as live guides, but each was rewritten to reflect the current NPC-memory, gossip, and race-addition surfaces instead of older implementation-plan or manual-registration assumptions.

### Guide slice N refreshed

The next guide slice was re-audited on 2026-03-11.
CLASS_ADDITION_GUIDE.md, FEAT_SELECTION_IMPLEMENTATION_GUIDE.md, and GLOSSARY_ENTRY_DESIGN_GUIDE.md stayed in place as live guides, but each was rewritten to reflect the current class-addition, feat-choice, and JSON-glossary-generator surfaces instead of older single-file, future-plan, or markdown-entry assumptions.

### Guide slice O refreshed

The remaining guides-band files were re-audited on 2026-03-11.
MCP_INTEGRATION.md, RACE_ADDITION_GUIDE.md, RACE_ENRICHMENT_WORKFLOW.md, and TABLE_CREATION_GUIDE.md stayed in place as live guides, but each was rewritten to reflect the current MCP tooling, race workflow, sync-script, and glossary-renderer surfaces instead of older installation, manual-registration, or stale renderer assumptions.

### Spell reference slice P refreshed

The next top-level spell-reference slice was re-audited on 2026-03-11.
CRITICAL_TYPE_GAPS_SUMMARY.md, SPELL_INTEGRATION_AUDIT_REPORT.md, and SPELL_PROPERTIES_REFERENCE.md stayed in place, but each was rewritten to distinguish historical migration context from the current validator-first spell surface.

### Spell status slice Q refreshed

The next spell-doc slice was re-audited on 2026-03-12.
SPELL_INTEGRATION_CHECKLIST.md, SPELL_JSON_EXAMPLES.md, STATUS_LEVEL_0.md, STATUS_LEVEL_1.md, STATUS_LEVEL_2.md, and STATUS_LEVEL_3.md all stayed in place, but each was rewritten to reflect current validator-first spell verification and present repo inventory facts instead of older pseudo-precise per-spell dashboards.

This slice corrected the moved spellAbilityFactory path, removed markdown-glossary assumptions, replaced hand-written complete-reference JSON templates with pointers to real spell files, and rebased the first four level-status docs around verified level-folder counts plus explicit caveats about uneven end-to-end execution coverage.

### Spell status slice R refreshed

The remaining spell status band was re-audited on 2026-03-12.
STATUS_LEVEL_3_PLUS.md and STATUS_LEVEL_4.md through STATUS_LEVEL_9.md all stayed in place, but each was rewritten to reflect verified spell-folder counts and the current validator-first spell lane instead of the older Gold-Silver-Bronze maturity shorthand.

This slice converted the higher-level status surface from a stale pseudo-dashboard into a real inventory-and-caveat layer, including a verified aggregate count of 292 spell JSON files across levels 3 through 9.

### Spell status slice S refreshed

The top-level spell orientation doc was re-audited again on 2026-03-12 after the full docs/spells status-band refresh.
SPELL_INTEGRATION_STATUS.md stayed in place, but its caution and next-step wording were updated so it now matches the freshly reverified level-status surface instead of referring to that surface as still stale.

### Plan slice T refreshed

The next docs/plans top-level slice was re-audited on 2026-03-12.
The two Codex Terminal plan files and the three roadmap-audit or roadmap-branch-completion plan files all stayed in place, but each was rewritten to act as preserved design or implementation context anchored to the current dev-hub and roadmap code instead of pretending their original paths, task ordering, and future-work lists were still literal live plans.

### Plan slice U refreshed

The next plans/features and plans/refactors slice was re-audited on 2026-03-12.
SLASHER_FEAT_DESIGN.md plus the four refactor-plan docs all stayed in place, but each was rewritten to preserve the original design or refactor intent while anchoring readers to the current repo shape instead of leaving older  not built yet assumptions in place after those foundations had partly landed.

### Archive reports slice V refreshed

The first docs/archive/reports slice was re-audited on 2026-03-12.
@CLEANUP-CLASSIFICATION-REPORT.md, @CONSOLIDATION-LOG.md, @DOCUMENTATION-SYSTEM-STATUS.md, and @LINK-VERIFICATION-REPORT.md all stayed in place under archive/reports, but each was rewritten to present itself as a preserved December 2025 snapshot rather than current documentation-system truth.

This slice verified that the reports overclaimed current authority through stale file counts, stale path assumptions, stale readiness claims, and stale link-health metrics.
The files remain valuable as provenance, but current status and current decisions now belong to the active docs surfaces plus the review and migration ledgers.

### Archive reports slice W refreshed

The next docs/archive/reports slice was re-audited on 2026-03-12.
DOCS_OVERVIEW.md, DOCS_OVERVIEW_COMPLETE_AUDIT.md, AUDIT_ACTIONS_COMPLETED.md, and SCOUT_RUN_SUMMARY.md all stayed in place under archive/reports, but each was rewritten to act as a preserved late-2025 snapshot rather than a live docs-control or branch-status surface.

This slice verified that the two overview dashboards, the audit-completion note, and the scout-run summary all contained time-bound counts, grades, verdicts, or completion claims that had drifted too far to remain trustworthy as current guidance.

### Archive reports slice X refreshed

The next docs/archive/reports technical-report slice was re-audited on 2026-03-12.
DEAD_CODE_REPORT.md, LEGACY_CODE_REPORT.md, REMOVAL_LOGIC.md, and TESTING_SUMMARY.md all stayed in place under archive/reports, but each was rewritten to act as a preserved technical snapshot rather than a live engineering status surface.

This slice verified that some older findings had fully landed, some compatibility shims still exist in narrowed form, and some prior verification claims no longer match the current code shape or current AGENTS.md verification standards.

### Archive reports slice Y refreshed

The final docs/archive/reports slice was re-audited on 2026-03-12.
CONTRIBUTING_MANUS.md, NEXT-DOC-REVIEW-PROMPT.md, NEXT-DOC-REVIEW.md, review_worklogs.md, and V1.1_BUG_VERIFICATION_REPORT.md all stayed in place under archive/reports, but each was rewritten to present itself as a preserved workflow, prompt, or bug-audit snapshot instead of a live instruction or status surface.

With this slice, the archive/reports folder now consistently reads as historical provenance rather than a mixture of archived snapshots and accidentally active-sounding guidance.

### Spell archive slice Z refreshed

The docs/archive/spell-docs-2025-12 slice was re-audited on 2026-03-12.
The folder README plus COMPONENT_DEPENDENCIES.md, FINAL_SUMMARY.md, and UPDATES-SUMMARY.md all stayed in place, but each was rewritten to function as preserved spell-migration provenance rather than live workflow guidance.

This slice verified that the archive lane now consistently points readers back to the maintained spell status, checklist, examples, and spell-overhaul entry docs instead of competing with them.

### Spell archive slice AA refreshed

The first docs/archive/spell-system top-level slice was re-audited on 2026-03-12.
The folder README plus @SPELL-SYSTEM-OVERHAUL-TODO.md, SPELL_SYSTEM_MERGE_SUMMARY.md, SPELL_MIGRATION_PATH.md, and TASK_STRATEGY_UPDATE.md all stayed in place, but each was rewritten to function as preserved late-2025 spell-migration provenance rather than live workflow or branch-status guidance.

This slice established the top-level archive lane as historical context only and redirected current spell-system authority back to the maintained spell docs and the active spell-overhaul subtree.

### Spell archive slice AB refreshed

The next docs/archive/spell-system coordination slice was re-audited on 2026-03-12.
00-AGENT-COORDINATION.md, 00-DATA-VALIDATION-STRATEGY.md, 00-PARALLEL-PROJECT_ARCHITECTURE.md, AGENT-ALPHA-TYPES.md, AGENT-BETA-TARGETING.md, and AGENT-GAMMA-COMMANDS.md all stayed in place, but each was rewritten to preserve late-2025 spell-delivery intent without pretending to be the live workflow or module contract.

This slice verified a mixed outcome: several real spell foundations landed, but not always in the exact module map or ownership pattern these historical briefs prescribed.

### Spell archive slice AC refreshed

The next docs/archive/spell-system slice was re-audited on 2026-03-12.
AGENT-DELTA-MECHANICS.md, AGENT-EPSILON-AI.md, AGENT-PROMPTS-STUB-COMPLETION.md, and the 1D through 1G task briefs all stayed in place, but each was rewritten to preserve the historical mechanics, AI, prompt-pack, and one-time task rationale without presenting those files as current spell workflow authority.

This slice confirmed another mixed outcome: some of the mechanics and AI lanes really did land in the current codebase, while the one-time cleanup and reorganization task briefs are now pure provenance.

### Spell archive slice AD refreshed

The docs/archive/spell-system/cantrips entry slice was re-audited on 2026-03-12.
The folder README plus @SPELL-AUDIT-CANTRIPS.md, CANTRIP-MIGRATION-KNOWLEDGE.md, and Batch 1 through Batch 4 all stayed in place, but each was rewritten to function as preserved cantrip-migration provenance rather than live cantrip workflow guidance.

This slice verified that the cantrip archive lane had drifted in three distinct ways: missing-locally claims no longer matched the current level-0 folder, older batch-pending claims no longer matched the repo inventory, and repeated markdown-glossary workflow assumptions no longer matched the current generated glossary-index surface.

### Spell archive slice AE refreshed

The remaining docs/archive/spell-system/cantrips batch lane was re-audited on 2026-03-12.
Batch 5 through Batch 9 all stayed in place, but each was rewritten to preserve the migration-wave rationale for utility, save-bonus, melee-rider, area-cantrip, and extras-lane handling without presenting those files as the maintained current cantrip workflow.

With these two slices, the cantrip archive folder now reads consistently as historical provenance instead of a mixture of archive notes and accidentally live-sounding batch instructions.

### Archive root slice AF refreshed

The top-level docs/archive slice was re-audited on 2026-03-12.
The archive root README plus @FEATURES-COMPLETED.md, AGENT-COORDINATION-REVIEW.md, DOCUMENT-REVIEW-SUMMARY.md, and SPELL-SYSTEM-RESEARCH-REVIEW.md all stayed in place, but each was rewritten to function as preserved historical context rather than live feature, review-routing, or spell-status authority.

This slice verified that the archive root had drifted into a mixed state where some files still sounded operational even though their real value is provenance.
With this refresh, the archive root now points readers back toward the active docs tree and registry ledgers instead of competing with them.

### Archive branch-cleanup slice AG refreshed

The docs/archive/2025-12-branch-cleanup slice was re-audited on 2026-03-12.
BRANCH_CLEANUP_SUMMARY.md, QUICK_WINS_MERGE_SUMMARY.md, REMOTE_BRANCHES_ACTIONABLE_SUMMARY.md, and REMOTE_BRANCH_ANALYSIS.md all stayed in place, but each was rewritten to function as preserved branch-maintenance provenance rather than current remote-branch operations guidance.

This slice verified that the entire lane is inherently time-bound: branch names, ahead counts, delete commands, and merge-order advice all depended on one December 2025 remote snapshot and should no longer compete with fresh git inspection.

### Archive bug slice AH refreshed

The docs/archive/bugs/2025-11-submap-rendering slice was re-audited on 2026-03-12.
CRITICAL_BUG_SUBMAP_RENDERING.md and FIX_APPLIED_SUBMAP.md both stayed in place, but each was rewritten to function as preserved incident provenance for an older submap-renderer path rather than current bug or fix authority.

This slice verified a concrete path drift: the old reports targeted src/components/SubmapRendererPixi.tsx, while the current submap implementation now lives under src/components/Submap.
It also made the current visual-verification boundary explicit so the old fix note no longer overclaims present submap correctness.

### Archive improvements slices AI-AJ refreshed

The top-level docs/archive/improvements slice was re-audited on 2026-03-12.
The completed improvement-plan files plus QOL_TODO_COMPLETED.md all stayed in place, but each was rewritten to function as preserved refactor or backlog provenance rather than current implementation authority.

This pass verified a mixed pattern: several plans really did land, but some landed along newer modular paths than the plans originally described, and at least one UI plan now reads as design intent that drifted away from the present implementation.

### Archive improvements slice AK refreshed

The docs/archive/improvements/11_submap_generation_deep_dive packet was re-audited on 2026-03-12.
The full deep-dive packet stayed in place, but each file was rewritten to make its actual status visible: the cellular-automata direction broadly landed, the Wave Function Collapse direction remained exploratory, and the PixiJS renderer proposal did not become the current submap layout.

This slice turned a fuzzy future-improvements packet into a clearer historical research bundle with mixed-outcome provenance instead of one big ambiguous planning surface.

### Spell task slice AL re-audited

The next spell-overhaul planning and migration-roadmap slice was re-audited on 2026-03-12 under the stricter evidence-backed review rule:
- 1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md
- 1B-SPELL-MIGRATION-ROADMAP.md
- SPELL_MIGRATION_PATH.md
- TASK_STRATEGY_UPDATE.md
- LEVEL-2-BATCHES.md
- LEVELS-1-9-MIGRATION-GUIDE.md

Key decisions:
- 1H-CREATE-GLOSSARY-TEMPLATE-SYSTEM.md stayed live, but was narrowed into a concrete Spell Description Glossary Linking gap note after verifying that glossary loading and tooltip infrastructure exist while spell-detail linked rendering and spell-specific glossary metadata do not.
- 1B-SPELL-MIGRATION-ROADMAP.md stayed live, but was rebased more concretely around Spell Data File Topology, Spell Manifest Integrity, Spell Description Glossary Linking, Migration Phase Gates, and Level Rollup Coverage Metrics.
- SPELL_MIGRATION_PATH.md and TASK_STRATEGY_UPDATE.md stayed as compatibility pointers only; both were rechecked so they now read purely as redirects into the current rebased roadmap and workflow surfaces.
- LEVEL-2-BATCHES.md stayed live as historical level-rollup provenance, but now explicitly records that the file's 59 listed IDs no longer match the live level-2 folder count of 65 JSON spell files.
- LEVELS-1-9-MIGRATION-GUIDE.md stayed live as an active bridge, but now treats old level artifacts as working aids instead of current truth and uses npm run validate as the core still-live validation gate.

Roadmap-local follow-through:
- The matching spell roadmap-local mirror docs were refreshed under .agent/roadmap-local/features/spells/docs/.
- The spell roadmap-local open-tasks surface now carries concrete capability rows for Spell Description Glossary Linking, Spell Data File Topology, Spell Manifest Integrity, Level 2 Rollup Coverage Metrics, Level-Based Spell Migration Workflow, and Migration Phase Gates.

### Spell task slice AM refreshed

The remaining previously unledgered spell-overhaul leftovers were processed on 2026-03-12:
- 1I-MIGRATE-CANTRIPS-BATCH-1.md
- archive/@README.md
- archive/SPELL_DATA_CREATION_GUIDE.md
- gaps/GAP-CHOICE-SPELLS.md
- gaps/LEVEL-1-GAPS.md

Key decisions:
- 1I-MIGRATE-CANTRIPS-BATCH-1.md stayed at its task-path location only as a compatibility pointer because the preserved Batch 1 record already lives in docs/archive/spell-system/cantrips/.
- archive/@README.md stayed in place, but was rewritten to retire the stale SALVAGED_SPELL_CONTEXT.md assumption and to point back to the maintained spell examples, checklist, roadmap, and leveled migration guide.
- archive/SPELL_DATA_CREATION_GUIDE.md stayed in place as a historical guide snapshot after verifying that its older flat or engineHook-era authoring model no longer matches the current validator-first spell lane.
- gaps/GAP-CHOICE-SPELLS.md stayed live and is now the concrete gap note for Modal Spell Choice Handling. The repo already has partial choice-related structures, but not one reusable structured effect model for modal spells.
- gaps/LEVEL-1-GAPS.md stayed live as a narrow Level 1 Integration Gap Rollup pointer instead of remaining an empty stub.

Roadmap-local follow-through:
- The spell roadmap-local mirror docs were refreshed for the same five files.
- The spell roadmap-local open-tasks surface now includes concrete capability rows for Modal Spell Choice Handling, Level 1 Integration Gap Rollup, and Familiar And Summon Follow-Through.

### Spell completeness output slice AN refreshed

The remaining unledgered completeness-audit output files were processed on 2026-03-12:
- output/LOCAL-INVENTORY.md
- output/PHB-2024-REFERENCE.md

Key decisions:
- LOCAL-INVENTORY.md stayed in place, but was rebased into an explicit historical inventory snapshot after verifying that its 2025 counts have drifted far behind the current live levelized spell tree.
- PHB-2024-REFERENCE.md stayed in place as a preserved external reference packet, but was rewritten to make clear that it is historical input to the old audit rather than proof of a freshly rerun PHB comparison.

Roadmap-local follow-through:
- none. These files are process/reference snapshots, not direct feature-node evidence.

### Feature capability slice AO refreshed

The docs/tasks/feature-capabilities band was re-audited on 2026-03-12.
The six capability notes stayed in place, but each was rewritten into a current-state feature note backed by present repo surfaces rather than vague or forward-looking capability language.

Key decisions:
- character-creator.md now uses concrete Character Creator Multi-Step Flow, Character Creator Background Confirmation, and Character Creator Step Completion Controls naming and explicitly records that completion checks exist without overstating strict sidebar locking.
- companion-banter.md now reflects the implemented NPC_TO_NPC mode, PLAYER_DIRECTED mode, and ignored-player escalation path, plus the current banter UI surfaces.
- merchant-pricing-economy.md now reflects that the merchant pricing path is already shared and live through calculatePrice, regional modifiers, and faction trade bonuses.
- noble-house-generation.md now reflects implemented seeded house generation and noble intrigue foundations instead of treating the system as missing.
- url-history-state-sync.md now reflects the implemented useHistorySync baseline with initial-mount guarding, deep-link restoration, and popstate handling.
- voyage-management.md now reflects that naval state and reducer foundations already exist, while full player-facing voyage orchestration remains a narrower open question.

Roadmap-local follow-through:
- matching roadmap-local mirror docs were created or refreshed under .agent/roadmap-local/features/gameplay/docs/.
- .agent/roadmap-local/features/gameplay/open_tasks.md now carries concrete capability rows for Character Creator Multi-Step Flow, Character Creator Background Confirmation, Character Creator Step Completion Controls, Companion Banter NPC-To-NPC Mode, Companion Banter Player-Directed Mode, Companion Banter Escalation Selection, Merchant Price Calculation, Regional Price Modifiers, Merchant Modal Price Wiring, Faction Trade Price Modifiers, Noble House Seeded Variation, Noble House Identity Composition, Noble Intrigue Event Generation, URL Initial Mount Guard, Deep Link Restoration, Browser Navigation Consistency, Voyage State Model, Voyage Action Wiring, Voyage State Progression, and Voyage Event Generation.

### Roadmap task slice AP refreshed

The docs/tasks/roadmap band was re-audited on 2026-03-12.
These files are mostly process and roadmap-tool docs rather than gameplay-feature docs, so this slice was handled primarily as process-only or stale-roadmap-correction work.

Key decisions:
- 1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md stayed live as preserved vision and handover context in the 2026-03-12 pass, then was retired on 2026-06-25 after its still-useful feature-first and storage-drift context was represented by `docs/@ROADMAP-SYSTEM-GUIDE.md`, Roadmap Maintenance G7, the active 1D contract, and the roadmap-local mirror.
- 1C-ROADMAP-IMPLEMENTATION-PLAN.md stayed live as the current high-level roadmap-tool plan in the 2026-03-12 pass, then was retired on 2026-06-25 after its remaining open items moved into `docs/projects/roadmap-maintenance/GAPS.md` G2.
- 1D-ROADMAP-ORCHESTRATION-CONTRACT.md stayed live and was tightened so its storage and signal language matches the current repo.
- @HANDOVER-CREATION-GUIDE.md stayed live, but is now explicitly a reusable process guide rather than a hidden higher authority than the active roadmap contract.
- ROADMAP-TOOL-NODE-AUDIT.md stayed in place as a historical export in the 2026-03-12 pass, then was retired on 2026-06-25 after the roadmap-local mirror and active roadmap references were confirmed.
- ROADMAP-TOOL-REFERENCE.md stayed live, but was narrowed to the roadmap-tool claims that were actually re-verified in code during this pass.

Roadmap-local follow-through:
- matching roadmap-local mirror docs were refreshed under .agent/roadmap-local/features/roadmap-visualizer/docs/.
- .agent/roadmap-local/features/roadmap-visualizer/open_tasks.md was rebased from stale pre-landing tasks into concrete current roadmap-tool capability rows plus the remaining open backlog.

### Roadmap tool node audit export retired

On 2026-06-25, `docs/tasks/roadmap/ROADMAP-TOOL-NODE-AUDIT.md` was retired.

Key decisions:
- The file was a preserved 2026-03-02 audit export, not live roadmap-tool node
  authority.
- The historical snapshot remains available in
  `.agent/roadmap-local/features/roadmap-visualizer/docs/ROADMAP-TOOL-NODE-AUDIT.md`.
- `docs/tasks/roadmap/ROADMAP-TOOL-REFERENCE.md` remains active as the
  task-facing roadmap tool reference, with
  `devtools/roadmap/ROADMAP-TOOL-REFERENCE.local.md` as the local tooling
  reference.

### Roadmap visualizer evolution handover retired

On 2026-06-25, `docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md`
was retired.

Key decisions:
- The file was vision/provenance, not the active roadmap-processing contract.
- Current feature-first roadmap rules live in `docs/@ROADMAP-SYSTEM-GUIDE.md`
  and Roadmap Maintenance G7.
- `docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md` remains the active
  worker/orchestrator contract.
- The roadmap-local mirror preserves the historical handover text for local
  processing provenance.

### Documentation-cleanup slice AQ refreshed

The first documentation-cleanup task packet was re-audited on 2026-03-12.
These files all stayed in place, but were rewritten into explicit historical task briefs because their original instructions and conclusions are now time-bound cleanup provenance rather than current operating guidance.

Key decisions:
- 1A through 1F now explicitly route readers toward the current registry ledgers and archive-report surfaces instead of presenting themselves as live instructions.
- The older outputs they reference now belong to docs/archive/reports rather than the active docs-control layer.
- The older no-consolidation-needed and system-healthy conclusions are now clearly marked as historical snapshots rather than current truth.

Roadmap-local follow-through:
- none. This slice is process-history material and does not emit new roadmap feature nodes.

### Documentation-cleanup slice AR refreshed

The first improvement-doc migration packet was re-audited on 2026-03-12.
These files all stayed in place, but were rewritten into explicit historical migration notes because their original checkbox-driven instructions belong to a December 2025 migration wave rather than the current first-wave docs review.

Key decisions:
- 1G-MIGRATE-IMPROVEMENT-DOCS.md now frames the packet as historical campaign provenance.
- 1G.1 through 1G.5 now explicitly say that their archive sources and target READMEs exist, but that the migration-checklist language is historical.
- 1G.6 now explicitly records target-path drift: the current submap README lives under src/components/Submap/SubmapPane.README.md rather than the older flat path named in the brief.

Roadmap-local follow-through:
- none. This slice is migration-history material and does not emit new roadmap feature nodes.

### Documentation-cleanup slice AS refreshed

The second improvement-doc migration packet was re-audited on 2026-03-12.
These files all stayed in place, but were rewritten into explicit historical migration notes because their named target READMEs are currently missing and the old completed-task wording can no longer be trusted as live truth.

Key decisions:
- 1G.7 through 1G.10 now explicitly say that their archive sources exist while their named targets do not currently exist at the paths named in the briefs.
- This packet therefore now reads as migration intent and provenance rather than as proof that those migrations landed exactly as written.

Roadmap-local follow-through:
- none. This slice is migration-history material and does not emit new roadmap feature nodes.

### Audits and portraits slice refreshed

On 2026-03-12, the next mixed non-root slice was processed across docs/audits and docs/portraits.

Key decisions:
- docs/audits/level-1-targeting-audit.md stayed live, but was rebased into a current partial-gap note after confirming that the targeting-filter runtime and TargetingPresets.ts already exist while some Level 1 spell JSON filters still lag behind.
- docs/audits/source-references-inventory.md stayed in place as a preserved generated snapshot, with explicit warnings that its 2026-02-13 counts and matches are not current-state truth.
- docs/portraits/race_portrait_regen_backlog.md stayed live as a readable seed backlog at the time, but was later retired on 2026-06-25 after its live work was routed into Character Creator gap `G23`; current-state truth now lives in the JSON backlog seed, race-image status log, and slice-of-life QA ledger.
- docs/portraits/race_portrait_regen_handoff.md stayed live as the portrait tooling runbook, but it now warns that the older fixed snapshot counts are stale and that the checked race-profile markdown files are still incomplete generated stubs.
- the checked race profile markdown files under docs/portraits/race_profiles were rewritten in place as honest incomplete stubs rather than left masquerading as finished lore references.

Roadmap-local follow-through:
- added concrete spell-capability rows under .agent/roadmap-local/features/spells/open_tasks.md for target-filter runtime enforcement, target-filter presets, and the remaining Cure Wounds, Healing Word, and Sleep filter gaps
- added concrete gameplay portrait rows under .agent/roadmap-local/features/gameplay/open_tasks.md for race portrait asset wiring, regeneration pipeline, QA ledger, glossary-sync audit, preview export, and the remaining portrait QA/profile-completion gaps
- added supporting roadmap-local evidence docs under .agent/roadmap-local/features/spells/docs/level-1-targeting-filter-audit.md and .agent/roadmap-local/features/gameplay/docs/race-portraits.md

### Weapon proficiency slice refreshed

On 2026-03-12, the docs/tasks/weapon-proficiency-system subtree was re-audited against current code.

Key decisions:
- README.md, START-HERE.md, @PROJECT-INDEX.md, and @WORKFLOW.md all stayed in place but were rewritten into current-state documents because the old planning-phase narrative was no longer true.
- Tasks 01 through 08 stayed in place as preserved implementation and audit notes in the 2026-03-12 pass, then were retired on 2026-06-25 after their useful provenance was centralized in the living docs and backlog retirement ledger.
- Task 09 stayed live as the narrow Attack Roll Proficiency Penalty gap in the 2026-03-12 pass, then was retired on 2026-06-25 after focused command and opportunity-attack regression coverage proved non-proficient attacks omit proficiency bonus.
- Task 10 stayed live as a partial-gap note in the 2026-03-12 pass because combat ability generation already enforced a Weapon Mastery Proficiency Gate; it was retired on 2026-06-25 after focused tests confirmed the core gate and the remaining warning/bypass work stayed in `GAPS.md` G1-G3.
- Task 11 stayed live as the Combat Weapon Proficiency Warning gap in the 2026-03-12 pass, then was retired on 2026-06-25 after `AbilityButton.tsx` gained a non-proficient weapon warning marker and accessible/tooltip copy. Fresh rendered proof remains active in G2/T2.
- weapon-audit-report.md stayed in place as preserved evidence, but it now explicitly warns that the old remove-isMartial recommendation is historical only.

Roadmap-local follow-through:
- .agent/roadmap-local/features/weapon-proficiency-system/open_tasks.md was rewritten from stale doc-derived checklists into concrete capability rows.
- .agent/roadmap-local/features/weapon-proficiency-system/docs/weapon-proficiency-current-state.md was added as the current evidence summary.
- The concrete roadmap capability names now used for this feature are Weapon Proficiency Check, Permissive Weapon Equip Rule, Inventory Weapon Proficiency Filtering, Equipped Weapon Warning, Inventory Weapon Proficiency Tooltip, Weapon Proficiency Helper Tests, Weapon Mastery Proficiency Gate, Attack Roll Proficiency Penalty, Combat Weapon Proficiency Warning, Weapon Proficiency Visual Verification, Weapon Proficiency Combat Log Explanation, and Weapon Data Single-Source Normalization.

### Decision-log singleton refreshed

On 2026-03-12, docs/decision_logs/race_glossary_sync_questions.md was manually verified and kept in place. The file already functions as a current decision log rather than a stale task brief, so this pass only recorded its processed status in the review ledger.

### Prompt and improvement roadmap follow-through refreshed

On 2026-03-13, docs/Prompts/Google Stitch Prompting.md was manually reclassified and rewritten as a preserved prompt artifact rather than an authoritative documentation page.

Roadmap-local follow-through for already-processed live improvement notes was also added:
- ui-features now has concrete settings-menu capability rows and a supporting settings-menu evidence doc
- gameplay now has concrete village-expansion and control-effect sprite-variant capability rows and supporting evidence docs
- spells now has concrete creature-type convergence capability rows and a supporting evidence doc

Concrete roadmap capability names used in this pass:
- Settings Menu Surface
- Main Menu Settings Entry
- Settings Preference Storage
- Reduced Motion Preference
- Deterministic Village Layout Generation
- Town Canvas Exploration Surface
- Settlement Trait Inference
- Town Metadata Persistence Lane
- Town Description Generation
- Settlement Context Rendering In Town UI
- Control Effect Gameplay Hook
- Control Effect Sprite Variant Swaps
- Control Effect Variant Cache
- Control Effect Visual Fallback Rule
- Creature Type Targeting Filters
- Canonical Creature Type Source
- Creature Type Validation Convergence
- Creature Type Intentional Extension Path

### Level-1 spell reference batch refreshed

On 2026-03-13, the full docs/spells/reference/level-1/ lane was manually re-audited against the matching public/data/spells/level-1/*.json files.

Outcome:
- 60 files were rewritten in place to match the current JSON spell shape more closely.
- 4 files were verified and kept in place: burning-hands.md, chromatic-orb.md, hail-of-thorns.md, and shield.md.

Recurring corrections in this batch:
- singular target labels like creature were normalized to the current JSON creatures values where applicable
- older effect labels such as STATUS and BUFF were replaced with the current spell-schema names like STATUS_CONDITION and UTILITY
- missing utility subtypes were surfaced where the JSON now carries them, such as sensory, information, creation, and communication
- leftover batch-footer noise embedded in some spell reference docs was removed

### Non-spell control and singleton batch refreshed

On 2026-03-14, the next remaining non-spell control and singleton docs were processed.

Key decisions:
- docs/@ROADMAP-SYSTEM-GUIDE.md stayed live, but was rewritten to reflect the current roadmap-visualizer runtime and the local storage split where tooling_state.sqlite is the source of truth for processing artifacts and the JSON files are compatibility snapshots.
- docs/generated/@ALL-MD-FILES.md stayed live only as a preserved generated inventory pointer; the stale exhaustive dump is no longer presented as maintained prose.
- docs/guides/completed/NPC_GOSSIP_SYSTEM_GUIDE.md and docs/guides/completed/NPC_MECHANICS_IMPLEMENTATION_GUIDE.md both stayed in place as preserved completion guides after current repo verification confirmed that the memory, suspicion, goal, and gossip lanes already exist in code.
- docs/tasks/character-creator-styling-audit.md stayed in place as a preserved UI audit note after confirming that it still points at real Character Creator component surfaces, while explicitly warning that it is not a rendered-current standard.
- docs/tasks/CONFIG_REFACTOR_PROPOSAL.md stayed in place as a preserved architecture-improvement note after verifying that ENV.BASE_URL already exists in src/config/env.ts while at least one raw BASE_URL consumer remains in src/hooks/useDiceBox.ts.

Roadmap-local follow-through:
- roadmap-visualizer/open_tasks.md gained concrete capability rows for the feature-first interpretation rule, SQLite tooling storage, and the compatibility snapshot layer
- gameplay/open_tasks.md gained concrete NPC social-mechanics capability rows for NPC Structured Memory State, NPC Suspicion State, NPC Gossip Event Processing, NPC Goal Status Updates, and the remaining player-facing verification gap
- ui-features/open_tasks.md gained concrete rows for Character Creator Component Styling Surface, Character Creator Styling Consistency Re-Verification, Centralized BASE_URL Config Surface, and Raw BASE_URL Consumer Cleanup

### Spell-adjacent non-leaf batch refreshed

On 2026-03-14, the next non-leaf spell-adjacent batch was processed without touching the individual spell reference files.

Key decisions:
- docs/spells/audit/AUDIT_LEVEL_2.md stayed in place but was rewritten into an explicit placeholder note after confirming that the current level-2 spell lane exists while the file itself had no completed audit body.
- docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md and PHB-2024-REFERENCE.md stayed in place as preserved historical packet outputs, with their earlier snapshot role kept explicit.
- docs/tasks/spells/CHARACTER_POLICY.md stayed live and was rewritten into a clean current charset-policy note after repo verification against the validate-data.ts enforcement path.
- the entire docs/tasks/spells/agent_prompts packet stayed in place as preserved prompt artifacts rather than being treated as a current authoritative task queue.

Roadmap-local follow-through:
- spells/open_tasks.md gained concrete capability rows for Spell Charset Validation Gate, ASCII-Strict Spell Data Targets, and Spell Charset Regression Prevention

### Combat messaging and cantrip-pointer slice refreshed

On 2026-03-14, the combat-messaging packet and the remaining Batch 1 cantrip task-path pointer were verified and processed.

Key decisions:
- the full docs/tasks/combat-messaging-enhancement packet stayed in place because the rebased files already correctly describe a partially landed structured combat-messaging lane rather than a greenfield proposal
- docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md stayed in place as a compatibility pointer after confirming that the preserved archive target exists and the cantrip JSON files are already present in the live level-0 spell folder

Roadmap-local follow-through:
- combat-messaging-enhancement/open_tasks.md now records the concrete current capability names for the implemented combat-messaging base layer and its remaining follow-through gaps

### 3D exploration batch refreshed

On 2026-03-14, the remaining docs/tasks/3d-exploration packet was processed.

Key decisions:
- 1A-3D-EXPLORATION-ROADMAP.md, implementation_plan.md, world-map-rewire-mapping.md, and 2B-3D-INTEGRATION-DESIGN-PLAN.md all stayed in place but were rewritten into current-state or preserved-design wording so they stop treating the lane as purely hypothetical.
- the smaller feature-capability notes under feature-capabilities/world-map and feature-capabilities/3d-exploration-combat were kept in place because their branch and capability decisions still matched the verified current MapPane/Azgaar/3D direction.

Roadmap-local follow-through:
- created .agent/roadmap-local/features/world-exploration-combat/open_tasks.md
- recorded concrete current capability names for Azgaar Atlas World Map Bridge, Hidden Cell Click To Travel Bridge, Azgaar Derived Map Generation, 3D Modal Exploration Surface, Submap Procedural Data Bridge, Continuous World Map View, Political Borders Toggleable Layer, Travel Precision Overlay Controls, Atlas Click Travel Parity, Save Load World Map Parity, Submap Continuity Parity, and 3D Exploration Combat Depth

### Feature-capability note batch refreshed

On 2026-03-14, the remaining docs/tasks/feature-capabilities singleton notes were verified and kept in place.

Key decisions:
- character-creator.md, companion-banter.md, merchant-pricing-economy.md, noble-house-generation.md, url-history-state-sync.md, and voyage-management.md already read as current capability notes rather than stale future plans
- those files did not need narrative rewrites because their verified current-state wording already matched the current code surfaces closely enough

Roadmap-local follow-through:
- the already-existing gameplay and ui-features branch notes remain the current roadmap-local mirrors for these capabilities, so this pass only confirmed the names and evidence rather than inventing a second parallel branch

### Final non-spell spell-overhaul support slice refreshed

On 2026-03-14, the last remaining non-spell docs under the spell-overhaul support packet were verified and kept in place.

Key decisions:
- docs/tasks/spell-system-overhaul/archive/@README.md and archive/SPELL_DATA_CREATION_GUIDE.md already honestly read as historical archive material and did not need further rewrite
- docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md and gaps/LEVEL-1-GAPS.md already honestly read as active gap notes rather than stale greenfield task docs and did not need further rewrite
- docs/registry/@DOC-REVIEW-LEDGER.md itself was explicitly brought under processed coverage so the non-spell queue can now close cleanly

### Spell meta prompt packet refreshed

The remaining non-leaf spell docs in `docs/tasks/spells/` and `docs/spells/audit/` were processed on 2026-03-14.

What changed:
- `docs/spells/audit/AUDIT_LEVEL_2.md` was empty, so it was rewritten into an explicit placeholder note tied to the live `public/data/spells/level-2` and `docs/spells/reference/level-2` surfaces.
- `docs/tasks/spells/CHARACTER_POLICY.md` was verified in place against the current charset-validation scripts and kept as the active policy note.
- the `docs/tasks/spells/agent_prompts/` packet was rebased into preserved prompt artifacts with current-reading headers so the files stop posing as blindly current execution orders while retaining their historical spell-migration guidance.

### Combat messaging and spell-meta batch refreshed

On 2026-03-14, the next non-spell packet was processed across combat-messaging docs and spell-adjacent meta docs.

Key decisions:
- docs/tasks/combat-messaging-enhancement/README.md, IMPLEMENTATION_PLAN.md, and SUMMARY.md all stayed in place but were rewritten so they describe an implemented combat-messaging baseline instead of a greenfield proposal.
- docs/spells/audit/AUDIT_LEVEL_2.md stayed in place as an honest placeholder audit hook rather than a fake completed audit.
- docs/tasks/spell-completeness-audit/output/LOCAL-INVENTORY.md and PHB-2024-REFERENCE.md were verified and kept in place because their preserved snapshot framing was already truthful.
- the full docs/tasks/spells/agent_prompts packet stayed in place as preserved historical prompt material after verifying that the referenced validator and validation scripts still exist; the only required mutation in that packet was cleaning literal newline-separator corruption from an earlier write path.
- docs/tasks/spells/CHARACTER_POLICY.md stayed in place because package.json still exposes validate:charset, fix:charset, and validate in the way the policy describes.
- docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md stayed in place as a compatibility pointer to the archived cantrip batch record.

Roadmap-local follow-through:
- .agent/roadmap-local/features/combat-messaging-enhancement/open_tasks.md was rewritten from stale all-unchecked checklist rows into concrete capability rows.
- the concrete roadmap capability names now used for this feature are Combat Message Type Model, Combat Message Factory, Combat Messaging Hook, Combat Log Rich Message Rendering, Combat View Messaging Integration, Combat Messaging Demo Surface, Combat Event Coverage Completion, Combat Notification Integration Depth, Combat Visual Effect Follow-Through, Combat Audio Cue Follow-Through, and Combat Messaging Player Preference Surface.

### Codex Terminal dev-hub historical plans retired

On 2026-06-25, the two preserved Codex Terminal dev-hub plan files under
`docs/plans/` were retired after a fresh source/reference check.

Key decisions:
- `docs/plans/2026-02-27-codex-terminal-dev-hub.md` already identified
  itself as historical design context and had no live backlog items left.
- `docs/plans/2026-02-27-codex-terminal-dev-hub-impl.md` already identified
  itself as a historical implementation note and had no live step-by-step work
  left.
- Current implementation truth remains in `misc/dev_hub.html` and
  `vite.config.ts`, where the Dev Hub terminal UI, xterm/PTY lane, and
  `codexChatManager` plugin wiring still exist.
- No living gap was opened because the retired files were superseded rather
  than carrying a still-valid unowned task.

### Roadmap audit and branch-completion historical plans retired

On 2026-06-25, three preserved roadmap plan files under `docs/plans/` were
retired after a fresh source/reference check.

Key decisions:
- `docs/plans/2026-02-27-roadmap-audit-corrections.md` was a historical
  correction log, not the current roadmap authority.
- `docs/plans/2026-02-27-roadmap-branch-completion-design.md` and
  `docs/plans/2026-02-27-roadmap-branch-completion-plan.md` preserved useful
  branch-completion intent, but their current actionable residue is already
  represented by Roadmap Maintenance's stale-audit/freshness gap.
- Current implementation truth remains in
  `devtools/roadmap/scripts/roadmap-engine/generate.ts`, `vite.config.ts`, and
  `devtools/roadmap/src/components/debug/roadmap/health-signals/`.
- No new gap was opened because `docs/projects/roadmap-maintenance/GAPS.md`
  already tracks the unresolved audit-freshness risk.

### Roadmap capability extraction and server-separation plans migrated

On 2026-06-25, two still-valid roadmap plans under `docs/plans/` were migrated
into Roadmap Maintenance and then retired.

Key decisions:
- `docs/plans/2026-03-15-capability-decision-plan.md` carried valid roadmap
  extraction doctrine, but the durable work is now the smaller Roadmap
  Maintenance gap `G7`: create an enforceable extraction contract covering
  capability name, parent branch, primary status, optional blocked note,
  evidence basis, node type, atomized naming, and backlog separation.
- `docs/plans/2026-03-18-roadmap-server-separation-plan.md` remains valid as an
  architecture direction because `npm run dev:roadmap` still uses root Vite
  mode and root `vite.config.ts` still owns roadmap runtime behavior. The
  durable work is now Roadmap Maintenance gap `G8`.
- The old standalone plan files were deleted after their surviving work moved
  into `docs/projects/roadmap-maintenance/GAPS.md` and `TRACKER.md`.

### Spell branch and spell graph overlay implementation packets retired

On 2026-06-25, three implemented roadmap spell-navigation packets under
`docs/plans/` were retired after focused source and test proof.

Key decisions:
- `docs/plans/2026-03-19-spell-branch-ontology.md` is superseded by the live
  `devtools/roadmap/src/spell-branch/` implementation, generator, and
  acceptance tests.
- `docs/plans/2026-03-19-spells-graph-overlay-design.md` and
  `docs/plans/2026-03-19-spells-graph-overlay.md` are superseded by the live
  recursive `SpellGraphOverlay`, `pillar_spells` roadmap injection, virtual
  node detail wiring, and Spell Branch tab handoff.
- Focused proof: `npx vitest run devtools/roadmap/src/spell-branch/
  devtools/roadmap/scripts/generate-spell-profiles.test.ts --reporter=dot`
  passed 62 tests, and `npx tsx devtools/roadmap/scripts/generate-spell-profiles.ts`
  emitted 459 profiles.
- The current roadmap tool reference was updated to avoid preserving the old
  hard-coded 469-profile count from the retired packets.

### Roadmap media preview and layman rename packets retired

On 2026-06-25, four implemented roadmap tool packets under `docs/plans/` were
retired after source and focused test proof.

Key decisions:
- `docs/plans/2026-03-21-roadmap-node-media-previews-design.md` and
  `docs/plans/2026-03-21-roadmap-node-media-previews.md` are superseded by the
  live `.media/` policy files, media scanner module, `hasMedia` node annotation,
  media endpoint, info-panel preview button, and lightbox wiring.
- `docs/plans/2026-03-23-roadmap-node-layman-renames-design.md` and
  `docs/plans/2026-03-23-roadmap-node-layman-renames-impl.md` are superseded by
  the live `ROADMAP_CAPABILITY_RENAME_RULES` and curated roadmap source entries
  in `devtools/roadmap/scripts/roadmap-engine/generate.ts`.
- Focused proof: `npx vitest run
  devtools/roadmap/scripts/roadmap/node-media-presence/media-scanner.test.ts
  devtools/roadmap/scripts/roadmap-server-logic.test.ts --reporter=dot`
  passed 8 tests.
- The roadmap tool reference now describes Node Media Previews as current
  behavior rather than a planned item.

### Spell branch cleanup, reset dock, and local cleanup packets retired

On 2026-06-25, five remaining direct packets under `docs/plans/` were retired
after source and destination checks.

Key decisions:
- `docs/plans/2026-03-23-spell-branch-navigator-node-cleanup.md` and
  `docs/plans/2026-03-23-spell-branch-navigator-node-cleanup-impl.md` are
  superseded by the current roadmap generator and local `.media` inventory: the
  old infrastructure-only Spell Branch Navigator nodes are absent, while the
  top-level navigator GIF and current child captures exist under the local media
  directory.
- `docs/plans/2026-03-24-reset-node-positions-dock-button-design.md` and
  `docs/plans/2026-03-24-reset-node-positions-dock-button.md` are superseded by
  current `RoadmapVisualizer` source, where `Reset Node Positions` lives beside
  `Reset View` in the bottom dock instead of the toolbar menu.
- `docs/plans/2026-05-18-local-git-cleanup-evaluation.md` is historical local
  operator state. Its docs scaffold and ignore-rule decisions already landed,
  weapon icon path normalization exists in source, premade-party gear work has
  Package 2 spell task ownership, and the IconRegistry split concern is already
  routed through Glossary UI G5 / code-modularization CMA-G11. No stash was
  applied or deleted because the old note's stash reference is order-stale.

### First Superpowers plan slice processed

On 2026-06-25, the first three `docs/superpowers/plans/` files were walked.

Key decisions:
- `docs/superpowers/plans/2026-05-11-death-saving-throws.md` was retired after
  fresh focused proof confirmed the current death-save/downed-state runtime
  passes 10 tests. Remaining design-preview screenshot/proof work belongs to
  the separate Design Preview Scenarios lane, not this implementation packet.
- `docs/superpowers/plans/2026-05-12-equip-premade-characters.md` was still
  partially valid: fresh combat utility proof found additional martial premades
  without `equippedItems.MainHand`. This pass equipped Borin Vance, Ghazka
  Tidebreaker, Korag Frostpeak, Maelis Deepcurrent, Nyx Manyfaces, Posy
  Underbough, Sylvaris Frostbloom, Thorgrim Anvilmar, Unit Seven-Tin, and
  Vlaakith Szarn, then reran the focused tests successfully.
- `docs/superpowers/plans/2026-05-13-spell-mechanics-discovery-closure.md` was
  kept because the mechanics-discovery report and Spells parent gaps still show
  open actionable bucket findings. It remains an active packet until the
  mechanics-discovery lanes supersede or close it.

### Superpowers world and 3D plans retired

On 2026-06-25, four older `docs/superpowers/plans/` implementation packets were
retired after source, project-doc, and focused-test checks.

Key decisions:
- `docs/superpowers/plans/2026-04-04-takram-sky-fixes.md` is superseded by the
  current Takram source: `trueSunDirection`, Takram moon/effect-composer/cloud
  controls, `correctAltitude`, cloud layers, and ToneMapping exposure are wired.
  This pass did not claim fresh rendered sky proof.
- `docs/superpowers/plans/2026-05-28-world-sim-extensions.md` is superseded by
  the live `WorldData`/`runWorldSim` pipeline, Azgaar producer wiring,
  save-load migration, and Worldsim Service gap rows WSS-001 through WSS-008.
- `docs/superpowers/plans/2026-05-30-world3d-streaming-infrastructure.md` and
  `docs/superpowers/plans/2026-05-31-world3d-chunk-rendering.md` are superseded
  by current World3D source and living World3D gaps. Streaming, chunk bundles,
  terrain, water, roads, site boxes, and vegetation all have current source and
  project-doc owners.
- Focused proof already run in this retirement pass: the WorldSim/map/save-load
  sweep passed 93 tests across 15 files, and the World3D/component sweep passed
  118 tests across 32 files.

### Remaining Superpowers implementation packets walked

On 2026-06-25, the rest of the executable `docs/superpowers/plans/` bucket was
walked. Only the mechanics-discovery closure packet remains because it still
contains active spell-mechanics findings.

Key decisions:
- `docs/superpowers/plans/2026-05-31-world3d-rendering-hardening.md` is
  superseded by current World3D source and living docs. Scene origin,
  vegetation cap, WebGL context-loss handling, concrete scene sizing, and the
  deep-link guard are represented in source and tests.
- `docs/superpowers/plans/2026-06-01-world-3d-ui-transition-and-marker-sync.md`
  is superseded by the World 3D UI living docs and current PLAYING-phase
  routing/HUD/marker/minimap/nameplate implementation. `NORTH_STAR.md` now
  points to the retirement ledger for old Plan 4 provenance.
- `docs/superpowers/plans/2026-06-15-isolated-web-account-probes.md` was
  removed from Aralia backlog because it is Agent Matrix control-plane work.
  `F:\Repos\Aralia-operator-dashboard` already owns and implements the
  Cursor web-account probe path.
- `docs/superpowers/plans/2026-06-22-sp0-atlas-svg-render-port-iter1.md` and
  `docs/superpowers/plans/2026-06-23-sp1-voronoi-submap-engine-iter1.md` are
  superseded by the Worldforge tracker and source. SP0 Atlas SVG and SP1
  Voronoi submap engine work now live in Worldforge's SP0/SP1/SP2 lanes.

### 2026-03-14 - Non-spell backlog sweep continued

Processed and rebased four more non-spell packets:
- control/generated meta docs (@ROADMAP-SYSTEM-GUIDE, generated/@ALL-MD-FILES, completed NPC guides, empty spells/audit/AUDIT_LEVEL_2.md)
- docs/tasks/documentation-cleanup/*
- docs/tasks/testing-overhaul/*
- docs/tasks/combat-messaging-enhancement/*

Key decisions:
- preserved historical task/campaign docs were kept in place when they already had truthful rebased wording
- stale plan docs that still implied blank-slate work were rewritten in place as preserved backlog notes tied to current repo reality
- the roadmap system guide now reflects the SQLite-backed local tooling state instead of the older manifest-only phrasing
- the generated all-markdown snapshot is now explicitly preserved as historical generated inventory provenance rather than a live docs-cleanup control surface

### Loose checklist and tooling concept bucket walked

On 2026-06-25, the loose unchecked-checkbox bucket was walked to separate
durable reusable checklists from true backlog packets.

Key decisions:
- `docs/guides/@RACE-ADDITION-DEV-GUIDE.md`,
  `docs/guides/CLASS_ADDITION_GUIDE.md`,
  `docs/guides/FEAT_SELECTION_IMPLEMENTATION_GUIDE.md`,
  `docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md`,
  `docs/guides/RACE_ADDITION_GUIDE.md`,
  `docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md`, and
  `docs/guides/TABLE_CREATION_GUIDE.md` stayed in place as durable authoring
  guides. Their unchecked boxes are reusable future-work checklists, not
  current backlog items to migrate or auto-close.
- `docs/superpowers/specs/2026-05-21-3d-combat-map-design.md` stayed in place
  as implemented design rationale. Current 3D combat-map follow-ups live in
  `docs/projects/3d-combat-map/` and `docs/projects/battle-map/`.
- `docs/VISION.md` stayed in place as a long-horizon product-direction file,
  not an executable backlog file to empty.
- `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md` was retired after
  its surviving useful work was routed into Scripts: Workflows gap `G4` and
  tracker task `T6`: add lightweight version-bump guidance only if
  release/version decisions become active. The specialized review-agent idea is
  deferred until actual inconsistency proves that a separate tool is needed.

### Slasher feat design note retired

On 2026-06-25, `docs/plans/features/SLASHER_FEAT_DESIGN.md` was retired.

Key decisions:
- Slasher combat behavior is implemented in `src/commands/effects/DamageCommand.ts`
  and covered by Slasher command tests.
- The design note's remaining STR/DEX setup concern is now covered by
  `src/components/CharacterCreator/FeatSelection.test.tsx`, which proves Slasher
  cannot be confirmed until an ability is selected and records that choice.
- Remaining non-Slasher feat-choice proof stays in Character Creator gap `G22`
  and tracker task `T8`; the standalone Slasher design file no longer owns
  actionable work.

### Quest migration plan retired

On 2026-06-25, `docs/tasks/QUEST_MIGRATION_PLAN.md` was retired.

Key decisions:
- Quests decision `D2` is now the durable migration path: a phased adapter
  bridge keeps legacy `Quest` as the runtime state contract while
  `QuestDefinition` becomes the authoring/template contract.
- This pass implemented the Phase 1 adapter in
  `src/systems/quests/questAdapter.ts` and added focused adapter proof.
- Remaining quest migration work stays in Quests `GQ-7` for factory/helper
  adoption and `GQ-8` for save/load schema validation.

### Town refactor plan retired

On 2026-06-25, `docs/tasks/TOWN_REFACTOR_PLAN.md` was retired.

Key decisions:
- The old component-grouping work is superseded by current source under
  `src/components/Town/`.
- `src/App.tsx` currently lazy-loads `./components/Town/TownCanvas`.
- `VillageScene` remains exported and tested as a secondary surface, so the
  surviving question is not file movement; it is whether `VillageScene` should
  remain documented secondary surface or be decommissioned/activated.
- That surviving question now lives in Town gap `G4` and tracker task `T4`.

### Documentation Cleanup 1G packet bucket retired

On 2026-06-25, the historical
`docs/tasks/documentation-cleanup/1G*.md` migration packet bucket was retired.

Key decisions:
- Documentation Cleanup was already closed as complete-enough by D-04.
- The 1G packet content was historical provenance for moving archived
  improvement docs toward source-adjacent READMEs.
- Current checks found the target/source documentation for the migrated slices,
  except the old `src/components/CharacterCreator/README.md` folder README from
  1G.8. That missing README is not reopened here because D-04 explicitly chose
  not to widen the duplicate-cleanup scope.
- Future agents should use `docs/projects/documentation-cleanup/`,
  `docs/archive/improvements/`, source-adjacent READMEs, and this ledger instead
  of the deleted 1G packets.

### Documentation Cleanup 1A-1F packet bucket retired

On 2026-06-25, the historical 1A through 1F documentation-cleanup task packet
bucket was retired.

Key decisions:
- Documentation Cleanup was already closed as complete-enough by D-04 with no
  open project gaps.
- Each 1A through 1F brief already framed itself as historical December 2025
  provenance rather than current documentation authority.
- The cited archive report deliverables still exist under `docs/archive/reports/`,
  and current navigation/authority lives in `docs/@DOC-REGISTRY.md`,
  `docs/@DOCUMENTATION-GUIDE.md`, `docs/archive/@README.md`, and the registry
  ledgers.
- The stale `docs/@DOC-NAMING-CONVENTIONS.md` pointer from 1B was not preserved
  as an active handoff because naming rules now live in `docs/@DOC-REGISTRY.md`.

Future agents should use the living Documentation Cleanup project folder,
archive reports, and registry ledgers instead of the deleted 1A through 1F
packets.

### Spell Completeness 1A-1C and task GAPS retired

On 2026-06-25, the historical
`docs/tasks/spell-completeness-audit/1A~*.md`, `1B~*.md`, `1C~*.md`, and
task-folder `GAPS.md` backlog surfaces were retired.

Key decisions:
- The 1A, 1B, and 1C files were completion notes whose outputs still exist:
  `output/LOCAL-INVENTORY.md`, `output/PHB-2024-REFERENCE.md`, and
  `@SPELL-COMPLETENESS-REPORT.md`.
- The still-valid stale-inventory, PHB revalidation, and count-drift backlog
  from task-folder G001-G003 now lives in the living Spells subproject gap
  `spell-completeness-audit-G1`.
- The preserved output files and report remain in place as historical evidence;
  only the empty task briefs and duplicate GAPS owner were removed.

### Weapon Proficiency task packet series retired

On 2026-06-25, the historical
`docs/tasks/weapon-proficiency-system/01-*.md` through `09-*.md` and
`11-combat-ui-warnings.md` packets were retired.

Key decisions:
- Tasks 01 through 08 were implementation/audit provenance for behavior already
  represented by the living docs and source anchors.
- Task 09 was verified by existing command and opportunity-attack regression
  coverage.
- Task 11 was executed in this pass by adding a visible/accessibility-backed
  combat ability-button warning for non-proficient weapon attacks.
- Fresh rendered combat-flow proof remains active in `GAPS.md` G2 and
  `TRACKER.md` T2; the old standalone task packets no longer own the work.

### Roadmap spell ontology questions retired

On 2026-06-25, `docs/tasks/roadmap/1E-SPELL-ROADMAP-ONTOLOGY-QUESTIONS.md`
was retired.

Key decisions:
- The original spell ontology questions are resolved or implemented by the live
  Spell Branch Navigator, profile generator, V/S/M tree, axis engine, graph
  overlay, and roadmap integration.
- The packet's stale 469-spell count is superseded by current generator proof
  recorded in the backlog retirement ledger: 459 emitted profiles.
- The only surviving follow-through is `arbitrationType` depth. Roadmap
  Maintenance now owns capability cross-links in G9, while Spells owns cast-time
  `ai_assisted` / `ai_dm` semantics through G21-G23.
- No rendered roadmap proof was claimed in this retirement row.

### Maritime Travel Plan 1 executed and retired

On 2026-06-25,
`docs/superpowers/plans/2026-06-25-maritime-travel-plan1-routing-core.md` was
walked during backlog retirement.

Key decisions:
- The plan was valid when walked: current `routePlanning.ts` did not yet support
  graph-supplied per-edge travel time, and no multimodal atlas graph existed.
- Tasks 1 through 5 source/test work was executed in place by adding `TravelGraph.edgeMinutes`,
  focused route-planning coverage, the first `multiModalAtlasGraph` slice,
  route segmentation, the composite multimodal readout, and AtlasSvgView
  segmented land/sea rendering with screen-space harbor markers, plus MapPane
  ferry sea-preference wiring.
- Controlled rendered proof exists for the route overlay:
  `.agent/scratch/maritime-map-proof/atlas-route-proof.png` shows the real
  AtlasSvgView rendering land and sea segments, a harbor marker, a destination
  pin, and the composite readout.
- Generated-atlas proof exists in
  `.agent/scratch/maritime-map-proof/generated-route-proof.png`, and full
  MapPane Travel-session proof exists in
  `.agent/scratch/maritime-map-proof/map-pane-generated-route-proof.png`.
- The remaining appendix work now has living Travel owners in G13-G16:
  owned-ship travel, dock tiers/tenders, ferry fares, and sea danger/encounters.
- The standalone plan packet was deleted after its completed work and remaining
  intent were moved into `docs/projects/travel/`. The completed core is recorded
  in `docs/projects/travel/GAPS.md` G12 and `TRACKER.md` T5, while the follow-up
  maritime scope is recorded in G13-G16.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/registry/@DOC-MIGRATION-LEDGER.md","sha256WithoutMarker":"20b9685230b54e145706b67a032a9e640e6fb502ee25699e84d55b424ca767ef","markedAtUtc":"2026-06-25T23:48:24.938Z"} -->
