# Outcome Contract — third-party generative-model API integration skill

## 1. Purpose

The skill exists so that code written against one specific vendor's generative-model
platform targets that platform's *current* recommended interface, model lineup, and
client libraries — rather than the older interface and older model names an assistant
would reproduce from stale memory. Two distinct axes of change are in scope and must not
be conflated: migration from the platform's prior-generation interface to the current
one, and upgrading between model generations. It covers greenfield integration work and
conversion of existing code on either axis. A secondary but explicit purpose is to keep
the assistant anchored to the vendor's live published documentation instead of to any
local summary, including this skill's own.

## 2. Success

- Emitted code runs against the current interface and uses only currently supported
  model, agent, and client-library identifiers and minimum library versions.
- Callers that reach the platform directly over HTTP are served as fully as callers that
  use a client library: the current request target and any version-pinning request
  metadata the platform requires are applied.
- Feature-specific details (parameter names, response access, event/step semantics,
  preconditions for a given capability) are correct for the current interface, not
  carried over from the superseded one.
- A model-generation upgrade is completed as a whole rather than as an identifier swap:
  parameters the newer generation no longer accepts are removed, and parameters whose
  name or contract changed are updated.
- When a user names a retired identifier, the result still works: a supported equivalent
  is used, and the substitution is stated to the user rather than made silently.
- Before the user is asked to choose a conversion scope, they are shown how much code is
  affected and where it sits, so the choice is informed rather than blind.
- Conversion work touches exactly the files the user agreed to, applies every change that
  would otherwise break behaviour, and ends with a check that the converted path actually
  works — including the stateful multi-turn path wherever the code relies on one.
- Defaults governing whether and for how long the vendor stores user data are surfaced
  rather than assumed. *(Inferred obligation: the source states these defaults as facts
  the assistant must know, without an explicit instruction to disclose them.)*
- Support is equivalent across every officially supported language ecosystem; none is
  treated as second-class.

## 3. Qualities ranked

1. **Currency and correctness of the target surface.** The skill's entire reason to exist
   is that the default recalled answer is out of date. A fluent answer built on the
   retired interface is a total failure, not a partial one.
2. **Deference to the authoritative published documentation.** *(Method that is genuinely
   part of the requirement.)* The owner states outright that the material bundled with the
   skill is deliberately partial and that the hosted documentation is the source of truth
   for the full surface, parameters, and edge cases. Consulting it before producing code is
   a stated obligation, not an optimisation.
3. **User control over destructive scope.** No edit to a user's repository may precede
   authorisation of what will be edited. This outranks throughput.
4. **Completeness of conversions.** A half-converted codebase is worse than an unconverted
   one; changes that block correct behaviour must all be found, and quality-only changes
   must be distinguishable from them.
5. **Transparency about substitutions, defaults, and residual risk.** The user should never
   be surprised by what was chosen on their behalf.
6. **Coverage breadth across the platform's capability areas**: generation across text and
   other output modalities, dialogue, multimodal input, streaming, tool invocation,
   schema-constrained results, hosted or long-running execution, and the authoring and
   lifecycle management of reusable agent definitions.

## 4. Hard constraints

- Retired model, agent, and client-library identifiers may not be used in produced code or
  recommended for use. Naming a retired identifier when reporting what was found and what
  replaced it is required, not prohibited.
- Two tiers of older identifier exist in the record and both must be preserved: identifiers
  marked retired must be replaced, while identifiers that are older but still supported
  carry a *recommendation* to upgrade, not an obligation — leaving one in place during a
  conversion is permitted. *(Conflict of record: for one model family the source's headline
  rule forbids use outright while its migration material lists that same family as still
  supported with upgrade merely recommended. Do not silently adopt one reading; the reading
  that satisfies both is that new code must not adopt the family while existing code need
  not be forcibly moved off it. Say so where it affects the user.)*
- The current interface's own conventions must be used end-to-end; constructs belonging only
  to the superseded interface must not be mixed in.
- Authoritative live documentation for the specific feature in play must be consulted before
  code is produced. This is a required step, not a fallback for uncertainty.
- Preconditions for a capability, parameter scoping and lifetime rules, and the consequences
  of opting out of a platform default must be established from that live documentation and
  honoured in the emitted code — not reproduced from any local summary.
- Before any edit, the scope must be confirmed with the user whenever the request leaves it
  ambiguous. The trigger is ambiguity, not file count: an instruction such as "convert my
  code" does not authorise editing even a single self-selected file. Confirmation may be
  skipped only where the user named an exact file, an exact directory, or an explicit list,
  or already confirmed scope in an earlier turn.
- A conversion must be followed by an actual functional check of the converted path, not
  merely a claim of completion.
- Every officially supported language ecosystem, and direct-HTTP usage, must be handled with
  the same accuracy.
- Storage and retention defaults, and how they vary by account plan, must be stated
  accurately when they bear on the user's decision.

## 5. Must never

- Produce, recommend for use, or leave in place a retired model identifier or a retired
  client library.
- Treat a still-supported older identifier as if it were retired, or present an optional
  upgrade as mandatory.
- Produce code against the superseded interface when the current one applies, or blend them.
- Treat a model-generation change as finished once the identifier has been swapped.
- Substitute a different model for the one the user asked for without saying so.
- Begin editing files whose scope the user has not established.
- Edit beyond the confirmed scope.
- Assert that a conversion is complete without having verified it.
- Present the skill's own abbreviated local material as the complete or authoritative API
  surface.
- Silently accept a platform default governing storage or retention of user data that the
  user has not been told about.

## 6. Activation boundary

**Should trigger** when the user is writing, reviewing, or modifying code that calls this
specific vendor's generative-model platform — selecting a model, agent, or client library
for it; generating or interpreting content in any modality; holding multi-turn
conversations; consuming incremental responses; invoking tools; constraining output to a
schema; defining, managing, or running hosted, delegated, or long-running work; or
converting existing code along either the interface axis or the model-generation axis.

**Must stay silent** for work targeting any other vendor's model platform, for
general-purpose programming with no call to this platform, for conceptual questions about
the platform that involve no code or code decisions, and for non-code content about the
vendor generally.

**Conflict of record — enablement.** The source's machine-readable configuration declares
the skill inactive, while its own description states detailed conditions under which it
should apply. The record contains no evidence of which governs at runtime. Both are carried
forward as written: the declared inactive setting is a requirement of record, not an
artifact to be worked around, and the descriptive conditions above define the boundary if
and when the skill does run. Neither may be used to widen the trigger beyond what the
description states.
