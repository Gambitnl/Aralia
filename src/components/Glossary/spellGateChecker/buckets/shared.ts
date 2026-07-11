// Shared bucket helper: split a comma-delimited audit field into trimmed entries.
// Used by both the classes and sub-classes bucket families.

export function parseDelimitedField(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
