# Audit — `draft-contract.md` vs. `original/` (gemini-interactions-api)

Scope of comparison: `original/SKILL.md` (incl. YAML frontmatter) and `original/references/migration.md`, against `draft-contract.md` in full.

Note on abstraction: the draft is deliberately vendor-anonymised, and that is a legitimate contract-writing choice. Findings below are *not* about anonymisation as such — they are about requirements that changed meaning, strength, or existence in the process.

---

## 1. OMITTED

### 1.1 Non-SDK / REST callers: endpoint change and required revision header
`migration.md` makes two checklist items mandatory for REST code:

> - [ ] REST: Changed endpoint to `/v1beta/interactions`
> - [ ] REST: Add `Api-Revision: 2026-05-20` header (SDK ≥ 2.0.0 sets it automatically)

and the mapping table:

> | **REST endpoint** | `POST /v1beta/models/{model}:generateContent` | `POST /v1beta/interactions` |

The draft never contemplates code that calls the platform over raw HTTP. Its success criteria and hard constraints are expressed entirely in terms of "client-library packages", "current minimum library versions", and "both officially supported language ecosystems" (§2, §4). Under the draft, an implementer converting a REST integration has no obligation to change the endpoint or to pin an API-revision header — the requirement is not derivable from "the current interface's own conventions must be used end-to-end", because the draft has defined the interface surface as an SDK surface. §4's "Both supported language ecosystems must be handled with the same accuracy" is, on its face, an exhaustive statement of the covered surfaces, and REST is not one of them.

### 1.2 Model-generation upgrades carry their own breaking parameter changes
`migration.md`, "Migrate to Gemini 3.5":

> - [ ] Removed `temperature`, `top_p`, `top_k` from config
> - [ ] Replaced `thinking_budget` with `thinking_level` (`minimal`, `low`, `medium`, `high`)

This is a distinct class of required work: a *model* upgrade (not an API migration) that requires deleting parameters the new generation no longer accepts and renaming one whose contract changed. The draft has no counterpart. Its nearest text — §2's "Feature-specific details … are correct for the current interface, not carried over from the superseded one" — is scoped to the *interface* migration, and §1 describes model work only as using "currently supported model … identifiers". Swapping the identifier while leaving `temperature` and `thinking_budget` in place satisfies every clause of the draft and fails the original.

This omission is compounded by the fact that the draft *did* import the original's opposing claim in spirit — that upgrades are drop-in (SKILL.md: "**Model upgrades**: Drop-in, swap the model string"; migration.md: "model upgrades are generally drop-in — change the model string and verify") — without importing the checklist that qualifies it.

### 1.3 The scope question must be informed by an actual survey of affected files
`migration.md`, "Sizing the scope (large repos)":

> **Before asking, get a per-directory count** … Present the breakdown in your question (e.g. *"Found 42 references across 3 directories: src/ (28), tests/ (10), scripts/ (4). Which to migrate?"*).

The concrete `rg` command is a means and is correctly absent. But the outcome — that the user is given the size and distribution of the affected code *before* being asked to choose a scope — is an owner requirement about the quality of the user's consent, and it is absent from the draft. The draft's §4 requires only that "the edit set must be confirmed with the user", which is satisfied by an unquantified yes/no question.

### 1.4 Custom agent authoring and lifecycle as a capability area
SKILL.md lists as a current agent option:

> - **Custom agents**: Create your own via `client.agents.create()`

and later: "Manage agents with `client.agents.list()`, `client.agents.get(id=...)`, and `client.agents.delete(id=...)`", plus a worked example of defining an agent with a base agent, system instruction, and a base environment seeded from a repository.

The draft's coverage list (§3.6) is "generation, dialogue, multimodal input and output, streaming, tool invocation, structured results, long-running/managed execution". *Using* a managed agent is covered; *defining, listing, and deleting* one is not. The activation boundary (§6) likewise lists "long-running or delegated tasks" but never authoring an agent.

### 1.5 Smaller omissions worth noting
- **Speech/TTS and music generation** are first-class in the original (`gemini-3.1-flash-tts-preview`, "Speech Generation", "Music Generation" doc pages). The draft's "multimodal input and output" arguably reaches audio out, but the original also names dedicated capability areas the draft's enumeration does not.
- **`thought` steps have a required `signature` field** ("Has `signature` field (required)"). A correctness precondition of the same kind the draft chose to encode explicitly for other features in §4; this one was dropped.
- **Multi-turn context preservation is a named verification step** ("For multi-turn, verify `previous_interaction_id` preserves context across turns"). The draft's §2 reduces verification to "a check that the converted path actually works", which does not reach the stateful path specifically.

---

## 2. DISTORTED

### 2.1 The scope-confirmation gate is narrowed from "any edits" to "multi-file edits"
Original (`migration.md`, emphasis in source):

> **Before any edits, confirm the scope.** If the user's request does not explicitly name a single file, a specific directory, or an explicit file list, ask first and do not start editing.

and SKILL.md: "Always confirm scope with the user before editing."

Draft §4:

> - Before any **multi-file** edit, the edit set must be confirmed with the user unless …

and §3.3: "**Bulk** edits to a user's repository must be authorised before they happen."

The original's trigger is *ambiguity of scope*, not *number of files*. Under the original, an agent that receives "migrate my code", picks one file it judges most relevant, and edits it has violated the rule. Under the draft, that behaviour is compliant — a single-file edit is neither "multi-file" nor "bulk". The draft's own exception list ("unless the user has already named an exact file …") shows the correct trigger was understood and then attached to the wrong predicate: if the exception is "the user named an exact file", the rule it excepts cannot logically be limited to multi-file edits.

### 2.2 "Cost" and "data-residency" disclosure duties are invented
Draft §2: "Behavioural defaults with **cost, retention, or privacy** consequences are surfaced to the user"; §5: "Silently accept a platform default with **cost, retention, or data-residency** implications".

The original's disclosable defaults are exactly one cluster:

> - Interactions are **stored by default** (`store=true`). Paid tier retains for 55 days, free tier for 1 day.
> - Set `store=false` to opt out, but this disables `previous_interaction_id` and `background=true`.

There is no cost-disclosure requirement anywhere in the original (pricing appears once, as a topic inside a linked doc page), and no data-residency content at all. The draft states these as things the owner requires, which they are not.

### 2.3 "Concision is desirable but is *explicitly* subordinate" — a preference the owner never states
Draft §3.7:

> **Brevity of the local material.** Concision is desirable but is explicitly subordinate to points 1–2; the owner accepts a thin local summary precisely because the documentation is expected to be fetched.

The original never expresses brevity as a goal. Its single relevant sentence is causal, not aspirational:

> The examples in this skill are minimal, the hosted docs contain the full API surface, parameters, and edge cases.

That is a reason to fetch documentation, not a ranked quality. The word "explicitly" attributes to the owner a statement of preference and of ordering that does not exist in the source. The inverted-priority framing is also load-bearing in the draft — it is the stated justification for accepting a thin contract — so this is not a harmless flourish.

### 2.4 The `disabled: true` narrative asserts facts not in the record
Draft §6:

> The skill's declared metadata marks it as not enabled, **yet it is observed to load and be offered in sessions.** … the disablement flag expresses an intent for the skill to be inactive **that the host does not currently honour.**

The original record contains one datum: `disabled: true` in the frontmatter. Nothing in `original/` reports observed loading behaviour or host non-compliance. The draft presents an empirical claim about a runtime it has not documented, then builds a binding instruction on top of it ("must not rely on the disablement flag to suppress activation"). See also §3.3 below — the substantive problem is not only that the evidence is absent but that the conclusion inverts the one setting the owner actually wrote down.

### 2.5 Over-broad ban on retired identifiers "in recommendations"
Draft §4: "Only currently supported model, agent, and client-library identifiers may appear in produced code **or recommendations**"; §5: "Produce, **recommend**, or leave in place a retired model identifier".

The original's migration workflow *requires* naming retired identifiers to the user — the deprecation mapping table, the "Replaced `gemini-2.0-*` model strings" checklist items, and the note-the-substitution rule all involve telling the user which retired identifier was found and what replaced it. Read literally, the draft forbids the very communication the original mandates. Minor as an ambiguity of drafting, but it is a real conflict on the page.

---

## 3. MISLABELED

### 3.1 "Active legacy" models: a recommendation promoted to a prohibition
The original draws a deliberate two-tier distinction. Deprecated models — "Deprecated | `gemini-3.5-flash`" — must be replaced. A second, separately headed table is **"Active Legacy Models (migration recommended)"**, containing `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-flash-preview`, and the checklist phrases every one of these as an option:

> - [ ] **Consider upgrading** `gemini-2.5-flash` → `gemini-3.5-flash`

against the mandatory phrasing used one section earlier ("Replaced `gemini-2.0-*` model strings"). The `[TUNE]` vs `[BLOCKS]` tagging encodes the same split.

The draft collapses both tiers into hard constraints and prohibitions: §4 "Only currently supported … identifiers may appear", §5 "Produce, recommend, **or leave in place** a retired model identifier". A conversion that leaves `gemini-2.5-pro` in place — permitted by the original, since upgrading it is a recommendation — is a must-never violation under the draft.

The original is genuinely self-contradictory here: SKILL.md says "Models like `gemini-2.5-*` … are **legacy and deprecated**. Never use them", while migration.md classifies the same family as active with upgrades merely recommended. A faithful contract should surface that conflict, as the draft does elsewhere for the enablement flag. Instead it silently resolves it in the stricter direction and presents the result as settled.

### 3.2 An informational note promoted to a hard constraint and a must-never
The store/retention facts appear in the original under "Important Additional Notes" as things the assistant should know; there is no instruction to disclose them to the user. The draft elevates this to a success criterion (§2), a hard constraint (§4 "Retention, storage, and tier-dependent defaults must be stated accurately when they bear on the user's decision"), a ranked quality (§3.5), and a must-never (§5). Disclosure is a reasonable inference from the material, but the draft presents an inferred obligation with the same force as the original's explicit `MUST`s, and does not mark it as inferred — which it does do, correctly, for the documentation-fetch method in §3.2.

### 3.3 A declared owner setting demoted to an artifact to be worked around
`disabled: true` is the only piece of the original written in the machine-readable, owner-controlled configuration surface. The draft reclassifies it as an ineffective expression of intent and instructs implementers to disregard it as an activation control (§6). Whatever the runtime truth, this converts an explicit owner setting into a non-binding remark, and it is the largest single reinterpretation in the draft. A faithful contract should carry the flag forward as a requirement of record and note the tension, rather than adjudicate it.

---

## 4. LEAKED MEANS

The draft's §4 hard constraints include three items that are not owner requirements about *outcomes* but verbatim-in-substance carryovers of the original's local summary content, re-frozen as contract:

- "Capability preconditions must be honoured (e.g. that certain execution modes require an explicit long-running or provisioned-environment setting …" — this is `background=True` for agents and `environment="remote"` for managed agents, abstracted only by paraphrase.
- "… and that opting out of one platform default disables the features that depend on it)" — this is precisely, and only, `store=false` disabling `previous_interaction_id` and `background=true`.
- "Settings whose lifetime is per-request rather than per-session must be re-supplied on every request" — this is the interaction-scoped `tools` / `system_instruction` / `generation_config` note, preserved down to its structure.

The leak matters for a specific reason internal to this skill. The original's controlling instruction is that the bundled material is *not* the API surface —

> **You MUST fetch the matching page below before writing code.** These hosted docs are the source of truth for parameters, types, and edge cases — do not rely solely on the examples above.

— and the draft itself ranks that deference at #2 and forbids treating local material as authoritative (§5). Promoting three particular sentences of that deliberately-partial local summary into permanent hard constraints does the opposite: it pins the contract to one snapshot of a surface the owner has declared volatile, and it does so selectively (three facts survive; the response-helper properties, step taxonomy, streaming event sequence, and status values do not, with no stated principle for the cut).

Secondary leak: **"Support is equivalent across both officially supported language ecosystems"** (§2) and "Both supported language ecosystems" (§4) hardcode the cardinality *two*. That is a property of the current SDK lineup, not of the owner's requirement, which is better stated as parity across every officially supported ecosystem. It also interacts with finding 1.1 — the count of two is what makes REST invisible.

---

## 5. FINGERPRINTS

Distinctive content in the draft that identifies which skill — and in several cases which *version* of it — produced the output:

| Draft text | What it reveals |
|---|---|
| §6, the entire "**Ambiguity of record — enablement**" paragraph | Uniquely traceable to `disabled: true` in this skill's frontmatter. No other detail in the draft is as identifying: it discloses a specific metadata key's presence, its value, and the drafter's reasoning about it. |
| §4 "opting out of one platform default disables the features that depend on it" | A near-unique signature of `store=false` → `previous_interaction_id` + `background=true`. The one-default-disables-two-features shape is specific to this API version. |
| §4 "certain execution modes require an explicit long-running or provisioned-environment setting" | `background=True` + `environment="remote"`; identifies the managed-agent design of this release. |
| §4 "Settings whose lifetime is per-request rather than per-session must be re-supplied on every request" | The interaction-scoped `tools`/`system_instruction`/`generation_config` note, structurally intact. |
| §4 / §2 "both officially supported language ecosystems" | Pins Python + TypeScript and the count two — a lineup fact of this SDK generation. |
| §6 trigger enumeration: "text generation, multi-turn dialogue, multimodal understanding, media generation, incremental/streamed responses, long-running or delegated tasks, tool invocation, schema-constrained output" | Tracks the frontmatter `description` item-for-item and in the same order (text generation → multi-turn chat → multimodal understanding → image/video generation → streaming → background research → function calling → structured output). The ordering is the tell, not the vocabulary. |
| §1 / §6 "the platform's prior-generation interface", "prior interface or prior model generation" | The two-axis `generateContent` → Interactions *plus* model-generation split, which is this skill's specific framing. |
| §4 "Retention, storage, and **tier-dependent** defaults" | The paid-vs-free retention split (55 days / 1 day) — a version-specific commercial fact. |
| §3.6 capability list ending in "long-running/managed execution" | "Managed" is this platform's term of art for its hosted-sandbox agents. |

Non-fingerprints, for contrast: the draft correctly declined to carry the three-option scope menu, the `rg` sizing command, model and agent identifier strings, SDK package names and version numbers, doc URLs, and the `[BLOCKS]`/`[TUNE]` tag names — that last one abstracted well as "changes that block correct behaviour … and quality-only changes must be distinguishable".

---

## 6. VERDICT

**REVISE.**

The draft is competent and gets the central thrust right — currency over recalled knowledge, documentation deference as a genuine requirement rather than an optimisation, scope consent, conversion completeness. But it does not clear the bar for a faithful contract:

1. **A safety rule is materially weakened.** The scope-confirmation gate is retriggered on file count instead of scope ambiguity (2.1), which permits exactly the behaviour the original's bolded rule exists to prevent.
2. **Required work is missing.** Model-generation upgrades that must drop `temperature`/`top_p`/`top_k` and rename `thinking_budget` (1.2), and the REST endpoint plus `Api-Revision` header (1.1), are both mandatory in the original and unreachable from the draft.
3. **A requirement tier is erased.** "Active Legacy (migration recommended)" and its `[TUNE]` counterparts become must-nevers (3.1), and the original's internal contradiction on `gemini-2.5-*` is resolved silently rather than surfaced.
4. **Content is invented.** Cost and data-residency duties (2.2), a brevity preference described as "explicit" (2.3), and observed host behaviour around the disablement flag (2.4) are all attributed to an owner who said none of them.
5. **Fingerprints are substantial.** The enablement paragraph and the store/background precondition pair would let a reader identify both the skill and its release.

Findings 2.1, 1.2, and 3.1 each change what a compliant implementation would do, and 2.4/3.3 together invert the disposition of the one setting the owner encoded machine-readably. That is well past "trivial issues".

**Priority order for revision:** 2.1 → 1.2 → 3.1 → 1.1 → 2.4/3.3 → 2.2/2.3 → §5 fingerprints → 1.3/1.4 → §4 leaks.
