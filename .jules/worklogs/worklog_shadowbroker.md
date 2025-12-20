# Shadowbroker's Worklog

## 2024-05-23 - Smuggling & Black Market Design **Learning:** The current criminal systems lack a cohesive "Contraband Economy". We have fences for stolen goods, but no mechanics for illegal goods that *aren't* stolen (contraband) or the risk of moving them. **Action:** Implementing a Smuggling System that tracks risk per route and a Black Market System that drives demand for specific contraband types.

## 2024-05-25 - Heist State Architecture **Learning:** Implementing Heists requires a distinct `activeHeist` state in the global GameState to persist progress across turns and save/loads. Redux actions must be pure; RNG (success/failure) for heist actions should be resolved before dispatching to the reducer. **Action:** Added `activeHeist` to GameState and implemented pure reducer handlers for Heist phases and actions.
