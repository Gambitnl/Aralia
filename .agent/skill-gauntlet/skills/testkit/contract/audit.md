# Audit — `draft-contract.md` vs `original/` (skill: testkit)

Scope: `original/SKILL.md`, `original/workflows/{troubleshoot,perf,smoke}.md` compared against
`draft-contract.md`. Line citations are to the original files unless stated otherwise.

The draft is well-scrubbed of proper nouns and tool names and gets the large shape right
(evidence-not-fixes, freshness gating, screenshot-as-pass-condition, consent for recovery,
isolated browser). The problems are concentrated in the *acceptance criteria*: the draft
repeatedly says a judgement must be made without saying what the owner's bar for that judgement
is, and it drops several substantive requirements about what a run must contain and must not do.

---

## 1. OMITTED

### 1.1 The pass/fail bar itself (high severity)

Draft §2 requires "a clear pass/fail judgement" but never states what fails. The original defines
it exactly (`smoke.md:30`):

> "Mark pass/fail: fail = freshness gate failed, OR ready signal never appeared, OR any console
> error, OR no screenshot captured."

Three of these four conditions appear nowhere in the draft as failure conditions — most
importantly **"any console error"**. Under the draft, an implementer could reasonably report a
surface with two console errors as "pass, with notes". That is a different product from what the
owner specified.

### 1.2 The readiness marker (high severity)

The concept of a per-surface *ready signal* is entirely absent from the draft. The original makes
it structural: `smoke.md:6` gives it its own column ("Ready signal" — "atlas SVG rendered",
"commuters moving", "combat HUD visible"), `smoke.md:22` requires `wait_for` the ready signal with
a "10 s budget — longer for world3d first load", and `perf.md:8` requires opening the surface and
waiting "for its rendered-ready marker" *before* measuring.

Without it, "the surface came up" has no owner-defined meaning, and the timing measurements have no
defined start point.

### 1.3 Warm-up excluded from measurement (medium)

`perf.md:8-9`: "open the surface in a fresh page and wait for its rendered-ready marker. **This
warm-up is not part of the measurement.**" The draft's measurement-validity constraint covers only
contamination by navigations/reloads/aborts (§4), not first-load cost bleeding into the reported
number. These are different failure modes.

### 1.4 The accessibility/best-practices audit, and the ban on running it on WebGL (high)

`perf.md:33` requires, for 2D surfaces only, running an audit and recording "the category scores it
returns (accessibility, best practices — it excludes performance scoring)". `perf.md:46` states the
matching prohibition: "**Do not run Lighthouse on WebGL surfaces; its metrics are meaningless
there.**"

Neither the required deliverable nor the prohibition survives into the draft. The prohibition in
particular is a "must never" in the original's own voice — producing a meaningless score against a
GPU-rendered surface is exactly the "wrong-but-confident result" the draft's §3.1 claims to rank
above everything else, yet the draft never names it.

### 1.5 Disclosure of interventions before capture (medium-high)

`smoke.md:27`: "Dismiss any blocking modal or overlay (e.g. the Ollama Dependency dialog) before
capturing, **and record which modals you dismissed**."

The draft has nothing on this. It is an evidence-integrity requirement: the captured image shows a
state the agent itself altered, and the owner requires that alteration to be on the record. The
draft's §4 "Probing the running app is read-only" arguably *contradicts* this permitted interaction
(see §2.3 below).

### 1.6 Concrete regression thresholds and the required metric set (medium-high)

Draft §4 says only: "Regression thresholds are defined per metric class and applied consistently."
The original fixes the values (`SKILL.md:77-78`):

> "`consoleErrors` regresses on any increase; `heapMB` on +15%; every other numeric metric on
> +20%."

and fixes the recorded shape (`SKILL.md:66-75`): `consoleErrors`, `heapMB`, `lcpMs`,
`longTasksMs` per surface. `perf.md:30-31` additionally requires recording "LCP (load traces),
total long-task time, and the top insight findings", and `perf.md:32` requires heap sizes "before
the interaction and after; record both sizes in MB".

Thresholds and the metric list are owner requirements, not implementation detail — they are the
definition of "regression". A contract that omits them cannot be used to check whether a run
complied. Note also that the draft's own §3.4 demands thresholds "stay stable" while declining to
say what they are.

### 1.7 Network evidence in defect investigations (medium)

`troubleshoot.md:14-15` requires `list_network_requests` and to "flag failed requests, 4xx/5xx, and
missing chunks", and the output section (`troubleshoot.md:27-28`) names it as a required report
element: "reproduction steps, verbatim error(s), the narrowed trigger, **network evidence**, and the
screenshot."

Draft §2 renders this as "reproduction steps, the narrowed trigger, and supporting evidence" —
network evidence is absorbed into an unnamed generic. Failed requests and missing chunks are a
named deliverable, not an optional extra.

### 1.8 Heap-growth analysis as a named output (medium)

`troubleshoot.md:20-21`: "compare retained sizes, **name the biggest growers**"; `perf.md:33`:
"Growth after the scene is settled = leak candidate." The draft mentions "memory" once, in §1
scope, and never states that a memory investigation must produce an identified growth candidate.

### 1.9 Interpretation of the top performance insight (low-medium)

`perf.md:37-38`: "Report the baseline diff output verbatim, **plus your reading of the top
insight**." The draft captures the verbatim-diff half (§2) and drops the analysis half. This matters
because the draft elsewhere frames the product as pure evidence ("Its product is evidence and a
comparison … not fixes", §1), which reads as excluding the interpretation the owner asks for.

### 1.10 Escalation offer on failure (low-medium)

`smoke.md:42`: "If a surface fails, offer to switch to `workflows/troubleshoot.md` on it." The
draft not only omits this, its §6 leans the other way — "It must also not extend itself into fixing
what it finds … without a separate explicit request." Offering the next step is required; taking it
unasked is not. The draft preserves only the prohibition.

### 1.11 Smaller omissions

- **Warnings, not just errors.** `troubleshoot.md:13`: "record every error/warning verbatim." The
  draft's §2 and §5 speak only of "errors".
- **Relevance of the freshness probe target.** `smoke.md:19-20` requires the agent to "choose a
  source file relevant to this smoke run"; `SKILL.md:25-26` "name one repo-relative source file
  that should be current". The draft's "what it serves matches the current source" (§4) loses the
  requirement that the probed module be *relevant*, which is what makes the check meaningful rather
  than ceremonial.
- **One surface per trace** (`perf.md:41`) — a measurement-validity rule, not an efficiency note.
- **Third known gotcha.** `SKILL.md:86-87`: "The player's streamed cell is not the town cell — town
  identity comes from `groundTownBurgs`." The draft's catch-all (§4, "known benign runtime artifacts
  … and known non-default entry conditions") covers the StrictMode and dummy-combat gotchas but not
  this one, which is a domain-model misreading trap, not a framework artifact or entry condition.
- **The surface list is owner-maintained.** `smoke.md:4`: "Edit this table to add or retire
  surfaces." The draft treats the sweep set as fixed.

---

## 2. DISTORTED

### 2.1 "Every reported observation demonstrably came from the current checkout" (§2, §4)

Overstated. The original's gate is narrower and specific: liveness of the base page, plus one
cache-busted module compared by SHA-256 against the checkout (`SKILL.md:27-33`). It verifies *one
named file*, not the whole checkout. The draft promises a guarantee the specified check does not
deliver, which would license an implementer to claim more than the evidence supports — an
evidence-integrity inversion given §3.1.

### 2.2 "There is no degraded fallback path" (§4) vs the required capture fallback (§4)

Within the draft these two bullets sit three lines apart and appear to conflict. The original keeps
them cleanly separated by subject: *no fallback* applies to the server and the browser-control
capability (`SKILL.md:24`: "If it will not start or the chrome-devtools MCP tools are unavailable,
STOP and say so — no fallback path"), while *a fallback is expected* for the screenshot path
specifically (`SKILL.md:46-47`: "if `take_screenshot` stalls, fall back to the repo's shoot.mjs rig
or a rAF readback, and say which you used"). The draft's phrasing does not scope the "no fallback"
rule, so it reads as a contradiction rather than two rules about different things.

### 2.3 "Probing the running app is read-only" (§4) stated without its exception

The original's read-only rule is scoped to state probes: `troubleshoot.md:17-18` — "read-only
probes; do not patch the page to 'fix' it". It coexists with *required* page interaction: driving
clicks/keys (`troubleshoot.md:19`, `perf.md:26`) and dismissing blocking modals (`smoke.md:27`). The
draft's unscoped "Probing the running app is read-only" conflicts with the interaction the skill is
built to perform, and — combined with omission 1.5 — could be read as forbidding modal dismissal.

### 2.4 Activation exclusions that the original never states (§6)

The original's activation surface is one sentence (`SKILL.md:3`): "Use when testing or diagnosing
Aralia in a real browser — bug troubleshooting, performance/memory checks, or smoke passes over the
key game surfaces." The draft's "Must stay silent" list — code review, refactoring, design
discussion, unit/integration/CLI suites, build/packaging/deployment, production or shared
environments — is authored, not derived. The dev-server-only and browser-only inferences are
defensible; the rest is invention presented as contract.

### 2.5 Ranked qualities are an authored artifact (§3)

The original contains no ranking. "This outranks everything else: a wrong-but-confident result is
worse than no result" (§3.1) and the specific ordering of items 2–6 are the draft author's. The
ordering is broadly consistent with the original's emphases, so this is low-severity — but it is
presented as the owner's priority stack when the owner never expressed one, and §3.6 ("Efficiency")
is built out of two operational notes (`perf.md:41-42` "keep interactions short (10–20 s)";
`smoke.md:22` "10 s budget").

---

## 3. MISLABELED

**Requirements demoted to preferences / soft language:**

1. **Regression thresholds** — a hard, numeric definition in the original (`SKILL.md:77-78`)
   becomes the unfalsifiable "defined per metric class and applied consistently" (draft §4). As
   written this constrains nothing.
2. **"Do not run Lighthouse on WebGL surfaces"** (`perf.md:46`) — an explicit prohibition, absent
   from the draft's §5 "Must never" where it belongs.
3. **"Send ALL screenshots to the user"** (`smoke.md:36`, emphasis original) — the draft's §2
   softens to "for anything visual — an image captured … and delivered to the user", losing the
   *all*/*every surface* quantifier that the original stresses ("they eyeball every visual
   surface").
4. **Recording which modals were dismissed** (`smoke.md:27`) — a stated requirement, dropped
   entirely rather than demoted (see 1.5).
5. **Interpretation of the top insight** (`perf.md:38`) — required output, dropped (see 1.9).

**Preferences promoted to requirements:**

6. **"the recorded shape and the regression thresholds must stay stable"** (draft §3.4). The
   original says the opposite about the sweep set (`smoke.md:4`, "Edit this table to add or retire
   surfaces") and never commits to schema stability; it is a rationale the draft invented and then
   elevated.
7. **"Efficiency"** as a ranked contract quality (draft §3.6) — in the original these are two
   local operational notes about trace weight and wait budgets, not a standing value.
8. **"Contamination is itself reportable as a finding about instability"** (draft §4) — the
   original says "Treat that as churn evidence, not as a performance measurement"
   (`perf.md:28-29`), i.e. a reclassification of what you have, not an affirmative new reporting
   obligation. Mild over-hardening.

---

## 4. LEAKED MEANS

The draft is mostly clean of tool names, but several bullets carry the original's *procedure* rather
than its *outcome*:

1. **The two-part preflight structure** (§4): "confirm both that the server answers and that what it
   serves matches the current source. Either check failing is a hard stop." This is the
   liveness/freshness split of the `WF-G30` probe (`SKILL.md:30-33`, `LIVENESS_FAILURE` /
   `FRESHNESS_FAILURE`) restated one abstraction level up. The owner requirement is "no artifact may
   be produced from a stale or dead server"; the paired-check decomposition is how this
   implementation achieves it.
2. **"Console/state readings must follow a fresh navigation or reload"** (§4). The outcome is the
   second half of the same sentence ("readings … that may predate the action are not acceptable
   evidence"); "navigate or reload first" is the prescribed technique (`SKILL.md:41-42`), and it
   silently excludes other ways of guaranteeing buffer freshness — including the original's own
   alternative for 3D scenes (`SKILL.md:42-43`: "For World3D issues use the in-page deterministic
   replay recipe instead").
3. **"If the primary capture path fails, an alternative may be used"** (§4) encodes the specific
   primary→fallback chain (`take_screenshot` → shoot.mjs rig → rAF readback, `SKILL.md:45-47`). The
   outcome requirement is only: a real image, plus disclosure of how it was obtained.
4. **"the project's persistent result format"** and **"the stored reference values"** (§2) carry the
   run-JSON-file + baseline-tool + `--promote` pipeline (`SKILL.md:48-51`, `perf.md:35-38`) as a
   mandated mechanism. The outcome is comparability across runs and no silent reference update.
5. **"receipts"** in "images, result files, receipts" (§4) is the watchdog's logging vocabulary
   (`SKILL.md:60-62`, "Probe and restart receipts append to …"), not a general artifact category.
6. **"the three jobs" / "which of the three jobs"** (§1, §6). The count of three is the skill's
   internal mode structure (`SKILL.md:12-15`, `troubleshoot | perf | smoke`). An
   implementation-neutral contract states that the target and kind of investigation must be
   disambiguated before work begins — not that there are exactly three named jobs.
7. **"the project's sanctioned launch mechanism, never by ad-hoc shell invocation"** (§4) — the
   genuine requirement is that the app is started in the project's supported configuration and that
   the run does not improvise process management. "Never by shell" is the original's specific
   prohibition (`SKILL.md:23`, "never via Bash") reworded, and it would forbid a compliant
   shell-based launcher if the project had one.

---

## 5. FINGERPRINTS

Distinctive residue that could identify which skill — and which *version* of it — produced the
draft:

1. **"Knowing a port or process identifier does not confer permission to act on it."** (§4) —
   near-verbatim of `SKILL.md:53-54`: "A worker must not restart a server merely because its port or
   PID is known." Same argument, same two identifiers, same order.
2. **"Live modification of page state to make something appear to work is prohibited; corrections
   belong in source"** (§4) — near-verbatim of `troubleshoot.md:17-18`: "do not patch the page to
   'fix' it — fixes go in source."
3. **"There is no degraded fallback path"** (§4) — echoes `SKILL.md:24`: "STOP and say so — no
   fallback path."
4. **"the three jobs"** (§1, §6) — leaks the mode count. A revision of this skill with two or four
   modes would not produce this phrasing; it dates the output to a three-mode version.
5. **"receipts"** (§4) — an unusual word for run artifacts, unique to this skill's watchdog logging
   (`SKILL.md:60-62`).
6. **"known non-default entry conditions"** (§4) — a distinctive euphemism whose referent is the
   `?dummy=1&dev_combat=1` one-shot entry (`SKILL.md:85`, `smoke.md:12`, `perf.md:10`); it names a
   trait the original's gotcha list has and generic browser-test skills do not.
7. **"Contamination is itself reportable as a finding about instability"** (§4) — a paraphrase of
   the original's idiosyncratic "churn evidence" framing (`perf.md:28-29`).
8. **Section 1's title, "browser-runtime test/diagnosis skill"**, plus the tri-part scope sentence
   ordered defect → cost → sweep, mirrors the mode table's order (`SKILL.md:13-15`).
9. Structural tell: the draft carries the original's *scope* fingerprints while stripping its
   *numbers*. A contract that names "regression thresholds … per metric class" but never the
   percentages is recognizably a redaction of a document that had them.

Clean: no project name, no tool/MCP names, no file paths, no port numbers, no threshold values, no
surface names. The leaks above are phrasal and structural rather than nominal.

---

## 6. VERDICT

**REVISE.**

The draft is faithful in posture and mostly clean in vocabulary, but it is not usable as an outcome
contract in its current form. Three defects are individually disqualifying:

- **The acceptance bar is missing.** "Pass/fail judgement" (§2) with no failure conditions, and
  "regression thresholds … per metric class" (§4) with no thresholds, mean two conforming
  implementations can disagree about whether the same run passed. `smoke.md:30` and `SKILL.md:77-78`
  state both precisely; the draft's abstraction removed the content, not the mechanism.
- **A stated prohibition was dropped.** `perf.md:46` ("Do not run Lighthouse on WebGL surfaces; its
  metrics are meaningless there") has no counterpart in §5, despite §5 being the draft's inventory
  of prohibitions and §3.1 ranking exactly this failure mode first.
- **An unscoped rule contradicts required behaviour.** "Probing the running app is read-only" (§4),
  taken with the omission of `smoke.md:27`, forbids the modal dismissal the smoke sweep requires and
  drops the obligation to disclose it.

Secondary but substantive: the missing ready-signal concept (1.2), warm-up exclusion (1.3), network
evidence (1.7), heap growth candidates (1.8), and the "send ALL screenshots" quantifier (3.3).

Minimum fixes to reach PASS: restore the four failure conditions; restore the numeric thresholds and
the required metric set; restore the readiness-marker requirement and warm-up exclusion; add the
WebGL-audit prohibition to §5; scope the read-only rule to state probes and add the
intervention-disclosure requirement; restore network evidence and named heap growers as required
outputs of a defect investigation; restore the escalation offer; and scope "no fallback path" to
server/capability availability so it stops contradicting the capture-fallback bullet. Separately,
re-abstract the leaked means in §4 (items 1–3, 7) and drop or attribute the invented exclusions in
§6 and the ranking rationale in §3.
