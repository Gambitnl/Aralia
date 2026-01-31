# Travel Component Documentation (Ralph)

## Overview
This folder implements the "Hexcrawl" or Overland Travel mechanics. It handles Speed calculations (Pace vs Encumbrance), Daily Distance (MPH * 8h), and Navigation checks (Survival DC vs Getting Lost).

## Files
- **TravelCalculations.ts**: The physics of travel. Calculates "Forced March" exhaustion DC and "Group Speed" (limited by the slowest member/vehicle). Implements 5e Variant Encumbrance speed penalties.
- **TravelNavigation.ts**: The survival mechanics. Calculates probability of getting lost based on Terrain Difficulty (DC 5-15) vs Survival Roll + Modifiers (Map, Pace).

## Issues & Opportunities
- **Vehicle Logic**: `calculateGroupTravelStats` simplifies vehicle speed logic considerably (defaulting to 30ft if undefined). It doesn't robustly handle "Draft Animals pulling a heavy wagon" physics (e.g., 2 horses pulling 4000lbs).
- **Navigation Drift**: `checkNavigation` uses a simple random direction for "Lost" status. It doesn't account for "veering" (e.g. tending to drift left/right consistently) which is a common real-world navigation failure mode.
