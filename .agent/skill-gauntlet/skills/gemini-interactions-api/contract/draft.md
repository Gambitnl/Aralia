# Outcome Contract — third-party generative-model API integration skill

## 1. Purpose

The skill exists so that code written against one specific vendor's generative-model
platform targets that platform's *current* recommended interface, model lineup, and
client libraries — rather than the older interface and older model names an assistant
would reproduce from stale memory. It covers both greenfield integration work and the
conversion of existing code from the platform's prior-generation interface or
prior-generation models. A secondary but explicit purpose is to keep the assistant
anchored to the vendor's live published documentation instead of to any local summary,
including this skill's own.

## 2. Success

- Emitted code compiles/runs against the current interface and uses only currently
  supported model and agent identifiers, current client-library packages, and current
  minimum library versions.
- Feature-specific details (parameter names, response access, event/step semantics,
  preconditions for a given capability) are correct for the current interface, not
  carried over from the superseded one.
- When a user names a retired identifier, the result still works: a supported
  equivalent is used, and the substitution is stated to the user rather than made
  silently.
- Conversion work touches exactly the files the user agreed to, applies every change
  that would otherwise break behaviour, and ends with a check that the converted path
  actually works.
- Behavioural defaults with cost, retention, or privacy consequences are surfaced to
  the user rather than assumed.
- Support is equivalent across both officially supported language ecosystems; neither
  is treated as second-class.

## 3. Qualities ranked

1. **Currency and correctness of the target surface.** The skill's entire reason to
   exist is that the default recalled answer is out of date. A fluent answer built on
   the retired interface is a total failure, not a partial one.
2. **Deference to the authoritative published documentation.** *(Method that is
   genuinely part of the requirement.)* The owner states outright that the material
   bundled with the skill is deliberately partial and that the hosted documentation is
   the source of truth for the full surface, parameters, and edge cases. Consulting it
   before producing code is a stated obligation, not an optimisation.
3. **User control over destructive scope.** Bulk edits to a user's repository must be
   authorised before they happen. This outranks throughput.
4. **Completeness of conversions.** A half-converted codebase is worse than an
   unconverted one; changes that block correct behaviour must all be found, and
   quality-only changes must be distinguishable from them.
5. **Transparency about substitutions, defaults, and residual risk.** The user should
   never be surprised by what was chosen on their behalf.
6. **Coverage breadth across the platform's capability areas** (generation, dialogue,
   multimodal input and output, streaming, tool invocation, structured results,
   long-running/managed execution).
7. **Brevity of the local material.** Concision is desirable but is explicitly
   subordinate to points 1–2; the owner accepts a thin local summary precisely because
   the documentation is expected to be fetched.

## 4. Hard constraints

- Only currently supported model, agent, and client-library identifiers may appear in
  produced code or recommendations.
- The current interface's own conventions must be used end-to-end; constructs belonging
  only to the superseded interface must not be mixed in.
- Authoritative live documentation for the specific feature in play must be consulted
  before code is produced. This is a required step, not a fallback for uncertainty.
- Capability preconditions must be honoured (e.g. that certain execution modes require
  an explicit long-running or provisioned-environment setting, and that opting out of
  one platform default disables the features that depend on it).
- Settings whose lifetime is per-request rather than per-session must be re-supplied on
  every request.
- Before any multi-file edit, the edit set must be confirmed with the user unless the
  user has already named an exact file, an exact directory, or an explicit list, or
  already confirmed in an earlier turn. An imperative instruction alone does not
  constitute scope confirmation.
- A conversion must be followed by an actual functional check of the converted path,
  not merely a claim of completion.
- Both supported language ecosystems must be handled with the same accuracy.
- Retention, storage, and tier-dependent defaults must be stated accurately when they
  bear on the user's decision.

## 5. Must never

- Produce, recommend, or leave in place a retired model identifier or a retired client
  library.
- Produce code against the superseded interface when the current one applies, or blend
  the two.
- Substitute a different model for the one the user asked for without saying so.
- Begin editing files whose scope the user has not established.
- Edit beyond the confirmed scope.
- Assert that a conversion is complete without having verified it.
- Present the skill's own abbreviated local material as the complete or authoritative
  API surface.
- Silently accept a platform default with cost, retention, or data-residency
  implications that the user has not been told about.

## 6. Activation boundary

**Should trigger** when the user is writing, reviewing, or modifying code that calls
this specific vendor's generative-model platform — including text generation,
multi-turn dialogue, multimodal understanding, media generation, incremental/streamed
responses, long-running or delegated tasks, tool invocation, schema-constrained output,
selecting a model or client library for this platform, or converting existing code from
the platform's prior interface or prior model generation.

**Must stay silent** for work targeting any other vendor's model platform, for
general-purpose programming with no call to this platform, for conceptual questions
about the platform that involve no code or code decisions, and for non-code content
about the vendor generally.

**Ambiguity of record — enablement.** The skill's declared metadata marks it as not
enabled, yet it is observed to load and be offered in sessions. The most faithful
reading of the owner's intent, rather than a preference: the descriptive trigger
conditions above are the owner's real statement of when the skill applies, and the
disablement flag expresses an intent for the skill to be inactive that the host does
not currently honour. Any implementation must therefore treat the descriptive trigger
as the operative activation boundary, must not rely on the disablement flag to suppress
activation, and must not treat the flag's ineffectiveness as licence to broaden the
trigger beyond what the description states.
