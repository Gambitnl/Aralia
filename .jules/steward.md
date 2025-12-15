
## 2024-05-23 - Checksums for Save Integrity
**Learning:** `localStorage` is reliable but not infallible. Bitrot or partial writes can corrupt data. Zod schema validation catches structure errors, but not content corruption.
**Action:** Implemented a simple checksum mechanism for save games to ensure data integrity upon load.
