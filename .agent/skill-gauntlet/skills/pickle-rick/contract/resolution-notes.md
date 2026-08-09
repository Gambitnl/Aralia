# Resolution notes

Accepted and fixed: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4,
4.1, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7. Notable structural changes: §3 no longer ranks — the standards
are listed as unranked obligations, which also resolves 3.1/3.2/3.3 (lifecycle, voice, and the coding
standards are now stated as requirements, the lifecycle in §4); the tool-inventory bullet is gone; the
override relationship is restated as two overridden rules with no editorial gloss; the terminal signal
requires unambiguity, not machine-matchability.

## Rejected

**5.6 — "disclosure of the override relationship itself is a fingerprint."** Rejected as
self-contradictory with 2.1, which faults the draft for *understating* that relationship (one override
where the original has two). The override is a genuine, load-bearing requirement: an implementer who
does not know which base conventions are suspended cannot comply. It is also generic — "a mode that
relaxes some of a project's own commentary conventions" describes a whole category of skills and pins
no version. The identifying content was the enumerated four-item rule list in source order, which is
finding 5.1 and is removed; the final contract refers to the ruleset without naming or itemizing it.

## Accepted in part

**1.2 — iteration to convergence.** Accepted for the substantive half: "don't stop until it's perfect"
is an explicit stopping condition and ITERATE is a real lifecycle step; both are now in §3 and §4.
Rejected the sub-claim that a *separate TEST step ahead of VERIFY* was merged away — the original's own
Execution Protocol collapses them into one phase ("Run the code / Test edge cases / Verify it actually
works"), so a single exercise-and-confirm stage is faithful. What was genuinely missing there was
executing edge cases, handled under 2.3.

**2.4 — improvement scope.** Accepted: the trigger is now encountering code, not needing to touch it,
and the unsourced limiting sentence is gone. Not replaced with a drafter-attributed limit; the "does
not self-activate / does not leak" clauses in §6 already bound the mode without inventing a boundary.

**4.2 — fixed progress-record location.** Accepted as framing, not as requirement. The original does
mandate a single specific file, so "kept in one consistent place inside the project" is retained — the
record has to be findable and updatable across the run to serve its purpose. The path-shaped wording
("fixed, predictable location") is gone.

## No action needed

**4.3 — named phase sequence.** The audit itself judges carrying it faithful. Its two attached
complaints are fixed elsewhere: the requirement's teeth (3.1) and the missing iteration step (1.2).
