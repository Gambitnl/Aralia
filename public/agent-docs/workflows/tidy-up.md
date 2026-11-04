---
description: Retired. The session close procedure is now public/agent-docs/workflows/session-ritual.md.
---

# /tidy-up Workflow (retired)

Use `public/agent-docs/workflows/session-ritual.md` to close a session. That file is the
one close procedure for every agent in this repository. Remy approved this change on
2026-11-03.

This file stays so that old links still work. It is not a second procedure.

## What changed

- The four tidy-up modes (`light`, `standard`, `full`, `push`) are retired. The close
  procedure now uses four close cases instead: a small fix, a feature session that ends,
  an unfinished hand-over, and a dispatched worker.
- `npm run tidy-up`, `npm run tidy-up:<mode>`, `scripts/tidy-up.sh` and
  `scripts/tidy-up.ps1` print a pointer to `session-ritual.md`. They no longer start a
  `codex exec` run.
- The `full` mode ran the full test suite. The close procedure uses focused checks only.
- The `push` mode prepared a push. Only the orchestrator pushes now, through
  `scripts/git/nightly-snapshot.mjs`. `npm run sync-check`, `npm run git:hygiene` and
  `npm run intent-gate -- --strict` stay available for that work.

Section 7 of `session-ritual.md` lists each retired step, the reason, and where it is now.
