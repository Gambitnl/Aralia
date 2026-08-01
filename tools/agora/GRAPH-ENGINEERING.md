# Graph Engineering at Agora — the playbook

**Source:** distilled from a practical article on graph engineering for AI
workflows (Mahax, X long-form, 2026-07-29; retrieved 2026-08-01). The concepts
are restated here in Agora's own vocabulary with working CLI examples, so an
orchestrator or worker can apply them without leaving the board.

**Why this file exists:** Agora's task board already IS a graph — tasks are
nodes, `deps` are edges, readiness is gate evaluation. This playbook teaches
the three moves that make graphs pay off (the fake-edge test, the diamond, the
checker node) and where they break. Plumbing first; theory only where it
changes a command you actually run.

---

## 1. The model is already here

- **Node** = one task (`task new <title>`). One agent, one job, one output.
- **Edge** = a real data dependency between tasks (`--dep <taskId>`). Only add
  one when the downstream task genuinely consumes the upstream task's output.
- **Readiness** = `open` AND every dep `done` (`store.mjs:isTaskReady`,
  `claimNextReady`). `task next` / `tasks --ready` surface only ready nodes.
- **Priority** = tie-break for the ready queue (`--priority N`, higher first).

That is the whole graph. Everything below applies these four things at larger
scale.

## 2. The fake-edge test (run this before designing any wave)

The most common failure is not missing edges — it is invented ones. For every
arrow you are about to seed, ask: does the downstream node actually consume the
upstream output, or is the order just the order you typed in?

Procedure (five minutes, on paper or in `example-plan.json`):
1. Draw each step as a box.
2. Draw an arrow between each pair of consecutive steps.
3. For each arrow ask: does data from A actually flow into B?
4. No → delete the arrow (fake edge). Those two nodes should fan out, not queue.
5. Everything with no incoming arrow can start immediately (`task next`).
6. Everything with no outgoing arrow is a final output (`task done`).

**Example that has bit this repo:** the orchestration chain
`seed → claim → work → verify → retire` looks sequential, but "verify" only
consumes the task *result* — the separate `task checkpoint` step does not feed
verify, so checkpointing and verifying are parallel, not dependent. Related
fake edge: direct `task claim` on a gated task (WF-G55) bypasses readiness, so
a worker can hand-pick work the board meant to wait. Read a task as "what must
I wait for", not "what comes after what".

## 3. The Diamond — parallel fan-out, one convergence

The pattern that makes graphs worth it. One node fans out into N independent
leaves; all N feed a single join node that pulls outputs together.

```bash
# Seed the fan-out (leaves have NO deps => all ready immediately)
task new "Research competitor A" --campaign research
task new "Research competitor B" --campaign research
task new "Research competitor C" --campaign research
# Seed the convergence (waits on all three)
task new "Compare + synthesize A/B/C" \
  --dep <A-id> --dep <B-id> --dep <C-id> --campaign research
```

Workers loop `task next`; the three leaves run in parallel across available
workers, and the join waits only for the slowest leaf — not the sum. Two rules
from the source material: the leaves must be genuinely independent (fake-edge
test, section 2), and the join must genuinely need all of them (if it only
needs one, the other leaves are waste).

## 4. The Checker node — where the diamond quietly fails

Parallelism removes the natural checkpoints a linear chain had, so a bad leaf
(hallucination, empty output, off-topic result) can flow straight into the join
undetected. The fix is a gate between the fan-out and the convergence:

```bash
task new "Verify A/B/C results (5 checks)" --dep <A-id> --dep <B-id> --dep <C-id> --campaign research
task new "Compare + synthesize A/B/C" --dep <checker-id> --campaign research
```

The checker's only job is the five checks from the source article, folded into
its `--body`:
1. Empty or null output → reject.
2. Two outputs contradict in a way both can't be true → flag both.
3. Off-topic relative to the original task body → reject.
4. Confidence/evidence too thin to trust → flag for retry.
5. Output in a shape the join can't parse → reject.

Lifecycle for a failed checker: leave the verdict in its `--result`, set it
`blocked` (or `done` with the verdict), then either reopen the bad leaf
(`task state <leaf> open`) for a retry or seed a follow-up task with the leaf
as a dep before the join. The convergence depends on the CHECKER, not on the
leaves, so nothing downstream sees a poisoned input.

> A graph without a checker is a graph that assumes everything upstream
> worked. That assumption fails more often than you would expect.

## 5. Static vs dynamic graphs

- **Static** (the Agora default): seed the whole shape before workers start;
  the board is the schema. Predictable, auditable, debug-friendly.
- **Dynamic**: when mid-wave results reveal new scope, seed FOLLOW-UP work
  (`orchestrate seed` another packet set, or a worker files `task new` with the
  discovered `--dep`) and let the ready queue reshape itself.

Rules: static first, always. Switch to dynamic only when the static shape hits
a wall. Never run a dynamic graph where you must audit exactly what ran — the
structure that ran will not be the one you drew.

## 6. Reading the graph on the board (observability)

`GET /tasks` rows carry computed, read-only graph fields (never persisted):

- `ready: boolean` — the same predicate `claim-next` uses.
- `depStates: [{ id, state, title }]` — the upstream edges with live state, so
  a gated task names exactly what it is waiting on.
- `gates: number` — how many downstream tasks depend on this one (your
  blocking footprint; `0` means the node is a final output).

A commander can therefore answer "what unblocks when I finish task X?" from one
`tasks` call — and spot a squeezed diamond (one leaf gating a whole
convergence) before it becomes a truck.

## 7. Working rules for this repo

Codify these defaults (they already shape `tools/agora/` docs):

- Seed diamonds with `--dep`; tell workers to use `task next`, not `task claim`
  (direct claim bypasses readiness — WF-G55).
- Require a checker node for any convergence fed by >1 parallel leaf whose
  failure is expensive.
- File the moment you remove a fake edge from a live workflow as a
  `WORKFLOW_GAPS.md` row with provenance — that is how this playbook pays rent.

---

*Distilled from Mahax's graph-engineering article (2026-07-29). The full text
was kept as a disposable scratch copy during retrieval; only this
Aralia-applicable distillation is tracked in the repo.*


