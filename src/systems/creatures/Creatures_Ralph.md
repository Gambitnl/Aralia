# Creatures System Documentation (Ralph)

## Overview
This folder contains the Taxonomy logic. It provides a centralized service for classifying entities (Humanoid, Undead, Fiend) and validating whether they are eligible targets for specific abilities.

## Files
- **CreatureTaxonomy.ts**: The Classifier. It handles whitelist/blacklist validation for spell targets and provides a lookup for standard racial/type traits.

## Issues & Opportunities
- **Hybrid Types**: `isValidTarget` returns true if AT LEAST ONE required type matches. It doesn't elegantly handle creatures that might belong to multiple categories where a spell only works on one (e.g. "Hold Person" on a "Humanoid/Construct" hybrid - is it too humanoid to resist or too metallic to care?).
