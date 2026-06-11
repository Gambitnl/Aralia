# Documentation Cleanup Decisions

Status: complete — project closed as complete-enough 2026-06-10
Last updated: 2026-06-10

## D-01: Path-Drift Packets 1G.7–1G.10 Evidence Reconciliation

Date: 2026-06-07
Gap addressed: G2 (path-drift in historical migration packets)

### Evidence Collected

Each packet in `docs/tasks/documentation-cleanup/` claims its named target README
is "currently missing." This iteration verified each claim against the live repo.

| Packet | Named Target Path | Brief Claims Missing? | Actual Repo State (2026-06-07) | Verdict |
|---|---|---|---|---|
| 1G.7 | `src/context/README.md` | Yes | **Exists** (23 lines) | Drift claim is **wrong** — target was created after the brief |
| 1G.8 | `src/components/CharacterCreator/README.md` | Yes | **Missing** (no README in folder) | Drift claim is **correct** |
| 1G.9 | `src/components/LoadGameTransition.README.md` | Yes | **Moved** to `src/components/SaveLoad/LoadGameTransition.README.md` (143 lines) | Path shifted, not missing |
| 1G.10 | `src/features/SubmapGeneration/README.md` | Yes | **Exists** (74 lines) | Drift claim is **wrong** — target was created after the brief |

### Decisions

1. **1G.7 and 1G.10**: The briefs' "What Drifted" sections are now factually
   stale. The named target READMEs exist. These packets can be treated as
   **historical migration intent** (their own self-classification), but the
   drift note should be corrected so future agents do not assume the targets
   are still missing. No archive or deletion action needed.

2. **1G.8**: The CharacterCreator folder still has no README. The drift claim
   is accurate. This packet correctly remains a historical-intent record. If
   a CharacterCreator README is authored later, it should reference the
   archive improvement doc `docs/archive/improvements/08_improve_point_buy_ui.md`.

3. **1G.9**: The LoadGameTransition README was not deleted — it moved to
   `src/components/SaveLoad/LoadGameTransition.README.md`. The packet's
   path reference is stale, but the content survived at the new location.
   Future agents should look at the SaveLoad folder, not the old path.

### Preservation Rationale

Per Aralia's expansion-first policy, all four packets are preserved as
historical migration intent. The correction is to the evidence record, not
to the files themselves. No pruning performed.

## D-02: PROJECT_TRACKER.md Stale Link for Documentation Cleanup

Date: 2026-06-07
Gap discovered: PROJECT_TRACKER.md row and North Star map link to
`docs/tasks/documentation-cleanup/NORTH_STAR.md` (the ignored task folder)
instead of the durable living-project surface at
`docs/projects/documentation-cleanup/NORTH_STAR.md`.

Decision: Correct the link to point at the living-project surface. The
ignored task folder remains as evidence only, per NORTH_STAR.md scope.

## D-03: Historical Packet Drift Wording Correction (G1)

Date: 2026-06-08
Gap addressed: G1 (remaining historical packet wording curation)

### Evidence Collected

From a direct repo check of the `1G.*` packet targets:

| Packet | Named target in packet | Current repo state | Packet wording action |
|---|---|---|---|
| 1G.7 | `src/context/README.md` | Exists | Correct the drift note from "currently missing" to "now exists" and keep packet as historical. |
| 1G.8 | `src/components/CharacterCreator/README.md` | Missing | Preserve as historical migration intent (claim still accurate). |
| 1G.9 | `src/components/LoadGameTransition.README.md` | Moved to `src/components/SaveLoad/LoadGameTransition.README.md` | Correct packet wording to reference the current location and keep as historical migration intent. |
| 1G.10 | `src/features/SubmapGeneration/README.md` | Exists | Correct the drift note from "currently missing" to "now exists" and keep packet as historical. |

### Decision

For G1, I am recording a **correct-and-preserve** handling pattern:

1. **Correct stale wording** in historical records where a claim is now factually
   incorrect (`1G.7`, `1G.9`, `1G.10`).
2. **Preserve all four packets as history** where they sit in the ignored task
   folder and are not treated as live authority.
3. Prefer live authority to `docs/projects/documentation-cleanup/*` and the
   two registry ledgers.

No broad deletion or pruning is performed; only curation of wording for evidence
consistency was required.

## D-04: Duplicate-Cleanup Completion Scope — Close As Complete Enough (G3)

Date: 2026-06-10
Gap addressed: G3 (duplicate-cleanup scope partial with no completion check)
Decider: Remy (project owner), batched decision session 2026-06-10

### Question

Should Documentation Cleanup formally widen G3 into a new duplicate-cleanup
pass, close the duplicate-cleanup scope as complete enough, or preserve it
only as adjacent historical evidence? (Required Review Brief in
`NORTH_STAR.md`.)

### Decision

**Option B — close G3 as complete enough for this living-project cycle.**
The duplicate-cleanup scope is not widened. Prior duplicate findings in
`docs/tasks/documentation-cleanup/` remain preserved as historical evidence
(expansion-first; nothing deleted). The project closes with its current
evidence preserved.

### Rationale

- G1/G2/G4/G5 were already resolved with source-backed evidence; the only
  remaining row was a policy question, not a concrete cleanup task.
- Widening scope now would force an agent to invent targets without an owner
  mandate; an explicit close establishes the missing stop rule.
- A future duplicate-cleanup campaign can be scoped as a new decision if the
  need returns.

### Record

- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D23).
- Follow-up applied: G3 marked resolved in `GAPS.md` and `TRACKER.md`; T3
  closed; `NORTH_STAR.md` status set to complete with the review brief
  resolution appended.
