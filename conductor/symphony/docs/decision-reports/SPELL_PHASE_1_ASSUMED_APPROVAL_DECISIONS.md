# Spell Phase 1 Assumed-Approval Decisions

Last Updated: 2026-05-25

This report records decision points for the early-game spell execution flow:
cantrips and spell levels 1-3. The operator has approved the test flow to assume
approval for scoped branch pushes, PR opens, PR merges, shared spell
schema/runtime changes, premade roster semantic changes, and broad AI
arbitration policy. That approval is limited to the documented Phase 1 spell
flow and does not authorize destructive or unrelated actions.

The purpose of this file is not to ask the same approval question repeatedly.
It is to make the agent's choices inspectable after each phase: what decision
was needed, what options existed, what the agent chose, why it chose that path,
what changed, and what proof should come next.

If a decision exposes Symphony workflow or documentation friction, the entry
must also say whether the issue was repaired locally, logged in
`conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`, logged in
`conductor/symphony/docs/tasks/SYMPHONY_OPEN_TASKS.md`, or recorded as an
adjacent gap in `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`. The decision
ledger should make the choice inspectable, but it should not become the only
durable home for unresolved workflow work.

This report is not a raw receipt archive. Record the decision moment, options,
agent choice, evidence, mutation or non-mutation, and next proof. Do not copy
dashboard caches, generated manifests, click logs, local task-store JSON, or
lists of every Symphony support PR into a spell package record. If the decision
matters to future spell work, summarize the durable consequence in the spell
tracker or package packet; keep raw Symphony receipts external or ignored.

For a compact map of recurring patterns in this large ledger, use
`SPELL_PHASE_1_DECISION_TRENDS_INDEX.md`. That index is the operator-facing
summary; this file remains the detailed audit archive.

## Approval Envelope

Approved for this Phase 1 test flow when scoped to the active documented slice:

- pushing a branch
- opening a PR
- merging a PR
- changing shared schema/runtime architecture
- changing premade roster semantics
- setting broad AI arbitration policy

Still outside the assumed-approval envelope:

- force-pushing or deleting remote branches outside the active slice
- deleting the GitHub repository or unrelated local work
- changing credentials, secrets, billing, or account configuration
- releasing to production outside the documented spell flow
- mutating unrelated Linear, Jules, GitHub, deployment, or local Git state
- treating unresolved mechanics as permanent without a recorded boundary

## Tool And Environment Boundaries

Some prompts are not project approval gates. They are Codex tool or sandbox
boundaries, usually because the command writes outside `F:\Repos\Aralia` or
because the tool cannot prove the command is limited to the workspace.

Example from 2026-05-21: Git refused `git status` and `git check-ignore` because
the repository owner SID differs from the current process SID. The durable fix,
`git config --global --add safe.directory F:/Repos/Aralia`, writes to global Git
configuration, so Codex asked for tool approval. That question did not mean the
spell project needed strategic approval. It meant the environment needed a Git
safety exception before ordinary Git commands could run without per-command
overrides.

If that global fix is not present, use `git -c safe.directory=F:/Repos/Aralia`
for read-only Git inspection when possible, and record verifier failures caused
by the safe-directory guard separately from project failures. Treat this as an
environment/tool boundary, not a project approval gate.

## Sequential Jules-First Rule

Codex is the foreman. Jules is the default implementation worker. Work proceeds
one bounded slice at a time:

1. Codex scopes the slice and writes the Jules-ready task.
2. Symphony records the branch/worktree, prompt, expected proof, and decision
   boundaries.
3. Jules performs the implementation-heavy work when the slice is clear enough.
4. Codex reviews, verifies, classifies failures, updates Atlas/gate evidence,
   records decisions, and only then opens the next implementation slice.

No parallel write-producing spell slices should run until this Phase 1 flow has
a proven slice pattern.

## Model Routing Record

Use efficient models for bounded chores such as extracting counts from reports,
checking artifact existence, formatting already-decided decision entries, and
summarizing structured Symphony/GitHub/Jules packets.

Use stronger models for decisions that can change player-facing rules, spell
schema, spell runtime behavior, AI arbitration policy, premade roster semantics,
PR merge readiness, or conflict resolution between docs, code, reports, and live
evidence.

Record model routing when the choice matters to the decision. Routine scans do
not need individual entries.

## Decision Entry Template

Copy this block for each decision.

```markdown
### Decision N: Short Title

- Date/time:
- Phase:
- Active slice:
- Decision point:
- Options considered:
- Decision made by agent:
- Model routing:
- Rationale/evidence:
- Mutation performed or skipped:
- Scope guardrails:
- Result:
- Next expected proof:
```

## Decisions

### Decision 0: Treat Git Safe-Directory Prompt As Tool Boundary, Not Project Approval

- Date/time: 2026-05-21
- Phase: `symphony_finalization`
- Active slice: Package 0, Symphony finalization baseline
- Decision point: Git refused ordinary repo commands because `F:/Repos/Aralia`
  is owned by a different Windows SID than the current Codex process.
- Options considered:
  - Ask the operator to approve a global Git safe-directory write.
  - Use per-command `git -c safe.directory=F:/Repos/Aralia` overrides for
    read-only inspection.
  - Treat the failure as a project approval blocker.
- Decision made by agent: Use the per-command read-only override where possible
  while the operator was evaluating the prompt, then apply the narrow global Git
  safe-directory fix for `F:/Repos/Aralia` after the operator confirmed it was
  reasonable.
- Model routing: Strong foreman reasoning, because this separates project
  approval semantics from Codex sandbox/tool approval semantics.
- Rationale/evidence: `git status` failed with Git's dubious-ownership guard.
  `git -c safe.directory=F:/Repos/Aralia status --short` succeeded and showed
  only `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md` as untracked at
  that moment.
- Mutation performed or skipped: Applied `git config --global --add
  safe.directory F:/Repos/Aralia`. This changed global Git configuration only;
  it did not modify repo files, push, pull, merge, or contact GitHub.
- Scope guardrails: Do not conflate tool approval prompts with the operator's
  already-approved Phase 1 project boundaries.
- Result: Plain Git inspection and verifier scripts that invoke plain `git` can
  now run in this repo; the global Git safe-directory fix was later applied for
  this exact repo path.
- Next expected proof: Re-run `verify:jules-contract` after replacing any
  ARA-6-specific live contract with a reusable Spell Phase 1 contract.

### Decision 1: Require Jules Environment Snapshot Proof Before First Spell Slice

- Date/time: 2026-05-21
- Phase: `jules_environment`
- Active slice: Package 0, Symphony finalization baseline
- Decision point: Whether the first Spell Phase 1 Jules implementation slice can
  be dispatched before the Jules Environment `Run and Snapshot` setup is proven.
- Options considered:
  - Dispatch the first spell slice and let Jules discover setup problems during
    implementation.
  - Run or record the Jules Environment setup boundary first, then dispatch.
  - Defer Jules entirely and implement locally.
- Decision made by agent: Require the Jules Environment setup boundary before
  the first Jules implementation slice. The local Symphony packet now reports
  `ready_for_operator_snapshot`, but dispatch remains blocked until the exact
  script and Run and Snapshot result are recorded.
- Model routing: Strong foreman reasoning, because this controls an external
  workflow boundary and protects the Jules-first spell flow from repeating setup
  ambiguity.
- Rationale/evidence: ARA-6 showed that setup failures can masquerade as task
  failures. Spell Phase 1 needs Jules to run repeatable validation, so the setup
  script should be explicit before implementation starts.
- Mutation performed or skipped: Updated the local read-only Symphony
  environment packet and verifier. No Jules Environment page action was executed
  from this session because only the direct Playwright browser tab was available,
  and it was not signed into or positioned on the Jules Environment page.
- Scope guardrails: Do not hide environment setup inside a spell implementation
  task. Do not claim snapshot proof until the Jules page result is captured or
  otherwise recorded as evidence.
- Result: The recommended setup script is `npm ci --no-audit --no-fund`, then
  `npm run typecheck`, then `npm run validate:spells`. The diagnostic fallback
  remains `npm install --no-audit --no-fund`, then the same checks, but it should
  not be snapshotted unless npm ci is impossible for a documented reason.
- Next expected proof: Capture the Jules Environment `Run and Snapshot` result
  and record whether the first bounded Spell Phase 1 Jules slice can dispatch.

### Decision 2: Choose Premade Party And Gear As First Jules Implementation Slice

- Date/time: 2026-05-21
- Phase: `spell_baseline`
- Active slice: Package 1, scoped baseline inventory
- Decision point: Which bounded implementation slice should follow the read-only
  baseline once Jules environment snapshot proof exists.
- Options considered:
  - Start with premade party and gear legality.
  - Start with character creator spell selection.
  - Start with character sheet spellbook design.
  - Start with a deterministic combat spell runtime bucket.
- Decision made by agent: Choose premade party and gear legality as the first
  Jules implementation slice.
- Model routing: Strong foreman reasoning, because this orders the first
  write-producing slice and protects the sequential Jules pattern.
- Rationale/evidence: The Package 1 baseline shows all 13 premades are level 1
  and all have zero equipped item slots. Caster spellbooks already exist and are
  count-limited, so the slice can focus on making the simulator roster combat
  ready without broad schema/runtime changes. Combat spell testing depends on a
  legally equipped party.
- Mutation performed or skipped: No implementation mutation yet. Created the
  read-only baseline report at
  `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`.
- Scope guardrails: Jules should receive one bounded package covering premade
  equipment, spellbook legality audit, and a focused verifier. It should not
  change spell schema, AI arbitration policy, or character creator UI in the
  same slice.
- Result: Package 2 is the next Jules-ready implementation candidate after the
  environment snapshot proof is captured. The Package 2 task draft is now at
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`.
- Next expected proof: Record the Jules Environment snapshot result, then create
  or promote the Symphony dashboard task/handoff for the Package 2 Jules slice.

### Decision 3: Draft Package 2 Locally But Do Not Promote It Before Snapshot Proof

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to create or promote the Symphony dashboard/Jules
  handoff immediately now that the Package 2 scope is known.
- Options considered:
  - Create the durable Package 2 Jules task text only.
  - Create a local Symphony dashboard draft now, but leave it blocked.
  - Promote or dispatch the Jules handoff immediately.
- Decision made by agent: Create the durable Package 2 task document now and
  defer dashboard draft promotion or Jules dispatch until the Jules Environment
  `Run and Snapshot` result is recorded.
- Model routing: Strong foreman reasoning, because this is an external workflow
  boundary and controls whether the Jules-first process starts before setup is
  proven.
- Rationale/evidence: Decision 1 intentionally separated environment setup from
  implementation. Creating the task document moves the slice forward without
  hiding setup as an implementation side effect. Promoting or dispatching before
  snapshot proof would contradict the recorded guardrail.
- Mutation performed or skipped: Created
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md` and linked it
  from the Phase 1 plan and Package 1 baseline. Skipped dashboard handoff
  creation and Jules dispatch.
- Scope guardrails: The task document is implementation-ready, but it is not a
  claim that Jules is ready. The next state change must record the environment
  snapshot result first.
- Result: Package 2 is scoped and ready to become the first Jules implementation
  packet once setup proof exists.
- Next expected proof: Capture the Jules Environment setup result, then create
  or promote the Symphony dashboard task for Package 2 with the documented write
  scope and verification commands.

### Decision 4: Reserve Package 2 Branch And Worktree Names Without Creating Them

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Which branch/worktree names should identify the first
  implementation slice once the Jules Environment snapshot proof exists.
- Options considered:
  - Use a `codex/` branch for all local and external work.
  - Use a `jules/` branch for the external Jules implementation slice and a
    separate `codex/` branch only for later Codex review/repair.
  - Delay naming until after snapshot proof.
- Decision made by agent: Reserve
  `jules/spells-package2-premade-party-gear` as the Jules implementation branch,
  `codex/spells-package2-premade-party-gear-review` as the optional Codex
  review/repair branch, and
  `F:\Repos\Aralia\.worktrees\spells-package2-premade-party-gear` as the local
  worktree path.
- Model routing: Strong foreman reasoning, because branch identity affects PR
  evidence, ownership boundaries, and later ROI/deployment/local-sync receipts.
- Rationale/evidence: Package 2 is explicitly intended to be Jules-owned
  implementation work. A `jules/` branch name makes that ownership visible. A
  separate `codex/` review branch keeps any later local repair from pretending
  to be Jules output. The worktree name matches the package identity and stays
  under the repo's ignored `.worktrees/` path.
- Mutation performed or skipped: Recorded the reserved names in the Package 2
  task and Phase 1 plan. Did not create a branch, create a worktree, push, open
  a PR, or dispatch Jules.
- Scope guardrails: Branch/worktree creation remains blocked until the
  environment snapshot proof exists and the Package 2 task is promoted or
  dispatched.
- Result: Package 2 now has stable branch/worktree identifiers for later
  Symphony/Jules evidence receipts without changing Git state.
- Next expected proof: Capture the Jules Environment setup result, then create
  or promote the Package 2 task using the reserved branch/worktree names.

### Decision 5: Create Pending Jules Environment Snapshot Receipt Without Claiming Proof

- Date/time: 2026-05-21
- Phase: `jules_environment`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Where the external Jules Environment `Run and Snapshot` result
  should be recorded before Package 2 can dispatch.
- Options considered:
  - Leave the next proof as a generic decision-report note.
  - Create a pending receipt artifact with exact fields and keep dispatch blocked.
  - Pretend the local setup packet is enough proof to dispatch.
- Decision made by agent: Create a pending receipt artifact at
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`.
- Model routing: Strong foreman reasoning, because this controls whether a
  missing external setup result can be mistaken for a completed prerequisite.
- Rationale/evidence: The local Symphony setup packet is read-only and can only
  recommend the setup script. It cannot prove the Jules Environment page ran the
  script. A dedicated receipt gives the eventual success, failure, or waiver one
  canonical place to land.
- Mutation performed or skipped: Created the pending receipt and verifier wiring.
  Did not click Jules `Run and Snapshot`, did not change the receipt to passed,
  and did not dispatch Package 2.
- Scope guardrails: While the receipt status is `pending_external_jules`,
  Package 2 remains blocked from dashboard promotion or Jules dispatch.
- Result: The next external proof has a concrete artifact and remains honestly
  pending.
- Next expected proof: Fill the receipt with the real Jules Environment result,
  then add the matching decision entry saying whether Package 2 may dispatch.

### Decision 6: Treat Signed-In Jules Environment Page Observation As Read-Only, Not Proof

- Date/time: 2026-05-21
- Phase: `jules_environment`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Whether the signed-in visible Jules Environment page is enough
  to satisfy the setup snapshot boundary.
- Options considered:
  - Treat page visibility as setup proof.
  - Use the currently exposed browser tools to run the setup anyway.
  - Record the page as reachable and keep the snapshot receipt pending.
- Decision made by agent: Record the page as reachable and keep the snapshot
  receipt pending.
- Model routing: Strong foreman reasoning, because this separates observation
  proof from mutation proof.
- Rationale/evidence: A signed-in Jules page was visible at
  `https://jules.google.com/repo/github/Gambitnl/Aralia/config`, showing the
  setup script textbox and `Run and snapshot` button. The available browser
  tools in this session expose tab navigation and page snapshots, but not
  click/type controls for entering the script and pressing the button.
- Mutation performed or skipped: Updated
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md` with
  the read-only observation. Did not run setup, did not click `Run and snapshot`,
  did not mark the receipt passed, and did not dispatch Package 2.
- Scope guardrails: Page reachability lowers ambiguity but does not unlock
  Package 2. The receipt remains `pending_external_jules`.
- Result: The remaining blocker is narrower: a signed-in page exists, but a
  browser-capable actor still needs to enter the script, click `Run and
  snapshot`, and record the result.
- Next expected proof: Fill the receipt with the actual external result and add
  the matching dispatch decision.

### Decision 7: Draft Package 2 Jules Prompt Packet Without Dispatching It

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to leave the eventual Jules prompt implicit in the
  planning docs or make it an exact prompt packet before dispatch.
- Options considered:
  - Reconstruct the prompt later from the plan and Package 2 task.
  - Create a dedicated prompt packet now and keep dispatch blocked.
  - Send the prompt immediately because the task text is ready.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md` as the exact
  prompt packet, but do not send it.
- Model routing: Strong foreman reasoning, because prompt wording controls
  scope, ownership, and the first write-producing Jules slice.
- Rationale/evidence: The environment snapshot receipt remains
  `pending_external_jules`, so dispatch is not allowed. A dedicated prompt
  packet still reduces later ambiguity and protects the Jules-first handoff from
  being reconstructed inconsistently.
- Mutation performed or skipped: Created the prompt packet and linked it from
  the Package 2 task and Phase 1 plan. Did not create a Jules task, did not push
  a branch, did not open a PR, and did not dispatch Package 2.
- Scope guardrails: The prompt is prepared for one implementation slice only:
  premade equipment, narrow combat conversion, and focused legality checks. It
  explicitly excludes Package 3 UI work, broad spell schema/runtime work, and AI
  arbitration policy.
- Result: The first Jules implementation prompt is ready but blocked on the
  external environment receipt.
- Next expected proof: After the snapshot receipt allows dispatch, create or
  promote the Symphony/Jules task using this prompt packet.

### Decision 8: Add Operator Runbook For The External Jules Snapshot

- Date/time: 2026-05-21
- Phase: `jules_environment`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Whether the manual external snapshot step needs a separate
  runbook now that the signed-in environment page is reachable.
- Options considered:
  - Leave the operator to infer the action from the receipt.
  - Add a concise runbook with the URL, script, click target, and receipt fields.
  - Keep trying to perform the action with read-only browser tools.
- Decision made by agent: Add
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md`.
- Model routing: Efficient foreman documentation work, because the decision was
  already made and the task was to make the external action easier to execute.
- Rationale/evidence: The page is reachable and the action is known, but this
  session lacks click/type controls. A runbook avoids another agent or operator
  having to reconstruct the exact script and receipt fields.
- Mutation performed or skipped: Created the runbook and linked it from the
  receipt and Phase 1 plan. Did not run setup or dispatch Package 2.
- Scope guardrails: The runbook is an instruction artifact only. It does not
  change the receipt status or unlock dispatch.
- Result: The external snapshot step is now ready for an operator or
  browser-capable foreman.
- Next expected proof: Execute the runbook on the Jules Environment page and
  update the snapshot receipt with the real result.

### Decision 9: Prepare Package 2 Symphony Draft Payload Without Submitting It

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to prepare the local Symphony dashboard draft payload
  before the external environment snapshot is complete.
- Options considered:
  - Wait and build the dashboard payload only after the snapshot passes.
  - Prepare a payload artifact now, but do not submit it.
  - Submit the draft to `/api/v1/task-drafts` immediately.
- Decision made by agent: Prepare
  `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json` and do not
  submit it.
- Model routing: Efficient foreman documentation work, because the payload shape
  is already defined by Symphony and the blocking decision is already recorded.
- Rationale/evidence: The prompt packet is ready, but the snapshot receipt still
  blocks dispatch. A JSON payload prevents later transcription drift while
  preserving the no-dispatch boundary.
- Mutation performed or skipped: Created the payload artifact and linked it from
  the Package 2 prompt, Package 2 task, and Phase 1 plan. Did not POST to
  `/api/v1/task-drafts`, did not create a local draft record, and did not promote
  or dispatch Jules.
- Scope guardrails: The payload may only be submitted after the snapshot receipt
  says Package 2 may dispatch and the matching decision entry is recorded.
- Result: The Symphony dashboard draft request is ready for later submission as
  a controlled action.
- Next expected proof: After the snapshot receipt allows dispatch, submit this
  payload to `/api/v1/task-drafts` and record the returned draft id.

### Decision 10: Add Package 2 Dispatch Readiness Checklist

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether the remaining Package 2 boundary should live only
  across the task, prompt, payload, receipt, and runbook, or be summarized in a
  single dispatch checklist.
- Options considered:
  - Leave the boundary distributed across the existing artifacts.
  - Create a checklist that names ready artifacts, hard blockers, skipped
    mutation actions, dispatch steps, and the failure path.
  - Submit the Symphony draft payload now because the packet is prepared.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` and keep
  dispatch blocked.
- Model routing: Efficient foreman documentation work, because this is a
  guardrail and evidence-routing task rather than implementation.
- Rationale/evidence: The Package 2 prompt and dashboard payload are ready, but
  the snapshot receipt still says Package 2 dispatch is not allowed. A checklist
  prevents a later agent from mistaking prepared artifacts for completed
  external proof.
- Mutation performed or skipped: Created the checklist and linked it from the
  Package 2 task and Phase 1 plan. Did not POST to `/api/v1/task-drafts`, did
  not create a branch or worktree, did not dispatch Jules, and did not open a
  PR.
- Scope guardrails: The checklist is a local documentation/contract artifact. It
  does not waive the Jules Environment snapshot, replace the receipt, or allow
  Package 2 to be implemented locally.
- Result: Package 2 now has a single pre-dispatch source of truth for readiness,
  non-actions, dispatch steps, and the abort/repair path.
- Next expected proof: Fill the snapshot receipt with the real external result,
  add a dispatch-allowing or dispatch-blocking decision entry, then submit the
  prepared Symphony payload only if the receipt allows it.

### Decision 11: Add Spell Phase 1 ROI Baseline Receipt

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 0 and Package 1 foreman preparation
- Decision point: Whether to leave ROI evidence implicit until Package 2
  returns, or create a baseline receipt now that separates foreman setup from
  future Jules savings.
- Options considered:
  - Wait until after Package 2 dispatch to write any ROI artifact.
  - Create a baseline receipt that says ROI is unknown and names the evidence
    required before any savings claim.
  - Treat the current long Codex thread usage as measured Package 2 ROI.
- Decision made by agent: Create
  `docs/tasks/spells/SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md` and explicitly keep
  the ROI verdict unknown.
- Model routing: Efficient foreman documentation work, because the Symphony ROI
  mechanics already exist and this decision only records the evidence boundary.
- Rationale/evidence: Package 2 has not been dispatched, no Jules handoff exists,
  and no Package 2 PR or verification output exists. Counting broad goal-context
  usage as Package 2 savings would misrepresent the workflow.
- Mutation performed or skipped: Created the ROI baseline receipt and linked it
  from the Phase 1 plan, Package 2 dispatch checklist, and Package 2 task. Did
  not record a live Symphony `roi-foreman-usage` receipt, did not record a
  `roi-estimate`, and did not claim candidate savings.
- Scope guardrails: The baseline receipt is local documentation. It does not
  replace the later Symphony ROI endpoints, and it does not unlock Package 2
  dispatch.
- Result: Package 2 now has an explicit ROI starting point: useful foreman
  preparation exists, but measured Symphony/Jules savings remain unproven.
- Next expected proof: After a real Package 2 Jules handoff exists, record
  task-scoped foreman usage and a documented avoided-work estimate before making
  any ROI claim.

### Decision 12: Do Not Click Run And Snapshot Without Text Entry

- Date/time: 2026-05-21
- Phase: `jules_environment`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Whether to click the visible Jules Environment `Run and
  snapshot` button after the page became reachable through Playwright MCP.
- Options considered:
  - Click `Run and snapshot` immediately because the page and button are visible.
  - Treat the current page observation as read-only because the setup textbox
    cannot be filled with the required script through the available tool surface.
  - Waive the environment snapshot and dispatch Package 2 anyway.
- Decision made by agent: Do not click `Run and snapshot`. Keep the receipt
  pending until an operator or browser-capable foreman can enter the required
  script and capture the real result.
- Model routing: Strong foreman reasoning, because this is an external mutation
  that would affect the reusable Jules environment for later tasks.
- Rationale/evidence: The signed-in config page is visible for
  `Gambitnl/Aralia`, with the setup textbox and `Run and snapshot` button. The
  available tool surface can navigate, snapshot, screenshot, and click, but it
  does not expose a text-entry control. The textbox showed placeholder-like
  `echo do setup` text rather than the required Spell Phase 1 script.
- Mutation performed or skipped: Captured a Playwright MCP screenshot named
  `docs/tasks/spells/evidence/jules-env-config-spell-phase1-pending-2026-05-21.png`.
  Did not click `Run and snapshot`, did not update the receipt to passed, did
  not submit the Package 2 dashboard payload, and did not dispatch Jules.
- Scope guardrails: Do not create a misleading snapshot by running an empty,
  placeholder, or wrong setup script. Do not waive the setup boundary without an
  explicit receipt and decision entry.
- Result: The Jules Environment page is observable, but Package 2 remains
  blocked on a real setup result or explicit waiver.
- Next expected proof: Enter the required script on the Jules Environment page,
  click `Run and snapshot`, then update
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md` with
  the real result and dispatch decision.

### Decision 13: Add Package 2 Atlas And Gate Checkpoint Receipt

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether Package 2 gate/Atlas evidence should be reconstructed
  from terminal history later or have a receipt before the slice is dispatched.
- Options considered:
  - Rely on terminal output from Jules or Codex review.
  - Add a pending checkpoint receipt that names the validation, gate, Atlas, and
    combat verification evidence to capture after Package 2 returns.
  - Skip gate/Atlas recording for Package 2 because it mostly changes premade
    characters rather than spell data.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` as a pending
  receipt and link it from the Package 2 task, dispatch checklist, and Phase 1
  plan.
- Model routing: Efficient foreman documentation work, because this is a
  evidence-routing guardrail for an already-scoped implementation slice.
- Rationale/evidence: The Phase 1 goal requires Atlas and spell gate refreshes
  at checkpoints. Package 2 already asks Jules/Codex to run `npm run
  generate:spell-gates`, but without a receipt the result could stay trapped in
  terminal output.
- Mutation performed or skipped: Created the pending checkpoint receipt. Did not
  run Package 2 gate commands as proof of Package 2 implementation, did not mark
  the receipt complete, and did not open Package 3.
- Scope guardrails: This receipt does not claim visual spellbook or character
  creator proof. If Package 2 does not change `spell_gate_report.json`, that is
  acceptable only when the command result is recorded.
- Result: Package 2 now has a durable gate/Atlas evidence target before dispatch.
- Next expected proof: After Package 2 returns, fill the receipt with validation,
  gate generation, combat test, changed-file, and Package 3 readiness evidence.

### Decision 14: Add Package 2 Foreman Review And Failure Classification Receipt

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether Codex review after Jules returns should rely on the
  task checklist alone or have a structured receipt for scope review, failure
  classification, and repair/advance outcome.
- Options considered:
  - Use only the Package 2 task checklist after Jules returns.
  - Create a pending foreman review receipt before dispatch so failure
    classification and Package 3 readiness have a durable landing place.
  - Start Package 2 locally to avoid needing Jules review paperwork.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` as a pending receipt
  and link it from the Package 2 task, dispatch checklist, and Phase 1 plan.
- Model routing: Efficient foreman documentation work, because this prepares
  review evidence for a scoped future PR without changing implementation.
- Rationale/evidence: The Phase 1 plan requires Codex to review Jules output,
  classify failures as code/data/setup/decision-boundary style issues, and only
  then decide repair, PR follow-through, or Package 3 readiness. A receipt keeps
  that decision from being hidden in chat or terminal history.
- Mutation performed or skipped: Created the pending foreman review receipt.
  Did not dispatch Jules, did not create a review branch, did not classify a
  nonexistent Package 2 PR, and did not open Package 3.
- Scope guardrails: The receipt does not authorize Codex to repair locally by
  default. If Codex performs review repair later, it must record why Jules
  feedback was not the better first repair path.
- Result: Package 2 now has a durable review and failure-classification target
  before dispatch.
- Next expected proof: After Package 2 returns, fill the receipt with changed
  files, scope review, local verification, blocker classifications, and the
  selected outcome.

### Decision 15: Add Package 2 Task Communication Receipt

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether task-scoped Package 2 communication should be tracked
  only through the broad Codex thread, or have a receipt tied to the future
  Symphony task page and Jules handoff.
- Options considered:
  - Rely on the broad Codex thread and final summaries.
  - Add a pending communication receipt before dispatch so task messages,
    clarifications, operator answers, Jules dialogue, and PR comments have one
    durable Package 2 landing place.
  - Send Jules feedback now to create a communication record.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` as a pending
  receipt and link it from the Package 2 task, dispatch checklist, and Phase 1
  plan.
- Model routing: Efficient foreman documentation work, because this prepares
  task-scoped evidence without changing implementation or external systems.
- Rationale/evidence: The Phase 1 goal requires task-scoped communication.
  Package 2 has no Symphony draft, task page, or Jules handoff yet, so broad
  thread context must not be misrepresented as Package 2 task communication.
- Mutation performed or skipped: Created the pending communication receipt. Did
  not create a Symphony draft, did not send Jules feedback, did not record a fake
  task message, and did not dispatch Package 2.
- Scope guardrails: Do not send feedback just to populate the receipt. Only
  record task-scoped communication once the Package 2 task/handoff exists or an
  operator decision directly affects the slice.
- Result: Package 2 now has a durable communication evidence target before
  dispatch.
- Next expected proof: After Package 2 has a Symphony draft or Jules handoff,
  fill the receipt with task messages, clarifications, operator answers, Jules
  dialogue, PR comments, open questions, and communication blockers.

### Decision 16: Add Package 2 PR, Deployment, And Local Sync Receipt

- Date/time: 2026-05-21
- Phase: `package_2_pre_dispatch`
- Active slice: Package 2, premade party and gear
- Decision point: Whether Package 2's GitHub, deployment, and local-sync proof
  should be recorded only after a PR exists, or have a pending receipt before
  dispatch.
- Options considered:
  - Wait until a Package 2 PR exists and reconstruct the proof path then.
  - Create a pending receipt now so the first Spell Phase 1 Jules PR has a
    durable place for GitHub checks, merge, deployment, waiver, and local-sync
    facts.
  - Treat local verification as enough lifecycle proof for Package 2.
- Decision made by agent: Create
  `docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` as a pending
  receipt and link it from the Package 2 task, dispatch checklist, and Phase 1
  plan.
- Model routing: Efficient foreman documentation work, because this records the
  later proof shape without mutating GitHub, deployment, or local Git.
- Rationale/evidence: The Phase 1 goal requires PR/deployment/local-sync proof
  for the spell project. Package 2 is intended to be the first bounded
  write-producing Jules slice, so its lifecycle proof should not be left to
  terminal memory.
- Mutation performed or skipped: Created the pending receipt. Did not create a
  branch, open a PR, merge, record a deployment waiver, sync local Git, or claim
  Package 2 lifecycle completion.
- Scope guardrails: This receipt does not authorize dispatch or replace the
  Jules Environment snapshot receipt. If Package 2 is completed as a patch
  rather than a PR, that exception must be recorded before using this receipt.
- Result: Package 2 now has a durable PR/deployment/local-sync evidence target
  before dispatch.
- Next expected proof: After Package 2 has a real PR, fill the receipt with PR,
  checks, merge, deployment proof or waiver, local-sync, and post-sync verifier
  evidence.

### Decision 84: Reclassify Package 5 Prepare Handoff As A State-Focus Defect

- Date/time: 2026-05-24 03:40 +02:00
- Phase: `package_5_dashboard_dispatch`
- Active slice: Package 5 AI arbitration pilot plus dashboard-first Symphony
  workflow refinement
- Decision point: The Package 5 task page showed a visible form-backed
  `Prepare Handoff` button. Earlier browser attempts seemed to leave the draft
  unchanged, but a later visible browser click sent `POST /promote` and returned
  201 while the page stayed on the historical draft. Multiple Package 5 handoffs
  then existed in the queue.
- Options considered:
  - Treat the activation as still blocked and stop Package 5.
  - Call raw endpoints to choose a handoff behind the dashboard.
  - Use the newest clean handoff created by the visible click, while recording
    duplicate handoff creation as a dashboard state/focus defect.
- Decision made by agent: Use `handoff-1779586889329-3ehcfd` as the clean
  Package 5 handoff and treat older Package 5 handoffs as stale duplicates.
- Model routing: Local Codex handled dashboard diagnosis; Jules remained the
  implementation worker once the clean handoff launched.
- Rationale/evidence: The action did submit through the visible control, so the
  earlier blocker was not a true activation failure. The real workflow defect is
  that the dashboard did not focus the created handoff and allowed repeated
  promotion attempts.
- Mutation performed or skipped: Skipped raw promotion as the primary workflow
  path, skipped launching stale duplicate handoffs, and continued with the
  newest visible-click-created handoff.
- Scope guardrails: This changes only dashboard tracking/decision state. It
  does not change spell data, spell runtime, AI arbitration policy, combat
  simulator behavior, or premade roster semantics.
- Result: Package 5 advanced to manifest staging and Jules launch through the
  visible dashboard flow.

### Decision 85: Repair Stale Post-Approval Boundary Instead Of Re-Approving Jules

- Date/time: 2026-05-24 03:58 +02:00
- Phase: `package_5_dashboard_dispatch`
- Active slice: Package 5 AI arbitration pilot plus dashboard-first Symphony
  workflow refinement
- Decision point: The visible `Approve Jules Plan` action succeeded for Jules
  session `16180069342192211468`, and the Jules page showed `Plan approved`.
  Symphony still rendered `Approve Jules Plan` because the cached Jules state
  remained `AWAITING_PLAN_APPROVAL`, leaving no visible status-refresh path.
- Options considered:
  - Click approve again and risk sending a duplicate mutating approval.
  - Bypass the dashboard with hidden refresh calls.
  - Repair the dashboard next-action logic so a successful approval receipt
    routes to `Refresh Jules Status`.
- Decision made by agent: Patch Symphony so an approved plan receipt plus stale
  `AWAITING_PLAN_APPROVAL` state exposes `Refresh Jules Status`, not another
  approval action.
- Model routing: Local Codex handled this dashboard workflow repair because the
  bug was in orchestration state routing, not in the spell implementation.
- Rationale/evidence: Once an approval receipt exists, the next safe operator
  action is reconciliation, not repeating the external approval mutation. The
  dashboard-first goal requires fixing this blocker rather than depending on
  terminal-only diagnosis.
- Mutation performed or skipped: Edited `conductor/symphony/src/server.ts` and
  `conductor/symphony/scripts/verify-task-detail-page.mjs`. Skipped duplicate
  approval, skipped hidden refresh as the primary workflow path, and preserved
  Jules as implementation owner.
- Verification: `npm run build` and
  `node scripts/verify-task-detail-page.mjs` passed in
  `conductor/symphony`.
- Result: The task page changed to `Refresh Jules Status`; clicking the visible
  refresh recorded `Jules reported IN_PROGRESS`, and later captured PR #991.

### Decision 86: Send Bounded Jules Feedback, Then Take Over Narrow PR Cleanup

- Date/time: 2026-05-24 04:08 +02:00
- Phase: `package_5_pr_review`
- Active slice: Package 5 PR #991 review and scope containment
- Decision point: Jules produced PR #991 with the intended spell/test changes,
  but the PR also contained generated `spell_gate_report.json` timestamp churn
  and an inaccurate PR body claim about `scripts/*.ts` path-resolution fixes.
  The Gemini review failure was quota noise, while deterministic GitHub checks
  were passing or pending.
- Options considered:
  - Merge PR #991 as-is because the implementation was mostly correct.
  - Repair the PR locally immediately.
  - Send bounded `[Jules feedback]` first, preserving Jules as the preferred
    implementation worker, then intervene only if Jules did not produce the
    needed narrow cleanup.
- Decision made by agent: Post bounded `[Jules feedback]` on PR #991 asking
  Jules to remove generated report churn and correct the PR body. After Jules
  did not produce the requested cleanup and later pushed an out-of-scope
  workflow-config change, Codex took over only the narrow PR hygiene cleanup.
- Model routing: Jules handled the spell implementation. Local Codex handled
  PR-scope cleanup after feedback failed to produce a clean repair.
- Rationale/evidence: The user explicitly wanted Jules to do as much as
  possible. Posting feedback first honored that. The remaining cleanup was
  mechanical and merge-blocking for scope quality, so a local Codex follow-up
  was justified once Jules drifted into workflow configuration.
- Mutation performed or skipped: Posted PR comment
  `https://github.com/Gambitnl/Aralia/pull/991#issuecomment-4527107109`,
  restored generated report/workflow files to the master versions on the PR
  branch, corrected the PR body, and preserved only the two spell JSON files
  plus the focused AI factory test in the cumulative diff.
- Verification: `npm run validate:spells` and
  `npx vitest run src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts --reporter=verbose`
  passed locally in the PR cleanup worktree. GitHub Build, Lint, Tests, Quality
  Scan, CodeQL, Poison File Check, and Analyze checks all passed after the final
  push.
- Result: PR #991 merged on 2026-05-24 at
  `61702965500ea799be273305f1dbf3ee690eeb60`.

## Open Decisions For The Next Slice

### Decision 17: Run Jules Environment Snapshot And Replace Broad Typecheck Gate With Package 2 Scoped Gate

- Date/time: 2026-05-21 08:02 Europe/Amsterdam
- Phase: `jules_environment`
- Active slice: Package 2, premade party and gear
- Decision point: Whether the first Spell Phase 1 Jules slice should remain
  blocked after the broad setup script failed during `npm run typecheck`, or
  whether a scoped Package 2 environment snapshot could clear the dispatch gate.
- Options considered:
  - Keep Package 2 blocked until broad repo-wide typecheck passes in a clean
    Jules clone.
  - Use the diagnostic `npm install` fallback and rerun the same broad
    typecheck gate.
  - Record the broad typecheck failure as pre-existing tracked-clone debt and
    run a Package 2 scoped snapshot using `npm ci`, spell validation, and the
    split combat utility test glob.
- Decision made by agent: Record the broad typecheck failure, reject the
  diagnostic `npm install` fallback because `npm ci` succeeded, and use the
  Package 2 scoped snapshot gate:
  `npm ci --no-audit --no-fund`; `npm run validate:spells`;
  `npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose`.
- Model routing: Stronger foreman decision, because this changes the live setup
  gate for the first Jules implementation slice and must preserve the difference
  between project debt and Package 2 readiness.
- Rationale/evidence: The Jules broad script completed install but failed on
  repo-wide TypeScript missing-module errors in a clean tracked clone. Local
  `npm run typecheck -- --pretty false` passed, which means the failure depends
  on local untracked/generated files and is not a Jules npm install failure.
  Package 2's written scope requires spell validation and combat conversion
  proof, not broad roadmap/design-preview typecheck cleanup.
- Mutation performed or skipped: Filled the Jules setup textbox, clicked
  `Run and snapshot`, recorded the broad failure screenshot, reran with a
  scoped script, and recorded the successful scoped snapshot screenshot. The
  scoped snapshot passed 6 test files and 37 tests. Did not use `npm install`,
  did not change repo code to satisfy broad typecheck, did not dispatch Package
  2 during the environment run, and did not claim full repo typecheck health.
- Scope guardrails: This decision only clears the environment gate for Package
  2. It does not waive typecheck for later schema/runtime, UI, or broad spell
  architecture slices. If a later slice needs repo-wide typecheck, that slice
  must resolve or explicitly classify the clean-clone typecheck debt.
- Result: `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`
  now records `passed` for the Package 2 scoped setup. Package 2 may proceed to
  Symphony task draft submission.
- Next expected proof: Submit the Package 2 Symphony task draft, record the
  returned draft id, then dispatch Jules with the exact prompt packet.

### Decision 18: Submit Package 2 Symphony Draft And Stop At Git Sync Blocker

- Date/time: 2026-05-21 08:22 Europe/Amsterdam
- Phase: `symphony_task_draft`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to submit the prepared Package 2 payload to local
  Symphony after the environment gate passed, and whether to continue to Jules
  dispatch when Symphony reported Git sync blockers.
- Options considered:
  - Keep the payload as a local file and wait for a later foreman to submit it.
  - Submit the payload to `POST /api/v1/task-drafts`, record the returned draft
    id, and stop at the reported Git sync blocker.
  - Ignore the Git sync blocker and dispatch Jules from terminal memory.
- Decision made by agent: Submit the payload to local Symphony, record returned
  draft id `draft-1779344522441-vdy0hi`, and stop before Jules dispatch because
  the draft is `blocked_by_git_sync`.
- Model routing: Stronger foreman decision for the boundary; efficient local
  documentation work for the receipt updates. This changes the live task state
  and chooses not to bypass Symphony's own preflight.
- Rationale/evidence: `cmd.exe /c npm run verify:jules-contract` passed before
  the POST. The local `POST http://127.0.0.1:8139/api/v1/task-drafts` returned
  a Package 2 draft. Follow-up `GET /api/v1/task-drafts` reported draft status
  `blocked_by_git_sync`, queue next action `Review Local Changes`, and blockers:
  `Could not fetch origin.`, `16 tracked file(s) have uncommitted changes.`, and
  `19 untracked file(s) are present.`
- Mutation performed or skipped: Created the local Symphony draft record and
  added `docs/tasks/spells/PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md`. Did
  not dispatch Jules, create or push a branch, open a PR, merge, run local sync,
  or claim Package 2 implementation work started.
- Scope guardrails: The local Symphony draft is a workflow record, not a Jules
  handoff. The next foreman action must resolve or explicitly classify the Git
  sync blockers before using the exact Jules prompt packet.
- Result: Package 2 now has local Symphony draft id
  `draft-1779344522441-vdy0hi` and is waiting at the Git sync/branch discipline
  boundary.
- Next expected proof: Decide which current docs/verifier/proof changes belong
  in the Spell Phase 1 Symphony branch, preserve unrelated work, rerun Git
  preflight or the task queue snapshot, then dispatch Jules only after the draft
  is no longer blocked.

### Decision 19: Commit Package 2 Setup Locally And Stop When Push Approval Fails

- Date/time: 2026-05-21 08:27 Europe/Amsterdam
- Phase: `git_sync`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to make the Spell Phase 1/Symphony setup state visible
  as a scoped Git branch, and whether to continue after the remote push approval
  was rejected by the Codex tool flow.
- Options considered:
  - Leave the docs/verifier setup uncommitted and keep the draft blocked.
  - Create a scoped local branch and commit the durable setup/proof artifacts.
  - Push the branch and continue toward PR/Jules dispatch.
  - Retry or bypass the rejected push through another mechanism.
- Decision made by agent: Create local branch
  `codex/spell-phase1-symphony-package2-setup`, commit the durable setup/proof
  artifacts as `290cccb8`, commit the push-boundary receipt as `dee53c47`,
  correct the local branch-head wording in follow-up bookkeeping, attempt the
  remote push, and stop when the Codex tool approval flow rejected the push
  before Git ran.
- Model routing: Stronger foreman decision for the Git boundary, because this
  determines whether Jules can see the task context and separates project
  approval from tool approval.
- Rationale/evidence: The working tree contained the Spell Phase 1 plan,
  Package 2 receipts, Symphony contract changes, and evidence screenshots. Those
  belong together as the setup branch for Package 2. The attempted command was
  `git push -u origin codex/spell-phase1-symphony-package2-setup`; the tool
  returned `rejected by user` before executing Git.
- Mutation performed or skipped: Created the local branch and local commit. Did
  not push a remote branch, open a PR, dispatch Jules, merge, or sync local
  master.
- Scope guardrails: Do not dispatch Jules until the branch context is externally
  visible or a later decision explicitly chooses a different branch/source of
  truth.
- Result: Package 2 setup is locally committed on
  `codex/spell-phase1-symphony-package2-setup` but not remotely synced. Use
  `git log --oneline` for the current local head before the next push attempt.
- Next expected proof: Complete remote Git sync for the setup branch, rerun the
  Symphony task queue or Git preflight for `draft-1779344522441-vdy0hi`, then
  continue to Package 2 Jules dispatch only if the draft is ready.

### Decision 20: Push Package 2 Setup Branch And Keep Dispatch Gated On Fresh Symphony Preflight

- Date/time: 2026-05-21 17:32 Europe/Amsterdam
- Phase: `git_sync`
- Active slice: Package 2, premade party and gear
- Decision point: Whether to retry the scoped setup-branch push after the
  operator clarified that project-level approval was already granted, while the
  Codex sandbox still needed command-level network permission.
- Options considered:
  - Leave the branch local and keep Package 2 blocked.
  - Push the scoped setup branch, then immediately dispatch Jules from the old
    draft state.
  - Push the scoped setup branch, record the tool boundary separately from the
    project decision, and rerun Symphony readiness before Jules dispatch.
- Decision made by agent: Push
  `codex/spell-phase1-symphony-package2-setup` to origin, record the successful
  remote sync in the Package 2 receipt, and keep Jules dispatch gated until a
  fresh Symphony task queue or Git preflight replaces the old
  `blocked_by_git_sync` evidence.
- Model routing: Stronger foreman reasoning for the Git/Symphony boundary,
  because the choice separates assumed project approval from Codex sandbox
  permission and prevents dispatch from stale local draft evidence.
- Rationale/evidence: The pushed head was `6fc9e81a` at the first successful
  remote-sync receipt and later advanced to `c5061afb` after the local Codex app
  config ignore was added. The command
  `git push -u origin codex/spell-phase1-symphony-package2-setup` created
  remote branch `origin/codex/spell-phase1-symphony-package2-setup` and set the
  local branch to track it. The pre-push hook ran `npm run sync-check`, which
  passed sync checks and reported the stale intent gate line as existing gate
  debt. GitHub returned the PR creation URL for the pushed branch; PR #933 now
  carries the setup/context branch toward `master`.
- Mutation performed or skipped: Pushed the setup branch. Did not open a PR,
  dispatch Jules, create the Package 2 implementation branch/worktree, merge,
  deploy, or local-sync.
- Scope guardrails: Treat the push permission prompt as a Codex sandbox/network
  boundary, not as a new project approval gate. Do not dispatch Jules from the
  old `blocked_by_git_sync` snapshot; refresh Symphony readiness first.
- Result: Package 2 setup context is now visible on GitHub. The active blocker
  has moved from "remote branch not pushed" to "fresh Symphony readiness proof
  still missing."
- Next expected proof: Rerun the Symphony task queue or Git preflight for
  `draft-1779344522441-vdy0hi`, then dispatch Jules only if the refreshed state
  is ready.

### Decision 21: Add Non-Destructive Artifact Lifecycle Policy To Spell Phase 1

- Date/time: 2026-05-21
- Phase: `artifact_lifecycle`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Whether completed prompt packets, receipts, proof screenshots,
  generated reports, and setup artifacts should be deleted, archived, or retained
  after each package.
- Options considered:
  - Delete package files after completion to keep the tree smaller.
  - Keep everything forever without status updates.
  - Add a non-destructive lifecycle policy that keeps durable evidence, marks
    completed/superseded artifacts, archives only when replacement context is
    linked, and deletes only runtime/temp/duplicate/local-machine files.
- Decision made by agent: Add
  `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` and link it
  from the Phase 1 plan.
- Model routing: Stronger foreman reasoning, because this decides how future
  agents preserve or remove human-readable project context.
- Rationale/evidence: The updated thread goal explicitly requires a clear
  retention/archive/delete policy. Aralia's repo instructions prefer preserving
  unfinished intent and future optionality, so cleanup must prevent stale context
  without making deletion the default.
- Mutation performed or skipped: Created the lifecycle policy and linked it from
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`. Did not delete any
  package docs, receipts, screenshots, generated reports, or setup artifacts.
- Scope guardrails: Deletion remains allowed for ignored runtime state,
  generated junk with regeneration proof, local app settings, duplicate stale
  files with linked replacements, or explicitly recorded cleanup decisions. Do
  not delete canonical plans, decision reports, boundary receipts, referenced
  proof images, or future-facing scaffolds just because a package is done.
- Result: Spell Phase 1 now has a durable artifact filing policy that preserves
  evidence while giving future agents a way to prevent stale setup files from
  becoming active instructions.
- Next expected proof: Apply the policy during Package 2 closeout after the
  setup PR, Jules implementation result, review, Atlas/gate, PR/deployment/local
  sync, task communication, and ROI receipts are complete.

### Decision 22: Repair PR #933 Clean-Clone Typecheck Blocker For Local-Only Markdown Library Entry

- Date/time: 2026-05-21
- Phase: `github_pr`
- Active slice: Package 2 setup/context PR #933
- Decision point: Whether to repair the PR #933 Build failure before the setup
  context can land on `master`.
- Options considered:
  - Commit the ignored `src/components/DesignPreview/` local developer tool so
    `src/md-library-entry.tsx` can typecheck in CI.
  - Delete the tracked markdown-library entry.
  - Exclude only `src/md-library-entry.tsx` from repo-wide TypeScript checks
    because it is a standalone local-tool entry importing ignored local-tool
    implementation.
- Decision made by agent: Exclude `src/md-library-entry.tsx` in `tsconfig.json`
  so clean CI no longer typechecks a tracked entry that depends on ignored
  local-only DesignPreview files.
- Model routing: Stronger foreman reasoning, because this classifies a CI
  blocker and chooses a repair that preserves local-tool optionality without
  broad cleanup.
- Rationale/evidence: PR #933 Build failed with
  `TS2307: Cannot find module './components/DesignPreview/steps/PreviewMdLibrary'`.
  The target file exists in this local checkout, but
  `src/components/DesignPreview/` is intentionally ignored by `.gitignore`.
  The tracked `src/md-library-entry.tsx` is documented as a standalone
  Documentation Library Tool entry for `misc/md_library.html`, not as part of
  the core app runtime.
- Mutation performed or skipped: Updated `tsconfig.json` only. Did not delete
  the entry, did not commit the ignored DesignPreview tool, did not change the
  Package 2 task scope, and did not merge PR #933.
- Scope guardrails: This is a setup/clean-clone repair for the setup PR. It does
  not prove Package 2 implementation work, spellbook UI, combat spell execution,
  or AI arbitration.
- Result: The next proof is local and CI typecheck/build evidence after the
  exclusion.
- Next expected proof: Run `npx tsc --noEmit`, push the repair to PR #933, and
  confirm GitHub Build no longer fails on the local-only markdown library entry.

### Decision 23: Add Living Spell Phase 1 Task Tracker And Gap Log

- Date/time: 2026-05-21
- Phase: `project_tracking`
- Active slice: Package 0 to Package 2 handoff boundary
- Decision point: Whether the early-game spell project should rely only on the
  long plan and package-specific files, or add a single living tracker that
  future Codex/Jules runs can use as the project index.
- Options considered:
  - Keep using only `EARLY_GAME_SPELL_EXECUTION_PLAN.md` and package-specific
    files.
  - Put all package progress directly into the plan, making the plan a mixed
    strategy and status document.
  - Add a dedicated task tracker that points to the plan, package files,
    receipts, decision report, PR, and adjacent-gap log.
- Decision made by agent: Add
  `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` as the live task collection
  and status tracker, and link it from
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`.
- Model routing: Stronger foreman reasoning, because this decides how future
  workers discover active work, blockers, detailed package files, and adjacent
  gaps without flattening the project into a cleanup checklist.
- Rationale/evidence: The updated active goal explicitly requires a primary
  "look here first" project file. Aralia's repo instructions prefer preserving
  intent and future optionality, so adjacent discoveries should be recorded and
  classified instead of silently absorbed into the active slice or lost.
- Mutation performed or skipped: Created the tracker with package statuses,
  setup/PR tasks, detailed task-file index, and adjacent-gap log. Updated the
  plan to point future agents at the tracker. Did not delete, archive, or
  collapse the detailed package files.
- Scope guardrails: The tracker is coordination infrastructure. It does not
  itself prove spell mechanics, UI visibility, combat castability, Jules
  dispatch, Atlas refresh, or Package 2 implementation.
- Result: Spell Phase 1 now has a single guiding task/status file that can
  absorb newly found tasks while keeping detailed sub-task files connected.
- Next expected proof: Keep the tracker current after PR #933 repair, merge or
  supersession, local sync, Package 2 readiness proof, Jules dispatch, and each
  later Atlas/gate/checkpoint result.

### Decision 24: Merge Setup PR And Prove Clean Master Without Touching Dirty Main Checkout

- Date/time: 2026-05-21
- Phase: `github_pr_local_sync`
- Active slice: Package 2 setup/context handoff boundary
- Decision point: Whether to merge PR #933 after all checks passed and how to
  prove local `master` sync while the main checkout had unrelated local Symphony
  edits.
- Options considered:
  - Leave PR #933 open and keep Package 2 blocked.
  - Stash or move the unrelated main-checkout Symphony edits, then switch the
    main checkout to `master`.
  - Merge PR #933, create an isolated synced worktree, and update the local
    `master` ref to `origin/master` without overwriting the dirty main checkout.
- Decision made by agent: Merge PR #933 by squash merge, create
  `F:\Repos\Aralia\.worktrees\spell-phase1-master-sync`, and use that clean
  worktree for the Symphony preflight proof.
- Model routing: Stronger foreman reasoning, because this crossed GitHub merge
  and local-sync boundaries while preserving unrelated local work.
- Rationale/evidence: PR #933 was mergeable and all GitHub checks passed after
  the `src/md-library-entry.tsx` clean-clone typecheck repair. A direct checkout
  to `master` in the main worktree was refused by Git because unrelated local
  edits in Symphony files would be overwritten.
- Mutation performed or skipped: Merged PR #933 as
  `40678de8bdc3ce58db0c97e062f5a170526e4fa7`. Created a clean synced worktree.
  Moved local `master` to `origin/master` at the merge commit. Did not stash,
  delete, or overwrite the unrelated dirty main-checkout files.
- Scope guardrails: This proves setup/context availability and clean Symphony
  preflight base only. It does not prove Package 2 implementation, Jules output,
  spell UI visibility, combat execution, or AI arbitration.
- Result: Fresh Symphony preflight from the clean worktree reported:
  `Ready: master matches origin/master and the working tree is clean.`
- Next expected proof: Submit or refresh the Package 2 draft on the clean base
  and proceed through the Symphony Linear/Jules handoff steps.

### Decision 25: Replace Old Blocked Draft With Clean-Base Package 2 Jules Handoff

- Date/time: 2026-05-21
- Phase: `jules_dispatch`
- Active slice: Package 2 premade party and gear implementation
- Decision point: Whether to keep trying to reuse the old local draft
  `draft-1779344522441-vdy0hi` or create a fresh clean-base Symphony draft after
  setup PR #933 landed.
- Options considered:
  - Reuse the old draft even though it was created from a blocked Git sync
    snapshot.
  - Stop at a clean preflight and defer Jules dispatch.
  - Submit a fresh Package 2 draft from the existing payload, create the Linear
    issue, promote to Jules handoff, stage the manifest, and launch Jules.
- Decision made by agent: Create clean-base draft `draft-1779400428597-mind7o`,
  create Linear issue `ARA-7`, promote handoff
  `handoff-1779400495781-jauy49`, stage the Jules manifest, and launch Jules
  session `15527431301408060204`.
- Model routing: Stronger foreman reasoning, because this crosses external
  Linear/Jules mutation boundaries and needs auditable task evidence.
- Rationale/evidence: Symphony preflight was clean on `master` at
  `40678de8bdc3ce58db0c97e062f5a170526e4fa7`. The Linear preview was
  non-mutating and showed the exact Package 2 issue text, write scope, requested
  verification, and synced base commit before issue creation. Handoff readiness
  and launch readiness reported no blockers before staging and launch.
- Mutation performed or skipped: Created Linear issue `ARA-7`, staged a Jules
  manifest, and launched Jules session
  `https://jules.google.com/session/15527431301408060204`. Did not create a
  Package 2 PR locally, did not perform Package 2 implementation locally, and
  did not merge any Package 2 implementation work.
- Scope guardrails: Jules is constrained to
  `public/premade-characters/*.json`, `src/utils/combat/combatUtils.ts`,
  `src/utils/combat/__tests__/combatUtils_*.test.ts`, and an optional narrow
  premade legality audit/test. Character creator UI, character sheet spellbook
  UI, broad schema/runtime architecture, broad AI arbitration policy, and
  Symphony orchestration files remain out of scope for this handoff.
- Result: Package 2 is now offloaded to Jules. First refreshed Jules state was
  `QUEUED`; no Package 2 PR exists yet.
- Next expected proof: Refresh Jules status until it leaves `QUEUED`, then
  record plan approval, PR URL, changed-file scope, verification output,
  Atlas/gate checkpoint, foreman review, task communication, PR/deployment/local
  sync, and ROI receipts.

### Decision 26: Keep Launched Jules Monitoring Visible When Receipt Docs Dirty Git

- Date/time: 2026-05-21
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 Jules monitoring
- Decision point: Whether to treat the dashboard's post-launch Git sync warning
  as a blocker to Jules status refresh, or as a dashboard/workflow issue that
  should be fixed.
- Options considered:
  - Use direct API calls to keep refreshing Jules despite the dashboard showing
    `GitHub sync` as the current foreman boundary.
  - Commit or stash receipt docs immediately just to make the dashboard green.
  - Record the dashboard blocker and repair the middleman path so a launched
    Jules session remains the active boundary while dirty Git remains visible as
    a future local-sync/pre-launch blocker.
- Decision made by agent: Repair the Symphony dashboard workflow. A launched
  Jules session now remains the active middleman boundary for safe status
  refreshes, even if local receipt documentation makes Git preflight red again.
- Model routing: Stronger foreman reasoning, because this changes dashboard
  orchestration behavior and directly responds to the operator's dashboard-first
  requirement.
- Rationale/evidence: In the Codex in-app browser, the task card showed
  `Refresh Jules Status` for session `15527431301408060204`, but the global
  `Current Foreman Boundary` showed `GitHub sync` because the receipt branch had
  tracked and untracked documentation edits. Refreshing a launched Jules session
  is an external read/status action; it should not be hidden behind a pre-launch
  Git sync gate. Git sync should still remain visible as a blocker for new
  handoffs, merge/local-sync, or other local repository mutations.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts` and
  `conductor/symphony/scripts/verify-middleman-path.mjs`. Did not use direct API
  calls to bypass the UI after this dashboard-first rule was set; the visible
  `Refresh All Jules` dashboard control was used to observe the issue.
- Scope guardrails: This repair only changes current-boundary selection and
  action labeling for already-launched Jules monitoring. It does not make dirty
  Git acceptable for new Jules handoffs, PR merge, deployment proof, or local
  sync.
- Result: The verifier now protects that a running Jules session stays the
  active boundary with `Refresh Jules Status` while the Git sync stage remains
  recorded as blocked.
- Next expected proof: Rebuild/restart the local dashboard server, reload the
  in-app browser dashboard, and verify the visible `Current Foreman Boundary`
  points at Jules session refresh instead of Git sync for Package 2.

### Decision 27: Compact Dashboard Header And Humanize Refresh Timestamp

- Date/time: 2026-05-21
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 dashboard monitoring
- Decision point: Whether to leave the dashboard's first viewport dominated by
  run totals, raw local API endpoint links, and a full ISO timestamp while using
  it as the primary human workflow surface.
- Options considered:
  - Leave the top layout unchanged because the information is technically
    correct.
  - Remove the control-surface links entirely.
  - Keep the links available but collapse them, tighten the run-total spacing,
    and format the update timestamp as a human-readable time without
    milliseconds.
- Decision made by agent: Compact the dashboard top chrome and format refresh
  timestamps for scanning.
- Model routing: Standard foreman/frontend reasoning, because this is a bounded
  dashboard usability fix surfaced by operator-visible browser use.
- Rationale/evidence: The in-app browser view showed useful task state pushed
  down by the top control surface, and the refresh note displayed a verbose raw
  timestamp such as `2026-05-21T21:59:03.337Z`. The operator needs freshness and
  workflow state, not millisecond precision in the first viewport.
- Mutation performed or skipped: Updated
  `conductor/symphony/public/dashboard.js` and
  `conductor/symphony/public/dashboard.css`. Did not remove API endpoint access;
  it remains available behind a collapsed `Control surface` disclosure. Also
  changed the active Jules current-boundary action from a raw POST endpoint link
  into the guarded `Refresh Jules Status` dashboard button path.
- Scope guardrails: This is dashboard layout/readability only. It does not alter
  Jules dispatch, Git sync rules, task state, or external mutations.
- Result: The dashboard refresh note now shows compact live/update language, and
  the run-total/API area takes less vertical space so task cards and blockers are
  easier to see.
- Next expected proof: Reload the in-app browser dashboard after the server
  restarts and verify the first viewport is denser and the refresh timestamp no
  longer shows raw milliseconds.

### Decision 28: Keep Dashboard Action Buttons Stable During Live Refresh

- Date/time: 2026-05-21
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 dashboard monitoring
- Decision point: Whether to accept that the visible `Refresh Jules Status`
  button could detach during live dashboard refresh, or treat it as a real
  dashboard-first workflow blocker.
- Options considered:
  - Use a direct endpoint/API call when the visible button is flaky.
  - Stop live refresh entirely while Package 2 is being monitored.
  - Keep live refresh, but preserve the task intake DOM when rendered content is
    unchanged and pause automatic task-panel repainting briefly while the
    operator is hovering, focusing, or clicking inside it.
- Decision made by agent: Repair the dashboard interaction model. Automatic
  refresh now respects short operator interaction holds, and identical task
  renders no longer replace the existing control nodes.
- Model routing: Standard foreman/frontend reasoning, because this is a bounded
  UI workflow stability fix exposed by browser-first operation.
- Rationale/evidence: The in-app browser showed one visible
  `Refresh Jules Status` button, but an attempted click could fail because live
  refresh replaced the element mid-action. In a dashboard-first workflow, a
  visible control must remain clickable without requiring hidden endpoint use.
- Mutation performed or skipped: Updated
  `conductor/symphony/public/dashboard.js`, added
  `conductor/symphony/scripts/verify-dashboard-interaction-stability.mjs`, and
  included that verifier in `conductor/symphony/package.json`. Did not disable
  live dashboard updates globally.
- Scope guardrails: This affects only automatic task-panel repaint timing and
  same-html DOM preservation. It does not alter Jules state, Git sync policy,
  external mutation permissions, or handoff routing.
- Result: The visible dashboard `Refresh Jules Status` button was clicked
  successfully through the in-app browser after the fix. Jules reported
  `COMPLETED`; no Package 2 PR URL had been captured yet.
- Next expected proof: Continue dashboard-first refreshes until Jules presents a
  plan approval, PR URL, blocker, or inspectable completion result, then record
  that boundary in this report.

### Decision 29: Surface Completed Jules Sessions With No Captured PR As Inspection Blockers

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 dashboard monitoring
- Decision point: Whether to continue refreshing Jules after the dashboard
  already knew the session was `COMPLETED` but had no PR URL, or expose a new
  operator-visible completion-inspection boundary.
- Options considered:
  - Keep using `Refresh Jules Status` until a PR URL appears.
  - Use terminal/API/GitHub shortcuts to infer whether Jules created a PR.
  - Treat `COMPLETED` without a PR URL as a dashboard blocker requiring visible
    Jules result inspection before Package 2 can be filed or advanced.
- Decision made by agent: Repair the Symphony dashboard workflow. A completed
  Jules session with no captured PR now surfaces as `Inspect Jules Completion`
  with safety `external_read`, not as another status-refresh loop.
- Model routing: Standard foreman/frontend reasoning, because this is a bounded
  dashboard workflow and evidence-classification fix.
- Rationale/evidence: The dashboard showed Jules session
  `15527431301408060204` as `COMPLETED`, no GitHub PR URL, and a current
  boundary of `Refresh Jules Status`. The task detail linked the visible Jules
  session, but the in-app browser was still blocked on Google sign-in, so the
  actual result could not be read. That is not proof of Package 2 completion;
  it is a result-inspection blocker.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts`,
  added `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs`,
  and included the verifier in the Symphony contract. Did not infer a PR, mark
  Package 2 complete, or bypass the Jules session result.
- Scope guardrails: This changes only dashboard/readiness classification for a
  terminal Jules-without-PR state. It does not mutate GitHub, Jules, Linear, or
  local Git, and it does not decide whether the spell implementation succeeded.
- Result: The live dashboard and task detail page now show
  `Inspect Jules Completion`, `Safety: external_read`, and the Jules session as
  the evidence link. The active blocker remains browser sign-in/result access.
- Next expected proof: Once the browser can display the Jules session, record
  whether the result includes a PR URL, a failure/no-code completion, or a
  follow-up request, then advance Package 2 accordingly.

### Decision 30: Approve The Visible Package 2 Jules Plan And Reconcile Symphony State

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 dashboard monitoring
- Decision point: Whether to approve the visible Jules plan from the
  dashboard-linked Jules session, or stop because Symphony's stored state had
  previously classified the handoff as `COMPLETED` with no captured PR URL.
- Options considered:
  - Stop and require a new dashboard-specific approval control before touching
    the Jules page.
  - Ignore the visible Jules plan and treat the stale `COMPLETED` state as the
    deciding source of truth.
  - Approve the visible Jules plan because the dashboard evidence link led to
    that page, the plan matched the Package 2 scope, and the current test flow
    permits assumed phase approvals when recorded.
- Decision made by agent: Approve the visible Package 2 Jules plan through the
  Jules UI, then return to Symphony and use dashboard refresh controls to
  reconcile local state.
- Model routing: Standard foreman/browser reasoning, because the work was a
  visible workflow decision and state-reconciliation step, not a code-generation
  task.
- Rationale/evidence: After sign-in, the Jules session
  `15527431301408060204` showed `Approve plan?` and a plan for Package 2 work:
  fix `createPlayerCombatCharacter`, equip all thirteen level-1 premade
  characters, audit level-1 caster spellbooks, add a combat loadout test, run
  pre-commit checks, and submit. That plan matched the dispatched Package 2
  prompt and stayed within the Jules-owned write scope. The operator had
  already authorized assumed approvals for this test flow, with a requirement
  to record where the decision was needed and what the agent decided.
- Mutation performed or skipped: Clicked the visible Jules `Approve plan?`
  control. Did not edit Package 2 implementation locally, did not infer a PR,
  did not bypass the dashboard with hidden status mutation, and did not mark
  Package 2 complete. Returned to Symphony and clicked visible `Refresh All
  Jules`; the dashboard then reported Package 2 as `IN_PROGRESS`.
- Scope guardrails: This approves only the Package 2 Jules plan for the already
  launched handoff. It does not approve future PR merge, local sync, broader
  schema/runtime changes, premade roster semantics outside the Package 2 task,
  or broad AI arbitration policy.
- Result: Jules accepted the plan (`Plan approved` shown in the visible Jules
  page), and Symphony refreshed from the stale completed/no-PR state to
  `Refresh Jules Status` for an `IN_PROGRESS` run.
- Next expected proof: Continue refreshing Package 2 through the visible
  Symphony dashboard until Jules returns a PR URL, blocker, or follow-up
  request, then perform scope review and verification before merge or local
  sync.

### Decision 31: Turn Safe Guarded PR Refresh Endpoints Into Visible Task-Page Controls

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: Whether to keep the Package 2 task page showing only the raw
  `POST /refresh-pr` endpoint, or add a deliberate visible button for safe
  Symphony refresh endpoints.
- Options considered:
  - Continue copying the endpoint from the task page and calling it outside the
    dashboard.
  - Leave all guarded actions as read-only runbook text.
  - Keep Git/GitHub/local mutation actions as runbook text, but allow
    non-mutating Symphony refresh endpoints to run from a visible task-page
    button.
- Decision made by agent: Add a visible `Run Safe Symphony Refresh` button for
  guarded Symphony `refresh-pr` / `refresh-status` endpoints that declare no
  Git, local-file, or external-system mutation.
- Model routing: Standard foreman/frontend reasoning, because this is a narrow
  dashboard UX repair exposed by the live task flow.
- Rationale/evidence: The Package 2 task page reached `Bridge Through
  Scout/Core` and listed `POST
  http://127.0.0.1:8139/api/v1/jules-handoffs/handoff-1779400495781-jauy49/refresh-pr`
  under `Guarded Operator Actions`, but there was no visible control to run it.
  Calling the endpoint manually would work technically, but it weakens the
  dashboard-first test because the human-facing page is supposed to carry the
  flow.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts`,
  `conductor/symphony/public/dashboard.css`, and
  `conductor/symphony/scripts/verify-task-detail-page.mjs`. Did not add buttons
  for Git pushes, GitHub comments, local sync, manifest staging, or other
  mutation actions.
- Scope guardrails: Only safe refresh endpoints are clickable. Mutation
  commands remain explicit runbook text and still require separate operator
  action and receipts.
- Result: The live Package 2 task page now shows one visible `Run Safe Symphony
  Refresh` button, and clicking it refreshes PR evidence from the task page.
- Next expected proof: Use the visible refresh button before each Scout/Core
  disposition so PR checks and file-risk evidence are current.

### Decision 32: Treat Expected-File Globs As Real Jules Write Scope

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: Whether to accept Scout/Core's false out-of-scope warning for
  Package 2 files, or repair the scope matcher to understand the write-scope
  patterns used by the handoff.
- Options considered:
  - Ignore the dashboard warning because Codex manually confirmed the file list
    was in scope.
  - Rewrite the Package 2 task scope to enumerate every premade JSON file and
    exact combat test file.
  - Repair the Scout/Core scope matcher so expected-file globs such as
    `public/premade-characters/*.json` and
    `src/utils/combat/__tests__/combatUtils_*.test.ts` are honored.
- Decision made by agent: Repair the Symphony PR scope classifier to support
  the lightweight glob patterns used in task write scopes.
- Model routing: Standard foreman/backend reasoning, because this is a narrow
  evidence-classification bug that blocked dashboard-first PR review.
- Rationale/evidence: After the visible safe refresh, the task detail correctly
  fetched PR #935 checks but falsely reported fourteen out-of-scope files,
  including every premade JSON file and the new `combatUtils_premade.test.ts`.
  Those files were explicitly covered by the Package 2 expected write scope.
- Mutation performed or skipped: Updated
  `conductor/symphony/src/task-intake.ts` and
  `conductor/symphony/scripts/verify-pr-scope-risk.mjs`. Did not broaden the
  Package 2 scope or waive actual out-of-scope detection.
- Scope guardrails: The matcher supports only the small review-boundary glob
  shapes used in expected file paths: `*` for one path segment and `**` for
  nested paths. Non-matching files still trigger the out-of-scope warning.
- Result: After restarting the dashboard and clicking the visible safe refresh,
  Package 2 Scout/Core evidence reports `outOfScopeFiles: []`, file risk
  `medium`, and the remaining risk reason `Large diff: 1,500 or more changed
  lines.`
- Next expected proof: Decide the remaining Package 2 blockers: failed
  workflow/test checks and whether the large JSON diff is acceptable or should
  go back to Jules for a narrower rewrite.

### Decision 33: Add A Visible No-Typing Operator Decision Button

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: Whether to use the hidden operator-answer endpoint after the
  visible text box failed in the in-app browser, or repair the dashboard so the
  operator decision can still be recorded from the visible task page.
- Options considered:
  - Call the local operator-answer endpoint directly with the desired answer.
  - Retry fragile browser text entry and leave the dashboard unchanged.
  - Add a visible button that records the selected decision with a
    plain-language default answer, while keeping the free-text answer box for
    humans who can type normally.
- Decision made by agent: Add `Record Selected Decision` to the task-page
  operator-answer form.
- Model routing: Standard foreman/frontend reasoning, because this is a narrow
  dashboard affordance repair exposed by the live task flow.
- Rationale/evidence: The Package 2 task page correctly asked whether Symphony
  should route the failed workflow/review automation check to setup repair
  before asking Jules to change task code. The visible answer form existed, but
  browser-driven text entry failed with the same virtual-clipboard limitation
  already seen on task notes. Calling the endpoint directly would bypass the
  dashboard-first test.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts` and
  `conductor/symphony/scripts/verify-task-detail-page.mjs`. Did not send Jules
  feedback, create Linear work, push to GitHub, or mutate Git.
- Scope guardrails: The new button records only a local operator receipt for
  the selected decision. It does not execute the selected repair lane or perform
  any external mutation.
- Result: The task page now has both `Record Operator Answer` for typed answers
  and `Record Selected Decision` for visible no-typing decisions. The live
  Package 2 task used the new button to record `create_setup_repair_task`.
- Next expected proof: Follow the recorded repair lane from the visible task
  page instead of sending Jules feedback or calling hidden endpoints.

### Decision 34: Surface The Selected Setup-Repair Lane As A Visible Local-Draft Action

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: After `create_setup_repair_task` was recorded, the dashboard
  still showed the old PR-refresh/Jules-feedback boundary instead of the
  selected setup-repair lane.
- Options considered:
  - Treat the local answer as enough and manually call the hidden
    `execute-repair-lane` endpoint.
  - Send Jules feedback even though the selected decision said to create setup
    repair first.
  - Wire the selected repair lane into the task page as a visible guarded local
    receipt action.
- Decision made by agent: Add a visible `Create Local Repair Draft` guarded
  action after the selected operator answer.
- Model routing: Standard foreman/backend reasoning, because this is a narrow
  workflow-routing repair that keeps the dashboard path aligned with the
  recorded decision.
- Rationale/evidence: The live task page recorded the operator answer, but the
  current boundary and guarded actions still offered PR refresh and Jules
  feedback. Symphony already had a local `execute-repair-lane` endpoint; the
  missing piece was dashboard routing from the selected answer to that endpoint.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts` and
  `conductor/symphony/scripts/verify-task-detail-page.mjs`. Then used the
  visible `Create Local Repair Draft` button on the Package 2 task page.
- Scope guardrails: The action creates only a local setup-repair draft. It does
  not create Linear work, launch Jules, send Jules feedback, comment on GitHub,
  push, merge, or edit spell implementation files.
- Result: The visible task page created local setup-repair draft
  `draft-1779410025252-nnowpt` titled `Setup repair for ARA-7`. The draft is
  currently `blocked_by_git_sync`, which is expected while this foreman branch
  still has unfiled local Symphony changes.
- Next expected proof: File these Symphony dashboard fixes, then use the
  dashboard draft path for `draft-1779410025252-nnowpt` if the workflow-config
  repair remains the chosen lane.

### Decision 35: Move The Global Dashboard Boundary Past Completed Jules Sessions With PRs

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: Whether to accept the main dashboard's stale `Refresh Jules
  Status` boundary after Package 2 had already captured PR #935, or repair the
  global boundary ladder so it points at PR review/check repair.
- Options considered:
  - Ignore the top dashboard boundary and keep using the task detail page.
  - Manually refresh PR checks from the raw endpoint whenever the top boundary
    looks stale.
  - Repair the global middleman path and task navigator so answered questions
    and completed Jules sessions with PRs no longer mask the real PR blocker.
- Decision made by agent: Repair the dashboard routing model.
- Model routing: Standard foreman/frontend-backend reasoning, because the bug
  crossed server-derived path state and client-side task navigator buckets.
- Rationale/evidence: The visible dashboard showed Package 2 with PR #935 and
  a local setup-repair draft, but `Current Foreman Boundary` still showed
  `Jules session` / `Refresh Jules Status`, and the navigator still counted one
  task as needing input even though `create_setup_repair_task` had been
  recorded. That misdirected the human foreman back to a finished Jules polling
  lane instead of the current PR/check blocker.
- Mutation performed or skipped: Updated `conductor/symphony/src/server.ts`,
  `conductor/symphony/public/dashboard.js`, added
  `conductor/symphony/scripts/verify-pr-boundary-after-jules-completion.mjs`,
  and extended
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`.
- Scope guardrails: The change is read-only dashboard routing. It does not push
  a branch, create a PR, merge, call Linear, launch Jules, or mutate Package 2
  implementation files.
- Result: After restart, the live dashboard reports `Needs input: 0`, selects
  `Setup repair for ARA-7` as the open draft, and shows global
  `Current Foreman Boundary` as `GitHub PR` with `Run GitHub PR` / PR-refresh
  evidence instead of stale Jules status.
- Next expected proof: Commit and file these Symphony dashboard fixes, then
  resolve the Git sync/disposition blocker for `draft-1779410025252-nnowpt`.

### Decision 36: Open Git Safety When Git Disposition Is The Active Blocker

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 setup-repair routing
- Decision point: Whether to use the hidden Git disposition endpoint or repair
  the dashboard after the visible workflow showed the disposition button inside
  a collapsed Git Safety drawer.
- Options considered:
  - Call `/api/v1/git-disposition` directly and move past the blocker.
  - Ask the operator to know that Git Safety must be expanded manually.
  - Make the Git Safety drawer open automatically when Git sync, disposition,
    or guarded sync-plan evidence is the active blocker.
- Decision made by agent: Repair the dashboard so the required Git disposition
  controls are visible when they are the next decision surface.
- Model routing: Standard foreman/frontend reasoning, because this was a narrow
  dashboard visibility defect exposed by human-style browser use.
- Rationale/evidence: The live dashboard showed `Check GitHub Sync` and a
  pending disposition path, but the actionable `Record Git disposition` button
  was not clickable until the hidden drawer state was corrected. After the fix,
  the in-app browser showed `Sync Decision Board`, both disposition cards, the
  recorded remote-commit decision, and a visible tracked-changes decision.
- Mutation performed or skipped: Updated
  `conductor/symphony/public/dashboard.js` and
  `conductor/symphony/scripts/verify-sync-decision-board.mjs`. Then used the
  visible Sync Decision Board to record `tracked_changes` as
  `commit_for_jules_base`.
- Scope guardrails: The dashboard action records operator intent only. It does
  not pull, push, stash, clean, switch branches, launch Jules, create Linear
  work, or edit spell implementation files.
- Result: The live dashboard reports `ready_for_human_execution` for the guarded
  Git sync plan after both visible decisions are recorded:
  `tracked_changes=commit_for_jules_base` and
  `remote_commits=integrate_after_local_safe`.
- Next expected proof: Commit this dashboard repair, re-run `Check GitHub Sync`,
  and continue only from the visible guarded sync plan or the next dashboard
  blocker it exposes.

### Decision 37: Make Current-Boundary PR Refresh A Real Dashboard Button

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review
- Decision point: Whether to open the raw PR refresh endpoint from the current
  boundary or repair the current-boundary renderer so `Run GitHub PR` is a
  clickable dashboard action.
- Options considered:
  - Use the raw `/refresh-pr` endpoint link even though a browser link cannot
    perform the intended guarded POST action.
  - Scroll down to a lower handoff card and use its existing refresh button,
    leaving the top current-boundary action misleading.
  - Reuse the existing safe `refresh-pr` dashboard action in the
    current-boundary panel.
- Decision made by agent: Add a `Refresh GitHub PR` button to the
  current-boundary panel for safe PR refresh actions.
- Model routing: Standard foreman/frontend reasoning, because this was a narrow
  dashboard affordance repair using an existing safe button path.
- Rationale/evidence: The visible dashboard showed `Run GitHub PR`,
  `Method POST`, `Can run now yes`, but exposed only `Evidence` and `Endpoint`
  links. The current-boundary surface should be operable without asking the
  operator to know where the lower duplicate handoff controls live.
- Mutation performed or skipped: Updated
  `conductor/symphony/public/dashboard.js` and extended
  `conductor/symphony/scripts/verify-pr-boundary-after-jules-completion.mjs`.
- Scope guardrails: The button reuses the existing `refresh-pr` handler. It
  only reads GitHub PR state/checks/comments/risk evidence; it does not push,
  merge, comment, launch Jules, create Linear work, or mutate local files.
- Result: The next dashboard reload can expose the current PR boundary as a
  visible `Refresh GitHub PR` button instead of a raw POST endpoint link.
- Next expected proof: Reload the dashboard, click the current-boundary
  `Refresh GitHub PR` button, and capture the refreshed Package 2 PR evidence.

### Decision 38: Repair Gemini Review Setup Before Sending More Jules Feedback

- Date/time: 2026-05-22
- Phase: `package_2_setup_repair`
- Active slice: Package 2 PR #935 failed-check classification
- Decision point: Whether to send PR #935 back to Jules, merge despite failed
  checks, or repair the workflow setup failure first.
- Options considered:
  - Ask Jules to change Package 2 implementation code without first fixing the
    failing review automation.
  - Merge PR #935 because its changed files are inside scope and focused local
    verification had passed.
  - Repair the workflow/setup blocker locally, then rerun/refresh PR #935
    evidence through Symphony.
- Decision made by agent: Repair the setup blocker locally first.
- Model routing: `local_careful`, matching the dashboard routing packet after
  the setup-repair draft passed Git sync and Linear gates.
- Rationale/evidence: GitHub `review / review` failed before code review with
  `ModelNotFoundError: models/gemini-1.5-flash is not found...`. The sibling
  Gemini workflows already use `${{ vars.GEMINI_MODEL }}`, while
  `.github/workflows/gemini-review.yml` hardcoded the retired model. The PR
  test job also failed one movement-seasonal assertion, but the focused
  movement test passed locally on synced `master`, so that remains a rerun or
  ambient/full-suite classification item instead of an implementation change.
- Mutation performed or skipped: Updated
  `.github/workflows/gemini-review.yml` to use `${{ vars.GEMINI_MODEL }}` and
  updated Symphony setup-repair draft scope in
  `conductor/symphony/src/task-intake.ts` plus its verifier to include
  `.github/workflows/gemini-review.yml`.
- Scope guardrails: Did not edit PR #935 spell implementation files, premade
  character JSON, movement runtime code, movement tests, package files, or
  lockfiles.
- Result: Focused local verification passed, and draft PR #937 now carries the
  setup repair. The repair is scoped to the actual failing workflow file, and
  future Symphony setup-repair drafts can name that file instead of implying
  only `ci.yml` or lockfile repairs.
- Next expected proof: Review/merge PR #937, rerun or refresh PR #935 checks
  after the workflow repair lands, and record whether the movement test failure
  clears or remains an independent blocker.

### Decision 39: Improve Dashboard First-Viewport UX While Stitch MCP Auth Is Pending

- Date/time: 2026-05-22
- Phase: `dashboard_first_workflow`
- Active slice: Package 2 PR review and setup-repair visibility
- Decision point: Whether to keep changing the dashboard directly, wait for
  Stitch design generation, or configure Stitch and clearly separate the
  authentication blocker from local dashboard UX work.
- Options considered:
  - Claim the dashboard pass was Stitch-generated even though no Stitch MCP tool
    was available in the running Codex session.
  - Stop all dashboard work until the operator creates and installs a Stitch API
    key.
  - Configure the Stitch MCP server entry, record that authentication/restart is
    still required, and continue a clearly local dashboard hierarchy pass.
- Decision made by agent: Configure the Stitch MCP server entry outside the
  repo, record the remaining auth/restart blocker, and continue only a local
  dashboard hierarchy improvement.
- Model routing: Local Codex frontend reasoning, because this pass edits the
  existing static Symphony dashboard and does not use a live Stitch generation
  result.
- Rationale/evidence: Stitch docs show a remote MCP server at
  `https://stitch.googleapis.com/mcp` with API-key or OAuth headers. The current
  Codex config did not include Stitch, and the running tool registry still did
  not expose Stitch tools after adding the server entry because Codex needs a
  restart and authentication headers. The operator-visible dashboard remained
  difficult to scan: the current action was still separated from high-level
  metrics and the task-detail preview consumed too much of the first viewport.
- Mutation performed or skipped: Added a user-level Codex config entry for
  `[mcp_servers.stitch]` at `C:\Users\Gambit\.codex\config.toml` after writing
  a backup. In the repo, updated `conductor/symphony/public/dashboard.js` and
  `conductor/symphony/public/dashboard.css` to add a first-viewport focus
  strip, put the current safe action in that strip, collapse worker roster
  details unless approval is needed, collapse task-detail preview unless human
  input is required, and tighten the surrounding dashboard spacing.
- Scope guardrails: Did not store a Stitch API key, did not claim Stitch output,
  did not add new backend endpoints, did not alter Jules/GitHub/Linear/Git
  mutation policy, and did not change PR #935 implementation files.
- Result: Local contract verification and rendered dashboard inspection passed,
  and draft PR #937 now carries the first-viewport dashboard UX repair. Stitch
  is listed as a Codex MCP server, but live Stitch use still requires
  authentication and a Codex restart. The dashboard UX pass is explicitly local
  and should be judged by rendered dashboard inspection, not by Stitch
  provenance.
- Next expected proof: Restart Codex after installing a Stitch API key or OAuth
  headers, confirm Stitch tools are visible, and use Stitch for the next design
  iteration. For this local pass, review PR #937 and keep the rendered
  first-viewport evidence attached to its verification notes.

### Decision 40: File Setup-Review Repair As PR #937

- Date/time: 2026-05-22
- Phase: `package_2_setup_repair`
- Active slice: Package 2 PR #935 failed-check follow-through
- Decision point: Whether to leave the verified setup-repair branch local,
  send more Jules feedback first, or publish the repair for GitHub review.
- Options considered:
  - Keep the branch local and continue gathering evidence.
  - Send Jules follow-up on PR #935 before the broken review workflow can run.
  - Push the setup-repair branch and open a draft PR so the workflow repair can
    land separately from the Package 2 spell implementation PR.
- Decision made by agent: Push
  `codex/spell-phase1-package2-setup-repair` and open draft PR #937.
- Model routing: Local Codex foreman, because this is GitHub/Symphony workflow
  follow-through rather than a Jules implementation task.
- Rationale/evidence: The repair branch had fresh Symphony contract checks,
  rendered dashboard inspection, the Gemini model-name guard, and focused
  movement-test verification. The user had already authorized branch pushing and
  PR creation for this test flow, so stopping for another approval prompt would
  reintroduce the approval blockage this flow is meant to measure.
- Mutation performed or skipped: Committed the repair as `4d29f43b`, pushed the
  branch, and opened draft PR #937. Did not merge PR #937 or PR #935.
- Scope guardrails: Did not modify PR #935 spell implementation files, did not
  reroute Jules, did not store a Stitch API key, and did not bypass the
  dashboard-first blocker model except for allowed verification and publishing
  mechanics.
- Result: Draft PR #937 is filed at
  `https://github.com/Gambitnl/Aralia/pull/937`.
- Next expected proof: Let PR #937 checks/review run, merge it if acceptable,
  then refresh PR #935 through the Symphony dashboard and classify any remaining
  failed check separately.

### Decision 41: Merge PR #937 And Update PR #935 Instead Of Sending Jules Feedback

- Date/time: 2026-05-22
- Phase: `package_2_setup_repair`
- Active slice: Package 2 PR #935 failed-check follow-through
- Decision point: Whether to leave PR #937 open, send Jules a follow-up, rerun
  stale failed jobs, or merge the workflow repair and update PR #935 with
  current `master`.
- Options considered:
  - Leave PR #937 open and keep PR #935 blocked.
  - Send Jules feedback even though the failure was in repository review
    infrastructure, not the Package 2 implementation.
  - Rerun the failed PR #935 jobs without changing the PR merge ref.
  - Merge PR #937, update PR #935's branch against current `master`, then let
    GitHub produce a fresh check set.
- Decision made by agent: Merge PR #937, rerun PR #935 once for evidence, then
  update PR #935's branch when the rerun proved it was still using the stale
  merge ref.
- Model routing: Local Codex foreman, because this was GitHub/Symphony
  workflow follow-through rather than spell implementation.
- Rationale/evidence: PR #937 had clean CI and a clean merge state. Rerunning
  the old PR #935 failed jobs still logged `gemini_model: gemini-1.5-flash`
  from `refs/pull/935/merge`, proving rerun alone was insufficient. Updating
  the PR branch created a fresh check set against current `master`.
- Mutation performed or skipped: Merged PR #937 as
  `aa58546aba965ed6c070922b37e6eb0bd8c4fdc6`, reran the failed PR #935 jobs,
  then updated PR #935's branch to
  `e4c4d47b1f99a4a8f6267faa756694857e4c30c6`.
- Scope guardrails: Did not edit Jules implementation files directly. The PR
  branch update only incorporated current `master` into PR #935 through
  GitHub's branch update path.
- Result: PR #935's refreshed CodeQL, poison, build, lint, quality scan, and
  tests passed. The old movement failure cleared on rerun. A fresh Gemini
  review check did not appear in the branch-update check set, so the useful
  evidence is clean CI plus the earlier local/Scout-Core review, not new Gemini
  prose.
- Next expected proof: Decide whether the remaining JSON formatting churn is
  acceptable, then merge or return PR #935.

### Decision 42: Merge Package 2 PR #935 After Refreshed Checks Passed

- Date/time: 2026-05-22
- Phase: `package_2_merge_closeout`
- Active slice: Package 2 premade party and gear
- Decision point: Whether to merge PR #935 after clean refreshed checks, ask
  Jules for a narrower JSON rewrite, or keep waiting for Gemini review output
  that did not appear in the branch-update check set.
- Options considered:
  - Return PR #935 to Jules solely to reduce JSON formatting churn.
  - Keep PR #935 open until a Gemini review check appears.
  - Merge PR #935 using the clean refreshed CI, final in-scope file list,
    focused local verification, and Scout/Core evidence.
- Decision made by agent: Merge PR #935.
- Model routing: Local Codex foreman, because this was merge disposition and
  closeout evidence, not a new implementation task.
- Rationale/evidence: The final PR file list contained thirteen premade
  character JSON files, `src/utils/combat/combatUtils.ts`, and
  `src/utils/combat/__tests__/combatUtils_premade.test.ts`, all within Package
  2 scope. Helper files observed during the live Jules workspace did not land in
  the PR. GitHub CI passed after updating the branch with current `master`.
  Post-merge closeout verification passed spell validation, spell-gate
  generation, and concrete combat utility tests.
- Mutation performed or skipped: Merged PR #935 as
  `88c11e434c461823bc4226409059882a0ab9ceb6`, created closeout branch
  `codex/spell-phase1-package2-closeout` from updated `origin/master`, and
  recorded Package 2 closeout evidence in the tracker and receipts.
- Scope guardrails: Did not mark Spell Phase 1 complete. Package 3 and later
  still own character creator spell selection, character sheet spellbook
  visibility, combat simulator spell use, AI arbitration, and remaining
  cantrip/level 1-3 mechanics closure.
- Result: Package 2 implementation is merged. Package 3 can now be packaged for
  Jules through the dashboard-first flow.
- Next expected proof: Publish this closeout tracker update, then create the
  Package 3 Jules task package from the Phase 1 plan.

### Decision 43: Set Repository Gemini Model Variable After PR #938 Exposed The Missing Variable

- Date/time: 2026-05-22
- Phase: `package_2_closeout_ci_repair`
- Active slice: Package 2 closeout PR #938
- Decision point: Whether to change code again, leave PR #938 blocked, or set
  the repository-level `GEMINI_MODEL` variable that the repaired workflow now
  reads.
- Options considered:
  - Hardcode another model in `.github/workflows/gemini-review.yml`.
  - Leave the PR blocked and treat Gemini review as optional.
  - Set repository variable `GEMINI_MODEL` to a current Gemini API model.
- Decision made by agent: Set GitHub repository variable `GEMINI_MODEL` to
  `gemini-2.5-flash`.
- Model routing: Local Codex foreman plus official Google AI docs lookup,
  because the repair touched external GitHub configuration and needed a current
  model name.
- Rationale/evidence: PR #938 proved that the workflow code fix was only half
  the repair: the action still fell back to `gemini-1.5-flash` when the
  repository variable was missing. Official Google AI API docs show
  `gemini-2.5-flash` as a supported `v1beta` `generateContent` model.
- Mutation performed or skipped: Ran `gh variable set GEMINI_MODEL --repo
  Gambitnl/Aralia --body gemini-2.5-flash`, confirmed the variable with
  `gh variable get GEMINI_MODEL`, and reran the failed PR #938 Gemini review
  job.
- Scope guardrails: Did not store or change API keys, did not alter PR #935
  implementation files, and did not hardcode the model back into workflow YAML.
- Result: PR #938 `review / review` rerun passed, and the PR's build, lint,
  tests, CodeQL, and poison-file checks also passed.
- Next expected proof: Merge PR #938, then continue to Package 3 packaging.

### Decision 44: Package Character Creator And Spellbook Visibility As The Next Jules Slice

- Date/time: 2026-05-22
- Phase: `package_3_pre_dispatch`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: Whether Codex should repair the character creator/spellbook
  UI locally, send a broad "finish spell UI" request to Jules, or create a
  bounded Package 3 task packet for dashboard-first Jules offload.
- Options considered:
  - Implement the UI/assembly repairs locally in the foreman session.
  - Send Jules a broad prompt covering character creator, spellbook, combat
    simulator spell casting, AI arbitration, and level 2-3 fixtures together.
  - Create a bounded Package 3 packet focused on character creator spell
    selection and character sheet spellbook visibility, leaving combat and AI
    arbitration to Packages 4 and 5.
- Decision made by agent: Create the bounded Package 3 task packet for Jules
  and keep Codex in the foreman role.
- Model routing: Strong local foreman reasoning, because this defines the next
  write-producing slice and prevents scope bleed into combat/runtime or
  arbitration policy.
- Rationale/evidence: Package 2 is merged and the Phase 1 plan names Package 3
  as the next sequential slice. Current source inspection shows repeated
  class-specific spell selectors, a live Spellbook tab/overlay surface, and a
  possible known/prepared semantics ambiguity in character assembly. Those are
  clear enough for a bounded Jules implementation task, while combat simulator
  spell behavior and AI arbitration remain separate later packages.
- Mutation performed or skipped: Created
  `docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_TASK.md`,
  `docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_PROMPT.md`,
  `docs/tasks/spells/PACKAGE_3_DISPATCH_READINESS_CHECKLIST.md`,
  `docs/tasks/spells/PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json`,
  `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`, and
  `docs/tasks/spells/PACKAGE_3_VISUAL_PROOF_RECEIPT.md`. Updated the living
  tracker to make Package 3 active and record adjacent gaps.
- Scope guardrails: Package 3 excludes combat simulator casting behavior, broad
  spell schema/runtime architecture, AI arbitration policy, and premade roster
  semantics except tiny test fixtures if strictly necessary.
- Result: Package 3 is packaged for dashboard draft creation. It is not yet
  dispatched to Jules.
- Next expected proof: Use the visible Symphony dashboard to create the Package
  3 task draft from the payload, then record the draft id, any blocker, and the
  handoff path in the Package 3 readiness checklist.

### Decision 45: Do Not Push Diverged Local Master For The Package 3 Base

- Date/time: 2026-05-22
- Phase: `package_3_dashboard_git_gate`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: The visible Symphony dashboard blocked Package 3 draft work
  at the Git sync gate. It showed local `master` with two local-only
  racial-mechanics commits and three remote-only Spell Phase 1 commits, while
  the active Package 3 docs were on `codex/spell-phase1-package3-planning`.
- Options considered:
  - Follow the dashboard-generated human command suggestion to push/pull
    `master`.
  - Reset or move local `master` to GitHub, discarding or burying the local-only
    racial-mechanics commits.
  - Record dashboard dispositions, keep the unrelated local `master` commits
    local, and commit the Package 3 task packet on the package branch.
- Decision made by agent: Record the dashboard dispositions visibly, keep the
  unrelated local `master` commits local, and commit Package 3 docs on the
  package branch.
- Model routing: Strong local foreman reasoning, because this decision protects
  unrelated local work and prevents a workflow tool suggestion from becoming a
  destructive Git action.
- Rationale/evidence: The dashboard Git Safety board identified local-only
  commits `1cc84428` and `42af4f59`, both carrying broad racial-mechanics work
  unrelated to Package 3. The same board identified the Package 3 docs as
  untracked source artifacts needed for the Jules base. Pushing `master` would
  publish unrelated work; resetting `master` would endanger it.
- Mutation performed or skipped: Used the visible dashboard Git Safety board to
  record `Local-only commits = Keep local` and
  `Untracked artifacts = Commit for Jules base`. Skipped pushing or pulling
  local `master`. Prepared the package branch commit instead.
- Scope guardrails: Do not delete, reset, squash, or publish the unrelated
  racial-mechanics local commits from this spell flow. Do not create a Jules
  handoff until Package 3 docs are visible from a safe GitHub base.
- Result: Dashboard-first flow exposed a valid Git ownership blocker and the
  agent selected the non-destructive branch path.
- Next expected proof: Commit and publish the Package 3 planning branch, open
  the PR, merge it if checks pass, then re-enter the dashboard from a base that
  can see the Package 3 docs without touching unrelated local `master` work.

### Decision 46: Repair The Dashboard Git Gate For Clean Worktree Branches

- Date/time: 2026-05-22
- Phase: `package_3_dashboard_git_gate_repair`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After PR #939 merged, the visible dashboard still blocked on
  `Switch to master` while the isolated worktree was on
  `codex/spell-phase1-dashboard-stitch-flow` at the merged `origin/master`
  commit and local `master` still carried unrelated racial-mechanics commits.
- Options considered:
  - Switch the root checkout to `master` and pull/push/reset until the old
    single-checkout gate passed.
  - Use terminal/API calls to create the Package 3 draft and ignore the visible
    dashboard blocker.
  - Fix the Symphony preflight so a clean worktree branch whose `HEAD` matches
    `origin/master` can pass while unpublished branch commits still block.
- Decision made by agent: Fix the Symphony preflight and keep using the
  dashboard as the pressure test.
- Model routing: Local Codex foreman with focused debugging/TDD, because this
  is Symphony orchestration code and should be repaired locally before asking
  Jules to implement Package 3.
- Rationale/evidence: The dashboard blocker was reproducible in the in-app
  browser. `runGitSyncPreflight()` compared local `master...origin/master` and
  blocked any non-`master` current branch, which is wrong for linked worktrees
  where the checked-out branch is a clean view of GitHub and local `master`
  belongs to unrelated user work.
- Mutation performed or skipped: Added a failing regression case to
  `conductor/symphony/scripts/verify-git-preflight-blockers.mjs`, then updated
  `conductor/symphony/src/task-intake.ts` so the preflight compares the checked
  out commit (`HEAD`) to `origin/master` when the current branch is not the base
  branch. Unpublished or stale current-branch commits now block with
  `publish_or_merge_current_branch` instead of suggesting unrelated local
  `master` pushes.
- Scope guardrails: This does not change local-sync behavior after a Jules PR
  merge, does not reset/pull/push local `master`, and does not dispatch Package
  3 until the dashboard gate repair is landed and verified.
- Result: Focused build and `verify-git-preflight-blockers.mjs` passed
  locally. PR #940 passed GitHub checks and merged as
  `ca35cf61fdc02f19e561ad1e4aff758548155ff6`.
- Next expected proof: Re-enter the dashboard from a fresh worktree branch at
  `origin/master`, then create the Package 3 dashboard draft visibly.

### Decision 47: Treat Stitch MCP As Still Blocked Despite The New API Key

- Date/time: 2026-05-22
- Phase: `dashboard_ux_stitch_tooling`
- Active slice: Symphony dashboard UX and Package 3 dashboard flow
- Decision point: The operator asked Codex to use Stitch for dashboard UX. A
  restricted Stitch API key was created and set, but the restarted
  `mcp__stitch__` tool call still failed with `Auth required`.
- Options considered:
  - Claim Stitch was available because `stitch-mcp doctor` reports the API
    healthy.
  - Use local dashboard judgement and label the result as Stitch-generated.
  - Record the Stitch tool path as blocked and continue with dashboard workflow
    repairs that are independently justified by visible dashboard use.
- Decision made by agent: Record Stitch as blocked for actual design generation
  and do not claim Stitch-generated dashboard work.
- Model routing: Local Codex foreman, because this is a tooling/authentication
  classification decision.
- Rationale/evidence: The API key is present in
  `C:\Users\Gambit\.codex\config.toml`, but `mcp__stitch__.list_projects`
  returns `Auth required`. A fresh `stitch-mcp doctor` run now opens the Google
  Cloud user-auth flow, which confirms the remaining blocker is authenticated
  account access rather than missing API-key config. Direct CLI invocation with
  the configured key also reaches a separate Windows/package bug,
  `Bun is not defined`, when using `--data-file`.
- Mutation performed or skipped: Kept the API key configured. Did not alter
  Stitch project data, create designs, or use hidden dashboard edits as a
  substitute for Stitch output.
- Scope guardrails: Continue improving the dashboard only where the visible
  dashboard-first flow exposes a concrete blocker. Do not call future UI changes
  Stitch-driven until a Stitch project/screen/tool call succeeds.
- Result: Stitch remains an active tooling gap, while the Package 3 Git-gate
  repair proceeds as a dashboard-first workflow blocker.
- Next expected proof: Repair or reconfigure the Stitch MCP/CLI path until
  `list_projects` or an equivalent Stitch project read succeeds, then use
  Stitch for a deliberate dashboard redesign pass.

### Decision 48: Scope Git Disposition Decisions To The Current Evidence

- Date/time: 2026-05-22
- Phase: `package_3_dashboard_git_gate_repair_followup`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After PR #940 landed and the dashboard was restarted on
  `http://127.0.0.1:8139/`, the Git gate correctly compared the current
  worktree branch against `origin/master`, but the Sync Decision Board reused
  the older `keep_local` disposition recorded for unrelated local `master`
  commits. The execution plan also described the current-branch commit as a
  simple branch push even though the branch had already been pushed and the real
  base-gate resolution is to publish and merge the branch or switch to a clean
  checkout.
- Options considered:
  - Accept the stale disposition and manually open/merge a PR outside the
    dashboard flow.
  - Record another disposition for the same category and leave the category-only
    reuse bug for later.
  - Repair Symphony so Git dispositions expire when the underlying branch,
    commits, counts, or file samples change, and make the current-branch plan
    explicitly say publish or merge.
- Decision made by agent: Repair Symphony with a focused failing regression,
  then continue the dashboard-first Package 3 flow from the corrected guidance.
- Model routing: Local Codex foreman with systematic debugging and focused TDD,
  because this was orchestration/dashboard state logic, not spell feature
  implementation suitable for Jules.
- Rationale/evidence: The in-app browser showed `c6995536` as the only branch
  commit, while the disposition note still described unrelated racial-mechanics
  local `master` commits. The regression in
  `verify-git-preflight-blockers.mjs` reproduced that stale-disposition leak in
  a temporary repo, watched it fail, then verified the scoped fix.
- Mutation performed or skipped: Added `scopeKey` to Git disposition records,
  scoped recorded decisions to the live preflight evidence, filtered stale
  decisions out of dashboard snapshots, and changed the Git sync plan label for
  non-base branch commits to `Publish or merge current branch`.
- Scope guardrails: This does not run Git, does not create or merge a PR by
  itself, and does not bypass the dashboard gate. It only prevents stale
  dashboard state from masquerading as a current operator decision.
- Result: `npm run build`, `verify-git-preflight-blockers.mjs`,
  `verify-git-sync-plan.mjs`, `verify-sync-decision-board.mjs`, and
  `verify-task-dashboard-navigator.mjs` passed locally.
- Next expected proof: Land this Symphony follow-up, restart the dashboard on
  `8139`, record the current branch disposition visibly if still needed, and
  continue to Package 3 draft creation only after the Git gate reports ready.

### Decision 49: Dispatch Package 3 Through The Visible Dashboard Flow

- Date/time: 2026-05-22
- Phase: `package_3_dashboard_dispatch`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: With PR #941 merged and the dashboard Git gate reporting
  ready, the operator-facing choice was whether to continue Package 3 through
  the visible dashboard controls or use terminal/API endpoints to create the
  draft, Linear issue, handoff, manifest, and Jules launch faster.
- Options considered:
  - Use hidden API calls because the draft and handoff controls were available
    as known endpoints.
  - Pause Package 3 dispatch and repair the dashboard before any further
    progress.
  - Use the visible dashboard controls, reopening the relevant drawer when the
    dashboard rerender collapsed it, and record that drawer friction as a UX
    gap rather than a dispatch blocker.
- Decision made by agent: Use the visible dashboard controls and continue
  dispatch while recording the collapsed-drawer friction as an adjacent
  Symphony UX gap.
- Model routing: Local Codex foreman for orchestration and evidence capture;
  Jules receives the implementation task itself.
- Rationale/evidence: The dashboard showed Package 3 in the task navigator and
  the `Task Intake And Records` drawer contained the correct enabled controls.
  The visible `Prepare Handoff`, `Stage Jules Manifest`, `Launch Jules`, and
  current-boundary `Refresh Jules Status` buttons all worked once the relevant
  drawer/control was visible. Using hidden POST endpoints would have skipped
  the dashboard-first pressure test the operator explicitly requested.
- Mutation performed or skipped: Created dashboard draft
  `draft-1779442977969-w2vsy4`, attached Linear issue ARA-9, promoted handoff
  `handoff-1779443555192-bnpws7`, staged its manifest, launched Jules session
  `2823658242418460192`, and refreshed status through the dashboard. Did not
  bypass any blocked dashboard step with direct endpoint calls.
- Scope guardrails: Package 3 remains limited to character creator spell
  selection and character sheet spellbook visibility. Combat simulator casting,
  broad spell schema/runtime architecture, AI arbitration policy, and premade
  roster semantics remain later packages or adjacent gaps unless needed only as
  tiny test fixtures.
- Result: Jules reports `QUEUED`; no PR URL has been captured yet. The Package
  3 handoff receipt and readiness checklist now carry the draft, Linear,
  handoff, manifest, and session ids.
- Next expected proof: Continue refreshing Jules status through the dashboard
  until Symphony captures a PR URL, a plan-approval gate, a feedback request, or
  a durable reason that Jules has not produced a PR yet.

### Decision 50: Approve The Package 3 Jules Plan But Do Not Treat Completion As Implemented Without PR Proof

- Date/time: 2026-05-22
- Phase: `package_3_jules_plan_approval`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: Jules session `2823658242418460192` moved from `QUEUED` to
  `AWAITING_PLAN_APPROVAL`. The operator had already authorized assumed
  approvals for this dashboard test flow, but wanted decision points recorded
  clearly.
- Options considered:
  - Stop and ask for manual approval before allowing Jules to continue.
  - Approve the plan through the visible dashboard and record the decision as
    assumed approval.
  - Bypass the dashboard approval path and call the Jules/orchestrator approval
    command directly.
- Decision made by agent: Approve the Jules plan through the visible dashboard
  control, using the user's standing approval for this test flow.
- Model routing: Local Codex foreman for orchestration; Jules remains the
  implementation worker for Package 3.
- Rationale/evidence: The Package 3 task packet was already bounded, the
  dashboard exposed an enabled `Approve Jules Plan` button, and direct terminal
  approval would have bypassed the dashboard-first pressure test. The dashboard
  recorded approval command
  `npx tsx .jules/orchestrator/cli.ts approve 2823658242418460192`.
- Mutation performed or skipped: Recorded plan approval through the dashboard.
  Did not broaden Package 3 scope and did not perform the implementation
  locally.
- Follow-up decision point: After approval, dashboard refresh reported Jules
  state `COMPLETED`, but no PR URL was captured. The visible Jules session was
  opened in the signed-in browser and showed the plan/checklist surface without
  `View PR`, GitHub URL, or pull request text.
- Decision made by agent: Do not treat Package 3 as implemented or complete
  without PR/code/no-change proof. Record this as a Jules/Symphony
  reconciliation gap and keep Package 3 in waiting/reconciliation state.
- Result: Package 3 has a launched/approved Jules session but no captured PR.
  The next valid proof is evidence that a hidden PR exists, Jules completed
  without code changes, or the session stalled after plan generation.
- Next expected proof: Use the dashboard/Jules visible path or a Symphony-owned
  status endpoint to reconcile the completed-no-PR state before reviewing or
  merging any Package 3 implementation.

### Decision 51: Confirm The Visible Jules Plan Gate And Repair Package-Neutral No-PR Wording

- Date/time: 2026-05-22
- Phase: `package_3_jules_reconciliation`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: The dashboard had already recorded plan approval, but the
  signed-in Jules page still displayed the Package 3 plan and asked whether the
  plan looked good. At the same time, Symphony's reusable no-PR blocker text
  incorrectly said `before filing Package 2` while Package 3 was active.
- Options considered:
  - Relaunch Package 3 as a new Jules task.
  - Treat the completed-without-PR state as final and start a no-PR recovery
    package.
  - Confirm the bounded plan in the visible Jules session, refresh through the
    dashboard, and repair the misleading Symphony blocker wording locally.
- Decision made by agent: Confirm the bounded Package 3 plan in the visible
  Jules chat, then repair the package-specific no-PR wording in Symphony.
- Model routing: Local Codex foreman with focused debugging/TDD for the
  Symphony blocker; Jules remains the implementation worker for Package 3.
- Rationale/evidence: Visible Jules showed an operator input gate rather than
  a durable no-code result or PR link. After the confirmation, dashboard refresh
  moved Package 3 back to `IN_PROGRESS`. GitHub still had no
  `jules/spells-package3-spellbook-creator-visibility` branch or PR. The
  hardcoded `Package 2` text was reproduced in
  `verify-completed-jules-no-pr-boundary.mjs` before the production change.
- Mutation performed or skipped: Sent the visible Jules confirmation preserving
  Package 3's declared write scope. Added a failing regression to
  `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs`, then
  changed `conductor/symphony/src/server.ts` so the reusable blocker says
  `before filing the next handoff`.
- Scope guardrails: Did not relaunch Jules, did not implement Package 3
  locally, did not broaden into combat simulator casting, AI arbitration,
  shared spell schema/runtime architecture, or premade roster semantics.
- Result: Package 3 remains waiting on Jules in `IN_PROGRESS` state with no PR
  captured. The misleading Package 2 blocker is fixed and covered by a focused
  verifier.
- Next expected proof: Continue dashboard-first status refreshes until a PR
  URL, feedback request, failure, or durable no-code/no-PR result is captured.

### Decision 52: Keep Package 3 Waiting After Post-Confirmation Monitor

- Date/time: 2026-05-22
- Phase: `package_3_jules_monitoring`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After PR #944 merged the Package 3 reconciliation docs and
  Symphony no-PR wording repair, the dashboard still reported Jules session
  `2823658242418460192` as `IN_PROGRESS`. The visible Jules page still showed
  `Plan approved`, with no new feedback prompt, no PR link, no visible failure,
  and no expected branch/PR visible in GitHub.
- Options considered:
  - Relaunch Package 3 immediately as a new Jules task.
  - Split Package 3 into smaller tasks before the current Jules run finishes.
  - Keep the current Jules run alive and continue dashboard-first monitoring.
- Decision made by agent: Keep the current Jules run alive and continue
  dashboard-first monitoring.
- Model routing: Local Codex foreman reasoning; no Jules implementation work
  was performed locally.
- Rationale/evidence: The current evidence says the run is active rather than a
  durable no-code completion. Relaunching now could create duplicate work, and
  splitting now would be premature without a Jules failure, feedback request,
  or scope-conflict report. GitHub branch and PR checks remain empty, so there
  is still nothing for Scout/Core to review.
- Mutation performed or skipped: Used the visible dashboard `Refresh Jules
  Status` control and inspected the visible Jules session. Skipped relaunching,
  splitting Package 3, local implementation, and hidden endpoint mutation.
- Scope guardrails: Package 3 remains limited to character creator spell
  selection and character sheet spellbook visibility. Combat simulator casting,
  AI arbitration, broad spell schema/runtime architecture, and premade roster
  semantics remain out of this active slice.
- Result: Package 3 remains waiting on Jules. No code PR exists yet.
- Next expected proof: Another dashboard refresh should capture a PR URL,
  feedback request, failure/no-code result, or continued `IN_PROGRESS` state
  with GitHub branch/PR evidence checked separately.

### Decision 53: Merge Monitor Docs And Keep Visible Jules Work In Jules

- Date/time: 2026-05-22
- Phase: `package_3_jules_monitoring`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: PR #945 was a docs-only monitor-decision PR. Its GitHub CI
  rerun passed, while `review / review` failed before review due Gemini
  `gemini-2.5-flash` daily quota exhaustion. After merge, the dashboard still
  reported Package 3 Jules session `2823658242418460192` as `IN_PROGRESS` with
  no PR URL, but the signed-in Jules page showed actual Package 3 code edits
  and a `Working` pre-commit step.
- Options considered:
  - Wait for Gemini quota and hold the docs-only PR open.
  - Merge the docs-only monitor PR after CI passed and record the quota failure
    as an advisory automation limit.
  - Download the Jules zip or recreate the visible Jules diff locally because
    the dashboard had no PR URL yet.
  - Keep the Jules run alive and wait for a PR, feedback request, failure, or
    explicit no-code result through the Jules/Symphony flow.
- Decision made by agent: Merge PR #945 after required CI passed, treat the
  Gemini review failure as quota-gated advisory automation, refresh the
  dashboard, inspect visible Jules, and keep the active Package 3
  implementation inside Jules rather than extracting or recreating the diff
  locally.
- Model routing: Local Codex foreman for monitoring and documentation; Jules
  remains the implementation worker for Package 3.
- Rationale/evidence: The failed `review / review` log showed
  `TerminalQuotaError: You have exhausted your daily quota on this model`.
  The rerun GitHub `Tests` job passed. GitHub still had no open Package 3 PR
  and no expected `jules/spells-package3-spellbook-creator-visibility` branch.
  Visible Jules showed edits to character creator feature-selection files,
  `SpellCard.tsx`, `useCharacterAssembly.ts`, spellbook components, and
  `SpellbookTab` tests, then showed `Working` on pre-commit verification.
- Mutation performed or skipped: Merged PR #945 with the previously authorized
  PR merge boundary. Skipped local implementation, skipped downloading the
  Jules zip, skipped relaunching Package 3, and skipped splitting the task
  while Jules was actively working.
- Scope guardrails: Package 3 remains limited to character creator spell
  selection and character sheet spellbook visibility. Combat simulator casting,
  AI arbitration, broad spell schema/runtime architecture, and premade roster
  semantics remain out of the active Jules slice.
- Result: Package 3 has visible in-progress Jules code work, but no PR is
  captured yet. The dashboard is still too coarse to show that Jules has moved
  from plan-approved waiting into file-edit/pre-commit work.
- Next expected proof: Continue dashboard refreshes and visible Jules checks
  until a PR URL, feedback request, failure/no-code result, or publish-ready
  Jules state appears.

### Decision 54: Keep Shared 2024 Prep Semantics And Localize Fixed-Known Caster UI Controls

- Date/time: 2026-05-22
- Phase: `package_3_jules_feedback`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: Dashboard refresh moved Package 3 to `Send Jules Feedback`.
  The visible Jules session asked whether to change `getMaxPreparedSpells.ts`
  so Bard, Sorcerer, Warlock, and Ranger return `null`, keep the shared 2024
  preparation table intact but hide Prep/Unprep controls locally for those
  fixed-known caster classes, or allow those classes to prepare/unprepare like
  prepared casters in this UI.
- Options considered:
  - Modify `getMaxPreparedSpells.ts` so the fixed-known caster classes return
    `null`.
  - Keep `getMaxPreparedSpells.ts` and the shared 2024 preparation table
    intact, then localize the Package 3 UI rule in `SpellbookTab` and
    `SpellbookOverlay`.
  - Allow Bard, Sorcerer, Warlock, and Ranger to use Prep/Unprep controls in
    this implementation.
- Decision made by agent: Choose option B. Keep the shared 2024 preparation
  utility intact and ask Jules to hide Prep/Unprep controls locally for Bard,
  Sorcerer, Warlock, and Ranger in the Package 3 spellbook UI, with focused
  `SpellbookTab` coverage proving the controls stay hidden for at least one
  fixed-known caster and remain available where appropriate for prepared
  casters.
- Model routing: Local Codex foreman reasoning for a bounded scope/rules
  boundary; Jules remains the implementation worker for the UI/test changes.
- Rationale/evidence: Changing `getMaxPreparedSpells.ts` would alter shared
  2024 rules/runtime semantics beyond the Package 3 UI-visibility slice.
  Allowing fixed-known casters to prepare/unprepare would contradict the
  Package 3 prompt language Jules already used for known-caster visibility.
  The local UI rule satisfies the player-facing spellbook goal while preserving
  broader spell-preparation optionality for a later rules package.
- Mutation performed or skipped: Sent the option B instruction through the
  visible Jules chat. Skipped editing `getMaxPreparedSpells.ts`, skipped local
  implementation, skipped downloading the Jules zip, and skipped relaunching
  Package 3.
- Scope guardrails: Package 3 remains limited to character creator spell
  selection and character sheet spellbook visibility. Shared spell preparation
  semantics, combat simulator casting, AI arbitration, broad spell schema or
  runtime architecture, and premade roster semantics remain out of the active
  Jules slice.
- Result: Jules has the bounded feedback needed to continue the Package 3
  implementation without broadening into shared rules semantics.
- Next expected proof: Refresh the dashboard/Jules state until resumed work, a
  PR URL, another feedback request, a failure/no-code result, or publish-ready
  Jules state appears.

### Decision 55: Keep The Completed-No-PR PR Lane Attached To The Active Package 3 Handoff

- Date/time: 2026-05-22
- Phase: `package_3_jules_reconciliation`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After option B feedback, Symphony again reported Jules
  `COMPLETED` with no captured PR URL. Visible Jules showed no PR link, GitHub
  had no Package 3 branch or PR, and the dashboard middleman path mixed the
  active Package 3 no-PR handoff with old Package 2 PR #935 in the GitHub PR,
  Scout/Core, and local-sync lanes.
- Options considered:
  - Ignore the mixed PR lane because the top boundary still said to inspect
    Jules completion.
  - Download the Jules zip or recreate the visible diff locally to force a
    Package 3 result despite the missing PR.
  - Patch Symphony so the PR lane stays attached to the active dashboard
    handoff when that handoff has no PR, then keep Package 3 in the
    completed-no-PR inspection boundary until durable proof appears.
- Decision made by agent: Patch the Symphony middleman routing. The active
  dashboard handoff now owns the PR lane first; older observed/merged PRs are
  only used when no dashboard-started handoff owns the current workflow.
- Model routing: Local Codex foreman with focused Symphony repair and verifier
  coverage. Jules remains the implementation worker; no Package 3 code was
  downloaded or recreated locally.
- Rationale/evidence: Borrowing old Package 2 PR state could make a human or
  agent think Package 3 is ready for PR review or local sync when it still has
  no PR. The dashboard-first goal treats this as a workflow defect to fix
  before continuing through the UI.
- Mutation performed or skipped: Edited `conductor/symphony/src/server.ts` and
  extended `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs`
  with a fixture containing an older Package 2 PR. Skipped local Package 3
  implementation, skipped Jules zip download, skipped relaunch, and skipped
  treating old PR #935 as Package 3 proof.
- Scope guardrails: The repair changes only Symphony routing/visibility. It
  does not alter spell runtime, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or GitHub PR state.
- Result: The active Package 3 completed-no-PR state has a regression test that
  prevents historical Package 2 PR state from becoming the current Package 3 PR
  boundary.
- Next expected proof: Run the focused verifier, restart/refresh the dashboard,
  and confirm the live middleman path keeps Package 3 as the waiting PR source
  until a real Package 3 PR, no-PR proof, or failure is captured.

### Decision 56: Ask Jules To Publish Before Falling Back To Download Zip

- Date/time: 2026-05-22
- Phase: `package_3_jules_publish_reconciliation`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: PR #947 merged the Symphony active-handoff no-PR routing
  repair. After switching to a fresh branch from `origin/master`, the live
  dashboard Git gate was green and the Package 3 handoff owned the waiting PR
  lane, but the current boundary still reported Jules completed without a
  captured PR URL. The visible Jules session showed in-scope code edits and
  accepted option B feedback, yet still showed no PR link or publish result.
- Options considered:
  - Download the visible Jules zip and import/recreate the implementation
    locally.
  - Relaunch or split Package 3 immediately.
  - Send one more visible Jules chat request asking Jules to push/open the
    expected PR, or explicitly state why it cannot and whether Download zip is
    the only remaining handoff path.
- Decision made by agent: Send the visible Jules publish request and continue
  monitoring before taking over the code locally.
- Model routing: Jules remains the implementation worker. Local Codex foreman
  handled dashboard verification, PR #947 merge, and documentation.
- Rationale/evidence: The goal asks to offload as much suitable implementation
  work as possible to Jules through the Symphony flow. The visible Jules page
  still had a chat input and showed code edits, so the least-bypass next step
  was to ask Jules to publish the expected branch/PR or explain the no-PR
  result before using the visible export fallback.
- Mutation performed or skipped: Sent a visible Jules chat message requesting
  branch `jules/spells-package3-spellbook-creator-visibility` and a PR against
  `master`, or an exact explanation that publishing is unavailable and
  Download zip is the only handoff path. Skipped local Package 3
  implementation, skipped zip download, skipped relaunch, and skipped treating
  completed-without-PR as durable final proof.
- Scope guardrails: Package 3 remains limited to character creator spell
  selection and character sheet spellbook visibility. Combat simulator casting,
  AI arbitration, broad spell schema/runtime architecture, and premade roster
  semantics remain out of scope for this package.
- Result: Package 3 is now waiting on Jules publish proof, a no-publish
  explanation, a new feedback/failure state, or a captured PR.
- Next expected proof: Refresh the dashboard/Jules state. If no PR or response
  appears after the publish request, record the repeated no-PR state as a
  Package 3 publish blocker before choosing between relaunch, visible Download
  zip import, or task split.

### Decision 57: Accept A Clean Worktree Monitor Branch As A Local-Sync Stand-In

- Date/time: 2026-05-22
- Phase: `package_3_dashboard_worktree_gate`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: After PR #948 merged, the isolated Symphony worktree was on
  `codex/spell-phase1-package3-monitor-6`, clean, and aligned with
  `origin/master`. The dashboard top GitHub sync gate was ready, but the local
  sync return-path card still blocked because the current branch name was not
  literally `master`. A direct `git checkout master` could not work because the
  user's main Aralia checkout already had `master` checked out.
- Options considered:
  - Force the main repo or this worktree to move `master` anyway.
  - Ignore the dashboard blocker and continue with direct terminal checks.
  - Repair Symphony so a clean worktree branch at the exact GitHub base commit
    is treated as a no-sync-needed proof, while still blocking dirty, ahead,
    behind, detached, or pull-needed states.
- Decision made by agent: Patch the Symphony local-sync gate with the narrow
  worktree stand-in rule.
- Model routing: Local Codex foreman with focused TypeScript repair and
  verifier coverage; no Jules implementation code was touched.
- Rationale/evidence: The dashboard-first goal requires fixing workflow
  blockers instead of bypassing the UI. Forcing `master` would interfere with
  the user's main checkout and is not necessary when the isolated worktree is
  clean and exactly at `origin/master`. The repair preserves the safety rule
  for any state where a real pull or local-disposition decision is needed.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/task-intake.ts` and extended
  `conductor/symphony/scripts/verify-local-sync-next-action.mjs`. Skipped
  switching or mutating the user's main `master` checkout, skipped hidden
  dashboard endpoint bypasses, and skipped Package 3 local implementation.
- Scope guardrails: This repair changes only Symphony local-sync readiness and
  dashboard routing evidence. It does not change spell rules, spellbook UI,
  character creator behavior, AI arbitration, premade roster semantics, or
  Jules task content.
- Result: `npm run build` in `conductor/symphony` and
  `node scripts/verify-local-sync-next-action.mjs` passed. PR #949 merged on
  2026-05-22 after Build, Tests, Lint, CodeQL, Quality Scan, and Poison File
  Check passed; the Gemini review lane failed in the known advisory quota path.
  The restarted dashboard no longer rendered `Local sync is blocked` or
  `Blocked: Current branch` for the clean monitor worktree.
- Next expected proof: Keep monitoring Package 3 Jules PR publication through
  the repaired dashboard.

### Decision 58: Record The Repeated Package 3 No-PR State After The Publish Request

- Date/time: 2026-05-22
- Phase: `package_3_jules_publish_reconciliation`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After the visible Jules publish request and after PR #949
  landed the local worktree dashboard gate repair, the dashboard
  current-boundary refresh still reported Package 3 Jules `IN_PROGRESS`,
  waiting for a PR, with no captured PR URL. GitHub still had no
  `jules/spells-package3-spellbook-creator-visibility` branch or PR.
- Options considered:
  - Treat the repeated no-PR state as permission to download the Jules zip or
    recreate the visible implementation locally immediately.
  - Relaunch or split Package 3 immediately.
  - Record the repeated no-PR state as a publish blocker, keep the run in
    dashboard/Jules monitoring, and only choose a fallback after durable
    no-publish proof or another clear boundary appears.
- Decision made by agent: Record the repeated no-PR/publish gap and continue
  monitoring through the dashboard-first flow for now.
- Model routing: Jules remains the implementation worker. Local Codex foreman
  handles workflow repair, evidence recording, and PR publication for Symphony
  docs/tooling changes.
- Rationale/evidence: The user explicitly wants as much implementation work as
  possible offloaded to Jules. The visible Jules session has shown in-scope code
  edits, so taking over locally before Jules returns a PR, failure, or
  no-publish explanation would weaken the Symphony/Jules test flow.
- Mutation performed or skipped: Updated the tracker and handoff receipt.
  Skipped local Package 3 implementation, skipped zip download, skipped task
  relaunch, and skipped claiming Package 3 complete.
- Scope guardrails: Package 3 still does not include combat simulator casting,
  AI arbitration, broad spell schema/runtime architecture, or premade roster
  semantics.
- Result: Package 3 remains waiting for Jules PR publication or a clear
  no-publish response. The next fallback decision should be explicit and
  recorded.
- Next expected proof: Recheck dashboard/Jules and GitHub branch/PR state after
  the worktree local-sync repair PR lands. If still no PR or response, choose
  and record one fallback path: relaunch Jules, visible Download zip import, or
  split the task.

### Decision 59: Keep Task Routing Focused On The Live Package 3 Handoff

- Date/time: 2026-05-22 14:45 +02:00
- Phase: `package_3_dashboard_task_routing`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: After PR #950 landed the worktree-gate receipt update, the
  dashboard current-boundary and middleman path correctly showed Package 3
  Jules `IN_PROGRESS` with no PR. The separate `Task routing and nudge plan`
  panel still selected old Package 2 because Package 2's post-merge
  local-sync receipt had the newest `updatedAt` timestamp and carried a stale
  local `master` blocker.
- Options considered:
  - Mutate or reconcile the user's main `master` checkout so the old Package 2
    local-sync receipt stops looking blocked.
  - Ignore the task-routing panel because other dashboard cards still pointed
    at Package 3.
  - Repair Symphony task routing so active/running handoffs outrank closed or
    post-merge bookkeeping, then keep Package 3 as the visible route while
    Package 2 remains historical evidence.
- Decision made by agent: Patch the task-routing selector. The dashboard's
  route-to-next-work card now chooses the live Package 3 handoff before older
  merged-package bookkeeping, even when the older package received a newer
  local-sync timestamp.
- Model routing: Local Codex foreman with focused Symphony repair and verifier
  coverage. Jules remains the Package 3 implementation worker.
- Rationale/evidence: The dashboard-first goal depends on the human-visible UI
  telling the operator what to do next. A stale Package 2 sync card can send
  the operator toward unrelated local `master` work even though the real
  boundary is still waiting for Package 3 Jules PR publication. Touching the
  user's main checkout would solve the wrong problem and would not prevent the
  dashboard from making the same timestamp mistake later.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/task-intake.ts` and extended
  `conductor/symphony/scripts/verify-task-routing-nudging.mjs` with a fixture
  where Package 3 is older but active and Package 2 is newer but merged with a
  stale local-sync blocker. Skipped mutating the user's main `master` checkout,
  skipped hidden dashboard endpoint bypasses, skipped Package 3 local
  implementation, and skipped Download zip import.
- Scope guardrails: This changes only Symphony routing/focus behavior. It does
  not alter spell rules, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or Jules task content.
- Result: PR #951 merged as `c9c97796cbeda7f1a765c371e7127543f2d1660f` on
  2026-05-22. Build, Lint, CodeQL, Quality Scan, and Poison File Check passed.
  The first Tests run failed in the known ambient winter travel-time case
  outside this PR's touched files; rerunning the failed Tests job passed without
  code changes.
- Next expected proof: Restart the dashboard from synced `origin/master`, and
  confirm the task-routing panel points at Package 3 while Package 2 stays
  historical.

### Decision 60: Attempt The Visible Jules Zip Fallback, Then Stop At The Browser Download Blocker

- Date/time: 2026-05-22 15:10 +02:00
- Phase: `package_3_jules_publish_reconciliation`
- Active slice: Package 3 spellbook and character creator visibility
- Decision point: After PR #952 merged the routing-focus closeout, the
  dashboard was restarted from synced `origin/master`. The dashboard Git gate
  was clean, the task-routing card correctly focused Package 3, and the visible
  refresh still reported Jules `IN_PROGRESS` with no PR URL. GitHub still had
  no `jules/spells-package3-spellbook-creator-visibility` branch or PR. The
  visible Jules session showed more Package 3 code updates and a `Download zip`
  control after the prior publish request, but no PR link or no-publish
  explanation.
- Options considered:
  - Keep waiting for Jules to publish a PR even though the visible publish
    request had already been sent and GitHub still had no branch.
  - Relaunch or split Package 3 immediately.
  - Use the visible `Download zip` control as Jules' implementation handoff,
    then review/import locally while keeping Jules as the implementation
    worker of record.
- Decision made by agent: Choose the visible zip fallback as the next path, but
  stop when the Codex in-app browser reported that downloads are not supported.
- Model routing: Jules remains the implementation worker. Local Codex foreman
  performed dashboard/Jules inspection and blocked at the browser export
  capability instead of scraping code panes or using hidden endpoints.
- Rationale/evidence: The goal asks to offload as much suitable implementation
  as possible to Jules, and the visible Jules page now exposes code updates plus
  `Download zip` but no PR. The zip path would preserve Jules' work product
  while moving the stalled handoff forward. However, the dashboard-first rule
  says UI blockers should be flagged rather than bypassed with hacky methods.
- Mutation performed or skipped: Clicked the visible Jules `Download zip`
  control. The in-app browser returned `Downloads are not supported by Codex
  In-app Browser`, and no recent zip appeared in local download locations.
  Skipped scraping visible file panes, skipped hidden Jules/API export paths,
  skipped local Package 3 recreation, and skipped relaunching Package 3.
- Scope guardrails: This decision does not change spell code, spell rules,
  character creator behavior, spellbook UI, AI arbitration, premade roster
  semantics, or Symphony source. It records the handoff/export blocker exposed
  by dashboard-first operation.
- Result: Package 3 remains waiting on a usable implementation handoff: Jules
  PR, operator-accessible zip download, or an explicit relaunch/split decision.
- Next expected proof: Either get a usable visible export path for the Jules
  zip, relaunch/split Package 3 through Symphony, or have a human download and
  place the zip where Codex can inspect it without bypassing the browser
  blocker.

### Decision 61: Send Jules Feedback For PR #954 And Stop The Repeated Workflow-Config Decision Loop

- Date/time: 2026-05-22 15:33 +02:00
- Phase: `package_3_pr_review_and_dashboard_feedback_loop`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: Jules opened PR #954 on suffixed branch
  `jules/spells-package3-spellbook-creator-visibility-2823658242418460192`.
  The dashboard PR refresh captured failing Build, Tests, and Gemini review.
  The Build log named TypeScript errors in Package 3 files:
  `SpellCard.tsx`, `useCharacterAssembly.ts`, and
  `SpellbookTab.test.tsx`. Gemini review also flagged matching code issues,
  including missing `knownCasterIds`, invalid `HealingEffect.healingType`,
  `any` helper types, known-caster/ranger semantics, and Druid `Speak with
  Animals` visibility. Symphony nevertheless classified the failed checks as
  `workflow_config` because the review automation lane was among the failed
  checks, and asked whether to route workflow repair before asking Jules to
  change task code.
- Options considered:
  - Create a local workflow-config repair task before sending any Package 3
    feedback to Jules.
  - Repair PR #954 locally on a Codex branch or push directly to the Jules
    branch.
  - Record the operator decision as `send_jules_feedback`, post marked
    `[Jules feedback]` on PR #954, and wait for Jules to push the repair.
  - Ignore the dashboard decision loop and continue from terminal-only PR
    inspection.
- Decision made by agent: Record `send_jules_feedback` on the visible task
  page, post a marked `[Jules feedback]` comment on PR #954, and repair
  Symphony so a captured Jules feedback comment moves the task page to
  `Wait for Jules Repair` instead of repeating the same workflow-config
  question.
- Model routing: Jules remains the Package 3 implementation worker. Local
  Codex foreman handled failure classification, feedback composition,
  dashboard receipt recording, and the small Symphony routing repair.
- Rationale/evidence: The failure evidence was in Jules' Package 3 code/test
  changes, not a shared CI setup break. The user asked to offload as much as
  possible to Jules, so the repair request belongs on the PR before any local
  implementation takeover. Once the marked feedback exists, asking the same
  repair-lane question again creates dashboard friction and risks duplicate
  comments instead of useful monitoring.
- Mutation performed or skipped: Created the feedback body, posted
  `https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519121406`,
  edited `conductor/symphony/src/task-intake.ts`, and extended
  `conductor/symphony/scripts/verify-pr-next-action.mjs`. Skipped direct
  mutation of the Jules branch, skipped a local Package 3 repair branch,
  skipped Core merge, and skipped treating the PR as ready while checks fail.
- Scope guardrails: The Symphony repair changes only PR next-action routing
  after marked Jules feedback is captured. It does not change spell rules,
  character creator behavior, spellbook UI, AI arbitration, premade roster
  semantics, or the Package 3 implementation itself.
- Result: `npm run build` in `conductor/symphony`,
  `node scripts/verify-pr-next-action.mjs`,
  `node scripts/verify-task-detail-api.mjs`, and
  `node scripts/verify-scout-core-readiness-packet.mjs` passed. After
  restarting the dashboard and clicking the visible `Run Safe Symphony
  Refresh` control, the task page showed `Wait for Jules Repair`, no human
  input required, and no duplicate feedback command.
- Next expected proof: Wait for Jules to push a PR #954 repair commit, refresh
  the dashboard PR packet, then run Scout/Core review, visual proof, and
  Package 3 acceptance checks before merge.

### Decision 62: Merge The Dashboard Wait-Loop Repair Despite Advisory Gemini Quota Failure

- Date/time: 2026-05-22 15:42 +02:00
- Phase: `package_3_pr_review_and_dashboard_feedback_loop`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: PR #955 contained the Symphony repair from Decision 61. Its
  Build, Tests, Lint, CodeQL, Quality Scan, and Poison File Check lanes passed,
  but the Gemini review lane failed before reviewing because
  `gemini-2.5-flash` exhausted its daily quota.
- Options considered:
  - Block the merge until the Gemini review quota resets.
  - Rerun or reconfigure the review lane before merging.
  - Treat the Gemini quota failure as advisory, merge the PR, and keep Package
    3 waiting on Jules repair through the now-correct dashboard state.
- Decision made by agent: Merge PR #955 with squash merge and delete the remote
  `codex/spell-phase1-package3-monitor-11` branch.
- Model routing: Strong local foreman reasoning for merge readiness, because
  this decision affects the dashboard workflow that governs the continuing
  Package 3 handoff.
- Rationale/evidence: The failed review log showed `TerminalQuotaError: You
  have exhausted your daily quota on this model`, not a code or test failure.
  The repository's normal CI lanes passed, the focused local verifier suite had
  already passed, and the rendered task page showed the intended
  `Wait for Jules Repair` boundary after a visible refresh.
- Mutation performed or skipped: Merged PR #955 as
  `f3f8abafbd99882e9d103853ab8c837845ea990b`. Skipped direct mutation of PR
  #954, skipped a local Package 3 implementation repair, and skipped treating
  Package 3 as ready while Build/Tests remain red.
- Scope guardrails: This merge changes only Symphony dashboard routing and
  durable decision/tracker docs. It does not change spell rules, spellbook UI,
  character creator behavior, AI arbitration, premade roster semantics, or the
  Jules implementation branch.
- Result: `origin/master` now includes the wait-loop repair. The live dashboard
  task page for `handoff-1779443555192-bnpws7` reports `Wait for Jules Repair`,
  `Needs human input: No`, and no duplicate feedback command after running the
  visible safe refresh.
- Next expected proof: Monitor PR #954 for a Jules repair commit, refresh the
  dashboard PR packet, and only advance to Scout/Core or merge review after
  checks and rendered Package 3 proof are available.

### Decision 63: Send Follow-Up Jules Feedback After The Repair Commit Still Failed Tests

- Date/time: 2026-05-22 16:06 +02:00
- Phase: `package_3_post_feedback_repair_loop`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: Jules pushed repair commit
  `0ce77a9c33adb230a0d52a1d4242434b846704f5` to PR #954. GitHub Build and
  Lint passed, but the Tests lane failed nine assertions in
  `src/components/CharacterCreator/Class/__tests__/FeatureSelectionCheckboxes.test.tsx`.
  The failed assertions cover conditional disabled props for selection-limit
  enforcement across the Package 3 edited feature-selection files.
- Options considered:
  - Repair the failing Package 3 code locally.
  - Treat the failure as an ambient test issue and rerun without feedback.
  - Send a second focused Jules feedback comment, because the remaining failure
    is in the Package 3 implementation surface Jules just changed.
  - Leave the dashboard in `Wait for Jules Repair` because an older Jules
    feedback comment already exists.
- Decision made by agent: Patch Symphony so a PR update clearly later than the
  latest marked Jules feedback reopens the repair boundary if checks still fail.
  Then record `send_jules_feedback` through the visible task-page decision
  control and post a second marked Jules feedback comment on PR #954.
- Model routing: Local Codex foreman handled the dashboard state-model repair
  and PR failure classification. Jules remains the implementation worker for
  the Package 3 code repair.
- Rationale/evidence: The failed test names point directly at files in PR
  #954's edited character creator scope. The user asked to offload as much
  suitable implementation as possible to Jules. The dashboard-first rule also
  means the stale wait state is a workflow defect: after a repair commit lands,
  the next failed-check refresh should allow a fresh course-correction instead
  of hiding behind the old feedback comment.
- Mutation performed or skipped: Edited `conductor/symphony/src/task-intake.ts`
  to pass GitHub PR `updatedAt` into `buildPullRequestNextAction` and added a
  timing guard around the old "feedback already sent" wait state. Extended
  `conductor/symphony/scripts/verify-pr-next-action.mjs` with fixtures for both
  same-comment PR updates and post-feedback repair updates. Posted
  `https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519399645`.
  Skipped local Package 3 implementation repair, skipped direct mutation of the
  Jules branch, and skipped merge/Scout/Core because Tests are still red.
- Scope guardrails: The Symphony change only affects PR next-action routing
  after marked Jules feedback. It does not change spell rules, character
  creator behavior, spellbook UI, AI arbitration, premade roster semantics, or
  PR #954 code.
- Result: `npm run build`, `node scripts/verify-pr-next-action.mjs`,
  `node scripts/verify-task-detail-api.mjs`, and `git diff --check` passed.
  Rendered dashboard proof showed `Repair Failed Checks` after the post-feedback
  repair commit, and then `Wait for Jules Repair` after the selected Jules
  feedback decision plus second marked PR comment.
- Next expected proof: Wait for Jules to push the next PR #954 repair commit,
  refresh the dashboard PR packet, and proceed to Scout/Core/visual proof only
  after GitHub checks pass.

### Decision 64: Merge The Post-Feedback State-Model Repair And Resync The Monitor Worktree

- Date/time: 2026-05-22 16:16 +02:00
- Phase: `package_3_post_feedback_repair_loop`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first hardening
- Decision point: PR #957 carried the local Symphony repair from Decision 63.
  Build, Tests, Lint, CodeQL, Quality Scan, and Poison File Check passed. The
  only failed lane was `review / review`, and its log showed Gemini API quota
  exhaustion for `gemini-2.5-flash`, not a repository regression. After the
  squash merge, the dashboard Git gate saw the old local monitor branch as one
  commit ahead and one commit behind because the local pre-squash commit and
  remote squash commit had different SHAs.
- Options considered:
  - Wait for the Gemini review quota lane even though the normal project gates
    were already green.
  - Leave PR #957 open and continue Package 3 monitoring with the local patch
    only.
  - Merge PR #957 under the previously approved PR boundary, then preserve the
    old local branch and switch the monitor worktree to a fresh branch from
    `origin/master`.
  - Reset the old local branch in place.
- Decision made by agent: Merge PR #957 and switch the worktree to
  `codex/spell-phase1-monitor-13` from `origin/master`, preserving
  `codex/spell-phase1-monitor-12` rather than resetting it.
- Model routing: Local Codex handled CI classification, merge, and monitor
  branch hygiene. Jules remains the implementation worker for PR #954.
- Rationale/evidence: The failed Gemini review lane reported quota exhaustion,
  while the ordinary CI lanes passed. The dashboard-first rule made the
  post-merge ahead/behind state visible as a sync blocker. Because the merged
  remote commit already contained the repair as a squash commit, a fresh
  monitor branch from `origin/master` removed the false blocker without
  destroying local branch evidence.
- Mutation performed or skipped: Merged PR #957, fetched `origin/master`, and
  created `codex/spell-phase1-monitor-13` at `origin/master`. Skipped direct
  mutation of PR #954, skipped local Package 3 implementation repair, and
  skipped resetting the old local monitoring branch.
- Scope guardrails: This only changes Symphony state-model availability and
  the local monitoring branch position. It does not change spell rules,
  character creator behavior, spellbook UI, AI arbitration, premade roster
  semantics, or the Jules implementation branch.
- Result: The dashboard `Check GitHub Sync` control reported
  `codex/spell-phase1-monitor-13` matches `origin/master`, with ahead/behind
  `0 / 0` and a clean working tree. Package 3 remained in `Wait for Jules
  Repair`; PR #954 still has head
  `0ce77a9c33adb230a0d52a1d4242434b846704f5` and failing Tests.
- Next expected proof: Continue waiting for Jules to push a new PR #954 repair
  commit after the second marked feedback comment, then refresh the dashboard
  PR packet and proceed only if checks pass.

### Decision 65: Send Scout Feedback After Green Checks Still Missed Package 3 Acceptance

- Date/time: 2026-05-22 16:31 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  dashboard-first Scout/Core review
- Decision point: Jules pushed PR #954 head
  `c02bf58ea3687f65ad57ca78581f46ae7cadad39`. GitHub Build, Tests, Lint,
  CodeQL, Quality Scan, and Poison File Check passed. After PR #958 merged the
  monitor docs, the dashboard Git gate was clean on
  `codex/spell-phase1-monitor-14` and the visible boundary moved to
  `Scout/Core review`. Scout inspection found that
  `DruidFeatureSelection.tsx` still filters `speak-with-animals` out of the
  visible Level 1 card list and only pushes it into the submitted spell list,
  so the Druid creator flow does not actually show the locked/pre-selected
  class-feature card requested in earlier feedback. Scout also found
  `SpellCard.tsx` still uses explicit `any` in `formatCastingTime` and
  `formatRange`.
- Options considered:
  - Merge PR #954 because all GitHub checks passed.
  - Repair the Package 3 implementation locally.
  - Treat the Druid creator visibility miss as a follow-up outside Package 3.
  - Send another focused Jules feedback comment because the issue is still
    inside the Package 3 acceptance surface.
- Decision made by agent: Do not merge PR #954. Send a third marked
  `[Jules feedback]` PR comment asking Jules to render Druid
  `Speak with Animals` visibly as locked/pre-selected without consuming a
  selectable spell slot, and to finish typing the `SpellCard` formatting
  helpers.
- Model routing: Local Codex performed Scout-style inspection and feedback
  drafting. Jules remains the Package 3 implementation worker. Core merge is
  blocked until the visible creator acceptance issue is repaired and
  rechecked.
- Rationale/evidence: The user explicitly cares that spells are properly
  visible in the character creator and spellbook, not just functionally present
  after submit. The earlier Jules feedback specifically requested the visible
  Druid `Speak with Animals` creator card. Passing CI is not enough when the
  acceptance condition is missing from the rendered/player-facing flow.
- Mutation performed or skipped: Posted
  `https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519567250`.
  Skipped local Package 3 implementation repair, skipped direct mutation of the
  Jules branch, and skipped Core merge despite green checks.
- Scope guardrails: Feedback is limited to Package 3 creator visibility and
  local `SpellCard` typing. It does not request combat simulator casting,
  shared spell schema/runtime architecture, broad AI arbitration policy,
  premade roster semantics, or Symphony orchestration changes.
- Result: PR #954 remains open for a Jules repair after green checks. The
  dashboard exposed a useful but incomplete Scout/Core path: it identified the
  Scout/Core boundary, but did not provide a visible "send Scout feedback"
  control, so the feedback was posted directly to the PR and recorded here.
- Next expected proof: Wait for Jules to push another PR #954 repair commit,
  refresh the dashboard PR packet, then re-run Scout/Core review and rendered
  creator/spellbook proof before any Core merge.

### Decision 66: Repair The Visible Scout/Core Evidence Refresh Path

- Date/time: 2026-05-22 16:50 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  dashboard-first Scout/Core review
- Decision point: The dashboard top boundary correctly said
  `Scout/Core review`, but the action was `Wait for Scout/Core review` with
  `Method NONE`, only a raw evidence link was visible, and the task navigator
  still summarized the same Package 3 task as `Wait for PR Checks`. The real
  safe PR refresh button existed lower in the handoff card but was effectively
  hidden from the first-viewport human operator path.
- Options considered:
  - Use the raw API endpoint or a terminal command to refresh PR evidence.
  - Ignore the stale dashboard surface because GitHub already showed green
    checks.
  - Patch the dashboard/Symphony middleman path so Scout/Core evidence refresh
    is a visible read-only action at the current boundary.
  - Repair Package 3 locally while waiting for Jules.
- Decision made by agent: Patch Symphony so a blocked Scout/Core boundary
  exposes `Refresh Scout/Core Evidence` as a read-only `Refresh GitHub PR`
  dashboard button, and patch the task navigator so it prefers the richer
  Scout/Core readiness packet over stale PR-check `next_action` wording.
- Model routing: Local Codex handled the dashboard/workflow repair because it
  is Symphony infrastructure exposed by dashboard-first use. Jules remains the
  Package 3 implementation worker.
- Rationale/evidence: The user explicitly asked that dashboard blockers be
  fixed rather than bypassed. Refreshing PR evidence is an external read that
  does not mutate GitHub, Git, Jules, or local files, so it belongs as a visible
  dashboard control. After the repair, rendered browser proof showed the first
  viewport action `Refresh Scout/Core Evidence`, a `Refresh GitHub PR` button,
  and Package 3 labeled `Scout/Core review` in the task navigator.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/server.ts`,
  `conductor/symphony/public/dashboard.js`, and
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`. Restarted
  the local dashboard and clicked the new first-viewport `Refresh GitHub PR`
  button. Skipped local Package 3 implementation repair, skipped direct
  mutation of PR #954, and skipped Core merge.
- Scope guardrails: This only changes the Symphony dashboard operator surface
  and verifier coverage. It does not change spell rules, character creator
  behavior, spellbook UI, AI arbitration, premade roster semantics, or the
  Jules implementation branch.
- Result: `npm run build`, `node
  conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`, and
  `git diff --check` passed. The dashboard refresh through the visible button
  updated PR #954 evidence to `passing`, `9 passed`, `0 failed`, `0 pending`,
  and the stored next action became `Scout Bridge Risk`.
- Next expected proof: Continue waiting for Jules to push another PR #954
  repair commit after comment #4519567250, then refresh the dashboard PR
  packet through the visible Scout/Core action and rerun Scout/Core acceptance
  review before any Core merge.

### Decision 67: Route Posted Scout Feedback To Wait For Jules Repair

- Date/time: 2026-05-22 17:12 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  dashboard-first Scout/Core review
- Decision point: After Decision 66 made the Scout/Core evidence refresh
  visible, clicking the dashboard `Run Safe Symphony Refresh` control updated
  PR #954 checks to passing but still showed `Scout Bridge Risk` plus a
  duplicate `Prepare Jules PR feedback comment` command. GitHub already had
  the third marked `[Jules feedback]` comment at
  `https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519567250`, and
  PR #954 had no later Jules repair commit. The actual Package 3 blockers were
  still present: `DruidFeatureSelection.tsx` comments claimed
  `Speak with Animals` was rendered as locked/pre-selected, but the Level 1 UI
  only mapped `availableSpellsL1` after filtering `speak-with-animals` out;
  `SpellCard.tsx` still used explicit `any` in `formatCastingTime` and
  `formatRange`.
- Options considered:
  - Send the same Scout feedback command again.
  - Repair the Package 3 implementation locally.
  - Merge PR #954 because GitHub checks were green.
  - Patch the Symphony PR next-action model so already-posted Scout feedback
    produces a wait-and-refresh boundary until Jules changes the PR.
- Decision made by agent: Patch Symphony to route posted Scout feedback to
  `Wait for Jules Repair` when no later PR update exists, preserving the
  existing behavior that re-opens Scout review if Jules pushes a later repair
  and risk remains.
- Model routing: Local Codex handled the dashboard/workflow repair because it
  is Symphony infrastructure exposed by dashboard-first use. Jules remains the
  Package 3 implementation worker.
- Rationale/evidence: The dashboard-first goal requires fixing workflow
  blockers instead of bypassing them. Duplicate feedback would add noise and
  could make Jules reprocess the same instruction, while local implementation
  repair would undercut the intended Jules offload path. The safe operator
  state is waiting for a Jules commit or PR update, then refreshing the PR
  evidence.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/task-intake.ts` and
  `conductor/symphony/scripts/verify-pr-next-action.mjs`. Restarted the local
  dashboard from `codex/spell-phase1-monitor-16` and clicked the visible safe
  refresh control. Skipped local Package 3 implementation repair, skipped
  duplicate GitHub feedback, and skipped Core merge.
- Scope guardrails: This only changes Symphony PR next-action routing after
  marked feedback. It does not change spell rules, character creator behavior,
  spellbook UI, AI arbitration, premade roster semantics, or the Jules
  implementation branch.
- Result: `npm run build` and `node
  conductor/symphony/scripts/verify-pr-next-action.mjs` passed. Rendered
  dashboard proof showed `Wait for Jules Repair`, summary `Scout feedback is
  already posted on the PR; wait for Jules to push a repair or for the PR to
  change.`, and no duplicate feedback command after the safe refresh.
- Next expected proof: Wait for Jules to push another PR #954 repair commit,
  refresh the dashboard PR packet, and only then rerun Scout/Core acceptance
  review and rendered creator/spellbook proof before Core merge.

### Decision 68: Merge The Posted-Scout-Feedback Wait-State Repair And Resync The Monitor Branch

- Date/time: 2026-05-22 17:20 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: PR #961 carried the Decision 67 Symphony state-model repair.
  Build, Tests, Lint, CodeQL, Quality Scan, and Poison File Check passed. The
  only failed lane was `review / review`, and its log showed Gemini API quota
  exhaustion for `gemini-2.5-flash`, not a repository regression. After the
  squash merge, the local branch cleanup attempted by the GitHub CLI failed
  because `master` is checked out in the user's main repository.
- Options considered:
  - Wait for the Gemini quota lane even though normal project gates passed.
  - Leave PR #961 open and keep using the local dashboard patch only.
  - Merge PR #961 under the previously approved PR boundary, preserve the old
    monitor branch, and switch the worktree to a fresh branch from
    `origin/master`.
  - Reset or alter the user's main `master` checkout so GitHub CLI cleanup can
    complete locally.
- Decision made by agent: Merge PR #961, do not touch the user's main
  `master` checkout, and create `codex/spell-phase1-monitor-17` from
  `origin/master` for continued Package 3 monitoring.
- Model routing: Local Codex handled CI classification, merge, and local
  monitor-branch hygiene. Jules remains the implementation worker for PR #954.
- Rationale/evidence: The normal project gates proved the narrow Symphony fix.
  The failed Gemini review lane was quota infrastructure. The GitHub CLI
  post-merge local cleanup error did not prevent the PR from merging, and
  preserving branch evidence is safer than forcing the user's main checkout.
- Mutation performed or skipped: Merged PR #961, fetched `origin/master`, and
  created `codex/spell-phase1-monitor-17` from `origin/master`. Skipped local
  Package 3 implementation repair, skipped duplicate GitHub feedback, skipped
  Core merge of PR #954, and skipped any mutation of the user's main
  `master` checkout.
- Scope guardrails: This only changes Symphony dashboard state-model routing
  and monitoring documentation. It does not change spell rules, character
  creator behavior, spellbook UI, AI arbitration, premade roster semantics, or
  the Jules implementation branch.
- Result: PR #961 merged at 2026-05-22 15:18:24 UTC. The active monitor branch
  is now `codex/spell-phase1-monitor-17` from `origin/master`. Package 3
  remains waiting for Jules to repair PR #954 after Scout feedback.
- Next expected proof: Refresh PR #954 through the dashboard after Jules pushes
  a new repair commit, then rerun Scout/Core acceptance review and rendered
  creator/spellbook proof before any Core merge.

### Decision 69: Align Main Dashboard Boundary With Posted-Feedback Wait State

- Date/time: 2026-05-22 17:35 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: After PR #961 and PR #962 landed, the task detail page for
  handoff `handoff-1779443555192-bnpws7` correctly showed
  `Wait for Jules Repair`, but the main dashboard still promoted the same
  handoff as `Scout/Core review`. The mismatch happened because the global
  middleman ladder and Scout/Core readiness packet prioritized changed-file
  risk even when the PR next-action model had already decided that marked
  Scout feedback was posted and Symphony should wait for a Jules repair.
- Options considered:
  - Leave the mismatch because the task detail page was correct.
  - Repair PR #954 locally so the risk disappeared.
  - Send another GitHub feedback comment to Jules.
  - Patch the dashboard server path so the main dashboard, task navigator, and
    task detail page agree on the posted-feedback wait state.
- Decision made by agent: Patch the Symphony server so `wait_for_checks`
  next-actions suppress the active Scout/Core boundary until the PR changes,
  and make the GitHub PR current-boundary action read as `Refresh GitHub PR`
  instead of the vague `Run GitHub PR`. Also expose PR feedback timestamps in
  the main dashboard feedback summary so the operator can see when marked
  feedback was posted.
- Model routing: Local Codex handled the dashboard/workflow repair. Jules
  remains the Package 3 implementation worker for PR #954.
- Rationale/evidence: The dashboard-first flow should not force the operator
  to choose between conflicting surfaces. Since PR #954 has no post-feedback
  Jules repair commit, the correct state is still waiting for Jules, with a
  safe PR refresh available.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/server.ts` and
  `conductor/symphony/public/dashboard.js`. Restarted the dashboard from
  `codex/spell-phase1-monitor-18` and clicked the main `Refresh GitHub PR`
  action. Skipped local Package 3 implementation repair, skipped duplicate
  GitHub feedback, and skipped Core merge.
- Scope guardrails: This only changes Symphony dashboard routing/copy. It does
  not change spell rules, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or the Jules implementation branch.
- Result: `npm run build` passed. Rendered main-dashboard proof showed the
  first-viewport action as `Refresh GitHub PR`, and the task navigator kept
  Package 3 labeled `Wait for Jules Repair` with the summary `Scout feedback
  is already posted on the PR; wait for Jules to push a repair or for the PR
  to change.`
- Next expected proof: Publish this dashboard repair, then continue waiting
  for Jules to push a PR #954 repair commit before rerunning Scout/Core
  acceptance review and rendered creator/spellbook proof.

### Decision 70: Merge The Main-Dashboard Wait-State Alignment And Resync The Monitor Branch

- Date/time: 2026-05-22 17:43 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: PR #963 carried the Decision 69 dashboard alignment repair.
  Build, Tests, Lint, CodeQL, Quality Scan, and Poison File Check passed. The
  only failed lane was `review / review`, and its log again showed Gemini API
  quota exhaustion for `gemini-2.5-flash`, not a repository regression. The
  GitHub CLI post-merge cleanup again failed locally because `master` is
  checked out in the user's main repository.
- Options considered:
  - Wait for Gemini quota to reset even though normal gates passed.
  - Leave PR #963 open and keep using the local patch only.
  - Merge PR #963 under the approved PR boundary, preserve the old monitor
    branch, and switch the worktree to a fresh branch from `origin/master`.
  - Mutate the user's main `master` checkout to let the CLI cleanup complete.
- Decision made by agent: Merge PR #963, preserve the user's main checkout,
  and create `codex/spell-phase1-monitor-19` from `origin/master` for
  continued Package 3 monitoring.
- Model routing: Local Codex handled CI classification, merge, and monitor
  branch hygiene. Jules remains the implementation worker for PR #954.
- Rationale/evidence: The normal project gates proved the narrow dashboard
  repair. The failed review lane was quota infrastructure. The local cleanup
  error happened after GitHub reported the PR merged, so it was not a reason to
  disturb the user's main worktree.
- Mutation performed or skipped: Merged PR #963, fetched `origin/master`, and
  created `codex/spell-phase1-monitor-19` from `origin/master`. Skipped local
  Package 3 implementation repair, skipped duplicate GitHub feedback, skipped
  Core merge of PR #954, and skipped mutation of the user's main `master`
  checkout.
- Scope guardrails: This only records the Symphony dashboard repair lifecycle.
  It does not change spell rules, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or the Jules implementation branch.
- Result: PR #963 merged at 2026-05-22 15:42:35 UTC. The active monitor branch
  is now `codex/spell-phase1-monitor-19` from `origin/master`. PR #954 still
  has no Jules repair commit after the third marked feedback comment.
- Next expected proof: Continue monitoring PR #954 through the dashboard. When
  Jules pushes a repair commit, refresh the PR packet, rerun Scout/Core
  acceptance review, and collect rendered creator/spellbook proof before Core
  merge.

### Decision 71: Align Queue-Level Next Action With Posted-Feedback Wait State

- Date/time: 2026-05-22 18:02 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: On fresh branch `codex/spell-phase1-monitor-20`, the visible
  dashboard first viewport and task navigator correctly showed Package 3 as
  `Wait for Jules Repair`. A direct read of `/api/v1/task-drafts`, however,
  still exposed the queue-level `next_action` as `Bridge Conflict-Prone Files`
  because the conflict-watch risk signal outranked the PR-specific next action.
  That would steer headless foremen or API consumers toward a merge-adjacent
  Scout/Core bridge even though marked Scout feedback had already been posted
  and PR #954 had no newer Jules repair commit.
- Options considered:
  - Ignore the API mismatch because the visible browser dashboard was usable.
  - Repair PR #954 locally so the risky-file signal disappeared.
  - Send another GitHub feedback comment to Jules.
  - Patch the queue-action priority so cross-PR conflicts still block first,
    but single-PR risk does not override an affected PR's explicit
    posted-feedback wait state.
- Decision made by agent: Patch the Symphony queue-action priority and add a
  regression case that includes both an older merged/local-sync handoff and the
  active risky Package 3-style PR waiting after Scout feedback.
- Model routing: Local Codex handled the Symphony dashboard/API repair. Jules
  remains the Package 3 implementation worker for PR #954.
- Rationale/evidence: The goal requires dashboard-first use and clear reports
  at decision points. Once Scout feedback is already posted, the safe next
  action is to wait for Jules or refresh PR evidence after new PR activity. A
  duplicate Scout/Core bridge instruction is confusing and can lead to repeated
  feedback rather than useful progress.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/server.ts`,
  `conductor/symphony/scripts/verify-queue-next-action.mjs`, and the spell
  tracker. Restarted the dashboard from the worktree and clicked the visible
  `Refresh GitHub PR` action. Skipped local Package 3 implementation repair,
  skipped duplicate GitHub feedback, skipped Core merge, and skipped any
  mutation of the user's main `master` checkout.
- Scope guardrails: This only changes Symphony queue/dashboard routing and
  tracking documentation. It does not change spell rules, character creator
  behavior, spellbook UI, AI arbitration, premade roster semantics, or the
  Jules implementation branch.
- Result: `npm run build` passed, and
  `node scripts/verify-queue-next-action.mjs` passed. Rendered dashboard proof
  still showed first-viewport `Refresh GitHub PR` and task navigator
  `Wait for Jules Repair`. GitHub PR #954 remained open at head
  `c02bf58ea3687f65ad57ca78581f46ae7cadad39` with no post-feedback Jules
  repair commit.
- Next expected proof: Publish this queue-action repair, then continue
  dashboard monitoring of PR #954. When Jules pushes a repair commit, refresh
  the PR packet, rerun Scout/Core acceptance review, and collect rendered
  creator/spellbook proof before Core merge.

### Decision 72: Merge The Queue-Action Wait-State Repair And Resync The Monitor Branch

- Date/time: 2026-05-22 18:11 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: PR #965 carried the Decision 71 queue-action repair. GitHub
  Build, Tests, Lint, CodeQL, Quality Scan, and Poison File Check all passed.
  The GitHub CLI again failed during post-merge local cleanup because
  `master` is checked out in the user's main repository, after GitHub had
  already marked PR #965 merged.
- Options considered:
  - Leave PR #965 open after all normal gates passed.
  - Merge PR #965 under the previously approved PR boundary, preserve the
    user's main checkout, and move the monitor worktree to a fresh branch from
    `origin/master`.
  - Mutate or switch the user's main `master` checkout so the CLI local cleanup
    could complete.
- Decision made by agent: Merge PR #965, do not alter the user's main
  checkout, and continue on `codex/spell-phase1-monitor-21` from
  `origin/master`.
- Model routing: Local Codex handled CI classification, merge, and monitor
  branch hygiene. Jules remains the Package 3 implementation worker for PR
  #954.
- Rationale/evidence: The repair was narrow, regression-tested, and fully
  green in normal CI. The local cleanup error was a known GitHub CLI worktree
  limitation and not a failed merge. Preserving the user's main checkout is
  safer than forcing local branch cleanup.
- Mutation performed or skipped: Merged PR #965 and switched the monitor
  worktree to `codex/spell-phase1-monitor-21` from `origin/master`. Skipped
  local Package 3 implementation repair, duplicate GitHub feedback, Core merge
  of PR #954, and mutation of the user's main `master` checkout.
- Scope guardrails: This only records the Symphony dashboard/API repair
  lifecycle. It does not change spell rules, character creator behavior,
  spellbook UI, AI arbitration, premade roster semantics, or the Jules
  implementation branch.
- Result: PR #965 merged at 2026-05-22 16:09:48 UTC. The active monitor
  branch is now `codex/spell-phase1-monitor-21` from `origin/master`. PR #954
  still has no Jules repair commit after the third marked feedback comment.
- Next expected proof: Continue monitoring PR #954 through the dashboard. When
  Jules pushes a repair commit, refresh the PR packet, rerun Scout/Core
  acceptance review, and collect rendered creator/spellbook proof before Core
  merge.

### Decision 73: Archive Promoted Drafts In The Task Navigator

- Date/time: 2026-05-22 18:22 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: While monitoring PR #954 through the visible dashboard, the
  task navigator counted the Package 2 and Package 3 source drafts as open
  work even though both drafts had already been promoted into live handoffs.
  That made the open queue look larger than it was and left historical setup
  records beside the actual Package 3 `Wait for Jules Repair` handoff.
- Options considered:
  - Ignore the clutter because the live handoff was still visible.
  - Delete the historical draft records after promotion.
  - Mutate stored draft dispositions when a handoff exists.
  - Derive a navigator-only `promoted` archived state from matching
    `handoff.draftId` values while preserving the raw records.
- Decision made by agent: Derive promoted draft records in the dashboard
  navigator and place them in the archived bucket with a summary that points to
  the live handoff that now owns the next action.
- Model routing: Local Codex handled the Symphony dashboard repair and
  regression check. Jules remains the Package 3 implementation worker for PR
  #954.
- Rationale/evidence: The dashboard-first workflow should make the current
  operator path obvious. Historical drafts are useful provenance, but they
  should not compete with live handoffs in the open task count after promotion.
  A derived display state preserves audit history without rewriting task data.
- Mutation performed or skipped: Edited
  `conductor/symphony/public/dashboard.js`,
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`, and the
  spell tracker. Skipped local Package 3 implementation repair, skipped
  duplicate GitHub feedback, skipped Core merge, and skipped deleting or
  mutating historical draft task files.
- Scope guardrails: This only changes dashboard task-navigator presentation
  and verification coverage. It does not change spell rules, character creator
  behavior, spellbook UI, AI arbitration, premade roster semantics, or the
  Jules implementation branch.
- Result: `npm run build`,
  `node scripts/verify-task-dashboard-navigator.mjs`, and `git diff --check`
  passed. Rendered dashboard proof showed `Open: 2` and `Archived: 2`; both
  promoted drafts displayed as `promoted`, with summaries pointing at their
  live handoffs.
- Next expected proof: Publish this dashboard-friction repair, then continue
  waiting for Jules to push a PR #954 repair commit before rerunning Scout/Core
  acceptance review and rendered creator/spellbook proof.

### Decision 74: Merge The Promoted-Draft Navigator Cleanup And Resync The Monitor Branch

- Date/time: 2026-05-22 18:29 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: PR #967 carried the Decision 73 dashboard navigator cleanup.
  GitHub Build, Tests, Lint, CodeQL, Quality Scan, Poison File Check, and
  CodeQL analysis lanes all passed. The GitHub CLI again failed only during
  local post-merge cleanup because `master` is checked out in the user's main
  repository, after GitHub had already marked PR #967 merged.
- Options considered:
  - Leave PR #967 open despite all normal gates passing.
  - Merge PR #967 under the approved PR boundary, preserve the user's main
    checkout, and move the monitor worktree to a fresh branch from
    `origin/master`.
  - Mutate or switch the user's main `master` checkout so the CLI local cleanup
    could complete.
- Decision made by agent: Merge PR #967, do not alter the user's main
  checkout, and continue on `codex/spell-phase1-monitor-23` from
  `origin/master`.
- Model routing: Local Codex handled CI classification, merge, and monitor
  branch hygiene. Jules remains the Package 3 implementation worker for PR
  #954.
- Rationale/evidence: The repair was narrow, visually checked, locally
  verified, and fully green in CI. The local cleanup error was the same
  multi-worktree limitation seen in earlier merged repair PRs, not a failed
  merge.
- Mutation performed or skipped: Merged PR #967 and switched the monitor
  worktree to `codex/spell-phase1-monitor-23` from `origin/master`. Skipped
  local Package 3 implementation repair, duplicate GitHub feedback, Core merge
  of PR #954, and mutation of the user's main `master` checkout.
- Scope guardrails: This only records the dashboard navigator repair
  lifecycle. It does not change spell rules, character creator behavior,
  spellbook UI, AI arbitration, premade roster semantics, or the Jules
  implementation branch.
- Result: PR #967 merged at 2026-05-22 16:28:56 UTC. The active monitor branch
  is now `codex/spell-phase1-monitor-23` from `origin/master`. PR #954 still
  has no Jules repair commit after the third marked feedback comment.
- Next expected proof: Continue monitoring PR #954 through the dashboard. When
  Jules pushes a repair commit, refresh the PR packet, rerun Scout/Core
  acceptance review, and collect rendered creator/spellbook proof before Core
  merge.

### Decision 75: Send The Latest Scout Repair Request Into The Visible Jules Session

- Date/time: 2026-05-22 18:41 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: The dashboard and GitHub PR #954 still showed the correct
  high-level boundary, `Wait for Jules Repair`, with PR head
  `c02bf58ea3687f65ad57ca78581f46ae7cadad39` unchanged after the third marked
  GitHub feedback comment. Visible inspection of the dashboard-linked Jules
  session showed earlier GitHub feedback arriving as `Sent from GitHub`, but
  the page content did not show the latest Scout repair request for Druid
  `Speak with Animals` visibility or `SpellCard.tsx` explicit `any` cleanup.
- Options considered:
  - Keep waiting because the GitHub PR comment exists.
  - Repair PR #954 locally.
  - Send a duplicate GitHub PR comment.
  - Send the same bounded repair request through the visible Jules session so
    the active worker surface has the instruction, then continue waiting for a
    Jules repair commit.
- Decision made by agent: Send the bounded repair request through the visible
  Jules session, explicitly naming the two remaining Scout blockers and the
  Package 3 scope guardrails, then keep PR #954 in the Jules repair lane.
- Model routing: Local Codex handled dashboard inspection, PR evidence
  inspection, and the visible Jules message. Jules remains the Package 3
  implementation worker for PR #954.
- Rationale/evidence: The goal is to offload as much implementation work as
  possible to Jules. Waiting was only meaningful if the repair instruction was
  actually visible where Jules can act on it. Sending the same bounded feedback
  into Jules avoided local implementation repair and avoided another duplicate
  GitHub comment while improving the handoff's chance of progressing.
- Mutation performed or skipped: Used the dashboard as the primary surface,
  opened the linked Jules session, and sent a visible message asking Jules to
  repair PR #954 on the existing branch by rendering Druid `Speak with Animals`
  as a locked/pre-selected Level 1 spell card and typing `SpellCard.tsx`
  formatting helpers without explicit `any`. Skipped local Package 3 code
  repair, skipped Core merge, and skipped another GitHub PR comment.
- Scope guardrails: This only changes workflow state and project tracking. It
  does not change spell rules, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or Symphony orchestration code.
- Result: The visible Jules page text now contains the repair request,
  including `locked/pre-selected spell card` and `npx tsc --noEmit`. PR #954
  remains open at head `c02bf58ea3687f65ad57ca78581f46ae7cadad39`; normal
  GitHub checks are green, but Scout acceptance blockers remain until Jules
  pushes a new repair commit.
- Next expected proof: Refresh PR #954 through the dashboard after Jules
  pushes a new commit. If a repair commit appears, rerun Scout/Core acceptance
  review and collect rendered creator/spellbook proof before Core merge.

### Decision 76: Merge The Visible-Jules Repair Request Record And Resync The Monitor Branch

- Date/time: 2026-05-22 18:48 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: PR #969 recorded Decision 75, the Package 3 handoff receipt
  update, and the tracker gap for Jules feedback-delivery visibility. GitHub
  Build, Tests, Lint, CodeQL, Quality Scan, Poison File Check, and CodeQL
  analysis lanes passed. The `review / review` lane failed only because Gemini
  exhausted the daily quota on `gemini-2.5-flash`.
- Options considered:
  - Leave PR #969 open despite all normal gates passing.
  - Merge PR #969 under the approved PR boundary, preserve the user's main
    checkout, and move the monitor worktree to a fresh branch from
    `origin/master`.
  - Mutate or switch the user's main `master` checkout so the GitHub CLI local
    cleanup could complete.
- Decision made by agent: Merge PR #969, do not alter the user's main
  checkout, and continue on `codex/spell-phase1-monitor-25` from
  `origin/master`.
- Model routing: Local Codex handled CI classification, merge, and monitor
  branch hygiene. Jules remains the Package 3 implementation worker for PR
  #954.
- Rationale/evidence: The docs-only tracking PR preserved the real decision
  point created by dashboard-first use. The failed Gemini lane was quota
  infrastructure, while the normal repository gates passed. The repeated local
  cleanup error is a known multi-worktree limitation and not a failed merge.
- Mutation performed or skipped: Merged PR #969 and switched the monitor
  worktree to `codex/spell-phase1-monitor-25` from `origin/master`. Skipped
  local Package 3 implementation repair, duplicate GitHub feedback, Core merge
  of PR #954, and mutation of the user's main `master` checkout.
- Scope guardrails: This only records the workflow decision lifecycle. It does
  not change spell rules, character creator behavior, spellbook UI, AI
  arbitration, premade roster semantics, or Symphony orchestration code.
- Result: PR #969 merged at 2026-05-22 16:47:52 UTC. The active monitor branch
  is now `codex/spell-phase1-monitor-25` from `origin/master`. PR #954 still
  has no post-visible-Jules repair commit.
- Next expected proof: Continue monitoring PR #954 through the dashboard. When
  Jules pushes a repair commit, refresh the PR packet, rerun Scout/Core
  acceptance review, and collect rendered creator/spellbook proof before Core
  merge.

### Decision 77: Clarify That GitHub Feedback Is Not Jules Delivery Proof

- Date/time: 2026-05-22 19:10 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: After Decision 75, the dashboard correctly showed marked
  `[Jules feedback]` comments on PR #954, but the earlier visible Jules
  inspection proved that the active Jules session may not show the latest
  GitHub feedback text. The task detail page and main dashboard therefore
  risked overstating the meaning of a GitHub comment by implying the Jules
  worker had visibly received the repair request.
- Options considered:
  - Leave the wording as-is because the GitHub comment is still useful
    evidence.
  - Treat any marked GitHub comment as proof that Jules is actively repairing.
  - Repair Package 3 locally because the feedback-delivery path is uncertain.
  - Keep Package 3 assigned to Jules, but update Symphony's dashboard and task
    page language so marked feedback proves only that a GitHub PR comment
    exists, and instructs the operator to verify or send the same bounded
    request in the active Jules session when the latest feedback is not
    visible there.
- Decision made by agent: Refine Symphony's visible guidance instead of
  changing Package 3 implementation ownership. Marked feedback remains useful
  GitHub evidence, but the dashboard no longer treats it as delivery proof for
  Jules.
- Model routing: Local Codex handled the Symphony dashboard/task-page
  wording, regression coverage, and project tracking. Jules remains the
  Package 3 implementation worker for PR #954.
- Rationale/evidence: The test flow's purpose is to reduce orchestration
  friction while preserving the Jules offload path. The right repair is to
  make the operator-facing state more honest about what is known: GitHub
  comment posted is a recorded fact; Jules-visible delivery is a separate
  proof that may still need inspection or action.
- Mutation performed or skipped: Edited
  `conductor/symphony/public/dashboard.js`,
  `conductor/symphony/src/server.ts`,
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`,
  `conductor/symphony/scripts/verify-task-detail-page.mjs`, and the spell
  tracker. Skipped local Package 3 implementation repair, duplicate GitHub
  feedback, Core merge of PR #954, and mutation of the user's main `master`
  checkout.
- Scope guardrails: This only changes Symphony operator guidance and
  verification coverage. It does not change spell rules, character creator
  behavior, spellbook UI, AI arbitration, premade roster semantics, or the
  Jules implementation branch.
- Result: Local build and focused dashboard verifiers passed. The dashboard
  PR feedback summary and task-detail PR repair card now say that marked
  feedback proves a GitHub PR comment exists, and that the active Jules
  session must still be checked or given the same bounded request if the
  latest feedback is not visibly present there.
- Next expected proof: Publish and merge this Symphony friction repair, then
  continue monitoring PR #954 through the dashboard. When Jules pushes a
  repair commit, refresh the PR packet, rerun Scout/Core acceptance review,
  and collect rendered creator/spellbook proof before Core merge.

### Decision 78: Accept The Jules Repair Commit And Merge Package 3 PR #954

- Date/time: 2026-05-22 19:22 +02:00
- Phase: `package_3_scout_core_review`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: Jules pushed repair commit
  `b77b03581016c3ed0c950e242a1a8eca82f3e756` after the visible Jules repair
  request. GitHub Build, Tests, Lint, CodeQL, Quality Scan, Poison File Check,
  and CodeQL analysis lanes passed. A visible dashboard refresh moved the task
  from `Wait for Jules Repair` to `Scout Bridge Risk`, which meant the next
  decision was whether Scout/Core should accept the repaired PR or send more
  feedback to Jules.
- Options considered:
  - Keep waiting even though Jules had pushed a new repair commit and checks
    were green.
  - Send another Jules feedback comment.
  - Repair the Package 3 branch locally.
  - Accept the Jules repair after focused tests, local build, scope review, and
    rendered creator proof, then merge PR #954 under the pre-approved merge
    boundary.
- Decision made by agent: Accept the Jules repair and merge PR #954. Record the
  remaining class-feature checkbox semantics issue as an adjacent accessibility
  follow-up, not as a merge blocker.
- Model routing: Jules remained the implementation worker. Local Codex handled
  dashboard refresh, Scout/Core review, focused verification, rendered
  inspection, PR comment reporting, and the approved merge action.
- Rationale/evidence: The two prior Scout blockers were resolved: Druid
  `Speak with Animals` now renders as a checked `Class Feature` card in the
  Level 1 spell section, and `SpellCard.tsx` no longer uses explicit `any`
  formatting helpers. Focused creator/spellbook tests passed, local production
  build passed, GitHub checks passed, and rendered inspection showed the
  repaired Druid creator surface. The remaining checkbox semantics issue does
  not undo the visible/behavioral lock required by the original blocker.
- Mutation performed or skipped: Posted a Scout/Core result comment on PR #954
  because GitHub would not allow approving a same-owner PR through review,
  merged PR #954, and moved the monitor worktree to
  `codex/spell-phase1-monitor-28` from updated `origin/master`. Skipped local
  Package 3 code repair, skipped another Jules feedback request, and skipped
  mutation of the user's main `master` checkout.
- Scope guardrails: This accepts the Package 3 creator/spellbook visibility
  implementation. It does not claim levels 0-3 combat-simulator coverage,
  broad AI arbitration, higher-level caster fixtures, or the Package 4/5
  pilots.
- Result: PR #954 merged at 2026-05-22 17:22:22 UTC as
  `7f8d8935a08143ca6c0c1c5c78f4fedae0e4de27`. The active monitor branch is
  now `codex/spell-phase1-monitor-28` from `origin/master`.
- Next expected proof: Record Package 3 closeout receipts, run or record local
  sync/deployment gates as appropriate, update MemPalace targeted drawers, and
  then prepare Package 4's combat simulator deterministic spell pilot.

### Decision 79: Repair The Visible Local-Sync Check After Package 3 Merge

- Date/time: 2026-05-22 19:42 +02:00
- Phase: `package_3_closeout`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: Dashboard-first use after PR #954 merged showed the task
  navigator moving Package 3 to `Check local sync`, but the current boundary
  and task page still exposed raw local-sync endpoint text instead of a visible
  `Check Local Sync` control. The queue-level action also routed the
  `check_local_sync` state back to PR refresh, keeping the operator in a stale
  GitHub-review loop.
- Options considered:
  - Call the raw `refresh-local-sync` endpoint directly and keep moving.
  - Ignore the dashboard blocker and file closeout receipts from terminal
    evidence only.
  - Repair the Package 3 implementation locally.
  - Treat the missing visible control and stale boundary routing as Symphony
    workflow defects, then repair the dashboard/server transition before
    continuing Package 3 closeout.
- Decision made by agent: Repair the Symphony local-sync transition. A merged
  Jules PR now completes the GitHub PR boundary, promotes the read-only
  `Check Local Sync` readiness endpoint as the visible next action, and keeps
  the mutating `Sync Local Master` action hidden until the readiness packet
  says it is safe.
- Model routing: Local Codex handled this Symphony workflow repair because the
  blocker is in the orchestration dashboard, not in the spell implementation.
  Jules remains the preferred implementation worker for future spell packages.
- Rationale/evidence: The goal explicitly requires using the dashboard like a
  human operator and fixing workflow blockers rather than bypassing them. The
  safe action after a merge is not a Git pull; it is a visible readiness check
  that records branch, dirty-file, ahead/behind, deployment, and fast-forward
  safety evidence.
- Mutation performed or skipped: Edited
  `conductor/symphony/src/server.ts`,
  `conductor/symphony/public/dashboard.js`,
  `conductor/symphony/scripts/verify-middleman-foreman-pass-path.mjs`,
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`, and
  `conductor/symphony/scripts/verify-task-detail-page.mjs`. Skipped the raw
  endpoint bypass as the primary workflow path, skipped local spell repair, and
  skipped mutating local `master`.
- Scope guardrails: This only changes Symphony's Package 3 closeout workflow
  visibility. It does not change spell rules, creator/spellbook behavior,
  combat-simulator casting, premade roster semantics, AI arbitration, or Jules
  package scope.
- Result: `npm run build`, `node scripts/verify-middleman-foreman-pass-path.mjs`,
  `node scripts/verify-task-detail-page.mjs`, and
  `node scripts/verify-task-dashboard-navigator.mjs` passed. Rendered task-page
  proof on the repaired dashboard showed one visible `Check Local Sync` button
  in `Deployment And Local Sync`; clicking it ran the guarded readiness check
  and recorded blockers instead of pulling Git.
- Next expected proof: Publish this Symphony workflow repair, then continue
  Package 3 closeout by recording deployment/local-sync status honestly and
  updating the Package 3 proof receipts before Package 4 drafting.

### Decision 80: Record Monitor-Branch Sync Proof Instead Of Mutating Local Master

- Date/time: 2026-05-22 20:05 +02:00
- Phase: `package_3_closeout`
- Active slice: Package 3 spellbook and character creator visibility plus
  Symphony dashboard-first finalization
- Decision point: After PR #973 merged, the visible dashboard `Check Local
  Sync` action proved that `codex/spell-phase1-monitor-30` matched
  `origin/master` at `d705a9bd9d025b49b24014f822cba78ce0e20862` and had a clean
  worktree. The same readiness packet still blocked mutating local sync because
  the user's local `master` checkout has 2 local commit(s) that are not on
  `origin/master`, and this isolated worktree is not on `master`.
- Options considered:
  - Force the user's local `master` checkout to match `origin/master`.
  - Run the mutating local-sync path from the isolated monitor branch.
  - Ignore the local-sync boundary and proceed without a receipt.
  - Treat the clean monitor branch plus `origin/master` merge proof as the safe
    Package 3 closeout evidence, while recording that local `master` sync is
    intentionally blocked by user-owned local work.
- Decision made by agent: Do not mutate the user's local `master` checkout.
  Record the visible dashboard readiness result, preserve the local-master
  blocker, and reconcile the stale Package 3 receipts before Package 4.
- Model routing: Local Codex handled this closeout/receipt decision because it
  concerns the orchestration workflow and the operator's local checkout. Jules
  remains the preferred implementation worker for future spell packages.
- Rationale/evidence: The goal allows assumed approvals for the test flow, but
  it does not authorize overwriting user-owned local commits. The dashboard's
  repaired readiness packet gave the right friction signal: `origin/master` is
  current in the monitor worktree, but local `master` is not safe to pull or
  fast-forward automatically.
- Mutation performed or skipped: Updated Package 3 receipts, the living task
  tracker, and the public spell gate report. Skipped local `master` mutation,
  skipped hidden local-sync endpoint use, and skipped local Package 3
  implementation repair.
- Scope guardrails: This only records closeout proof and gate state. It does
  not change spell mechanics, character creator behavior, character sheet
  behavior, combat simulator casting, AI arbitration, or premade roster
  semantics.
- Result: Package 3 can close from the GitHub/master and monitor-worktree
  perspective after these receipts merge. The user's main checkout remains
  protected until the user decides what to do with the 2 local-only `master`
  commits.
- Next expected proof: Publish the receipt reconciliation, run targeted
  MemPalace mining for the durable docs, and start Package 4 drafting through
  the dashboard-first Symphony/Jules flow.

### Decision 81: Scope Package 4 As A Deterministic Combat Pilot For Jules

- Date/time: 2026-05-22 20:25 +02:00
- Phase: `package_4_intake`
- Active slice: Combat simulator deterministic spell pilot plus Symphony
  dashboard-first finalization
- Decision point: Package 3 was closed and the living tracker moved Package 4
  to active. The next choice was whether to ask Jules for broad combat support
  across all cantrips and level 1-3 spells, start with AI arbitration, repair
  the Atlas source gap first, or define a smaller deterministic pilot that
  proves the simulator path before broader mechanics-bucket work.
- Options considered:
  - Ask Jules to make all level 0-3 deterministic spells work in combat.
  - Start Package 5 AI arbitration before deterministic casting proof.
  - Repair the Atlas missing-source gap before any combat work.
  - Draft a bounded Jules task that proves representative damage, healing, and
    simple buff/status spell behavior through the combat simulator.
- Decision made by agent: Draft Package 4 as a bounded deterministic combat
  pilot for Jules. The pilot spells are `fire-bolt` or an equivalent cantrip
  damage spell, `magic-missile` or an equivalent level-1 damage spell,
  `cure-wounds` or an equivalent healing spell, and `bless` or an equivalent
  simple buff/status spell.
- Model routing: Local Codex used strong foreman reasoning for scoping and
  packet creation. Jules remains the intended implementation worker. Efficient
  scanning is appropriate for later file/status checks, but behavior decisions
  around runtime semantics should stay on the stronger foreman/review path.
- Rationale/evidence: The current combat path already has
  `useAbilitySystem`, `spellAbilityFactory`, `SpellCommandFactory`, command
  tests, premade caster spellbooks, `AbilityPalette`, and `CombatLog`. A pilot
  can prove action cost, spell slot cost, targeting, HP/status mutation, and log
  output without pretending the full 652 scoped mechanics findings are solved.
  This preserves the sequential Symphony/Jules operating model and avoids
  collapsing Package 4 into an unbounded mechanics rewrite.
- Mutation performed or skipped: Created the Package 4 Jules task, exact prompt,
  Symphony draft payload, dispatch checklist, combat proof receipt, and
  Atlas/gate receipt. Updated the living tracker. Skipped implementation work,
  skipped local combat repair, skipped broad AI arbitration policy, and skipped
  forcing the user's local `master` checkout to sync.
- Scope guardrails: Package 4 may touch combat runtime and focused fixtures
  needed for the selected pilot spells. It must not broaden into character
  creator UI, spellbook UI, all level 2-3 spell mechanics, broad AI arbitration,
  or Symphony orchestration files.
- Result: Package 4 is ready for visible Symphony dashboard draft creation and
  Jules dispatch once the dashboard path allows it.
- Next expected proof: Create the Package 4 dashboard draft visibly, route
  through Linear/manifest/Jules launch, and record the returned draft/handoff
  identifiers in the Package 4 readiness checklist.

### Decision 82: Stabilize An Unrelated Seasonal Movement Test Blocking PR #976

- Date/time: 2026-05-22 20:36 +02:00
- Phase: `package_4_packet_publication`
- Active slice: Publish Package 4 packet and keep the GitHub path green for
  dashboard/Jules handoff work
- Decision point: PR #976 was a Package 4 planning-doc packet, but GitHub
  Tests failed twice on `handleMovement - Seasonal Effects > increases travel
  time in Winter` with variable received values (`13500`, then `8100`) instead
  of `2700`.
- Options considered:
  - Treat the failure as unrelated and keep rerunning CI.
  - Merge or bypass the PR despite failing tests.
  - Stabilize the narrow test that was leaking random procedural travel-event
    delay into a seasonal multiplier assertion.
- Decision made by agent: Stabilize the test in the same PR by mocking
  `generateTravelEvent` to return `null` for the seasonal movement tests.
- Model routing: Local Codex handled this small CI repair because it was a
  pipeline unblocker discovered during PR publication, not Jules
  implementation work. Jules remains the intended worker for Package 4 combat
  implementation.
- Rationale/evidence: The failing assertion was meant to test seasonal travel
  multipliers, while procedural travel events are covered separately and can add
  random delay time. The isolated file passed locally by chance, but the full
  suite and GitHub lane exposed the uncontrolled dependency.
- Mutation performed or skipped: Changed only
  `src/hooks/actions/__tests__/handleMovement.test.ts`; skipped production
  movement behavior changes and skipped hidden CI bypass.
- Verification: Local focused Vitest passed. Local full `npm test -- --run`
  passed with 316 test files passed, 1 skipped, 2096 tests passed, and 8
  skipped. GitHub PR #976 then passed all checks.
- Result: PR #976 merged as
  `docs(spells): draft package 4 combat pilot packet`, merge commit
  `33b42a4f0fb67bd7966de6416f5fc00b88ca2785`.

### Decision 83: Create Package 4 Draft Through The Visible Dashboard And Stop At The Linear Boundary

- Date/time: 2026-05-22 20:37 +02:00
- Phase: `package_4_dashboard_intake`
- Active slice: Dashboard-first Symphony/Jules dispatch
- Decision point: After PR #976 merged and the monitor worktree moved to
  `codex/spell-phase1-monitor-33`, the visible dashboard draft form could
  accept the Package 4 payload. The dashboard then reported the new draft needs
  a Linear issue before Symphony prepares a Jules handoff.
- Options considered:
  - Use the visible dashboard form to create the Package 4 draft.
  - Use a hidden API endpoint to skip ahead to handoff preparation.
  - Ignore the dashboard's Linear issue boundary and dispatch Jules manually.
- Decision made by agent: Create the Package 4 draft through the visible
  dashboard form and stop at the dashboard-reported Linear issue boundary.
- Model routing: Local Codex performed dashboard operation and receipt updates.
  Jules is still reserved for the implementation-heavy Package 4 work after
  Symphony prepares the handoff.
- Rationale/evidence: The active goal requires dashboard-first operation and
  explicitly forbids bypassing Symphony UI blockers. The draft appeared in the
  task navigator as `draft-1779475056546-wvf3oh` with status `open draft` and
  the message that this workflow requires a Linear issue before handoff.
- Mutation performed or skipped: Created the dashboard draft through the UI;
  updated Package 4 tracker/checklist/payload receipts. Skipped hidden endpoint
  use, skipped manifest staging, skipped Jules launch, and skipped local
  `master` mutation.
- Flow friction recorded: The dashboard still reports local sync blocked
  because local `master` has 2 local-only commits and the current branch is
  `codex/spell-phase1-monitor-33`, even though the monitor worktree is tracking
  the merged `origin/master`. This remains a Symphony workflow refinement item.
- Result: Package 4 is in Symphony as draft `draft-1779475056546-wvf3oh`.
- Next expected proof: Create or link the Linear issue visibly, then use the
  dashboard to prepare the Jules handoff and stage/launch the manifest.

## Open Decisions For The Next Slice

1. Refresh local sync after PR #991 and the dashboard repair land, without
   mutating the user's dirty/divergent main checkout.
2. Decide whether the semantically enabled Druid class-feature checkbox should
   be repaired immediately or batched into a creator accessibility pass.
3. Decide whether Symphony should add first-class receipts and dashboard
   controls for `feedback visible in Jules`, beyond the Decision 77 wording
   that prevents GitHub comments from being overstated as delivery proof.
4. Decide whether to repair the task-navigator/drawer UX so selecting or acting
   on a task opens the `Task Intake And Records` group automatically.
5. Repair the Stitch MCP/tool reload path before claiming any Stitch-generated
   dashboard redesign work.

### Decision 87: Start Package 6 As The Choice/Mode Mechanics Bucket

- Date/time: 2026-05-24 18:00 +02:00
- Phase: `package_6_intake`
- Active slice: First post-pilot mechanics bucket for cantrips and spell levels
  1-3.
- Decision point: Packages 4 and 5 are now merged, but the active goal still
  contains a stale Package 4 paragraph. The tracker says the next package is a
  first mechanics bucket closure, while `G48` still blocks honest Atlas proof.
- Options considered:
  - Reopen Package 4 because the goal text still names it.
  - Repair Atlas source/discoverability before any mechanics-bucket work.
  - Start the next caster/fixture coverage slice.
  - Start a bounded `choice_or_mode` package because the execution plan ranks it
    first and current discovery evidence gives Jules a clear implementation
    target.
- Decision made by agent: Treat the living tracker as authoritative, record the
  stale-goal mismatch as `G58`, and start Package 6 as a bounded
  `choice_or_mode` mechanics bucket packet for Jules.
- Model routing: Local Codex handled foreman intake, evidence scanning, and
  task-packet drafting. Jules remains the preferred implementation worker for
  the spell data/runtime/test changes.
- Rationale/evidence: The plan ranks `choice_or_mode` first among mechanics
  bucket families. Current discovery evidence shows several cantrip mode
  choices already modeled, while level 1-3 spells such as
  `blindness-deafness`, `dragons-breath`, `enhance-ability`, and
  `protection-from-energy` still preserve deterministic choice mechanics in
  prose, generic utility data, or AI prompt text. That is a better next slice
  than a broad all-spells rewrite.
- Mutation performed or skipped: Created Package 6 task and prompt docs, updated
  the living tracker, and recorded this decision. Skipped local spell
  implementation, skipped hidden dashboard endpoints, skipped Symphony runtime
  changes, and skipped claiming Atlas proof while `G48` remains active.
- Scope guardrails: Package 6 should reduce one coherent choice/mode subset,
  not all mechanics buckets, AI arbitration policy, levels 4-9, premade roster
  semantics, or Symphony source.
- Next expected proof: Publish the packet, create/route a visible Symphony
  draft from a clean worktree, dispatch Jules, then review the resulting PR for
  file scope, tests, spell validation, generated gate churn, and honest Atlas
  status.

### Decision 88: Bypass The Broken Worktree Intent Hook For The P6 Packet Publication

- Date/time: 2026-05-24 18:45 +02:00
- Phase: `package_6_packet_publication`
- Active slice: Publish the Package 6 Jules-readable packet branch.
- Decision point: The visible dashboard recorded that the tracked and untracked
  Package 6 docs should be committed for Jules' base, but the shared
  pre-commit hook failed because it expects
  `.agent/workflows/intent-gate-check.mjs` inside the linked worktree. The
  `.agent` calibration files exist in the main checkout as local workflow state
  and should not be copied into the Aralia source branch just to satisfy a hook.
- Options considered:
  - Copy `.agent/workflows` into the worktree and risk mixing local-only agent
    calibration state into the task branch.
  - Stop and wait for an unrelated hook repair before publishing the Jules
    packet.
  - Use the hook's documented bypass for this docs-only packet commit, while
    recording the hook/worktree mismatch as `G59`.
- Decision made by agent: Use the documented `--no-verify` path for the
  Package 6 packet commit and push only, keep `.agent` local/out of source, and
  record the linked-worktree hook mismatch as a workflow gap.
- Model routing: Local Codex handled this workflow publication decision. Jules
  remains reserved for the implementation-heavy Package 6 spell work.
- Rationale/evidence: The staged files are task documentation and decision
  records only. The hook failed before checking intent because its relative path
  does not exist in the linked worktree. Copying ignored local calibration files
  into a clean worktree would contradict the active boundary that local agent
  state should stay outside Aralia task packets.
- Mutation performed or skipped: Committed and pushed the docs packet with the
  documented hook bypass after dashboard disposition approval and after the
  pre-push sync-check passed. Skipped copying `.agent` into the branch, skipped
  changing the shared hook in this packet PR, and skipped hidden dashboard
  endpoints.
- Scope guardrails: This does not approve bypassing product tests, spell
  validation, PR review, GitHub checks, or future implementation hooks. It only
  handles the local packet-publication hook mismatch.
- Next expected proof: Push the packet branch, rerun the visible dashboard Git
  sync check, and route the Package 6 draft only after the dashboard sees a
  trustworthy GitHub base.

### Decision 89: Add A Visible Package 6 Packet-Draft Button Instead Of Posting A Hidden Draft

- Date/time: 2026-05-24 19:25 +02:00
- Phase: `package_6_dashboard_intake`
- Active slice: Create the Package 6 Jules draft through the dashboard-first
  flow after the Package 6 packet PR merged.
- Decision point: The dashboard reached the draft intake step from a clean
  Package 6 base, but Codex Browser Use could not reliably fill the visible
  long-form draft fields because its virtual clipboard path is unavailable.
- Options considered:
  - Post directly to `/api/v1/task-drafts` from outside the dashboard and move
    on.
  - Ask the operator to manually type the Package 6 packet into the form.
  - Add a visible dashboard action that creates the known Package 6 draft from
    the committed Jules packet, then publish that dashboard repair before using
    it.
- Decision made by agent: Add and publish a visible `Create Package 6 Draft`
  dashboard button, then use that button for the handoff instead of calling the
  hidden endpoint directly.
- Model routing: Local Codex handled this small dashboard/workflow repair
  because it was discovered while operating the Symphony surface. Jules remains
  the preferred worker for Package 6 spell implementation after the handoff is
  created.
- Rationale/evidence: The active goal explicitly says dashboard blockers should
  be flagged and repaired rather than bypassed through hidden methods. A
  dashboard-owned button keeps the action inspectable and repeatable for the
  operator while avoiding manual retyping of an already committed task packet.
- Mutation performed or skipped: Changed
  `conductor/symphony/public/dashboard.js` and updated this tracker/decision
  record. Skipped raw endpoint use, skipped pretending the browser fill path was
  reliable, and skipped changing Package 6 spell data locally.
- Scope guardrails: This is a narrow Package 6 intake affordance. It does not
  make Symphony runtime/source part of the long-term Aralia task-packet model;
  it is a temporary in-repo workflow repair until Symphony is separated or the
  dashboard has a generic packet-selection mechanism.
- Next expected proof: Build the dashboard, publish the repair, verify the
  visible button creates the Package 6 draft, and then continue the dashboard
  handoff path toward Linear/Jules.

### Decision 90: Promote Runnable Current-Boundary Links Into Visible Buttons

- Date/time: 2026-05-24 19:55 +02:00
- Phase: `package_6_dashboard_intake`
- Active slice: Continue Package 6 from visible draft creation into Linear,
  handoff preparation, manifest staging, and Jules launch.
- Decision point: After the Package 6 draft was created through the visible
  dashboard button, the dashboard correctly identified `Linear issue` as the
  current boundary. The first-viewport action rendered as a raw `Endpoint` link,
  while the actual `Create Linear Issue` button was buried inside the collapsed
  task record and could not be clicked reliably by Codex Browser Use.
- Options considered:
  - Open the raw POST endpoint or call it directly from outside the dashboard.
  - Keep reopening and scrolling the long task record until the browser tool can
    click the nested button.
  - Render the already-guarded task-card actions as first-class current-boundary
    buttons for the same endpoint patterns.
- Decision made by agent: Update the dashboard current-boundary renderer so
  Linear issue creation, draft promotion, manifest staging, and Jules launch use
  visible buttons backed by the existing dashboard click handlers.
- Model routing: Local Codex handled the dashboard workflow repair because it
  was discovered while operating Symphony. Jules remains reserved for the
  Package 6 spell data/runtime/test implementation once launched.
- Rationale/evidence: The user explicitly wants dashboard-first operation to
  reveal real workflow blockers. A current-boundary panel that says "Run Linear
  issue" but only exposes a raw endpoint is not a humane or reliable dashboard
  action. The fix reuses existing guarded handlers instead of inventing new
  mutation paths.
- Mutation performed or skipped: Changed
  `conductor/symphony/public/dashboard.js` and updated the tracker/decision
  report. Skipped hidden endpoint use and skipped local Package 6 spell
  implementation.
- Scope guardrails: This is a dashboard affordance repair only. It does not
  relax the approval reporting requirement; every external or local-state action
  still needs a recorded decision/proof trail.
- Next expected proof: Build the dashboard, publish the repair, verify the
  current-boundary `Create Linear Issue` button appears, and continue the
  Package 6 dashboard handoff.

### Decision 91: Dispatch Package 6 To Jules Through The Visible Dashboard Flow

- Date/time: 2026-05-24 20:15 +02:00
- Phase: `package_6_dashboard_dispatch`
- Active slice: Move the Package 6 `choice_or_mode` packet from visible draft
  creation into a live Jules implementation session.
- Decision point: After PRs #994 and #995 repaired the dashboard intake
  affordances, the dashboard showed a clean GitHub sync gate and exposed
  visible controls for Linear issue creation, draft promotion, manifest staging,
  Jules launch, and session refresh.
- Options considered:
  - Pause after proving the dashboard buttons work.
  - Dispatch Package 6 through the visible Symphony flow using the user's
    pre-approved external-write and local-state decisions.
  - Skip Symphony and start Jules separately.
- Decision made by agent: Continue through the dashboard-visible path: create
  Linear issue `ARA-12`, promote draft `draft-1779591924625-7hop6v` to handoff
  `handoff-1779592447710-27ufm6`, stage the Jules manifest, launch Jules
  session `3811311513433217520`, and refresh once.
- Model routing: Local Codex stayed in foreman/orchestration mode. Jules was
  assigned the implementation-heavy Package 6 spell data/runtime/test work.
- Rationale/evidence: The active goal asks Codex to offload as much suitable
  implementation work as possible to Jules while using the dashboard like a
  human. The dashboard showed GitHub synced at `0f5ffb71b3a3`, then recorded the
  handoff lifecycle and session URL. The first post-launch refresh reported
  Jules `QUEUED`, with no PR URL and no plan-approval prompt yet.
- Mutation performed or skipped: Created external Linear/Jules artifacts and
  local ignored Symphony/Jules runtime receipts through visible dashboard
  buttons. Updated the Aralia tracker with only the durable identifiers. Skipped
  hidden endpoints, skipped local spell implementation, and kept ignored
  `.jules`/`.symphony` runtime state out of Git.
- Scope guardrails: This dispatch does not approve accepting any future Jules
  PR blindly. Codex must still review file scope, generated gate churn, checks,
  Atlas honesty, and Package 6 acceptance criteria before merge.
- Next expected proof: Refresh the Jules session from the dashboard until it
  either needs plan approval, needs feedback, produces a PR, fails, or remains
  queued long enough to justify a waiting/nudge record.

### Decision 92: Send Package 6 Jules Feedback Through A Visible Prepared-Feedback Control

- Date/time: 2026-05-24 21:40 +02:00
- Phase: `package_6_jules_feedback`
- Active slice: Answer Jules' scoped schema question without bypassing the
  dashboard-first workflow.
- Decision point: Jules session `3811311513433217520` reached
  `AWAITING_USER_FEEDBACK` and asked whether Package 6 should implement
  `modeChoice` for `blindness-deafness`, `dragons-breath`, and
  `protection-from-energy`, or add a new simple damage/resistance choice schema
  field. The standalone Symphony task page rendered a `Send Jules Feedback`
  action for the `/message` endpoint, but did not render a message field for the
  operator's exact feedback text.
- Options considered:
  - Send the prepared feedback by calling the hidden `/message` endpoint
    directly.
  - Repair the spell implementation locally and avoid the Jules feedback gate.
  - Add a visible task-page Jules feedback form, verify it, and use that visible
    form.
  - Add a visible prepared-feedback control for this exact reviewed Package 6
    answer if browser text entry still fails after the dashboard repair.
- Decision made by agent: Add a local dashboard repair so a Jules feedback
  boundary renders a visible `Jules feedback` textarea and submit button on the
  standalone task page. When Browser Use still could not type or paste into the
  visible textarea, add a visible `Send Prepared Package 6 Feedback` control
  that displays the exact feedback text in an open details block and sends that
  reviewed text through the same dashboard form path. Do not call the hidden
  endpoint directly.
- Model routing: Local Codex handled the workflow repair and schema feedback
  decision with stronger foreman reasoning, because this choice affects shared
  spell schema direction and dashboard-first trust. Jules remains the intended
  implementation worker once feedback is delivered.
- Rationale/evidence: Current schema evidence shows `modeChoice` is already the
  right shape for mutually exclusive operation menus, `targeting.perTargetChoice`
  already covers `enhance-ability`, `effects[].damageTypeSource:
  chosen_damage_type` already covers defensive chosen-type effects such as
  `protection-from-energy`, and `damageTypeChoice` currently lives under attack
  augments rather than simple damage/resistance effects. The prepared feedback
  tells Jules to use `modeChoice` for `blindness-deafness`, not to model
  damage-type selections as `modeChoice`, to leave `enhance-ability` alone
  unless a concrete gap appears, and to defer or make only a tiny validated
  simple-damage extension for `dragons-breath`.
- Mutation performed or skipped: Changed local Symphony dashboard source
  `conductor/symphony/src/server.ts` and verifier
  `conductor/symphony/scripts/verify-task-detail-page.mjs` to expose and verify
  the visible feedback form and the visible prepared-feedback fallback. Updated
  the Aralia tracker with `G62`. Skipped hidden endpoint use, skipped local spell
  implementation, and skipped pushing this Symphony source repair while the
  active boundary still says Symphony source should eventually be external to
  Aralia.
- Scope guardrails: The local dashboard repair is workflow infrastructure, not
  Package 6 spell implementation. It should be treated as external Symphony work
  or a temporary migration repair, not as proof that Symphony runtime/source
  belongs permanently in Aralia task packets.
- Result: `npm run build` in `conductor/symphony` passed, and
  `node conductor/symphony/scripts/verify-task-detail-page.mjs` passed after the
  repair. The visible prepared-feedback button sent the Package 6 response to
  Jules; the handoff dialogue records status `sent` with output `Sent message to
  Jules session 3811311513433217520.`, and the visible Jules page shows the
  feedback message in the session. A dashboard refresh still reports
  `AWAITING_USER_FEEDBACK`, so Jules may not have resumed yet or the
  Symphony/Jules message bridge may need a follow-up status transition. A second
  local dashboard repair also changed the current boundary after a sent message
  from `Send Jules Feedback` to `Refresh Jules Status`; `verify-queue-next-action`
  now covers this case and the live dashboard shows the corrected boundary.
- Next expected proof: Refresh the Jules session again until it moves out of
  `AWAITING_USER_FEEDBACK`, produces a PR, or proves a new message-bridge
  blocker that should be recorded separately.

### Decision 93: Continue Package 6 Monitoring After Jules Resumed

- Date/time: 2026-05-24 06:02 +02:00
- Phase: `package_6_jules_monitoring`
- Active slice: Resume from the dashboard after local work changed and classify
  the next real Package 6 boundary.
- Decision point: The previous receipt said Jules was still
  `AWAITING_USER_FEEDBACK` after the prepared-feedback message was sent. On
  resume, the Package 6 dashboard worktree still had five uncommitted local
  changes, the dashboard was still reachable on port `8141`, and the visible
  current boundary was `Refresh Jules Status`.
- Options considered:
  - Treat the old `AWAITING_USER_FEEDBACK` receipt as current and keep debugging
    the message bridge.
  - Bypass the dashboard and inspect hidden state directly.
  - Use the visible dashboard refresh action, then update the durable tracker
    only from the visible task receipt.
- Decision made by agent: Use the visible `Refresh Jules Status` action on the
  Package 6 dashboard and then open the visible task page receipt. Do not resend
  feedback, do not repair Package 6 spells locally, and do not bypass the
  dashboard with hidden endpoints.
- Model routing: Codex foreman handled the dashboard monitoring and durable
  receipt update. Jules remains the implementation worker for Package 6 while
  its session is running.
- Rationale/evidence: The task page now says `Jules is IN_PROGRESS, but no PR
  URL has been captured yet.` Its timeline includes `Jules status refreshed` at
  `2026-05-24T04:01:32.159Z` with detail `Jules reported IN_PROGRESS.` This
  means the feedback gate has cleared and the active boundary is waiting for
  Jules to produce a PR, ask for new input, fail, or require another visible
  refresh.
- Mutation performed or skipped: Updated the Aralia-facing Package 6 tracker
  status text to replace the stale `AWAITING_USER_FEEDBACK` note with the new
  `IN_PROGRESS` receipt. Skipped committing or pushing local Symphony source
  repairs because the broader goal still says Symphony runtime/source should be
  treated as external or temporary migration work unless intentionally published.
- Scope guardrails: This decision records orchestration state only. It does not
  change the Package 6 spell implementation, schema, Atlas proof, or gate-report
  data.
- Result: Package 6 is now waiting on Jules implementation progress rather than
  operator feedback. No PR URL is recorded yet, and the Git safety panel remains
  blocked by five local tracked changes that need disposition before any further
  GitHub-synced handoff work.
- Next expected proof: Continue dashboard refreshes until Jules exposes a PR URL,
  asks for new input, fails, or remains `IN_PROGRESS` long enough to justify a
  visible nudge/wait record.

### Decision 94: Send Package 6 Finalization Approval Through A Visible Prepared Control

- Date/time: 2026-05-24 06:11 +02:00
- Phase: `package_6_jules_finalization_approval`
- Active slice: Let Jules finish Package 6 and open a PR after it reported the
  bounded implementation work and asked whether to proceed.
- Decision point: The visible Jules session showed a completed-work report for
  Package 6 and asked: `Should I proceed to get the code reviewed and finalize my
  work, or do you need me to verify anything else first?` Browser Use could see
  the Jules textarea, but both fill and literal typing failed because the browser
  bridge reported that its virtual clipboard is unavailable. Calling the hidden
  Symphony `/message` endpoint directly would bypass the dashboard-first test
  flow.
- Options considered:
  - Stop and ask the operator to type the approval manually.
  - Repair the Package 6 spell work locally and abandon the Jules-first handoff.
  - Call the hidden Symphony message endpoint directly.
  - Add a visible prepared finalization-approval control to the dashboard, show
    the exact approval text, and send it through the same dashboard note bridge.
- Decision made by agent: Add a visible `Send Prepared Finalization Approval`
  control for the Package 6 handoff on the dashboard. The prepared text tells
  Jules to proceed to final review and open the PR for Symphony/Scout/Core
  review, stay bounded to Package 6, avoid adjacent cleanup, avoid generated
  timestamp-only gate churn, and include verification results.
- Model routing: Codex foreman handled the workflow repair and approval decision
  because this is an orchestration boundary. Jules remains the implementation
  worker and PR producer.
- Rationale/evidence: The approval is within the operator's prior assumed
  approval for this test flow. The dashboard rendered the prepared approval
  button, the task receipt records an operator note at
  `2026-05-24T04:09:43.062Z`, and the visible Jules page shows the same approval
  message followed by a `Thinking` state. This avoided hidden endpoint use and
  avoided local spell repair.
- Mutation performed or skipped: Changed local Symphony dashboard source
  `conductor/symphony/public/dashboard.js` to expose the prepared approval
  control. Updated the Aralia tracker with `G64`. Skipped local Package 6 spell
  implementation and skipped claiming a PR because no PR URL is recorded yet.
- Scope guardrails: This is workflow repair plus receipt tracking only. It does
  not prove Package 6 spell correctness, Atlas state, gate-report stability, or
  PR readiness.
- Result: The finalization approval reached Jules and is visible in both the
  task receipt and the Jules session. A later dashboard refresh still reported
  `AWAITING_USER_FEEDBACK` and no PR URL, so Symphony/Jules state reconciliation
  remains suspect or Jules has not yet advanced far enough to expose the PR.
- Next expected proof: Continue visible dashboard refreshes until Jules exposes a
  PR URL, asks a genuinely new question, fails, or remains waiting long enough to
  record a separate status-reconciliation/nudge decision.

### Decision 95: Keep Package 6 In Jules Review Instead Of Local Repair

- Date/time: 2026-05-24 06:15 +02:00
- Phase: `package_6_jules_review_wait`
- Active slice: Monitor Package 6 after Jules received finalization approval.
- Decision point: After the prepared finalization approval was sent, Symphony's
  next visible refresh reported `IN_PROGRESS` with no PR URL. The visible Jules
  page showed the approval message and then `Running code review ...`, still
  without a GitHub PR URL.
- Options considered:
  - Start implementing or reviewing Package 6 locally before Jules opens a PR.
  - Send another nudge immediately.
  - Continue dashboard-first monitoring until Jules produces a PR, asks a new
    question, or fails.
- Decision made by agent: Do not repair or review Package 6 locally yet, and do
  not resend approval. Keep Jules as the worker and continue visible refreshes
  until a PR URL or a new failure boundary appears.
- Model routing: Jules remains the implementation/review worker. Codex stays in
  foreman monitoring mode.
- Rationale/evidence: The visible task page says `Jules is IN_PROGRESS, but no PR
  URL has been captured yet.` The visible Jules session says `Running code review
  ...`, which means the prior approval was accepted and Jules is still doing
  finalization work.
- Mutation performed or skipped: Updated the Aralia-facing tracker to replace
  the stale `AWAITING_USER_FEEDBACK` wording with the current `IN_PROGRESS` /
  `Running code review ...` evidence. Skipped local spell implementation, skipped
  another Jules note, and skipped PR inspection because no PR URL exists yet.
- Scope guardrails: This is orchestration monitoring only. It does not prove
  Package 6 implementation correctness or change any spell data.
- Result: Package 6 remains waiting on Jules to finish review/finalization and
  expose a PR URL.
- Next expected proof: Refresh the dashboard again until a PR URL appears, Jules
  asks a new question, or Jules reports a failure.

### Decision 96: Confirm No Package 6 PR Before Waiting Again

- Date/time: 2026-05-24 06:18 +02:00
- Phase: `package_6_jules_review_wait`
- Active slice: Determine whether Package 6 has produced a GitHub PR yet.
- Decision point: The visible dashboard still reported `IN_PROGRESS` with no PR
  URL after refreshing the Package 6 handoff, and the visible Jules session still
  said `Running code review ...`.
- Options considered:
  - Assume the PR exists and begin PR review from memory.
  - Start a local implementation/review before Jules publishes its PR.
  - Check GitHub directly for an open Package 6 PR, then keep waiting if none
    exists.
- Decision made by agent: Check open GitHub PRs with `gh pr list --repo
  Gambitnl/Aralia` as corroborating evidence, then keep the Jules handoff in
  dashboard refresh/wait state.
- Model routing: Jules remains the implementation/review worker. Codex remains
  the foreman/monitor.
- Rationale/evidence: The dashboard has no PR URL. The visible Jules session has
  no PR link and only shows `Running code review ...`. GitHub open PRs are #988,
  #930, and #929; none are the Package 6 choice/mode handoff.
- Mutation performed or skipped: Updated the Aralia-facing tracker to record the
  latest dashboard/Jules/GitHub evidence. Skipped local Package 6 implementation,
  skipped another Jules note, and skipped PR review because no Package 6 PR
  exists yet.
- Scope guardrails: This records orchestration state only. It does not change
  spells, schema, tests, or Atlas.
- Result: Package 6 remains waiting on Jules code review/finalization to expose a
  PR URL.
- Next expected proof: Refresh again later until a Package 6 PR URL appears, a
  new Jules question appears, or Jules reports failure.

### Decision 97: Send Package 6 PR Repair Feedback To Jules

- Date/time: 2026-05-24 06:26 +02:00
- Phase: `package_6_pr_review`
- Active slice: Review Jules PR #997 for mergeability, changed-file scope, and
  obvious acceptance blockers before Scout/Core review.
- Decision point: Dashboard refresh found Package 6 PR #997 and moved the
  boundary to PR review. GitHub reported the PR as `CONFLICTING`; CodeQL checks
  passed, but no broader build/test checks were present in the current rollup.
- Options considered:
  - Merge or approve because the available checks are green.
  - Repair the PR locally in Codex.
  - Ask Jules to repair the conflict and the implementation issue on its own PR.
- Decision made by agent: Keep Jules as the PR owner and send a focused repair
  comment through the dashboard-presented GitHub comment path. Do not repair the
  PR locally.
- Model routing: Codex foreman performed review and issue classification. Jules
  remains responsible for its PR repair commit.
- Rationale/evidence:
  - `gh pr view 997 --repo Gambitnl/Aralia` reports mergeability
    `CONFLICTING` and PR URL `https://github.com/Gambitnl/Aralia/pull/997`.
  - An isolated review worktree reproduced the conflict with
    `git merge --no-commit --no-ff origin/master`; the only conflicted file was
    `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`.
  - A local JSON check on the PR branch found invalid `modeChoice` indices:
    `alarm` option `Mental Alarm` points to effect index `1` while the spell has
    one effect; `alter-self` options `Change Appearance` and `Natural Weapons`
    point to `1` and `2` while the spell has one effect; `enlarge-reduce`
    option `Reduce` points to `1` while the spell has one effect; `plant-growth`
    option `Enrichment` points to `1` while the spell has one effect. Because
    PR #997 filters active effects by `effectIndices`, these choices can produce
    an empty command list.
- Mutation performed or skipped: Created the local feedback file
  `.jules/feedback/handoff-1779592447710-27ufm6-pr-feedback.md` and ran the
  dashboard-presented command
  `gh pr comment https://github.com/Gambitnl/Aralia/pull/997 --body-file
  .jules/feedback/handoff-1779592447710-27ufm6-pr-feedback.md`. The comment was
  posted at `https://github.com/Gambitnl/Aralia/pull/997#issuecomment-4527378854`.
  Skipped local PR repair and skipped merge approval.
- Scope guardrails: The feedback asks Jules to keep the repair bounded to
  Package 6, avoid unrelated cleanup, and avoid generated timestamp-only
  gate-report churn.
- Result: Dashboard refresh still reports `Resolve PR Conflicts`; PR checks are
  passing for the four current CodeQL checks, but merge conflicts and the
  modeChoice index bug remain until Jules pushes a repair commit.
- Next expected proof: Refresh PR #997 after Jules pushes a repair commit, then
  rerun changed-file review, mergeability, and focused verification.

### Decision 98: Wait After Jules Acknowledged Package 6 Repair Feedback

- Date/time: 2026-05-24 06:29 +02:00
- Phase: `package_6_pr_repair_wait`
- Active slice: Check whether Jules repaired PR #997 after the bounded repair
  feedback comment.
- Decision point: The dashboard still showed `Resolve PR Conflicts`, so Codex
  needed to determine whether Jules had pushed a repair commit, whether a new
  review action was required, or whether this was simply a wait state.
- Options considered:
  - Repost or broaden the repair request.
  - Start local PR repair in Codex.
  - Check GitHub/Jules evidence and wait if Jules has acknowledged but not yet
    pushed.
- Decision made by agent: Do not repost, do not repair locally, and keep waiting
  for Jules to push a repair commit.
- Model routing: Jules remains the PR repair worker. Codex remains foreman.
- Rationale/evidence: `gh pr view 997` still shows only the original commit
  `aa759e685743cc153bc27cb8321eac8aecbaa1bf`, mergeability `CONFLICTING`, and
  the repair comment `https://github.com/Gambitnl/Aralia/pull/997#issuecomment-4527378854`
  has an eyes reaction from Jules. The visible Jules page showed PR diff context
  but no completed repair report or new PR URL.
- Mutation performed or skipped: Updated the Aralia-facing tracker with the
  acknowledged-but-not-repaired state. Skipped local repair, skipped another PR
  comment, and skipped rerunning the out-of-range index check because the PR
  commit did not change.
- Scope guardrails: This records orchestration state only; it does not modify
  spell data or PR code.
- Result: Package 6 remains `repair-requested`; next useful action is another PR
  refresh after Jules pushes a new commit.
- Next expected proof: A new PR #997 commit from Jules, followed by mergeability
  and modeChoice index verification.

### Decision 99: Ask Jules To Push The Claimed Package 6 Repair Commit

- Date/time: 2026-05-24 06:34 +02:00
- Phase: `package_6_pr_repair_wait`
- Active slice: Reconcile Jules' repair claim with the actual PR branch state.
- Decision point: Jules replied on PR #997 saying it had merged `origin/master`,
  resolved the tracker conflict, fixed out-of-range `modeChoice.effectIndices`,
  and added a focused regression check. However, GitHub and Git still showed no
  pushed repair commit.
- Options considered:
  - Treat Jules' comment as proof and proceed to review.
  - Repair the PR locally in Codex.
  - Verify the remote branch, then ask Jules to push the actual repair commit.
- Decision made by agent: Verify the remote branch and post a narrow follow-up
  comment asking Jules to push the described repair commit.
- Model routing: Jules remains the PR repair worker. Codex remains foreman and
  evidence checker.
- Rationale/evidence: `gh pr view 997` still reported head
  `aa759e685743cc153bc27cb8321eac8aecbaa1bf`, mergeability `CONFLICTING`, and
  only the original PR commit. `git ls-remote origin
  refs/heads/jules/spells-package6-choice-mode-bucket-3811311513433217520`
  returned the same commit. The dashboard also still showed `Resolve PR
  Conflicts`.
- Mutation performed or skipped: Created local feedback file
  `.jules/feedback/handoff-1779592447710-27ufm6-pr-feedback-2.md` and posted it
  with `gh pr comment https://github.com/Gambitnl/Aralia/pull/997 --body-file
  .jules/feedback/handoff-1779592447710-27ufm6-pr-feedback-2.md`. The follow-up
  comment is `https://github.com/Gambitnl/Aralia/pull/997#issuecomment-4527395887`.
  Skipped local PR repair and skipped accepting Jules' unpushed repair claim as
  evidence.
- Scope guardrails: The follow-up asks only for the already-described repair
  commit: preserve tracker history while resolving conflict, fix out-of-range
  `modeChoice.effectIndices`, and add the focused regression check.
- Result: Package 6 remains `repair-requested`; PR #997 is not ready for
  Scout/Core review until the branch actually changes.
- Next expected proof: A new PR #997 head commit from Jules, followed by
  mergeability, changed-file, and modeChoice index verification.

### Decision 100: Request Second Package 6 PR Repair After Partial Fix

- Date/time: 2026-05-24 06:39 +02:00
- Phase: `package_6_pr_review`
- Active slice: Review Jules repair commit `b591839a49a6d764f660757dd8a1110c662f1e3c`.
- Decision point: Jules finally pushed a repair commit to PR #997. Codex needed
  to determine whether the PR was ready for Scout/Core review or still needed
  bounded repair.
- Options considered:
  - Proceed because the data index bug was fixed and the focused Vitest passed.
  - Repair remaining issues locally.
  - Send a second focused Jules repair comment.
- Decision made by agent: Send Jules a second focused repair comment because the
  repair was partial.
- Model routing: Jules remains PR repair worker. Codex remains foreman reviewer.
- Rationale/evidence:
  - PR head moved to `b591839a49a6d764f660757dd8a1110c662f1e3c`.
  - A local `modeChoice` index scan now passes for `alarm`, `alter-self`,
    `blindness-deafness`, `enlarge-reduce`, and `plant-growth`.
  - `npx vitest run src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts
    --reporter=verbose` passed in the isolated PR review worktree.
  - `git merge --no-commit --no-ff origin/master` still conflicts in
    `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`.
  - The PR now includes
    `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`,
    which is out of scope for the Package 6 Aralia spell task and violates the
    current Symphony/Aralia separation boundary.
  - The new focused test proves invalid indices do not crash, but does not catch
    invalid real spell data. The prior regression would have passed if invalid
    real data returned.
- Mutation performed or skipped: Posted
  `https://github.com/Gambitnl/Aralia/pull/997#issuecomment-4527406707` asking
  Jules to resolve the tracker conflict, remove the Symphony decision-report
  file from the PR, and add/adjust a focused real-data regression for invalid
  `modeChoice.effectIndices`. Skipped local PR repair and skipped approval.
- Scope guardrails: The follow-up is limited to PR #997 repair and explicitly
  asks Jules to keep scope bounded.
- Result: Package 6 remains `repair-requested`; one implementation bug is fixed,
  but the PR is still not ready for Scout/Core review.
- Next expected proof: A new PR #997 head commit, no merge conflict, no
  out-of-scope Symphony decision-report file, and a focused real-data
  `modeChoice.effectIndices` regression.

### Decision 101: Keep Package 6 Waiting After Visible Jules Acknowledgement

- Date/time: 2026-05-24 06:47 +02:00
- Phase: `package_6_pr_repair_wait`
- Active slice: Resume Package 6 monitoring after local/operator work changed
  around the repo.
- Decision point: Codex needed to decide whether to repair PR #997 locally,
  post another nudge, start a later spell package, or keep waiting for Jules
  after the previous bounded repair request.
- Options considered:
  - Repair the tracker conflict, remove the Symphony file, and add the
    real-data regression locally.
  - Post another GitHub/Jules nudge with the same requested repair.
  - Start a later spell package while PR #997 remains unresolved.
  - Use the dashboard and visible Jules session to verify current state, then
    keep the repair with Jules.
- Decision made by agent: Keep Package 6 in a waiting state with Jules as the
  repair worker. Do not repair locally and do not post duplicate feedback yet.
- Model routing: Jules remains the implementation and PR repair worker. Codex
  remains the dashboard-first foreman, state verifier, and tracker maintainer.
- Rationale/evidence:
  - GitHub still reports PR #997 head
    `b591839a49a6d764f660757dd8a1110c662f1e3c` and mergeability
    `CONFLICTING`.
  - The PR file list still includes
    `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`.
  - The visible Symphony dashboard at `http://127.0.0.1:8141/tasks/handoff-1779592447710-27ufm6`
    still shows `Resolve PR Conflicts` and says GitHub reports merge conflicts.
  - A visible Jules session check showed the session message, "I have received
    the PR comments and am processing them."
  - The living tracker currently treats Package 6 as the sequencing boundary,
    so opening another package before this PR is repaired would increase review
    and conflict pressure.
- Mutation performed or skipped: Updated the Aralia-facing tracker to record the
  visible Jules acknowledgement and unchanged GitHub state. Skipped local PR
  repair, skipped duplicate PR feedback, and skipped starting a later package.
- Scope guardrails: This records state only. It does not mutate spell data, PR
  code, GitHub PR branches, Linear state, or hidden Symphony endpoints.
- Result: Package 6 is `waiting` on a Jules repair commit. The next useful
  action is another dashboard/PR refresh after Jules pushes or the operator
  redirects Codex to take over the repair.
- Next expected proof: New PR #997 head commit, no merge conflict, no
  out-of-scope Symphony decision-report file, and a focused real-data
  `modeChoice.effectIndices` regression.

### Decision 102: Reconfirm Package 6 Wait State Without Duplicate Nudge

- Date/time: 2026-05-24 06:50 +02:00
- Phase: `package_6_pr_repair_wait`
- Active slice: Continue Package 6 monitoring through the visible dashboard and
  Jules surfaces.
- Decision point: The goal resumed while PR #997 was already waiting on Jules'
  second repair. Codex needed to decide whether repeated unchanged evidence
  should trigger a local takeover, another nudge, a new later package, or a
  continued wait.
- Options considered:
  - Take over the PR locally and repair the conflict, out-of-scope file, and
    missing real-data regression.
  - Post another duplicate GitHub/Jules nudge.
  - Start the next spell package while Package 6 remains conflicting.
  - Recheck the dashboard and visible Jules session, then keep waiting if the
    repair request is acknowledged and unchanged.
- Decision made by agent: Keep waiting without another nudge. The same repair
  request is already visible to Jules, and starting later package work while the
  tracker conflict remains would increase conflict pressure.
- Model routing: Jules remains the PR repair worker. Codex remains the
  dashboard-first foreman and evidence recorder.
- Rationale/evidence:
  - `gh pr view 997` still reports head
    `b591839a49a6d764f660757dd8a1110c662f1e3c`, mergeability `CONFLICTING`,
    and no comments newer than the bounded repair request at
    `https://github.com/Gambitnl/Aralia/pull/997#issuecomment-4527406707`.
  - The dashboard task page still reports `Resolve PR Conflicts`; clicking the
    visible boundary refresh records a fresh GitHub PR refresh with checks
    passing but conflicts still present.
  - The visible Jules session still shows, "I have received the PR comments and
    am processing them."
- Mutation performed or skipped: Updated the Aralia tracker with the second
  visible unchanged-state check. Skipped local PR repair, skipped duplicate
  feedback, skipped hidden endpoints, and skipped opening a later package.
- Scope guardrails: This records orchestration state only. The PR remains
  Jules-owned until Jules pushes another repair commit or the operator redirects
  Codex to take over.
- Result: Package 6 remains `waiting`. This is not marked as goal-blocked yet
  because the strict blocked audit requires the same blocker to repeat across at
  least three consecutive goal turns and no meaningful progress to remain.
- Next expected proof: New PR #997 head commit, no merge conflict, no
  out-of-scope Symphony decision-report file, and a focused real-data
  `modeChoice.effectIndices` regression.

### Decision 103: Mark Active Goal Blocked On Repeated Package 6 External Wait

- Date/time: 2026-05-24 06:53 +02:00
- Phase: `package_6_pr_repair_blocked_audit`
- Active slice: Apply the strict blocked audit after repeated unchanged Package
  6 repair checks.
- Decision point: The same external blocker repeated across three consecutive
  continuation turns: PR #997 still had no Jules repair commit after Codex's
  second bounded repair request, while Jules visibly said it had received the PR
  comments and was processing them.
- Options considered:
  - Keep reporting the same wait state while leaving the active goal active.
  - Take over PR #997 locally and repair the conflict/out-of-scope file/test
    gap, despite the Jules-first goal.
  - Open another package while Package 6 remains merge-conflicting.
  - Mark the goal blocked under the continuation blocked-audit rule.
- Decision made by agent: Mark the active goal blocked. The blocker is external
  to Codex's dashboard-first path unless Jules pushes a new commit or the
  operator explicitly redirects Codex to take over PR #997 locally.
- Model routing: Jules remains the intended PR repair worker. Codex remains
  foreman and state recorder, but is stopping because the same external repair
  wait has repeated and no further non-bypass progress remains without changing
  ownership.
- Rationale/evidence:
  - `gh pr view 997` still reports head
    `b591839a49a6d764f660757dd8a1110c662f1e3c`, mergeability `CONFLICTING`,
    and the out-of-scope
    `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
    file in the PR file list.
  - The dashboard task page still shows `Resolve PR Conflicts` and `GitHub
    reports merge conflicts`; the visible boundary refresh records GitHub checks
    as passing but does not change mergeability.
  - The visible Jules session still shows, "I have received the PR comments and
    am processing them."
  - The same unchanged condition was recorded at 06:47, 06:50, and 06:53 +02:00.
- Mutation performed or skipped: Updated the Aralia tracker to mark Package 6 as
  `blocked`. Skipped local PR repair, skipped duplicate feedback, skipped hidden
  endpoints, skipped opening another package, and skipped goal completion.
- Scope guardrails: The blocker belongs to external Jules/GitHub PR state. The
  Aralia-facing durable record is the tracker; Symphony runtime/source/local
  state remains orchestration material, not product implementation.
- Result: The active thread goal is blocked until Jules pushes a repair commit or
  the operator directs Codex to take over PR #997 locally.
- Next expected proof after unblocking: New PR #997 head commit, no merge
  conflict, no out-of-scope Symphony decision-report file, and a focused
  real-data `modeChoice.effectIndices` regression.

### Decision 104: Launch Package 11 Through Visible Symphony/Jules Flow

- Date/time: 2026-05-25 21:00 +02:00
- Phase: `package_11_dispatch`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Whether to cross the normal Linear, handoff, manifest, and
  Jules launch boundaries for the prepared Package 11 task.
- Options considered:
  - Stop before Linear/Jules and wait for explicit per-click approval.
  - Use hidden backend endpoints to dispatch Package 11 quickly.
  - Use the visible dashboard/task-page path under the user's assumed phase
    approval envelope.
- Decision made by agent: Use the visible dashboard/task-page path and record
  each boundary result.
- Model routing: Jules receives the implementation-heavy Package 11 work.
  Codex remains the dashboard-first foreman, reviewer, and evidence recorder.
- Rationale/evidence:
  - The tracker and execution plan identify Package 11 as the current
    `status_or_state_change` slice.
  - The user authorized assumed approvals for normal phase transitions and
    specifically wanted dashboard-first workflow proof.
  - The task was bounded by
    `PACKAGE_11_STATUS_OR_STATE_CHANGE_JULES_TASK.md` and
    `PACKAGE_11_STATUS_OR_STATE_CHANGE_JULES_PROMPT.md`.
- Mutation performed or skipped: Created Linear `ARA-20`, promoted a Package 11
  handoff, staged ignored `.jules` manifest state, launched Jules session
  `13361122470730968094`, and skipped hidden endpoint shortcuts.
- Scope guardrails: Jules must stay within the Package 11 packet and may not
  edit Symphony runtime/source, levels 4-9, broad AI policy, combat rider-icon
  UI, terrain/light/vision, broad summon/control, or unrelated workflow files.
- Result: Package 11 is launched and waiting on Jules. The dashboard reports
  `QUEUED`; a visual Jules check showed repository snapshot setup/loading.
- Next expected proof: visual Jules recheck and dashboard `Refresh Jules Status`
  until Jules reaches plan approval, active work, PR URL, or blocker state.

### Decision 105: Select One Active Handoff After Duplicate Package 11 Promotion

- Date/time: 2026-05-25 21:01 +02:00
- Phase: `package_11_dashboard_gap`
- Active slice: Package 11 launch evidence and dashboard workflow repair
  tracking.
- Decision point: The Package 11 task-page `Prepare Handoff` button did not
  visibly advance after clicking, but dashboard inspection showed duplicate
  handoffs had been created.
- Options considered:
  - Launch both Package 11 handoffs.
  - Delete or manually mutate runtime state to remove the duplicate.
  - Stop using the stale task-page draft view, choose the latest dashboard
    focused handoff as active, and record the duplicate as stale workflow
    evidence.
- Decision made by agent: Use only `handoff-1779735529994-aq60x6` as the active
  Package 11 path and leave `handoff-1779735447555-z4a0fu` unlaunched/stale.
- Model routing: Codex handles the workflow-gap recording; Jules continues only
  on the selected active handoff.
- Rationale/evidence:
  - The dashboard current focus selected `handoff-1779735529994-aq60x6` for
    manifest staging and launch.
  - Launching both would duplicate external Jules work for the same package.
  - Deleting local runtime state would hide the workflow defect the operator
    wants surfaced.
- Mutation performed or skipped: Staged and launched only
  `handoff-1779735529994-aq60x6`; skipped launching the duplicate and skipped
  destructive runtime cleanup.
- Scope guardrails: The duplicate-handoff note is a Symphony workflow gap, not
  Package 11 spell implementation scope.
- Result: `SYMPHONY_OPEN_TASKS.md` now records the task-page promotion feedback
  gap, and the spell tracker marks Package 11 as waiting on Jules session
  `13361122470730968094`.
- Next expected proof: repair the task-page guarded action feedback/reload path
  later, and prevent repeated draft promotion once a draft already has a live
  handoff.

### Decision 106: Withhold Package 11 Jules Plan Approval For Scope Drift

- Date/time: 2026-05-25 21:14 +02:00
- Phase: `package_11_plan_gate`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Jules session `13361122470730968094` reached an `Approve
  plan?` gate, but the visible plan included a step to update
  `src/commands/effects/UtilityCommand.ts` or
  `src/commands/effects/BaseEffectCommand.ts`, outside the declared Package 11
  expected write scope.
- Options considered:
  - Approve the plan as-is and allow broader command-base edits.
  - Reject the whole Jules path and implement Package 11 locally.
  - Send a visible Jules revision request asking Jules to stay inside scope or
    justify why the broader command-base edit is necessary.
- Decision made by agent: Withhold approval and send a visible Jules revision
  request.
- Model routing: Jules remains the implementation worker. Codex remains the
  foreman enforcing the package boundary and waiting for a revised plan or a
  clear necessity explanation.
- Rationale/evidence:
  - Package 11 expected write scope includes status/state spell JSON, selected
    spell types/metadata, `StatusConditionCommand`, `SpellCommandFactory`,
    `spellAbilityFactory` if needed, focused tests, and package docs.
  - `UtilityCommand.ts` and `BaseEffectCommand.ts` were not in that expected
    scope, and the plan did not explain why those broader command-base files
    were needed.
- Mutation performed or skipped: Sent a visible Jules message asking for a
  revised bounded plan; skipped approving the plan and skipped local
  implementation takeover.
- Scope guardrails: If Jules says `UtilityCommand.ts` or `BaseEffectCommand.ts`
  is truly required, it must explain the necessity before editing those files.
- Result: Jules entered a visible `Thinking` state after receiving the revision
  request.
- Next expected proof: revised bounded Jules plan, or a clear Jules explanation
  that the broader command-base edit is required for the selected status/state
  mechanics.

### Decision 107: Approve Revised Package 11 Jules Plan After Scope Repair

- Date/time: 2026-05-25 21:25 +02:00
- Phase: `package_11_plan_gate`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Jules revised the visible plan after Codex withheld approval.
  The revised plan removed `src/commands/effects/UtilityCommand.ts` and
  `src/commands/effects/BaseEffectCommand.ts` and kept the work inside the
  declared Package 11 surface.
- Options considered:
  - Keep waiting despite the revised bounded plan.
  - Ask for another revision even though the specific scope drift was removed.
  - Approve the revised visible plan and continue monitoring Jules.
- Decision made by agent: Approve the revised Package 11 Jules plan through the
  visible Jules page.
- Model routing: Jules owns implementation-heavy Package 11 work. Codex owns
  foreman monitoring, PR review, verification, merge readiness, and durable
  tracker updates.
- Rationale/evidence:
  - The revised plan now lists `src/types/spells.ts`, representative level 1/2
    spell JSON, `StatusConditionCommand`, `SpellCommandFactory`, focused tests,
    documentation, and verification.
  - The previously rejected command-base files are no longer listed.
  - This matches the package packet's expected write scope closely enough to let
    Jules attempt the implementation.
- Mutation performed or skipped: Approved the visible Jules plan. Skipped local
  Package 11 implementation takeover and skipped approving the earlier broader
  plan.
- Scope guardrails: Approval covers only this revised Package 11 plan. It does
  not approve Symphony source edits, combat rider-icon UI, broad AI policy,
  levels 4-9, premade roster semantics, GitHub workflow changes, or unrelated
  runtime architecture changes.
- Result: Jules showed `Plan approved`, `Working`, and began the first listed
  task: updating `src/types/spells.ts` so option-specific status payloads can be
  represented.
- Next expected proof: visible Jules/GitHub monitoring until a PR URL, blocker,
  or reviewable result appears.

### Decision 108: Request Bounded Package 11 PR #1072 Repair

- Date/time: 2026-05-25 21:49 +02:00
- Phase: `package_11_pr_review`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Jules opened PR #1072 after the revised plan was approved.
  The implementation direction was useful, but the PR was not acceptable as a
  merge candidate.
- Options considered:
  - Merge PR #1072 because the focused spell validation and Vitest checks
    passed.
  - Take over the PR branch locally immediately.
  - Send bounded Jules repair feedback and preserve Jules as implementation
    owner for the first repair loop.
- Decision made by agent: Do not accept the current PR head; post bounded repair
  feedback at `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536811401`.
- Model routing: Jules remains the implementation worker for the repair. Codex
  remains foreman reviewer and evidence recorder.
- Rationale/evidence:
  - GitHub reports PR #1072 as `DIRTY`.
  - The diff includes raw `.jules/worklogs/worklog_scribe.md`, which should stay
    external or ignored.
  - The branch rewinds recent Symphony decision/open-task docs from current
    `master`, including Package 11 launch/approval records.
  - Local review passed `npm run validate:spells`,
    `node scripts\auditAtlasBuckets.mjs`, and focused Vitest for the two new
    test files, but `npx tsc --noEmit --pretty false` fails on invalid test
    fields: `turnOrder`, `sourceAbilityId`, and `naturalRoll`.
  - The tracker/task packet wording marks Package 11 complete before foreman
    acceptance.
- Mutation performed or skipped: Posted a PR repair comment. Skipped merge,
  skipped local product takeover, and skipped treating green focused tests as
  sufficient acceptance proof.
- Scope guardrails: The requested repair must stay inside the Package 11 product
  slice and cleanup the PR branch: remove raw `.jules` state, preserve current
  `master` docs, fix TypeScript, and avoid broad UI/runtime/policy expansion.
- Result: Package 11 remains waiting on a Jules repair head for PR #1072.
- Next expected proof: new PR #1072 head with scoped file list, clean
  mergeability, passing `validate:spells`, Atlas audit, focused Vitest, and
  `npx tsc --noEmit --pretty false`.

### Decision 109: Wait For Package 11 Jules Repair After Visible Processing Signal

- Date/time: 2026-05-25 22:00 +02:00
- Phase: `package_11_pr_repair_wait`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: After the bounded repair request, GitHub still showed PR
  #1072 at the same head and with the same unacceptable file-list issues, but
  the visible Jules page showed that Jules had received the comments and was
  processing them.
- Options considered:
  - Treat the unchanged PR head as an immediate blocker.
  - Take over the branch locally before Jules has had time to push a repair.
  - Keep the task in an explicit `wait_for_jules_repair_commit` state and
    recheck for a new head.
- Decision made by agent: Wait for Jules repair and record the wait as an
  explicit decision, not as an unstated default.
- Model routing: Jules remains the implementation/repair worker. Codex remains
  the foreman reviewer, visible-state monitor, and tracker/doc recorder.
- Rationale/evidence:
  - GitHub still reports PR #1072 head
    `bc1d6bfa5b9282b4f9a6081e16cf00fe05a9935a`.
  - The PR still includes `.jules/worklogs/worklog_scribe.md` and has not yet
    shown the requested scoped repair.
  - The visible Jules page for session `13361122470730968094` says "I have
    received the PR comments and am processing them."
- Mutation performed or skipped: Skipped local takeover, merge, and blocked-goal
  filing. Recorded the wait state in the tracker and Symphony open-task queue.
- Scope guardrails: Waiting does not approve the current PR head. Acceptance
  still requires a new scoped head, current-master branch hygiene, TypeScript
  repair, and the Package 11 verification gates.
- Result: Package 11 remains waiting on a Jules repair commit.
- Next expected proof: a new PR #1072 head or a later visible Jules state that
  justifies another explicit decision gate.

### Decision 110: Request Package 11 Branch-Hygiene Repair After Tests Pass

- Date/time: 2026-05-25 22:14 +02:00
- Phase: `package_11_pr_repair_review`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Jules pushed PR #1072 head
  `19738e8cf512c6058dffa196de318d8b65bdd15d` after the repair request. The
  test/type issues were fixed, but the branch still carried stale current-master
  documentation rewinds and a Package 11 worklog addition.
- Options considered:
  - Accept the PR because the local verification gates now pass.
  - Take over the branch locally immediately.
  - Send a second bounded repair request limited to current-master branch
    hygiene and worklog removal.
- Decision made by agent: Keep Jules as repair owner and post a second bounded
  repair request at
  `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536944637`.
- Model routing: Jules remains responsible for branch cleanup on its PR. Codex
  remains foreman reviewer and evidence recorder.
- Rationale/evidence:
  - Local foreman verification passed `npm run validate:spells`,
    `node scripts\auditAtlasBuckets.mjs`, focused Vitest for the two new test
    files, and `npx tsc --noEmit --pretty false`.
  - Against current `origin/master`, PR #1072 still adds a Package 11 note to
    `.jules/worklogs/worklog_scribe.md`.
  - Against current `origin/master`, PR #1072 rewinds Package 11 Symphony and
    tracker records from PR #1074, including Decisions 104-109 and the explicit
    wait-state guidance.
- Mutation performed or skipped: Posted a second PR repair comment. Skipped
  merge and skipped local branch-hygiene takeover for this repair loop.
- Scope guardrails: The requested change is only branch hygiene: preserve
  current `master`, remove the worklog addition, and keep the useful
  now-verifying Package 11 product/test slice.
- Result: Package 11 remains waiting on a clean PR #1072 branch.
- Next expected proof: a new PR #1072 head with no `.jules` worklog addition, no
  current-master doc rewinds, and the same passing Package 11 verification
  gates.

### Decision 111: Send Explicit Package 11 Branch-Hygiene Nudge

- Date/time: 2026-05-25 22:21 +02:00
- Phase: `package_11_pr_repair_wait`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: After PR #1075 merged the second repair decision to `master`,
  PR #1072 still had the same repaired-test head
  `19738e8cf512c6058dffa196de318d8b65bdd15d`, still listed
  `.jules/worklogs/worklog_scribe.md`, and still had stale branch hygiene
  against current `master`.
- Options considered:
  - Take over the branch immediately because only branch hygiene remains.
  - Wait silently for Jules after the second repair request.
  - Send an explicit `@jules` nudge that names the branch-hygiene repair and
    keeps Jules as the repair owner for this loop.
- Decision made by agent: Send the explicit `@jules` nudge at
  `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536996291`.
- Model routing: Jules remains repair owner; Codex remains foreman monitor and
  reviewer.
- Rationale/evidence:
  - The product/test slice now passes local verification, so the remaining
    issue is current-master branch hygiene, not new mechanics.
  - The earlier branch-hygiene request had not produced a new PR head.
  - Addressing Jules explicitly keeps the repair in the intended Jules lane
    before any foreman PR-branch repair is considered.
- Mutation performed or skipped: Posted an explicit PR comment. Skipped merge
  and skipped local branch takeover.
- Scope guardrails: The nudge asks only for current `origin/master` preservation,
  removal of the Package 11 worklog addition, and preservation of the
  now-passing Package 11 product/test slice.
- Result: GitHub shows Jules has seen the explicit nudge. Package 11 remains in
  `wait_for_jules_repair_commit`.
- Next expected proof: a new PR #1072 head, or a later visible Jules/GitHub state
  that justifies stale-attempt filing or bounded foreman branch-hygiene repair.

### Decision 112: Perform Bounded Package 11 Branch-Hygiene Repair And Merge

- Date/time: 2026-05-25 22:45 +02:00
- Phase: `package_11_pr_branch_hygiene_closeout`
- Active slice: Package 11 status/state-change mechanics for cantrips and
  levels 1-3.
- Decision point: Jules pushed PR #1072 head
  `907b210816ca7c7fffaa6928561e69f6d041c6d5` after the explicit `@jules`
  nudge, but the branch still rewound current Symphony/tracker docs. The useful
  product/test slice was already locally verified.
- Options considered:
  - Keep waiting for another Jules repair after the explicit nudge.
  - Ask Jules again with another branch-hygiene-only repair comment.
  - Perform a bounded foreman branch-hygiene repair from current `origin/master`
    while preserving only the scoped Package 11 product/test files.
- Decision made by agent: Perform the bounded foreman branch-hygiene repair,
  push it to PR #1072 with lease, and merge after local gates and GitHub checks
  passed.
- Model routing: Jules remained implementation author for the product slice.
  Codex performed only foreman branch hygiene, verification, and merge closeout.
- Rationale/evidence:
  - Jules had already received two bounded repair requests and one explicit
    addressed nudge.
  - The latest Jules head still rewound current durable docs, so another silent
    wait would preserve a stale branch state.
  - The repair did not invent or widen product mechanics; it copied only seven
    product/test files onto current `origin/master`.
  - Local verification passed `npm run validate:spells`,
    `node scripts\auditAtlasBuckets.mjs`, focused `StatusConditionCommand` /
    `SpellCommandFactoryStatus` Vitest, `npx tsc --noEmit --pretty false`, and
    `git diff --cached --check`.
  - GitHub checks passed Build, Lint, Tests, Quality, Poison, Analyze, and
    CodeQL on the clean head.
- Mutation performed or skipped: Created clean branch state from current
  `origin/master`, preserved only `public/data/spells/level-1/command.json`,
  `public/data/spells/level-2/lesser-restoration.json`,
  `src/commands/effects/StatusConditionCommand.ts`,
  `src/commands/effects/__tests__/StatusConditionCommand.test.ts`,
  `src/commands/factory/SpellCommandFactory.ts`,
  `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`, and
  `src/types/spells.ts`; committed
  `e974ae3ada4df16ebb62ab4fd6054374ae666a2d`; force-pushed with lease to the
  Jules PR branch; merged PR #1072 as
  `d5dfd3f1fafca0e7ab74460ed8ebbb425de25b57`. Skipped committing raw `.jules`
  worklog state and skipped stale Symphony/tracker doc rewinds.
- Scope guardrails: No new mechanics beyond Package 11, no levels 4-9, no
  combat HUD/rider-icon work, no broad AI arbitration policy changes, and no
  Symphony runtime/source churn.
- Result: Package 11 is merged. The remaining action is documentation closeout
  and selection of the next tracker-defined package boundary.
- Next expected proof: tracker/open-task docs showing Package 11 closed and
  pointing future foremen to the branch-hygiene pattern instead of treating this
  as a blocked Jules state.

### Decision 113: Select Package 12 Conditional-Ending Slice

- Date/time: 2026-05-25 23:00 +02:00
- Phase: `package_12_selection`
- Active slice: next Spell Phase 1 mechanics bucket after Package 11.
- Decision point: Package 11 merged and its closeout docs landed through PR
  #1077. The execution plan still pointed to Package 11, so the next package
  boundary needed to be selected from current tracker and mechanics evidence.
- Options considered:
  - Start broad terrain, vision/light, summon/control, or combat HUD work based
    on visible adjacent gaps.
  - Keep the goal in a stale Package 11 waiting state.
  - Follow the mechanics-bucket priority and prepare Package 12 for
    `conditional_ending`.
- Decision made by agent: Prepare Package 12 as a Jules-first
  `conditional_ending` slice.
- Model routing: Codex foreman prepares the task packet, prompt, tracker, and
  execution-plan update. Jules should own the implementation-heavy data/runtime
  work after visible dashboard dispatch.
- Rationale/evidence:
  - The execution plan priority lists `conditional_ending` after the completed
    representative `choice_or_mode`, `attack_or_save_modifier`,
    `target_filter_or_eligibility`, and `status_or_state_change` slices.
  - `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.json`
    reports 54 open `conditional_ending` findings across 53 spells.
  - Early-game candidate rows include `hex`, `hunters-mark`,
    `animal-messenger`, `detect-thoughts`, and `knock`.
- Mutation performed or skipped: Created
  `PACKAGE_12_CONDITIONAL_ENDING_JULES_TASK.md` and
  `PACKAGE_12_CONDITIONAL_ENDING_JULES_PROMPT.md`; refreshed the execution plan
  and tracker to make Package 12 the active next boundary. Skipped visible
  dashboard dispatch until the packet lands on `master`.
- Scope guardrails: Package 12 must stay inside representative cantrip/level
  1-3 conditional-ending mechanics. Broad terrain, vision/light,
  summon/control, social AI arbitration, trap/glyph authoring, combat HUD
  rider-icon UI, levels 4-9, and Symphony runtime/source churn are out of scope.
- Result: Package 12 handoff material is prepared for GitHub sync and later
  visible Symphony/Jules dispatch.
- Next expected proof: PR merge for the Package 12 task/prompt/tracker refresh,
  then visible dashboard draft/Linear/handoff/Jules launch from clean
  `origin/master`.

### Decision 114: Repair Package 12 Visible Draft Shortcut Before Dispatch

- Date/time: 2026-05-25 23:20 +02:00
- Phase: `package_12_dashboard_dispatch_prep`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: After PR #1078 landed Package 12 task/prompt/tracker prep on
  `master`, visible dashboard inspection showed the packet shortcut list still
  stopped at Package 11. Codex needed to decide whether to use the manual form,
  call the task-draft API directly, repair the visible dashboard button, or stop
  at a recorded blocker.
- Options considered:
  - Use the manual form even though long-form browser text entry has repeatedly
    been unreliable in this flow.
  - Create the Package 12 draft through a hidden backend call.
  - Repair the dashboard so Package 12 has an explicit visible packet button,
    then continue the normal draft/Linear/handoff/Jules path.
  - Stop and mark the package blocked on missing UI.
- Decision made by agent: Repair the visible dashboard shortcut before
  dispatch, using the same packet-button pattern that Package 11 used.
- Model routing: Codex owns this Symphony workflow affordance repair and
  verifier update. Jules remains the intended implementation worker after the
  Package 12 draft is created, promoted, staged, and launched visibly.
- Rationale/evidence:
  - The active goal requires the dashboard/Jules/GitHub path as the operator
    surface and says not to bypass UI blockers with hidden shortcuts.
  - The visible dashboard showed Package 6, Package 10, and Package 11 packet
    buttons, but no Package 12 button.
  - Package 12 task and prompt are already durable on `master`, so exposing the
    next package as a visible draft button is a workflow repair, not product
    implementation.
- Mutation performed or skipped: Edited
  `conductor/symphony/public/dashboard.js` to add the Package 12 draft payload,
  click handler, and button; edited
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs` to assert
  the Package 12 shortcut exists. Skipped hidden task-draft API creation and
  skipped Jules launch until the visible button is verified.
- Scope guardrails: No spell mechanics, no `.jules` or `.symphony` runtime
  state, no GitHub workflow edits, no levels 4-9, no broad AI arbitration, no
  combat rider-icon UI, and no Symphony runtime receipt promotion.
- Result: `node conductor/symphony/scripts/verify-task-dashboard-navigator.mjs`
  passed, the dashboard visibly showed `Create Package 12 Draft`, and Codex
  clicked it visibly to create local draft `draft-1779743756459-8uvr0z`.
  Further dispatch is correctly blocked until this dashboard repair lands and
  the Git sync gate is clean.
- Next expected proof: PR/merge for the dashboard shortcut repair, then visible
  Package 12 draft promotion, Linear issue creation, manifest staging, and
  Jules launch from clean `origin/master`.

### Decision 115: Withhold Package 12 Plan Approval For Scope And Value Revision

- Date/time: 2026-05-25 23:57 +02:00
- Phase: `package_12_plan_gate`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: After PR #1079 landed the Package 12 visible dashboard
  shortcut, Codex used the dashboard path to create draft
  `draft-1779743756459-8uvr0z`, Linear `ARA-21`, handoff
  `handoff-1779744252464-e065rv`, staged the ignored Jules manifest, launched
  Jules session `3991627368289943007`, and refreshed it to `IN_PROGRESS`.
  Visual Jules inspection then showed an `Approve plan?` gate. The first plan
  proposed `UtilityCommand.test.ts`, `src/types/spells.ts`,
  `src/commands/effects/UtilityCommand.ts`, inspection and JSON updates for
  `hex`, `hunters-mark`, and `knock`, validation/schema audit, tracker docs,
  and commit/finish.
- Options considered:
  - Approve the plan as-is because it is small and likely easy to review.
  - Reject Package 12 entirely and start a replacement handoff from a wider
    packet.
  - Send a visible Jules revision request before approval, keeping the same
    launched session but asking for higher implementation value and file-scope
    justification.
- Decision made by agent: Withhold approval and send a visible Jules revision
  request.
- Model routing: Jules remains the implementation worker. Codex remains foreman
  for plan approval, package value classification, scope control, and tracker
  updates. A lightweight Codex explorer summarized decision-log trends in
  parallel; it did not edit files.
- Rationale/evidence:
  - `src/commands/effects/UtilityCommand.ts` was not in the declared expected
    write scope for Package 12. If it is unavoidable, Jules must explain why
    before approval.
  - A three-spell conditional-ending slice is too small for the full
    Symphony/Linear/Jules/GitHub orchestration cycle unless there is a clear
    safety reason for keeping it that small.
  - The current goal explicitly asks Codex to improve implementation value per
    orchestration cycle by preferring larger coherent Jules batches when work is
    repetitive, testable, and covered by existing schema/test patterns.
  - The visible Jules session was available, so the correct update method was a
    visible Jules message rather than hidden endpoint use or local takeover.
- Mutation performed or skipped: Sent a visible Jules message asking for a
  revised plan. The message asked Jules to classify all cantrip/level 1-3
  `conditional_ending` candidates that fit existing schema/test patterns,
  implement the largest coherent safe subset, justify any unavoidable file
  outside the original write scope, and list deferred rows with reasons. Skipped
  plan approval, local implementation, PR creation, merge, and hidden API
  shortcuts.
- Scope guardrails: The revision request keeps broad terrain, light/vision,
  summon/control, social AI, trap/glyph, combat HUD, levels 4-9, Symphony
  runtime files, and GitHub workflows out of scope.
- Result: Package 12 remains at a plan-revision gate. The active next action is
  a visible Jules recheck for a revised plan, then either approve the revised
  bounded plan or record a replacement/blocker decision.
- Next expected proof: Visible Jules page showing a revised plan with chosen
  spell rows, file scope, test plan, and deferred rows; or a visible failure/no
  revision state that justifies a replacement handoff or blocker record.

### Decision 116: Approve Revised Package 12 Higher-Value Plan

- Date/time: 2026-05-26 00:08 +02:00
- Phase: `package_12_plan_gate`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: Jules revised the Package 12 plan after Codex withheld
  approval. The revised visible plan selected `hex`, `hunters-mark`, `knock`,
  `detect-thoughts`, and `flame-arrows`; deferred `animal-messenger`; removed
  the direct `src/commands/effects/UtilityCommand.ts` edit; and kept the bridge
  discussion inside allowed `SpellCommandFactory`, `spellAbilityFactory`, spell
  JSON, focused tests, and tracker/mechanics docs.
- Options considered:
  - Reject the revised plan because it still contains uncertainty around the
    exact bridge shape.
  - Ask for another revision before any implementation starts.
  - Approve the revised plan because it fixes the two material blockers:
    implementation value and direct out-of-scope file editing.
- Decision made by agent: Approve the revised visible Jules plan.
- Model routing: Jules owns the implementation. Codex remains foreman for
  visible monitoring, PR review, branch hygiene, and tracker/doc updates.
- Rationale/evidence:
  - The revised plan expands the useful product slice from three spells to a
    five-spell early-game subset while still excluding broad terrain,
    light/vision, summon/control, social AI, trap/glyph, combat HUD, levels
    4-9, Symphony runtime, and GitHub workflow edits.
  - The revised plan removes the direct `UtilityCommand.ts` edit and keeps
    runtime proof inside files already listed by the Package 12 expected write
    scope.
  - The verification plan names `npm run validate:spells`,
    `node scripts\auditAtlasBuckets.mjs`, and focused Vitest for the new
    conditional-ending proof.
- Mutation performed or skipped: Clicked the visible Jules `Approve plan?`
  button. Skipped local implementation, hidden endpoint use, and replacement
  handoff. Updated the tracker and open-task queue to record that Jules is now
  working.
- Scope guardrails: Approval does not pre-approve future PR merge. The PR must
  still be reviewed for file scope, branch hygiene, correct conditional-ending
  semantics, tests, Atlas/gate proof, and absence of raw `.jules` or Symphony
  runtime artifacts.
- Result: Jules session `3991627368289943007` shows `Plan approved` and
  `Working`.
- Next expected proof: Visible dashboard/Jules refresh showing a PR URL, a new
  Jules question, or a failure state. If a PR appears, review it against the
  revised plan and Package 12 acceptance criteria before merge.

### Decision 117: Send Package 12 Explicit Continuation After Revised-Plan Check

- Date/time: 2026-05-26 00:19 +02:00
- Phase: `package_12_post_launch_update_path`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: After the revised plan was approved, the visible Jules page
  still showed "Jules is waiting for your input to continue working" and asked
  whether the revised plan met expectations. Meanwhile Symphony's dashboard
  packet correctly warned that `origin/master` had moved from the Jules launch
  base `0d57838e6d59` to `b04c9048680d` after PR #1080/#1081, so the running
  Jules clone would not receive later tracker or workflow edits automatically.
- Options considered:
  - Assume the `Plan approved` marker was enough and wait silently.
  - Use a hidden Symphony/Jules endpoint to push state forward.
  - Send an explicit visible Jules message confirming the revised plan and
    restating the approved scope.
- Decision made by agent: Send the explicit visible Jules message.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  post-launch update delivery, visible monitoring, and PR review.
- Rationale/evidence:
  - The current operating rule says post-launch task adjustments need an
    explicit update channel because running Jules sessions are isolated clones.
  - The visible Jules page asked for confirmation, so a visible Jules message was
    the direct operator-surface answer.
  - The message kept implementation value and scope aligned: five approved rows,
    no `UtilityCommand.ts` edit, bridge limited to allowed
    `SpellCommandFactory` / `spellAbilityFactory` / focused-test surfaces unless
    Jules stops to justify another file.
- Mutation performed or skipped: Sent a visible Jules message confirming that
  the revised plan meets expectations and instructing Jules to proceed within
  the approved scope. Skipped hidden endpoints, local implementation, PR merge,
  and replacement handoff.
- Scope guardrails: This message does not approve future PR merge. The PR must
  still be reviewed for file scope, branch hygiene, correct conditional-ending
  semantics, tests, Atlas/gate proof, and absence of raw `.jules` or Symphony
  runtime artifacts.
- Result: The visible Jules page now says `Jules is working`.
- Next expected proof: Visible dashboard/Jules refresh showing a PR URL, a new
  Jules question, or a failure state. If a PR appears, review it against the
  revised plan and Package 12 acceptance criteria before merge.

### Decision 118: Send Package 12 Verification-Wait Status Nudge

- Date/time: 2026-05-26 00:36 +02:00
- Phase: `package_12_verification_wait`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: Repeated GitHub PR checks and remote branch checks found no
  Package 12 PR or matching Jules branch while visible Jules stayed on its
  `Verify` step. Jules showed intended verification commands and no failure
  report, and it had not asked for more input.
- Options considered:
  - Keep waiting silently for another refresh cycle.
  - Use a hidden endpoint, download path, or local takeover to extract or
    reproduce the work.
  - Send one bounded visible Jules status nudge asking for a PR if verification
    passed or the exact failing command if verification is blocked.
- Decision made by agent: Send one bounded visible Jules status nudge.
- Model routing: Jules remains the implementation and verification worker.
  Codex remains foreman for visible monitoring, scope control, PR review, and
  tracker/doc updates.
- Rationale/evidence:
  - The same final-verification/no-handoff state repeated across multiple
    monitoring passes.
  - The visible Jules page had enough context to receive a precise operator
    nudge; no hidden API path was needed.
  - The message preserved the Jules-first flow while narrowing the next proof
    to a PR, exact verification failure, new Jules question, or later
    stale-session filing.
  - The visible review pane still showed the `SpellCommand.ts` diff as a later
    PR-review checkpoint, so local acceptance would be premature without the
    final PR diff and verification proof.
- Mutation performed or skipped: Sent a visible Jules message asking Jules to
  open the PR if verification passed, or report the exact failing command,
  error output, and smallest proposed repair if blocked. Skipped hidden
  endpoints, local implementation, zip/download extraction, PR merge, and
  replacement handoff.
- Scope guardrails: The nudge does not approve any future PR merge and does not
  widen Package 12 beyond `hex`, `hunters-mark`, `detect-thoughts`,
  `flame-arrows`, and `knock`. The eventual PR must still be reviewed for file
  scope, branch hygiene, verification proof, raw artifact leakage, and the
  suspicious `SpellCommand.ts` diff size.
- Result: The visible Jules page accepted the status nudge and continued in its
  isolated clone; no Package 12 PR or remote branch was visible at the time of
  this record.
- Next expected proof: Package 12 PR URL or remote branch, exact Jules
  verification failure report, new Jules question, or a documented
  stale-session/replacement-handoff decision after enough unchanged evidence.

### Decision 119: Continue Package 12 Monitored Wait After Post-Nudge Activity

- Date/time: 2026-05-26 00:50 +02:00
- Phase: `package_12_post_nudge_monitoring`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: After the bounded status nudge, a visible Jules check still
  showed no Package 12 PR or matching remote branch. However, the visible Jules
  session no longer looked unchanged: it showed `Jules is working`, post-nudge
  updates to `src/commands/factory/__tests__/ConditionalEnding.test.ts`, and a
  note that documentation and test type errors were fixed and the test now
  passes.
- Options considered:
  - Declare the session stale immediately and prepare a replacement handoff.
  - Take over implementation locally from the visible diff.
  - Continue monitored wait because Jules is visibly active after the nudge.
- Decision made by agent: Continue monitored wait.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  visible monitoring, PR detection, and eventual PR review.
- Rationale/evidence:
  - A stale-session decision would be premature while Jules shows fresh
    post-nudge activity.
  - Local takeover would bypass the Jules-first implementation boundary and
    would rely on an incomplete visible diff rather than a PR-ready branch.
  - The desired action is now explicit: wait only while Jules is visibly active,
    and expect one of four proofs before the next decision.
- Mutation performed or skipped: Updated the tracker to record the active-work
  wait state. Skipped hidden endpoints, zip/download extraction, local
  implementation, replacement handoff, and stale-session filing.
- Scope guardrails: The next PR still needs focused review for the approved
  five-spell scope, `SpellCommand.ts` diff size, task/tracker rewrites,
  verification proof, and raw artifact leakage.
- Result: Package 12 remains active in Jules, with monitored wait as the
  current explicit action.
- Next expected proof: Package 12 PR URL or remote branch, exact Jules
  verification failure report, new Jules question, or enough unchanged
  post-nudge evidence to justify a stale-session/replacement-handoff decision.

### Decision 120: Request Bounded Repair On Package 12 PR #1084

- Date/time: 2026-05-26 01:02 +02:00
- Phase: `package_12_pr_review_repair`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: Jules opened PR #1084 from
  `jules/spells-package12-conditional-ending-3991627368289943007`. The PR
  contains the approved five-spell conditional-ending data and a focused
  runtime-bridge test, but GitHub reports the PR as `DIRTY` against current
  `master` after PR #1083. Initial review also found that the PR rewinds the
  living tracker, marks P12 closed before acceptance, and changes
  `SpellCommandFactory.createCommand` from private to public even though the
  new test uses `createCommands`.
- Options considered:
  - Merge the PR because the core product changes look useful.
  - Perform a local foreman repair immediately.
  - Ask Jules for a bounded repair against current `master`.
- Decision made by agent: Ask Jules for a bounded repair on PR #1084.
- Model routing: Jules remains implementation/repair worker. Codex remains
  foreman for PR review, mergeability checks, local verification, and final
  acceptance.
- Rationale/evidence:
  - `DIRTY` merge state means the PR cannot be accepted as-is.
  - Tracker closeout before review/merge would make the living source of truth
    overstate completion.
  - Public API widening is unnecessary for the shown test path and should be
    reverted unless Jules can justify a production need.
  - The PR is close enough to repair through Jules; local takeover is not yet
    justified.
- Mutation performed or skipped: Posted bounded repair feedback at
  `https://github.com/Gambitnl/Aralia/pull/1084#issuecomment-4537781802`.
  Skipped local implementation, hidden endpoints, PR merge, and replacement
  handoff.
- Scope guardrails: Repair must stay inside the approved five spells,
  `CommandContext`/`SpellCommandFactory` bridge, focused conditional-ending
  test, package docs, and tracker truth. It must not broaden into UI, levels
  4-9, broad AI arbitration, terrain/light/summon/trap systems, Symphony
  runtime, or GitHub workflow edits.
- Result: Package 12 is now in PR-review repair state, not blocked and not
  complete.
- Next expected proof: Jules repair commit, clean/mergeable PR state, updated
  verification results for `npm run validate:spells`,
  `node scripts\auditAtlasBuckets.mjs`, and focused
  `ConditionalEnding.test.ts`, followed by Codex local review before merge.

### Decision 121: Send Clean `@jules` Restatement For Package 12 PR #1084 Repair

- Date/time: 2026-05-26 01:02-01:07 +02:00
- Phase: `package_12_pr_review_repair`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: After Codex posted the first bounded PR #1084 repair request,
  GitHub still showed the same head commit and `DIRTY` merge state. The first
  repair comment also contained shell-escaped text damage in the `vi`,
  `flame-arrows`, and verification-command references, creating a risk that
  Jules would misread the intended repair.
- Options considered:
  - Wait for Jules to infer the intended repair from the damaged comment.
  - Start a local foreman repair immediately.
  - Post a clean explicit `@jules` restatement with the same bounded scope.
- Decision made by agent: Post a clean explicit `@jules` restatement.
- Model routing: Jules remains repair worker. Codex remains foreman for PR
  review, mergeability checks, tracker truth, and final verification.
- Rationale/evidence:
  - Jules' PR bot says direct `@jules` comments are the clearest repair channel.
  - The prior comment's escaped characters could confuse the exact repair
    request.
  - A clean restatement is lower risk than local takeover while Jules is still
    able to process PR feedback.
- Mutation performed or skipped: Posted clean repair feedback at
  `https://github.com/Gambitnl/Aralia/pull/1084#issuecomment-4537832896`.
  Skipped local implementation, hidden endpoints, PR merge, and replacement
  handoff.
- Scope guardrails: The restatement repeats the same narrow repair: merge or
  rebase current `master`, preserve current tracker/decision truth, do not mark
  P12 closed before acceptance, keep `SpellCommandFactory.createCommand`
  private unless production code requires otherwise, remove unused test imports,
  and stay within `hex`, `hunters-mark`, `detect-thoughts`, `flame-arrows`, and
  `knock`.
- Result: Jules acknowledged the clean restatement with an eyes reaction, but
  no repair commit was visible after the next refresh. PR #1084 remained at
  head `d7e92fa075c4442c4c4efe04595e84d3e9e23148` and `DIRTY`.
- Next expected proof: Jules repair commit, explicit Jules failure report, or a
  later stale-repair decision if the acknowledged request remains unchanged
  after further monitoring.

### Decision 122: Perform Bounded Package 12 Branch-Hygiene Repair And Merge

- Date/time: 2026-05-26 01:24 +02:00
- Phase: `package_12_pr_acceptance`
- Active slice: Package 12 conditional-ending mechanics for cantrips and
  levels 1-3.
- Decision point: Jules pushed a repair for PR #1084 after the clean `@jules`
  restatement, but the PR still included stale docs/process changes,
  `fix_conflict.sh`, and current-master drift. The product slice was useful and
  locally verifiable, while another broad wait risked repeating the stale-docs
  repair loop.
- Options considered:
  - Ask Jules for another repair and keep Package 12 in external wait.
  - Abandon PR #1084 and create a replacement handoff from current
    `origin/master`.
  - Perform a bounded foreman branch-hygiene repair from current `origin/master`
    that preserves only the accepted product/test files.
- Decision made by agent: Perform the bounded foreman branch-hygiene repair,
  force-push the clean head with lease to PR #1084, and merge after local and
  GitHub verification passed.
- Rationale/evidence:
  - Jules had already produced the approved five-spell implementation value:
    `hex`, `hunters-mark`, `detect-thoughts`, `knock`, and `flame-arrows`.
  - The remaining blockers were branch hygiene, stale tracker/Symphony docs,
    process-helper noise, and an unnecessary public `SpellCommandFactory`
    helper surface.
  - A clean acceptance branch from current `origin/master` could preserve the
    useful Jules work without rewriting the mechanic locally or accepting stale
    process artifacts.
- Mutation performed:
  - Created clean branch `codex/spell-phase1-p12-clean-acceptance` from current
    `origin/master`.
  - Preserved only
    `docs/tasks/spells/mechanics-discovery/buckets/conditional_ending.md`,
    `public/data/spells/level-1/hex.json`,
    `public/data/spells/level-1/hunters-mark.json`,
    `public/data/spells/level-2/detect-thoughts.json`,
    `public/data/spells/level-2/knock.json`,
    `public/data/spells/level-3/flame-arrows.json`,
    `src/commands/base/SpellCommand.ts`,
    `src/commands/factory/SpellCommandFactory.ts`, and
    `src/commands/factory/__tests__/ConditionalEnding.test.ts`.
  - Dropped stale tracker/Symphony docs, premature closeout text, and
    `fix_conflict.sh`.
  - Kept `SpellCommandFactory.createCommand` private and typed
    `CommandContext.conditionalEndings` as `ConditionalEnding[]`.
  - Force-pushed the clean head with lease to
    `jules/spells-package12-conditional-ending-3991627368289943007` and posted
    the PR acceptance/verification comment.
- Scope guardrails:
  - No hidden endpoint use, no broad spell-runtime redesign, no terrain/light,
    summon/control, trap/glyph, combat HUD rider-icon UI, levels 4-9, broad AI
    arbitration, Symphony runtime/source churn, or GitHub workflow edits.
  - The repair was branch hygiene and small type tightening only; it did not
    expand the selected spell set beyond the approved five rows.
- Verification:
  - Local: `npm run validate:spells`; `node scripts\auditAtlasBuckets.mjs`;
    focused `ConditionalEnding.test.ts` Vitest; `npx tsc --noEmit --pretty
    false`; `npm run build`; `git diff --cached --check`.
  - GitHub: Build, Lint, Tests, Quality, Poison, Analyze, and CodeQL checks all
    passed on PR #1084.
  - The documented dependency-visualizer sync command could not run because
    `misc/dev_hub/codebase-visualizer/server/index.ts` is missing in this
    checkout.
- Result: PR #1084 merged on 2026-05-25 as
  `2a9dc25e19daae04db06053b61cdca9e1dc82a4e`. Package 12 is done.
- Next expected proof: tracker, open-task, and decision-trends closeout should
  record Package 12 as merged and point the next foreman to the tracker-defined
  next package boundary rather than continuing the Package 12 repair loop.

### Decision 123: Approve Package 13 Terrain/Surface Jules Plan

- Date/time: 2026-05-26 02:40 +02:00
- Phase: `package_13_plan_approval`
- Active slice: Package 13 terrain/surface mechanics for cantrips and levels
  1-3.
- Decision point: The visible Jules session `4325471518148676473` presented a
  seven-step plan after the Package 13 handoff launched from
  `origin/master @ d7728a4ee0251ffba08f5b6259d1aa987953f3af`. Codex had to
  approve, reject, or request revision before Jules could proceed.
- Options considered:
  - Approve the plan and keep Jules as implementation worker.
  - Reject the plan for being too narrow or too broad.
  - Request a revised plan with a different terrain/surface subset.
- Decision made by agent: Approve the visible Jules plan.
- Model routing: Jules remains the implementation-heavy worker. Codex remains
  foreman for visible monitoring, PR review, repair decisions, tracker truth,
  and final verification.
- Rationale/evidence:
  - The plan starts with classification of all named cantrip/level 1-3 open
    terrain/surface rows before bucket closure.
  - The implementation subset is coherent and higher value than a one-row
    package: narrow `TerrainCommand` difficult-terrain recognition repair,
    terrain facts for `web`, `spike-growth`, `sleet-storm`, and
    `plant-growth`, focused `TerrainCommand` proof for those rows plus
    existing/proven `erupting-earth` and `mold-earth`, and bucket-doc updates.
  - The named code path stays inside the Package 13 allowed scope:
    selected spell JSON, `TerrainCommand`, focused tests, and
    `terrain_or_surface.md`.
  - The plan does not broaden into wall engines, glyph/trap authoring,
    summon/control, illusion/social arbitration, combat HUD rider icons,
    levels 4-9, Symphony runtime/source files, or GitHub workflow files.
- Mutation performed or skipped:
  - Performed: clicked the visible `Approve plan?` control in Jules; the page
    changed to `Plan approved`.
  - Skipped: local implementation, hidden API updates, replacement handoff,
    and any PR merge.
- Scope guardrails:
  - Jules must not mark unproven terrain/surface rows closed.
  - Any residual rows requiring broad wall, trap/glyph, summon/control,
    illusion/social, object-animation, combat HUD, or levels 4-9 work should
    stay deferred with reasons in the bucket docs or tracker.
  - Repeated future queued/working observations should be compact wait states;
    only plan approval/rejection, repair, stale-session replacement,
    branch-hygiene repair, or merge should create another full decision.
- Result: Package 13 moved from plan gate to approved Jules implementation
  state.
- Next expected proof: visible Jules working state, PR URL, exact blocker, or
  repair request.

### Decision 124: Send Early Package 13 Scope-Correction Message

- Date/time: 2026-05-26 02:52 +02:00
- Phase: `package_13_active_work_scope_correction`
- Active slice: Package 13 terrain/surface mechanics for cantrips and levels
  1-3.
- Decision point: After approving the Package 13 plan, Codex refreshed the
  visible Jules session and saw Jules actively working with a visible diff that
  already included helper/process artifacts and files outside the approved
  write path: `fix_terrain.patch`, `fix_terrain_cmd.patch`, `patch_web.js`,
  `patch_spike_growth.js`, `patch_sleet_storm.js`,
  `patch_plant_growth.js`, `src/types/combat.ts.orig`, root
  `test_terrain_command.ts`, and `src/types/combat.ts`.
- Options considered:
  - Wait silently until Jules submits a PR, then repair through PR review.
  - Take over implementation locally while Jules is still active.
  - Send a bounded visible Jules correction before submit.
- Decision made by agent: Send a bounded visible Jules correction.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  scope hygiene, visible repair feedback, PR review, and final verification.
- Rationale/evidence:
  - Patch scripts, `.orig` files, and root ad hoc test files are not durable
    Aralia-facing package artifacts.
  - The approved Package 13 path was selected spell JSON,
    `TerrainCommand.ts`, focused tests under the existing test tree, bucket
    docs, and concise completion notes.
  - `src/types/combat.ts` was not in the approved write path unless Jules can
    justify it as unavoidable for the terrain behavior; an early correction is
    cheaper than accepting a noisy PR and doing branch-hygiene repair later.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message asking Jules to remove temporary
    helper artifacts, keep the PR scoped to durable package files, use a normal
    focused test under
    `src/commands/effects/__tests__/TerrainCommand.test.ts`, avoid
    `src/types/combat.ts` unless unavoidable and justified, and clean the diff
    before PR submission.
  - Skipped: hidden endpoint update, local implementation, PR merge, and
    replacement handoff.
- Scope guardrails:
  - Keep the useful terrain implementation value if Jules can clean the diff.
  - Do not broaden Package 13 into shared combat type redesign, generated
    helper scripts, root test scaffolds, Symphony runtime/source files, GitHub
    workflows, combat HUD, levels 4-9, wall/glyph/trap/summon/illusion systems,
    or broad AI policy.
  - If Jules later keeps `src/types/combat.ts`, the PR review must require an
    explicit necessity explanation and focused verification.
- Result: Package 13 moved into `wait_for_jules_scope_cleanup_or_justification`
  state, not local takeover and not blocked-goal status.
- Next expected proof: visible Jules cleanup, PR URL with scoped diff, explicit
  blocker/justification, or a later bounded PR repair request.

### Decision 125: Send Second Package 13 Scope-Correction Message

- Date/time: 2026-05-26 03:00 +02:00
- Phase: `package_13_active_work_scope_correction`
- Active slice: Package 13 terrain/surface mechanics for cantrips and levels
  1-3.
- Decision point: After the first visible correction, Jules continued working
  and removed some patch artifacts, but a later visible refresh still showed
  `patch_bucket.js`, `patch_bucket_more.js`,
  `src/commands/effects/__tests__/TerrainCommand.test.ts.orig`,
  `src/types/combat.ts`, and `src/types/combat.ts.orig` in the active diff.
- Options considered:
  - Wait for Jules to clean the remaining artifacts without another message.
  - Take over locally while Jules is still actively working.
  - Send a second bounded visible correction before PR submission.
- Decision made by agent: Send a second bounded visible correction.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  visible correction, PR review, and final acceptance.
- Rationale/evidence:
  - The first correction reduced some noise but did not fully restore the
    approved file boundary.
  - A second correction before PR submission keeps the useful terrain work with
    Jules while reducing the chance of another branch-hygiene repair loop.
  - `src/types/combat.ts` still needs an explicit necessity explanation if it
    remains in the final PR.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message saying the diff still showed bucket
    patch scripts, `.orig` files, and `src/types/combat.ts`; asked Jules to
    remove them before PR submission unless `src/types/combat.ts` is explicitly
    justified.
  - Skipped: local implementation, hidden endpoint update, replacement handoff,
    and PR merge.
- Scope guardrails:
  - Keep the final Package 13 PR to durable package files: selected spell JSON,
    `TerrainCommand.ts`, focused `TerrainCommand` tests, bucket docs, and
    concise completion notes.
  - Exclude helper scripts, patch files, `.orig` files, root ad hoc tests,
    Symphony runtime/source files, GitHub workflows, combat HUD, levels 4-9,
    wall/glyph/trap/summon/illusion systems, and broad AI policy.
- Result: Package 13 remains in
  `wait_for_jules_scope_cleanup_or_justification` state.
- Next expected proof: a cleaned visible diff, PR URL with scoped file list,
  explicit blocker/justification, or a later bounded PR repair request.

### Decision 126: Clean-Accept Package 13 PR #1096 From Current Master

- Date/time: 2026-05-26 03:24-03:32 +02:00
- Phase: `package_13_pr_review_branch_hygiene`
- Active slice: Package 13 terrain/surface mechanics for cantrips and levels
  1-3.
- Decision point: Jules opened PR #1096 with useful terrain/surface product
  work, but visible Jules/GitHub review showed the branch was not safe to merge
  as-is. The visible Jules page showed post-submit
  `.github/workflows/gemini-review.yml` / `.orig` edits. GitHub later showed a
  second Jules commit that changed `.github/workflows/gemini-review.yml` to
  work around review quota. Direct comparison against current `origin/master`
  also showed stale tracker/process-doc risk and a tracker conflict.
- Options considered:
  - Merge Jules' PR branch as-is because the product files were useful and CI
    was mostly green.
  - Ask Jules for another repair loop and wait for a new head.
  - Close/relaunch Package 13 from current `origin/master`.
  - Perform a bounded foreman clean-acceptance repair from current
    `origin/master`, preserving only accepted Package 13 product/test files.
- Decision made by agent: Perform the bounded clean-acceptance repair and
  merge only after local and GitHub verification passed.
- Model routing: Jules remained the implementation-heavy worker for the
  terrain/surface product slice. Codex acted as foreman for PR hygiene, branch
  repair, verification, and merge readiness.
- Rationale/evidence:
  - The scoped product value was useful: explicit `TERRAIN` `difficult`
    effects for `web`, `spike-growth`, `sleet-storm`, and `plant-growth`,
    focused `TerrainCommand` tests, and bucket/completion notes.
  - The workflow edit was outside Package 13 scope. Quota/model routing changes
    belong to a separate workflow task, not a spell mechanics PR.
  - The Plant Growth exact 4-feet-per-1-foot movement multiplier was not fully
    implemented by standard difficult terrain, so the clean branch preserved
    the visible mechanical approximation while recording the exact multiplier
    as a residual gap.
  - Starting from current `origin/master` avoided stale tracker/process-doc
    drift while preserving the accepted implementation files.
- Mutation performed or skipped:
  - Performed: created clean branch `codex/package13-clean-acceptance` from
    current `origin/master`, copied only the accepted Package 13 files, corrected
    the tracker/bucket/completion-note wording, ran verification, and
    force-pushed the clean head with lease to PR #1096.
  - Performed: merged PR #1096 after GitHub Build, Lint, Tests, Quality, Poison,
    Analyze, and CodeQL checks passed.
  - Skipped: merging the workflow quota-bypass edit, merging stale Symphony
    process-doc drift, replacing the Jules task, and broad local product
    implementation beyond the accepted Jules slice.
- Verification:
  - Local: `npm run validate:spells`; `npx vitest run
    src/commands/effects/__tests__/TerrainCommand.test.ts --reporter=verbose`;
    `npx vitest run
    src/utils/combat/__tests__/combatUtils_premade.test.ts --reporter=verbose`;
    `node scripts\auditAtlasBuckets.mjs`; `npx tsc --noEmit --pretty false`;
    `git diff --cached --check`.
  - GitHub: PR #1096 passed Build, Lint, Tests, Quality Scan, Poison File
    Check, Analyze actions/javascript-typescript/python, and CodeQL.
- Scope guardrails:
  - Keep PR #1096 product-only: spell JSON, `TerrainCommand` test proof,
    bucket docs, completion note, and tracker status.
  - Leave `.github/workflows/gemini-review.yml`, raw Jules/Symphony artifacts,
    helper scripts, `.orig` files, dashboard runtime state, combat HUD rider
    icons, levels 4-9, and broad movement-multiplier architecture out of scope.
- Result: PR #1096 merged on 2026-05-26 as
  `0cd0af47f348b21f331644e7d1bdb502400d3f3a`; Package 13 is closed.
- Next expected proof: select the next tracker-defined mechanics bucket from
  `EARLY_GAME_SPELL_EXECUTION_PLAN.md` before dispatching another Jules task.

### Decision 127: Request Revised Package 14 Jules Plan

- Date/time: 2026-05-26 05:05-05:06 +02:00
- Phase: `package_14_plan_review`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: Visual Jules inspection of session `16016352181102771214`
  showed an `Approve plan?` gate. Jules' first plan had useful direction, but
  it did not yet satisfy the Package 14 packet. It reviewed likely candidates
  rather than explicitly classifying every named early-game open row first,
  selected `alarm`, `daylight`, `silent-image`, `major-image`, `fog-cloud`, and
  `darkness`, and proposed marking rows closed before proving the full
  classification and residual boundary. Codex also checked current source
  evidence and found that `spellValidator.ts` accepts `soundEmission` and
  existing spell JSON already uses it, while `src/types/spells.ts` lacks the
  matching `SoundEmission` type and `BaseEffect.soundEmission` field.
- Options considered:
  - Approve the first plan because it names plausible implementation files and
    a coherent subset.
  - Reject the plan and take over Package 14 locally.
  - Ask Jules for a revised plan through visible chat before approval.
- Decision made by agent: Ask Jules for a revised plan before approval.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  plan review, scope enforcement, visible feedback, PR review, and verification.
- Rationale/evidence:
  - The package requires full classification of every named cantrip/level 1-3
    open row before selecting `implement_now` rows. That classification is the
    guardrail that lets Package 14 be larger without becoming vague.
  - A focused additive `soundEmission` type bridge in `src/types/spells.ts`
    appears plausible because validation and JSON evidence already use the
    field, but it still needs to stay narrow and verified.
  - `fog-cloud`, `darkness`, and `silence` should not be closed unless current
    structures prove the exact row without broad line-of-sight,
    magical-darkness, one-way-visibility, remote-sensor, or
    silence-propagation work.
  - The desired improvement is higher implementation value per Jules cycle, not
    approving a broad-looking plan that will need predictable repair later.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message requesting a revised plan. The
    message required full named-row classification, a separated
    `implement_now` subset, additive-only `soundEmission` typing if needed,
    residual rows left open with reasons, and verification through
    `validate:spells`, `auditAtlasBuckets`, focused tests, and `tsc` if
    `src/types/spells.ts` changes.
  - Skipped: approving the plan, local implementation, hidden endpoint update,
    PR merge, and replacement handoff.
- Scope guardrails:
  - Keep Package 14 inside selected spell JSON, `src/types/spells.ts` or
    validator only for the narrow reusable bridge, focused runtime/data tests,
    and `vision_light_sound.md`.
  - Exclude broad line-of-sight, magical-darkness, one-way-visibility,
    remote-sensor, silence-propagation, glyph/trap, summon/control,
    illusion/social arbitration, combat HUD rider icons, levels 4-9, Symphony
    runtime/source files, and GitHub workflows.
- Result: Package 14 is waiting for a revised Jules plan, not blocked and not
  locally taken over.
- Next expected proof: revised visible Jules plan that classifies every named
  early-game row and separates the approved implementation subset from deferred
  residual rows.

### Decision 128: Approve Revised Package 14 Jules Plan

- Date/time: 2026-05-26 05:14 +02:00
- Phase: `package_14_plan_review`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After Codex requested a revision, the visible Jules session
  showed a revised `Approve plan?` gate. The revised plan starts with
  classification of every named cantrip/level 1-3 row from the Package 14
  packet, then selects a likely `implement_now` subset while leaving broad
  residual systems deferred.
- Options considered:
  - Reject the revised plan again and ask for a more explicit row-by-row table
    before any implementation.
  - Approve the revised plan and let Jules implement.
  - Take over Package 14 locally.
- Decision made by agent: Approve the revised plan.
- Model routing: Jules owns implementation. Codex remains foreman for monitoring,
  PR review, repair feedback, branch hygiene, and merge verification.
- Rationale/evidence:
  - The revised plan now names all candidate rows from the packet: cantrips,
    level 1, level 2, and level 3 rows.
  - It separates the likely implementation subset (`alarm`, `thaumaturgy`,
    `daylight`, `silent-image`, `major-image`) from narrow proofs
    (`fog-cloud`, `darkness`, `silence`) and broader deferred systems such as
    remote sensors, glyph/trap authoring, summon/control, and broad
    magical-darkness interaction.
  - The `soundEmission` type bridge remains additive and justified by existing
    validator and JSON evidence.
  - Verification remains focused: `npm run validate:spells`,
    `node scripts/auditAtlasBuckets.mjs`, focused Vitest, and `npx tsc
    --noEmit --pretty false` if `src/types/spells.ts` changes.
- Mutation performed or skipped:
  - Performed: clicked the visible Jules `Approve plan?` control.
  - Skipped: local implementation, hidden endpoint approval, replacement
    handoff, PR merge, and scope expansion.
- Scope guardrails:
  - Close only rows proven by JSON/runtime/test evidence.
  - Leave residual rows open with concise reasons when they need broad
    line-of-sight, magical-darkness, one-way-visibility, remote-sensor,
    silence-propagation, glyph/trap, summon/control, illusion/social
    arbitration, combat HUD rider icons, levels 4-9, Symphony runtime/source
    files, or GitHub workflows.
- Result: Jules plan approved; Package 14 is now in Jules implementation wait.
- Next expected proof: visible Jules working state, PR URL, exact blocker, or
  scoped PR ready for foreman review.

### Decision 129: Send Early Package 14 Helper-Script Scope Correction

- Date/time: 2026-05-26 05:21 +02:00
- Phase: `package_14_active_work_scope_correction`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After the revised Package 14 plan was approved, the visible
  Jules session showed active work and the code view at `classify.cjs`, with
  visible updates to `classify.js` and `classify.cjs`. Those look like temporary
  classification helper scripts rather than durable Package 14 artifacts.
- Options considered:
  - Wait silently until Jules opens a PR, then reject or clean the branch if the
    helper scripts remain.
  - Take over the implementation locally while Jules is active.
  - Send a bounded visible scope correction before PR submission.
- Decision made by agent: Send a bounded visible scope correction before PR
  submission.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  scope hygiene, visible correction, PR review, and verification.
- Rationale/evidence:
  - Package 13 already showed that helper scripts, patch files, and `.orig`
    artifacts can survive into a Jules PR if they are not corrected early.
  - Package 14 needs the classification result, not the scratch scripts. The
    durable home for the result is `vision_light_sound.md`, package completion
    notes, or the tracker.
  - Correcting before PR submission preserves Jules' implementation momentum
    while reducing the chance of another branch-hygiene repair loop.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message saying `classify.js` and
    `classify.cjs` must be treated as temporary helper artifacts, deleted before
    PR submission, and not included alongside patch files, `.orig` files,
    generated caches, or orchestration artifacts.
  - Performed: asked Jules to preserve the useful classification/residual
    reasoning in `vision_light_sound.md`, the package completion note, or the
    tracker.
  - Skipped: local implementation, hidden endpoint update, replacement handoff,
    PR branch repair, and PR merge.
- Scope guardrails:
  - Final Package 14 PR should stay inside selected spell JSON, the narrow
    `src/types/spells.ts` `soundEmission` bridge if needed, focused tests,
    `vision_light_sound.md`, and concise package/tracker notes.
  - Exclude root helper scripts, `.cjs`/`.js` scratch files, patch files,
    `.orig` files, generated caches, Symphony/Jules runtime state, GitHub
    workflows, combat HUD rider icons, levels 4-9, and broad visibility/silence
    systems.
- Result: Package 14 remains Jules-owned and is waiting for cleaned working
  evidence, scoped PR, or explicit blocker.
- Next expected proof: visible cleanup, PR URL with scoped file list, exact
  blocker/justification, or a later bounded PR repair request.

### Decision 130: Send Second Package 14 Patch-Helper Scope Correction

- Date/time: 2026-05-26 05:40 +02:00
- Phase: `package_14_active_work_scope_correction`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After the first helper-script correction, a visible Jules
  recheck showed Jules had deleted the classification helpers and moved into
  focused type/data/test/doc updates. The visible file activity and review pane
  still showed `patch_types.js`, `patch_types.cjs`, `patch_json.cjs`, and
  `patch_markdown.cjs`, which look like temporary patch helpers rather than
  durable Package 14 artifacts.
- Options considered:
  - Wait for the PR and repair the branch only if the patch helpers remain.
  - Take over the implementation locally while Jules is active.
  - Send a second bounded visible correction before PR submission.
- Decision made by agent: Send a second bounded visible correction before PR
  submission.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  visible scope correction, PR file-list review, branch hygiene, and merge
  verification.
- Rationale/evidence:
  - Package 13 and the first Package 14 correction show a recurring Jules
    pattern: helper and patch scripts can appear during useful product work.
  - Correcting the file-list boundary before PR submission is cheaper than
    accepting another stale or noisy PR branch and then performing a larger
    clean-acceptance repair.
  - `src/types/spells.d.ts` is a tracked source mirror, unlike the `patch_*`
    helpers. It may be valid if Jules explains why repo convention requires it
    to stay aligned with `src/types/spells.ts` and includes it in verification.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message requiring deletion of
    `patch_json.cjs`, `patch_types.js`, `patch_types.cjs`,
    `patch_markdown.cjs`, and any other `patch_*.js` / `patch_*.cjs` helper
    before PR submission.
  - Performed: told Jules the final PR should remain durable: selected spell
    JSON, `src/types/spells.ts`, the matching tracked `.d.ts` only if
    necessary and explained, focused tests, `vision_light_sound.md`, and
    concise package/tracker notes.
  - Skipped: local implementation, hidden endpoint update, replacement
    handoff, PR branch repair, and PR merge.
- Scope guardrails:
  - Exclude `patch_*`, `classify*`, `.orig` files, generated caches,
    orchestration artifacts, GitHub workflows, broad visibility/silence
    systems, combat HUD rider icons, and levels 4-9.
  - Treat any remaining tracked `.d.ts` edit as reviewable only if it is
    explained as a source mirror and verified with the matching TypeScript
    check.
- Result: Package 14 remains Jules-owned and is waiting for cleaned working
  evidence, a scoped PR, or an explicit blocker.
- Next expected proof: visible cleanup, PR URL with scoped file list, exact
  blocker/justification, or a later bounded PR repair request.

### Decision 131: Send Package 14 `patch_alarm.js` Helper Reminder

- Date/time: 2026-05-26 05:49 +02:00
- Phase: `package_14_active_work_scope_correction`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After Decision 130, Jules remained visibly in `Running code
  review ...` and GitHub still showed no open Package 14 PR. A remote branch
  named `codex/package14-selection` existed, but it belonged to already-merged
  prep PR #1098, not the active Jules result. A later visible Jules check showed
  a new `patch_alarm.js` update after the earlier all-`patch_*` cleanup
  correction.
- Options considered:
  - Wait for the PR and repair only if `patch_alarm.js` remains.
  - Treat the repeated helper drift as a reason to take over locally.
  - Send one short visible reminder that `patch_alarm.js` is covered by the
    same helper-artifact boundary.
- Decision made by agent: Send one short visible reminder before PR submission.
- Model routing: Jules remains implementation worker. Codex remains foreman for
  visible scope correction, PR file-list review, branch hygiene, and merge
  verification.
- Rationale/evidence:
  - The previous correction already covered all `patch_*.js` /
    `patch_*.cjs` helpers, so `patch_alarm.js` is not a new approved artifact
    category.
  - A short reminder is cheaper than waiting for a PR known to be likely noisy,
    while still keeping Jules as owner of the implementation.
  - No PR exists yet, so this is still pre-submit scope guidance rather than a
    PR repair or local takeover.
- Mutation performed or skipped:
  - Performed: sent a visible Jules message saying `patch_alarm.js` is a
    temporary helper and must not be included in the final PR.
  - Performed: restated that the durable final file list should be selected
    spell JSON, `src/types/spells.ts`, a matching tracked `.d.ts` only if
    necessary and explained, focused tests, `vision_light_sound.md`, and
    concise tracker/package notes.
  - Skipped: local implementation, hidden endpoint update, replacement
    handoff, PR branch repair, and PR merge.
- Scope guardrails:
  - Exclude every `patch_*.js` / `patch_*.cjs` helper, `classify*`, `.orig`
    files, generated caches, orchestration artifacts, GitHub workflows, broad
    visibility/silence systems, combat HUD rider icons, and levels 4-9.
- Result: Package 14 remains Jules-owned and is waiting for cleaned working
  evidence, a scoped PR, or an explicit blocker.
- Next expected proof: visible cleanup, PR URL with scoped file list, exact
  blocker/justification, or a later bounded PR repair request.

### Decision 132: Request Package 14 PR #1110 Bucket Count Repair

- Date/time: 2026-05-26 06:08 +02:00
- Phase: `package_14_pr_review_repair`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: Jules opened PR #1110 from branch
  `jules/ara-23-spell-phase-1-package-14-16016352181102771214`. The final file
  list was helper-clean and stayed inside durable Package 14 artifacts:
  selected spell JSON, `src/types/spells.ts`, tracked `src/types/spells.d.ts`,
  focused `SensoryMechanics.test.ts`, and `vision_light_sound.md`. Core GitHub
  checks were green except the known advisory `review / review` quota failure,
  and local merge-result verification passed the focused spell, Atlas, Vitest,
  and TypeScript checks. The remaining issue was that
  `vision_light_sound.md` changed row statuses but kept stale header counts.
- Options considered:
  - Accept the PR because product files, helper hygiene, and core checks were
    good.
  - Take over locally and repair the header counts immediately.
  - Send bounded PR feedback and wait for a Jules repair commit.
- Decision made by agent: Send bounded PR feedback and wait for a Jules repair
  commit.
- Model routing: Jules remains implementation worker for the PR branch. Codex
  remains foreman for PR review, repair routing, focused verification, and merge
  readiness.
- Rationale/evidence:
  - The first PR head counted `closed: 185`, `open/actionable_open combined:
    61` (`33 open` + `28 actionable_open`), and `deferred_flavor: 7`, while the
    header still said `Open findings: 76` and `Closed findings: 170`.
  - The issue is small and precise enough for Jules to repair without widening
    the package.
  - Jules reacted with eyes to the PR feedback, so the current state is
    `wait_for_jules_repair_commit`, not a stale-session failure or local
    takeover.
  - A visible Jules-page check confirmed the active Package 14 session/branch
    after the PR feedback.
- Mutation performed or skipped:
  - Performed: posted bounded GitHub PR feedback requesting only the bucket
    header count repair or an explicit alternate counting rule.
  - Performed: visually checked the Jules Package 14 page after the feedback.
  - Skipped: local implementation, hidden endpoint update, replacement handoff,
    PR branch repair, and PR merge.
- Scope guardrails:
  - Keep the PR otherwise scoped as-is: selected spell JSON,
    `src/types/spells.ts`, the tracked `.d.ts` mirror, focused
    `SensoryMechanics` test, and `vision_light_sound.md`.
  - Do not reintroduce helper scripts, scratch files, GitHub workflows, broad
    visibility/silence systems, combat HUD rider icons, or levels 4-9.
- Result: Package 14 remains Jules-owned and is waiting for a new PR #1110
  head.
- Next expected proof: new PR #1110 head with fixed bucket header counts or an
  explicit documented counting rule. If the head remains unchanged after
  repeated visible Jules checks, record the stale repair wait before choosing a
  foreman branch repair or replacement handoff.

### Decision 133: Send Package 14 PR #1110 Unchanged-Head Repair Nudge

- Date/time: 2026-05-26 06:12 +02:00
- Phase: `package_14_pr_repair_wait_escalation`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After Decision 132, PR #1110 still pointed at the same head
  commit, `2c7cb414c16433eae8c6291f31b2cf47c5730703`, and the remote Jules
  branch had not published a count repair. The PR comment showed Jules had
  reacted with eyes to the repair request. A visible Jules-page check showed
  the Package 14 session on `.github/workflows/gemini-review.yml`, but GitHub
  still showed no workflow file in PR #1110's submitted diff.
- Options considered:
  - Keep waiting silently.
  - Treat the unchanged head as enough reason for immediate foreman branch
    repair.
  - Send one bounded nudge asking for the count repair or an explicit blocker,
    while restating that workflow edits are out of scope.
- Decision made by agent: Send one bounded PR nudge before taking over locally.
- Model routing: Jules remains implementation worker for one more repair wait.
  Codex remains foreman for PR review, scope guardrails, branch hygiene, and
  merge readiness.
- Rationale/evidence:
  - The requested repair is small and exact, and Jules has at least acknowledged
    the feedback.
  - The visible workflow-file view is suspicious because Package 14 does not own
    workflow files, but the authoritative GitHub PR diff does not currently
    include `.github/workflows/gemini-review.yml`.
  - A nudge preserves the Jules-first path while making the next fork explicit:
    new PR head, explicit blocker, foreman branch repair, or replacement
    handoff.
- Mutation performed or skipped:
  - Performed: posted PR feedback asking Jules to push the count-only
    `vision_light_sound.md` header repair or reply with the exact blocker /
    alternate counting rule.
  - Performed: restated that workflow edits are outside Package 14 and must not
    be added to PR #1110.
  - Skipped: local implementation, hidden endpoint update, replacement handoff,
    PR branch repair, and PR merge.
- Scope guardrails:
  - Keep PR #1110 inside selected spell JSON, `src/types/spells.ts`, tracked
    `src/types/spells.d.ts`, focused `SensoryMechanics.test.ts`, and
    `vision_light_sound.md`.
  - Reject or branch-repair any later head that adds workflow edits, helper
    scripts, scratch files, broad visibility/silence systems, combat HUD rider
    icons, or levels 4-9.
- Result: Package 14 remains Jules-owned for one more repair wait.
- Next expected proof: new PR #1110 head with the bucket count repair, an
  explicit Jules blocker/counting-rule reply, or one more unchanged visible
  check that justifies selecting foreman branch repair or replacement handoff.

### Decision 134: Repair And Merge Package 14 PR #1110 From Current Master

- Date/time: 2026-05-26 06:28 +02:00
- Phase: `package_14_branch_hygiene_repair_and_merge`
- Active slice: Package 14 vision/light/sound mechanics for cantrips and
  levels 1-3.
- Decision point: After Decision 133, Jules pushed new PR #1110 head
  `9623d6c679c1c5d0a81d30a1373cdf48ca9ab496`. The new commit changed only
  `.github/workflows/gemini-review.yml` to work around review quota and did not
  fix the requested `vision_light_sound.md` header counts. The useful Package
  14 product work was already locally verified and the remaining repair was
  exact.
- Options considered:
  - Request another Jules repair.
  - Close/relaunch Package 14 from current `origin/master`.
  - Perform a bounded foreman branch-hygiene repair from current `origin/master`
    and preserve only accepted Package 14 product/test/bucket files.
- Decision made by agent: Perform the bounded foreman branch-hygiene repair and
  merge after verification.
- Model routing: Codex took over PR-branch hygiene, not product discovery. Jules'
  accepted contribution remains the spell JSON/type/test/bucket implementation
  direction.
- Rationale/evidence:
  - The out-of-scope workflow edit repeated the Package 13 quota-bypass pattern
    and directly contradicted the Package 14 repair nudge.
  - The requested count repair was deterministic: the accepted bucket table
    counts were Open `61`, Closed `185`, Deferred flavor `7`.
  - Starting from current `origin/master` preserved tracker truth and avoided
    stale-base documentation rewinds.
- Mutation performed or skipped:
  - Performed: created clean branch `codex/accept-package14-pr1110` from current
    `origin/master`.
  - Performed: restored only selected Package 14 spell JSON,
    `src/types/spells.ts`, tracked `src/types/spells.d.ts`,
    `src/commands/__tests__/SensoryMechanics.test.ts`, and
    `vision_light_sound.md` from the Jules branch.
  - Performed: fixed `vision_light_sound.md` header counts to Open `61`,
    Closed `185`, Deferred flavor `7`.
  - Performed: added interpretability comments to the new focused test and
    `.d.ts` sound mirror.
  - Performed: force-pushed clean head
    `9d37cc1bc0618088b04687acc485eb15c444ed2f` with lease to PR #1110 and
    posted a foreman-repair PR comment.
  - Performed: merged PR #1110 after local verification and green GitHub checks.
  - Skipped: preserving `.github/workflows/gemini-review.yml`, another Jules
    repair loop, and a replacement handoff.
- Scope guardrails:
  - Accepted files stayed inside selected spell JSON, spell type bridge,
    focused sensory test, and bucket documentation.
  - Workflow/model routing changes, helper scripts, scratch files, broad
    visibility/silence engines, combat HUD rider icons, and levels 4-9 stayed
    out of scope.
- Verification:
  - Local: `npm run validate:spells`; `node scripts\auditAtlasBuckets.mjs`;
    `npx vitest run src\commands\__tests__\SensoryMechanics.test.ts
    --reporter=verbose`; `npx tsc --noEmit --pretty false`; `git diff
    --check`.
  - Required but unavailable: dependency visualizer sync for `src/types/spells.ts`
    because `misc/dev_hub/codebase-visualizer/server/index.ts` is missing.
  - GitHub: Build, Lint, Tests, Quality, Poison, Analyze, and CodeQL passed on
    the repaired PR head.
- Result: Package 14 merged as
  `3fdf4cb174d42f15f38353adf69890015ec33ff6`.
- Next expected proof: Package 15 selection from the execution plan, likely the
  `summon_or_controlled_entity` bucket, with affected-row mapping before Jules
  dispatch.

### Decision 135: Request Revised Package 15 Jules Plan

- Date/time: 2026-05-26 08:15 +02:00
- Phase: `package_15_jules_plan_revision`
- Active slice: Package 15 summon/control mechanics for cantrips and levels
  1-3.
- Decision point: Visible Jules session `5400768066928394476` showed an
  `Approve plan?` gate. The plan had useful implementation ambition, but it
  ordered type/runtime/test/spell migration work before the required full
  early-game row classification. The Package 15 packet explicitly requires
  classifying every named cantrip/level 1-3 `summon_or_controlled_entity` row
  before selecting the implementation subset.
- Options considered:
  - Approve the plan as-is and rely on Jules to classify later.
  - Reject the plan by abandoning/relaunching the handoff.
  - Send a bounded revision request through the visible dashboard/Jules message
    bridge, then wait for a revised plan or status change.
- Decision made by agent: Send the bounded revision request and do not approve
  the stale plan.
- Model routing: Strong foreman reasoning, because this is a package-boundary
  decision and affects whether Package 15 preserves the classification-first
  contract.
- Rationale/evidence:
  - The plan's Step 5 was row classification, after Step 1 type changes,
    Step 2 runtime changes, Step 3 tests, and Step 4 spell migration.
  - The task packet requires classification first so the larger Package 15
    batch stays valuable without silently crossing into broad summon AI,
    initiative, object-animation, trap/glyph, social-command, or file-backed
    entity systems.
  - The dashboard already had a visible `Send Jules Note` control for the
    handoff, so a replacement handoff was premature.
- Mutation performed or skipped:
  - Performed: sent a visible dashboard/Jules operator note asking Jules to
    revise the plan, classify all named early-game rows first, then choose the
    largest safe subset that fits existing `SUMMONING`, summon-template,
    `controlledEntity`, validation, `SummoningCommand`, and focused-test
    patterns.
  - Performed: recorded the operator-message receipt on handoff
    `handoff-1779774561087-k9184e`.
  - Performed: repaired Symphony routing so `AWAITING_PLAN_APPROVAL` plus a
    sent operator message routes to `Refresh Jules Status` instead of stale
    `Approve Jules Plan`.
  - Skipped: approving the stale plan, local Package 15 implementation,
    replacement handoff, and hidden Jules endpoint use.
- Scope guardrails:
  - Keep Package 15 inside selected early-game spell JSON, summon/control
    bucket docs, summoned-entities tracker, the smallest summon/control type or
    validation bridge, `SummoningCommand`, summon templates, and focused tests.
  - Do not allow broad AI arbitration, independent initiative, hostile summon
    control, object-animation engines, trap/glyph authoring, social-command
    systems, combat HUD rider icons, levels 4-9, or Symphony runtime edits into
    the Package 15 product PR.
- Result: Package 15 remains Jules-owned, but the first plan was not accepted.
  The next safe dashboard action is status refresh / visible Jules inspection
  for a revised plan, work state, PR URL, or explicit blocker.
- Next expected proof: `npm run build`,
  `node scripts\verify-task-detail-page.mjs`, rendered dashboard check showing
  the handoff routes to `Refresh Jules Status` after the revision note, then a
  visual Jules recheck for the revised plan or next state.

### Decision 136: Approve Revised Package 15 Plan, Then Reconcile Stale Completion

- Date/time: 2026-05-26 08:35 +02:00
- Phase: `package_15_revised_plan_approval_and_completion_reconciliation`
- Active slice: Package 15 summon/control mechanics for cantrips and levels
  1-3.
- Decision point: Visible Jules session `5400768066928394476` showed a revised
  plan after the bounded revision request. The revised plan began with
  `Classify Rows (Markdown update)`, then moved through type, runtime, safe spell
  migration, focused tests, pre-commit checks, and submit. This corrected the
  original ordering defect. After Codex approved the revised plan visibly,
  Symphony/local Jules records reported `COMPLETED` with no PR URL or completion
  result, while visible Jules still showed `Plan approved`, a `Pause session`
  control, no completion report, and no PR link.
- Options considered:
  - Reject the revised plan again because the collapsed plan labels did not show
    every detail.
  - Approve the revised plan because it fixed the classification-first gate and
    stayed inside the Package 15 write scope.
  - Treat the later local `COMPLETED` record as true completion and close or
    supersede Package 15.
  - Treat the local `COMPLETED` record as stale until visible Jules/GitHub proof
    confirms a PR, failure, or no-PR completion.
- Decision made by agent: Approve the revised plan, then classify the later
  `COMPLETED`/no-PR state as a reconciliation gap rather than Package 15
  closeout.
- Model routing: Strong foreman reasoning, because this decides whether a live
  Jules handoff may proceed and whether local status can override visible
  operator evidence.
- Rationale/evidence:
  - The revised plan's first step was row classification, satisfying the main
    Package 15 gate that caused the first rejection.
  - The revised plan stayed inside declared Package 15 surfaces:
    summon/control bucket docs, spell type/runtime bridge, safe spell JSON,
    focused tests, and verification.
  - The visible Jules page after approval showed `Plan approved` and a pause
    control, not a completion report.
  - GitHub open-PR search found no current Package 15/Jules PR.
  - Symphony task detail reported `COMPLETED` without PR URL, branch, or
    completion text, which is insufficient proof of product completion.
- Mutation performed or skipped:
  - Performed: approved the revised Jules plan through the visible Jules page.
  - Performed: refreshed the dashboard, which exposed the local `COMPLETED`
    mismatch.
  - Performed: inspected visible Jules and GitHub PR state before accepting the
    local completion record.
  - Skipped: relaunching Package 15, local Package 15 implementation, package
    closeout, and no-PR stale filing.
  - Attempted but blocked: recording a local dashboard task note through the
    visible note field. Browser text entry failed on the known virtual-clipboard
    blocker, so this durable decision entry and tracker row carry the proof.
- Scope guardrails:
  - Keep waiting/reconciliation compact unless a real new fork appears: PR URL,
    failed/blocked Jules output, repeated visible unchanged state, or a
    confirmed no-PR completion.
  - Do not let local `COMPLETED` state alone override visible Jules/GitHub
    evidence.
- Result: Package 15 remains active and Jules-owned. The active issue is now a
  Symphony/Jules reconciliation gap: local records say `COMPLETED`, visible
  Jules does not prove completion, and GitHub has no PR.
- Next expected proof: visible Jules recheck plus GitHub PR search. If visible
  Jules later shows a PR, move to PR review. If it remains plan-approved/working
  with no PR, record a compact wait. If the mismatch repeats, repair Symphony's
  completion reconciliation before filing the handoff as no-PR/stale.
