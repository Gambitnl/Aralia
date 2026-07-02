# Doc-Sprawl Triage Orchestrator Playbook

**Audience:** an orchestrator agent running the documentation-sprawl triage campaign
(spec: [`docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md`](../../docs/superpowers/specs/2026-07-01-doc-sprawl-triage-design.md)).
Sibling to [`ORCHESTRATOR.md`](./ORCHESTRATOR.md) — read that first for the general
Agora campaign mechanics; this file is the doc-triage specialization. Like its
sibling, this file is **self-improving**: append lessons after every batch.

**Status:** v1, written during the pilot batch (2026-07-01, ledger-queue lane).

---

## 0. What the campaign is

2,368+ markdown files; the failure mode is **a plan that was executed but the file
never updated to say so**. The campaign continues the stalled
`docs/registry/@DOC-REVIEW-LEDGER.md` process at agent scale: every in-scope file is
read whole, its claims proved against code, leftover work routed into the owning
project's `GAPS.md`, and a disposition proposed from the ledger's fixed menu
(`keep in place | rewrite in place | split | move to archive | move | retire`).

## 1. Orchestrator prerequisites (hard, per spec)

1. **Intake `docs/projects/PROJECT_TRACKER.md` in full** before dispatching anyone —
   it is the routing table that says which project owns any leftover work found.
2. **Register on Agora** (`npm run agora`, port 4319) with your own identity dir:
   `AGORA_DIR=.agent/agora/ids/doc-triage-orchestrator`. Announce the batch.
3. **Compute the queue.** The ledger has NO unprocessed rows — its queue is the set
   of in-scope files that never entered it. Diff script pattern: extract every
   `docs/...md` path from ledger table rows (handle backticks and `*` globs), walk
   `docs/`, subtract. Pilot-batch snapshot 2026-07-01: 1,915 docs files, 460
   ledger-covered, **1,587 uncovered** (806 `docs/projects`, 455 `docs/spells`,
   248 `docs/tasks`, 31 `docs/superpowers`, rest small).

## 2. Batch shape

- **Group by subtree, not by count** — one agent owns a whole project's doc set
  (NORTH_STAR + TRACKER + GAPS + loose files) so it judges the triad coherently.
- 5–13 files per agent is comfortable; 8–10 agents per wave.
- Review agents are **READ-ONLY** — they never edit, so they need no Agora locks
  and cannot clobber concurrent sessions. Only the orchestrator writes, under lock.
- Exclude reference/data lanes from plan-triage batches up front when obvious
  (e.g. `docs/tasks/spells/` per-spell prompts), but keep per-file classification
  in the agent pipeline so misfiled plans still get caught.

## 3. The review-agent prompt contract

Every agent prompt must contain:
- **READ-ONLY declaration** + no-heavy-commands rule (no tsc/vitest/build/dev-server).
- The exact file list, with "read each IN FULL" (ledger Mandatory Processing Gate).
- The 5-step pipeline: classify → decompose into checkable claims → prove against
  code (tag evidence `T/B/V/M/D` per `docs/projects/PROJECT_VERIFICATION_SCHEMA.md`,
  prefer B-level "does the named symbol/file exist NOW") → extract leftover work,
  split three ways: *genuinely open* / *falsely open (doc says open, code says done)* /
  *claimed done but unprovable* → propose a disposition from the fixed menu with a
  one-line evidence chain.
- **Routing context**: what PROJECT_TRACKER.md says about the owning project's
  status and canonical owner (merged-reference rows redirect routing!).
- **Concurrent-work warning** when the working tree has uncommitted edits in the
  agent's verification area ("judge against what is on disk now").
- A fixed machine-readable output format (per-file `## path` blocks with class /
  verdict / evidence / leftover / falsely-open / disposition / routing).

## 4. After the wave

1. Aggregate agent reports into a batch triage report under
   `.agent/scratch/doc-triage/` (gitignored scratch).
2. **Present the batch of proposed dispositions to Remy BEFORE applying anything**
   (rewrite/archive/retire/move). Per-batch approval, not per-file; plain language;
   use `AskUserQuestion` for the decision.
3. After approval: lock each target file via Agora before writing (GAPS.md routing
   writes and the source-file dispositions), apply, record rows in
   `@DOC-REVIEW-LEDGER.md` (only the orchestrator marks `processed`), release locks.
4. Append lessons to §5 of this file.

## 5. Lessons learned

- **2026-07-01 (pilot setup):** "Continue the stalled ledger queue" required a
  discovery step — every existing ledger row was already `processed`; the queue is
  the *uncovered* file set, not unprocessed rows. Don't assume a visible backlog.
- **2026-07-01:** The ledger uses inconsistent path styles (backticked and bare,
  plus `1A-1F*.md` glob rows) — the coverage diff must normalize both and expand
  globs, or the uncovered count is inflated.
- **2026-07-01 (batch 1, 9 agents / 65 files):** grouping by subtree worked — every
  agent returned the exact output format, zero clobber risk (read-only), ~2-4 min
  each in parallel. Living-protocol triads (NORTH_STAR/TRACKER/GAPS) are NOT
  automatically fresh: 12/20 subtrees contained at least one falsely-open item.
- **2026-07-01:** Review agents surfaced *registry-side* staleness too —
  `PROJECT_TRACKER.md` next-step cells were wrong for 5 projects. Ask agents to
  check the tracker row against code, not just the folder docs.
- **2026-07-01:** Giant append-only evidence logs (SSO GAPS.md 878KB, TRACKER
  1,202 lines) need a split/extract step BEFORE archive: open rows must be
  re-homed first, and inbound row-ID references (SSO-*) must be carried.
- **2026-07-01:** Tell agents explicitly which uncommitted concurrent edits exist
  and to judge "what is on disk now" — two packets hit actively-moving surfaces
  (summons lane, combat types) and handled it cleanly because the prompt warned them.
- **2026-07-01 (application wave, 6 write agents):** disjoint lock sets + one
  orchestrator-owned hot-file set (PROJECT_TRACKER + review ledger) worked with
  zero lock conflicts. One transient `.git/index.lock` collision between two
  agents doing concurrent `git mv` — retry resolved it; stagger heavy-move packets
  if it recurs. `docs/archive/` is gitignored: NEW files created there need
  `git add -f` (renames stay tracked automatically). Some `docs/tasks/roadmap/*`
  files are gitignored roadmap-tooling docs — edits won't show in `git status`;
  verify on disk. Estimated row registries from a truncated read can be off
  (SSO registry was ~60 rows at lines 6411-6504, not 20 at 6470-6489) — tell the
  write agent to re-derive the range itself, which the prompt's "verify before
  each step" rule caught.
- **2026-07-01:** Batch-approval flow that worked: read-only wave → batch report
  in scratch → plain-language summary + AskUserQuestion (apply all / partial /
  review) → write wave → ledger rows written LAST by the orchestrator so they
  record what was actually applied, not what was proposed.
