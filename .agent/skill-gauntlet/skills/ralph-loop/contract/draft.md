# Outcome Contract

## 1. Purpose

Take a task description supplied by the user and carry it through to genuine, verified
completion without further human involvement, then report a terminal outcome that an
external, non-human driver can act on. The skill exists because a single unsupervised
pass tends to stop at "looks done"; the job is to keep working — implementing, checking,
correcting — until the work is actually finished and demonstrated to be finished, or
until it is genuinely impossible to proceed. Its value is the trustworthiness of the
finish line, not the speed of reaching it.

## 2. Success

Observable from the outside:

- The task named in the invocation is fully carried out, not partially or approximately.
- Any relevant automated checks the project provides pass; the code builds and runs
  without errors. Where nothing verifiable exists, the operator can still see what was
  done and on what basis it was judged working.
- The work was actually exercised, not merely written — the claim of "done" rests on
  observed behavior rather than on assertion.
- Failures encountered along the way were resolved during the run rather than reported
  as leftovers, or are explicitly named as the reason for stopping.
- The run ends in exactly one of two unambiguous terminal states: completed, or blocked
  with a stated reason. Each is emitted as a distinct, machine-detectable marker that a
  supervising process can match on. (This is a requirement about the *outcome*, not a
  stylistic one: the skill is meant to be driven by an outer automated loop, so a
  parseable terminal signal is part of what is being delivered.)
- A durable record of what was planned, what is finished, and what obstructed progress
  exists on disk when the run ends — readable by a human or a subsequent run without
  reconstructing the session.

## 3. Qualities ranked

1. **Honesty of the completion claim.** Everything else is subordinate. A false
   "complete" is worse than a slow run or an admitted block, because the whole point is
   that a downstream process trusts the signal without reviewing the work.
2. **Verification before assertion.** Each claim of progress must be backed by a check
   that was actually run. This is what makes quality #1 achievable rather than
   aspirational.
3. **Persistence through failure.** When something breaks, the expected response is to
   diagnose, repair, and re-check within the run — not to hand the problem back.
4. **Grounding in current reality.** Judgments about state must come from inspecting
   what is actually present at that moment, not from recollection of earlier steps in
   the same run. Recollection drifts; the drift is what produces false completions.
5. **Incremental, inspectable progress.** Small verified units, tracked visibly, so that
   partial progress survives interruption and the record stays meaningful.
6. **Clear, honest blocking.** When completion is genuinely unreachable, saying so with
   a real reason is a correct outcome, not a failure.
7. **Autonomy / low interaction cost.** Running unattended matters, but never at the
   expense of the qualities above.

## 4. Hard constraints

- The completion signal is gated: it may be emitted only when the work is implemented,
  the checks pass, the thing runs, and the implementation has been observed to work.
  All of these, not a subset.
- The two terminal outcomes must be distinguishable by an automated consumer, and the
  blocked outcome must carry a reason.
- Verification is not optional where verification is possible.
- State must be re-established by inspection at each iteration rather than assumed.
- A progress record must be created and kept current during the run, with items marked
  finished only after they have been verified. Its location and format are
  implementation details; its existence and currency are not.
- The user's task description is the scope. It is the input the skill operates on and
  the standard against which "complete" is measured.
- The run is expected to operate over a real working environment: reading and modifying
  files, and executing commands or checks. An implementation that cannot inspect or
  exercise the project cannot satisfy the verification requirement.
- Loop termination must be reachable: the run must end in one of the two terminal states
  rather than continuing indefinitely.

## 5. Must never

- Emit the completion signal while work remains unimplemented, checks fail, the build or
  run is broken, or the implementation has not been exercised.
- Present unverified work as verified, or infer success from having written code.
- Emit a completion signal when the honest outcome is blocked, or a blocked signal
  merely to escape difficulty that is actually resolvable.
- Emit a blocked outcome without an intelligible reason.
- Abandon the task at the first failure instead of attempting diagnosis and repair.
- Mark progress items finished on the strength of memory or intention.
- Silently narrow the requested scope and then declare the narrowed version complete.
- Produce ambiguous or absent terminal output that leaves a supervising process unable
  to tell whether the run succeeded, failed, or is still going.
- Continue looping with no prospect of reaching a terminal state.

## 6. Activation boundary

**Triggers:** only on explicit invocation by the user, accompanied by a task description
to work on. This is a deliberately requested mode of operation — the user is choosing
unattended, iterate-until-done execution for a specific piece of work, typically because
an automated driver will consume the result.

**Stays silent:** in all other circumstances. It must not self-activate on ordinary
requests merely because they involve implementation, testing, iteration, or fixing
something; it must not engage for conversational questions, explanations, reviews, or
one-shot edits; and it must not be adopted as a background posture for unrelated work in
the same session. Absent an explicit invocation with a task, the skill contributes
nothing.

**Ambiguity noted:** the original does not state what should happen if invoked with no
task description. The most faithful reading is that the task description is required
input and an empty invocation has no defined scope to complete.
