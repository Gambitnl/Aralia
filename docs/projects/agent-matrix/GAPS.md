---
schema_version: 1
gap_schema: project_gap_registry
project: Agent Matrix
slug: agent-matrix
status: active
scope: "Gaps in the AGENT MATRIX - the external-agent offering ledger (operator dashboard :3040, .agent/orchestration/agent-offerings.json) and its mirror tools/agora/agents.json: onboarding, dispatch eligibility, lane wiring, usage probes, and the sync between the two. NOT general workflow gaps (tools/agora/WORKFLOW_GAPS.md) and NOT game gaps."
id_prefix: AM-G
next_free_id: AM-G2
allowed_statuses: [open, in_progress, blocked, needs_validation, resolved, wont_fix]
allowed_severities: [low, medium, high, critical]
allowed_classifications: [coordination, dispatch, daemon, client-tooling, registry, tracker-sync, verification, docs, enforcement, quota, infra]
allowed_surfaces: [agents-registry, dashboard, external-agents, orchestrate, agora-client, docs]
suggested_agent_values: "One exact key from tools/agora/agents.json, or human-operator"
machine_readable_via: "node tools/agora/gapIndex.mjs --root docs/projects/agent-matrix  (same parser as WORKFLOW_GAPS.md); append rows with node tools/agora/client.mjs gap add --project agent-matrix ..."
related: tools/agora/WORKFLOW_GAPS.md
---

# Agent Matrix gaps

This registry holds gaps in the Agent Matrix: the external-agent offering ledger on the operator dashboard (:3040) and its Agora mirror `tools/agora/agents.json`. Register a gap here when the Matrix, the mirror, or the dispatch wiring between them fails an orchestrator. Register a general workflow gap in `tools/agora/WORKFLOW_GAPS.md` instead.

## Hard rules

1. One row per gap. Fill every column. Use `-` only for Next proof on `wont_fix`.
2. Take the Gap ID from `next_free_id` or let `client.mjs gap add --project agent-matrix` allocate it. Never reuse an ID.
3. Closed columns use only the values in the YAML header.
4. `Registered by` is the live Agora handle. `Registrant ID` is the full agent UUID. `Task/thread` is the exact task or session id.
5. Move to `resolved` only with evidence in the Evidence column.

## Registry

| Gap ID | Status | Severity | Classification | Surface | Registered by | Suggested agent | Registrant ID | Task/thread | Date | Gap | Evidence | Why it matters | Next action | Next proof | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AM-G1 | resolved | high | tracker-sync | agents-registry | fable-orch-todo-20260913 | claude | d88d6fe5-14a8-4d21-bdc5-e24197af8b32 | d183b1ea-c105-480d-9486-d3dbff550469 | 2026-09-13 | The Matrix dashboard ledger and its Agora mirror tools/agora/agents.json disagree on who can work: the dashboard marks claude and codex 'benched' while agents.json marks both 'ready'; and 20 dashboard lanes at 'worker-ready' (copilot-cli, jules-cli, opencode-cli, kiro-cli, mistral-vibe-cli, devin-cli, google-litert-lm, github-models, groq-free, cerebras-free, openrouter-free, google-gemini-api, nvidia-nim, huggingface-inference, sambanova-free, cloudflare-workers-ai, zai-glm-free, vertex-gemini, gemini-interactions-agent, cursor-cli) are absent from agents.json or listed as unknown/not-wired, so validatePlan rejects every one of them | GET http://localhost:3040/api/agent-offerings on 2026-09-13: claude readiness=benched dispatchEligibility=benched, codex=benched; 20 offerings dispatchEligibility=worker-ready. node tools/agora/orchestrate.mjs agents (agents.json updated 2026-09-08): claude ready, codex ready, only claude/codex-spark/kilo dispatchable; devin/amp/poolside/zcode 'unknown'; copilot, jules, opencode, kiro, mistral-vibe and every API lane have no row at all | ORCHESTRATOR.md says agents.json is 'the single source orchestrators trust' and that the dashboard contract should update it; an orchestrator choosing lanes from the Matrix cannot dispatch any of the 20 ready lanes, and one reading agents.json believes the two benched lanes are ready | Add a sync check (orchestrate agents --matrix) that pulls /api/agent-offerings, diffs readiness/dispatchEligibility per id against agents.json, and prints every disagreement; then decide per lane whether to add a row with dispatch wiring or to record why it stays unwired | orchestrate agents --matrix prints zero disagreements for claude, codex and the 20 worker-ready lanes | First row of the new docs/projects/agent-matrix/GAPS.md registry, created 2026-09-13 on Remy's request for a Matrix-specific gap file; Reconciled tools/agora/agents.json with the live dashboard ledger (GET http://127.0.0.1:3040/api/agent-offerings, 42 offerings, 22 worker-ready). agents map 12 -> 32 rows: added opencode-cli, mistral-vibe-cli, kiro-cli, copilot-cli, jules-cli, google-litert-lm and 12 API lanes (github-models, groq-free, cerebras-free, openrouter-free, google-gemini-api, nvidia-nim, huggingface-inference, sambanova-free, cloudflare-workers-ai, zai-glm-free, vertex-gemini, gemini-interactions-agent), wired agy/cursor/devin, added cline (CLI 3.0.60) and freebuff (not-viable, TUI-only). codex now status benched per the ledger; claude keeps the Agent-tool lane under a documented matrixOverride. Every row carries matrixId. New tools/agora/syncAgents.mjs plus 'orchestrate agents --matrix' diffs the two and prints zero disagreements (exit 0). validatePlan now accepts dispatch.type api with an endpoint. node --test orchestrate.registry.test.mjs orchestrate.test.mjs: 34/34 pass. (w0-am-g1, 2026-09-20) |
