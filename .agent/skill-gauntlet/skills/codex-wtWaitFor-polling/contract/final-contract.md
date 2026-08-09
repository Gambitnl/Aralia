# Outcome Contract — blocking wait for delegated work in an interactive process

## 1. Purpose

When the agent hands a task to a long-running interactive process running inside an
embedded terminal surface, it must be able to wait for that process to finish
without human prompting and without repeated status checks. The skill exists to
turn "check back every so often" into one bounded, blocking wait that returns
exactly when the delegated work is complete — or when a stated time limit expires.

## 2. Success

- After dispatching work to the process, a single blocking call is established and
  returns only when the agreed completion marker appears in output produced
  *after* the dispatch — not on a marker left over from earlier activity, and not
  on the agent's own dispatched text being echoed back.
- The call's return value carries enough of the newly produced output for the agent
  to judge what happened, rather than a bare "done".
- If the marker does not appear within the stated limit, the result is explicitly
  and unmistakably a timeout, distinguishable from a completion — and it too
  carries recent output, so the agent can diagnose what the process was doing when
  time ran out.
- No round of manual re-checking, user reminder, or "I'll look again later" occurs
  between dispatch and result.
- Whatever the process reports, the real effect of the delegated work is confirmed
  against the artifacts it should have produced before it is reported as done.

## 3. Qualities ranked

1. **Correctness of the completion signal.** A false "finished" is the worst
   outcome: it makes the agent act on incomplete work. Detection scoped to newly
   produced output is the point of the whole thing.
2. **Reliability of establishing the wait.** The failure this exists to prevent is
   the wait never being set up at all. It must be established as part of the same
   uninterrupted action as the dispatch, before control returns anywhere else.
3. **Cost independent of duration.** The agent's token and tool-call cost of
   waiting must be effectively the same whether the delegated work takes seconds or
   many minutes. Nothing about the wait may charge the agent per unit of elapsed
   time, and no accuracy of timing may be bought by making it do so.
4. **Bounded, honest termination.** Waiting forever, or reporting an ambiguous
   result on expiry, is unacceptable; a clear timeout is an acceptable outcome.
5. **Usefulness of what comes back.** Returning the relevant output beats returning
   a boolean, on the success path and the expiry path alike, because the agent
   usually needs to read the result before it can act.
6. **Recoverability.** When a single wait cannot cover the full duration, it must be
   possible to resume waiting without losing correctness.

## 4. Hard constraints

- Completion must be judged only from output produced after the dispatch. Matching
  against the whole accumulated output is acceptable only where that output is
  known to contain no earlier occurrence of the marker.
- Detection must begin late enough that the echoed dispatch text cannot be mistaken
  for output from the process.
- Every wait carries an explicit maximum duration.
- The wait must be a single blocking operation from the agent's perspective, not a
  sequence of agent-initiated checks.
- Where the delegated work may outlast the ceiling of whatever mechanism carries the
  wait, the requirement is that waiting be *resumed* — correctly rescoped so earlier
  output still cannot match. The requested duration is not clamped under that
  ceiling, and the carrier's expiry is never reported as a completion.
- Both the dispatch and the wait must be addressed at the specific surface hosting
  the delegated process, never at another surface the agent has open at the same
  time.
- Applicability depends on the environment being able to tell the agent that the
  delegated work has ended, scoped to output that is new since the dispatch. The
  skill assumes that capability and does not attempt to work without it.

## 5. Must never

- Report the delegated work as complete on the strength of a marker that predates
  the dispatch, or of the dispatched text itself.
- Leave the delegated work unwatched — ending a response with the task sent and no
  wait in place, or delegating the watching to the user.
- Block indefinitely, or silently swallow an expiry so that a timeout reads like a
  successful completion.
- Let the agent's cost of waiting scale with how long the wait lasts.
- Direct the wait or the dispatch at a different surface than the one hosting the
  delegated process.

## 6. Activation boundary

**Should trigger when:** work has just been, or is about to be, submitted to a
long-running interactive process in an embedded terminal surface, and the agent
must know when that process has finished before continuing; or when the agent
notices it is about to fall back on repeated manual status checks, on a reminder to
itself, or on the user reporting back — including where the user has offered to
watch the process, which does not relieve the agent of establishing the wait.

**Must stay silent when:** the environment offers no way to observe the delegated
process's completion; the work returns its output synchronously through ordinary
command execution; or nothing has been delegated to a separate process. The skill
governs the waiting and the confirmation that the delegated work actually landed —
not the choice of what to delegate, the content of the delegated task, or how the
surface hosting the process is started.
