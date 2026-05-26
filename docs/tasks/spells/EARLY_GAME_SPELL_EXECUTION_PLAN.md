# Early-Game Spell Execution Plan

Last Updated: 2026-05-26

## Purpose

This plan defines the current target for the spell project after the spell-truth
parity lane moved mostly green. The project is no longer just "make spell JSON
valid." The active goal is to make early-game spells usable by a player and
testable by the team across character creation, character sheet spellbook,
combat simulation, Atlas tracking, and spell gate reporting.

This plan also makes the early-game spell project the next live production trial
for Symphony. Symphony refinement and finalization should happen inside this
work, but only when the spell flow exposes a concrete workflow need.

Current live boundary: Packages 1 through 14 have merged history and receipts,
including the Package 9 higher-level caster fixture coverage, the `G93` Jules
post-launch update-boundary repair, Package 10 target-filter/eligibility,
Package 11 status/state-change, Package 12 conditional-ending, and Package 13
terrain/surface, and Package 14 vision/light/sound slices. Package 15 is now
selected as the `summon_or_controlled_entity` mechanics slice and is in handoff
preparation. Treat the task tracker below as the spell-project source of truth
while the Package 15 Jules handoff is landed and dispatched through the visible
dashboard path.

The live task collection and status tracker is
`docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`. Treat it as the guiding
project file for package status, discovered tasks, detailed subtask links, and
adjacent out-of-scope gaps.

Decision points for the assumed-approval Symphony/Jules test flow are recorded
in
`conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`.
Use that report with the tracker when reconstructing why an agent approved,
waited, repaired locally, sent Jules feedback, or merged a PR.

Dashboard-first workflow constraint: use the Symphony dashboard in the Codex
in-app browser as the primary path for this test flow. Visible dashboard task
cards, proof boards, controls, and blockers are the authoritative workflow
surface. Direct API calls or terminal shortcuts may inspect state, start local
servers, verify claims, or implement a dashboard/workflow repair, but they must
not bypass a dashboard blocker. If the dashboard blocks the flow, record the
blocker and improve the dashboard/workflow or docs before proceeding.

Current Package 0 evidence for Symphony workflow changes should continue to run
through `npm run verify:jules-contract` or the smallest relevant verifier slice
when a full contract pass would be disproportionate.

## Project Goal

Make all cantrips and level 1-3 spells genuinely early-game usable in Aralia,
while using that scoped spell wave as the live finalization pass for the
Symphony/Jules delegation workflow.

For this plan, "usable" means:

- the spell data is valid and discoverable through the manifest
- the spell is visible in player-facing spell selection and spellbook surfaces
- class and preparation rules are represented well enough that premade and
  player-created casters do not simply receive every spell
- the spell can be functionally tested in the combat simulator when it has a
  deterministic combat behavior
- spells that are primarily flavor, social, illusion, descriptive, or otherwise
  open-ended are routed through explicit AI arbitration instead of fake
  deterministic mechanics
- Atlas and the spell gate checker are refreshed at defined checkpoints so
  progress remains observable rather than hidden in scattered commits
- Symphony can coordinate the work sequentially through scoped task intake,
  branch/worktree isolation, Jules environment setup, Jules dispatch, PR
  follow-through, decision reporting, ROI evidence, deployment/local-sync proof,
  task-page evidence, and artifact lifecycle filing without relying on ad hoc
  terminal memory
- a living task tracker records all discovered package tasks, links to detailed
  subtask files, tracks status, and captures adjacent gaps that should not
  silently expand the current slice

## Combined Goal Text

Complete Phase 1 of the spell execution project by making cantrips and level 1-3
spells player-visible, rules-aware, mechanically testable, and explicitly routed
through deterministic execution or AI arbitration as appropriate. Use this same
Phase 1 as the live Symphony finalization run: every spell slice must move
through the documented sequential Symphony/Jules flow, exercising and improving
Jules environment setup, branch/worktree handling, task drafting, guarded
GitHub/Jules actions, PR review, Atlas/gate refreshes, deployment/local-sync
evidence, task-scoped communication, decision reporting, and ROI measurement.

The result should be both:

- a playable early-game spell band covering cantrips and spell levels 1-3
- a proven Symphony operating pattern that is ready to repeat for spell levels
  4-9 later
- a living task tracker that can guide future agents by recording package
  status, detailed task files, newly found tasks, and adjacent out-of-scope gaps

## Scope

### Included Spell Band

- Cantrips, stored under `public/data/spells/level-0/`
- Level 1 spells, stored under `public/data/spells/level-1/`
- Level 2 spells, stored under `public/data/spells/level-2/`
- Level 3 spells, stored under `public/data/spells/level-3/`

Higher-level spells are out of scope for this execution wave except when a
shared schema/runtime change must stay compatible with them.

### Included Product Surfaces

- Character creator spell choice flow
  - class-specific spell selection components under `src/components/CharacterCreator/`
  - character assembly in `src/hooks/useCharacterAssembly.ts` and
    `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
- Character sheet spellbook
  - `src/components/CharacterSheet/CharacterSheetModal.tsx`
  - `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx`
  - `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`
- Combat simulator and battle-map execution
  - `src/components/BattleMap/`
  - `src/components/Combat/`
  - `src/hooks/useAbilitySystem.ts`
  - `src/utils/character/spellAbilityFactory.ts`
  - `src/commands/factory/SpellCommandFactory.ts`
  - `src/commands/effects/`
- Premade character fixtures
  - `public/premade-characters/`
  - `src/services/premadeCharacterService.ts`
  - prior equipment context in
    `docs/superpowers/plans/2026-05-12-equip-premade-characters.md`
- Spell tracking and reporting
  - `misc/spell_pipeline_atlas.html`
  - `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`
  - `scripts/generateSpellGateReport.ts`
  - `public/data/spell_gate_report.json`
  - generated reports under `docs/tasks/spells/`
- Symphony workflow finalization
  - use the visible dashboard and Jules/GitHub links as the workflow surface
  - keep Symphony source, dashboard runtime state, generated manifests, draft
    ids, click receipts, retry state, local sync receipts, and verifier output
    external or ignored
  - commit only Aralia-facing task packets, prompts, short blocker summaries,
    and package tracker updates that help Jules or future Aralia contributors
  - classify each workflow artifact as Aralia GitHub, external Symphony, local
    ignored state, Linear, dashboard state, or a temporary migration note before
    deciding where it belongs
- Artifact lifecycle and cleanup policy
  - `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`

## Current Baseline

The latest local deep dive found:

- `npm run validate:spells` passes with `459 / 459` valid spell JSON files.
- `SPELL_STRUCTURED_VS_JSON_REPORT.md` regenerates with `0` mismatches.
- `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md` regenerates with a very small
  residue set rather than the older hundreds-count backlog.
- `SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md` currently reports warnings rather
  than errors.
- `SPELL_MECHANICS_DISCOVERY_REPORT.md` remains the real execution backlog:
  `1,235` actionable-open mechanics findings across `24` bucket families.

The practical interpretation is:

- broad data validity is no longer the blocker
- player visibility, legal spell selection/preparation, combat execution, AI
  arbitration, and mechanics bucket closure are now the main work
- older docs that still describe large canonical/JSON mismatch counts must be
  treated as historical unless regenerated in the current flow

## Non-Goals

- Do not claim all level 4-9 spells are complete in this wave.
- Do not give every premade caster every spell just to make testing easy.
- Do not hide unresolved mechanics in prose when a reusable schema/runtime bucket
  is needed.
- Do not hand-code one-off spell behavior when a mechanics bucket can solve a
  family of spells.
- Do not treat AI arbitration as a dumping ground for mechanics that should be
  deterministic, such as damage, healing, saves, targeting, concentration,
  resources, and area hazards.

## Completion Definition

This project is complete for cantrips and level 1-3 spells when all of the
following are true:

1. Data checks pass:
   - `npm run validate:spells`
   - `npm run validate:spell-markdown`
   - structured-vs-canonical audit regenerated and triaged
   - structured-vs-json audit regenerated and green or explicitly triaged
   - runtime template audit regenerated and warnings either resolved or recorded
     as accepted follow-up boundaries
2. Character creator checks pass:
   - every class that should choose cantrips or level 1-3 spells can do so
   - spell choices are level-appropriate
   - prepared spell counts are enforced or explicitly documented where the
     current rules model is incomplete
   - selected spells survive character assembly
3. Spellbook checks pass:
   - selected/prepared spells render cleanly in the character sheet modal
   - spell cards are readable and design-friendly in the spellbook
   - prepared, unprepared, always-prepared, cantrip, and slot-level states are
     visually distinguishable without clutter
   - spellbook display does not depend on raw JSON/debug labels leaking to the
     player
4. Premade party checks pass:
   - the default loading party contains a level 1 variant for each class
   - each premade has class-appropriate, functionally working gear for combat
   - caster premades have legal cantrips and a legal prepared/known spell set
   - no caster is preloaded with the whole class spell list
5. Combat simulator checks pass:
   - deterministic cantrips and level 1-3 spells can be cast from representative
     premade/test characters
   - target selection, action cost, spell slots, saves/attacks, effects, and
     combat log output are observable
   - non-deterministic or open-ended spells show the AI arbitration/input path
     instead of silently doing nothing or pretending to be a generic effect
6. Tracking checks pass:
   - Atlas reflects the current bucket status for this scoped wave
   - `public/data/spell_gate_report.json` is regenerated at the required gates
   - mechanics-discovery buckets for cantrips and level 1-3 are reduced,
     explicitly accepted, or routed into future tasks
   - Symphony/Jules decision reports record the phase decisions and the agent's
     assumed-approval choices for this test flow
7. Symphony finalization checks pass:
   - Jules environment setup is run or deliberately deferred with proof
   - each implementation slice uses a documented branch/worktree strategy
   - Symphony task pages carry the relevant prompt, dialogue, guarded action,
     approval checkpoint, task messages, clarifications, PR state, deployment,
     local-sync, and ROI evidence
   - approved GitHub/Jules actions are either executed by the documented
     Symphony pathway or recorded as operator-run guarded actions with receipts
   - post-merge deployment and local-sync proof are captured for at least one
     spell-project PR
   - task-scoped Codex/Jules usage and avoided-work estimates are recorded
     before any ROI claim
   - package artifacts are filed according to
     `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` before a
     slice is treated as closed

## Artifact Lifecycle Policy

Spell Phase 1 cleanup is non-destructive by default. The project should prevent
stale setup files from confusing future agents, but it should not erase durable
planning, prompt, receipt, or proof context merely because a slice is done.

The canonical policy is
`docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`.

Use it at every slice closeout to decide whether each task packet, prompt,
receipt, proof screenshot, generated report, setup artifact, runtime file, and
local app setting should be retained, marked completed, archived, ignored, or
deleted.

Package closeout must record:

- retained canonical artifacts
- completed evidence artifacts
- superseded artifacts and their replacements
- ignored or deleted runtime/temp artifacts
- generated report refresh/archive status
- targeted MemPalace mining status
- the next package's active context file

## Premade Character Strategy

The default party should support real early-game play and combat simulator
testing.

Required default party shape:

- one level 1 premade variant for each class
- class-appropriate equipment
- working AC, weapon damage, ranged ranges, spellcasting ability, hit points, and
  spell resources
- legal spell selections for casters
- prepared spell counts that match the current rule model used by the app

Testing convenience should come from additional test fixtures, not from making
the default party illegal.

Recommended additional fixtures:

- level 3 caster variants for classes that need level 2 spell testing
- level 5 caster variants for classes that need level 3 spell testing
- focused "spell lab" casters whose only purpose is to cover otherwise hard to
  reach spell lists
- manifest metadata that marks these as dev/test fixtures if they should not be
  normal starting-party choices

Open design decision:

- decide whether the simulator should expose these higher-level caster variants
  through the existing premade picker, a dedicated dev combat roster, or a
  simulator-only fixture loader

## AI Arbitration Strategy

AI arbitration should be used deliberately for spells where deterministic
mechanics are not the right first representation.

Good candidates:

- social manipulation
- broad illusion/disguise interpretation
- descriptive utility
- knowledge gathering
- open-ended environmental or narrative requests
- spells whose outcome depends on free-form player intent

Poor candidates:

- ordinary damage and healing
- clear saving throw outcomes
- repeat saves
- concentration cleanup
- area entry/exit damage
- object targeting rules
- spell slots and action costs
- deterministic buffs/debuffs

Each AI-routed spell should have:

- an explicit `arbitrationType`
- meaningful `aiContext`
- a prompt that states what the model may and may not decide
- `playerInputRequired` set honestly
- a UI/input proof path in the spell casting flow
- a fallback behavior if AI is unavailable

## Mechanics Bucket Strategy

Work mechanics by reusable bucket before doing one-off spell fixes.

Priority bucket families for levels 0-3:

1. `choice_or_mode`
2. `attack_or_save_modifier`
3. `target_filter_or_eligibility`
4. `status_or_state_change`
5. `conditional_ending`
6. `terrain_or_surface`
7. `vision_light_sound`
8. `summon_or_controlled_entity`
9. `sustain_or_recast_action`
10. `reaction_or_opportunity_restriction`

The order can change when a concrete player-facing test path proves that another
bucket blocks more spells.

Each bucket slice should produce:

- scoped list of affected cantrip/level 1-3 spells
- schema/template decision if new fields are needed
- runtime JSON migration for representative spells
- command/runtime support if deterministic
- AI arbitration routing if not deterministic
- focused tests
- regenerated reports
- Atlas and gate updates

## Atlas And Spell Gate Checkpoints

Atlas and spell gate checker updates are required at these points:

1. Intake baseline
   - regenerate gate report and current spell audits
   - record current cantrip/level 1-3 mechanics counts
2. After each mechanics bucket slice
   - update Atlas bucket status and history
   - regenerate `public/data/spell_gate_report.json`
   - update relevant bucket docs if the model changed
3. After each player-surface slice
   - record character creator or spellbook proof
   - update gate checks if new player-facing warnings become available
4. Before any merge/completion claim
   - rerun spell audits and focused UI/runtime tests
   - record residual bucket counts and accepted boundaries

## Symphony/Jules Flow

Use Symphony as the coordinator and Jules as the primary implementation worker
for narrow slices. Codex should act as foreman: scope, prepare, review, verify,
repair routing, and record decisions. Codex should only implement directly when
the slice is not suitable for Jules or when a small local repair is needed to
unblock the flow.

Recommended flow:

1. Local Codex intake
   - generate the current scoped spell reports
   - identify cantrip/level 1-3 affected spell list by bucket
   - prepare Jules-ready task drafts
   - record the current Symphony refinement target for the slice
2. Symphony draft creation
   - one draft per bounded slice
   - include file ownership, commands, expected proof, and non-goals
   - include the Symphony evidence that the slice must produce
3. Jules environment / dispatch readiness
   - confirm the Jules environment setup state
   - decide whether a Jules task can run safely without a new setup snapshot
   - record that decision before dispatch
4. Jules dispatch
   - send only implementation slices with clear write scope
   - avoid sending ambiguous architecture decisions as open-ended Jules work
   - prefer dispatching to Jules over local Codex implementation when the slice
     has clear file ownership, clear acceptance criteria, and reproducible tests
5. PR review
   - inspect changed files against the slice contract
   - run local tests and regenerated reports
   - classify failures as code, data, setup, or decision-boundary issues
6. Atlas/gate refresh
   - update tracking after the slice is proven
7. Symphony evidence refresh
   - update task page evidence, guarded actions, approval checkpoint,
     deployment/local-sync readiness, and ROI receipts as applicable
8. Decision report
   - record phase decisions, options considered, and agent-selected action

## Jules-First Delegation Policy

The default operating assumption is: offload as much implementation work as
practically possible to Jules.

Codex should keep these responsibilities local:

- project intake and slice definition
- reading current reports and code enough to produce a safe Jules prompt
- choosing one active slice
- deciding whether a slice is Jules-ready
- setting branch/worktree expectations
- writing or updating the task plan and decision report
- reviewing Jules output
- running verification
- classifying failures
- performing tiny local glue fixes only when they are safer than a new Jules
  round
- updating Atlas/gate/Symphony evidence after the slice is proven

Jules should receive implementation-heavy slices such as:

- premade character equipment and legal spellbook fixes
- character creator spell-selection repairs
- spellbook UI/display improvements with clear screenshots/tests
- deterministic combat simulator spell pilots
- bounded mechanics bucket migrations
- runtime JSON updates for a known spell set
- focused tests and verifier additions
- Atlas/gate updates when the expected edits are clear

Do not send Jules:

- unclear architecture choices before Codex has framed the options
- broad "fix all spells" tasks
- destructive Git operations
- ambiguous schema rewrites without a decision record
- simultaneous overlapping slices

If a slice is not Jules-ready, Codex should first convert it into a Jules-ready
task: define files, non-goals, commands, expected proof, and decision boundaries.

## Model Routing Policy

Symphony should route routine chores to efficient models where the task is
bounded, evidence-based, and low ambiguity. Expensive reasoning should be
reserved for decisions that can change schema, runtime behavior, player-facing
rules, or cross-slice policy.

Use efficient models for:

- scanning reports and extracting counts
- finding files, owners, and references
- summarizing Jules/GitHub/Linear state from structured packets
- drafting task cards from an already-decided scope
- updating routine status text
- checking whether required artifacts exist
- preparing non-creative Atlas/gate refresh notes
- comparing expected verifier output against actual output
- formatting decision-report entries after Codex has chosen the decision

Use stronger models for:

- deciding whether a mechanic is deterministic or AI-arbitrated
- schema/runtime architecture changes
- broad AI arbitration policy
- spell preparation and class-rule interpretation
- PR review where behavior or regressions are possible
- conflict resolution between docs, code, reports, and live evidence
- deciding whether to merge, reroute, or split a failed Jules slice
- writing the final slice summary and next-slice recommendation

The model choice itself should be recorded when it affects the workflow. A
decision report entry does not need to mention every cheap scan, but it should
record when Symphony deliberately used an efficient model for a bounded chore or
a stronger model for an architecture/policy decision.

## Sequential Operating Model

This plan is designed to work without starting parallel agents.

The foreman should run the project as a single-filed queue:

1. Choose exactly one active slice.
2. Establish that slice's baseline from current reports and code.
3. Convert the slice into a Jules-ready bounded task whenever possible.
4. Dispatch only that one Jules slice and wait for its PR/result
   before opening the next implementation slice.
5. Review, test, regenerate reports, update Atlas/gates, and record decisions.
6. Close or requeue the slice with explicit residual work.
7. Only then select the next slice.

The intended sequencing is:

1. Dashboard/Git workflow baseline and worktree hygiene.
2. Jules environment setup decision and snapshot proof.
3. Baseline inventory for levels 0-3.
4. Premade party and gear legality.
5. Character creator spell-selection visibility.
6. Character sheet spellbook display quality.
7. Combat simulator deterministic pilot.
8. AI arbitration pilot.
9. First mechanics bucket closure.
10. Repeat mechanics buckets in priority order.

This avoids the main risk of parallelization here: multiple workers touching the
same spell schema, spell JSON, premade fixtures, and UI assumptions before the
project has a stable slice pattern.

Jules should be treated as a sequential external worker, not as parallel swarm
capacity. A good Jules task should have:

- one ownership surface
- one affected spell band or bucket
- one expected PR
- one verifier command set
- one Atlas/gate update expectation
- one completion report

The foreman can still do non-mutating analysis while waiting for a Jules result,
but should not start a second write-producing spell task until the active slice
is reviewed and filed.

## Branch And Worktree Strategy

Use one branch per active slice. Prefer an isolated worktree when the slice may
run long, touch generated reports, or overlap with local documentation work.

Recommended pattern:

- keep the main checkout available for foreman review, docs, and report reading
- create a dedicated branch for each implementation slice, for example
  `codex/spells-l0-l3-baseline` or `jules/spells-premade-party-gear`
- use a worktree for code/data implementation slices so generated reports,
  package installs, and test artifacts do not pollute the foreman's main checkout
- keep docs-only planning updates in the current branch unless they become a
  separate reviewable implementation PR
- never share one implementation branch across unrelated spell slices
- after a slice merges or is abandoned, remove or preserve the worktree
  intentionally and record the final branch/PR/disposition in the tracker or
  active package packet

Branch is the Git identity of the slice. Worktree is the local isolation
mechanism. For this project, use both for implementation slices unless the task
is purely read-only or docs-only.

Package 2 reserved names, decided 2026-05-21:

- Jules implementation branch:
  `jules/spells-package2-premade-party-gear`
- Codex review/repair branch, only if needed after Jules output:
  `codex/spells-package2-premade-party-gear-review`
- local worktree:
  `F:\Repos\Aralia\.worktrees\spells-package2-premade-party-gear`

These names are reserved but not created until the Jules Environment snapshot
proof exists and the Package 2 task is promoted or dispatched.

## Jules Environment Setup

The original Package 2 Jules environment setup has been run and is now
historical evidence, not a current blocker for Package 5. Before each new Jules
slice, the foreman should still check whether the active task needs a refreshed
environment note or a narrower verification command set.

Before dispatching a Jules implementation slice:

1. inspect the current Jules environment setup packet in Symphony
2. confirm the setup script is appropriate for the current repo
3. run or request the Jules Environment page setup only as its own recorded
   external mutation
4. capture the setup result/snapshot as proof
5. only then dispatch the first Jules task

The original recommended setup attempted to make Jules capable of running broad
repo checks before the spell slice:

- `npm ci --no-audit --no-fund`
- `npm run typecheck`
- `npm run validate:spells`

Do not let Jules environment setup become an implicit side effect of the first
spell implementation task. It is a separate boundary and should be recorded as
such.

Historical setup decision, 2026-05-21:

- The Symphony packet moved past `ready_for_operator_snapshot`; the old setup
  contract is historical rather than a current Package 5 requirement.
- The original broad snapshot script was:
  1. `npm ci --no-audit --no-fund`
  2. `npm run typecheck`
  3. `npm run validate:spells`
- That broad script failed in Jules during `npm run typecheck` because the clean
  tracked clone lacks local untracked/generated TypeScript modules that are
  present in this workspace. Local `npm run typecheck -- --pretty false` passed,
  so this is a tracked-clone typecheck mismatch rather than a dependency install
  failure.
- The accepted Package 2 scoped snapshot script is:
  1. `npm ci --no-audit --no-fund`
  2. `npm run validate:spells`
  3. `npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose`
- That scoped script passed in Jules: spell validation reached 0 invalid files,
  the split combat utility test glob passed 6 files and 37 tests, and Jules
  exported environment state.
- The receipt file for that external proof is
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`.
- The operator/browser-capable foreman runbook for that external action is
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md`.
- Package 2, Package 3, and Package 4 have since completed and merged. Treat
  their task packets and receipts as historical Aralia-facing evidence.
- Package 5 is the current Jules-preferred slice, but visible dispatch remains
  blocked by the dashboard GitHub sync gate on the main checkout. Do not treat
  old Package 2 draft ids, handoff ids, or local Symphony receipts as current
  dispatch state.

## Approval And Autonomy Rules For This Test Flow

For this test flow, the operator has allowed assumed approval for phase decisions,
but the agent must report every decision point and what it chose.

Agent may proceed autonomously with:

- reading docs/code/data
- running local audits/tests
- regenerating local reports
- creating local drafts
- classifying mechanics buckets
- editing local docs for plan/tracking clarity
- making local code/data changes within an active scoped task

Agent must record, and normally treat as approval-bound outside this test flow:

- pushing to GitHub
- opening or merging PRs
- changing shared schema/runtime architecture
- changing default premade roster semantics
- routing a large family of spells to AI arbitration
- accepting unresolved mechanics as permanent boundaries
- modifying workflow or CI behavior
- changing public player-facing UX semantics

Decision reporting for this Phase 1 flow must be summarized in the
Aralia-facing tracker or package packet whenever the decision affects Jules,
GitHub, task scope, or future Aralia contributors. Detailed Symphony-local
decision logs may exist outside the repo, but they are not the durable Aralia
source of truth unless a short excerpt is intentionally copied into the tracker,
package packet, or temporary migration note.

Operator approval update, 2026-05-21:

For this early-game spell execution test flow, the operator explicitly approves
the agent to take the following actions without stopping for separate approval,
provided each action is scoped to the active documented slice, performed
sequentially, and recorded in the decision report:

- pushing a branch
- opening a PR
- merging a PR
- changing shared schema/runtime architecture
- changing premade roster semantics
- setting broad AI arbitration policy

This approval does not authorize destructive or unrelated actions such as
force-pushing, deleting the GitHub repository, deleting unrelated local work,
changing credentials/secrets, releasing to production, or mutating systems outside
the documented early-game spell execution flow.

## Initial Work Packages

### Package 0: Symphony Finalization Baseline

Goal: make sure Symphony is ready to coordinate the spell project before the
first implementation slice.

Outputs:

- keep stale Symphony task text from misleading the active package queue
- decide and record when a Jules environment setup refresh is needed for a
  specific slice
- confirm the branch/worktree naming pattern for spell slices
- record Phase 1 assumed-approval decisions in Aralia-facing tracker or package
  summaries when they affect Jules, GitHub, task scope, or future contributors
- confirm how the visible dashboard records branch push, PR open, PR merge,
  deployment, local sync, Atlas/gate refresh, and ROI evidence for the spell
  flow without committing Symphony runtime/source artifacts to Aralia
- define the artifact lifecycle policy for prompt packets, receipts, proof
  screenshots, generated reports, setup artifacts, runtime files, and local app
  settings

Current Package 0 evidence:

- Historical Symphony verifier and setup evidence remains useful background,
  but Symphony runtime/source verification is no longer an Aralia package
  deliverable by itself. If a future dashboard blocker requires a Symphony code
  repair, track that repair outside the Aralia source tree unless the Aralia
  repo intentionally carries a temporary migration note.
- Aralia-facing Package 0 evidence now lives in this plan, the lifecycle policy,
  and `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`.

### Package 1: Scoped Baseline

Goal: produce a fresh, level 0-3 scoped inventory.

Current baseline artifact: `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`.

Outputs:

- count of spells by level and class access
- mechanics-discovery actionable findings filtered to levels 0-3
- current character creator coverage map
- current spellbook rendering issues
- current combat simulator castability sample
- Atlas/gate baseline refresh
- Symphony task draft for the first implementation slice
- task-scoped ROI baseline receipt with current Codex foreman usage separated
  from later avoided-work estimates
- current ROI baseline receipt:
  `docs/tasks/spells/SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md`
- artifact lifecycle policy:
  `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`

### Package 2: Premade Party And Gear

Goal: make the default level 1 party a usable simulator baseline.

Outputs:

- verify or repair all 13 premade characters
- add class-appropriate equipment
- verify AC and weapon behavior in combat conversion
- verify caster spellbooks and preparation counts
- add tests or audit script for premade loadout legality
- use the drafted Jules task at
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
- use the exact Jules prompt packet at
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`
- preserve the Symphony draft payload at
  `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
- use the dispatch-readiness checklist at
  `docs/tasks/spells/PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` before creating
  a Symphony task draft, Jules handoff, branch, worktree, or PR
- use the ROI baseline receipt at
  `docs/tasks/spells/SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md` so Package 2 does
  not confuse foreman setup work with measured Jules savings
- use the Atlas/gate checkpoint receipt at
  `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` before
  declaring Package 2 verified or opening Package 3
- use the foreman review receipt at
  `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` to classify scope,
  verification, and repair/advance decisions after Jules returns
- use the task communication receipt at
  `docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` to separate
  task-scoped messages and clarifications from broad thread context
- use the PR/deployment/local-sync receipt at
  `docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` before
  claiming Package 2 completed the GitHub, deployment, and local sync lifecycle
- prove the full Symphony slice lifecycle on a bounded non-schema PR:
  branch/worktree, PR, review, merge, deployment/local-sync evidence, decision
  report, and ROI receipt
- file Package 2 artifacts under the lifecycle policy before marking the slice
  closed

### Package 3: Spellbook And Character Creator Visibility

Goal: make early-game spells pleasant and trustworthy to select and inspect.

Outputs:

- spell cards grouped and labeled cleanly
- prepared/unprepared/cantrip states visible
- spell selection in character creator validated by class and level
- player-facing labels cleaned of raw schema noise
- screenshots or component tests for core flows
- task-page evidence showing UI proof captures and Atlas/gate refresh receipts

### Package 4: Combat Simulator Pilot

Goal: prove a deterministic spell path end to end.

Suggested pilot families:

- direct damage cantrips
- simple healing spells
- basic save-or-condition spells
- basic buffs with visible duration/resource behavior

Outputs:

- cast from premade/test character
- target selection works
- effect applies
- resource/action cost updates
- combat log is readable
- test proves the path
- Symphony records whether the spell behavior was deterministic and which
  mechanics bucket, if any, remains open after the pilot

### Package 5: AI Arbitration Pilot

Goal: prove an open-ended spell path end to end.

Suggested pilot spells:

- `minor-illusion`
- `prestidigitation`
- `suggestion`
- `disguise-self`

Outputs:

- meaningful arbitration prompt
- player input modal or equivalent proof
- AI unavailable fallback
- combat/simulator behavior is explicit
- gate report marks the spell as intentionally AI-routed
- decision report records why these spells are AI-routed rather than
  deterministic and which boundaries are accepted for Phase 1

## Risks

- Premade characters may expose broader character assembly bugs.
- Legal spell preparation may require rule-model cleanup before UI work looks
  correct.
- Some mechanics buckets may require schema changes that affect all spell levels.
- Atlas may lag generated report truth unless refreshed during every slice.
- AI arbitration can hide missing deterministic mechanics if the boundary is not
  enforced.

## Next Action

Packages 9, 10, 11, 12, 13, and 14 plus the `G93` post-launch Jules
update-boundary repair are complete on `master`. The older post-Package 6
consolidation boundary, `G48`, `G49`, and Package 10/11/12 candidate notes are
historical.

Latest completed slice: Package 14 `vision_light_sound` launched through the
visible Symphony/Jules path as Linear `ARA-23`, handoff
`handoff-1779763287600-th7aze`, Jules session `16016352181102771214`, and PR
#1110. Jules produced useful sound, sensory manifestation, illusion, and light
metadata for selected early-game spells plus a `SoundEmission` type bridge and
focused `SensoryMechanics` proof. Codex accepted the product work through a
bounded branch-hygiene repair because Jules' post-review head added an
out-of-scope `.github/workflows/gemini-review.yml` quota-bypass edit and did
not fix stale `vision_light_sound.md` header counts. The accepted head
preserved only Package 14 product/test/bucket files, corrected the bucket counts
to Open `61`, Closed `185`, Deferred flavor `7`, and merged as
`3fdf4cb174d42f15f38353adf69890015ec33ff6` after local and GitHub proof.

Immediate action:

1. Land Package 15 prep for `summon_or_controlled_entity` from current
   `origin/master`: package task, Jules prompt, tracker row, and visible
   dashboard draft shortcut.
2. Before dispatch, confirm the cantrip/level 1-3 affected rows are mapped and
   that the package remains large enough to justify the Jules handoff overhead.
3. Use the visible Symphony dashboard path for draft, Linear, handoff,
   manifest, Jules launch, and visual Jules-page inspection.
4. If a PR appears, review it against the approved plan before accepting:
   it must classify every named early-game row, close only proven rows, keep
   broad summon/control systems out of scope, exclude helper scripts and
   scratch artifacts including `classify*` and `patch_*` files, and include
   the requested focused verification.
5. Keep decision logging compact in the next run: full decision entries only
   for real forks, compact wait rows for repeated unchanged Jules/GitHub states,
   and routine implementation details in the completion report.
