# DECISIONS: Tiered Autosave Checkpoint System

Last updated: 2026-06-12

## DEC-001: IndexedDB over localStorage for save storage

**Decision Point:** Where to store save payloads for the new multi-slot autosave system.
**Options Considered:**
1. Stay on localStorage, limit to 3-4 checkpoint tiers.
2. Move to IndexedDB for all saves.
3. Hybrid: keep rapid autosave in localStorage, checkpoints in IndexedDB.

**Decision:** Option 2 Ã¢â‚¬â€ full IndexedDB migration.
**Rationale:** localStorage has a 5-10MB quota. A single save can be hundreds of KB. Even without checkpoints, the existing system will hit quota limits as games grow. IndexedDB (50MB-2GB+) solves this permanently. The hybrid approach adds complexity for marginal benefit.
**Mutation:** New IndexedDB storage service. Migration logic. All save reads/writes go through IndexedDB.
**Status:** Confirmed.
**Next Proof:** IndexedDB service passes unit tests with save/load round-trip.

---

## DEC-002: Independent timers, not cascading promotion

**Decision Point:** How checkpoint slots get populated.
**Options Considered:**
1. Cascading: each tier receives hand-me-downs from the tier below when its timer fires.
2. Independent: each tier copies the current rapid autosave data at its own interval.
3. Ring buffer with thinning: keep all saves, thin based on age.

**Decision:** Option 2 Ã¢â‚¬â€ independent copy from rapid autosave.
**Rationale:** Simplest mental model. Each checkpoint has one timer that fires independently. No promotion chains, no complex bookkeeping. The rapid autosave slot already holds the latest save Ã¢â‚¬â€ checkpoints just snapshot it at different intervals. Ring buffer requires more storage management and the "thinning" policy is harder to reason about.
**Mutation:** `useCheckpointSaves` hook with per-tier timers.
**Status:** Confirmed.
**Next Proof:** Checkpoint hook fires timers at correct intervals in dev environment.

---

## DEC-003: Checkpoint tiers selection

**Decision Point:** How many tiers and at what intervals.
**Options Considered:**
1. Original request: 1m, 5m, 10m, 15m, 30m, 1h, 2h (7 tiers).
2. Reduced: 1m, 5m, 15m, 30m, 1h (5 tiers).
3. Compromise: 1m, 5m, 15m, 30m, 1hr (5 checkpoints + 1 rapid = 6 total).

**Decision:** Option 3 Ã¢â‚¬â€ 5 checkpoint tiers + 1 rapid autosave = 6 total.
**Rationale:** The 10m tier doesn't add much value between 5m and 15m. The 2h tier is edge-case (most sessions don't run 2+ hours without other saves). 6 total slots keeps storage reasonable while covering the useful range.
**Mutation:** Config array with 5 checkpoint definitions.
**Status:** Confirmed.
**Next Proof:** Config renders correctly in Load UI.

---

## DEC-004: Slot metadata caching strategy

**Decision Point:** Where to cache slot metadata for fast UI reads.
**Options Considered:**
1. All metadata in IndexedDB (async reads everywhere).
2. Metadata in localStorage (sync reads), payloads in IndexedDB.
3. Metadata in memory only, rebuilt on page load from IndexedDB.

**Decision:** Option 2 Ã¢â‚¬â€ metadata stays in localStorage, payloads move to IndexedDB.
**Rationale:** The current system already caches slot metadata in localStorage + sessionStorage + in-memory. This works well for menu responsiveness. Payloads are large and benefit from IndexedDB's quota; metadata is small (~1KB total) and benefits from localStorage's synchronous reads. The existing `buildSlotIndex()`, `persistSlotIndex()`, `getSessionCache()` functions continue to work unchanged.
**Mutation:** Only `SafeStorage.setItem(storageKey, serializedPayload)` and `SafeStorage.getItem(storageKey)` calls change to async IndexedDB equivalents.
**Status:** Confirmed.
**Next Proof:** Load modal opens with correct slot cards without visible latency.
