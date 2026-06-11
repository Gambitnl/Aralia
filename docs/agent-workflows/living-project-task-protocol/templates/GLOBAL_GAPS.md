# Global Gap Tracker

Status: active
Last updated: <YYYY-MM-DD>

Use this file for gaps discovered during project work that do not clearly belong
to the active project's own gap tracker. This is a surfacing and routing file,
not a dumping ground for every passing idea.

When a living project is created or refreshed, check this file before creating
new gap rows. Import only the gaps that genuinely belong to the project after
critical scope review.

## Gap Log

| Gap ID | Status | Classification | Detected during | Gap | Evidence/source | Why it matters | Suspected owner/project | Routing decision | Destination | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GG1 | untriaged | adjacent_follow_up | <task/project> | <gap> | <source> | <why> | <owner/project or unknown> | <untriaged/imported/routed/declined> | <project gap ID or tracker link> | <next> | <proof> |

## Status Vocabulary

| Status | Meaning |
|---|---|
| `untriaged` | Recorded for surfacing; no owning project has accepted it yet. |
| `candidate` | May belong to a known project, but needs critical scope review. |
| `imported` | Accepted into a project gap tracker; destination is linked. |
| `routed` | Sent to another existing subsystem tracker; destination is linked. |
| `declined` | Reviewed and intentionally not accepted; rationale is recorded. |
| `done` | Resolved with completion evidence linked or summarized. |

## Routing Rules

- Add gaps here when they are cross-project, orphaned, or outside the active
  project's current scope.
- Do not add gaps here just because they are inconvenient. If the active project
  cannot honestly complete without the gap, it belongs in the project tracker or
  project `GAPS.md`.
- When a project imports a global gap, copy the actionable context into that
  project's `GAPS.md`, then mark the global row `imported` and link the
  destination. Preserve the global row as routing history.
- When the gap clearly belongs to another established subsystem, mark the row
  `routed`, link that subsystem's tracker, and add a minimal inbound stub row
  to the destination project's `GAPS.md` in the same pass. The stub should
  cross-reference this global gap ID, evidence/source, classification, why it
  matters, next action, and next proof/check.
- When scope review rejects a gap, mark it `declined` with a concise reason.
