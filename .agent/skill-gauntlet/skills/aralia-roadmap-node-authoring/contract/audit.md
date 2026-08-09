# Audit — `draft-contract.md` vs. `original/aralia-roadmap-node-authoring/SKILL.md`

Auditor note: the original consists of a single file, `original/SKILL.md` (179 lines). All
"present in the original" claims below are anchored to quoted lines from that file; all
"absent from the original" claims were checked against the whole file.

---

## 1. OMITTED

### 1.1 The plain-language description attached to each entry — dropped entirely

Original, Gate 3:

> `CURATED_SUBFEATURE_DETAILS` | keyed by subfeature label → `{ layman, canonicalDocs }`

> To add a new subfeature:
> 1. Add the label string to `CURATED_SUBFEATURES['your feature name']`
> **2. Add a `CURATED_SUBFEATURE_DETAILS` entry with a `layman` description**
> 3. Optionally add to `CURATED_REQUIRED_SUBFEATURES` if it should always appear

Step 2 is not optional (step 3 is explicitly marked optional; step 2 is not). The owner
requires that every new entry carry a lay-reader explanation and a pointer back to its
canonical documentation. The draft has no requirement anywhere that an entry be
*explained* or *linked to its source*. The nearest thing, §3 quality 3 ("the map stays
regenerable and self-explaining"), is about provenance of assembly, not about authoring a
description, and it is ranked as a quality rather than stated as a required field.

This is the single largest omission: an entry can satisfy every clause of the draft and
still ship with no description at all.

### 1.2 The audit run — the doc↔program drift check

Original, Verification Sequence step 2:

> ```bash
> # 2. Run the full audit
> npm run roadmap:audit-all
> # Reports: both | programOnly | docsOnly | neither | moduleLeavesMissingTestDefinitions
> ```

The draft's verification requirement is only:

> Verification must reach the served data and the running viewer, with the service refreshed
> first…

Served-data and viewer checks are original steps 1/3 and 4. Step 2 — the sweep that
reports entries documented but not built (`docsOnly`), built but not documented
(`programOnly`), and neither (`neither`) — has no counterpart in the draft. The draft
picks up only the `moduleLeavesMissingTestDefinitions` half of that report (§2 bullet 7,
"units lacking a verification route"), and even that is worded as a classification duty
rather than as the output of a required check. A reader of the draft would never run the
drift audit.

### 1.3 Mirroring into the secondary registries

Original, Gate 2:

> Also mirror into:
> - `.agent/roadmap-local/doc_library.json` (add a doc entry)
> - `.agent/roadmap-local/path_provenance.json` (add a path entry)

The draft's coverage is §2 bullet 1, "…is registered wherever registration is required for
it to be ingested." That phrase is load-bearing in the wrong direction: the doc-library and
path-provenance entries are *not* required for ingestion (the loader ingests from the
processing manifest), so a faithful reader applying the draft's own qualifier would
correctly skip them. The owner requires them anyway. The requirement — a new record must be
mirrored into the companion registries that track documents and paths, whether or not
ingestion depends on it — is not stated.

### 1.4 Hierarchy expressible within a single label

Original, label rule 5:

> **Use `>` to express hierarchy** within a single label. The pipeline treats `>` as a depth
> separator.
> - ✅ `"Spell Graph Navigation > Axis Filter Engine"`

The draft says nothing about depth or nesting within an entry name. This matters beyond
syntax: it is the owner's answer to "how do I add something that belongs *under* an existing
entry" — and the draft's §3 quality 6 ("Prefer extending existing records and groupings over
creating parallel ones") points at the same goal while withholding the mechanism the owner
provides for it. An implementation-neutral rendering was available (e.g. "entry names can
express nesting under an existing entry; use that rather than creating a sibling").

### 1.5 The minimum-specificity rule, reduced to an adjective

Original, label rule 1:

> 1. **Use at least 3 words.** Two-word labels are "weak" and often ambiguous.
>    - ✅ `"Spell Graph Navigation"`
>    - ❌ `"Spell Graph"` (2 tokens — weak)

and the mechanism behind it:

> `isWeakSubfeatureLabel` | Flags labels with **≤ 2 tokens**, labels ending in *"scope"*, …

The draft renders this as §3 quality 4, "be specific enough to be unambiguous." That is a
restatement of the *motive* with the *testable threshold* discarded. A contract can stay
implementation-neutral and still say "names below a minimum length are treated as weak by
the system" — the draft says neither the threshold nor that a weakness category exists.
Also lost: labels ending in "scope" are flagged.

### 1.6 The named diagnostic map for silent failures

Original, "Common Silent Failures" table — five symptom→cause→fix rows. The draft's §2 and
§4 encode most of the *end states* these rows protect (missing entry, wrong pillar,
duplicate-ID crash, stale server), so this is the mildest omission here. But the owner's
requirement that a *diagnosis* be performed — that when an entry is missing you determine
*which* gate dropped it rather than retrying edits — is not present anywhere in the draft.
§3 quality 2 ("Later levels are only trusted after earlier ones are confirmed") is about
ordering trust, not about root-causing a failure.

---

## 2. DISTORTED

### 2.1 An entire hard-constraint cluster that has no basis in the original

Draft §4:

> - Field values must come from the defined vocabularies and field shapes of the map's data
>   format; values that are counted from a source document must be recounted when that
>   document changes, never estimated, and any value that is an approximation must be marked
>   as such.
> - Uniqueness/cardinality rules the data format states (e.g. singleton markers, unique ids)
>   must hold after the change.
> - Distinct kinds of ordering the format keeps separate (e.g. product prerequisite vs.
>   execution scheduling) must not be merged or derived from one another.

and the matching §5 clause:

> - Invent precise values (dates, counts, statuses) that the format expects to be observed or
>   counted.

None of this is in the original. Searching the source for the underlying concepts: there
are no counted values, no approximation markers, no dates, no singleton markers, no
prerequisite ordering, and no scheduling ordering anywhere in the 179 lines. The only field
vocabulary the original ever exhibits is `"state": "active"` inside the Gate 2 JSON example,
and the only uniqueness rule is node-ID collision after normalisation — which the draft
already covers separately and correctly.

These three bullets plus the §5 clause are the largest block of text in the draft's
constraint sections, and they are describing a different artifact than the one this skill
governs. A reader would spend effort satisfying obligations the owner never imposed, and —
worse — would reasonably infer that this skill's data format has a schema of vocabularies,
cardinalities and dual orderings that must be consulted. It does not.

### 2.2 "the prefix the system supplies automatically" — the mechanism is inverted

Draft §4:

> - Labels … must not duplicate the prefix the system supplies automatically.

Original, label rule 8:

> 8. **Don't prefix with the feature name.** `toFeatureDrivenSubfeatureName` strips the
>    leading feature name automatically.
>    - ❌ `"Roadmap Tool > Graph Display Stability"` → becomes just `"Graph Display
>      Stability"` anyway

The system does not *supply* a prefix. It *strips* a redundant one, and the original's own
example makes the consequence explicit — the label "becomes just" the unprefixed form. The
draft's phrasing implies the rendered entry will carry a system-added prefix that the author
must avoid double-writing. It will not. Under the draft's reading, an author who wants the
grouping visible in the name might reasonably assume it is added for them; under the
original, they must know it is silently removed. Different mental model, different
authoring behaviour.

### 2.3 An invented read-only-context constraint

Draft §4:

> - The read-only context provided for reference must not be modified.

There is no read-only context, reference directory, or do-not-modify area anywhere in the
original. This appears to be a harness or scaffolding convention that leaked into the
contract as if it were an owner requirement. (See also §5.2.)

### 2.4 The fabricated "two supply paths" ambiguity

Draft §6:

> **Ambiguity noted:** the evidence shows the map being fed by two paths — the documented
> source-record path this skill describes, and a separately curated topic/feature dataset
> whose entries are also promoted into the map.

The original describes exactly one path, and states it categorically:

> Roadmap nodes are **not edited directly** in the roadmap tool UI or its data files.
> They are derived from capability docs via a generator pipeline with multiple gates.

There is no second dataset in the original, curated or otherwise. The three `CURATED_*`
objects in Gate 3 are allowlists that *filter* the single path — they are not an alternative
supply of entries — so if that is what was misread, the reading is wrong. This is not a
neutral hedge: it tells the reader the contract's constraints may be governing something the
owner never described, which invites treating the one real path as merely one option among
two.

### 2.5 "fallback or catch-all" grouping

Draft §2:

> - The entry sits under the intended top-level grouping of the map, not a fallback or
>   catch-all one.

Original failure mode:

> | Gameplay node under "Roadmap Tool" | `featureGroup` too weak for pillar inference |

The failure the owner describes is landing in a *wrong but real* grouping (product work
filed under the tooling grouping), not landing in a fallback bucket. The draft asserts the
existence of a catch-all destination that the original never mentions. Minor, but it
misdirects the check: an author verifying "not a fallback" would pass a node that landed
squarely in the wrong real pillar.

---

## 3. MISLABELED

### 3.1 Phase-numbered and numeric-leading names: preference promoted to prohibition

Draft §4, stated as a hard constraint:

> - Structural section words and enumerated/phase-numbered headings are not valid entry names.

The original treats these two cases *differently*, and the draft merges them:

> | `isGenericSubfeature` | Rejects section-header words like *Overview, Summary, Status…* —
> these become a `"… Scope"` suffix or **are dropped entirely**. |
> | `isWeakSubfeatureLabel` | Flags labels with ≤ 2 tokens, labels ending in *"scope"*,
> labels starting with *"Phase N"*, labels starting with a bare number. **Weak labels are
> still included** but risk collision and ambiguity. |

Section words are genuinely rejected — a hard constraint is correct there. Phase-numbered
and number-leading labels are explicitly "still included"; they are a strong preference
against ambiguity, not an admissibility rule. Promoting them to "not valid entry names"
overstates what the owner requires and would have an author believe a working entry is
invalid.

### 3.2 "Extend, don't duplicate" demoted from flat rule to lowest-ranked quality

Original, Gate 1, stated flatly alongside the other Gate 1 rules:

> - If a doc already exists for this system, extend it instead of creating a new one

The draft places this at §3 quality **6 of 6** — last — as "Prefer extending existing records
and groupings over creating parallel ones." The draft does also carry it into §5 ("Create a
duplicate source record or a parallel grouping when an existing one covers the subject"),
which partly rescues it, but the §3 placement signals it is the first thing to trade away
under pressure. The original gives it no such ranking; it sits among the four unranked Gate 1
requirements.

### 3.3 Ranking imposed where the original states none

More broadly: §3 orders six qualities and asserts precedence ("This outranks everything
below", "Later levels are only trusted after earlier ones"). The original ranks nothing. The
verification *ordering* claim is well-supported ("Run in this order — earlier gates explain
later failures"), but the six-way priority ordering is the drafter's construction presented
as the owner's. Two of the six (footprint discipline, completeness of sweep) are traceable;
the relative ordering of all six is not.

### 3.4 "avoid churn in shared configuration" — invented preference

Draft §3 quality 6 closes with "avoid churn in shared configuration beyond what the entry
requires." No counterpart in the original. Harmless in effect, but it is a preference
presented as owner intent, and it sits oddly against the original, which *requires* touching
shared configuration (the manifest, three allowlist objects, and two mirror registries) for
every single entry.

---

## 4. LEAKED MEANS

The draft is, on the whole, well-abstracted — the numeric slug bound became "length-bounded",
`featureGroup`/`inferPillarForFeature()` became "a declared classification field", and the
API-then-browser sequence became "served data … then the running viewer". Those are good.
The leaks that remain:

### 4.1 The pipeline shape, spelled out as the required method

Draft §4:

> **Method is part of the requirement here:** map entries must be produced through the
> established **source-record → registration → generation** path.

This one is defensible and I am not scoring it as a fault: the original opens by making the
method itself the requirement ("Roadmap nodes are **not edited directly**… They are derived
from capability docs via a generator pipeline"), and the draft flags explicitly that it is
importing method deliberately. Noted for completeness, not as a defect.

### 4.2 The capitalisation mechanism

Draft §4:

> - Labels must not rely on transformations the system does not perform (e.g. preserving
>   unusual capitalisation) …

The parenthetical exists only to gesture at the original's hardcoded acronym-preservation
list (`UI, UX, API, URL, AI, NPC, VS, TS, TSX, JSON, PHB, D&D, 3D, 2D, RPG`). The general
clause before it is sound and self-sufficient; the example adds nothing an author can act on
without the list, and imports the implementation detail that a title-casing pass exists.

### 4.3 Examples imported from a system the original does not describe

Draft §4: "(e.g. singleton markers, unique ids)" and "(e.g. product prerequisite vs.
execution scheduling)". These are concrete implementation vocabulary — from somewhere, but
not from this skill. Leaked means *and* fabricated requirement at once (see 2.1).

### 4.4 The read-only-context clause

Draft §4's "read-only context provided for reference must not be modified" is a procedural
rule about the drafting/execution environment, not an owner requirement about the map. Pure
leaked means (see 2.3).

---

## 5. FINGERPRINTS

Wording or content in the draft that could identify which skill — or which drafting setup —
produced an output:

### 5.1 The three-way file classification, preserved one-to-one

Draft §2:

> each is characterised as **focused, deliberately coordinating, or overdue for splitting**

Original:

> - `atomized` — single concern/component
> - `acceptable-orchestrator` — intentionally coordinates multiple modules
> - `needs-split` — multiple unrelated concerns (add follow-up node)

The paraphrase is clean, but the *tripartite structure with these exact three distinctions*
is highly distinctive — "deliberately coordinating" as a legitimate middle category between
focused and needs-splitting is not a common taxonomy. Any output carrying this three-way
split traces back to this skill. Largely unavoidable, since it is the requirement; flagged
because it is the strongest identifying signal in the draft.

### 5.2 "The read-only context provided for reference must not be modified"

This reveals a harness convention — that the drafter worked with a designated read-only
reference area. It has nothing to do with the skill's subject and would mark any output
carrying it as having come from this pipeline.

### 5.3 "singleton markers" / "product prerequisite vs. execution scheduling"

The most identifying phrases in the document, precisely *because* they do not belong to this
skill. They point at a different source document in the drafter's context — an output
containing them can be traced not just to a version but to a specific contamination.

### 5.4 "units lacking a verification route"

A near-transliteration of the audit report key `moduleLeavesMissingTestDefinitions` (module
leaf → unit; missing test definition → lacking a verification route). Distinctive enough to
be recognisable, and it is the one place the draft's abstraction preserves the original's
odd noun-phrase shape.

### 5.5 "tooling-about-the-map is filed separately from product capability"

Traces directly to `docs/tasks/roadmap/` and "Only game/app systems belong here". A genuine
requirement, so it must be stated somehow — but the specific framing of *tooling-about-the-
thing vs. the thing* is a recognisable signature.

### 5.6 Structural

Section headings "Qualities ranked" / "Must never" / "Activation boundary" and the
"**Ambiguity noted:**" convention are contract-template artifacts rather than skill
fingerprints — they identify the drafting format, not which skill was drafted. Noted as
lower-severity for that reason.

---

## 6. VERDICT

**REVISE.**

The draft gets the spine right — the no-direct-editing rule, the multi-gate silent-drop
hazard, the declare-in-two-places exact-match requirement, the normalisation collision risk,
the verify-served-data-before-viewer-with-a-fresh-service ordering, the conjunctive
completion criteria, and the atomization sweep are all present and mostly well abstracted.
Roughly two thirds of the document is faithful work.

It fails on three independent grounds, any one of which would be disqualifying:

1. **Fabricated requirements.** §2.1 identifies three hard constraints and one prohibition
   describing counted values, approximation markers, singleton cardinality and dual ordering
   semantics — none of which exist in the original. This is not over-reading the source; it
   is content from elsewhere. A contract that invents obligations is not implementation-
   neutral, it is a different contract.

2. **Load-bearing omissions.** The required lay-reader description and canonical-doc link on
   every entry (§1.1) and the drift audit (§1.2) are both non-optional in the original and
   both entirely absent. An author following the draft to the letter ships undescribed
   entries and never checks for doc↔program divergence, and the draft would call that
   success.

3. **A fabricated ambiguity that undercuts the central rule.** §2.4's claim of a second
   supply path contradicts the original's opening sentence and softens the one requirement
   the skill exists to enforce.

Additional defects requiring correction before this can pass: the inverted prefix mechanism
(§2.2), the promotion of phase-numbered names from "weak but accepted" to "not valid"
(§3.1), the loss of the minimum-length threshold (§1.5), the missing `>` hierarchy mechanism
(§1.4), the un-required secondary registry mirroring (§1.3), and the read-only-context leak
(§2.3 / §4.4 / §5.2).

Suggested priority for revision: strike the §4 fabricated cluster and the §6 ambiguity note
first (they actively mislead), then restore the description requirement and the audit step
(they change what "done" means), then correct the prefix inversion and the phase-number
mislabel (they change authoring behaviour), then the remainder.
