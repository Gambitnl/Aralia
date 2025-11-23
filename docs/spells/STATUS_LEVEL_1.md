# Spell Integration Status: Level 1

**Legend:**
*   🟢 **Gold (Structured)**: JSON has `effects` array. Engine uses precise data.
*   🟡 **Silver (Inferred)**: `spellAbilityFactory` regex-parses description for damage/saves.
*   ⚪ **Bronze (Metadata)**: Basic metadata only. No mechanical execution.

| Spell | Mechanics | Narrative Support | Notes |
| :--- | :--- | :--- | :--- |
| **Absorb Elements** | ⚪ Bronze | ❌ None | Reaction |
| **Alarm** | ⚪ Bronze | 🟡 Basic | Long rest interruption logic |
| **Animal Friendship** | ⚪ Bronze | 🟡 Basic | Social (Beast) |
| **Armor of Agathys** | ⚪ Bronze | ❌ None | Temp HP/Thorns |
| **Arms of Hadar** | ⚪ Bronze | ❌ None | AoE Self |
| **Bane** | 🟢 Gold | ❌ None | Debuff (d4 subtraction) |
| **Bless** | 🟢 Gold | ❌ None | Buff (d4 addition) |
| **Burning Hands** | 🟢 Gold | ❌ None | |
| **Catapult** | ⚪ Bronze | ❌ None | Line physics |
| **Charm Person** | ⚪ Bronze | 🟡 Basic | Social Disposition set to Friendly |
| **Chromatic Orb** | 🟡 Silver | ❌ None | Dmg type selection |
| **Color Spray** | ⚪ Bronze | ❌ None | HP threshold |
| **Command** | ⚪ Bronze | 🟡 Basic | One-word NLP parsing |
| **Compelled Duel** | ⚪ Bronze | ❌ None | Aggro logic |
| **Comprehend Languages** | ⚪ Bronze | 🟡 Basic | Gemini translation prompt |
| **Create or Destroy Water** | ⚪ Bronze | 🟡 Basic | Survival logic |
| **Cure Wounds** | 🟢 Gold | ❌ None | Healing |
| **Detect Evil and Good** | ⚪ Bronze | 🟡 Basic | Radar/Compass update |
| **Detect Magic** | ⚪ Bronze | 🟡 Basic | Highlight interactive objects |
| **Detect Poison and Disease** | ⚪ Bronze | 🟡 Basic | |
| **Disguise Self** | 🟢 Gold | 🟡 Basic | NPC Suspicion System bypass |
| **Dissonant Whispers** | 🟡 Silver | ❌ None | Forced move |
| **Divine Favor** | 🟡 Silver | ❌ None | Buff |
| **Divine Smite** | ⚪ Bronze | ❌ None | On-hit trigger |
| **Ensnaring Strike** | ⚪ Bronze | ❌ None | On-hit trigger |
| **Entangle** | ⚪ Bronze | ❌ None | AoE Restrain |
| **Expeditious Retreat** | ⚪ Bronze | ❌ None | Dash bonus |
| **Faerie Fire** | ⚪ Bronze | ❌ None | Adv on attack |
| **False Life** | 🟢 Gold | ❌ None | Temp HP |
| **Feather Fall** | 🟢 Gold | 🟡 Basic | Exploration/Falling event |
| **Find Familiar** | ⚪ Bronze | 🟡 Basic | Persistent pet entity |
| **Fog Cloud** | ⚪ Bronze | ❌ None | LoS blocking |
| **Grease** | ⚪ Bronze | ❌ None | Prone/Terrain |
| **Guiding Bolt** | 🟢 Gold | ❌ None | Adv next attack |
| **Hail of Thorns** | ⚪ Bronze | ❌ None | On-hit AoE |
| **Healing Word** | 🟢 Gold | ❌ None | Bonus action heal |
| **Hellish Rebuke** | 🟡 Silver | ❌ None | Reaction |
| **Heroism** | 🟢 Gold | ❌ None | No fear + Temp HP |
| **Hex** | 🟡 Silver | ❌ None | Bonus dmg trigger |
| **Hunter's Mark** | 🟡 Silver | ❌ None | Bonus dmg trigger |
| **Ice Knife** | 🟡 Silver | ❌ None | Attack + AoE |
| **Identify** | ⚪ Bronze | 🟡 Basic | Reveal item stats |
| **Illusory Script** | ⚪ Bronze | ❌ None | |
| **Inflict Wounds** | 🟢 Gold | ❌ None | |
| **Jump** | ⚪ Bronze | 🟡 Basic | Submap traversal |
| **Longstrider** | ⚪ Bronze | ❌ None | Speed buff |
| **Mage Armor** | 🟢 Gold | ❌ None | AC calc update |
| **Magic Missile** | 🟢 Gold | ❌ None | Auto-hit logic |
| **Protection from Evil/Good** | 🟢 Gold | ❌ None | Creature type logic |
| **Purify Food and Drink** | 🟢 Gold | 🟡 Basic | Survival logic |
| **Ray of Sickness** | 🟡 Silver | ❌ None | Poison cond |
| **Sanctuary** | 🟢 Gold | ❌ None | Target redirect |
| **Searing Smite** | 🟡 Silver | ❌ None | On-hit DoT |
| **Shield** | 🟢 Gold | ❌ None | Reaction AC |
| **Shield of Faith** | 🟢 Gold | ❌ None | AC Buff |
| **Silent Image** | ⚪ Bronze | 🟡 Basic | Distraction/Stealth |
| **Sleep** | 🟢 Gold | ❌ None | HP threshold |
| **Snare** | ⚪ Bronze | ❌ None | Trap logic |
| **Speak with Animals** | 🟢 Gold | 🟡 Basic | Unlock "Talk" for Beast NPCs |
| **Tasha's Caustic Brew** | ⚪ Bronze | ❌ None | Line DoT |
| **Tasha's Hideous Laughter** | ⚪ Bronze | ❌ None | Prone/Incap |
| **Thunderous Smite** | 🟡 Silver | ❌ None | On-hit push |
| **Thunderwave** | 🟢 Gold | ❌ None | Pushback |
| **Unseen Servant** | ⚪ Bronze | 🟡 Basic | |
| **Witch Bolt** | 🟡 Silver | ❌ None | Sustained dmg |
| **Wrathful Smite** | 🟡 Silver | ❌ None | On-hit fear |