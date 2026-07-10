---
schema_version: 1
gap_schema: workflow_gap_registry
scope: "Gaps in the multi-agent WORKFLOW itself — coordination, dispatch, tooling, tracker-sync, verification. NOT game/feature gaps (those go in the owning project's docs/projects/**/GAPS.md)."
id_prefix: WF-G
next_free_id: WF-G19
allowed_statuses: [open, in_progress, blocked, needs_validation, resolved, wont_fix]
allowed_severities: [low, medium, high, critical]
allowed_classifications: [coordination, dispatch, daemon, client-tooling, registry, tracker-sync, verification, docs, enforcement, quota]
allowed_surfaces: [agora-daemon, agora-client, orchestrate, agents-registry, gap-index, dashboard, claude-hooks, external-agents, project-tracker, docs]
machine_readable_via: "node tools/agora/gapIndex.mjs --root tools/agora  (same parser as project GAPS.md; NOTE: only the open Registry table below is indexed — the Resolved archive is retained prose)"
---

# Workflow Gaps — the registry for gaps in HOW we work

Any agent or orchestrator that hits friction in the multi-agent workflow registers it HERE —
durable and structured, unlike `say "WORKFLOW: ..."` chat messages (which scroll away).

## Hard rules (the structure is not optional)

1. **One row per gap** in the Registry table below. Every column filled — no blanks; use `—`
   only for Next proof on `wont_fix`.
2. **Gap ID**: take `next_free_id` from the YAML header and increment it. Never reuse or
   renumber an ID (including archived ones).
3. **Status** ∈ the YAML `allowed_statuses`. New gaps start `open` (or `blocked` with the
   blocker named in Notes). Only move to `resolved` with EVIDENCE (test, commit, live-verify)
   in the Evidence column.
4. **Evidence is concrete**: file:line, test name, message seq, measured number — never
   "seems to" or "probably".
5. **Link work to gaps**: board tasks addressing a gap carry `--ref workflow:WF-G<n>`;
   `orchestrate reconcile <plan> --root tools/agora` then cross-checks done tasks against
   this registry like any other (`--apply` writes the row update for you).
6. **Registering is cheap and encouraged** — a WORKFLOW: chat message that matters should
   ALSO become a row here. If unsure whether it belongs, register it; `wont_fix` is a valid
   outcome, silent loss is not.
7. **Resolved rows MOVE to the Resolved archive** at the bottom (with their resolution
   evidence) so the Registry shows only live work. Archive rows are retained forever but are
   NOT machine-indexed. Corrections to archived rows go in their Notes.

## Registry

| Gap ID | Status | Severity | Classification | Surface | Registered by | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-G15 | open | high | coordination | agora-daemon | orch.vega (Claude Fable 5) | 2026-07-10 | Task handoff accepts any `toAgentId` — a mistyped or dead target strands the task claimed-by-a-ghost forever | `store.mjs` `handoffTask` (~L1061) has no existence/liveness check; reducer `task.handoff` (~L418) sets `claimedBy` unconditionally; `sweepExpired` only reopens tasks whose claimant record still exists in `state.agents` | A stranded task is silent ownership loss — the exact failure the co-orchestration pact exists to prevent | Sol (backend lane): reject handoff unless `toAgentId` is a live registered agent, else error (+tests) | Test: handoff to unknown/dead id rejected; valid handoff unchanged | Campaign co-orchestration-pipeline |
| WF-G16 | open | medium | coordination | agora-daemon | orch.vega (Claude Fable 5) | 2026-07-10 | `claim-next` pulls the top ready task across ALL campaigns — concurrent fleets cross-pull each other's tasks | `store.mjs` `claimNextReady` (~L1055) filters only `isTaskReady`; no campaign/category parameter anywhere in store/server/client | Two orchestrators running parallel waves steal each other's packets; workers do work their own lead cannot gate | Sol (backend lane): optional campaign/category filter on claim-next through HTTP + client; unfiltered default unchanged (+tests) | Test: two campaigns seeded, filtered claim-next returns only own-campaign task | Campaign co-orchestration-pipeline |
| WF-G17 | open | medium | coordination | agora-daemon | orch.vega (Claude Fable 5) | 2026-07-10 | `GET /campaigns` shows dead-owner leads as `active` — misleads a polite orchestrator into backing off a free file domain | Claim-time overlap already ignores dead owners (`activeCampaigns` → `isLiveAgent`, `store.mjs` ~L858) but `listCampaigns` exposes no owner liveness; board showed 5 dead "active" leads on 2026-07-09 | ORCHESTRATOR.md §0b tells orchestrators to inspect campaigns before seeding; they see false conflicts and stall | Sol: expose owner liveness in the campaigns list + document takeover (re-claim a dead owner's campaign id) in PROTOCOL.md. Vega: dashboard renders owner liveness client-side | Test: dead-owner lead reports not-live in list; dashboard shows it grayed | Vega dashboard half lands in campaign co-orchestration-pipeline too |
| WF-G18 | open | high | dispatch | external-agents | codex-sol-56 (Codex Sol) | 2026-07-10 | Command-feed messages cannot reliably wake or resume an orchestrator whose harness is idle or absent | Human directive seq 531 requires every human message, direct message, and `@callsign` mention to activate the intended orchestrator; Vega seq 533 confirms only the Claude-side watcher exists; installed Codex CLI 0.140.0 exposes `codex exec resume <session-id> <prompt>` but no verified Windows desktop message-injection route | Human steering can sit unread while task ownership and recovery decisions age, so the board is durable but not responsive | Build one registry-driven Agora watchdog with durable message cursor, human/direct/mention filtering, dedupe, cooldown, process/presence checks, audited adapter results, and explicit Codex/Claude resume adapters | Tests prove filter/cursor/dedupe/cooldown; live proof wakes an absent CLI harness once and records the triggering message sequence | Desktop-native Codex wake remains `wake-unavailable` until a supported Windows route is verified; CLI session resume is the first supported Codex adapter |

## Resolved (archive)

Retained history — not machine-indexed. Newest resolutions last.

| Gap ID | Status | Severity | Classification | Surface | Registered | Resolved | Gap (short) | Resolution evidence |
|---|---|---|---|---|---|---|---|---|
| WF-G7 | resolved | medium | docs | docs | 2026-07-01 | 2026-07-01 | Workflow friction only lived in ephemeral WORKFLOW: chat messages | Resolved BY this registry's creation; indexable via gapIndex (test: gapIndex.workflowGaps) |
| WF-G1 | resolved | high | enforcement | external-agents | 2026-07-01 | 2026-07-02 | Destructive-git guard didn't cover external CLI agents (no Claude hooks, no git pre-reset hook) | PATH-shim `tools/agora/git-shim/` (git.cmd + sh twin + git-shim.mjs → same `guardGit.decide`); `orchestrate dispatch` prepends it to every external agent's PATH (`orchestrate.mjs cmdDispatch env`). Test `resolution.test.mjs` "git shim": `reset --hard` exits 2 with the guard reason, `--version` delegates to real git. GIT_GUARD_ALLOW=1 escape hatch preserved |
| WF-G2 | resolved | medium | dispatch | orchestrate | 2026-07-01 | 2026-07-02 | Onboarded external agents had no dispatch wiring — worker pool effectively Claude-only | KILO wired + LIVE-VERIFIED: `kilo run -m kilo/kilo-auto/free "<prompt>"` returned PROBE_OK exit 0 (2026-07-02); agents.json dispatch+quotaProbe filled; launchSpec/probeAgent now registry-driven; validatePlan accepts kilo workers (test). cursor (quota-locked to 2026-07-10, not on bash PATH) and agy (print-probe produced no output — auth unverified) stay honestly unwired per agents.json notes |
| WF-G3 | resolved | medium | tracker-sync | project-tracker | 2026-07-01 | 2026-07-02 | reconcile detected stale-open GAPS.md rows but closing them was manual | `orchestrate reconcile <plan> --apply`: `gapIndex.updateGapRow` rewrites the matched row's status→resolved + appends board evidence, using each file's OWN column order; Agora-locked registry files are skipped. Test `resolution.test.mjs` "updateGapRow" |
| WF-G4 | resolved | medium | coordination | agora-client | 2026-07-01 | 2026-07-02 | Silent-but-alive workers reaped at 60min mid-task | Two halves: generated prompts include background heartbeat + 401-reaped recovery (buildPrompt, 2026-07-02 AM); daemon-side grace — agents HOLDING claimed/in_progress tasks get 2× the drop horizon before reaping (`store.mjs sweepExpired`). Test: reap test asserts survival at 1.2× and reaping at 2.2× |
| WF-G5 | resolved | low | quota | agents-registry | 2026-07-01 | 2026-07-02 | Quota probes were hardcoded per agent | `probeAgent`/`launchSpec` are registry-driven off agents.json `quotaProbe`/`dispatch` — a new agent needs zero orchestrate.mjs changes. Tests: okbot/drybot/nobot stub registry |
| WF-G6 | resolved | low | daemon | agora-daemon | 2026-07-01 | 2026-07-02 | SSE `?since=` was echoed but the event gap never replayed | 300-event ring in `server.mjs`; on connect, events with seq>since replay after hello tagged `"replayed":true`. Test: SSE reconnect test asserts the missed task.create arrives as an event |
| WF-G8 | resolved | medium | enforcement | claude-hooks | 2026-07-01 | 2026-07-02 | Hook rollouts silently partial for already-running sessions | Restart requirement now documented in AGENTS.md's Multi-Agent Coordination section (the discovery surface every agent reads) + rollouts announced on the board (git-guard precedent). Underlying watcher behavior is harness-side |
| WF-G9 | resolved | low | verification | dashboard | 2026-07-02 | 2026-07-02 | preview_screenshot wedges intermittently; visual loops stalled | Dependable fallback shipped + proven: `tools/agora/shoot-page.mjs <url> <out.png> [--eval js] [--full]` captures in <5s where the preview tool times out (reproduced repeatedly 2026-07-02); DOM assertions via preview_inspect documented as the style-check path. Upstream harness race remains out of our control |
| WF-G10 | resolved | medium | dispatch | orchestrate | 2026-07-02 | 2026-07-02 | Two orchestrators clobbered one identity file; missing seed map silently built TID-less prompts | Per-wave identity dir `orchestrator-<wave>` used by seedPlan/board/fetchTasks (`orchIdentityDir`); loadSeededMap now WARNS loudly when missing and THROWS on corrupt (never silent `{}`). Seed test green with per-wave identity |
| WF-G11 | resolved | low | daemon | agora-daemon | 2026-07-02 | 2026-07-02 | `task handoff` had no authorization — any agent could reassign any task | `store.mjs handoffTask`: only the current claimant or the task's creator may reassign; others get an error. Test: rogue handoff rejected, creator + claimant allowed |
| WF-G12 | resolved | medium | tracker-sync | orchestrate | 2026-07-02 | 2026-07-02 | Packet refs seeded verbatim — typos and ambiguous bare ids surfaced only at reconcile | `validateRefsAgainstIndex` at seed time: AMBIGUOUS bare ids (23 measured, `G5` in 32 projects) are ERRORS naming the fix; unknown refs warn (ad-hoc codes stay legal). Proof: the old seed fixture's bare `G1` was rejected by the new check and had to qualify |
| WF-G13 | resolved | medium | tracker-sync | gap-index | 2026-07-02 | 2026-07-02 | `routed`/`merged-reference` etc. were neither open nor closed — reconcile silently swallowed them | `CLOSED_STATUSES` exported from gapIndex (routed/merged-reference/wont_fix/… = "no work owed HERE"); reconcile puts anything in NEITHER set into an `unrecognizedStatus` bucket it REPORTS. Test: routed→closed, in_scope_now→unrecognized, open→stale |
| WF-G14 | resolved | low | dispatch | agents-registry | 2026-07-02 | 2026-07-02 | validatePlan ignored expired date-bound constraints | validatePlan emits onWarn per expired constraint (wired to console.warn in loadPlan). Test: 2020-expired constraint produces exactly one warning naming the date |
