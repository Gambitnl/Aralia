# Resolution notes

## Accepted and fixed

L1–L5 (leaked means), O1–O3, D1–D4, M1, M2, M4, F1–F3.

The load-bearing changes: Hard constraint 1 is now purely an end state (the file is out of the
dependency graph; editing it does not restart), with the "loaded lazily at request time" clause
deleted; the async-handler obligation is conditional on the approach rather than unconditional;
the resolution clause is folded into behavioral preservation and no longer presupposes a
deferred specifier; minimality bounds blast radius without naming the edit surface; the
technique's vocabulary ("defer," "lazily," "module caching") is gone. The performance line is
now an explicit non-constraint note. §1 and §6 were re-derived from the failure mode — the
three-item state triple and the three-in-order trigger list are replaced. Silence as a valid
verification result, the full-process-restart signature, and an obligation to ground the
explanation in the tool's own documentation were added.

## Rejected

**F4 — "residual platform tells" (`request/route handling`, `the server's handler contract`).**
Rejected as a fingerprint. These name the shape of the problem, not the source: the whole class
of failure is "a module the configuration references is only needed once the server is handling
requests," and the eligibility test in Hard constraint 2 is unstatable without it. Neither
phrase implies a particular runtime or middleware style. The one item in F4 that did carry a
source-specific assumption — "the runtime's module caching" — is gone, but under M1, not F4.
"Handler contract" was softened to "handler interface" only to avoid contract-on-contract
wording, not because the concept was a tell.

**D5 — diagnosis-gating "is an inference, not a source requirement."** Rejected in part.
Accepted: the top-of-list ranking overstated the owner's emphasis, so it now sits fourth,
behind behavioral preservation, the explanation, and verification. Rejected: the requirement
itself. The original's Notes limit the technique to files "only actually called inside
middleware handlers," and §6's silence list is meaningless if nothing obliges the skill to
check whether it is in scope before acting. A skill that applies the change on a wrong premise
edits working code for no benefit, which the source's own trigger conditions exclude. Kept as
both a quality and a hard constraint.

**F3 — the one-restart caveat.** Kept, as the auditor allows. Its repetition was reduced from
three sections to two (Success and Must-never); dropping it entirely would make a correct fix
look like a failed one.

**M3** required no action — the auditor did not count it against the draft, and the transitivity
hard constraint is retained unchanged in substance.
