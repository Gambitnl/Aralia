---
schema_version: 1
gap_schema: workflow_gap_registry
scope: "Gaps in the multi-agent WORKFLOW itself — coordination, dispatch, tooling, tracker-sync, verification. NOT game/feature gaps (those go in the owning project's docs/projects/**/GAPS.md)."
id_prefix: WF-G
allowed_statuses: [open, in_progress, blocked, needs_validation, resolved, wont_fix]
allowed_severities: [low, medium, high, critical]
allowed_classifications: [coordination, dispatch, daemon, client-tooling, registry, tracker-sync, verification, docs, enforcement, quota]
allowed_surfaces: [agora-daemon, agora-client, orchestrate, agents-registry, gap-index, dashboard, claude-hooks, external-agents, project-tracker, docs]
machine_readable_via: "node tools/agora/gapIndex.mjs --root tools/agora  (same parser as project GAPS.md)"
---

# Workflow Gaps — the registry for gaps in HOW we work

Any agent or orchestrator that hits friction in the multi-agent workflow registers it HERE —
durable and structured, unlike `say "WORKFLOW: ..."` chat messages (which scroll away).

## Hard rules (the structure is not optional)

1. **One row per gap** in the table below. Every column filled — no blanks; use `—` only for
   Next proof on `wont_fix`.
2. **Gap ID**: next free `WF-G<n>`. Never reuse or renumber an ID.
3. **Status** ∈ the YAML `allowed_statuses`. New gaps start `open` (or `blocked` with the
   blocker named in Notes). Only move to `resolved` with EVIDENCE (test, commit, live-verify)
   in the Evidence column.
4. **Evidence is concrete**: file:line, test name, message seq, measured number — never
   "seems to" or "probably".
5. **Link work to gaps**: board tasks addressing a gap carry `--ref workflow:WF-G<n>`;
   `orchestrate reconcile <plan> --root tools/agora` then cross-checks done tasks against
   this registry like any other.
6. **Registering is cheap and encouraged** — a WORKFLOW: chat message that matters should
   ALSO become a row here. If unsure whether it belongs, register it; `wont_fix` is a valid
   outcome, silent loss is not.
7. Append new rows at the BOTTOM. Do not rewrite history; corrections go in Notes.

## Registry

| Gap ID | Status | Severity | Classification | Surface | Registered by | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-G1 | open | high | enforcement | external-agents | fable5-agora-upgrade | 2026-07-01 | The destructive-git guard only covers Claude Code sessions; external CLI agents (codex etc.) run no Claude hooks and git has no pre-reset/pre-checkout hook | `.claude/settings.json` PreToolUse → `tools/agora/guardGit.mjs`; codex/gemini spawn via `orchestrate.mjs launchSpec` with no interception layer | A single external agent can still `git reset --hard` the shared tree and destroy every agent's uncommitted work | Investigate a PATH-shim `git` wrapper for external-agent launch environments (orchestrate dispatch controls their spawn env) | Wrapper blocks `reset --hard` from a codex-spawned shell while allowing `git status` | Prompt hard-rules + orchestrator-only codex policy are the current mitigation |
| WF-G2 | open | medium | dispatch | orchestrate | fable5-agora-upgrade | 2026-07-01 | Cursor/Kilo/Antigravity are onboarded per the operator-dashboard contract but have no `dispatch.command` in agents.json and no `launchSpec` branch — validatePlan rejects them as workers | `tools/agora/agents.json` (`"command": null`); `orchestrate.mjs launchSpec` handles codex/gemini only | The worker pool is effectively Claude-only; fleet capacity is unused | Verify each CLI's non-interactive invocation locally, fill `dispatch.command/args`, add launchSpec branches + probe | `orchestrate dispatch` runs a Kilo packet end-to-end on the free tier | Do NOT invent invocations — verify against the real installed CLI first |
| WF-G3 | open | medium | tracker-sync | project-tracker | fable5-agora-upgrade | 2026-07-01 | `orchestrate reconcile` reports stale-open GAPS.md rows but updating the row is still manual — the falsely-open drift is detected, not closed | `orchestrate.mjs cmdReconcile` prints "→ update that GAPS.md row"; doc-triage pilot found falsely-open items in 12/20 subtrees | Detection without closure means drift accumulates between reconcile runs | Add an assisted close: `orchestrate reconcile --apply` writes status+evidence into the matched row (behind a confirm), respecting doc-triage file locks | A done task's ref flips its GAPS.md row to resolved with the board result as evidence, in one command | Write path must honor Agora locks on docs paths |
| WF-G4 | open | medium | coordination | agora-client | fable5-agora-upgrade | 2026-07-01 | Heartbeating is opt-in; a worker that forgets `client.mjs heartbeat` and works silently >60min gets reaped mid-task (locks freed under it, task reopened) | Reaper: `store.mjs sweepExpired`; observed live: fable5-agora-upgrade reaped 2026-07-01 ~00:5x during a long dashboard turn | The reaper cannot distinguish "dead" from "alive but quiet"; false reaps clobber in-flight work exactly like the crashes it prevents | Auto-heartbeat: `task claim`/`claim-next` could arm a daemon-side grace timer, or generated prompts must include a background heartbeat launch line | A worker silent 90min with an armed heartbeat is NOT reaped; one without one IS | Generated prompts (buildPrompt) do not yet include the heartbeat line |
| WF-G5 | open | low | quota | agents-registry | fable5-agora-upgrade | 2026-07-01 | Quota probes are ad-hoc per agent (codex: 1-line prompt probe; cursor: CLI status; kilo: `kilo stats`) — no standardized probe declaration in agents.json | `orchestrate.mjs probeAgent` hardcodes codex/gemini probes; agents.json has no `quotaProbe` field | Orchestrators cannot build generic quota-aware dispatch; each new agent needs bespoke code | Add `quotaProbe: {command, args, dryPattern}` to the registry schema and make probeAgent registry-driven | probeAgent works for a NEW agent with zero orchestrate.mjs changes | |
| WF-G6 | open | low | daemon | agora-daemon | fable5-agora-upgrade | 2026-07-01 | SSE `?since=`/`Last-Event-ID` is echoed but the event gap is not replayed; clients must resync from the hello snapshot | `server.mjs` /events hello handshake; PROTOCOL.md documents the caveat | Streaming clients (dashboard) briefly show stale state after reconnects; harmless today, wrong at higher event volume | Keep a bounded ring of recent events (journal tail is already on disk) and replay seq>since on connect | Reconnect with since=N receives the missed events, verified by test | Low urgency — polling + hello-resync covers current scale |
| WF-G7 | resolved | medium | docs | docs | fable5-agora-upgrade | 2026-07-01 | Workflow friction only lived in ephemeral `WORKFLOW:` chat messages and session memories — no durable, structured registry | THIS FILE (tools/agora/WORKFLOW_GAPS.md), served in the dashboard docs panel; indexable via `gapIndex.mjs --root tools/agora` | Friction reported by one wave was invisible to the next; lessons re-learned per campaign | — | gapIndex parses this registry (test: gapIndex.workflowGaps) | Resolved BY this registry's creation |
| WF-G8 | open | medium | enforcement | claude-hooks | fable5-agora-upgrade | 2026-07-01 | New hooks in `.claude/settings.json` do not load into ALREADY-RUNNING Claude sessions whose watcher predates the file (and worktree sessions need their own copy) | Git-guard rollout 2026-07-01: probe `git checkout nonexistent-...` executed unguarded in the authoring session; main-repo sessions hot-reload because settings.json predated them | Enforcement rollouts are silently partial until sessions restart — a false sense of protection | Announce hook rollouts on the Agora board (done for git-guard) AND document the restart requirement in AGENTS.md's coordination section | A freshly-started session demonstrably blocks `git checkout` (safe nonexistent-branch probe) | Worktree copy written at Aralia/competent-goldberg-62372f/.claude/settings.json |
| WF-G9 | open | low | verification | dashboard | fable5-agora-upgrade | 2026-07-02 | The preview MCP's `preview_screenshot` intermittently wedges (30s timeout) while the page stays fully responsive — `preview_eval`/`preview_inspect` answer instantly throughout; once wedged, reloads do not recover and a preview restart only sometimes does | Isolation run 2026-07-02: fresh tab shot OK ×2 (dashboard + docs nav), wedged immediately after `preview_click`, then table AND card views both timed out post-restart; page content ruled out (static docs page affected) | Visual-verification loops silently stall; agents burn 30s timeouts or skip the eyeball entirely | Use the dependable fallback: `node tools/agora/shoot-page.mjs <url> <out.png> [--eval js]` (headless Playwright, added 2026-07-02) for pixel proof; keep preview_inspect for style assertions; report upstream if the harness exposes a channel | shoot-page.mjs captures the same URL in <5s while preview_screenshot times out (reproduced 2026-07-02) | Suspected readiness-wait race in the capture pipeline, not the pages |
