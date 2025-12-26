## 2024-05-24 - Feywild Time Warp Implementation

**Learning:** When implementing planar time mechanics, converting to a base unit (minutes) simplifies the math significantly compared to handling complex duration objects. The DMG variant rules for Feywild time can be effectively modeled using `rollDice` and a switch-case structure for different outcome buckets (compression, normal, dilation, jump).

**Action:** For future planar implementations (e.g., Astral Timelessness), consider creating a shared `PlanarTimeService` if more planes need time manipulation, but keep the specific logic (like the d20 table) inside the specific plane's mechanics class (e.g., `FeywildMechanics`).

**Testing Note:** Mocking `savingThrowUtils` directly is cleaner than mocking the underlying `rollDice` when testing mechanics that involve saving throws, as it isolates the mechanic logic from the dice roll sequence dependencies.
