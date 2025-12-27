## 2024-05-24 - Feywild Time Warp

**Learning:** Time in the Feywild is not just "slower" or "faster" but narratively treacherous. The DMG variant rule (Days -> Minutes or Days -> Years) provides extreme stakes. I implemented a `calculateTimeWarp` function that handles this conversion.

**Key Insight:** Using `rollDice('1d20')` to determine the outcome allows for consistent testing via mocking, rather than `Math.random()`. The result needs to be communicated clearly to the player via a message string.

**Action:** Future planar features should similarly isolate the "randomness" into a single roll logic that returns a descriptive object (`TimeWarpResult`), allowing the UI to just display the message without needing to know the math.
