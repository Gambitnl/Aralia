// TODO(2026-01-03 pass 5 Codex-CLI): Preserve the legacy import path used across many UI files.
// Re-export from ui/Tooltip so relative imports like '../Tooltip' resolve for bundlers without touching every consumer.
export { default } from './ui/Tooltip';
