# Time Component Documentation (Ralph)

## Overview
This folder contains the Temporal Logic of the world. It bridges standard Javascript `Date` objects with the fantasy calendar "Claw of Winter" names and mechanics like Moon Phases and Seasonal Survival modifiers.

## Files
- **CalendarSystem.ts**: Handles the cosmetic layer of time (Month names, Moon Phases, Holidays). It uses a 28-day lunar cycle and maps standard JS Date fields to fantasy month names.
- **SeasonalSystem.ts**: Handles the mechanical layer of time (Foraging DC, Travel Speed). It defines the `SeasonalEffect` configuration (e.g., Winter slows travel by 1.5x).

## Issues & Opportunities
- **Gregorian Coupling**: The system is tightly coupled to `Date`, implying a 365-day Gregorian year with Leap Years. If the fantasy world has a different year length (e.g. 360 days exactly), using native `Date` math will introduce subtle drifts or require complex compensation logic that isn't present here yet.
