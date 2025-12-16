## 2024-05-22 - Multi-Layered Identity System
**Learning:** A robust identity system requires separating the *actor* (Player) from the *persona* (Alias). By decoupling reputation from the player and attaching it to an Alias, we allow for "clean slate" gameplay and spy mechanics. However, simple disguises are boring; they need *vulnerabilities* (specific triggers like 'speech' or 'combat') to create tension.

**Action:**
1. Always check `activeDisguise` before calculating reputation/reaction.
2. When designing NPCs, give them specific `detection` capabilities (e.g., a Guard Captain might have a bonus to detecting 'combat' disguise flaws).
3. Use `isExposed` on an Alias to trigger "burned spy" consequences—where the Alias becomes a liability rather than an asset.
