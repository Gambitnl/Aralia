# Race Image Generation TODO List

## System Status
| System | Count | Note |
| :--- | :--- | :--- |
| **App Definitions** (`src/data/races/*.ts`) | **113** | The source of truth for character creation options. |
| **Glossary Entries** (`public/data/glossary/**/*.json`) | **112** | The source of truth for the in-game encyclopedia. |
| **Missing Images** | **5** | Races defined in App but missing their referenced image file. |
| **Single Image Races** | **15** | Glossary entries currently using only 1 image (needs Male + Female). |

## Naming & Usage Conventions

### `ID` (Unique Identifier)
*   **Format**: `kebab-case` (e.g., `abyssal_tiefling`, `hill_dwarf`).
*   **Technical Role**:
    *   **Logic & Storage**: Used as the primary key in state management and save files.
    *   **File Mapping**: Maps to Glossary filenames (`[id].json`) and Character illustrations (`[id]_male.png`).
    *   **Prerequisites**: Referenced in code for feat/class requirements.
    *   **Routing**: Used for internal Glossary linking and tooltips.

### `Title` / `Name` (Display Name)
*   **Format**: `Proper Case` (e.g., `Abyssal Legacy`, `Hill Dwarf`).
*   **Role**:
    *   **UI Presentation**: Visible headings in the Glossary and labels in the Character Creator.
    *   **Lore**: Used in descriptive text where a human-readable name is required.
    *   **Note**: This is stored as `title` in Glossary JSONs and `name` in the `Race` interface in the App.

## Comprehensive Race Status Table
This table tracks the presence of races across the Glossary and the Character Creator. 
*   ⚠️ indicates a mismatch or missing image.
*   ❌ indicates a missing entry in that system.

| | Icon | ID | Title / Name | In Glossary? | In Creator? | Images |
| :---: | :---: | :--- | :--- | :---: | :---: | :---: |
| ⚠️ | 🏔️ | `Cloud` | Cloud | ❌ | ✅ | M+F |
|  | 🦅 | `aarakocra` | Aarakocra | ✅ | ✅ | M+F |
| ⚠️ | 😈 | `abyssal` | Abyssal Legacy | ❌ | ✅ | M+F |
|  | 👹 | `abyssal_tiefling` | Abyssal Legacy | ✅ | ✅ | M+F |
|  | 💨 | `air_genasi` | Air Genasi Lineage | ✅ | ✅ | M+F |
|  | ⭐ | `astral_elf` | Astral Elf | ✅ | ✅ | M+F |
|  | 🤖 | `autognome` | Autognome | ✅ | ✅ | M+F |
|  | 🍂 | `autumn_eladrin` | Autumn Eladrin | ✅ | ✅ | M+F |
|  | 🐾 | `beastborn_human` | Beastborn Human | ✅ | ✅ | M+F |
|  | 🐻 | `beasthide_shifter` | Beasthide Shifter | ✅ | ✅ | M+F |
|  | 🐉 | `black_dragonborn` | Black Dragonborn | ✅ | ✅ | M+F |
|  | 🐉 | `blue_dragonborn` | Blue Dragonborn | ✅ | ✅ | M+F |
|  | 🐉 | `brass_dragonborn` | Brass Dragonborn | ✅ | ✅ | M+F |
|  | 🐉 | `bronze_dragonborn` | Bronze Dragonborn | ✅ | ✅ | M+F |
|  | 🐻 | `bugbear` | Bugbear | ✅ | ✅ | M+F |
|  | 🐴 | `centaur` | Centaur | ✅ | ✅ | M+F |
|  | 🎭 | `changeling` | Changeling | ✅ | ✅ | M+F |
|  | 💀 | `chthonic_tiefling` | Chthonic Legacy | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `cloud_giant` | Cloud Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | ☁️ | `cloud_giant_goliath` | Cloud Giant Goliath | ❌ | ✅ | M+F |
|  | 🐉 | `copper_dragonborn` | Copper Dragonborn | ✅ | ✅ | M+F |
|  | 🪨 | `deep_gnome` | Deep Gnome (Svirfneblin) | ✅ | ✅ | M+F |
| ⚠️ | 🐲 | `draconblood_dragonborn` | Draconblood Dragonborn | ❌ | ✅ | M+F |
|  | 🐉 | `dragonborn` | Dragonborn | ✅ | ✅ | M+F |
|  | 🧝 | `drow` | Drow Lineage | ✅ | ✅ | M+F |
|  | ⛏️ | `duergar` | Duergar | ✅ | ✅ | M+F |
|  | ⛏️ | `dwarf` | Dwarf | ✅ | ✅ | M+F |
|  | 🌍 | `earth_genasi` | Earth Genasi Lineage | ✅ | ✅ | M+F |
|  | 🍂 | `eladrin` | Eladrin | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `elf` | Elf | ✅ | ❌ | M+F |
|  | 🧚 | `fairy` | Fairy | ✅ | ✅ | M+F |
|  | 💀 | `fallen_aasimar` | Fallen Aasimar | ✅ | ✅ | M+F |
|  | 🌲 | `firbolg` | Firbolg | ✅ | ✅ | M+F |
|  | 🔥 | `fire_genasi` | Fire Genasi Lineage | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `fire_giant` | Fire Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | 🔥 | `fire_giant_goliath` | Fire Giant Goliath | ❌ | ✅ | M+F |
|  | 🔧 | `forest_gnome` | Forest Gnome Lineage | ✅ | ✅ | M+F |
|  | 🔨 | `forgeborn_human` | Forgeborn Human | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `frost_giant` | Frost Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | ❄️ | `frost_giant_goliath` | Frost Giant Goliath | ❌ | ✅ | M+F |
|  | 🔫 | `giff` | Giff | ✅ | ✅ | M+F |
|  | ⚔️ | `githyanki` | Githyanki | ✅ | ✅ | M+F |
|  | 🧘 | `githzerai` | Githzerai | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `gnome` | Gnome | ✅ | ❌ | M+F |
|  | 👺 | `goblin` | Goblin | ✅ | ✅ | M+F |
|  | 🐉 | `gold_dragonborn` | Gold Dragonborn | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `goliath` | Goliath | ✅ | ❌ | M+F |
|  | 🐉 | `green_dragonborn` | Green Dragonborn | ✅ | ✅ | M+F |
|  | 🛡️ | `guardian_human` | Guardian Human | ✅ | ✅ | M+F |
|  | 🪂 | `hadozee` | Hadozee | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `half-elf` | Half-Elf | ✅ | ❌ | M+F |
| ⚠️ | ❓ | `half-orc` | Half-Orc | ✅ | ❌ | ❌ |
| ⚠️ | 🌓 | `half_elf` | Half-Elf | ❌ | ✅ | M+F |
|  | 🌊 | `half_elf_aquatic` | Half-Elf (Aquatic) | ✅ | ✅ | M+F |
|  | 🕸️ | `half_elf_drow` | Half-Elf (Drow) | ✅ | ✅ | M+F |
|  | ⭐ | `half_elf_high` | Half-Elf (High) | ✅ | ✅ | M+F |
|  | 🌿 | `half_elf_wood` | Half-Elf (Wood) | ✅ | ✅ | M+F |
| ⚠️ | 🛡️ | `half_orc` | Half-Orc | ❌ | ✅ | M+F |
|  | 🏠 | `halfling` | Halfling | ✅ | ✅ | M+F |
|  | 🐇 | `harengon` | Harengon | ✅ | ✅ | M+F |
|  | 🏠 | `hearthkeeper_halfling` | Hearthkeeper Halfling | ✅ | ✅ | M+F |
|  | ✨ | `high_elf` | High Elf Lineage | ✅ | ✅ | M+F |
|  | ⛰️ | `hill_dwarf` | Hill Dwarf | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `hill_giant` | Hill Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | ⛰️ | `hill_giant_goliath` | Hill Giant Goliath | ❌ | ✅ | M+F |
|  | 🛡️ | `hobgoblin` | Hobgoblin | ✅ | ✅ | M+F |
|  | 👤 | `human` | Human | ✅ | ✅ | M+F |
|  | 😈 | `infernal_tiefling` | Infernal Legacy | ✅ | ✅ | M+F |
|  | 🧘 | `kalashtar` | Kalashtar | ✅ | ✅ | M+F |
|  | 🎒 | `kender` | Kender | ✅ | ✅ | M+F |
|  | 🐦 | `kenku` | Kenku | ✅ | ✅ | M+F |
|  | 🐲 | `kobold` | Kobold | ✅ | ✅ | M+F |
|  | 🦁 | `leonin` | Leonin | ✅ | ✅ | M+F |
|  | 🏃 | `lightfoot_halfling` | Lightfoot Halfling | ✅ | ✅ | M+F |
|  | 🦎 | `lizardfolk` | Lizardfolk | ✅ | ✅ | M+F |
|  | 🐺 | `longtooth_shifter` | Longtooth Shifter | ✅ | ✅ | M+F |
|  | 🌸 | `lotusden_halfling` | Lotusden Halfling | ✅ | ✅ | M+F |
|  | 🐘 | `loxodon` | Loxodon | ✅ | ✅ | M+F |
|  | ⚕️ | `mender_halfling` | Mender Halfling | ✅ | ✅ | M+F |
|  | 🐂 | `minotaur` | Minotaur | ✅ | ✅ | M+F |
|  | ⛰️ | `mountain_dwarf` | Mountain Dwarf | ✅ | ✅ | M+F |
|  | 💪 | `orc` | Orc | ✅ | ✅ | M+F |
|  | 👁️ | `pallid_elf` | Pallid Elf | ✅ | ✅ | M+F |
| ⚠️ | 🎯 | `pathfinder_half_orc` | Pathfinder Half-Orc | ✅ | ✅ | ❌ |
|  | 🌀 | `plasmoid` | Plasmoid | ✅ | ✅ | M+F |
|  | 😇 | `protector_aasimar` | Protector Aasimar | ✅ | ✅ | M+F |
| ⚠️ | 🐲 | `ravenite_dragonborn` | Ravenite Dragonborn | ❌ | ✅ | M+F |
|  | 🐉 | `red_dragonborn` | Red Dragonborn | ✅ | ✅ | M+F |
|  | ⚙️ | `rock_gnome` | Rock Gnome Lineage | ✅ | ✅ | M+F |
|  | 🛡️ | `runeward_dwarf` | Runeward Dwarf | ✅ | ✅ | M+F |
|  | 🎶 | `satyr` | Satyr | ✅ | ✅ | M+F |
|  | 🔥 | `scourge_aasimar` | Scourge Aasimar | ✅ | ✅ | M+F |
|  | 🌊 | `sea_elf` | Sea Elf | ✅ | ✅ | M+F |
|  | 🔍 | `seersight_half_elf` | Half-Elf (Seersight) | ✅ | ✅ | M+F |
| ⚠️ | ⚫ | `shadar_kai` | Shadar-kai | ✅ | ✅ | ❌ |
|  | 🌑 | `shadowveil_elf` | Shadowveil Elf | ✅ | ✅ | M+F |
|  | 🐉 | `silver_dragonborn` | Silver Dragonborn | ✅ | ✅ | M+F |
|  | 🧬 | `simic_hybrid` | Simic Hybrid | ✅ | ✅ | M+F |
|  | 🌸 | `spring_eladrin` | Spring Eladrin | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `stone_giant` | Stone Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | 🗿 | `stone_giant_goliath` | Stone Giant Goliath | ❌ | ✅ | M+F |
| ⚠️ | ❓ | `storm_giant` | Storm Giant Ancestry | ✅ | ❌ | M+F |
| ⚠️ | ⚡ | `storm_giant_goliath` | Storm Giant Goliath | ❌ | ✅ | M+F |
|  | ⚡ | `stormborn_half_elf` | Half-Elf (Stormborn) | ✅ | ✅ | M+F |
|  | 🛡️ | `stout_halfling` | Stout Halfling | ✅ | ✅ | M+F |
|  | ☀️ | `summer_eladrin` | Summer Eladrin | ✅ | ✅ | M+F |
|  | 🦌 | `swiftstride_shifter` | Swiftstride Shifter | ✅ | ✅ | M+F |
|  | 🐱 | `tabaxi` | Tabaxi | ✅ | ✅ | M+F |
|  | 🕷️ | `thri_kreen` | Thri-kreen | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `tiefling` | Tiefling | ✅ | ❌ | M+F |
|  | 🐢 | `tortle` | Tortle | ✅ | ✅ | M+F |
|  | 🔱 | `triton` | Triton | ✅ | ✅ | M+F |
|  | 🧠 | `vedalken` | Vedalken | ✅ | ✅ | M+F |
|  | 🌱 | `verdan` | Verdan | ✅ | ✅ | M+F |
|  | 🤖 | `warforged` | Warforged | ✅ | ✅ | M+F |
|  | 💧 | `water_genasi` | Water Genasi Lineage | ✅ | ✅ | M+F |
|  | 🏃 | `wayfarer_human` | Wayfarer Human | ✅ | ✅ | M+F |
|  | 🐉 | `white_dragonborn` | White Dragonborn | ✅ | ✅ | M+F |
|  | 🦉 | `wildhunt_shifter` | Wildhunt Shifter | ✅ | ✅ | M+F |
|  | ❄️ | `winter_eladrin` | Winter Eladrin | ✅ | ✅ | M+F |
|  | 🌲 | `wood_elf` | Wood Elf Lineage | ✅ | ✅ | M+F |
|  | 📜 | `wordweaver_gnome` | Wordweaver Gnome | ✅ | ✅ | M+F |
| ⚠️ | ❓ | `yuan-ti` | Yuan-Ti | ✅ | ❌ | ❌ |
| ⚠️ | 🐍 | `yuan_ti` | Yuan-Ti | ❌ | ✅ | M+F |

## Missing Images (Broken References)

The following races have image paths defined in their `src/data/races/*.ts` files, but the referenced files do not exist in `public/assets/images/races/`.

- [ ] **Half-Elf (Drow)** (`half_elf_drow`)
    - Source: `src/data/races/half_elf_drow.ts`
    - Missing: Male, Female
- [ ] **Pathfinder Half-Orc** (`pathfinder_half_orc`)
    - Source: `src/data/races/pathfinder_half_orc.ts`
    - Missing: Male, Female
- [ ] **Shadar-kai** (`shadar_kai`)
    - Source: `src/data/races/shadar_kai.ts`
    - Missing: Male, Female

## Relevant Files & Tools

*   **`unenriched_races.txt`**: A list of file paths to race JSON entries that are likely missing content (including images).
*   **`public/assets/images/races/`**: The directory containing the actual image files.
*   **`scripts/generate-race-images.ts`**: The script used to generate race images.
*   **`misc/check_race_images.py`**: A Python script that audits the `src/data/races` definitions.
*   **`scripts/raceImageStatus.ts`**: A module that manages the `race-image-status.json` file.
*   **`public/assets/images/races/race-image-status.json`**: A JSON file that tracks image download and verification status.
