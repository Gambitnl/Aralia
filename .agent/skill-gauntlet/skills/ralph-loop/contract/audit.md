# Audit: `draft-contract.md` vs. `original/ralph-loop.md`

Scope: the original is a single 79-line command prompt (frontmatter + Core Rules 1–4 +
Your Task + Execution Protocol + Progress Tracking + Completion Signal + Begin). The draft
is a 106-line outcome contract. Findings below are keyed to quoted original text.

---

## 1. OMITTED

**1.1 "needs human input" is dropped as a legitimate blocking condition.** (significant)

The original's blocked branch is triggered by three distinct conditions:

> If you cannot complete the task (**blocked, needs human input, impossible**), output:
> `<RALPH_BLOCKED>`

The draft never mentions needing human input as a valid reason to stop. It reduces the
branch to impossibility:

> "until it is genuinely impossible to proceed" (§1)
> "When completion is genuinely unreachable, saying so with a real reason is a correct
> outcome" (§3.6)

This omission is compounded by a must-never the draft *does* state:

> "or a blocked signal merely to escape difficulty that is actually resolvable" (§5)

A task requiring a human decision (a credential, a product judgment, an approval) is
"actually resolvable" — just not by the agent. Under the draft an implementation is
pushed to keep grinding or to falsely claim completion in exactly the case the original
carves out. The owner's requirement is a *three*-condition blocked branch; the draft
delivers one.

**1.2 The progress record's "Current status" element.** (minor)

Original: the progress file must contain

> - [ ] Task items as checkboxes
> - **Current status**
> - Any blockers or issues encountered

Draft §2 covers planned items, finished items, and obstacles ("what was planned, what is
finished, and what obstructed progress"), but has no counterpart for a live current-status
element — the "where the run is right now" field, distinct from the done/not-done list and
distinct from blockers. §4's "kept current during the run" is about freshness, not content.

**1.3 Sub-agent delegation is silently dropped from the operating environment.** (minor)

Original frontmatter: `allowed-tools: Bash, Read, Write, Edit, Glob, Grep, **Task**`.

Draft §4 renders the environment as "reading and modifying files, and executing commands
or checks." Search (Glob/Grep) is fairly folded into "inspect", but `Task` — delegation to
sub-agents — is a capability the owner explicitly granted and the draft's environment
clause does not admit. Low weight (a grant is not a requirement), but it is a real
narrowing of the sanctioned execution surface.

---

## 2. DISTORTED

**2.1 The "external/outer automated driver" is invented and then asserted as an owner
requirement.** (significant — the draft's largest fabrication)

The original contains no reference to any outer loop, supervising process, external
driver, or non-human consumer. Its only framing statements are:

> "Start autonomous Ralph loop - iterates until task is truly complete" (frontmatter)
> "You are now operating in **Ralph Loop Mode** - an autonomous development loop that
> continues until the task is genuinely complete."

The loop in the original is *internal* — the agent's own iterate-until-verified cycle.
The draft asserts an external consumer four separate times, escalating each time:

> §1: "report a terminal outcome that an external, non-human driver can act on"
> §2: "a distinct, machine-detectable marker that a supervising process can match on"
> §2: "(…the skill is meant to be driven by an outer automated loop, so a parseable
>      terminal signal is part of what is being delivered.)"
> §6: "typically because an automated driver will consume the result"

The delimited sentinel tags are real evidence that the output is meant to be *matchable*,
and stating that much would be fair. But the draft goes past the evidence: it invents an
architecture (an outer harness re-invoking the skill), attributes the owner's motive to
it, elevates it into the Purpose section, and — in §2's parenthetical — pre-emptively
defends it against the charge of being stylistic. An implementation-neutral contract
should say "the two outcomes must be mechanically distinguishable"; it should not
manufacture the consumer.

**2.2 "Loop termination must be reachable" is a constraint the original does not impose.**
(significant)

Draft §4: > "Loop termination must be reachable: the run must end in one of the two
terminal states rather than continuing indefinitely."
Draft §5: > "Continue looping with no prospect of reaching a terminal state."

Nothing in the original imposes a progress-toward-termination obligation. The original's
pressure runs the *opposite* direction — it is emphatic about not stopping early:

> "**Self-correction is mandatory** … Continue until it works"
> "iterate until done, verify everything, never claim false completion"

Termination in the original is a consequence of the two exit conditions being met, never a
duty in its own right. Promoting it to a hard constraint and a must-never introduces a
tension the owner never wrote, and hands an implementation a defensible-sounding excuse to
exit ("no prospect of a terminal state") that the original does not authorize.

**2.3 The completion gate is hardened past "(if applicable)".** (moderate)

Original rule 1 lists four conditions, one of them explicitly conditional:

> - All specified work is implemented
> - **All tests pass (if applicable)**
> - Code compiles/runs without errors
> - You have verified the implementation works

Draft §4: > "it may be emitted only when the work is implemented, the checks pass, the
thing runs, and the implementation has been observed to work. **All of these, not a
subset.**"

"All of these, not a subset" is the draft's own coinage and it flattens the owner's
conditionality: on a project with no test suite, the original's gate is satisfiable and
the draft's hard constraint reads as unsatisfiable. The draft *does* handle the case
correctly elsewhere ("Where nothing verifiable exists…" §2; "Verification is not optional
where verification is possible" §4), which makes this an internal contradiction located in
the strongest-force section of the document.

**2.4 The activation boundary is substantially invented.** (moderate)

The original has no activation guidance whatsoever. It has an `argument-hint` and a
`description`, and it is a command-form prompt — from which "invoked explicitly with a
task argument" is a sound inference. The draft's §6, however, runs to ~15 lines of
prohibition the original never wrote:

> "it must not self-activate on ordinary requests merely because they involve
> implementation, testing, iteration, or fixing something; it must not engage for
> conversational questions, explanations, reviews, or one-shot edits; and it must not be
> adopted as a background posture for unrelated work in the same session."

The last clause is not merely unsupported but in tension with the original's "**You are
now operating in Ralph Loop Mode**", which does establish a persistent posture for the
duration of the task. Presenting invented boundaries in the same register as sourced
requirements is a fidelity problem even where the boundaries are sensible.

**2.5 §6 "Ambiguity noted" resolves an ambiguity by inventing a rule.** (minor)

The draft correctly flags that the original is silent on empty invocation, which is good
practice — but it then states "The most faithful reading is that the task description is
required input and an empty invocation has no defined scope to complete." The original
supports "required input" (`argument-hint: <task-description>`); it says nothing about
what to do, and the draft's phrasing edges toward a behavioral directive. Flagging the gap
without filling it would have been cleaner.

---

## 3. MISLABELED

**3.1 Incremental progress: a Core Rule demoted to ranked preference #5.** (moderate)

The original places it under **Core Rules**, imperative and unconditional:

> "3. **Incremental progress** - Work in small, verifiable steps: Implement one thing /
> Test/verify it / Move to the next thing / **Track progress explicitly**"

The draft demotes it to §3.5, "Incremental, inspectable progress", ranked below four other
qualities, with no counterpart in §4 Hard constraints or §5 Must never. There is a
legitimate argument that step granularity is a *means* and belongs in the preference tier
— but "Track progress explicitly" is not granularity, it is an obligation, and the draft
does carry the progress-record requirement into §4, so it half-recognizes this. The
demotion of the rest is a judgment call the draft never discloses.

**3.2 Self-correction: correctly captured, but its mandatory framing is split.** (minor)

Original: "**Self-correction is mandatory**" — the only rule the original marks with the
word *mandatory*. The draft renders it as ranked quality #3 ("Persistence through
failure") plus a must-never ("Abandon the task at the first failure…"). The substance
survives via §5, so this is close to trivial; noted only because the ranking places a
rule the owner called mandatory below two qualities the owner did not rank at all.

**3.3 Autonomy ranked last — defensible, but reached by the wrong route.** (minor)

Ranking "Autonomy / low interaction cost" 7th is actually well-supported: the original's
"needs human input" escape hatch proves the owner subordinates autonomy to honesty. But
the draft deleted that very evidence (finding 1.1) while keeping the ranking, and §1
states the goal as carrying the task "to genuine, verified completion **without further
human involvement**" — which reads as autonomy-absolutist and pulls against §3.7.

**3.4 Correctly labeled — worth crediting.** The draft's §4 treatment of the progress file
is exemplary: "Its location and format are implementation details; its existence and
currency are not" properly separates the owner's requirement from `.claude/ralph-progress.md`
and the `- [ ]` / `[x]` syntax. Likewise §4's "State must be re-established by inspection
at each iteration" faithfully generalizes rule 4's "Read relevant files … Don't rely on
memory of previous work … Check what's actually there, not what you think is there", and
§5's "Mark progress items finished on the strength of memory or intention" faithfully
carries "Mark items [x] only when verified complete."

---

## 4. LEAKED MEANS

Note first what the draft cleanly abstracted away and deserves credit for: the literal
tags `<RALPH_COMPLETE>` / `<RALPH_BLOCKED>`, the fixed body text "Task finished. All items
implemented and verified.", the path `.claude/ralph-progress.md`, the `- [ ]` / `[x]`
checkbox syntax, the `$ARGUMENTS` placeholder, and the entire six-step Execution Protocol
(Analyze → Plan → Execute → Verify → Iterate → Complete) — none of which appear. That is
the bulk of the original's implementation detail, correctly stripped.

Residual leaks:

**4.1 "at each iteration" (§4) / "Continue looping" (§5) / "iterate-until-done" (§6).**
"Iteration" and "looping" are the original's chosen *procedure* — a loop is one way to
reach verified completion, not the outcome itself. An implementation-neutral phrasing of
§4's constraint would be "state must be re-established by inspection before any judgment
about it, never assumed from earlier in the run." As written, the contract presupposes a
loop-shaped execution model and would read as violated by a non-iterative implementation
that nonetheless re-inspects before every judgment.

**4.2 "emitted", "marker", "match on" (§2, §4, §5).** The requirement is that the two
outcomes be mechanically distinguishable and that blocked carry a reason. "Emitted … as a
distinct, machine-detectable marker that a supervising process can match on" encodes a
specific mechanism — an in-band sentinel token in the output stream, string-matched by a
reader — and forecloses equally valid realizations (exit status, a structured result
object, a status field in the progress record). Paired with 2.1's invented consumer, this
is the draft's most consequential carried-over means.

**4.3 "Small verified units, tracked visibly" (§3.5).** Restates the original's
one-thing-at-a-time procedure rather than the outcome it serves. The draft's own
justification — "so that partial progress survives interruption and the record stays
meaningful" — is the outcome and could have stood alone.

**4.4 "the code builds and runs without errors" (§2).** Faithful to "Code compiles/runs
without errors", but assumes a compile/run project shape. Minor; the original assumes it
too.

---

## 5. FINGERPRINTS

No verbatim tokens from the original survive — no "Ralph", "Wiggum", `RALPH_COMPLETE`,
`RALPH_BLOCKED`, `ralph-progress.md`, `$ARGUMENTS`, or protocol step names. Version
attribution from surface vocabulary is not possible. Structural traces do remain:

**5.1 The four-part completion gate, reproduced in the original's exact count and order.**
Draft §4: "the work is implemented, the checks pass, the thing runs, and the
implementation has been observed to work" — this is a 1:1 positional mapping onto the
original's four bullets (implemented / tests pass / compiles-runs / verified works),
including the otherwise-redundant separation of the third and fourth conditions ("runs
without errors" vs. "verified the implementation works" are near-synonyms that only a
source enumerating both would keep distinct). Draft §5 repeats the same four in the same
order. Any output generated under this contract will reproduce a distinctive
four-condition gate that is closer to a paraphrase of rule 1 than to an independently
derived requirement.

**5.2 "All of these, not a subset" (§4).** A distinctive coinage. It is the draft's own —
not the original's — so it fingerprints *the draft*, not the skill version: two outputs
carrying this construction are traceable to this contract.

**5.3 The exact two-terminal-state architecture with an asymmetric reason field.** Two
states, only the failure state carrying a reason, both machine-matchable. This is a
narrow, recognizable design signature of the source skill. It is also genuinely the
owner's requirement, so it cannot be removed — noted as an unavoidable residual rather
than a defect.

**5.4 "unattended, iterate-until-done execution" (§6).** Echoes the frontmatter
`description`'s "iterates until task is truly complete" closely enough to be recognizable.

---

## 6. VERDICT

**REVISE.**

The draft is well-organized, and its handling of the progress-file, state-awareness, and
verification requirements is genuinely good implementation-neutral work — the literal
tags, path, and protocol steps were correctly stripped. But four findings exceed the
trivial threshold, and three of them alter what an implementation would actually do:

- **1.1** removes an entire branch of the owner's blocked condition ("needs human input"),
  and §5's "merely to escape difficulty that is actually resolvable" then actively
  penalizes the removed case.
- **2.1** invents an external automated driver, promotes it to the Purpose section, and
  argues for it — attributing to the owner an architecture and a motive found nowhere in
  the source.
- **2.2** adds a hard constraint and a must-never (termination-reachability) that the
  original not only lacks but pushes against with "Continue until it works."
- **2.3** hardens "(if applicable)" into "All of these, not a subset", producing an
  unsatisfiable gate on test-less projects and contradicting the draft's own §2 and §4.

Required for a pass: restore the three-condition blocked branch and reconcile it with §5;
strip the external-driver narrative down to "the two outcomes must be mechanically
distinguishable"; delete the termination-reachability constraint and must-never; restore
conditionality to the §4 completion gate; mark §6's invented activation prohibitions as
inference rather than requirement. The §3 ranking and the §4.1/4.2 leaked means should be
revisited but do not alone block acceptance.
