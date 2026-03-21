# Improvement Note: Standardize API Error Handling

## Status

This is now a preserved completion note.
The core standardization work it describes is materially present, but the older file reads like a live implementation checklist instead of a historical record.

## Verified Current State

- src/services/gemini/types.ts defines StandardizedResult<T> as a shared generic result shape with data, error, and optional metadata.
- src/services/geminiService.ts exports Gemini-facing functions that now return Promise<StandardizedResult<...>> rather than a mix of thrown errors and ad hoc success payloads.
- The lower-level Gemini lane also reflects the same contract through src/services/gemini/core.ts, src/services/gemini/encounters.ts, and src/services/gemini/items.ts.
- The same standardized result pattern is also used in src/services/ollamaTextService.ts, which means the broader AI-service surface has converged on the same caller-facing shape instead of each service inventing a different one.

That means the main improvement did land:

- public AI-service calls now have a predictable result wrapper
- success/error handling is more uniform across the Gemini and Ollama surfaces
- the repo no longer needs this file as an active refactor plan for the initial standardization step

## Historical Drift To Note

The older note assumed the standardization lived mainly inside one monolithic src/services/geminiService.ts refactor.
The current repo has evolved further:

- the shared result type now lives in src/services/gemini/types.ts
- the Gemini implementation is split across core, encounters, and items
- the surrounding callers and tests have already adapted to the StandardizedResult contract

So the original architectural targeting is historical even though the underlying improvement is real.

## What This Means

- this file should be preserved as a completion record, not used as a live plan
- future AI-service work should build on the existing shared StandardizedResult contract rather than re-proposing its creation
- remaining work is about coverage, cleanup, and consistency details, not about establishing the basic pattern

## Preserved Value

This note still captures a durable service-layer principle:

- caller-facing AI services should return a predictable typed result shape
- prompt and raw-response metadata should remain available for logging and debugging
- error handling should be explicit at the call site instead of hidden behind inconsistent thrown/returned hybrids
