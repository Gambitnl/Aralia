# Resolution notes

All findings were checked against `original/SKILL.md` (the audit's header cites a nested path; the
file is `original/SKILL.md`, same 179 lines).

## Accepted and fixed

1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.4, 4.3, 4.4, 5.2, 5.3, 5.4 —
applied as described. The fabricated constraint cluster (counted values, approximation markers,
singleton cardinality, dual ordering) and the read-only-context clause are struck; the description
requirement, the drift sweep, the companion-registry mirroring, the in-label nesting mechanism, the
weak-name threshold, and the diagnose-the-dropping-stage duty are added; the prefix mechanism is
restated as *stripped*, not supplied; the fabricated two-path ambiguity note is removed.

## Rejected

- **4.2 — "e.g. preserving unusual capitalisation" as a leaked mechanism.** Rejected. The original
  states this as a directly actionable authoring rule ("don't rely on all-caps"), independent of
  the acronym list. Dropping it would lose a real owner requirement, not an implementation detail.
  The clause is kept, reworded so it is actionable without knowing any list.
- **5.1 — tripartite file classification as a fingerprint.** No change. The auditor concedes it is
  the requirement itself and unavoidable; it is already paraphrased away from the source's terms.
- **5.6 — section headings and the "Ambiguity noted" convention.** No change. The auditor scores
  these as contract-template artifacts, not skill fingerprints. (The ambiguity note is gone anyway
  under 2.4.)
- **4.1 — method-as-requirement.** No change; the auditor explicitly does not score it as a fault.

## Partially accepted

- **3.3 — ranking imposed where the original states none.** The unsupported precedence assertion
  ("This outranks everything below") is removed and the invented sixth quality dropped, so the
  remaining five are ordered by the contract's own judgement rather than presented as the owner's.
  A ranked qualities section is a required part of the contract format, so ranking per se is kept;
  the verification-ordering claim is retained because the original states it explicitly.
- **1.1 — canonical-doc link.** The lay-reader description is unambiguously required by the
  original's non-optional step; the canonical-doc pointer appears as part of the record's shape
  rather than as a separately mandated step. It is included on that basis, phrased as a pointer
  back to the source record rather than as a second standalone obligation.
- **5.5 — "tooling-about-the-map vs. product capability" framing.** The requirement is genuine and
  cannot be dropped, so it is reworded to state the filing rule without the mirrored phrasing.
