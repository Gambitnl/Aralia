# Resolution notes

Accepted and fixed: 1.1, 2.1, 2.2, 2.3, 3.2 (partial), 4.1, 4.2, 4.3, 4.4, 4.5,
4.6, 5.1, 5.2, 5.3, 5.4. Rejections and partial rejections below.

## 1.2 — "state the owner's declared precondition (a named wait helper)" — REJECTED in form

The finding is right that §4's applicability bullet should not be draft-invented,
but its proposed fix contradicts the same auditor's 4.2, which correctly identifies
that bullet as a restated mechanism and gives the owner-level formulation ("the
environment can tell you when the delegated work ended, scoped to new output").
Naming a specific helper would reintroduce both a leaked mean and a fingerprint.
Resolved by adopting 4.2's abstraction rather than 1.2's restoration. Note also
that the original's own solution does not use that helper — it argues against it —
so the front-matter precondition is not a requirement the contract can carry
literally without also carrying the contradiction.

## 1.3 — companion-skill cross-reference — REJECTED

The auditor rates this minor and excludes it from the verdict. The underlying
constraint (address the correct surface) is already hard in §4 and §5. Naming a
sibling artifact adds no contract obligation and is a fingerprint.

## 2.4 — "returns its output synchronously" is inferred negative space — REJECTED

An activation boundary's job is to state where the skill does not apply, which is
necessarily partly negative space. The clause is consistent with the original's
premise (the problem exists because there is *no* automatic completion signal) and
imposes nothing the original excludes. Kept as written.

## 3.1 — independent verification double-promotion — ACCEPTED IN PART

Agreed that appearing as both a Success criterion and a Must-never over-weights one
clause. Kept once, as a Success criterion — the original states it as a step the
agent performs, not an optional aside — and removed from §5. §6's scope sentence
was reworded so it no longer denies governing the confirmation step it requires.

## 3.2 — cost ranking — ACCEPTED IN PART

Cost moved from 4th to 3rd, above bounded termination, matching the original's
framing of cost as one of its two headline failure modes. Not moved above
correctness or reliable establishment: the original's longest argument is about
false completions from stale output, and its only bolded instruction is about
establishing the wait in the same action as the dispatch.

## 5.5 — "single bounded, blocking wait" as a phrasal tell — REJECTED

This is the outcome itself, not a mechanism or a stylistic carry-over: any faithful
contract must say that one call blocks and returns on completion. The auditor's own
5.6 confirms no identifying vocabulary appears. Phrasing varied slightly; substance
kept.
