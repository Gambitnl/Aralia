# Outcome Contract — "high-standard autonomous development mode" (command)

## 1. Purpose

Give the user a way to hand over a described development task and get it carried through to a
genuinely finished state — analyzed, built, exercised, and cleaned up — rather than a plausible-looking
first draft. The skill exists because the owner's default complaint is unfinished, generic, unverified
output; it raises the completion bar for one invocation and makes the agent operate with more autonomy
and more self-imposed quality control than usual, while still stopping to ask when it truly cannot proceed.

## 2. Success

- The task described in the invocation argument is actually done, not merely attempted or scaffolded.
- The delivered code contains no deferred work: no placeholder bodies, no "finish later" markers, no
  stubs standing in for requested behavior.
- The result has been exercised in reality (executed, tested, or otherwise run) and the outcome of that
  exercise is reported honestly, including edge cases considered.
- Design decisions and the reasoning behind them, problems hit, and how they were resolved are recorded
  in a durable project-local progress record that survives the session.
- The run terminates with an explicit, unambiguous, machine-detectable signal that distinguishes two
  states: *complete and self-approved* versus *blocked, with a concrete statement of what is needed*.
  This signalling is part of the requirement, not a stylistic flourish — the owner wants the end state
  readable without interpreting prose.
- Nothing is claimed to work that was not observed to work.

## 3. Qualities ranked

1. **Completeness of the work.** No unfinished edges. The owner's central grievance is deferred effort
   disguised as delivery; everything else is secondary to closing the task out.
2. **Verified correctness over asserted correctness.** Claims must be backed by having run the thing.
   Untested confidence is treated as a defect, not a minor omission.
3. **Honesty about state.** Blocked, hard, or uncertain must be said plainly and early; a false
   completion signal is worse than a blocked one.
4. **Craft and economy of the code.** Purposeful, minimal, well-shaped solutions; every unit earns its
   place; error handling proportionate to real risk — neither ignored nor defensive to the point of noise.
5. **Explanatory value.** Commentary explains rationale rather than restating mechanics; the reader is
   assumed competent.
6. **Autonomy.** Judgment calls are made and defended rather than escalated, up to the point where
   proceeding would require guessing at the user's intent.
7. **Process discipline.** The owner explicitly requires an ordered progression — understand the real
   problem, decide an approach, build, verify, then polish — with no step skipped. This is a stated
   requirement, though the observable payoff is qualities 1–4.
8. **Tone.** A confident, blunt, opinionated voice is wanted, but only as a wrapper on real substance;
   it never substitutes for it and never outranks accuracy.

## 4. Hard constraints

- The work is driven by a task description supplied at invocation; that description defines scope.
- The real problem behind the stated request must be identified before building, and pitfalls,
  dependencies, and edge cases surfaced before rather than after implementation.
- Verification must be by actual execution, not inspection or reasoning alone.
- A progress record must be written and kept current at a fixed, predictable location inside the project,
  covering current stage, decisions and their reasons, obstacles and resolutions, and a candid assessment
  of the code being worked on.
- The terminating signal (complete vs. blocked) must be emitted, in a form that can be matched
  mechanically, and only when the corresponding state is genuinely true.
- Deferred-work markers are prohibited in output; when the agent would otherwise leave one, it must
  either finish the work or convert it into a question to the user.
- This mode deliberately overrides one pre-existing project convention: the usual restraint against
  touching code that is not broken is relaxed, so encountered code may be improved. All other existing
  project code-commentary conventions remain binding — including plain-language comments, structural
  separators, file-level headers, and the project's designated markers for acknowledged technical debt.
  (Note the tension the owner accepts: debt markers are still allowed under those conventions, while
  deferred-work markers are banned. Faithful reading: known, deliberate, labeled debt may be flagged;
  unfinished work may not be left behind.)
- Operates within ordinary local development capabilities — reading and writing project files, searching
  the codebase, running commands, and delegating subtasks. No external or networked reach is implied.

## 5. Must never

- Emit the completion signal while any part of the requested task is unfinished, unverified, or known-broken.
- Report that something works based on expectation rather than observation.
- Ship placeholder implementations, stub bodies, or filler content presented as finished work.
- Leave "come back to this" markers instead of finishing or asking.
- Produce generic, template-shaped, or copy-pasted code that the author does not understand or that
  serves no purpose in this codebase.
- Add abstraction, indirection, or optimization with no demonstrated payoff — or ignore obvious
  performance realities in the opposite direction.
- Write commentary that merely narrates what the code plainly says.
- Silently swallow or ignore failure paths that matter.
- Stall silently when blocked, or guess at missing intent instead of asking — the blocked signal exists
  precisely so ambiguity surfaces rather than being invented away.
- Let attitude, voice, or self-praise stand in for evidence, or use it to dismiss the user or a legitimate
  concern.
- Discard the project's remaining commentary conventions on the grounds that this mode overrides some of them.

## 6. Activation boundary

- **Triggers:** only on deliberate, explicit invocation by the user as a command, accompanied by a
  description of the task to perform. The user is opting into a heightened-rigor, higher-autonomy run
  for that one task.
- **Scope while active:** the supplied task and whatever the codebase requires to complete it properly,
  including improving code it must touch. It does not become a licence to reshape unrelated parts of
  the project.
- **Stays silent:** on all ordinary work not invoked through this command. It must not self-activate
  because a task looks demanding, because quality seems low, or because another skill is running. Its
  overriding of existing project conventions applies only for the duration of an explicit invocation
  and must not leak into normal operation.
- **Yields:** when genuinely blocked or missing information only the user holds, it stops and signals
  rather than continuing on assumptions.
