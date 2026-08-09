# Outcome Contract — "interview"

## 1. Purpose

The skill exists to pull a specification out of the user's head that the user would not have written
unaided. It runs an extended, probing requirements interview — the assistant asking, the user
answering — across a proposed piece of work, and then persists the accumulated answers as a written
specification document. Its job is elicitation and capture, not design authority or construction of
the thing being specified.

## 2. Success

Observable from the outside, a successful run produces:

- Direction the user gives when invoking the skill is followed. It governs what the interview covers
  and how it proceeds, and overrides any default the implementation would otherwise reach for. When
  no direction is given, there is simply nothing to follow, and the run proceeds normally.
- A sustained exchange in which the user is asked a large number of questions over an extended
  period, rather than a quick pass followed by the assistant guessing the rest.
- Questions the user experiences as revealing: they surface decisions, edge cases, and conflicts the
  user had not already stated or had not considered. A question whose answer was already evident from
  the request or from earlier answers is a failure of the run, not neutral filler.
- Questioning that ranges freely over the subject. Anything bearing on the work is in scope — what
  worries the user, how the thing would look and feel to someone using it, the internals of how it
  gets built, what the user would give up and what they refuse to, and whatever else the particular
  subject turns out to demand. Any list of topics is a prompt for the assistant, never a boundary and
  never a checklist whose completion ends the run.
- The interview continuing until the subject is genuinely exhausted, rather than stopping at a
  convenient point.
- A specification file written to disk, detailed enough to act on and built out of the substance the
  interview produced.

## 3. Qualities ranked

The source states no ranking. The order below is this contract's judgment about which qualities
matter most when they trade against each other, not an owner-stated priority list.

1. **Non-obviousness of questions.** The one quality the source singles out with an explicit
   corrective. If the questions are generic, the run is worthless even if a spec appears — anyone can
   ask the shallow questions, and the user gains nothing by being asked them.
2. **Depth and persistence.** Both the interview's depth and its continuation to completion are
   required outright. Stopping early is the main failure mode being guarded against.
3. **Unbounded reach.** The interview should get to whatever actually matters about this subject,
   including territory no list anticipated.
4. **Detail of the specification.** The artifact is required to be detailed in its own right, not
   merely a byproduct of a detailed interview. It should be a working document, not a recap of the
   conversation.
5. **Fidelity of the spec to the answers given.** [Inferred — see §7.] The document's job is to encode
   what the user decided; invented content undermines the point of interviewing at all.

## 4. Hard constraints

- **Scope of inquiry is unbounded.** No topic list — including any this contract names — limits what
  may be asked. An implementation that treats a fixed set of areas as the territory to be covered has
  substituted a questionnaire for an interview.
- **User-supplied direction is binding.** Free-form direction given at invocation steers and scopes
  the interview and takes precedence over the implementation's own defaults.
- **The user must be the source of the content.** The specification's substance comes from answers
  the user actually gave.
- **Elicitation happens through explicit, user-facing questions, and this method is part of the
  requirement.** Requirements may not be inferred silently and presented as elicited.
- **Scope of action is narrow: ask the user, and write a file. Nothing else.** The skill does not
  investigate the environment, execute anything, or begin implementing what is being specified.
- **Both the interview and the artifact must be detailed.** Depth is asserted of each separately.
- **The artifact follows the interview's completion.** The spec is written once the interview is
  complete, not in place of completing it.
- **Completion is defined by exhaustion of the subject, not by a quota.** There is no count, no time
  limit, and no fixed question list; the run continues while material worth asking about remains, and
  the assistant is responsible for judging that.
- **The spec's location, filename, and internal structure are unconstrained**, provided a file is in
  fact produced.

## 5. Must never

- Produce a specification without having conducted an interview.
- Ask only shallow or self-evident questions, or questions the user has already answered.
- Stop while the subject is plainly still unexplored.
- Treat a set of named topics as the full territory, or stop once each has been touched.
- Ignore or override direction the user gave when invoking the skill.
- Finish with the specification existing only in conversation, never written to a file.
- Produce a thin or summary-grade spec after a detailed interview.
- Fill the spec with assistant-authored decisions the user never endorsed, or contradict answers the
  user gave. [Inferred — see §7.]
- Take actions beyond asking and writing the spec — including changing the user's existing files,
  running the work, or starting to build the thing being specified. [Inferred — see §7.]

## 6. Activation boundary

- **Runs only when the user explicitly asks for it.** It is a deliberate, user-initiated act, not
  something to start because a task looks under-specified.
- It may carry optional free-form direction about what to interview about; absence of that direction
  is normal and does not block the run.
- Being invoked is standing authorization to ask a large number of questions — the user opted into
  the volume, so the run should not hedge or truncate itself out of politeness.

## 7. Provenance

These are this contract's inferences, not statements the source makes. They are believed correct and
are binding as written, but they are derived:

- **Spec fidelity** (§3.5, §5): the source requires that a spec be written; it does not say whose
  content goes in it. Fidelity to the user's answers follows from the purpose of interviewing at all.
- **No side effects on existing files** (§5): follows from the skill's stated scope of action, not
  from an explicit prohibition.
- **The ranking in §3**: interpretive throughout.
