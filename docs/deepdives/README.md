# Deepdives - the section contract and the index

A **deepdive** is a read-only research report about ONE boundary in this
codebase: two systems that overlap, a contract and its users, or a subsystem
nobody has mapped. A deepdive changes no source file. It ends in decisions for
Remy and in work filed on the board.

This file is the contract. Before WF-G185 the section list lived in each agent
prompt, so two deepdives filed in one week could disagree on their sections, on
whether a finding carried `file:line` evidence, and on whether follow-up work
reached the board or only a list. Nothing linked the documents together either.

A deepdive prompt must POINT AT this file instead of restating the list.

## The section contract

Write these seven sections, in this order, with these numbers. Do not add a
section, and do not drop one: an empty section says "nothing found", which is
itself a result.

**Header block** (before section 1, no heading):

- The title, as an H1.
- The board task id, and the campaign id when the task has one.
- The date, and the handle that wrote it.
- `Read-only research. No source file was changed.`
- Every planning surface the subject touches: the Plan Map topic id with its
  file (`public/planmap/topics.json`), the gap registry rows, and the domain
  doc or spec that owns the subject.

**1. Verdict** - the answer, in the first three lines. One paragraph says what
the boundary IS, and one line says what must happen. A reader who stops here
must be able to act.

**2. Inventory** - every file, module, type and entry point in scope, with its
path and its role in one line. This is the map the later sections point at.

**3. Findings** - the evidence. EVERY finding carries `path:line`, a test name,
or a measured number. A finding without one of those is not a finding; it is a
guess, and it does not go here. Number the findings so section 4 and section 5
can cite them.

**4. Decisions for Remy** - the choices only the operator makes, each with the
options, the cost of each option, and your recommendation. Never write a time
estimate. Never shrink the scope because it looks large.

**5. Follow-up work filed on the board** - a table of the tasks you CREATED,
with their real board ids. Work that is only listed here does not exist. Each
row: task id, title, what it changes, and the gap or finding it answers.

**6. Workflow gaps filed on the board** - the `WF-G<n>` rows you filed against
`tools/agora/WORKFLOW_GAPS.md` for friction in the workflow itself, with their
real ids. Write `none` when there was none.

**7. Filed artifacts** - optional. Any other durable record this run produced:
gap rows in a project registry, a plan-map topic edit, a captured screenshot.

## Rules

1. **Evidence or silence.** `path:line`, a test name, a message seq, or a
   measured number. Never "seems to" or "probably".
2. **Read-only.** A deepdive that edits a source file is no longer a deepdive.
   File the edit as a board task in section 5.
3. **Real ids only.** A task id in section 5 or a gap id in section 6 must
   exist on the board. Write the section AFTER you file them.
4. **One boundary per document.** A second boundary is a second deepdive and a
   second board task.
5. **Add your row to the index below** in the same turn you write the document.

## Index

| Document | Board task | Boundary | Written |
|---|---|---|---|
| [combat-condition-palette-unification.md](combat-condition-palette-unification.md) | agora-8e37 | Combat condition colors against one shared palette | 2026-09-20 |
| [command-pattern-vs-action-executor.md](command-pattern-vs-action-executor.md) | agora-ab40 | The command pattern against `useActionExecutor` | 2026-09-20 |
| [dialogue-models-boundary.md](dialogue-models-boundary.md) | agora-7ba5 | Topic registry, Graph DAG and LLM chat | 2026-09-20 |
| [dice-rollers-vs-roll-contract.md](dice-rollers-vs-roll-contract.md) | agora-6256 | The dice rollers against the roll contract | 2026-09-20 |
| [realmsmith-vs-worldforge.md](realmsmith-vs-worldforge.md) | agora-3bfe | RealmSmith generators against the Worldforge pipeline | 2026-09-20 |
| [spell-validators-consolidation.md](spell-validators-consolidation.md) | agora-0a8d | Spell validators and description-parsing fallbacks | 2026-09-20 |
| [village-generator-vs-worldforge-town.md](village-generator-vs-worldforge-town.md) | agora-c0af | `villageGenerator` against Worldforge town and interiors | 2026-09-20 |

## How to check a new deepdive

Diff the section headings of the new document against this contract:

```
grep -n '^## ' docs/deepdives/<new>.md
```

The result must be sections 1 to 6, in order, with section 7 optional. An agent
given only a board task id and this file must produce the same section set.
