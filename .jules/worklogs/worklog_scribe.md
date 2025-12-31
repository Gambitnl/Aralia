# Scribe Worklog

## 2025-12-30 - Standardizing Core Utility Docs

**Learning:** Core utilities like `logger.ts` often lack JSDoc because they seem "obvious" to the original author, but this hides critical behaviors (like automatic redaction) from new consumers.
**Action:** When auditing core utilities, prioritize documenting "hidden" behaviors (side effects, security measures) over obvious parameter types.
