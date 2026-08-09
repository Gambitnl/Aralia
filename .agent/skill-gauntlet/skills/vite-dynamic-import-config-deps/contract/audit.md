# Audit: `draft-contract.md` vs. `original/SKILL.md` (`vite-dynamic-import-config-deps` v1.0.0)

Scope of the comparison: the original is a 91-line skill with frontmatter (name/description/version),
a Problem statement, Trigger Conditions, a Solution with before/after code and a 3-step recipe, a
Verification section with console output, five Notes, and a References link. The draft is a six-section
outcome contract. Findings below are ordered by severity within each category.

---

## 1. OMITTED

**O1. The authoritative reference is gone with no replacement obligation.** The original closes with:

> `## References`
> `- [Vite Config Dependencies](https://vite.dev/config/#config-dependencies)`

The owner shipped a pointer to the upstream documentation of the very mechanism the skill explains.
The draft's Quality 4 requires that "the developer learns the general rule," but nothing in Success,
Hard constraints, or Qualities requires grounding that explanation in the tool's own documented
behavior. For a skill whose stated scope is "Covers **why** Vite watches config dependencies," dropping
the citation drops a real part of the deliverable.

**O2. "Full server restart" as the named mechanism.** The original is emphatic — "Vite does a **full
server restart**" — and the trigger list separately calls out "A stateful resource (PTY, WebSocket, DB
connection) is killed by the restart." The draft's §1 conveys the consequence ("destroys long-lived
server-side state") but never states that the distinguishing signature of this problem is a *process-level
restart of the server*, as opposed to a reload or a re-evaluation. That distinction is what lets a
developer tell this failure apart from the others §6 says to stay silent about, and it is load-bearing
for diagnosis (Quality 1).

**O3. Minor — the "or nothing" outcome.** Original Verification: "Vite will only show HMR updates
**(or nothing)**." The draft renders this as "at most the normal, non-restart update behavior occurs,"
which is a fair paraphrase of the HMR half but blurs the owner's point that *complete silence* is an
equally correct result. Given that §5 forbids misreporting the verification signal, a developer told to
expect "update behavior" could read silence as a failed observation. This is close to trivial, but it is
the one place the draft's abstraction loses a concrete pass condition.

Nothing else material is missing: the transitive-watching rule, the async-handler requirement, the
extension/resolution tip, the one-unavoidable-restart caveat, the HMR/config-watching distinction, and
the module-caching cost note all have counterparts in the draft.

---

## 2. DISTORTED

**D1. The skill is scoped to Vite; the draft is scoped to a class of build tools.** The original is
Vite-specific in name, description, every code sample, the `vite.config.ts` path, the `connect`-style
middleware claim ("connect-style middleware supports async functions in Vite's dev server"), the Node.js
caching claim, and the reference link. The draft's §6 activates on any "project whose dev server restarts
on changes to a file, and the evidence points at the build tool's configuration dependency graph," and
only excludes projects that "do not use a build tool with this configuration-dependency watching
behavior." That is a genuine widening: the owner validated three supporting facts (async connect
middleware is accepted, `import()` is Node-cached, the extension convention) *for Vite*, and none of them
are underwritten for an arbitrary tool that happens to watch its config graph. Removing the vendor name
is legitimate de-fingerprinting; silently promoting the guidance to tool-agnostic is not the same
operation, and the draft does the second while presenting it as the first.

**D2. The resolution constraint is given the wrong rationale.** Original Note:

> "Use `.ts` extension in the dynamic import path **to match the other dynamic imports in your vite
> config** (e.g. `await import('./scripts/foo.ts')`)"

The owner's stated reason is *internal consistency with the config's existing imports*. The draft
converts this into a correctness claim: "**Module resolution must succeed at runtime** in the dev-server
environment — the reference to the deferred module has to match the resolution conventions already in
use in that config." The original never asserts that a non-matching specifier fails to resolve. The draft
asserts a failure mode the owner did not claim, and attaches a hard constraint to it.

**D3. §5 invents a failure mode on the config-edit restart.** Draft: report "the unavoidable config-edit
restart as evidence that the fix failed **or as evidence that it worked**." The original warns only
about the first reading ("vite.config.ts itself will trigger one restart (unavoidable — you changed the
config)"). The second half is a fabricated prohibition. Harmless in effect, but it is a draft statement
with no origin in the source.

**D4. Unsourced comparative value judgment.** Draft Quality 2: "A silenced restart with a broken or
intermittently failing route is a worse outcome than the original problem." The original contains no
ranking of failure modes and never raises intermittent failure at all. The conclusion is sane, but it is
the drafter's, presented as the owner's priority ordering.

**D5. Diagnosis-gating is an inference, not a source requirement.** Draft §2: "If the situation does not
actually match the diagnosis, the developer is told that, rather than having an unnecessary change made,"
and Quality 1 ranks this first. The original states trigger conditions but never instructs the skill to
report a negative diagnosis or to withhold the change. Making this the *top-ranked* quality reorders the
owner's emphasis, which by page-weight and structure sits on the conversion, the verification, and the
mechanism explanation.

---

## 3. MISLABELED

**M1. Promotion — a performance reassurance became a hard constraint.** Original Note (explanatory):

> "`await import()` is cached by Node.js after the first call — negligible perf cost on subsequent
> requests (it's just a resolved Promise, not a re-parse)"

Draft Hard constraint: "**Repeated request handling must not pay a significant repeated cost** for the
deferred load; relying on the runtime's module caching is acceptable and expected." The owner is
*answering an anticipated objection* — "won't this be slow?" — not imposing a performance budget the
result must meet. As a hard constraint it is also untestable as written ("significant") and, since it
simultaneously blesses the caching that guarantees it, self-satisfying.

**M2. Promotion — a style tip became a ranked quality plus a hard constraint.** The `.ts`-extension note
(one line, in Notes) is expanded into both Hard constraint 4 and Quality 6 ("Consistency with the
project's existing conventions in the config file, **so the result reads as if it had always been written
that way**"). The italicized clause has no source at all — the original never expresses an aesthetic goal.
One narrow instruction has been inflated into two contract obligations, one of them invented.

**M3. Defensible promotion — transitivity.** Original states transitivity as education ("This technique
applies to ANY file in your config dependency chain — transitively imported files are also watched, so if
`vite.config.ts` imports A which imports B, changes to B also restart the server"). The draft makes it a
hard constraint ("relocating one import is insufficient if the file is still reachable through another
chain"). This is an upgrade, but a correct one: a fix that leaves the file reachable fails the owner's own
Success test. Noted for completeness, not counted against the draft.

**M4. Demotion — the "why" is ranked below the fix.** The original's description makes the explanation a
co-equal deliverable ("Covers why Vite watches config dependencies **and** how to opt out"). The draft
ranks "Explanation of the underlying mechanism" 4th of 6 qualities. It is partially rescued by a §2
Success bullet, so the net effect is small — but the ranking understates it.

---

## 4. LEAKED MEANS

This is the draft's central defect. The contract states the skill's *technique* as the outcome, then
disclaims having done so.

**L1. The mechanism is the hard constraint.** Draft Hard constraint 1: "the module **must be loaded
lazily at request time rather than at configuration load time**. The exact syntax and structure used to
achieve this is not part of the requirement." The owner's actual requirement — recoverable from the
Problem and Verification sections — is that *the file is no longer in the config's dependency graph, and
editing it does not restart the server*. "Load it lazily at request time" is the skill's chosen route to
that end state, not the end state. Other end states satisfy the owner and are excluded by this clause:
moving the handler's logic out of the config's reachable set entirely, serving it from a separately
launched process, or restructuring so the config never references the module. The parenthetical concedes
the problem ("which constrains the class of acceptable methods") and then keeps the constraint anyway;
disclaiming *syntax* while mandating *strategy* is not implementation-neutrality.

**L2. Step 2 of the recipe survives verbatim in intent.** Original: "2. Make the middleware function
`async`". Draft Hard constraint 3: "Any handler converted to load its dependency lazily **must be made
capable of awaiting that load**, and must remain compatible with the server's handler contract." A
requirement to make handlers awaitable exists *only* if you have already decided the fix is an awaited
dynamic import. It is a consequence of the means, carried in as a constraint.

**L3. Step 3's path detail survives as a constraint.** Original: "3. Add `const { ... } = await
import('./path/to/file.ts')`" plus the `.ts` note. Draft: "the reference to the deferred module has to
match the resolution conventions already in use in that config." Presupposes a deferred module specifier,
i.e. presupposes the technique. (See also D2, M2.)

**L4. The fix's *location* is stated as a requirement.** Draft Quality 5: "The change should be confined
to **the config file and its handler(s)**." That is the original's edit surface — `vite.config.ts` and its
`configureServer` middleware. A genuine minimality quality would bound the *size and blast radius* of the
change without naming which files it lands in; naming them re-imposes the recipe.

**L5. Vocabulary imports the technique.** "Defer / deferred module" (§4 ×2, §5), "loaded lazily," and
"the runtime's module caching" are the implementation's terms of art. §5's "Defer a module that the
configuration genuinely needs during its own construction" only parses as a prohibition if deferral is
already the assumed method; the owner-level prohibition is "don't apply this when the config needs the
value at build time."

---

## 5. FINGERPRINTS

The draft is well scrubbed at the surface — no "Vite," no `vite.config.ts`, no `roadmap-server-logic`,
no "PTY," no "HMR" acronym. What remains is structural and would still identify the source:

**F1. The stateful-resource triple, in source order.** Original: "killing **WebSocket connections, PTY
processes**, and any other stateful server resources," plus "(PTY, WebSocket, **DB connection**)." Draft
§1: "**terminal sessions, socket connections, pooled handles**." Three items, one-to-one, same order as
the trigger list, each a thesaurus step from the original. A distinctive triple is a stronger signature
than any single word; an output carrying it points back at this skill.

**F2. The trigger list preserves the description's numbering order.** Original description enumerates
(1) the restart log line, (2) editing a script/utility file killing the dev server "and any connected
processes," (3) "statically imported in vite.config.ts but only used inside middleware route handlers."
Draft §6 reproduces all three in the same sequence: "restart messages naming a source file rather than
the config; edits to a utility or logic file killing the dev server or the stateful processes attached to
it; or a file that is imported eagerly by the config yet only actually used inside request handling."
Even the "utility" word choice and the "or logic file" hedge track the source.

**F3. The unavoidable-single-restart caveat.** The one-restart-after-editing-the-config carve-out appears
in draft §2, §4, and §5. It is a genuine requirement and cannot be dropped — but it is idiosyncratic
enough that its presence, combined with F1/F2, identifies the version rather than merely the topic.

**F4. Residual platform tells.** "request/route handling," "the server's handler contract," and "the
runtime's module caching" narrow the target to a Node-based dev server with connect-style middleware —
i.e. back to the original's platform, despite the vendor-neutral phrasing (compare D1: the draft claims
tool-agnostic scope while retaining tool-specific assumptions).

**F5. The HMR contrast, restated.** Original Note: "This is different from HMR ... HMR is for browser-side
modules; config dependency watching is server-side and causes full restarts." Draft §5: "Present the
change as affecting browser-side hot-update behavior, **or otherwise conflate the two mechanisms**."
The "two mechanisms" framing is a direct descendant of the note.

---

## 6. VERDICT

**REVISE.**

The draft is competent and covers most of the source's substance — its treatment of transitivity,
verification-as-deliverable, behavioral preservation, and the eager-dependency exclusion is accurate and
well-judged. But it fails on its own stated terms in two ways that are not trivial:

1. **It is not implementation-neutral (L1–L5).** Hard constraint 1 mandates the skill's technique —
   lazy loading at request time — and Hard constraint 3, Hard constraint 4, and Quality 5 each encode a
   step or a location of the original three-step recipe. The disclaimer that "the exact syntax and
   structure ... is not part of the requirement" waives the least important layer while the strategy
   layer is fixed.
2. **It is not faithful on scope and on requirement level (D1, M1, M2).** It broadens a Vite-specific
   skill to any config-watching build tool while retaining Vite-specific assumptions, converts an
   anticipatory performance reassurance into a hard constraint, and inflates a one-line style tip into
   both a constraint and a ranked quality with an invented aesthetic rationale.

Additionally, F1 and F2 mean an output produced from this contract would remain traceable to
`vite-dynamic-import-config-deps` v1.0.0, defeating a substantial part of the exercise.

**What a passing revision needs:**

- Restate Hard constraint 1 purely as an end state — the file is not in the config's dependency graph and
  editing it does not restart the server — and delete the "must be loaded lazily at request time" clause.
- Rewrite Hard constraint 3 conditionally: *if* the chosen approach makes a dependency's availability
  asynchronous, handlers must remain contract-compliant. Drop it as an unconditional obligation.
- Fold Hard constraint 4 into behavioral preservation (the fix must not break resolution) and drop the
  invented "reads as if it had always been written that way."
- Demote M1 from a hard constraint to a note that per-request overhead is expected to be negligible.
- Either restore the tool-specific scope or drop the tool-specific assumptions that came with it (D1).
- Re-derive §1 and §6's examples from the underlying failure rather than paraphrasing the source's lists
  (F1, F2); reinstate an obligation to ground the explanation in the tool's documented behavior (O1).
