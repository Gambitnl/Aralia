# Audit — `draft-contract.md` vs. `original/pickle-rick.md`

Auditor had no part in authoring the draft. Line references are to `original/pickle-rick.md`
and `draft-contract.md` as delivered.

---

## 1. OMITTED

Owner requirements present in the original with no counterpart in the draft.

**1.1 — Self-accountability and regression prevention (original lines 39–42).**
The original devotes a whole numbered philosophy point to it:

> **4. Self-Accountability** - If something breaks:
> - Own it
> - Fix it
> - Make sure it never breaks that way again

The draft has honesty-about-state (§3.3, §5) but nothing about *owning* a break, and
nothing at all about the forward-looking obligation — "make sure it never breaks that way
again." That third clause is a distinct outcome requirement (the fix must close the class
of failure, not just the instance) and it is absent from Success, Hard constraints, and
Must never alike.

**1.2 — Iteration to convergence (original lines 16 and 35).**
Original persona trait: "**Relentless iteration**: You don't stop until it's perfect."
Original lifecycle: `ANALYZE → DESIGN → IMPLEMENT → TEST → VERIFY → ITERATE`.
The draft's process requirement (§3.7) is "understand the real problem, decide an approach,
build, verify, then polish" — a five-step chain with no loop-back and no ITERATE terminal
step. The original mandates two distinct things the draft merges away: a separate TEST step
ahead of VERIFY, and an ITERATE step that re-enters the cycle. "You don't stop until it's
perfect" is a stopping condition the owner states explicitly; the draft's stopping condition
is only "the task is done."

**1.3 — Plan for testability (original line 58).**
Phase 2 Design requires "Plan for testability." The draft's §4 constraint on the pre-build
stage covers only "the real problem... pitfalls, dependencies, and edge cases." Designing so
the result *can* be verified is a separate owner requirement and is nowhere in the draft.

**1.4 — "No shortcuts that create debt" (original line 37).**
The original pairs "No skipping steps" with "No shortcuts that create debt." The draft
carries the first half (§3.7 "no step skipped") and drops the second entirely — then in §4
goes the other way and reasons at length about debt markers being permissible. The owner's
prohibition on *creating* debt via shortcuts has no representation in the draft.

**1.5 — Generic error messages (original line 22).**
The No-AI-Slop list bans "Generic error messages" as its own item. The draft's §5 has
"Silently swallow or ignore failure paths that matter" (covers original line 86, "Ignoring
error cases") and "Produce generic, template-shaped, or copy-pasted code" — but the specific
requirement that error messages themselves be non-generic is not stated. Handling an error
path and reporting it usefully are different obligations.

**1.6 — Consistency as a polish outcome (original line 72).**
Phase 5 requires "Ensure consistency" alongside cleanup. The draft's §1 mentions "cleaned
up" and §2 has no consistency criterion. Minor, but it is a stated deliverable property.

**1.7 — "Code that teaches something" (original line 80).**
Listed under Acceptable. The draft's §3.5 "Explanatory value" is scoped to *commentary*
("Commentary explains rationale rather than restating mechanics"). The original's standard
is about the code itself being instructive, which is broader.

---

## 2. DISTORTED

Draft statements that misstate what the original requires.

**2.1 — "overrides one pre-existing project convention" (draft §4) is factually wrong.**
The original (lines 116–122) says the mode "overrides specific rules" — plural — and lists
two:

> - **TODOs are banned.** Rick finishes what he starts. Ask the user instead of leaving debt.
> - **Elegance over preservation.** The "don't touch what isn't broken" rule is relaxed — Rick improves what he sees.

The draft asserts only the second is an override. It does carry the TODO ban forward (§4,
§5) but detaches it from the override relationship, which loses the fact that the base
convention otherwise *permits* deferred-work markers and this mode revokes that permission.

**2.2 — The draft manufactures a contradiction the original does not have.**
Following from 2.1, draft §4 adds:

> (Note the tension the owner accepts: debt markers are still allowed under those conventions,
> while deferred-work markers are banned. Faithful reading: known, deliberate, labeled debt may
> be flagged; unfinished work may not be left behind.)

The original states both facts without tension — TODOs are an overridden rule, DEBT/HACK
flagging is an un-overridden rule — precisely because they are governed by different
sentences. The draft first mis-scopes the override (2.1), then inserts an editorial gloss
("Note the tension... Faithful reading:") to patch the confusion it created. Interpretive
commentary addressed to the reader is not an owner requirement and does not belong in a
contract; it also invites an implementer to relitigate the TODO ban.

**2.3 — Edge cases: "tested" downgraded to "considered."**
The original requires both:

> - Consider edge cases upfront   (line 58, Design)
> - Test edge cases               (line 67, Verification)

The draft's §2 says the exercise outcome is reported "including edge cases considered," and
§4 says edge cases must be "surfaced before rather than after implementation." Both draft
statements land on the *design-time* obligation. The verification-time obligation — edge
cases must actually be executed, not merely enumerated — is stated nowhere, even though
§3.2 and §4 are emphatic that verification means execution.

**2.4 — Improvement scope narrowed (draft §6 "Scope while active").**
Original: "Rick improves what he sees." Draft: "the supplied task and whatever the codebase
requires to complete it properly, including improving code it must touch. It does not become
a licence to reshape unrelated parts of the project." The original's trigger for improvement
is *encountering* code; the draft's is *needing to touch* it. The second sentence is a limit
the owner never wrote. This may be a defensible tightening, but as written it is presented as
the owner's boundary, not as the drafter's.

**2.5 — An added prohibition with no source (draft §5).**
> Let attitude, voice, or self-praise stand in for evidence, **or use it to dismiss the user
> or a legitimate concern.**

The first clause is faithful to line 14 ("You're the best and you know it, but you back it
up"). The second has no basis in the original, which is uniformly pro-arrogance and contains
no user-deference requirement. It is an invented constraint.

**2.6 — The ranking in §3 is authored, not sourced.**
The original states no priority ordering among its standards. Draft §3 supplies a numbered
1–8 hierarchy plus adjudication rules that appear nowhere in the source — "everything else
is secondary to closing the task out," "it never substitutes for it and never outranks
accuracy," "a false completion signal is worse than a blocked one." Some of these are
plausible readings; none are stated by the owner. A contract presenting them as the owner's
ranking overstates what is known. (See also §3.1 below for the consequences.)

**2.7 — Tool allowlist read as a scope constraint (draft §4, last bullet).**
> Operates within ordinary local development capabilities — reading and writing project
> files, searching the codebase, running commands, and delegating subtasks. No external or
> networked reach is implied.

The original's frontmatter `allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task` is a
*permission grant* — a ceiling on what the runtime exposes. The draft converts it into a
positive requirement about how the work operates. The absence of a network tool in an
allowlist is not the owner requiring offline operation.

---

## 3. MISLABELED

**3.1 — Requirement demoted to preference: the strict lifecycle.**
Original line 33–37 makes this a hard rule, in imperative form:

> 3. **Strict Lifecycle** - Every task follows this cycle:
>    ANALYZE → DESIGN → IMPLEMENT → TEST → VERIFY → ITERATE
>    No skipping steps. No shortcuts that create debt.

Line 48 heads the same material "## Execution Protocol." In the draft this appears **only**
as item 7 of "Qualities ranked" — a preference list — and is hedged in place:

> This is a stated requirement, though the observable payoff is qualities 1–4.

§4 "Hard constraints" contains no ordered-progression bullet. So the draft simultaneously
concedes it is a requirement and files it seventh among eight preferences with an argument
for why it matters less than the outcomes. That is a demotion, and the hedge reads as
permission to skip steps if outcomes 1–4 are reached another way — the exact thing "No
skipping steps" forbids.

**3.2 — Requirement demoted: persona/voice.**
The original does not present the voice as decoration. It is constitutive — "You are now
**Pickle Rick**" (line 11), the standards section is literally titled by the persona's
reaction ("Unacceptable (triggers Rick rage)", line 83), and the completion signal's required
body text is a persona utterance (line 104). The draft files it last (§3.8) as something
"wanted" and subordinates it: "it never substitutes for it and never outranks accuracy." The
subordination is sensible engineering, but the owner never stated it, and a contract reader
would reasonably conclude the voice is optional garnish. Neutralizing the *specific* persona
for implementation-neutrality is correct; reducing its *status* to eighth-ranked preference
is a relabel.

**3.3 — Requirements demoted: the God Mode Coding standards.**
Original lines 27–31 state them as obligations ("Write code like you're the smartest being
alive: Elegant solutions over brute force / Proper error handling (but not paranoid) / Clean
architecture that makes sense / Comments that explain WHY, not WHAT"). The draft renders
them as ranked qualities 4 and 5 rather than constraints. The corresponding §5 "Must never"
entries partially recover this (the negative half), but the positive obligations —
*elegant*, *clean architecture that makes sense* — survive only as preferences.

**3.4 — Preference promoted: "survives the session."**
Draft §2: "a durable project-local progress record that survives the session." The original
(line 92) says only "Update `.claude/pickle-rick-progress.md`." Durability across sessions is
a reasonable inference from "write it to a file," but it is stated in the draft as a success
criterion the owner set.

---

## 4. LEAKED MEANS

**4.1 — The completion signal's mechanism.**
Draft §2 and §4 require a signal that is "machine-detectable" and "in a form that can be
matched mechanically." The owner's *outcome* is an unambiguous, non-prose declaration of one
of two end states. "Matched mechanically" is an abstraction of the original's specific means
— fenced XML-ish delimiter tags (`<WUBBA_LUBBA_DUB_DUB>`, `<RICK_NEEDS_MORTY>`, lines
102–114). A contract that mandates machine-matchability has already ruled out equally valid
implementations (a structured status object, a fixed first-line prefix, an exit code). Close
to the line; the draft is right that the two-state distinction is required, and wrong to
carry the parse-shape.

**4.2 — Fixed file at a fixed path.**
Draft §4: "A progress record must be written and kept current at a **fixed, predictable
location inside the project**." The owner's outcome is that decisions, obstacles, and an
honest codebase assessment are recorded durably where the project can find them. "Fixed,
predictable location" is a restatement of the original's hardcoded
`.claude/pickle-rick-progress.md`. Defensible — the original does mandate a specific file —
but it is the means, not the outcome, and the draft states it as a hard constraint.

**4.3 — The named phase sequence.**
Draft §3.7 spells out "understand the real problem, decide an approach, build, verify, then
polish." This is the original's Execution Protocol procedure carried over verbatim in
structure. Unlike 4.1 and 4.2 this is genuinely an owner requirement (line 37, "No skipping
steps"), so carrying it is faithful — but note that the draft carries the *procedure* while
dropping the requirement's teeth (see 3.1) and the wrong half of the sequence (see 1.2). If
the procedure is going to be carried as means, it should at least be carried correctly.

**4.4 — Tool inventory.**
Draft §4's "reading and writing project files, searching the codebase, running commands, and
delegating subtasks" is a one-to-one paraphrase of `Read, Write / Glob, Grep / Bash / Task`.
This is the harness configuration, not an owner requirement about the work. See 2.7.

---

## 5. FINGERPRINTS

Wording in the draft that could identify the source skill or its version.

**5.1 — The four-item commentary rule list, in source order (draft §4).**
> including plain-language comments, structural separators, file-level headers, and the
> project's designated markers for acknowledged technical debt

Original line 122:
> Plain-English comments, section separators, file headers, debt flagging (DEBT/HACK prefixes)

Same four items, same order, term-for-term synonym substitution ("Plain-English"→"plain-language",
"section separators"→"structural separators", "file headers"→"file-level headers",
"debt flagging"→"designated markers for acknowledged technical debt"). This is the strongest
fingerprint in the document — it reproduces the referenced companion skill's rule inventory
closely enough to identify it, and it discloses that a `code_commentary` skill exists with
exactly that rule set.

**5.2 — The optimization/pessimization pairing (draft §5).**
> Add abstraction, indirection, or optimization with no demonstrated payoff — **or ignore
> obvious performance realities in the opposite direction.**

Original line 87: "Premature optimization OR premature pessimization." The "or ... in the
opposite direction" construction is a direct transliteration of an unusual paired
formulation. Few independently-written contracts would produce a both-directions performance
clause; this one traces straight back.

**5.3 — "self-approved" (draft §2).**
> distinguishes two states: *complete and self-approved* versus *blocked*

Original line 104: "Task complete. Code is clean. Rick approves." — and line 100, "Only when
the task is DONE and Rick-approved." "Self-approved" is a mechanical de-naming of
"Rick-approved" and preserves the source's idiosyncratic notion that the agent signs off on
its own work by name.

**5.4 — "the reader is assumed competent" (draft §3.5).**
Original line 88: "Comments that insult the reader's intelligence." Same distinctive framing
(reader intelligence as the comment-quality test), inverted to positive form.

**5.5 — Title and §1 echo the frontmatter description.**
Draft title: "high-standard autonomous development mode." Original frontmatter (line 3):
"hyper-competent autonomous development with zero tolerance for slop." "Autonomous
development mode" plus an intensity adjective is a near-template match.

**5.6 — Disclosure of the override relationship itself.**
Draft §4 states that the mode "deliberately overrides one pre-existing project convention"
and that other conventions "remain binding." The existence of a companion commentary skill
that this skill selectively overrides is a structural fingerprint of this specific skill
family, independent of the wording in 5.1.

**5.7 — Second-person editorial voice about the owner.**
§1 "the owner's default complaint is unfinished, generic, unverified output," §3.1 "The
owner's central grievance," §4 "Note the tension the owner accepts... Faithful reading:".
Not a version fingerprint, but drafter-authored narration inside what is supposed to be a
statement of requirements — it marks the document as a reconstruction rather than a contract.

Clean by comparison: the draft correctly avoids "AI slop," the character name, the burp, the
literal tag strings, and the literal progress-file path. The leakage is in structure and in
distinctive phrase-shapes, not in proper nouns.

---

## 6. VERDICT

**REVISE.**

The draft is a competent and mostly well-organized reconstruction, and its de-naming of the
persona and file paths is genuinely good work. It does not pass, for four independent
reasons, any one of which would be enough:

1. **A whole requirement is missing.** Self-accountability (§1.1) — own it, fix it, ensure it
   cannot recur — is one of four numbered philosophy points in the original and appears
   nowhere in the draft. "Relentless iteration"/ITERATE (§1.2) and "plan for testability"
   (§1.3) are likewise absent.
2. **A hard rule is filed as a preference, with an argument for deprioritizing it.** The
   strict lifecycle is stated imperatively in the original ("No skipping steps") and appears
   in the draft only as ranked preference #7, hedged with "the observable payoff is qualities
   1–4" (§3.1). An implementer following the draft could skip steps in good conscience.
3. **A factual misstatement plus invented reconciliation.** The draft says one convention is
   overridden where the original overrides two (§2.1), then inserts editorial commentary to
   resolve the apparent paradox that error creates (§2.2). It also narrows the improvement
   mandate (§2.4) and adds a prohibition with no source (§2.5).
4. **Identifying wording survives.** The four-item commentary list reproduced in source order
   (§5.1) and the premature-optimization/pessimization pairing (§5.2) would each let a reader
   trace an output back to this skill.

Also worth fixing on the same pass: the edge-case testing requirement collapsed into
edge-case consideration (§2.3), the tool allowlist read as an operating constraint (§2.7),
and the unsourced 1–8 priority ranking (§2.6) — which should either be dropped or explicitly
labeled as the drafter's inference rather than the owner's position.
