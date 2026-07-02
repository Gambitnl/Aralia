# Handover — Documentation Sprawl Triage (design session)

**Date:** 2026-07-01 · **Author:** prior session (Remy + Claude) · **Status of feature:** DESIGN LOCKED, nothing built yet

This document hands off the "doc sprawl triage" design work. It assumes zero prior context.

---

## 1. TL;DR — what to do next

1. **Read the spec first, in full:**
   [`docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md`](../specs/2026-07-01-doc-sprawl-triage-design.md).
   Everything below is a summary — the spec has the actual resolved decisions and the
   per-file pipeline.
2. **Nothing has been built.** This was a grilling/design session only (interview →
   spec). No orchestrator code, no review-agent prompts, no playbook doc exist yet.
3. **First real decision on pickup: choose the pilot batch.** The spec deliberately
   left this open. Candidates named during grilling: `docs/superpowers/plans/` +
   `docs/superpowers/specs/` (smallest, self-contained), the stalled
   `docs/registry/@DOC-REVIEW-LEDGER.md` queue (continues existing work), or
   `.agent/atlas/reports/` (smallest possible, throwaway-shaped). Ask Remy via
   `AskUserQuestion` rather than picking silently — this is his call.
4. Before dispatching any review agent: **intake the full
   `docs/projects/PROJECT_TRACKER.md` registry** (needed to route leftover work to
   the right project) and **register on Agora** (`npm run agora`, port 4319,
   lock-before-edit — see §5).
5. Write the orchestrator playbook (spec decision 9) as you go — it's meant to be a
   sibling to `tools/agora/ORCHESTRATOR.md`, not a one-off. Read that file first as
   the template/pattern to follow.

---

## 2. What this is

Aralia has **2,368 markdown files** (1,906 in `docs/`, 462 in `.agent/`) and three
partial systems already trying (and failing) to keep them from going stale:

- `docs/registry/@DOC-REVIEW-LEDGER.md` — thorough manual audit taxonomy, stalled
  since 2026-03-11, doesn't scale.
- Atlas reconciliation (`.agent/atlas/`, runs daily) — indexes 4,631 docs but trusts
  self-reported status; missed four-month-old "active" plans as stale.
- Understand Anything (external code-knowledge-graph plugin) — unused as a
  verification source.

The core failure pattern this spec targets: **a plan that was executed but the file
was never updated to say so.** The spec was reached through a full grilling
interview (topic itself picked via `/grill-me`-style questioning — see the spec's
own header for how the session got there) and resolved 10 concrete decisions:
reuse-and-fix the existing systems rather than rebuild; scope = this repo only;
content scope = plan/spec/status-shaped docs only (agent-classified per file, not by
folder); verification = full agent read on every in-scope file, no shortcuts; a
concrete per-file pipeline (decompose → prove against code → extract leftover work →
route into the owning project's `GAPS.md` → propose a disposition); human-in-the-loop
batch approval starting small; orchestration via Agora + Agent Matrix; a forward
prevention rule wired into an existing completion skill; and a self-improving
orchestrator playbook as the deliverable.

**Spec:** `docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md`
**Memory:** indexed in project memory as `doc-sprawl-triage-design` (auto-loaded
in future sessions via `MEMORY.md`).

---

## 3. Status & what exists

### 3.1 What's done
- Full grilling interview completed (multiple rounds of `AskUserQuestion`, plus
  live investigation of the three existing systems — read the ledger, an Atlas
  daily report, `PROJECT_TRACKER.md`, `PROJECT_CATEGORY_TAXONOMY.md`,
  `PROJECT_VERIFICATION_SCHEMA.md`, `tools/agora/ORCHESTRATOR.md` pointers).
- Spec written and locked: `docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md`.
- Memory entry written and indexed so future sessions pick this up automatically.

### 3.2 What does NOT exist yet (all of execution)
- No orchestrator script/prompt.
- No review-agent prompt template (the "decompose → prove → extract → route →
  propose disposition" pipeline is designed in prose, not implemented).
- No pilot batch has been run. Zero files have been triaged, rewritten, archived,
  or retired under this system.
- No wiring of the forward-prevention rule into a completion skill.
- No fix to Atlas's self-reported-status weakness.

---

## 4. Explicitly deferred (per the spec — don't invent answers, ask)

- **Pilot batch choice** — kickoff-time decision, not fixed in the spec.
- **Completion-skill wiring mechanism** — which skill, what trigger condition, is
  undesigned. The spec only names the goal (fold executed plans into a living
  index automatically, not just by convention).
- **Atlas's detection-logic fix** — in scope by decision 1, but what code-grounded
  check replaces "trust the self-reported status field" is not designed.

If you're picking this up and about to guess at any of these three, stop and ask
Remy first (`AskUserQuestion`) — these were left open on purpose during grilling,
not missed.

---

## 5. How to start execution (once the pilot batch is chosen)

1. Read `tools/agora/ORCHESTRATOR.md` and `tools/agora/PROTOCOL.md` — the proven
   pattern for running a multi-agent campaign on this shared checkout (drove a
   25-agent, 5-wave campaign 2026-06-28 with zero lock conflicts).
2. Confirm Agora is up: `curl -s http://localhost:4319/health`. Start it if not:
   `npm run agora`.
3. Read `docs/projects/PROJECT_TRACKER.md` in full — this is the routing table for
   leftover work found in any given doc.
4. For each file in the pilot batch, run the per-file pipeline from spec §"The
   per-file pipeline" — classify → decompose into checkable statements → search
   the codebase for proof (using the T/B/V/M/D vocabulary from
   `docs/projects/PROJECT_VERIFICATION_SCHEMA.md`) → extract leftover work →
   categorize against `PROJECT_CATEGORY_TAXONOMY.md` → route to the owning
   project's `GAPS.md` (lock it first) → propose a disposition for the source file.
5. Batch the proposed dispositions and bring them to Remy for review **before**
   applying anything (rewrite/archive/delete). This is a hard requirement from the
   grilling — approval is per-batch, not autonomous, at pilot scale.
6. Write down what worked/didn't as you go — that record becomes the orchestrator
   playbook (spec decision 9), which should end up living next to
   `tools/agora/ORCHESTRATOR.md`.

---

## 6. Other work sitting in the tree (NOT part of this handover — don't touch)

The working tree currently has ~60 modified/untracked files from other, unrelated
threads (grid-retirement-program cleanup, the combat-oriented-opening feature under
`src/systems/gameEntry/` + `src/hooks/useDeEscalation.ts`, spell command-effect
files under `src/commands/effects/`, worldforge region generation). None of that is
from this doc-sprawl-triage session — it's concurrent work already in progress.
Leave it alone unless Remy asks you to pick one of those threads up specifically
(each has, or should have, its own handover doc).

---

## 7. Working agreements (important, from memory)

- **Master only** — never create a branch or git worktree.
- **Never commit / never suggest committing** — the codebase auto-commits to
  GitHub at 2am. Leave work in the tree.
- **No fallbacks** — build one real path, fail honestly.
- **No time estimates / no feasibility-shrinking** — full vision, priority order,
  do what you can.
- **Direction questions go through the `AskUserQuestion` tool**, not raw text —
  especially load-bearing for this handover: §4's three deferred items.
- Explain decisions in plain language (no code-identifier jargon in
  decision-facing summaries) when talking to Remy.
- When multiple agents may touch this shared checkout concurrently, use Agora
  (register, lock-before-edit, announce) — this spec's own execution phase is
  explicitly designed around that.

---

## 8. Key file pointers

| File | Role |
|---|---|
| `docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md` | The spec — read first |
| `docs/registry/@DOC-REVIEW-LEDGER.md` | Existing (stalled) manual taxonomy this reuses |
| `.agent/atlas/reports/*.md` | Existing (naive) daily reconciliation this fixes |
| `docs/projects/PROJECT_TRACKER.md` | Routing table for leftover work |
| `docs/projects/PROJECT_CATEGORY_TAXONOMY.md` | Category schema for leftover work |
| `docs/projects/PROJECT_VERIFICATION_SCHEMA.md` | T/B/V/M/D evidence vocabulary to reuse |
| `tools/agora/ORCHESTRATOR.md` | Template for the campaign-orchestrator playbook to write |
| `tools/agora/PROTOCOL.md` | Agora API + worker etiquette |
