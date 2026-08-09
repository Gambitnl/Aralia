# Outcome Contract

## 1. Purpose

Give a software project a durable, on-disk record of its own intent and progress, and make an
assistant work from that record instead of from conversation memory. The skill establishes a set of
persistent project documents — what is being built and for whom, how the product should sound and
look, what technology it uses, what coding standards apply, and what development conventions govern
the work — decomposes upcoming work into individually specified and planned units, executes those
plans while keeping the recorded progress synchronized with reality, reports that progress on
demand, and can undo work at any granularity. The value is continuity and auditability across
sessions and people: anyone can open the project cold and see what was decided, what is done, what
is underway, and what is next.

## 2. Success

Observable from outside the assistant:

- A single predictable location in the project holds the context documents, an index of work units,
  and, for each unit, its specification, its plan, and its recorded status. Both a person and a
  program can read that state.
- The context documents cover product intent, the product's voice and visual character, the
  technology in use, per-language coding standards, and development conventions.
- The recorded conventions settle at least: the verification threshold work must meet, the
  granularity at which work is committed, and where per-item work summaries are kept.
- A unit's specification states how completion will be verified, and that is what execution checks
  against before recording anything as done.
- Every plan item, at every level of grouping, carries a status marker, and those markers match what
  has actually been built and verified. Markers distinguish at least: not started, underway, done.
- The index, the per-unit status, and the plan agree with one another at all times; a reader
  consulting any one of them draws the same conclusion.
- A progress query returns an accurate roll-up — how much is done, what is being worked on, what
  comes next, what is obstructed — purely by reading the record, not from chat history. Obstructions
  met during execution are written into that record, not merely mentioned aloud.
- Each meaningful state change is captured in the project's revision history, so that history
  explains both the code and the decisions.
- Any recorded unit — or a group or single item within one — can later be undone, with the code and
  the recorded status returning to a consistent prior state, without discarding history.
- Content the assistant drafts on the user's behalf — project documents, a unit's specification, its
  plan, its title — is presented for approval and revised before it is written.
- Initialization leaves behind a project that is documented *and* has one work unit already
  specified and planned; a run interrupted partway resumes where it stopped rather than restarting.
- On completing a unit, the user is offered its disposition: retain the artifacts but drop it from
  the active index, remove it entirely, or leave it in place.
- After any operation, the user is told what state things are in and what the available next moves
  are.

## 3. Qualities ranked

1. **Truthfulness of recorded state.** The record is the product. A plan that claims work is
   finished when it is not is worse than no record, because downstream operations, reports, and undo
   all trust it.
2. **User authority over content and destructive acts.** Everything the assistant authors on the
   user's behalf must reflect the user's intent, not the assistant's invention, and be seen before
   it lands; irreversible or wide-reaching actions must be previewed and consented to. This
   constrains *how* the work is done: the owner wants the human deciding, the assistant drafting.
3. **Recoverability.** Nothing done should be a one-way door. History is preserved rather than
   rewritten so that an undo is itself auditable and itself reversible.
4. **Structural stability.** The layout, naming scheme, and status vocabulary are the interface
   between separate operations and between sessions. They must be stable and discoverable, not
   clever.

## 4. Hard constraints

- All persistent artifacts live in one dedicated location within the project, readable directly by a
  person, with the structured status data readable by a program.
- Each work unit is addressed by a stable, human-meaningful name that is unique across the project;
  collisions are detected before creation.
- Every generated plan item, including nested ones, is created with a status marker already present.
  Plans carry an intermediate grouping level between the unit and the individual item — verification
  checkpoints and undo both operate at that level.
- Elicitation is bounded and easy to escape: a small number of focused questions, asked one at a
  time, each offering a few concrete options alongside a free-form answer. Where the questions
  define the project as a whole, the user may also hand the remaining answers to the assistant.
- Choices about development conventions are put to the user with the owner's recommended default
  named, not as bare either/ors.
- Initialization detects whether the project is new or pre-existing and adapts: for a pre-existing
  one, detected facts are stated back for confirmation rather than elicited from scratch; a new
  project is placed under revision control as part of setup.
- Initialization records a durable checkpoint after each step and resumes from the last one recorded.
- Inspection of a pre-existing codebase happens only with permission, is read-only, honors the
  project's own exclusion rules, and is summarized back before anything is generated from it.
- Any operation that depends on the project context must first confirm that context exists; if it
  does not, it does not proceed and names the initializing operation instead of improvising.
- The unit to execute is never chosen unilaterally: a named target is confirmed with the user
  first; absent one, the incomplete units are presented and the assistant waits for an explicit
  choice.
- The target to undo is chosen the same way: a named target is confirmed; absent one, candidates are
  presented — preferring work currently underway, and always allowing the user to name something
  else instead.
- Recorded conventions govern planning as well as execution: if they call for tests to precede
  implementation, the generated plan reflects that, and so does the run.
- Execution proceeds continuously through a unit's plan, pausing only where the recorded conventions
  define a verification checkpoint at a group boundary, or on error.
- Undo previews the exact set of changes it will reverse and requires confirmation before acting; it
  preserves history rather than rewriting it; it must still find the recorded work when the
  underlying history has been rewritten or its identifiers no longer match. When it cannot complete
  cleanly it stops, tells the user precisely how to finish or abandon the operation by hand, and
  waits. A declined or abandoned undo leaves the working state untouched, and abandoning it remains
  available throughout.
- On failure during execution, the run stops, reports plainly, and offers the user a choice of how to
  continue.

## 5. Must never

- Record an item as complete when it failed, was skipped, or was not verified.
- Leave the index, the per-unit status, and the plan disagreeing about the same unit of work.
- Write a drafted specification, plan, or project document without first showing it to the user.
- Delete a user's work without explicit confirmation; permanent deletion requires confirmation
  escalated beyond a single yes.
- Rewrite or discard existing revision history in order to undo something.
- Read or analyze an existing codebase before being granted permission.
- Change the project-level context documents silently; each proposed change is shown and approved
  individually.
- Overwrite or re-run initialization over a project that is already initialized.
- Continue past a missing prerequisite, an unresolved conflict, or a failed step by guessing.
- Fabricate project intent, requirements, or acceptance criteria and present them as the user's.

## 6. Activation boundary

Triggers only on explicit, by-name invocation of one of its operations. It is a command family, not
an ambient behavior.

Within the family: the initializing operation is the only one valid on an unestablished project and
is invalid on an established one. All others require the established context and must decline,
pointing at initialization, when it is absent. Execution additionally requires at least one
incomplete unit of work; undo requires at least one recorded unit.

## 7. Derived

Not stated by the owner; inferred from the shape of the operations.

- Reporting progress is read-only — the reporting operation has no step that changes anything.
- Because the operations are defined only as named commands, nothing about this system — its
  existence, its layout, or its vocabulary — should surface during ordinary development work unless
  the user names an operation.
