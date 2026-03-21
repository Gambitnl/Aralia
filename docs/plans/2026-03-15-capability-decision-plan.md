# Roadmap Capability Extraction Plan

**Date**: 2026-03-15  
**Purpose**: Turn processed documentation plus repo verification into a roadmap that reflects real game capabilities, real planned work, and real in-progress systems without relying on ephemeral wording.

## Intent

We want to accomplish a roadmap that represents the actual codebase state of Aralia as clearly as possible.

That means:
- extract capability information from processed docs
- verify each capability against the current codebase
- create or update roadmap branches and nodes based on verified reality
- distinguish between:
  - verified to exist
  - work in progress
  - planned to come

This is not mainly a spell-data plan.
This is not mainly a validation-tooling plan.
This is a roadmap-content extraction plan grounded in docs plus code verification.

## Core Roadmap Rules

### Rule 1: Roadmap nodes must represent capabilities, features, or components

Nodes should describe durable parts of the game or app, not process language.

Good examples:
- Merchant Pricing
- Regional Economy
- Companion Banter
- World Map Atlas
- 3D Exploration Modal

Bad examples:
- Improve Merchant Pricing
- Ongoing Economy Review
- Validate 3D Integration
- Planning And Polish

### Rule 2: No ephemeral wording

Nodes should not be named in ways that depend on momentary context.

Avoid node names like:
- Current Gaps
- Remaining Work
- Integration Progress
- Final Cleanup
- Future Improvements

Those ideas belong in status or notes, not in node identity.

### Rule 3: No combined "A and B" node names

If a node wants to be named as two things joined together, it is probably too broad.

Example:
- `Merchant Pricing And Economy Integration`

This should instead become:
- parent: `Economy`
- child: `Merchant Pricing`
- child: `Regional Economy Integration`

The rule is:
- node names should describe one capability
- if a name naturally splits into two capabilities, create a parent and split the children

### Rule 4: Docs are evidence, not authority by themselves

Documentation can suggest capabilities, but the roadmap should only reflect:
- what the processed docs claim
- what the codebase verifies
- what the current planned docs still describe as real intended work

### Rule 5: Status is separate from identity

The capability name should stay stable.
Status should be attached to the capability, not embedded into the name.

Examples:
- `Merchant Pricing` -> verified to exist
- `Regional Economy` -> work in progress
- `Business Simulation` -> planned to come

## Main Goal

We want to accomplish a roadmap that is filled with codebase-grounded capability content rather than vague project-management phrasing.

To achieve that, we should:
1. define the roadmap extraction rules
2. define the capability hierarchy
3. define the status model
4. define how processed docs emit roadmap updates
5. define how to split broad nodes into atomic nodes
6. define the implementation order for filling the roadmap

## 1. Define The Extraction Rules

We want to accomplish a consistent way to extract roadmap content from processed docs.

To achieve that, we should:
- define what kinds of statements qualify as roadmap-relevant
- define what kinds of docs are evidence-only
- define the minimum code verification required before a node is created or updated

### Step: Define roadmap-relevant evidence

Questions:
- What kinds of processed docs are allowed to emit roadmap capabilities?
- Should reference docs, implementation plans, backlog notes, and capability notes all be allowed to emit nodes if the code confirms them?
- Which docs should be evidence-only and never emit nodes directly?
- What minimum repo verification is required before a capability is considered real enough for roadmap inclusion?

## 2. Define The Capability Hierarchy

We want to accomplish a roadmap hierarchy that reflects the app cleanly at multiple abstraction levels.

To achieve that, we should:
- define the top-level pillars
- define branch, sub-branch, and leaf behavior
- define how far down concrete components should be modeled

### Step: Define the hierarchy shape

Questions:
- Are the current top-level pillars of Aralia complete?
- Which major capability areas in the codebase do not fit cleanly under the current pillar set?
- Are any current pillars too broad, too narrow, or overlapping in a way that causes distorted child nodes?
- What makes something a branch instead of a leaf?
- At what level should a component become its own node instead of staying implicit inside a larger feature?
- How deep should the roadmap normally go before it stops subdividing?

Current answer:
- Pillar completeness is currently unknown and should be treated as an open condition rather than an assumption that the present top-level structure is final.
- The current top-level pillars should still be used as the working roadmap structure, because they are the best available organizational surface right now and we should not freeze roadmap progress while waiting for a theoretically perfect pillar model.
- If, during code-verified roadmap extraction, we encounter a real capability that does not fit cleanly under any existing pillar, we should create a new pillar rather than forcing that capability into an existing pillar that would distort its meaning, its neighbors, or its long-term statusability.
- The practical rule is: keep using the current pillars provisionally, but treat them as revisable whenever verified capability evidence shows that the current structure is incomplete.

Current answer on primary-home placement:
- A capability's primary home should be determined by its most semantically correct parent in the capability hierarchy, not by whichever subsystem happens to use it most visibly at the moment and not by whichever nearby branch would make it convenient to place.
- In practice, this means the roadmap should prefer conceptual identity over incidental usage.
- For example:
  - `Trading` belongs under `Economy`
  - `Merchant Pricing` belongs under `Trading`
  - `Object Targeting` belongs under `Targeting`
- These examples show the intended placement rule clearly:
  - do not place a capability under a branch merely because that branch happens to consume it
  - place it under the branch that best describes what the capability actually is
- This also means that spell usage does not make a generic mechanic part of `Spell Mechanics` automatically.
- If a mechanic is broader than spells, its primary home should reflect that broader identity, and spells should only link to it as consumers, witnesses, or dependents.

Interpretation rule:
- Choose the parent branch that describes the capability's identity most directly.
- Do not place a capability under a branch just because that branch is a major current user of it.
- Usage context may justify crosslinks, but it does not override correct primary placement.

Current answer on node granularity:
- Yes, in principle, everything can deserve a node if it is a real capability or component rather than a transient implementation detail.
- The roadmap should not impose an artificial size threshold that prevents narrow but meaningful capabilities from being represented.
- A capability does not need to be large to deserve a node. It needs to be semantically distinct, durably meaningful, and capable of carrying its own status without collapsing into noise or trivia.
- This means small capabilities such as a narrow mechanic, a specific targeting rule, a distinct warning surface, or a precise subsystem behavior may all deserve their own nodes if they represent a real part of the game or app.
- The limiting rule is not size. The limiting rule is whether the thing represents a meaningful intended behavior, component, control surface, rule, or system outcome rather than being named only as raw code trivia.
- A boolean, helper, config flag, UI treatment, retry path, or low-level implementation hook should not be excluded automatically just because it sounds technical.
- What matters is what that technical element is striving to achieve.
- If the technical element exists in service of a meaningful distinct behavior or component, then that behavior or component may deserve a roadmap node.
- This means the roadmap should not use simplistic exclusion rules like `helpers never count`, `flags never count`, or `UI details never count`.
- Instead, it should ask what durable purpose the element serves in the product or the system.

Interpretation rule:
- Do not reject a node merely because it is small.
- Do not reject a candidate node only because it currently appears in code as a boolean, helper, flag, retry path, or presentation-specific mechanism.
- Instead, interpret the candidate by the meaningful outcome or component it represents.
- Only reject it when it cannot be translated into a durable, semantically meaningful capability or component name and would remain nothing more than raw code-detail trivia.
- If a small thing is semantically distinct and independently statusable, it may and often should receive its own node.

## 3. Define The Status Model

We want to accomplish a roadmap where capability identity stays stable while status communicates reality.

To achieve that, we should:
- define the allowed statuses
- define the evidence threshold for each status
- define what transitions between statuses mean

### Step: Define capability statuses

Questions:
- Are `verified to exist`, `work in progress`, and `planned to come` the primary statuses we want?
- Do we also need statuses like `partial`, `unverified`, or `historical`?
- What evidence is required for `verified to exist`?
- What evidence is required for `work in progress`?
- What kind of plan or doc authority is enough for `planned to come`?

Current answer:
- The roadmap should allow a broader status set than just three simple states, because the codebase and the processed docs reveal more than one kind of incompleteness or non-currentness.
- The currently accepted status vocabulary is:
  - `verified to exist`
  - `work in progress`
  - `planned to come`
  - `partial`
  - `unverified`
  - `historical`
  - `deprecated`
  - `blocked` as a modifier rather than a primary status
- The roadmap must include a dedicated legend or explanation section that defines what each status means in concrete terms.
- The differences between statuses must be meaningful enough that two different reviewers would usually classify the same capability the same way when looking at the same evidence.
- Statuses are not decorative labels. They are meant to convey materially different states of capability existence, maturity, confidence, or retirement.

Follow-up questions:
- what exact evidence threshold separates `verified to exist` from `partial`?
- when should something be `unverified` instead of `work in progress`?
- when should something be `historical` instead of `deprecated`?
- when should `blocked` be used as a status versus a note attached to another status?

Current answer on `verified to exist` vs `partial`:
- The default should be to classify a capability as `verified to exist` when the capability is visibly present in the codebase and there is no concrete evidence, in either the code or the processed docs, that the capability is still materially incomplete.
- The roadmap should only downgrade a capability to `partial` when there is explicit evidence that the capability exists but is not yet whole.
- Strong evidence for `partial` includes:
  - TODO comments in the directly relevant code path
  - processed docs that describe future-facing pieces of the same capability that are not yet present in code
  - clearly missing sub-capabilities discovered during repo verification
  - implementation surfaces that obviously stop at a basic baseline while the surrounding capability is clearly intended to extend further
- The important rule is that `partial` should be evidence-driven. It should not be used just because a reviewer suspects that a capability might have more depth someday.

Interpretation rule:
- Do not downgrade a capability to `partial` just because it may be incomplete in theory or because a richer version could be imagined.
- Only use `partial` when the repo or the processed docs provide explicit, concrete, inspectable evidence of incompleteness.

Current answer on `unverified` vs `work in progress`:
- Use `unverified` when a capability is talked about in docs or implied by planning material, but no real game-code implementation was found during repo verification.
- Also use `unverified` when the only evidence is dead-code traces, abandoned scaffolds, weak hints, or architectural remnants that suggest someone may have been heading toward the capability without actually building it into a meaningful gameplay surface.
- Use `work in progress` only when there is real working code for the capability, but that implementation is still basic, narrow, early, or obviously incomplete.
- The key difference is that `work in progress` has crossed the threshold into real implementation, while `unverified` has not.

Interpretation rule:
- `unverified` means the roadmap should not imply that the capability is materially present in gameplay yet.
- `work in progress` means the capability is no longer merely hypothetical, because code exists and does something real, but it is not yet mature enough to be treated as fully landed.

Current answer on `historical` vs `deprecated`:
- Use `historical` for material that still matters as context about what used to be planned, built, attempted, or previously treated as important, even if it is not the current direction anymore.
- Use `deprecated` for material or capability paths that still exist in code or docs but should no longer be used going forward because a newer preferred path has replaced them or because they are being intentionally retired.
- In short: `historical` preserves context value, while `deprecated` signals present-but-should-not-be-used.

Current answer on `planned to come`:
- Use `planned to come` only when the processed docs provide strong, explicit forward-looking intent for a capability and repo verification confirms that the capability does not yet materially exist as a real implemented gameplay or app surface.
- `planned to come` should not be used merely because a doc mentions an idea casually or because a weak architectural hint suggests someone once thought about it.
- The distinction between `planned to come` and `unverified` is that `planned to come` reflects a still-meaningful planned direction, while `unverified` reflects either weak evidence, dead traces, or documentation claims that do not currently resolve into trustworthy implementation evidence.
- In other words, `planned to come` means there is a credible planned capability that has not landed yet, while `unverified` means the roadmap is not justified in presenting the capability as a committed future path with confidence.

Interpretation rule:
- Use `planned to come` only when the planning intent is explicit enough that the roadmap can honestly represent it as real future-facing work.
- If the evidence is too weak, too stale, too ambiguous, or too dead-ended, use `unverified` instead of overstating planning confidence.

Current answer on `blocked`:
- `blocked` should not be treated as a primary status of its own.
- `blocked` should be attached as a modifier or explanatory note to a capability that already has a primary status such as `planned to come`, `work in progress`, or `partial`.
- The purpose of `blocked` is to explain why progress is stalled, not to replace the more important question of what state the capability is actually in.

Interpretation rule:
- The main status should answer what state the capability is in.
- The blocked flag should answer what concrete factor is preventing progress.
- This distinction matters because `blocked` alone would hide whether the capability already exists partially, is only planned, or has real implementation underway.

## 4. Define Atomic Node Naming

We want to accomplish roadmap nodes that are specific, concrete, and not overly bundled.

To achieve that, we should:
- define atomic naming rules
- define when a node is too broad
- define how to split broad concepts into parent and child nodes

### Step: Define atomic capability naming

Questions:
- What naming pattern should nodes follow: noun phrase, subsystem phrase, or something else?
- How do we decide when a node is too broad?
- Should we explicitly ban node names containing `and` unless it is part of a fixed product term?
- When we split a broad node, what should determine the parent category?

Current answer:
- Roadmap node names containing `and` are banned.
- If a concept naturally wants an `and` name, that is a strong signal that the node is too broad and should instead be represented as a parent node with separate child nodes.
- Roadmap node names should use stable noun-phrase naming rather than action phrasing, progress phrasing, or task phrasing.

Current answer on technical wording versus translated naming:
- When a candidate node first appears in highly technical or code-near wording, the roadmap should prefer translating that wording into the most semantically meaningful stable noun-phrase capability name that honestly reflects what the code is trying to achieve.
- The roadmap should not preserve awkward technical phrasing by default if a clearer capability name can represent the same thing more truthfully and more durably.
- This does not mean the roadmap should become vague or hand-wavy. It means the roadmap should name the capability or component in the clearest durable form rather than inheriting unstable code-scent wording.
- Technical wording can still remain in evidence notes, implementation references, or supporting context, but node identity should aim for clear capability naming first.

Interpretation rule:
- Combined names indicate that the node is too broad.
- The roadmap should prefer atomic capability names over bundled phrasing.
- Avoid action phrasing, progress phrasing, or task phrasing in node identity, because those forms usually describe activity around a capability rather than the capability itself.
- Prefer meaningful noun-phrase capability naming over raw technical wording when the two are not the same.
- Preserve technical specificity in notes and evidence, but use the clearest durable capability name as the node identity.

## 5. Define How To Handle Cross-Cutting Systems

We want to accomplish a roadmap that can represent shared systems without duplicating them everywhere.

To achieve that, we should:
- define primary-home rules
- define crosslink rules
- define how witness leaves relate to shared systems

### Step: Define shared-system handling

Questions:
- Where should shared mechanics like lighting, vision, concentration, targeting, or economy live primarily?
- When should another branch crosslink to them instead of duplicating them?
- What is the rule for choosing a primary home for a cross-cutting capability?
- How should witness leaves prove integration without becoming messy duplicates?

Current answer:
- Shared systems should follow a `one primary home plus crosslinks` rule.
- When a capability is truly a shared system that multiple other capability areas depend on, it should be represented once as a primary roadmap structure in the location that best reflects its deepest and most stable identity.
- Other capability areas that use, depend on, trigger, consume, or witness that shared system should not create their own duplicate main branches for the same thing.
- Instead, those dependent capability areas should crosslink to the shared system from their own branches.
- The purpose of this rule is to keep the roadmap structurally honest. It should show when there is one shared implementation surface being reused, rather than visually implying that several parallel systems exist just because several feature areas interact with it.
- A good example is a spell that uses lighting, concentration, terrain manipulation, or save penalties. The spell may be a useful witness leaf, but it should not become the primary home of the underlying shared mechanic if that mechanic is broader than the spell system itself.
- Mechanics should not live directly under `Spells` as if `Spells` were the universal home of the mechanic. If a mechanic is truly spell-specific, it may live under a more precise branch such as `Spell Mechanics`, but generic mechanics should still live under the broader system that best matches their actual identity.

Interpretation rule:
- Give each shared system one primary home.
- Use crosslinks from dependent features instead of duplicating the same shared capability under multiple major branches.
- Treat witness leaves as proof that the shared system is being exercised, not as replacements for the shared system's primary branch.
- If the roadmap starts representing the same shared mechanic as several separate main structures, that is a sign the model is drifting away from capability truth and toward duplication.
- Do not place a generic mechanic under `Spells` just because spells happen to use it.
- Only use a spell-scoped mechanic branch when the mechanic is genuinely specific to spell behavior rather than a broader reusable system.

## 6. Define How Processed Docs Emit Roadmap Updates

We want to accomplish a clean workflow where doc review produces roadmap progress systematically.

To achieve that, we should:
- define the output of a processed doc
- define whether the output is a branch, leaf, status change, or no roadmap effect
- define what gets written into roadmap-local state

### Step: Define doc-to-roadmap emission

Questions:
- What should every processed roadmap-relevant doc emit?
- Should the output always include capability name, parent branch, status, and evidence?
- When should a processed doc update an existing node instead of creating a new one?
- When should a processed doc produce no roadmap change at all?

Current answer:
- Every processed roadmap-relevant doc should emit a complete roadmap extraction record rather than a loose summary.
- The default required output is:
  - capability name
  - parent branch
  - primary status
  - optional blocked note
  - evidence basis
  - node type: branch, child branch, or leaf
- This should be treated as the standard minimum extraction payload for roadmap-relevant docs, not as an aspirational ideal.

Interpretation rule:
- This is the default required output for roadmap-relevant processed docs.
- Omissions should be treated as incomplete extraction rather than acceptable shorthand, because partial extraction makes later roadmap review and status interpretation less trustworthy.

Current answer on create-versus-update:
- A processed doc should update an existing node when the capability it describes is semantically the same capability that is already present in the roadmap, even if the new doc contributes better evidence, a more precise status, stronger placement confidence, or richer supporting detail.
- A processed doc should create a new node when no existing node cleanly represents that capability, or when the current node is too broad and should be split in order to preserve atomization, clean statusability, or correct parent placement.
- The roadmap should not create duplicate nodes merely because two different docs talk about the same capability from different angles.
- Likewise, the roadmap should not refuse to split an existing broad node when new evidence shows that the node is bundling several semantically distinct capabilities that deserve separation.

Interpretation rule:
- Update when the identity is the same.
- Create when the identity is genuinely missing.
- Split and re-home when the current roadmap structure is too broad or incorrectly organized to represent the newly verified capability cleanly.

Current answer on no-emission cases:
- A processed doc should produce no roadmap change if it does not describe a real game or app capability.
- This includes docs that are useful for process, coordination, migration, audit history, or working method, but that do not actually describe a durable player-facing, system-facing, or app-facing capability.

Interpretation rule:
- Workflow docs, process docs, migration notes, and historical records may still be useful evidence, but they do not become roadmap content unless they describe an actual capability.
- The roadmap should reflect the system being built, not the paperwork around building it.

## 7. Define The Backlog Relationship

We want to accomplish a roadmap that reflects capability state without turning into a generic TODO dump.

To achieve that, we should:
- separate capability identity from task backlog
- decide which backlog surfaces remain primary
- decide how backlog items attach to capabilities

### Step: Define roadmap versus TODO surfaces

Questions:
- What should stay in `FEATURES_TODO.md`, `QOL_TODO.md`, and subsystem TODO docs rather than becoming roadmap nodes?
- Should roadmap nodes hold child tasks, or should they only link to backlog surfaces?
- How much implementation detail belongs in roadmap-local `open_tasks.md` versus the docs backlog?
- How do we keep capability nodes stable while the backlog evolves underneath them?

Current answer:
- The roadmap should not turn into a generic TODO dump.
- Capability nodes should remain stable identity surfaces that describe what the system or feature is, where it belongs, and what state it is in.
- Backlog detail, implementation sequencing, polish work, and granular open tasks should continue to live primarily in backlog-oriented surfaces such as `FEATURES_TODO.md`, `QOL_TODO.md`, subsystem TODO docs, and roadmap-local `open_tasks.md`.
- The roadmap may point to or be associated with backlog surfaces, but the backlog should not be collapsed into node identity.
- This preserves the distinction between a capability and the changing work required to improve, complete, or verify that capability.

Interpretation rule:
- Keep capability identity in the roadmap.
- Keep detailed task movement in backlog surfaces.
- Let roadmap nodes relate to tasks, but do not let the node itself become a task list in disguise.

## 8. Define The Extraction Order

We want to accomplish roadmap filling in an order that gives the fastest clarity without introducing churn.

To achieve that, we should:
- choose which processed doc families get mined first
- define whether we go pillar-first or subtree-first
- define how much structure must be settled before bulk extraction continues

### Step: Define the execution order

Questions:
- Should roadmap extraction begin from the already-processed capability-rich docs first?
- Should we fill the roadmap pillar by pillar, or continue using processed doc batches as the source order?
- Should we lock the hierarchy and naming rules before adding many more nodes?
- Which already-processed areas are the best first candidates for roadmap expansion?

Current answer:
- Roadmap extraction should begin from already-processed capability-rich docs, because those are the surfaces where the evidence has already been reviewed and cross-checked rather than merely assumed.
- The broader capability-extraction pass should still wait until the separate spell-tree plan has been implemented, because the spell catalog itself is being handled by that other plan and should not be entangled with this one prematurely.
- The hierarchy and naming rules should be locked enough to prevent obvious structural churn before large-scale node creation continues, but they do not need to be imagined as permanently final before progress resumes.
- This means the practical execution model is: settle the core modeling rules, complete the separate spell-tree prerequisite, then continue extracting roadmap content from the already-processed non-spell capability-rich docs first.

Interpretation rule:
- Prefer evidence-rich processed docs as the first extraction source.
- Prefer incremental growth with allowed restructuring over waiting for a theoretically perfect final hierarchy.
- Do not resume broad capability-node filling until the spell-tree prerequisite is in place.

## Atomization Rule

We want to accomplish a roadmap that prefers narrow, specific capability structure over bundled branches that hide multiple concepts under one label.

Current answer:
- Prefer atomized branches strongly.
- If a branch or node starts feeling like a combined bucket, it should usually be split further.
- The roadmap should err toward more specific capability nodes rather than fewer broad buckets when the finer structure adds genuine meaning.

Interpretation rule:
- Atomization is preferred unless it would create noise without adding real meaning.
- If a capability can be separated cleanly into narrower stable noun-phrase children, it usually should be.
- Atomized does not merely mean smaller; it means semantically minimal and independently statusable.
- Each node should represent one discrete capability.
- Each node should be able to carry one meaningful status without hiding major internal differences.
- If a node cannot carry one status cleanly because it bundles several independent capabilities, it should be split.

## Recommended Immediate Focus

If we want the cleanest next move, the likely order is:
1. finish the separate spell-tree plan that adds the actual current spells into a dedicated spells tree
2. treat that spell-tree work as a prerequisite for the broader capability-extraction roadmap pass
3. lock the capability hierarchy
4. lock the status model and roadmap status legend
5. lock the atomic naming rule
6. lock the doc-to-roadmap emission rule
7. then continue filling roadmap-local branches from already-processed docs

Sequencing rule:
- The dedicated `Spells` tree, meaning the branch structure that represents the actual current spells themselves, should be implemented before this broader capability-extraction plan is executed at full scale.
- This capability-extraction plan should not try to solve two different roadmap problems at once.
- The spell-tree plan is responsible for representing the spell catalog itself.
- This capability-extraction plan is responsible for representing broader verified game and app capabilities, systems, components, and planned work using processed docs plus code verification.
- That means the two plans are related, but they are not identical and should not be collapsed into one workflow.
- In practice, the spell-tree work should land first, and then this plan should proceed with the benefit of that structure already being present.

## First Question To Resolve

Before adding more roadmap content, we should settle the hierarchy-completeness question:

- Are the current top-level pillars of Aralia complete, or is the existing pillar set missing major capability areas from the actual codebase?

Current answer:
- The current top-level pillar set is not assumed to be complete.
- We should continue using the existing pillars provisionally because they are the best current structure available.
- However, if a verified capability does not fit anywhere cleanly, we should add a new pillar rather than forcing the capability into an ill-fitting home.
