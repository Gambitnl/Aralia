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
- [`../@PROJECT-OVERVIEW.README.md`](../@PROJECT-OVERVIEW.README.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
- [`../@DOCUMENTATION-GUIDE.md`](../@DOCUMENTATION-GUIDE.md)
- [`../@README-INDEX.md`](../@README-INDEX.md)

## Explicit Decisions Already Applied

### Registry layer rewritten around actual scope

These registry and governance files were manually re-audited and rewritten on 2026-03-11 so they stop overclaiming precision while mixed task trees still exist:
- [`../@ACTIVE-DOCS.md`](../@ACTIVE-DOCS.md)
- [`../@DOC-NAMING-CONVENTIONS.md`](../@DOC-NAMING-CONVENTIONS.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)
- [`../@RETIRED-DOCS.md`](../@RETIRED-DOCS.md)

The new policy is:
- `@ACTIVE-DOCS.md` is a curated work-entry surface, not an exhaustive status dashboard
- `@DOC-NAMING-CONVENTIONS.md` governs legacy numbered work-doc systems honestly rather than pretending all docs follow one uniform scheme
- `@DOC-REGISTRY.md` tracks in-scope numbered work-doc families only and flags known irregularities instead of inventing false certainty
- `@RETIRED-DOCS.md` is kept in sync with explicitly logged retired numbered docs

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

These active plan/spec docs were moved into structured plan or reference locations:
- `ARCH_TYPES_REFACTOR.md` -> [`../plans/refactors/ARCH_TYPES_REFACTOR.md`](../plans/refactors/ARCH_TYPES_REFACTOR.md)
- `CONFIG_REFACTOR_PLAN.md` -> [`../plans/refactors/CONFIG_REFACTOR_PLAN.md`](../plans/refactors/CONFIG_REFACTOR_PLAN.md)
- `PROPOSED_TIME_REFACTOR.md` -> [`../plans/refactors/PROPOSED_TIME_REFACTOR.md`](../plans/refactors/PROPOSED_TIME_REFACTOR.md)
- `TYPES_REFACTOR_PLAN.md` -> [`../plans/refactors/TYPES_REFACTOR_PLAN.md`](../plans/refactors/TYPES_REFACTOR_PLAN.md)
- `SLASHER_FEAT_DESIGN.md` -> [`../plans/features/SLASHER_FEAT_DESIGN.md`](../plans/features/SLASHER_FEAT_DESIGN.md)
- `BIOME_DNA_API.md` -> [`../architecture/BIOME_DNA_API.md`](../architecture/BIOME_DNA_API.md)
- `MCP_INTEGRATION.md` -> [`../guides/MCP_INTEGRATION.md`](../guides/MCP_INTEGRATION.md)

### `docs/AGENT.md` conflict reduced

The old mixed-purpose `docs/AGENT.md` doc was renamed into [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md).

[`../AGENT.md`](../AGENT.md) now exists only as a compatibility pointer so:
- root `AGENTS.md` references do not break immediately
- older TODO references can be updated gradually

### Canonical overview rewritten against the repo

[`../@PROJECT-OVERVIEW.README.md`](../@PROJECT-OVERVIEW.README.md) was rewritten on 2026-03-10 after claim-by-claim verification against the current repository.

The rewrite removed stale assumptions about:
- the repo being a static import-map-only app
- there being no local `node_modules` or Vite build surface
- styling living only in inline HTML styles
- the older, narrower source-tree description

### Registry and governance layer refreshed

These root registry surfaces were rewritten on 2026-03-11 after manual verification against the current docs tree:
- [`../@ACTIVE-DOCS.md`](../@ACTIVE-DOCS.md)
- [`../@DOC-NAMING-CONVENTIONS.md`](../@DOC-NAMING-CONVENTIONS.md)
- [`../@DOC-REGISTRY.md`](../@DOC-REGISTRY.md)

Key decisions in that refresh:
- `@ACTIVE-DOCS.md` is now a narrow work-entry surface, not a stale global status dashboard
- `@DOC-NAMING-CONVENTIONS.md` now governs legacy numbered work-doc families rather than pretending to define every naming rule in the repository
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
- turned `SPELL_MIGRATION_PROMPT.md` into a reusable current template instead of a partially outdated â€œLevel 3+â€ prompt

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
- `00-GAP-ANALYSIS.md` stayed live as a narrow AI arbitration gap index after current checks confirmed the backend surfaces still exist and the expected UI surface was still absent

### Spell-system architecture / implementation-spec slice refreshed

The next spell-overhaul architecture/spec docs were processed on 2026-03-11:
- `00-PARALLEL-ARCHITECTURE.md`
- `0-PRIORITY-SCHEMA-EVOLUTION.md`
- `01-typescript-interfaces.md`
- `03-command-pattern-base.md`

Key decisions:
- `00-PARALLEL-ARCHITECTURE.md` was moved into `docs/archive/spell-system/` because it had become a historical five-agent delivery plan with a broken research reference and a module map that no longer matches the live repo
- the original `00-PARALLEL-ARCHITECTURE.md` path was preserved as a compatibility pointer
- `0-PRIORITY-SCHEMA-EVOLUTION.md` stayed live, but was rebased into a current gap-audit note after verifying that many of the older "missing schema" claims are now partly or fully implemented
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
- `19-ai-spell-arbitrator.md` stayed live as preserved task context after verifying that the arbitrator already exists under `src/systems/spells/ai`, not under the older proposed `src/services/ai/` tree
- `IMPLEMENT-AI-ARBITRATION-SERVICE.md` stayed live, but was narrowed into a current follow-through brief rather than a contradictory "already implemented but still needs to be created" task
- `GAP-01-AI-INPUT-UI.md` was rebased after verifying that the repo already contains `AISpellInputModal.tsx` plus `useAbilitySystem` input-request handling; the remaining gap is wiring/proof-of-life
- `GAP-02-EXAMPLE-AI-SPELLS.md` was rebased after verifying that AI-tagged spell JSON already exists, while curated proof-of-life examples still need better prompts and input requirements
- `GAP-03-AI-CACHING.md` stayed live as a real optimization gap because no `ArbitrationCache.ts` was found
- `GAP-04-REAL-TERRAIN-DATA.md` was narrowed after verifying that `MaterialTagService` already uses concrete tile information when available and only falls back to biome inference when needed
- `00-GAP-ANALYSIS.md` was corrected so it no longer repeats the stale "AI input UI is missing entirely" assumption

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
- `COMPLETE-STUB-COMMANDS.md` stayed live, but was reduced to a preserved completion note after verifying that `HealingCommand` already handles temporary-HP logic and that the real remaining follow-through is condition expiry plus defensive-effect lifecycle cleanup
- `TASK-01.5-TYPE-PATCHES.md` stayed live as preserved task context because other spell docs still point to it, but it was rebased after verifying that the type, validator, and schema additions it demanded already exist in the current repo
- `IMPLEMENT-REMAINING-EFFECT-COMMANDS.md` stayed live as preserved task context after verifying that the once-missing command families now exist under `src/commands/effects`, while some runtime depth still remains open
- `IMPLEMENT-AOE-ALGORITHMS.md` stayed live as preserved task context after verifying that the AoE suite already exists under `src/systems/spells/targeting` and that the old utility-first plan is now historical
- `IMPLEMENT-CONCENTRATION-TRACKING.md` stayed live as preserved task context after verifying that concentration now exists across combat types, commands, damage checks, helper utilities, and UI-adjacent surfaces
- `TODO_OBJECT_TARGETING.md` remained live as an active rebased gap note because the object-targeting limitation is still materially present in the verified spell resolver path

### Spell-system light / rider / terrain gap slice refreshed

The next spell-overhaul gap docs were processed on 2026-03-11:
- `11A-DYNAMIC-LIGHTING-SUPPORT.md`
- `11B-SAVE-PENALTY-RIDER.md`
- `11C-TERRAIN-UTILITY-STRUCTURES.md`

Key decisions:
- `11A-DYNAMIC-LIGHTING-SUPPORT.md` stayed live, but was rebased into a current-status note after verifying that structured light data already exists in `light.json`, combat state already tracks `activeLightSources`, and `UtilityCommand` already emits light sources; the remaining gap is expiry and renderer/vision follow-through
- `11B-SAVE-PENALTY-RIDER.md` stayed live, but was rebased after verifying that `mind-sliver.json` already carries `savePenalty`, combat types already define `SavePenaltyRider`, and `SavePenaltySystem` already supports registration plus `next_save` consumption
- `11C-TERRAIN-UTILITY-STRUCTURES.md` stayed live, but was rebased after verifying that `mold-earth.json` already uses structured `manipulation` blocks and `TerrainCommand` already handles the relevant manipulation cases; the remaining gap is broader persistence/integration depth rather than absent structure

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
- concentration and object-targeting roadmap entries were rebased to current capability names and state rather than old â€œmissing featureâ€ heading fragments

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
- `1F-VERSION-REVIEW-AGENT-CONCEPT.md` moved into `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md` because it is a future tooling/versioning concept rather than a spell-system implementation task; the original task path now survives as a compatibility pointer
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
- `09_remove_obsolete_files.md` stayed in place, but was rewritten as a historical completion note after verifying that its targeted obsolete files are already gone from the repo
- `12_expand_village_system.md` stayed in place, but was rebased to acknowledge that the repo already has live village/town generation and exploration surfaces; the real remaining work is richer depth and persistence, not basic existence
- `CREATURE-TYPE-ENUM-AND-REQUIREMENT.md` stayed live as a current improvement brief because the gap it describes still exists in narrowed form: creature-type handling is already widespread, but it is still governed by strings rather than a single canonical type source
- roadmap signal for this slice is process-only: these docs help describe improvement branches and current gaps, but they do not directly emit new roadmap nodes by themselves
### Improvements settings, malleable-world, and sprite-variant slice verified

The next `docs/improvements/` slice was processed on 2026-03-11:
- `SETTINGS_MENU_PLAN.md`
- `MALLEABLE_WORLD_DEV_NOTES.md`
- `SPRITE-POSE-CONTROL-VARIANTS.md`

Key decisions:
- `SETTINGS_MENU_PLAN.md` stayed live as a valid feature plan after verifying that the repo has menu infrastructure but no confirmed first-class settings surface in the current pass
- `MALLEABLE_WORLD_DEV_NOTES.md` stayed live as an experimental subsystem note because the deformation and overlay stack already exists under `src/components/ThreeDModal/Experimental/`, even though full production gameplay integration was not verified
- `SPRITE-POSE-CONTROL-VARIANTS.md` stayed live as a forward feature brief because `UtilityCommand.ts` already exposes the control-option gameplay hook, while a sprite-variant manifest or swap system was not found
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
- SETTINGS_MENU_PLAN.md stayed live as a feature plan, but was rewritten to stop implying that a dedicated settings surface already exists
- MALLEABLE_WORLD_DEV_NOTES.md stayed live as an experimental subsystem note after verifying the deformation stack in the ThreeD experimental path
- SPRITE-POSE-CONTROL-VARIANTS.md stayed live as a feature request, but now anchors itself to the verified control-option hook in UtilityCommand instead of assuming a sprite-variant pipeline already exists
- DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md stayed live as a tooling-improvement note, but was compressed to reflect the repo's real current process infrastructure rather than a large speculative automation suite

### Improvements completed slice B refreshed

The next docs/improvements/completed slice was re-audited on 2026-03-11.
The four files stayed in place as preserved completion notes because the completed subtree is already the correct historical home for them.
Each file was rebased against the current repo so the preserved note explains what landed and where the repo shape drifted afterward.

### Architecture slice A opened

The architecture/reference pass has now started. VISIBILITY_SYSTEM.md was rewritten on 2026-03-11 to match the live visibility APIs and to stop overclaiming current battle-map integration.
- Architecture README.md was also rewritten to keep the maintenance guide aligned with the current generator and validation commands.

### Architecture reference slice A refreshed

The first architecture reference slice was re-audited on 2026-03-11.
README.md, SPELL_SYSTEM_ARCHITECTURE.md, and VISIBILITY_SYSTEM.md stayed in place as live reference docs, but each was rebased against the current repo to remove stale paths, stale APIs, and stale status claims.
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
00-AGENT-COORDINATION.md, 00-DATA-VALIDATION-STRATEGY.md, 00-PARALLEL-ARCHITECTURE.md, AGENT-ALPHA-TYPES.md, AGENT-BETA-TARGETING.md, and AGENT-GAMMA-COMMANDS.md all stayed in place, but each was rewritten to preserve late-2025 spell-delivery intent without pretending to be the live workflow or module contract.

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
- 1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md stayed live as preserved vision and handover context, but it no longer overclaims older storage assumptions as if they are still the whole live roadmap-tool state.
- 1C-ROADMAP-IMPLEMENTATION-PLAN.md stayed live as the current high-level roadmap-tool plan, but now reflects the verified SQLite-backed storage layer and the current live roadmap scripts instead of older monolithic JSON assumptions.
- 1D-ROADMAP-ORCHESTRATION-CONTRACT.md stayed live and was tightened so its storage and signal language matches the current repo.
- @HANDOVER-CREATION-GUIDE.md stayed live, but is now explicitly a reusable process guide rather than a hidden higher authority than the active roadmap contract.
- ROADMAP-TOOL-NODE-AUDIT.md stayed in place as a historical export and now explicitly says so.
- ROADMAP-TOOL-REFERENCE.md stayed live, but was narrowed to the roadmap-tool claims that were actually re-verified in code during this pass.

Roadmap-local follow-through:
- matching roadmap-local mirror docs were refreshed under .agent/roadmap-local/features/roadmap-visualizer/docs/.
- .agent/roadmap-local/features/roadmap-visualizer/open_tasks.md was rebased from stale pre-landing tasks into concrete current roadmap-tool capability rows plus the remaining open backlog.

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
- docs/portraits/race_portrait_regen_backlog.md stayed live as a readable seed backlog, but it now clearly defers current-state truth to the JSON backlog seed, race-image status log, and slice-of-life QA ledger.
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
- Tasks 01 through 08 stayed in place as preserved implementation and audit notes because the core helper, permissive equip rule, inventory wiring, mannequin warning, and data-cleanup intent already landed or partially landed.
- Task 09 stayed live as the narrow Attack Roll Proficiency Penalty gap because src/utils/combat/combatUtils.ts exposes isProficient but this pass did not prove final modifier stripping.
- Task 10 stayed live as a partial-gap note because combat ability generation already enforces a Weapon Mastery Proficiency Gate.
- Task 11 stayed live as the Combat Weapon Proficiency Warning gap because no dedicated combat warning surface was verified.
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
