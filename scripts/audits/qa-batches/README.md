# QA Batch Files

This folder stores per-batch review artifacts for race portrait QA.

## Files

- `*.input.json`
  - Produced by `scripts/audits/orchestrate-race-qa.ts --prepare`
  - Canonical batch payload for one review unit
- `*.prompt.md`
  - Reviewer prompt/template for the matching batch
- `*.output.json`
  - Reviewer/agent output using the merge contract
  - Merged via `scripts/audits/orchestrate-race-qa.ts --merge-dir` or `scripts/audits/mark-slice-of-life-qa.ts --merge-batch`
- `QA_RUBRIC.md`
  - Canonical grading rubric for all checklist/status decisions
- `qa-output.schema.json`
  - Strict output contract used by `codex exec --output-schema`

## Runner Modes

`scripts/audits/run-qa-batch-agent.ts` supports:

- `--mode template` (default): no API calls; generates a merge-ready template output file to fill during review.
- `--mode codex`: uses local `codex exec` with `--output-schema` and writes a validated `*.output.json`.
- `--mode openai`: calls OpenAI Responses API (requires `OPENAI_API_KEY`).

Example (Codex shell mode, no OpenAI API key):

```powershell
npx tsx scripts/audits/run-qa-batch-agent.ts `
  --input scripts/audits/qa-batches/<batch>.input.json `
  --mode codex `
  --rubric scripts/audits/qa-batches/QA_RUBRIC.md `
  --visual-evidence unavailable `
  --schema scripts/audits/qa-batches/qa-output.schema.json
```

`--visual-evidence` options:

- `available`: reviewer can inspect images and should apply full visual checklist scoring.
- `unavailable`: no-guess mode; checklist fields should stay `null` and visual decisions should not be invented.

## Expected Output Contract

```json
{
  "batchId": "2026-...-r001",
  "entries": [
    {
      "raceId": "aarakocra",
      "gender": "male",
      "visualStatus": "approved",
      "uniquenessStatus": "keeper",
      "manualReviewRequired": false,
      "checklist": {
        "isSquare": true,
        "isFullBody": true,
        "isEdgeToEdge": true,
        "isSliceOfLife": true,
        "isCivilian": true,
        "hasArrowsArtifact": false
      },
      "likelyScore": 4,
      "likelyReason": "Grounded trade-duty activity fits lore flavor.",
      "targetActivity": "setting lanterns along a village street at dusk",
      "notes": "Pass"
    }
  ]
}
```
