# Outcome Contract — blocking wait for a delegated terminal turn

## 1. Purpose

When the agent hands a task to a long-running interactive process running inside an
embedded terminal surface (a browser-hosted preview the agent drives through an
evaluation call), it must be able to wait for that process to finish its turn
without human prompting and without repeated status checks. The skill exists to
turn "check back every so often" into a single bounded, blocking wait that returns
exactly when the delegated turn is complete — or when a stated time limit expires.

## 2. Success

- After dispatching work to the terminal process, a single blocking call is armed
  and returns only when the agreed completion marker appears in output produced
  *after* the dispatch — not on a marker left over from earlier activity, and not
  on the agent's own submitted text being echoed back.
- The call's return value carries enough of the newly produced output for the agent
  to judge what happened, rather than a bare "done".
- If the marker does not appear within the stated limit, the result is explicitly
  and unmistakably a timeout, distinguishable from a completion.
- No round of manual re-checking, user reminder, or "I'll look again later" occurs
  between dispatch and result.
- Whatever the terminal process claims, the real effect of the delegated work is
  confirmed independently (through the artifacts it should have produced) before it
  is reported as done.

## 3. Qualities ranked

1. **Correctness of the completion signal.** A false "finished" is the worst
   outcome: it makes the agent act on incomplete work. Delta-scoped detection is
   the point of the whole thing.
2. **Reliability of arming the wait.** The failure this exists to prevent is the
   wait never being set up at all. It must be established as part of the same
   uninterrupted action as the dispatch, before control returns anywhere else.
   (This is a genuine owner requirement, not merely a technique.)
3. **Bounded, honest termination.** Waiting forever, or reporting an ambiguous
   result on expiry, is unacceptable; a clear timeout is an acceptable outcome.
4. **Cost efficiency.** The wait must not burn tokens or tool calls proportional to
   the wait's length; sampling cadence should be coarse enough to be cheap and fine
   enough not to add meaningful latency after completion.
5. **Usefulness of what comes back.** Returning the tail of new output beats
   returning a boolean, because the agent usually needs to read the result.
6. **Recoverability.** When a single wait cannot cover the full duration, it must be
   possible to resume waiting from a fresh reference point without losing
   correctness.

## 4. Hard constraints

- Detection must be scoped to output that appeared after a reference point taken
  at (or just after) dispatch. Scanning the whole accumulated buffer is not
  acceptable when that buffer may already contain the marker.
- The reference point must be taken late enough that echoed input cannot be
  mistaken for process output.
- Every wait carries an explicit maximum duration, and the caller must respect the
  ceiling imposed by the surrounding tool's own timeout.
- The wait must be a single blocking operation from the agent's perspective, not a
  sequence of agent-initiated checks.
- The terminal process must be addressed on its own designated session/host
  identifier, kept separate from other preview surfaces in use, so waits and
  writes cannot land on the wrong target.
- Applicability depends on the environment actually exposing a way to read the
  terminal's accumulated text and to run asynchronous code against it; the skill
  assumes this and does not attempt to work without it.

## 5. Must never

- Report the delegated turn as complete on the strength of a marker that predates
  the dispatch, or of the dispatched text itself.
- Leave the delegated work unwatched — ending a response with the task sent and no
  wait in place, or delegating the watching to the user.
- Block indefinitely, or silently swallow an expiry so that a timeout reads like a
  successful completion.
- Poll at a cadence that makes the cost of waiting scale with the duration of the
  wait.
- Claim the underlying work succeeded on the basis of the completion signal alone,
  with no check of the actual result.
- Direct the wait or the dispatch at a different session than the one hosting the
  delegated process.

## 6. Activation boundary

**Should trigger when:** work has just been, or is about to be, submitted to a
long-running interactive process in an embedded terminal surface, and the agent
must know when that process has finished its turn before continuing; or when the
agent notices it is about to fall back on repeated manual status checks, a
reminder, or a request that the user report back.

**Must stay silent when:** the environment provides no embedded terminal surface
with readable output and asynchronous evaluation; the work in question returns its
output synchronously through ordinary command execution; nothing has been delegated
to an external process; or the user explicitly wants to observe or drive the
process themselves. The skill governs *waiting*, not the content of the delegated
task, the choice of what to delegate, or how the terminal surface is started.

**Ambiguity noted:** the artifact's name points at a ready-made wait helper, while
its substance argues against relying on it because that helper inspects the whole
buffer. The faithful reading is that the owner's requirement is delta-scoped
waiting; using a prebuilt whole-buffer wait is acceptable only where the buffer is
known to be free of prior occurrences of the marker — for example on first startup.
