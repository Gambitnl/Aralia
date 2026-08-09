# Audit of `draft-contract.md` against `original/`

Scope: the five command files in `original/` (`conductor-setup.md`, `conductor-newtrack.md`,
`conductor-implement.md`, `conductor-status.md`, `conductor-revert.md`).

Findings are ordered within each section by materiality.

---

## 1. OMITTED

### 1.1 Two of the five project-context document types are missing entirely

The draft's Purpose enumerates the persistent project documents as "**what is being built, for whom,
with what technology, under what development conventions**" (§1), and Success speaks only of "the
project's context documents" without enumeration. The original establishes **five** distinct kinds:

- `product.md` — "Target users / Main goals / Key features / Success metrics" (setup.md:48-52)
- `product-guidelines.md` — "Ask up to 5 questions about: **Prose style / tone**, **Brand
  messaging**, **Visual identity principles**" (setup.md:66-69)
- `tech-stack.md` (setup.md:77-88)
- `code_styleguides/` — "Create `conductor/code_styleguides/` directory … Based on tech stack,
  **recommend appropriate style guides** … **Ask user to confirm or customize selection**"
  (setup.md:92-98)
- `workflow.md` (setup.md:102-113)

The draft's four-part gloss covers product, tech-stack, and workflow. **Product guidelines
(voice/brand/visual identity) and per-language code style guides have no representation anywhere in
the draft** — not in Purpose, not in Success, not in Hard constraints. These are separate owner
requirements with their own elicitation and approval steps, not sub-cases of "what is being built"
or "development conventions."

### 1.2 Required contents of the recorded development conventions

The original fixes three specific decisions that the conventions document must capture
(setup.md:106-109):

> - Test coverage requirement (default: 80%)
> - Commit frequency: per task (recommended) or per phase
> - Task summary location: git notes or commit messages

The draft carries only the second ("Whether commits are made per item or per group … are read from
the project's recorded conventions", §4). **A verification/coverage target and a decision about
where per-item work summaries are recorded are both absent.** The coverage target matters
downstream: implement's completion gate is "Run relevant tests … Ensure code quality"
(implement.md:68-70), which the draft abstracts to "verified" without ever saying a recorded
threshold governs it.

### 1.3 The user chooses and confirms which unit of work gets executed

The original devotes a full step to this (implement.md:18-33):

> **If track name provided in `$ARGUMENTS`**: Search … (case-insensitive) — Confirm with user:
> "Found track '<name>'. Is this correct?"
> **If no track name provided**: … List all incomplete tracks … Present options: A) Track 1, B)
> Track 2, etc. — **Wait for user selection before proceeding**

The draft says only that "Execution additionally requires at least one incomplete unit of work"
(§6). **The requirement that the assistant never picks the target unilaterally — that it confirms a
named match and blocks on an explicit choice otherwise — is missing**, despite the draft ranking
"User authority over content and destructive acts" second among its qualities.

### 1.4 Undo target discovery and selection

The same gap appears for undo (revert.md:16-39): confirm a named target ("Is this correct?
(yes/no)"), or, absent one, "Scan all tracks and plans for: Items marked `[~]` (in-progress) —
**prioritize these**; if none, show **5 most recently completed** `[x]` items", present a menu, and
include an escape hatch ("D) Specify a different item"). The draft's undo coverage begins at the
preview stage ("Undo previews the exact set of changes it will reverse", §4) and **says nothing
about how a target is identified, that in-progress work is preferred, or that the user picks from a
presented set**.

### 1.5 Disposition of a finished unit: archive / delete / keep

On completion the original requires an explicit three-way offer (implement.md:101-110):

> "Track complete! What would you like to do? A) **Archive** — Move to conductor/archive/ B)
> **Delete** — Permanently remove C) **Keep** — Leave in tracks file"

The draft preserves only the delete guardrail ("never on a single confirmation for permanent
deletion", §5). **The requirement that completion presents a disposition choice at all, and that
archiving (retain the artifacts, remove from the active registry) is one of the options, is
omitted.** Archival is a user-visible capability, not a means.

### 1.6 Tolerance for rewritten version-control history

> "**Handle rewritten history (rebase/squash): if SHA not found, search for similar message**"
> (revert.md:51)

Nothing in the draft corresponds to this. The draft asserts recoverability as quality #3 but never
requires undo to survive a history that no longer matches recorded identifiers.

### 1.7 The failure paths of undo that are *not* merge conflicts

The draft covers exactly one failure mode: "when it cannot complete cleanly it stops, explains the
exact manual steps, and waits" (§4) — that is revert.md:89-99. Omitted from revert.md:122-125:

> - If no commits found for target: "Could not find Git commits for this item. It may have been
>   created in a different session or the history was rewritten."
> - If user cancels: "Revert cancelled. **No changes were made**."
> - **Always offer to abort if something goes wrong**

The guarantee that a declined or aborted undo leaves the working state untouched is a real owner
requirement and is absent.

### 1.8 Setup terminates by producing a first unit of work

Setup is not complete until an initial work unit exists: "Setup is almost complete. Let's create
your first track" (setup.md:137), and the terminal checkpoint value is literally
`"3.3_initial_track_generated"` (setup.md:160), which is also the condition the
already-initialized check keys on (setup.md:10-13). The draft describes initialization purely in
terms of context documents and never states that **the initializing operation hands back a project
with one work unit already specified and planned**.

### 1.9 Setup adapts to whether the project is new or pre-existing

The original classifies the project up front (setup.md:18-25) and branches on that classification in
at least three places: permission-gated scan vs. "What do you want to build?" (setup.md:29-42),
"**For Brownfield**: State detected stack, ask for confirmation / **For Greenfield**: Ask about
languages, frameworks, databases" (setup.md:81-82), and "**For Greenfield**: Ask about first
feature/MVP scope / **For Brownfield**: Recommend maintenance or enhancement track"
(setup.md:140-141). The draft mentions only the scan-permission consequence and **never states that
initialization must detect and adapt to an existing codebase**, e.g. that detected facts are
presented for confirmation rather than elicited from scratch.

### 1.10 The checkpoint record itself

The original writes a durable checkpoint after every setup step (`{"last_successful_step": …}`,
setup.md:41, 60, 75, 88, 100, 113, 160) and resumes from it: "If another value, **resume from that
step**" (setup.md:14). The draft treats resumability as ranked quality #4 but **lists no
corresponding artifact in Success**, whose inventory is only "context documents, a registry of work
units, and a per-unit folder." A reader implementing to the draft's Success section would have
nothing to resume from.

### 1.11 Smaller but real omissions

- **Navigational index documents.** `conductor/index.md` (setup.md:117-133) and a per-unit
  `index.md` (newtrack.md:95-102) are required artifacts; the draft's per-unit inventory is
  "its specification, its plan, and its machine-readable metadata."
- **Required structure of a specification.** "Overview / Functional Requirements / Non-Functional
  Requirements / **Acceptance Criteria: How to verify completion** / Out of Scope"
  (newtrack.md:40-45). The draft references acceptance criteria only in a Must-never
  ("Fabricate … acceptance criteria"), never requiring that a unit's spec state how completion will
  be verified — which is what implement checks against (implement.md:69).
- **Phases as a required level of plan structure.** "Generate plan.md with **Phases, Tasks, and
  Sub-tasks**" (newtrack.md:52), with a phase-level gate ("If workflow defines 'Phase Completion
  Verification', ask user to verify", implement.md:86) and phase-level undo (revert.md:3). The draft
  says "at every level of nesting" without ever establishing that a middle grouping level exists —
  yet its own §4 depends on it ("per item or per group") and its §6 ambiguity note turns on it.
- **Scans respect ignore rules.** "scan the codebase (**respect .gitignore**)" (setup.md:31).
- **Blockers are recorded during execution, not only reported.** "**Log any blockers** for the
  status report" (implement.md:123). The draft has status *reading* blockers with no requirement
  that anything writes them.
- **Test-first sequencing is derived from conventions.** "If workflow specifies TDD, each feature
  task should have: Write tests / Implement feature" (newtrack.md:69-72; implement.md:66) — a
  planning-time obligation, not just an execution-time one.

---

## 2. DISTORTED

### 2.1 Approval is scoped to project-level documents only — the original requires it per unit too

Draft, §2 Success:

> "Documents that describe the project (**rather than a single unit of work**) were authored from
> the user's stated intent and explicitly approved before being written."

and §3, quality 2: "**Project-defining content** must reflect the user's intent…"

The parenthetical actively excludes unit-level artifacts from the approval requirement. The original
requires approval for exactly those artifacts:

- Specification: "Present draft and **ask for approval**. Revise if needed." (newtrack.md:46)
- Plan: "Present draft and **ask for approval**." (newtrack.md:73)
- Unit title: "Generate track title and **get approval**" (setup.md:142)

This is the single most consequential misstatement in the draft: an implementation built to it would
generate and write a unit's spec and plan without showing them first, and would still satisfy every
line of §2, §4, and §5.

### 2.2 "Version control is initialized if absent" — the original does so only for new projects

Draft, §4: "Version control is required infrastructure. **It is initialized if absent**, artifacts
are committed, and undo operates through it."

The original initializes it only on the greenfield branch: "**For Greenfield Projects:** 1.
Initialize git if `.git` doesn't exist: `git init`" (setup.md:37-38). A project classified brownfield
by any non-git signal — "`package.json`, `pom.xml`, `requirements.txt`, `go.mod`" or "`src/`, `app/`,
`lib/` directories with code" (setup.md:21-22) — never reaches that step. The draft states an
unconditional guarantee the original does not make. (The unconditional guarantee is arguably the
better design, but the draft's job is fidelity, and this one silently repairs a gap.)

### 2.3 The elicitation escape hatches are described uniformly; the original differs by operation

Draft, §3.6: "each offering both concrete suggestions **and** a way to supply one's own answer **or
let the assistant fill in the remainder**."

Original, setup: "offer **3 options** + 'Type your own' + '**Auto-generate rest**'" (setup.md:54).
Original, newtrack: "provide **2-3** suggested options plus '**Type your own answer**'"
(newtrack.md:37) — no auto-generate affordance. The draft merges the two into a single stronger
uniform rule.

### 2.4 A manufactured ambiguity

Draft, §6: "*Ambiguity note:* the original does not clearly state whether execution pauses between
individual plan items."

The original does state it. Step 5 is an explicit loop — "**For each task in `plan.md`:** … 7.
**Move to next task**" (implement.md:52-79) — with the only pause being the phase-level gate at
implement.md:86. The draft's proposed resolution is correct; flagging the point as unresolved
misrepresents the source and invites a reader to re-litigate a settled requirement.

### 2.5 Uniqueness is asserted more broadly than the original checks

Draft, §4: "Work-unit identifiers are **unique within the project** … collisions must be detected
before creation."

Original: "**Check for duplicates**: List `conductor/tracks/` and ensure no duplicate **short
names** exist" (newtrack.md:79). The check is on the human-chosen name component, not the full
identifier (the full identifier is name+date and so collides only within a single day). Minor, but
it changes what a conforming implementation must detect.

### 2.6 "Stops and names the initialization operation" overstates the status operation

Draft, §4: "Any operation that depends on the project context must first confirm that context
exists; if it does not, **it stops** and names the initialization operation."

For four of five operations this is right ("**halt** and say", newtrack.md:15; "**halt**",
implement.md:16). Status says only "**inform the user**: 'Conductor is not set up…'"
(status.md:13) — no halt directive. Trivial in effect, listed for completeness.

---

## 3. MISLABELED

### 3.1 Demoted: bounded, structured elicitation is a requirement, not the lowest-ranked quality

The draft places "Low friction in elicitation" **last** among six ranked qualities (§3.6), framing it
as a matter of degree ("must be bounded and easy to escape"). In the original it is a hard
behavioral spec repeated across operations: "Ask **up to 5** questions **sequentially**"
(setup.md:48), "Ask **3-5** questions sequentially (**one at a time**)" (newtrack.md:31), and the
fixed option set at setup.md:54 and newtrack.md:37. A bounded count, one-at-a-time delivery, and a
supplied option set are testable requirements; ranking them sixth licenses trading them away
against the five qualities above.

### 3.2 Demoted: resumable, checkpointed initialization is a requirement

Same pattern — "Resumability and idempotence" is quality #4 (§3), whereas the original makes it
mechanical and non-negotiable: a state file written after every step, and a hard branch on its value
(setup.md:9-15). Only the idempotence half survives into a binding section ("Overwrite or re-run
initialization over a project that is already initialized", §5); the resume half appears nowhere in
§2, §4, or §5. See also 1.10.

### 3.3 Promoted: recommended defaults presented as free choices

The original carries explicit recommendations inside its choices: "Test coverage requirement
(**default: 80%**)" and "Commit frequency: per task (**recommended**) or per phase"
(setup.md:107-108). The draft renders this as a neutral either/or — "Whether commits are made per
item or per group … are read from the project's recorded conventions rather than assumed" (§4) —
dropping the owner's stated defaults. Defaults are weaker than requirements but stronger than
nothing, and they are part of what the owner asked for.

### 3.4 Promoted: the read-only status guarantee is inferred, not stated

The draft states it twice, at maximum strength — as a hard constraint ("The progress report is
strictly read-only", §4) and as a Must-never ("Mutate any state while reporting status", §5). The
original never says this; it is inferred from the fact that `conductor-status.md` contains no
mutating step. The inference is sound and the constraint is desirable, but presenting an inference
as an owner requirement — and giving it two of the draft's binding slots — is not neutral
transcription. It should be marked as derived.

### 3.5 Promoted: the entire second paragraph of the activation boundary

Draft, §6:

> "It must stay silent — and must not volunteer itself, its file layout, or its vocabulary — during
> ordinary development work: writing code, fixing bugs, answering questions, general planning
> discussions, or informal 'where are we?' questions. In particular, in a repository that has never
> adopted this system, nothing about it should surface unless the user names it. The presence of its
> directory is not an invitation to act unprompted either…"

**No sentence in any of the five original files corresponds to this.** The originals are command
definitions with `**Usage**: /conductor-<verb>` headers; "invoked by name" follows from that form,
but the enumerated silence rules — the specific negative examples, the never-adopted-repository
case, the directory-is-not-an-invitation clause — are the draft author's additions, stated with the
same force as sourced constraints. Either drop them or mark them as inferred scope-fencing.

---

## 4. LEAKED MEANS

These are implementation choices from the original that the draft has re-encoded as owner
requirements. Each constrains a reimplementation without being something the owner actually asked
for.

1. **Date-encoded identifiers.** "Work-unit identifiers are unique within the project and **encode
   creation date**" (§4) is `shortname_YYYYMMDD` (newtrack.md:77) with the format filed off. The
   owner's requirement is that units are uniquely and stably addressable; the creation date lives in
   `created_at` metadata (newtrack.md:89) regardless. Requiring it *in the identifier* is a means.

2. **The per-unit folder as a structural mandate.** "a **per-unit folder** containing its
   specification, its plan, and its machine-readable metadata" (§2) transcribes
   `conductor/tracks/<track_id>/{spec.md,plan.md,metadata.json}`. The requirement is that each unit
   has a retrievable specification, plan, and status; one-folder-per-unit is one way to achieve it.

3. **The markdown/JSON split.** "in **human-readable text**, with the structured status data in a
   **machine-parseable form**" (§4) is `.md` + `.json` restated at one remove. What the owner needs
   is that both a human and a program can read the state; mandating two distinct representations is
   an implementation decision.

4. **Undo routed through version control.** "Version control is required infrastructure … **undo
   operates through it**" (§4). The genuine requirements are that undo is possible, previewed, and
   **history-preserving** — the original's own framing is "This will create new revert commits,
   **preserving history**" (revert.md:75). *How* the reversal is computed is a means; the draft
   welds it to the VCS.

5. **The commit-granularity dichotomy.** "Whether commits are made **per item or per group**" (§4)
   preserves the original's exact binary (per task / per phase, setup.md:108) rather than the
   underlying requirement: that execution granularity decisions are recorded once and honored
   thereafter.

6. **The three-value status vocabulary.** "Markers distinguish **at least**: not started, underway,
   done" (§4) is `[ ]` / `[~]` / `[x]`. This one is *defensible* — the draft's own quality #5 argues
   the vocabulary is a cross-operation interface, and status parsing (status.md:16-26) depends on
   it — but note it is a means promoted to a hard constraint, and the "at least" hedge does not
   change that a three-state model is being mandated.

7. **"counts and completion ratio, what is active, what is next, what is blocked"** (§2) is a
   field-by-field transcription of the report template at status.md:29-47 (Overall Progress /
   Progress % / Active Track / Current Task / Next Action / blockers). The requirement is an
   accurate roll-up; the field list is the original's chosen presentation.

---

## 5. FINGERPRINTS

Wording in the draft that is traceable to this specific source. None reproduce the literal
vocabulary (`conductor/`, `track`, `/conductor-setup`), but several are distinctive enough to
identify the origin by structure.

| Draft phrase | Tell |
|---|---|
| "never on a **single confirmation** for permanent deletion" (§5) | Directly encodes "**Delete**: **Confirm twice**" (implement.md:110). Double-confirm-on-delete is an unusual, highly identifying detail. |
| "or **let the assistant fill in the remainder**" (§3.6) | Paraphrase of the literal menu item "**Auto-generate rest**" (setup.md:54). |
| "identifiers … **encode creation date**" (§4) | Reveals `shortname_YYYYMMDD` (newtrack.md:77). |
| "not started, **underway**, done" (§4) | The three-state set including a distinct in-progress marker is the `[ ]`/`[~]`/`[x]` scheme; `[~]` in particular is idiosyncratic. |
| "**registry** of work units" + "**per-unit folder**" (§2) | The `tracks.md` registry / `tracks/<id>/` folder pair. |
| "per item or **per group**" (§4) | "per group" is "per **phase**" with the word swapped; the two-option choice is verbatim from setup.md:108. |
| "**one dedicated directory at the project root**" (§4) | `conductor/`. |
| "specification, its plan, and its **machine-readable metadata**" (§2) | The exact `spec.md` / `plan.md` / `metadata.json` triple, in the original's own order. |
| "**counts and completion ratio**, what is active, what is next, what is blocked" (§2) | The status template's field order (status.md:33-41), including the separate blockers section (status.md:49). |
| "when it cannot complete cleanly it stops, explains **the exact manual steps**, and waits" (§4) | The four-line manual conflict-resolution script at revert.md:91-98. |
| The *Ambiguity note* (§6) | Meta-commentary on a source document; a tell that this is a derived contract, and it points at the phase/task loop structure specifically. |

Also worth noting: the draft's Purpose sentence "**what is being built, for whom, with what
technology, under what development conventions**" is a compressed table of contents for
product.md / tech-stack.md / workflow.md — and the fact that it enumerates exactly the documents
that survived §1.1's omission is itself a signal about which source files the author weighted.

---

## 6. VERDICT

**REVISE.**

The draft is competent and largely well-shaped — the truthfulness-of-state, history-preservation,
double-confirm-delete, and silent-doc-mutation constraints are all captured accurately and at the
right altitude. But it does not clear the bar for a faithful, implementation-neutral restatement:

- **One material distortion.** Restricting the draft/present/approve loop to project-level documents
  (§2.1) contradicts three explicit approval gates in the original and would let a conforming
  implementation write a unit's spec and plan without ever showing them to the user — while
  satisfying every other line of the contract.
- **Two whole context-document types dropped** (product guidelines, code style guides, §1.1), plus
  the archive/delete/keep disposition offer (§1.5), user selection and confirmation of the execution
  and undo targets (§1.3, §1.4), rewritten-history tolerance (§1.6), the coverage target and summary
  location (§1.2), and the checkpoint artifact that makes resumption possible (§1.10).
- **Structural mislabeling in both directions:** two hard behavioral specs demoted to low-ranked
  qualities (§3.1, §3.2), and an entire inferred activation-boundary paragraph promoted to
  requirement status with no textual basis (§3.5).
- **Six-plus leaked means** presented as hard constraints (§4), several of which would over-constrain
  a genuinely independent implementation.
- **Fingerprint risk is moderate-to-high** (§5); the double-confirm-delete clause, the
  "fill in the remainder" affordance, and the date-encoded-identifier requirement are together
  enough to identify the source.

Suggested order of repair: fix §2.1 first (it is the only finding that changes what a conforming
implementation may do to the user), then restore the §1.1–§1.6 omissions, then rebalance §3, then
neutralize §4 and §5 together — most of the leaked means and most of the fingerprints are the same
sentences.
