---
schema_version: 1
gap_schema: project_gap_registry
project: Plan-map
slug: planmap
status: active
scope: "Gaps in the PLAN-MAP planning surface - public/planmap/topics.json, the viewer public/planmap/index.html, and the tools/agora/planmap-*.mjs CLIs (add, validate, reconcile, to-wave, history). NOT the roadmap (devtools/roadmap/), NOT general workflow gaps (tools/agora/WORKFLOW_GAPS.md)."
id_prefix: PM-G
next_free_id: PM-G3
allowed_statuses: [open, in_progress, blocked, needs_validation, resolved, wont_fix]
allowed_severities: [low, medium, high, critical]
allowed_classifications: [coordination, dispatch, client-tooling, registry, tracker-sync, verification, docs, enforcement]
allowed_surfaces: [planmap, orchestrate, agora-client, docs]
suggested_agent_values: "One exact key from tools/agora/agents.json, or human-operator"
machine_readable_via: "node tools/agora/gapIndex.mjs --root docs/projects/planmap  (same parser as WORKFLOW_GAPS.md); append rows with node tools/agora/client.mjs gap add --project planmap ..."
related: tools/agora/PLANMAP-AGENT-GUIDE.md
---

# Plan-map gaps

This registry holds gaps in the plan-map: the topic data file, the viewer, and the capture, validate, reconcile, and wave CLIs. Register a gap here when the plan-map or its tools fail an agent. Register a general workflow gap in `tools/agora/WORKFLOW_GAPS.md` instead.

## Hard rules

1. One row per gap. Fill every column. Use `-` only for Next proof on `wont_fix`.
2. Take the Gap ID from `next_free_id` or let `client.mjs gap add --project planmap` allocate it. Never reuse an ID.
3. Closed columns use only the values in the YAML header.
4. `Registered by` is the live Agora handle. `Registrant ID` is the full agent UUID. `Task/thread` is the exact task or session id.
5. Move to `resolved` only with evidence in the Evidence column.

## Registry

| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PM-G1 | resolved | high | client-tooling | planmap | fable-orch-todo-20260913 | claude | d88d6fe5-14a8-4d21-bdc5-e24197af8b32 | d183b1ea-c105-480d-9486-d3dbff550469 | 2026-09-13 | lockGuard.mjs (the guard planmap-add.mjs runs before it writes topics.json) never recognizes the caller's own lock: identityAgentId() reads .agentId from the top level of client-identity.<id>.json, but client.mjs writes that file keyed by daemon URL ({ 'http://localhost:4319': { agentId, ... } }), so the read yields null and every guarded write against a file the caller itself locked is refused with 'guard read identity: none' | 2026-09-13: AGORA_AGENT_ID=fable-orch-todo-20260913 node tools/agora/client.mjs lock public/planmap/topics.json succeeded (lock 1a83... by d88d6fe5-14a8-4d21-bdc5-e24197af8b32); then AGORA_AGENT_ID=fable-orch-todo-20260913 node tools/agora/planmap-add.mjs --new-topic todo-marker-hygiene ... exited 2 with 'Agora lock held by agent d88d6fe5-... guard read identity: none'. tools/agora/lockGuard.mjs:22-33 vs tools/agora/client.mjs:14 (shape comment) and :138-160 (identityPath/loadIdentity keyed by baseUrl) | The documented multi-agent recipe (lock topics.json, then run planmap-add with the same AGORA_AGENT_ID prefix, PLANMAP-AGENT-GUIDE.md section 7 and WF-G120) cannot work; agents either skip the lock (clobber risk) or pass --force-no-lock, which defeats the guard | Make identityAgentId() read the baseUrl-keyed entry (AGORA_URL or http://localhost:4319, else the single/first entry); add a lockGuard.test.mjs case with a real keyed identity file; keep AGORA_HELD_LOCK as the fallback | With a live lock held by the caller, AGORA_AGENT_ID=<handle> node tools/agora/planmap-add.mjs --topic <id> --feature ... writes and prints the planmap ref; lockGuard.test.mjs passes | First row of the new docs/projects/planmap/GAPS.md registry; RESOLVED 2026-09-13 by fable-orch-todo-20260913: lockGuard.mjs identityAgentId() now reads the baseUrl-keyed entry (AGORA_URL or http://localhost:4319, else the first keyed entry) and still accepts a flat legacy file; two PM-G1 cases added to lockGuard.test.mjs; node --test tools/agora/lockGuard.test.mjs -> 11/11 pass; live: with lock held on topics.json, planmap-add --new-topic todo-marker-hygiene wrote (after the PM-G2 fix) (fable-orch-todo-20260913, 2026-09-13) |
| PM-G2 | resolved | high | client-tooling | planmap | fable-orch-todo-20260913 | claude | d88d6fe5-14a8-4d21-bdc5-e24197af8b32 | d183b1ea-c105-480d-9486-d3dbff550469 | 2026-09-13 | planmap-add.mjs still writes topics.json with a single tmp+rename (line 339/367) and dies with EPERM whenever a dev server is serving public/planmap/topics.json; sync-surfaces.mjs fixed the same failure on 2026-09-12 with retry plus a verified in-place write, but the capture CLI never got the fix, so the documented multi-agent capture path fails on the first topic | 2026-09-13: AGORA_AGENT_ID=fable-orch-todo-20260913 node tools/agora/planmap-add.mjs --new-topic todo-marker-hygiene ... printed 'plan-map validation: clean (190 topics, 834 features)' then 'Error: EPERM: operation not permitted, rename topics.json.tmp -> topics.json' at planmap-add.mjs:367; a stale public/planmap/topics.json.tmp (396,496 bytes) was left behind. Reference fix: tools/agora/sync-surfaces.mjs:52-90 atomicWrite | Every plan-map capture during a dev session fails; agents fall back to hand-edits of a 7,000-line file or skip the map, which is the drift the reconcile loop exists to prevent | Give planmap-add.mjs the same write strategy as sync-surfaces atomicWrite: pid-scoped tmp, bounded rename retries, then a verified in-place write on EPERM/EBUSY; remove the tmp on every failure | With a dev server serving topics.json, planmap-add --topic <id> --feature ... exits 0 and the feature is in the file; no .tmp file remains | Same root cause as the 2026-09-12 sync-surfaces fix (memory: windows-atomic-write-blocked-by-serving); RESOLVED 2026-09-13 by fable-orch-todo-20260913: planmap-add.mjs retries the rename 6x with backoff then falls back to a verified in-place write on EPERM/EBUSY and removes the tmp; node --test tools/agora/planmap-add.test.mjs -> 15/15; live: 2 new topics + 47 features written while the dev server served topics.json (each run printed the in-place note); validate-planmap clean (191 topics, 883 features) (fable-orch-todo-20260913, 2026-09-13) |
