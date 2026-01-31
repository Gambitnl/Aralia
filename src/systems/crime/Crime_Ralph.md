# Crime System Documentation (Ralph)

## Overview
This folder contains the "Law & Order" mechanics. It calculates the risk of illegal activities, manages the player's Notoriety (Heat), and generates Bounties for serious crimes.

## Files
- **CrimeSystem.ts**: The Calculation Engine. Computes `calculateRisk` (Base Risk + Local Heat + Global Heat) and handles the "Heat Decay" logic during rest.
- **ThievesGuildSystem.ts**: (Not yet commented) Logic for the underground criminal organization.

## Issues & Opportunities
- **Deterministic Risk**: `calculateRisk` returns a 0-100 score but the system doesn't explicitly handle "Stealth" modifiers from the character's skills in this utility; it seems to rely on the caller to add them.
- **Bounty Cleanup**: Bounties have an expiration, but `CrimeSystem.ts` doesn't seem to have a dedicated `processDailyBounties` to clean up old ones (unlike the Rumor system).
