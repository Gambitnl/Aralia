# Outcome Contract — roadmap/plan-map entry authoring (Aralia)

## 1. Purpose

The project maintains a generated map of what the product can do and what is planned, assembled
from curated source records rather than typed directly into the map's data files or its viewer.
Because assembly passes through several filters that drop or relocate entries without raising an
error, work that was actually built routinely fails to show up, shows up under the wrong grouping,
or collides with an existing entry. This skill exists so that after a unit of work is finished, the
map ends up genuinely and verifiably reflecting that work — correctly named, correctly grouped,
visible in the served data and in the viewer — instead of appearing to have been updated.

## 2. Success

Observable from outside, without inspecting how the result was produced:

- The capability that was built is described in a durable source record, in the location that
  category of work belongs to, and is registered wherever registration is required for it to be
  ingested.
- The new or changed entry is present in the data the map's backing service actually serves — not
  merely present in the inputs.
- The entry sits under the intended top-level grouping of the map, not a fallback or catch-all one.
- The entry is reachable in the live viewer, checked against a rebuilt/refreshed service rather
  than a stale one.
- Entry identifiers remain unique; nothing collides, and generation completes without error.
- Nothing that previously appeared on the map has silently vanished as a side effect.
- Files touched by the underlying work are accounted for: each is characterised as focused,
  deliberately coordinating, or overdue for splitting, and anything overdue — including units
  lacking a verification route — is recorded as follow-up work on the map rather than left implicit.
- The report of what was done matches what the checks actually showed, including anything that
  failed or was skipped.

## 3. Qualities ranked

1. **Truthfulness of the map.** The map is used to decide what to build next; an entry that is
   absent, misplaced, or overstated is worse than no entry. This outranks everything below.
2. **Verified rather than assumed.** Silent failure is the defining hazard here, so success must
   be demonstrated against real output at each level of the assembly, not inferred from having
   made the edits. Later levels are only trusted after earlier ones are confirmed.
3. **Provenance and single-source discipline.** Entries must derive from the recorded source
   material through the normal assembly path, so the map stays regenerable and self-explaining.
4. **Naming that survives assembly.** Labels are load-bearing: they become identifiers and drive
   grouping. Names must describe a capability, be specific enough to be unambiguous, and stay
   distinct from every other name even after the system's normalisation rewrites them.
5. **Completeness of the sweep.** All parts of the finished work are represented, including
   deficiencies found along the way; partial coverage that looks complete is a failure mode.
6. **Minimal footprint.** Prefer extending existing records and groupings over creating parallel
   ones; avoid churn in shared configuration beyond what the entry requires.

## 4. Hard constraints

- **Method is part of the requirement here:** map entries must be produced through the established
  source-record → registration → generation path. Hand-editing the generated map data, the viewer,
  or its stored output to make an entry appear is not an acceptable substitute, even when it
  produces the same visible result.
- Source records describe what a capability does, not a narrative of the work performed, and are
  filed according to the category of system they describe; tooling-about-the-map is filed
  separately from product capability.
- Where an entry's label must be declared in more than one place for it to be admitted, those
  declarations must agree exactly; a label admitted in one place and not the other is dropped.
- Grouping is inferred from a declared classification field; that field must carry a strong enough
  signal to land the entry in the intended group.
- Labels must remain mutually distinct *after* normalisation, not merely as typed. Distinctness
  achieved only through punctuation, casing, or trivial wording variants does not count.
- Labels must not rely on transformations the system does not perform (e.g. preserving unusual
  capitalisation) and must not duplicate the prefix the system supplies automatically.
- Structural section words and enumerated/phase-numbered headings are not valid entry names.
- Identifiers are length-bounded and derived from labels; labels must remain unique within that
  bound.
- Field values must come from the defined vocabularies and field shapes of the map's data format;
  values that are counted from a source document must be recounted when that document changes,
  never estimated, and any value that is an approximation must be marked as such.
- Uniqueness/cardinality rules the data format states (e.g. singleton markers, unique ids) must
  hold after the change.
- Distinct kinds of ordering the format keeps separate (e.g. product prerequisite vs. execution
  scheduling) must not be merged or derived from one another.
- Verification must reach the served data and the running viewer, with the service refreshed first
  so a stale build cannot produce a false result in either direction.
- The stated completion criteria are conjunctive: none may be waived to declare the work done.
- The read-only context provided for reference must not be modified.

## 5. Must never

- Report the map as updated when the entry is absent from, or misplaced in, the served data.
- Fabricate or paper over verification: claiming a check passed that was not run, or that failed.
- Insert entries directly into generated data, stored output, or the viewer to bypass assembly.
- Introduce a colliding identifier, or break generation for existing entries.
- Remove, overwrite, or orphan existing entries or source records as collateral to adding a new one.
- Invent capability that was not built, or overstate maturity/status of what was.
- Invent precise values (dates, counts, statuses) that the format expects to be observed or counted.
- Create a duplicate source record or a parallel grouping when an existing one covers the subject.
- Leave discovered deficiencies (unsplit responsibilities, missing verification routes) unrecorded.
- Silently narrow the sweep — e.g. cover some touched work and present it as covering all of it.

## 6. Activation boundary

**Should trigger when** the user is adding, revising, or auditing entries in this project's
capability/plan map — typically when closing out a unit of work and reflecting it on the map, when
an expected entry is missing or has landed in the wrong place, when entries need renaming or
splitting, or when the map is being checked for drift against what exists in the codebase.

**Must stay silent for** ordinary implementation, debugging, testing, or review work that does not
change the map; questions merely *about* the map's contents, plans, or priorities; unrelated
documentation; and work on the map tooling's own internals where no entry is being authored. It
should not volunteer map maintenance as an addendum to a task that did not ask for it, beyond
noting that the map has not yet been updated.

**Ambiguity noted:** the evidence shows the map being fed by two paths — the documented
source-record path this skill describes, and a separately curated topic/feature dataset whose
entries are also promoted into the map. The faithful reading is that this contract governs the map
entries themselves, whichever path supplies them; the constraints above are stated to hold for both
rather than assuming only one path is in scope.
