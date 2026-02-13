# Race Portrait QA Rubric (Canonical)

Use this rubric for every QA batch decision. If evidence is unavailable, mark unknowns as `null` and use `pending` statuses instead of guessing.

## 1) Visual Checklist Definitions

- `isSquare`
  - `true`: image is 1:1.
  - `false`: image is not 1:1 (letterboxed/wide/tall mismatch).
  - `null`: cannot determine from available evidence.

- `isFullBody`
  - `true`: full character visible head-to-toe (feet/boots included) with ground context.
  - `false`: cropped body (missing head/feet/significant limbs) or framing fails full-body intent.
  - `null`: cannot determine.

- `isEdgeToEdge`
  - `true`: background fills full frame edge-to-edge; no white/blank borders.
  - `false`: visible white/blank border, letterboxing, or canvas margin.
  - `null`: cannot determine.

- `isSliceOfLife`
  - `true`: mundane daily-life activity, clear non-combat context.
  - `false`: heroic/combat/magical showdown framing or non-mundane action dominates.
  - `null`: cannot determine.

- `isCivilian`
  - `true`: practical civilian attire; no armor/weapons/military regalia.
  - `false`: armor, weapon, overt military/heroic gear present.
  - `null`: cannot determine.

- `hasArrowsArtifact`
  - `true`: arrow artifact present (including malformed double-feather arrow behavior).
  - `false`: no arrow artifact visible.
  - `null`: cannot determine.

## 2) `visualStatus` Decision Rule

- `approved`:
  - Set only when all required visual criteria are satisfied:
    - `isSquare=true`
    - `isFullBody=true`
    - `isEdgeToEdge=true`
    - `isSliceOfLife=true`
    - `isCivilian=true`
    - `hasArrowsArtifact=false`
- `rejected`:
  - Set when any hard-fail criterion is known false (or arrow artifact known true).
- `pending`:
  - Use when evidence is incomplete, unavailable, or conflicting.

## 3) Uniqueness Model (Text-First)

Uniqueness is evaluated against canonical activity text, preferring `targetActivity` if provided, otherwise observed activity.

- `unique`: activity is not duplicated among current rows.
- `keeper`: this row is the single selected keeper for a duplicated activity cluster.
- `non_keeper`: row is duplicated and not selected as keeper.
- `pending`: insufficient information to classify uniqueness.

Keeper preference order:
1. Higher `likelyScore`
2. Better visual confidence/status (`approved` > `pending` > `rejected`)
3. Regenerated row preference
4. Newer `downloadedAt`
5. Stable deterministic tie-break

## 4) `manualReviewRequired` Rules

Set `manualReviewRequired=true` when:
- `visualStatus=approved` AND `uniquenessStatus=non_keeper`, or
- evidence is ambiguous but a high-impact decision is being deferred.

Otherwise set `false`.

## 5) `likelyScore` and `likelyReason`

`likelyScore` must be `1..5` or `null`.

- `1`: strongly implausible for race/culture.
- `2`: weak fit.
- `3`: plausible generic mundane activity.
- `4`: good fit with race/cultural flavor.
- `5`: highly fitting and lore-consistent.

`likelyReason` should include a brief explanation and confidence tag:
- `[official]` canonical/source-backed
- `[mixed]` partial official support + interpretation
- `[community_inferred]` community testimony fallback

Research policy:
- official material first;
- if inconclusive, community fallback is allowed with explicit confidence tag.

## 6) `targetActivity` Guidance

- Set a concrete, singular activity phrase where possible.
- Avoid overly generic placeholders.
- Prefer activities that improve uniqueness without violating visual/lore constraints.

## 7) `notes` Format

Use short structured notes:
- Pass: `"Pass: <why>"`
- Reject: `"Reject: <why>"`
- Pending: `"Pending: <missing evidence/decision blocker>"`

## 8) No-Guess Rule

If an image cannot be inspected in the current run:
- keep checklist fields `null`,
- keep or set `visualStatus=pending`,
- avoid speculative pass/fail decisions.
