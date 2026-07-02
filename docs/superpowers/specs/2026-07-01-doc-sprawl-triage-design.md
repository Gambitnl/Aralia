# Documentation Sprawl Triage — Design

**Date:** 2026-07-01 (grilled out via an in-depth interview, mattpocock/skills
`/grill-me` style — see [github.com/mattpocock/skills](https://github.com/mattpocock/skills))
**Status:** Design locked (grilled). Not yet built.
**Category:** Tools, Docs & Agents → Docs, Roadmap & Workflow (per
[PROJECT_CATEGORY_TAXONOMY.md](../../projects/PROJECT_CATEGORY_TAXONOMY.md))

## Problem

This repo has **1,906 markdown files under `docs/`** and **462 under `.agent/`** —
2,368 total, not counting root-level and `devtools/`/`conductor/`/`deprecated/`/`misc/`
plan files. Markdown accumulates faster than anyone reviews it, and three partial
systems already exist to fight this, none of which actually solves it:

1. **`docs/registry/@DOC-REVIEW-LEDGER.md`** — a thorough, manual, file-by-file audit
   process with a real taxonomy (`keep in place` / `rewrite in place` / `split` /
   `move to archive` / `move` / `retire`) and a Mandatory Processing Gate requiring
   each file be read whole. It stalled on **2026-03-11** and only ever covered a
   slice of root docs. Manual review does not scale to 2,368 files.
2. **Atlas reconciliation** (`.agent/atlas/`, runs daily, auto-commits) — indexes
   4,631 documents and labels plans `active` / `blocked` / `partially_done`, but it's
   naive: it trusts self-reported status fields. Its 2026-06-30 run flagged **"No
   stale plan files"** while still calling four-month-old February plans "active."
   It does not check plan claims against actual code.
3. **Understand Anything** (external plugin, dashboard at `127.0.0.1:5173`) —
   auto-extracts a real code knowledge graph (structure, imports, domain context) via
   static analysis. Currently unused as a verification source for anything in this
   repo.

The root failure pattern this spec targets: **a plan that was executed but the file
was never updated to say so** — it keeps reading as an open forward-looking plan
long after the work shipped, or the codebase moved on to a different mechanic
entirely. A live example surfaced during this same grilling session:
[`2026-06-29-open-region-wilderness-design.md`](2026-06-29-open-region-wilderness-design.md)'s
own header documents this exact failure — its 10 decisions were "grilled" on
2026-06-29 but only existed in session memory until a documentation audit caught the
gap and transcribed them to a tracked file on 2026-06-30. And even during **this**
grilling session, four new plan/spec files were created under `docs/superpowers/` —
the sprawl is actively ongoing, not just historical.

## Resolved decisions

1. **Reuse-and-fix, not rebuild.** Keep the ledger's taxonomy and Atlas's daily
   cadence. Fix Atlas's detection to be code-grounded instead of trusting
   self-reported status. Revive the ledger's process, but run it at agent scale
   instead of one human's reading pace.

2. **Corpus scope: this repo only** (`F:\Repos\Aralia`). Investigated during
   grilling: Atlas's report references `conductor/tracks/…`, `devtools/roadmap/…`,
   `deprecated/uplink/…`, `misc/dev_hub/…` — all confirmed to be genuine
   repo-root directories, not evidence of cross-repo scope. The one true outlier,
   `Aralia/clever-snyder-12ab8b/…`, is a dead reference to an old remote-session
   sandbox that no longer exists on disk. No multi-repo scope question remains.

3. **Content scope: plan/spec/status-shaped docs only** — not reference/data content
   (spell reference docs, glossaries, generated exports, portraits). Classification
   is **per-file, agent-judged**, not a fixed directory allowlist, so a plan
   misfiled into a reference folder still gets caught. This costs a classification
   pass over all 2,368 files before the expensive full-read triage runs.

4. **Verification method: full agent read on every in-scope file.** No heuristic
   shortcuts, no mtime-only triage. This matches the ledger's existing Mandatory
   Processing Gate — read as a whole, claims extracted, checked against the repo —
   just executed by agents instead of a single human.

5. **"Executed but stale" disposition: no blanket rule.** Judged case by case,
   using the menu the ledger already defines (rewrite to a short completion note /
   fold into a living index and delete the original / archive as-is with a banner).
   Some files deserve full historical preservation; others are pure noise once the
   fact of completion is captured elsewhere.

6. **Approval gate: human-in-the-loop, pilot scale.** Start small. The orchestrator
   batches proposed dispositions for review before anything is applied — one
   checkpoint per batch, not per file, not fully autonomous. Widen the loop once
   trust is established on a small batch.
   - **Pilot batch is deliberately left open** — chosen at kickoff, not fixed here.
     Candidates surfaced during grilling: `docs/superpowers/plans/` +
     `docs/superpowers/specs/` (smallest, most self-contained, easiest to judge
     triage quality against what's already known); the ledger's own stalled queue
     (continues existing work); `.agent/atlas/reports/` snapshots (smallest
     possible pilot, throwaway-shaped).

7. **Multi-agent orchestration**, reusing infrastructure already proven at scale:
   - **Agora** (`:4319` — presence, file locks, task board, messaging) so concurrent
     review agents never clobber the same project's `GAPS.md`/tracker. This is the
     same mechanism that drove the 2026-06-28 25-agent UX campaign with **zero lock
     conflicts across 5 waves**.
   - **Agent Matrix** (`:3040`, separate `Aralia-operator-dashboard` repo) for
     parallel review throughput across worker-ready external agent lanes, subject
     to each lane's existing guardrails (e.g. Copilot capped to small/bounded
     tasks, no paid-usage escalation, Codex is orchestrator-only).

8. **Forward-looking prevention rule.** Folding an executed plan into a living
   index (rather than leaving the file stale) becomes a **standing rule**, not just
   a one-time cleanup. It gets **wired into an existing completion-checkpoint
   skill** (`superpowers:verification-before-completion` or
   `superpowers:finishing-a-development-branch` are the natural attachment points)
   so it fires automatically when work wraps, instead of relying on future sessions
   remembering a documented convention.

9. **Deliverable includes a self-improving orchestrator playbook**, sibling to the
   proven [`tools/agora/ORCHESTRATOR.md`](../../../tools/agora/ORCHESTRATOR.md),
   specialized for this doc-triage-and-routing campaign. It should be rewritten and
   improved across runs as lessons are learned, the same way `ORCHESTRATOR.md`
   already documents lessons from its own campaign history.

## The per-file pipeline

For every file the classification pass marks plan/spec/status-shaped:

1. **Classify** — plan-shaped or reference-shaped? (agent judgment, not folder rule)
2. **Decompose** the file into discrete statements that would have to be true if the
   plan were complete (e.g. "X reads/writes `state.worldforgeDeltas`", "function Y
   exists in `groundChunkLoader.ts`").
3. **Search the codebase for proof** of each statement. Classify evidence using the
   vocabulary [`PROJECT_VERIFICATION_SCHEMA.md`](../../projects/PROJECT_VERIFICATION_SCHEMA.md)
   already defines for the rest of the project docs (T=scoped_tests,
   B=build_typecheck, V=visual_browser, M=manual_flow, D=docs_consistency) — new
   evidence should classify the same way existing project proof already does, not
   invent a parallel vocabulary.
4. **Extract "left to be done"** from what's proven vs. unproven.
5. **Categorize** that leftover work against the existing project registry
   ([`PROJECT_TRACKER.md`](../../projects/PROJECT_TRACKER.md) →
   [`PROJECT_CATEGORY_TAXONOMY.md`](../../projects/PROJECT_CATEGORY_TAXONOMY.md)
   `main_category`/`subcategory`/`category`), adding a new category only if nothing
   existing genuinely fits — the taxonomy is explicitly allowed to grow.
6. **Route** the leftover work to the owning project's `GAPS.md` (or equivalent).
   The orchestrator — never a review agent directly — holds the Agora lock on that
   target file so two review agents can't write it at once.
7. **Propose a disposition** for the source file itself (keep / rewrite / split /
   archive / move / retire) with the evidence chain attached.
8. **Batch** proposed dispositions go to human review before anything is applied.

## Orchestrator prerequisites

- Must **intake the full `PROJECT_TRACKER.md` registry** before dispatching any
  review agent, so it knows which project owns a given piece of found work before
  routing anything.
- Must **register on Agora** and hold locks on every project file it or its review
  agents touch.
- May dispatch review agents through **Agent Matrix** worker-ready lanes for
  parallel throughput, honoring each lane's existing guardrails.
- Writes and maintains the orchestrator playbook (decision 9) as it runs, so the
  next orchestrator inherits lessons instead of re-discovering them.

## Explicitly deferred (not designed here)

- The exact starting pilot batch — a kickoff-time decision.
- The exact wiring of the forward-prevention rule into a completion skill — the
  goal is named, the trigger/hook mechanism is not designed.
- The actual code-grounded replacement for Atlas's self-reported-status check —
  in scope by decision 1, but its detection logic is not designed in this spec.
