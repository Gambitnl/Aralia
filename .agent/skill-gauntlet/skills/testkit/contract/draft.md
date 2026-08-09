# Outcome Contract — browser-runtime test/diagnosis skill

## 1. Purpose

The skill exists to produce trustworthy evidence about how the project's application actually
behaves when it is running, by exercising it in a real browser against a locally running
development instance. It covers three jobs: investigating a reported defect in the running app,
measuring runtime cost (load/interaction timing, memory) for a named part of the app, and
sweeping the app's main entry points for errors and visual proof. Its product is evidence and a
comparison against previously recorded expectations — not fixes.

## 2. Success

- The user receives, for each surface or scenario examined: a clear pass/fail judgement, the
  observed errors quoted exactly as emitted, and — for anything visual — an image captured from
  the running app and delivered to the user.
- Numeric results are recorded in the project's persistent result format and compared against the
  stored reference values, with the comparison output reported as produced rather than paraphrased.
- Every reported observation demonstrably came from the current checkout running in the browser at
  the time of the run, not from a stale buffer, stale build, or prior run.
- When the run cannot be performed to that standard, the user is told plainly that it stopped and
  why, with no partial result presented as if it were a completed check.
- Ambiguous inputs (which job to run, which surface, what "broken" means) are resolved by asking
  the user before work begins.
- Defect investigations end with reproduction steps, the narrowed trigger, and supporting evidence,
  handed onward for root-cause analysis rather than concluded with a guess or a patch.

## 3. Qualities ranked

1. **Evidence integrity.** Every claim traces to something observed in a live, verified-current
   run. This outranks everything else: a wrong-but-confident result is worse than no result.
2. **Safety of the operator's environment.** The skill borrows a machine that belongs to someone
   else. It must not disturb processes, profiles, or data it does not own.
3. **Completeness of the specified sweep.** Once a job is accepted, every named surface or step is
   attempted and accounted for; skipped items are declared, not silently dropped.
4. **Comparability over time.** Results are only useful if this run can be measured against the
   last one, so the recorded shape and the regression thresholds must stay stable.
5. **Verbatim fidelity in reporting.** Errors, diffs, and tool output are passed through unaltered
   so the user can judge them independently.
6. **Efficiency.** Keeping runs short and bounded matters, but never at the cost of the above.

## 4. Hard constraints

- Evidence must come from driving a real browser against the running application. Static analysis,
  unit tests, or reasoning about source code are not substitutes and must not be reported as if
  they were runtime observations. (This method is part of the requirement, not an implementation
  choice.)
- Before any capture or measurement, the run must confirm both that the server answers and that
  what it serves matches the current source. Either check failing is a hard stop.
- Console/state readings must follow a fresh navigation or reload; readings taken from a buffer
  that may predate the action are not acceptable evidence.
- Anything with a visual outcome requires a captured image as its pass condition. If the primary
  capture path fails, an alternative may be used, but the method actually used must be stated.
- The browser instance used must be disposable and isolated from the operator's real browser
  profile and session data.
- The application may only be started through the project's sanctioned launch mechanism, never by
  ad-hoc shell invocation.
- If the required browser-control capability or the server is unavailable, stop and report. There
  is no degraded fallback path.
- Probing the running app is read-only. Live modification of page state to make something appear to
  work is prohibited; corrections belong in source, outside this skill.
- Measurements contaminated by unrelated navigations, reloads, or aborted recordings are discarded,
  not reported. Contamination is itself reportable as a finding about instability.
- Regression thresholds are defined per metric class and applied consistently; updating the stored
  reference values requires explicit user agreement in that run.
- Run artifacts (images, result files, receipts) belong in the project's ignored working area, not
  in version control.
- Known benign runtime artifacts of the project's frameworks and known non-default entry conditions
  must be accounted for so they are neither misreported as defects nor used to dismiss real ones.
- Recovery actions on a stuck or failed server require explicit ownership and explicit consent.
  Knowing a port or process identifier does not confer permission to act on it.

## 5. Must never

- Report a visual surface as working on the basis of numbers, logs, or absence of errors alone.
- Present observations that could have come from a stale server, stale module, or stale console
  buffer as current evidence.
- Terminate, restart, or attach to a process, server, or browser session it did not itself create,
  or act on one without the owner's consent.
- Use, modify, or expose the operator's real browser profile, credentials, or browsing data.
- Silently substitute a weaker check when the required capability is missing, or continue past a
  freshness/liveness failure to produce an artifact anyway.
- Overwrite or promote stored reference values without the user agreeing in that run.
- Alter the running application to mask a symptom, or apply a source fix as part of a diagnosis run.
- Report a partial or aborted sweep as a complete one, or omit surfaces that were not attempted.
- Paraphrase, summarize away, or prettify error text and comparison output that the user needs
  verbatim.
- Draw a root-cause conclusion or propose a patch from symptoms alone.

## 6. Activation boundary

**Should trigger** when the user wants to know how the application behaves while running in a
browser: diagnosing a defect that only appears in the running app, measuring load/interaction cost
or memory for a part of the app, or checking that the main entry points still come up clean with
visual proof. Also appropriate when a prior change needs confirmation in the real runtime rather
than in tests.

**Must stay silent** for: source-level work with no runtime question (code review, refactoring,
design discussion); non-browser test execution such as unit, integration, or CLI test suites;
questions answerable from the code or documentation; build, packaging, or deployment tasks; and
any request aimed at a production or shared environment rather than a local development instance.
It must also not extend itself into fixing what it finds, or into environment repair, without a
separate explicit request.

**When the job is unclear** — the user asks for testing without naming which of the three jobs, or
without naming the target surface — the skill asks rather than assuming.
