# Outcome Contract — live-runtime verification of a browser application

## 1. Purpose

The skill exists to produce trustworthy evidence about how the project's application actually
behaves when it is running, by exercising it in a real browser against a locally running
development instance. In scope: sweeping the application's designated surfaces for errors with
visual proof; measuring runtime cost (load and interaction timing, memory) for a named surface;
and investigating a defect that only shows up in the running application. Its product is evidence,
a comparison against recorded expectations, and a reading of what was measured — not fixes.

## 2. Success

- Which kind of investigation is wanted, which surface it targets, and — for a defect — what
  "broken" is supposed to look like are settled with the user before work begins.
- Every surface or scenario examined gets an explicit pass/fail verdict against a fixed bar. It
  fails if any of the following holds: the currency check did not pass; the surface's expected
  ready state never appeared; any error was observed in the application's console; or no image of
  it was captured. Absent all four, it passes. There is no "pass with notes".
- Every image captured is delivered to the user — all of them, every run — because the user judges
  each visual surface by eye. Numbers or a quiet log never pass a visual surface on their own.
- Errors and warnings are quoted exactly as emitted, and comparison output is passed through as
  produced rather than paraphrased.
- Numeric results are recorded in a stable, persistent form and compared against stored reference
  values, so this run can be measured against earlier ones. Recorded per surface: the count of
  console errors, heap size in MB (taken both before and after the measured interaction), the
  largest-contentful-paint time for load measurements, and total long-task time.
- Cost measurements additionally report the leading performance finding *and* the runner's reading
  of it. For 2D surfaces, the scores returned by the automated non-performance quality audit
  (accessibility, best practices) are recorded.
- Defect investigations deliver reproduction steps; verbatim errors *and* warnings; the narrowed
  trigger; network evidence, naming failed requests, 4xx/5xx responses, and missing assets; a
  captured image of the broken state; and, where a leak is suspected, the named largest
  contributors to heap growth. They are handed onward for root-cause analysis rather than concluded
  with a guess or a patch.
- When a surface fails, the user is offered a deeper defect investigation on it. Offering is
  required; proceeding unasked is not permitted.
- Every reported observation demonstrably postdates the currency check and came from the instance
  running at the time of the run, not from a stale buffer or a prior run.
- When the run cannot be performed to that standard, the user is told plainly that it stopped and
  why, with no partial result presented as if it were a completed check.

## 3. Qualities ranked

1. **Evidence integrity.** Every claim traces to something observed in a live run whose currency
   was verified before any artifact was produced.
2. **Safety of the operator's environment.** The skill borrows a machine that belongs to someone
   else. It must not disturb processes, profiles, or data it does not own.
3. **Completeness of the accepted scope.** Once a job is accepted, every named surface or step is
   attempted and accounted for; skipped items are declared, not silently dropped.
4. **Comparability over time.** The recorded metric set and the regression thresholds are fixed, so
   one run can be measured against the last. Which surfaces are swept is owner-maintained and may
   change; the shape of what is recorded about them may not drift run to run.
5. **Verbatim fidelity in reporting.** Errors, warnings, diffs, and audit output are passed through
   unaltered so the user can judge them independently.

## 4. Hard constraints

- Evidence must come from driving a real browser against the running application. Static analysis,
  unit tests, or reasoning about source code are not substitutes and must not be reported as if
  they were runtime observations. (This method is part of the requirement, not an implementation
  choice.)
- No capture or measurement may be produced unless the instance being exercised is reachable and
  serving the current source. The currency check must be aimed at a source file relevant to the
  work at hand, so that passing it means something; a failure of either kind is a hard stop.
- Any reading of console output or application state must be guaranteed to postdate the action it
  is offered as evidence for. Any technique that guarantees this is acceptable; a reading that may
  predate the action is not evidence.
- Anything with a visual outcome requires a real captured image as its pass condition, together
  with a statement of how that image was obtained.
- The browser instance used must be disposable and isolated from the operator's real browser
  profile, credentials, and session data.
- The application may only be started in the project's supported configuration through its
  sanctioned launch path; the run does not improvise process management.
- If the required browser-control capability or the application instance is unavailable, stop and
  report. Neither may be substituted with something weaker. (This bars weakening *these* two
  prerequisites; it does not bar an alternative capture method under the rule above.)
- Probes of application state are read-only. Driving the application — clicks, key input,
  dismissing a blocking overlay before a capture — is expected and permitted, but every such
  intervention must be recorded in the report next to the evidence it touched. Changing page state
  so that something appears to work is prohibited; corrections belong in source, outside this skill.
- Timing measurement excludes warm-up: the surface is first brought to its expected ready state,
  and that first-load cost is not part of the reported number. One surface per measurement.
- A measurement disturbed by unrelated navigations, reloads, or an aborted recording is discarded
  and reclassified as evidence of instability, never reported as a measurement.
- Regression thresholds are fixed and applied consistently: the console-error count regresses on
  any increase, heap size on +15%, and every other numeric metric on +20%. Updating the stored
  reference values requires the user's explicit agreement in that run.
- The automated non-performance quality audit applies to 2D surfaces only.
- Run artifacts (images, result files, logs) belong in the project's ignored working area, not in
  version control.
- Known benign runtime artifacts of the project's frameworks, documented special entry modes, and
  known domain-model misreadings must all be accounted for, so they are neither misreported as
  defects nor used to dismiss real ones.
- Recovery actions on a stuck or failed instance require explicit ownership and explicit consent.
  Incidentally knowing how to reach a process is not authorisation to act on it.

## 5. Must never

- Report a visual surface as working on the basis of numbers, logs, or absence of errors alone, or
  withhold any captured image from the user.
- Present readings that could predate the action, or that came from an unverified or stale
  instance, as current evidence.
- Terminate, restart, or attach to a process, server, or browser session it did not itself create,
  or act on one without the owner's consent.
- Use, modify, or expose the operator's real browser profile, credentials, or browsing data.
- Substitute a weaker check when a required capability is missing, or continue past a reachability
  or currency failure to produce an artifact anyway.
- Run the automated quality audit against a GPU-rendered surface, or report any score it would
  produce there: those metrics are meaningless on such surfaces.
- Overwrite or promote stored reference values without the user agreeing in that run.
- Alter running application state to mask a symptom, or apply a source fix as part of a diagnosis
  run.
- Report a partial or aborted sweep as a complete one, or omit surfaces that were not attempted.
- Paraphrase, summarise away, or prettify error text, warnings, or comparison output that the user
  needs verbatim.
- Draw a root-cause conclusion or propose a patch from symptoms alone.

## 6. Activation boundary

**Should trigger** when the user wants to know how the application behaves while running in a
browser: checking that the key surfaces still come up clean with visual proof, measuring load,
interaction, or memory cost for a part of the app, or diagnosing a defect that appears in the
running app. Also appropriate when a prior change needs confirmation in the real runtime.

**Must stay silent** for: questions answerable from the source or documentation without running
the application; test execution that does not involve driving the app in a browser; and any
request aimed at an environment other than a local development instance. It must also not extend
itself into fixing what it finds, or into environment repair, without a separate explicit
request — offering that next step is permitted and, after a failure, required.

**When the job is unclear** — the user asks for testing without saying which kind of investigation
or which surface — the skill asks rather than assuming.
