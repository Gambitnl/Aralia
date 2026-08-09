# Resolution Notes

All audit findings were checked against `original/`. Substantiated findings are fixed in
`final-contract.md`. Rejections and partial acceptances are recorded below.

## Rejected

**§4.6 — "three-value status vocabulary is a leaked means."** Rejected. The glyphs (`[ ]`/`[~]`/
`[x]`) are the means, and the draft had already abstracted them. That three states are *observably
distinct* is an owner requirement, not an implementation choice: the roll-up counts pending, in
progress and completed separately (status.md:22-26, 33-35), undo prioritizes in-progress items over
completed ones (revert.md:24-25), and execution transitions an item through in-progress before
complete (implement.md:58,72). A contract that permitted a two-state model could not express any of
those. The requirement is kept; no format is mandated.

**§2.5 — "uniqueness asserted more broadly than the original checks."** Rejected as stated; the
direction is backwards. The original checks that no two units share a *short name*
(newtrack.md:79), which is stricter than full-identifier uniqueness, not looser — the date-suffixed
identifier collides only within one day, so name-level checking forbids more. The underlying
mismatch (the check is on the human-chosen component) is nonetheless real, and is resolved by the
fix for §4.1: identifiers are no longer date-encoded, and units are required to be uniquely
addressable by a stable human-meaningful name.

**§3.4 — "read-only status should be marked derived."** Accepted; the accompanying claim that it
occupies "two of the draft's binding slots" was the reason to demote it, so it now appears once, in
a separate Derived section, rather than in both Hard constraints and Must never.

## Accepted with modification

**§4.7 — status report field list.** The field-by-field transcription is real and the wording was
neutralized, but the substance is not merely presentational: a roll-up that omits what is active,
what is next, or what is blocked is materially weaker than what the original guarantees
(status.md:38-41,49). The requirement is retained, the template's field order is not.

**§3.3 — dropped defaults.** Accepted: the contract now requires that convention choices be put to
the user with the owner's recommended default named. The specific numeral (80%) is deliberately not
carried over — pinning a threshold value would both over-constrain a reimplementation and act as a
fingerprint. What survives is that a default exists and is recommended.

**§1.6 / §4.4 together.** These pull in opposite directions: §1.6 wants tolerance for rewritten
version-control history, §4.4 wants undo decoupled from version control. Resolved by keeping the
capability and dropping the mechanism — undo must still locate the recorded work when the underlying
history has been rewritten or its identifiers no longer match, without specifying how.

**§3.5 — the activation-boundary paragraph.** Confirmed that no sentence in the five source files
corresponds to it. Rather than dropping it outright, the sourced part (by-name invocation of a
command family) stays in the boundary section and the inferred scope-fencing moves to the Derived
section in compressed form.

**§1.11 — navigational index documents.** The per-unit and project-level `index.md` files are
required artifacts in the original, but they are a means to discoverability of artifacts the
contract already requires; folded into "a single predictable location … readable directly by a
person" rather than mandated as separate documents.

## Accepted as stated

§1.1, §1.2, §1.3, §1.4, §1.5, §1.7, §1.8, §1.9, §1.10, the remaining items of §1.11 (spec must state
how completion is verified; an intermediate grouping level in plans; scans respect exclusion rules;
blockers are written to the record; test-first sequencing binds planning as well as execution),
§2.1, §2.2, §2.3, §2.4, §2.6, §3.1, §3.2, and §4.1–§4.5.

§2.1 was fixed first, as the audit recommended: the approval requirement now covers every artifact
the assistant authors on the user's behalf, and a matching Must-never forbids writing a drafted
specification or plan unseen. §2.4's manufactured ambiguity note is removed and replaced with the
positive statement the source actually supports (implement.md:52-86). The §5 fingerprint table was
worked through alongside §4; the double-confirm arithmetic, the auto-generate menu item, the
date-encoded identifier, the per-unit folder triple, and the manual-conflict script are all
generalized to their requirement.
