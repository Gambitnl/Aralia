#!/usr/bin/env bash
set -euo pipefail

# The tidy-up chain is retired (Remy, 2026-11-03). This launcher used to start a
# new `codex exec` run for each mode (light, standard, full, push). That run had no
# conversation context, the `full` mode ran the full test suite, and `push` prepared
# a push that only the orchestrator makes now.
#
# What is preserved: the npm entry points (`npm run tidy-up`, `tidy-up:<mode>`) and
# the mode names, so old instructions still reach a useful answer. The script now
# only prints a pointer to the one close procedure and exits 0. It starts no agent.

MODE="${1:-standard}"

cat <<EOF
The tidy-up chain is retired. Mode "${MODE}" no longer runs anything.

To close a session, read public/agent-docs/workflows/session-ritual.md in your
active agent session. Pick the close case there and do only its steps:
  A. small fix            B. feature session ends
  C. unfinished hand-over D. dispatched worker

Section 7 of that file lists each retired tidy-up step and the reason.
Push checks stay available to the orchestrator: npm run sync-check,
npm run git:hygiene, npm run intent-gate -- --strict.
EOF
