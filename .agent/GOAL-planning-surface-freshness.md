# GOAL: Planning surfaces — one list, always true

## The standard

Open any planning tool and what you read is true, today, without anyone having remembered to update it. Planmap is the only place a human sets status. Everything else follows by machine or dies. If a surface can silently disagree with planmap, this goal is not done.

## The test

Pick any live topic. Check it on the planmap page, the roadmap page, and the board. All three agree, and the planmap page shows how old the information is. Then stop the daemon for a day: the planmap page must SAY the sync is stale — silence is failure.

## Pass/fail criteria

All must hold at once:

- [ ] `tools/agora/sync-surfaces.mjs` exists, idempotent (run-twice test green), refuses to write when the map is invalid
- [ ] board results reach planmap without human action: live (daemon debounce) and nightly (2am ps1 line)
- [ ] every planmap topic carries `updated`; the planmap page shows age badges and a last-sync banner
- [ ] the roadmap page shows every planmap topic as a node under its campaign's branch, status matching planmap on load
- [ ] the board archives done tasks after 14 days; handoff to a dead agent is refused (WF-G15 closed); dead-owner campaigns flagged (WF-G17 closed)
- [ ] the absorption wave is complete: `docs/projects/` has no project folders left; every card lives as a tile (gaps = step tiles, done work backdated on the right lane); worthwhile prose distilled to linked spec docs
- [ ] tracker page, its registry, its audit script, and its API routes are deleted; nothing references them
- [ ] `node tools/agora/validate-planmap.mjs` exits 0
- [ ] chronicle and atlas silence is visible in health.json

## Where everything lives

- Spec: `docs/superpowers/specs/2026-07-14-planning-surface-freshness-design.md` (Revision 2 = full absorption)
- Plan: `docs/superpowers/plans/2026-07-14-planning-surface-freshness.md` (12 tasks; 5+9 canceled, 10R = agent wave, 12R = tracker deletion)
- Playbook for wave subagents: `docs/superpowers/plans/absorption-playbook.md` (created by Task 10R)
- Planmap topic: `planning-surface-freshness` (features mirror the stages)
- Baseline screenshots: `.agent/scratch/freshness-baseline/`
- Artifact (visual spec): https://claude.ai/code/artifact/67892a55-95b6-4c4f-b42d-8ab952deb0de

## Rules of engagement

- build order: engine core (plan tasks 1-4) → roadmap revival (8) → triggers (7) → board tidying (6) → absorption wave (10R, gated on Remy approving the seeded task list) → UI (11) → tracker deletion (12R, only when the wave is done)
- gates that need Remy: wave task list before seeding; screenshots of the planmap UI badges; the one ps1 line (external file)
- never commit; never leave topics.json failing its validator; lock topics.json before editing when other agents are live

## Current state (2026-07-14)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | sync program | **OK** (2026-07-14) | sync-surfaces.mjs live: 3/3 tests incl. run-twice golden + invalid-map refusal; real-repo health run wrote health.json (90 topics) |
| 2 | board→planmap automatic | **PARTIAL — code complete** (2026-07-15) | Daemon debounce BUILT + tested (server.mjs scheduleSyncSoon: any successful task mutation spawns ONE detached sync-surfaces run, 60s coalesced, unref'd; seams syncDelayMs/syncRunner; server suite 14/14). ACTIVATION PENDING: (1) daemon restart — deferred until the codex building wave drains (hazard 898); (2) the nightly ps1 line — Remy's hand, exact line in plan Task 7: `& node F:\Repos\Aralia\tools\agora\sync-surfaces.mjs *> F:\Repos\Aralia\.agent\scratch\sync-nightly.txt` before the commit step of aralia-daily-commit.ps1 |
| 3 | dates + age visible | **PARTIAL** (2026-07-14) | schema+validator learned updated/tier/status_note/decision (9/9 tests); planmap-add stamps `updated` on every mutation; PAGE HALF BUILT + live-verified: sync banner (green/red/never-run), age heat fed by real stamps, detail-pane age line, decision flags, detail-topics toggle (shots: .agent/scratch/freshness-baseline/t11-*.png; Remy eyeball pending). Remaining: backfill `updated` for pre-existing topics (10R) |
| 4 | roadmap shows topics | **OK** (2026-07-14) | engine emits planmap-born nodes for every topic + feature under campaign home pillars; live :3010 page renders them (done/active/planned 129/134/40, was 105/96), zero console errors; unit 4/4; full-map smoke 616 nodes, no id collisions; bindings + campaign-homes are data files in .agent/roadmap-local/ |
| 5 | board hygiene | **OK** (2026-07-15) | archiveDoneTasks (14d, monthly JSONL, journaled+replay-safe), handoff→422 on dead target (WF-G15), campaigns ownerAlive (WF-G17), authed /admin/tidy; 16/16 + 53/53 regression, re-verified by orchestrator. NOTE: first real `npm run sync` archives stale done tasks on the live board |
| 6 | absorption wave | **DONE + VERIFIED** (2026-07-16) | ALL 85/85 rows landed. Verify sweep: 160 topics/539 features validator-clean; docs/projects = 0 folders, 0 inbound links, 0 broken; killed-semantics consistent; 10 decision-flagged features compiled for Remy; 139 pre-wave topics backfilled (tier strategic, 28 dates from history). First full sync run: board agrees (0 changes), 41 disconnected topics surfaced, 1320 stale done tasks archived (board 1699→~380), health.json live for 160 topics. REMAINING GATES: Task 11 eyeball + 12R tracker deletion + 10-item decision queue + nightly ps1 line. Earlier: DISPATCH COMPLETE | Every one of the 85 rows is now done or claimed — 0 open. My crews: 13 absorbed + verified (batches 1-4) + judge tidies (demo-area killed/done fix). Fork-2's crews: 15 rows still in flight (incl. merge/judge tier). Guard bug abbdc943 FIXED this session (AGORA_HELD_LOCK verified path; force exception deleted from playbook; 9/9 tests). Remaining after fork-2 lands: verify sweep of the full map, then Task 11 eyeball gate (Remy) and 12R tracker deletion. Earlier: FLEET TALLY 22/85 done (mine 10 + fork-2's crews); batch 3 complete (conversation-panel, command-factory-runtime incl. cross-crew division of labor, companions); batch 4 in flight (demo-area superseded-tier, design-preview, design-preview-scenarios w/ sibling-dedupe rule); 45 bulk rows remain open. Earlier: Batch 3 UNBLOCKED: the ghost reservation cleared via heartbeat-lease expiry (~90 min total stall = WF-G27's latency gap, notes updated with live confirmation); all 3 workers resumed with the all-clear; fork-2's bulk writer holds the head legitimately. Batch 3 re-launched after the monthly spend limit killed its first run mid-flight (all 3 tasks auto-reopened by the reaper — no locks stranded; limit confirmed lifted by probe). Lock contention is the current bottleneck: workers now carry 40x60s retry budgets. 7 of 85 absorbed + verified across batches 1-2 (latest: command-base/effects-runtime, code-modularization-audit; validator clean at 97 topics/359 features). Batch 3 in flight (command-factory-runtime, companions, conversation-panel) with claim-conflict handling for the second orchestrator's parallel crews. Guard bug hit 2 authorized-forces — abbdc943 rising in urgency. Earlier detail: Batch 1 COMPLETE + verified: 4 of 85 absorbed (compass-pane, action-pane, character-creator, character-sheet), validator clean at 94 topics/349 features, all folders deleted, 2 keeper specs + 2 declared-none. Batch 2 in flight (code-modularization-audit, command-base-runtime, command-effects-runtime) with taskIds inline + lane overrides + lock-refusal protocol. Playbook now carries: taskId rule, authorized-force clause (guard bug abbdc943 filed), link-repair-before-delete section + Remy-gated lane overrides (14 rows, 2026-07-15). Fork-2 orchestrator dispatched in parallel via claim-next: 2 Haiku bulk workers (5 tasks each, escalate-by-blocking) + 1 judgment worker (blocked tasks, merge slugs, planmap special case) — THE FABLE LANE IS COVERED; combined concurrency exceeds the soft cap of 3, accepted because claims are atomic and map writes serialize on the Agora lock |
| 7 | tracker deleted | **FAIL** | page live at misc/project_tracker.html |
| 8 | validator clean | **OK** (2026-07-14) | 88 topics, exit 0 |
| 9 | chronicle/atlas visibility | **OK** (2026-07-14) | health.json surfaces block live: chronicle 10 days silent, atlas 1 day (verified on real repo) |
