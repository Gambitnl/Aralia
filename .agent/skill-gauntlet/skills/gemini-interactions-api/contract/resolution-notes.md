# Resolution notes

Findings accepted and fixed: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3,
§4 leaks (primary and secondary), and the §5 fingerprint rows except those listed below.
1.5 is accepted in part. Rejections and partial rejections follow.

## Rejected

**1.5 — `thought` steps have a required `signature` field.** Rejected. This is a single
field name from one step type in the bundled summary; encoding it as a contract clause is
exactly what the audit itself condemns in §4 (leaked means) and §5 (fingerprints), and it
would pin the contract to one snapshot of a surface the owner declares volatile. The
generalised §4 clause ("preconditions … established from that live documentation") plus §2's
feature-correctness criterion already reach it, via the route the owner intended.

**1.5 — speech/TTS and music as separately named capability areas.** Accepted only in the
weak form. Naming them as distinct areas would carry a version-specific product lineup into
the contract. §3.6 and §6 were instead broadened to generation and interpretation "across
text and other output modalities" / "in any modality", which covers audio out without
freezing the current roster.

**§5 fingerprint — "tier-dependent" defaults.** Rejected. The identifying facts are the
retention durations and the paid/free split, and the draft never contained them. That a
platform's storage defaults vary by account plan is generic across hosted APIs, and dropping
it would lose a real disclosure requirement. Retained, with "account plan" wording.

**§5 fingerprint — the two-axis "prior interface / prior model generation" framing.**
Rejected, and it is in direct tension with finding 1.2. The audit's own strongest omission
finding exists *because* interface migration and model-generation upgrade are separate work
with separate breaking changes. That distinction is a structural requirement, not a version
fact, and removing it would reintroduce 1.2. Kept and made explicit in §1.

## Notes on how two accepted findings were reconciled

**3.3 vs. §5.** 3.3 asks that the declared inactive setting be carried forward as a
requirement of record; §5 identifies the draft's paragraph about it as the single most
identifying passage. Both are honoured: the setting is carried forward and left
unadjudicated, but described as "machine-readable configuration" without naming the key, its
literal value, or the drafter's reasoning about the host.

**2.4 / 3.3.** The draft's empirical claims — that the skill is observed to load and that the
host does not honour the flag — are removed outright; nothing in `original/` records runtime
behaviour. The section is retitled from "Ambiguity" to "Conflict of record" and states that
the record does not resolve which governs.

**2.3.** The brevity quality (draft §3.7) is deleted rather than reworded. The owner's one
relevant sentence is causal — the local examples are minimal, so fetch the docs — and that
content already lives in ranked quality #2. Nothing needed a replacement clause.
