# Outcome Contract — "interview" (project-scoped command)

## 1. Purpose

The skill exists to pull a specification out of the user's head that the user would not have written unaided. It runs an extended, probing requirements interview — driven by the assistant asking, the user answering — across the full span of a proposed piece of work (how it would be built, how it would be used, what worries the user, what they would trade away), and then persists the accumulated answers as a written specification document. Its job is elicitation and capture, not analysis, design authority, or construction.

## 2. Success

Observable from the outside, a successful run produces:

- A sustained interactive exchange in which the user is asked many questions over multiple rounds, not a single batch followed by a guess.
- Questions that the user experiences as revealing: they surface decisions, edge cases, and conflicts the user had not already stated or had not considered. A question whose answer was already obvious from the request or from prior answers is a failure of the run, not a neutral filler.
- Coverage spanning several distinct kinds of concern — at minimum the mechanics of implementation, the experience of use, the user's anxieties/risks, and the tradeoffs they are willing to accept — rather than depth in one dimension only.
- The interview continuing until the subject is genuinely exhausted, rather than stopping at a convenient round count.
- A specification file written to disk at the end, containing the substance the interview produced: detailed enough to act on, faithful to the user's stated answers rather than to the assistant's own preferences.
- If the invocation carried extra direction from the user about what to interview about or how, the interview visibly obeys that direction.

## 3. Qualities ranked

1. **Non-obviousness of questions.** The owner calls this out explicitly and it is the skill's whole value: anyone can ask the shallow questions. If the questions are generic, the run is worthless even if a spec appears.
2. **Depth and persistence.** The owner asks twice for the same thing (in-depth; continue continually until complete). Stopping early is the main failure mode being guarded against.
3. **Breadth of coverage.** Multiple named domains of inquiry, with an explicit signal that the list is not exhaustive — the interview should reach whatever matters, including areas not named.
4. **Fidelity of the written spec to the answers given.** The document's job is to encode what the user decided; invented content undermines the point of interviewing at all.
5. **Detail/usability of the spec.** It should be a working document, not a summary of the conversation.
6. **Low interaction friction.** Questions should be easy to answer in volume, since volume is the point; the answering mechanism should not become the bottleneck.

## 4. Hard constraints

- **The user must be the source of the content.** The specification's substance comes from answers the user actually gave. Where the assistant proposes candidate answers, the user's selection is what counts.
- **Interaction is structured and question-driven, and this method is part of the requirement.** The owner constrains the run to a question-asking interaction channel plus file writing — the elicitation must happen through an explicit, user-facing question mechanism, not through the assistant inferring requirements silently or interleaving other work.
- **Scope of action is narrow: ask, then write one file.** No other side effects. The skill does not investigate the environment, modify existing code or documents, execute anything, or begin implementing what is being specified.
- **The interview precedes the artifact.** The file is written after the interview reaches completion, not incrementally in place of continuing to ask.
- **Free-form user direction supplied at invocation must be honored** as scoping/steering for the interview.
- **Completion is defined by exhaustion of the subject, not by a quota.** The original gives no count, no time limit, and no fixed question list; the faithful reading is that the run continues while there is still material worth asking about, and the assistant is responsible for judging that.
- **The spec's location, filename, and internal structure are unconstrained** by the owner and are left to the implementation, provided a file is in fact produced and is discoverable to the user.

## 5. Must never

- Produce a specification without having conducted an interview — no inferring requirements and presenting the result as elicited.
- Ask only shallow or self-evident questions, or questions the user has already answered.
- End after a token amount of questioning while the subject is plainly unexplored.
- Confine the questioning to a single dimension (e.g. only technical mechanics) when other dimensions are open.
- Finish with the specification existing only in conversation, never written to a file.
- Fill the spec with assistant-authored decisions, resolutions, or requirements the user never endorsed, or contradict answers the user gave.
- Take actions outside asking and writing the spec: altering the user's existing files, running the work, or starting to build the thing being specified.
- Ignore or override the user's invocation-time direction about what the interview should cover.

## 6. Activation boundary

- **Triggers only on explicit user invocation** of the command, within the project where it is installed. It is a deliberate, user-initiated act.
- It may carry an optional free-form argument describing what to interview about; absence of that argument is normal and does not block the run.
- **Stays silent otherwise.** It must not self-activate because a task looks under-specified, because the user mentioned a spec, requirements, or planning, or because the assistant judges that more requirements-gathering would help. Volunteering this interrogation unbidden is out of bounds; suggesting the command exists is not the same as running it.
- Being invoked is standing authorization to ask a large number of questions in that session — the user opted into the volume by invoking it, so the run should not hedge or truncate itself out of politeness. It is not authorization to keep interviewing in later turns after the spec has been delivered.
