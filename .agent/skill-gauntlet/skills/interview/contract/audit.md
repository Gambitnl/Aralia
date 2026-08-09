# Audit — `draft-contract.md` against `original/interview.md`

## Source of truth

The original is a single 516-byte command file. Its entire normative content:

Frontmatter:
```
argument-hint: [instructions]
description: Interview user in-depth to create a detailed spec
allowed-tools: AskUserQuestion, Write
```

Body (one sentence, verbatim):
> "Follow the user instructions and interview me in detail using the AskUserQuestionTool about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. be very in-depth and continue interviewing me continually until it's complete. then, write the spec to a file. `<instructions>$ARGUMENTS</instructions>`"

That is the whole owner requirement. Every claim in the draft is measured against those ~70 words plus three frontmatter fields.

---

## 1. OMITTED

**1.1 — "literally anything" is downgraded from the governing scope rule to a footnote.**
The original's scope clause is *"interview me in detail ... about **literally anything**: technical implementation, UI & UX, concerns, tradeoffs, **etc.**"* The four named domains are illustrations bracketed by an unbounded opener and a trailing "etc."

The draft inverts this. Its Success section (§2) states coverage must span *"several distinct kinds of concern — **at minimum** the mechanics of implementation, the experience of use, the user's anxieties/risks, and the tradeoffs"* — turning examples into a floor. Its Hard constraints (§4) never mention unbounded scope at all. The non-exhaustiveness survives only as a clause in the *ranked preferences* section (§3, item 3), which is the weakest place in the document to put it. An implementer reading §2 and §4 would build a four-bucket questionnaire; the original explicitly forbids treating any list as the boundary.

**1.2 — "Follow the user instructions" is the original's first clause and is stated unconditionally.**
The original opens with *"Follow the user instructions and interview me..."* — a governing directive placed ahead of everything else, including the four domains. The draft renders it conditionally and late: §2 bullet 6, *"**If** the invocation carried extra direction..."*, and §4 bullet 5. Nothing in the draft conveys that user-supplied direction *outranks* the default coverage list. The precedence relationship — the thing the word ordering encodes — is dropped.

**1.3 — "in detail" / "detailed spec" appears twice in the original and nowhere in the draft's requirements.**
The frontmatter description is *"Interview user **in-depth** to create a **detailed** spec"*; the body repeats *"interview me **in detail**"* and *"be very in-depth"*. Detail is asserted about both the interview and the artifact. The draft captures interview depth (§3 item 2) but files artifact detail as ranked preference #5 — see §3.2 below.

**1.4 — The `description` field's content is itself owner-authored text and is never accounted for.**
The draft devotes an entire section (§6) to activation semantics but never notes that the owner supplied a specific description string. Minor, but §6 makes strong claims about triggering behavior while ignoring the only frontmatter field that bears on discovery.

---

## 2. DISTORTED

**2.1 — §4: "Where the assistant proposes candidate answers, the user's selection is what counts."**
The original contains no notion of candidate answers, options, or selection. This sentence describes the multiple-choice UI of the `AskUserQuestion` tool and presents it as an owner constraint on content sourcing. It is a mechanism detail promoted to contract text. (Also listed under §4, Leaked means.)

**2.2 — §4: "The file is written after the interview reaches completion, **not incrementally in place of continuing to ask**."**
The first half is supported — *"continue interviewing me continually until it's complete. **then**, write the spec to a file."* The second half is invented. The original prohibits nothing about incremental writing; it only fixes an ordering relative to completion. The draft manufactures a prohibition the owner did not state.

**2.3 — §4: "provided a file is in fact produced and is **discoverable to the user**."**
"Discoverable" is a new requirement. The original says only *"write the spec to a file."* Nothing about visibility, path announcement, or discoverability.

**2.4 — §6: "It is **not** authorization to keep interviewing in later turns after the spec has been delivered."**
Entirely invented. The original says nothing whatsoever about subsequent turns. This is the draft's most freestanding fabricated constraint — it creates a bound the owner never wrote, in the imperative voice of one that was.

**2.5 — Title and §6: "(project-scoped command)" / "within the project where it is installed."**
Nothing in the file establishes project scope versus user scope. The same file works identically installed personally. The draft asserts an installation location as fact.

**2.6 — §1: "Its job is elicitation and capture, **not analysis**, design authority, or construction."**
The original restricts *tools* (`allowed-tools: AskUserQuestion, Write`); it never forbids the assistant from analyzing. Prohibiting construction is a fair reading of the allowlist. Prohibiting *analysis* is not — analysis requires no tool and is arguably how one generates non-obvious questions at all. The draft's phrasing works against its own #1 ranked quality.

**2.7 — §2/§4: "UI & UX" rendered as "the experience of use."**
The original names two things: interface *and* experience. The draft's paraphrase drops the interface/design half. Small, but it narrows one of the four named domains.

**2.8 — §5: "altering the user's existing files."**
`allowed-tools` includes `Write`, which can overwrite existing files. The draft states a stricter rule than the allowlist enforces. The intent reading is defensible, but it is stated as an owner constraint rather than as an inference.

---

## 3. MISLABELED

**3.1 — Spec fidelity is promoted from unstated inference to a hard "must never."**
Draft §5: *"Fill the spec with assistant-authored decisions, resolutions, or requirements the user never endorsed, or contradict answers the user gave."* Draft §4 bullet 1 makes it a hard constraint; §3 item 4 also ranks it. The original never addresses spec content fidelity — it says *"then, write the spec to a file"* and stops. This is a reasonable and probably correct inference, but the draft presents it as an owner prohibition with no marker that it is derived. Three separate sections is heavy weight for text that does not exist.

**3.2 — Artifact detail is demoted from an owner-stated attribute to ranked preference #5.**
The word "detailed" is in the owner's own description line (*"to create a **detailed** spec"*). The draft files "Detail/usability of the spec" sixth-from-top in a preferences list, below three items the owner never ranked. An explicit owner adjective should not sit below inferred qualities.

**3.3 — "Low interaction friction" (§3, item 6) is a preference the owner never expressed.**
*"Questions should be easy to answer in volume, since volume is the point; the answering mechanism should not become the bottleneck."* No part of the original concerns answering ergonomics. This is post-hoc justification for the multiple-choice tool, admitted into the contract as an owner quality. Delete it.

**3.4 — The ranking itself is asserted as the owner's, and the top slot contradicts the draft's own evidence.**
The original contains no ranking. Draft §3 item 1 claims non-obviousness *"is the skill's whole value"*; item 2 concedes *"The owner asks twice for the same thing (in-depth; continue continually until complete)"* — i.e. by the draft's own repetition test, depth/persistence is the more emphasized requirement, yet it is ranked second. Rankings are legitimately interpretive, but they should be flagged as the contract author's judgment, not attributed to the owner ("The owner calls this out explicitly").

**3.5 — Correctly labeled, noted for the record.**
§4 bullet 2 keeps question-driven interaction as a *hard constraint* rather than a means. That is the right call: the owner states it twice (*"using the AskUserQuestionTool"* in prose, and again in `allowed-tools`). No objection.

---

## 4. LEAKED MEANS

**4.1 — "Where the assistant proposes candidate answers, the user's selection is what counts" (§4).** The option-list/selection model is `AskUserQuestion`'s interface, not the owner's requirement. The owner's requirement is that the user is asked; how choices are presented is implementation.

**4.2 — "Low interaction friction... the answering mechanism should not become the bottleneck" (§3.6).** This exists only to rationalize picking a low-effort answering UI. Pure means.

**4.3 — "a question-asking interaction channel plus file writing" (§4).** A one-to-one restatement of the two-entry `allowed-tools` list, framed as "channels." The neutral form is "may ask the user and may write a file; nothing else" — which the draft also says. The channel framing adds only tool shape.

**4.4 — "not a single **batch** followed by a guess" and "over multiple **rounds**" (§2).** "Batch" and "round" are artifacts of a tool that submits several questions per call. The owner's requirement is continuation until complete; batching is invisible to it.

**4.5 — §6's entire auto-activation apparatus.** *"It must not self-activate because a task looks under-specified, because the user mentioned a spec, requirements, or planning..."* imports description-matching/auto-trigger semantics from the Skill model. The original is an `$ARGUMENTS` command file, which by construction only runs when typed. The draft spends its longest section defending against a failure mode the artifact's own format precludes — and in doing so, describes a harness mechanism rather than an owner requirement.

---

## 5. FINGERPRINTS

Ranked by how sharply each identifies the source text.

**5.1 — The four-domain list, in the original's exact order and count (§2, §4).**
Draft: *"the mechanics of implementation, the experience of use, the user's anxieties/risks, and the tradeoffs."*
Original: *"technical implementation, UI & UX, concerns, tradeoffs."*
Four items, same sequence, position-for-position synonyms. This is a direct print of the source list and is by itself sufficient to identify the version.

**5.2 — §3 item 2 quotes the original's idiosyncratic phrasing in parentheses.**
Draft: *"The owner asks twice for the same thing (**in-depth**; **continue continually until complete**)."*
Original: *"be very **in-depth** and **continue** interviewing me **continually until it's complete**."*
"Continue continually" is a distinctive, slightly ungrammatical construction unique to this file. Reproducing it near-verbatim inside parentheses is a signature.

**5.3 — §4's "question-asking interaction channel plus file writing."**
Discloses an allowlist of exactly two tools, one for asking and one for writing — enough to name `AskUserQuestion, Write`.

**5.4 — §3 item 3's "an explicit signal that the list is not exhaustive."**
Reveals that the source list terminates in a hedge ("etc.") and opens with an unbounded quantifier ("literally anything") — a structural tell about the sentence's shape.

**5.5 — Title and §6's argument handling.**
*"'interview' (project-scoped command)"* plus *"may carry an optional free-form argument describing what to interview about"* reproduces the command name and mirrors `argument-hint: [instructions]` / `$ARGUMENTS`.

**5.6 — Recurring "The owner calls this out explicitly" / "The owner asks twice" narration.**
Meta-commentary about the source text's own repetition structure. It tells a reader not what is required but where in the original it appears and how often — leakage about the document rather than the requirement.

---

## 6. VERDICT

**REVISE.**

The draft is a competent and mostly well-reasoned reading of a very short original, and it gets the central call right: it treats question-driven elicitation as a genuine requirement rather than a means, and it correctly extracts non-obviousness, depth, persistence, and the write-a-file terminus. But it is not usable as-is, for three independent reasons.

**Fabricated requirements.** §6's later-turn prohibition (2.4), the incremental-write ban (2.2), the discoverability requirement (2.3), and the project-scope assertion (2.5) all appear in the imperative register of owner constraints while having no basis in the source. §1's ban on *analysis* (2.6) actively works against the skill's stated top priority.

**Inverted emphasis.** The original's scope rule is "literally anything," with four examples. The draft's operative sections state a four-domain minimum and relegate unboundedness to a preference (1.1). This is the single change most likely to alter implementation behavior, and it moves in the wrong direction. Relatedly, the owner's leading and unconditional "Follow the user instructions" becomes a conditional afterthought (1.2).

**Fingerprinting.** 5.1 and 5.2 together — the four-domain list in original order, and the parenthetical quotation of "continue continually until complete" — make the source version trivially identifiable from the contract alone, which defeats the implementation-neutrality the draft claims.

Minimum changes to reach PASS:

1. Restate coverage as unbounded, with the four domains explicitly marked as the owner's examples rather than a floor; move non-exhaustiveness from §3 into §4.
2. Raise user-supplied invocation direction to a governing constraint stated unconditionally, ahead of default coverage.
3. Delete 2.2, 2.3, 2.4, 2.5, and the "not analysis" clause of 2.6.
4. Delete §3 item 6 ("Low interaction friction") and the candidate-answer/selection sentence in §4.
5. Mark the §3 ranking and the spec-fidelity constraint (3.1) as the contract author's inferences, not owner statements.
6. Rewrite the domain list in a different order with non-parallel wording, and remove the parenthetical quotation in §3 item 2 and the "the owner says X twice" narration throughout.

Items 1–3 are the blocking ones; 4–6 are required for the neutrality and provenance claims the draft makes about itself.
