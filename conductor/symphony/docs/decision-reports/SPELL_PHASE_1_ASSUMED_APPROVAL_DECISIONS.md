# Spell Phase 1 Assumed-Approval Decisions

Last Updated: 2026-05-21

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

## Open Decisions For The Next Slice

1. Create the Package 3 Symphony dashboard draft visibly from
   `PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json`.
2. Package and dispatch Package 3 for Jules: character creator spell selection
   and character sheet spellbook visibility.
3. Improve Symphony Git sync guidance so a planning branch can be published
   without suggesting that unrelated local `master` commits should be pushed.
4. Confirm the restarted Stitch MCP proxy path before claiming any
   Stitch-generated dashboard redesign work.
