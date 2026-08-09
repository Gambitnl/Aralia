# Resolution notes

Accepted and fixed: O1, O2, O3 (as a duty to re-read shared state, not as a claim about
subscriptions), O4, O5, D1–D8, M1–M5, L1–L4, F1–F7.

Rejected or only partly adopted:

**O6 — "any authenticated call refreshes presence" is omitted.** Rejected. That is service-internal
mechanics, not an outcome the agent is judged on; carrying it would be a leak, not a fix. The
audit's secondary point — that the draft asserted the opposite — is moot: the clause it referred to
("keeping presence alive does not extend file ownership") was unsupported and has been deleted
under D3, so no contradiction remains.

**O7 — the named destructive commands are generalized away.** Partly adopted. The audit itself
files this as "not a fault," and naming specific commands would pin the toolchain. Its one real
complaint is fair, so the category is now "resetting, switching, or setting aside tree state"
rather than "repository-wide operations," which no longer excludes setting work aside by
implication.

**L5 — task-board verbs mirror the API surface.** Rejected. Post / claim / close-with-result is the
minimum vocabulary for describing a shared work queue as an outcome at all. It names no endpoint,
verb, or payload, and constrains no implementation beyond "there is a shared list of work with
states." Removing it would delete the requirement, not neutralize it.

**L6 — "ownership expires on a timer" is a leaked mechanism.** Rejected as a leak; the audit
concedes the contract is obliged to carry it. Expiry is load-bearing — it is why an abandoned claim
is recoverable (O4) and why prompt release matters (D3). The attached owner instruction the audit
correctly said was missing is now present: expiry is a backstop, release early.

**F8 — the expansion ratio is itself a fingerprint.** Rejected as a discrete finding. Length is not
a tell that identifies a source skill, and the mass the audit objected to was unsupported material
already removed under D8. No separate edit was made for it; the contract is now ~103 lines.

One thing the audit did not raise: the draft's "carrying whatever provenance the service requires
of its class of participant" (§2) is unsupported by the same evidence as D2 — there are no
participant classes and no provenance requirement — so it was removed alongside it.
