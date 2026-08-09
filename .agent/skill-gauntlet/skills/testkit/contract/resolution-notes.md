# Resolution notes

All audit findings were checked against the original files. Everything in §1 (omissions), §3
(mislabelled), and §5 (fingerprints) was substantiated and is fixed in `final-contract.md`, as are
§2.1–2.3 and §4.2–4.7. The exceptions are below.

## Rejected

**§4.1 — "the two-part preflight structure is a leaked mean."** Rejected. Liveness and currency are
two distinct owner-level acceptance conditions, not one requirement decomposed into steps: the
original's own pass/fail bar names the currency gate as a failure condition in its own right
(`smoke.md:30`), separate from the surface never coming up. A contract that merges them into "no
artifact from a stale or dead server" would lose the ability to say which condition a run violated.
The draft never carried the implementation's probe command, error-code names, or hashing method —
those are the means, and they are absent. The wording was tightened anyway to drop the procedural
"either check failing" cadence and to add the audit's substantiated point (§1.11) that the probed
file must be *relevant*.

## Accepted in part

**§2.4 — invented activation exclusions.** Accepted for the items with no basis in the original:
code review, refactoring, design discussion, and build/packaging/deployment are gone. Retained, as
the audit itself concedes they are defensible inferences, are the browser-runtime-only and
local-development-instance-only exclusions, plus non-browser test execution — the original targets
the dev launch configuration and defines its evidence as browser-driven.

**§2.5 — the ranking is an authored artifact.** Accepted in part. "Efficiency" is removed as a
standing quality (per §3.7): the original's wait budgets and short-interaction advice are local
operational notes, and the one genuine validity rule buried among them, "one surface per trace",
has been moved into the hard constraints where it belongs. The ranking itself is kept: an outcome
contract has to say which quality yields when two conflict, and the original expresses precedence
through its structure — hard stops before any artifact, consent gates on other people's processes,
and a screenshot requirement that overrides clean numbers. The unsupported editorial rationale
("a wrong-but-confident result is worse than no result") has been dropped.

**§4.4 — "persistent result format" / "stored reference values."** A weak finding: those phrases
name comparability, which is the outcome, not the file layout or baseline tool that implements it.
Reworded regardless to "a stable, persistent form", since the fix costs nothing.

**§3.8 — contamination reporting.** The over-hardening is marginal — "treat that as churn evidence"
does keep the observation as evidence. Accepted mainly because the draft's phrasing was also a
fingerprint (§5.7); it is now stated as reclassification rather than a new reporting obligation.
