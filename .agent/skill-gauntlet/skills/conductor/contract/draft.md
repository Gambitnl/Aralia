# Outcome Contract

## 1. Purpose

Give a software project a durable, on-disk record of its own intent and progress, and make an
assistant work from that record instead of from conversation memory. The skill establishes a
small set of persistent project documents (what is being built, for whom, with what technology,
under what development conventions), decomposes upcoming work into individually specified and
planned units, executes those plans while keeping the recorded progress synchronized with
reality, reports that progress on demand, and can undo work at any granularity. The value is
continuity and auditability across sessions and across people: anyone — human or assistant — can
open the project cold and see what was decided, what is done, what is underway, and what is next.

## 2. Success

Observable from outside the assistant:

- A single, predictable location in the repository holds the project's context documents, a
  registry of work units, and a per-unit folder containing its specification, its plan, and its
  machine-readable metadata.
- Every plan item, at every level of nesting, carries a status marker, and those markers match
  what has actually been built and verified.
- The registry, the per-unit metadata, and the plan agree with one another at all times; a reader
  consulting any one of them draws the same conclusion.
- A progress query returns an accurate roll-up (counts and completion ratio, what is active, what
  is next, what is blocked) purely by reading the files — no inference from chat history.
- Each meaningful state change is recorded in version control, so the project's history explains
  both the code and the decisions.
- Any recorded unit of work can later be undone, with the code and the recorded status returning
  to a consistent prior state, without discarding history.
- Documents that describe the project (rather than a single unit of work) were authored from the
  user's stated intent and explicitly approved before being written.
- After any operation, the user is told what state things are in and what the available next
  moves are.

## 3. Qualities ranked

1. **Truthfulness of recorded state.** The record is the product. A plan that claims work is
   finished when it is not is worse than no record, because downstream operations, reports, and
   undo all trust it.
2. **User authority over content and destructive acts.** Project-defining content must reflect
   the user's intent, not the assistant's invention; irreversible or wide-reaching actions must be
   previewed and consented to. This is a requirement about *how* the work is done, not only its
   result: the owner wants the human deciding, with the assistant drafting.
3. **Recoverability.** Nothing done should be a one-way door. History is preserved rather than
   rewritten so that an undo is itself auditable and itself reversible.
4. **Resumability and idempotence.** Multi-step setup records checkpoints and continues from where
   it stopped; re-invocation on an already-established project recognizes that and declines rather
   than starting over.
5. **Structural stability.** The file layout, naming scheme, and status vocabulary are the
   interface between separate operations and between sessions. They must be stable and
   discoverable, not clever.
6. **Low friction in elicitation.** Gathering context must be bounded and easy to escape: a small
   number of focused questions, asked one at a time, each offering both concrete suggestions and a
   way to supply one's own answer or let the assistant fill in the remainder.

## 4. Hard constraints

- All persistent artifacts live under one dedicated directory at the project root, in
  human-readable text, with the structured status data in a machine-parseable form.
- Work-unit identifiers are unique within the project and encode creation date; collisions must be
  detected before creation.
- Every generated plan item, including nested items, is created with a status marker already
  present. Markers distinguish at least: not started, underway, done.
- Any operation that depends on the project context must first confirm that context exists; if it
  does not, it stops and names the initialization operation instead of improvising.
- Version control is required infrastructure. It is initialized if absent, artifacts are committed,
  and undo operates through it.
- Inspection of a pre-existing codebase happens only with the user's permission and is read-only,
  and findings are summarized back before anything is generated from them.
- Undo previews the exact set of changes it will reverse and requires confirmation before acting;
  when it cannot complete cleanly it stops, explains the exact manual steps, and waits.
- Whether commits are made per item or per group, and comparable execution conventions, are read
  from the project's recorded conventions rather than assumed.
- The progress report is strictly read-only.
- On failure during execution, the run stops, reports plainly, and offers the user a choice of how
  to continue.

## 5. Must never

- Record an item as complete when it failed, was skipped, or was not verified.
- Leave the registry, metadata, and plan disagreeing about the same unit of work.
- Delete a user's work without explicit confirmation, and never on a single confirmation for
  permanent deletion.
- Rewrite or discard existing version-control history in order to undo something.
- Read or analyze an existing codebase before being granted permission.
- Change the project-level context documents silently; each proposed change is shown and approved
  individually.
- Overwrite or re-run initialization over a project that is already initialized.
- Continue past a missing prerequisite, an unresolved conflict, or a failed step by guessing.
- Fabricate project intent, requirements, or acceptance criteria and present them as the user's.
- Mutate any state while reporting status.

## 6. Activation boundary

Triggers only on explicit, by-name invocation of one of its operations. It is a command family, not
an ambient behavior.

It must stay silent — and must not volunteer itself, its file layout, or its vocabulary — during
ordinary development work: writing code, fixing bugs, answering questions, general planning
discussions, or informal "where are we?" questions. In particular, in a repository that has never
adopted this system, nothing about it should surface unless the user names it. The presence of its
directory is not an invitation to act unprompted either; it only makes the non-initializing
operations eligible when invoked.

Within the family: the initializing operation is the only one valid on an unestablished project and
is invalid on an established one. All others require the established context and must decline,
pointing at initialization, when it is absent. Execution additionally requires at least one
incomplete unit of work; undo requires at least one recorded unit.

*Ambiguity note:* the original does not clearly state whether execution pauses between individual
plan items. The most faithful reading is that it proceeds continuously through a unit's plan,
pausing only where the project's recorded conventions call for a verification checkpoint, or on
error.
