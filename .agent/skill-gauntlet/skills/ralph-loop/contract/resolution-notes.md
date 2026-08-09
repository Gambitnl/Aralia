# Resolution Notes

Findings accepted are not listed individually; they are fixed in `final-contract.md`.
Below are the findings rejected or accepted only in part, with reasons.

## Rejected

**1.3 — Sub-agent delegation dropped from the environment clause.** Rejected. The
original grants a tool set in frontmatter; a permission grant is not an outcome
requirement, and the auditor concedes this. Naming delegation in the contract would
import a specific execution mechanism into a document that is meant to be neutral about
mechanism. The environment clause states the capability that the verification
requirement actually depends on — inspecting and exercising a real project — which is
the outcome-level fact. How the run organizes itself internally is unconstrained, and
therefore already permits delegation.

**3.1 — Incremental progress demoted from Core Rule to ranked quality #5.** Rejected as
a defect. Step granularity is a means to verified progress, not an outcome, so the
preference tier is the right home for it. The part of that rule that *is* an obligation
— explicit progress tracking — was already carried into the hard constraints by the
draft and remains there. The auditor states the counter-argument itself; the ranking is
a disclosed editorial judgment, not a fidelity error.

**2.4 (in part) — "must not be adopted as a background posture for unrelated work."**
The claim that this contradicts "You are now operating in Ralph Loop Mode" is rejected:
the original establishes that posture *for the invoked task*, and the draft's clause
concerned unrelated work. The clause is dropped anyway for a different reason — see
below — and replaced by a positive statement that the mode holds for the duration of
the task.

## Accepted in part

**2.4 — Activation boundary invented.** Accepted that the original contains no
activation guidance and that the draft presented inference in the same register as
sourced requirement. §6 now separates the sourced trigger from the inferred silence
condition and labels each. The substance of the boundary is kept — a contract without
one is unusable — but trimmed and no longer attributed to the owner.

**2.5 — "Ambiguity noted" fills the gap it flags.** Accepted. The heading now says the
ambiguity is noted and not resolved, and the text states only what the original
establishes (a task description is the expected input), dropping the inferred directive.

**3.2 / 3.3 — Mislabeled mandatory framing and autonomy ranking.** Accepted as
adjustments rather than defects. Self-correction is now also a hard constraint, and its
ranked entry says explicitly that it is an obligation ranked below honesty rather than a
preference. The autonomy entry no longer rests on absolutist framing: §1 drops "without
further human involvement," and §3.7 is reconciled with the restored human-input
blocking ground.

**4.4 — "builds and runs without errors" assumes a compile/run project shape.** Accepted
as a small softening ("where it is the kind of project that builds and runs"), though
the auditor is right that the original carries the same assumption; this is a clarity
edit, not a fidelity fix.

**5.3 — Two-state architecture with an asymmetric reason field.** No action, as the
auditor recommends: it is the owner's actual requirement and cannot be removed without
losing it.
