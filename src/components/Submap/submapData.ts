/**
 * @file submapData.ts
 * Contains static data for SubmapPane, specifically the tile hints/descriptions.
 */

// --- Submap Tile Hint Data ---
export const submapTileHints: Record<string, string[]> = {
    'default': [
        "The air is still here.",
        "You survey your surroundings.",
        "A sense of anticipation hangs in the air.",
        "An unremarkable patch of terrain, yet potential lurks everywhere.",
        "The ground here seems ordinary.",
        "A quiet moment of observation."
    ],
    'forest_default': [
        "Sunlight filters weakly through the dense canopy above this spot.",
        "The air is cool and smells of damp earth and pine needles.",
        "A gnarled root, thick as your arm, breaks the surface of the forest floor.",
        "You hear the rustling of small creatures in the underbrush nearby.",
        "A patch of unusually vibrant green moss clings to an old log.",
        "The ground here is soft with fallen leaves, muffling your steps.",
        "A whisper of wind rustles the highest leaves.",
        "The scent of decaying wood is faint but present."
    ],
    'forest_path': ["The path seems clear ahead.", "Tracks of small animals mark the soft earth.", "An ancient, moss-covered tree looms beside the path.", "Sunlight struggles to reach the forest floor here, keeping it cool."],
    'forest_water': ["The water of the pond looks surprisingly clear.", "Something ripples the surface for a moment, then vanishes.", "Dragonflies with iridescent wings flit over the pond.", "Mossy rocks line the water's edge, slick and damp."],
    'forest_dense_forest': ["The trees grow very close together, their branches intertwined.", "It's noticeably darker and quieter within this thicket.", "You feel a primal sense of being watched from the shadows.", "The undergrowth is thick and tangled, promising difficult passage."],
    'forest_stone_area': ["These weathered stones feel ancient to the touch.", "Faint, almost eroded carvings might be hidden on these stones.", "A subtle vibration or hum seems to emanate from the ground here.", "Moss grows in deep green patches on these weathered stones."],
    'forest_glowing_mushroom_grove': [
        "An eerie, soft luminescence emanates from a patch of exotic mushrooms.",
        "The air here smells unusually sweet and earthy.",
        "These glowing fungi pulse with a faint, rhythmic light.",
        "The ground around the mushrooms is damp and spongy."
    ],
    'plains_default': [
        "Tall, golden grasses sway gently in the warm breeze here.",
        "The vast sky stretches overhead, a canvas of blue and white.",
        "You spot a distant hawk circling lazily, high above this open stretch.",
        "The ground is firm and well-suited for swift travel.",
        "A cluster of vibrant wildflowers adds a splash of unexpected color to the landscape.",
        "You notice a faint game trail, almost invisible, winding through the grass.",
        "The sun feels warm on your skin.",
        "A lone, windswept tree stands defiantly in the distance."
    ],
    'plains_path': ["This path is well-worn, clearly a common route.", "You see signs of recent travelers - perhaps a discarded trinket or fresh tracks.", "The way ahead seems open and straightforward.", "A few hardy wildflowers grow stubbornly by the wayside."],
    'plains_village_area': ["You can hear the distant, muffled sounds of a settlement - a dog barking, perhaps voices.", "The faint, comforting smell of woodsmoke and cooking fires drifts on the wind.", "A well-trodden path, wider than most, leads towards signs of civilization.", "Small, neatly tilled fields might be just beyond your sight, hinting at farming."],
    'forest_village_area': ["You can hear the sounds of a woodland settlement - chopping wood, perhaps children playing.", "The air carries the scent of pine smoke and fresh timber.", "A narrow path winds toward a cluster of tree-surrounded buildings.", "This forest village seems to live in harmony with the surrounding woods."],
    'mountain_village_area': ["You can hear the sounds of a mountain settlement - hammering metal, perhaps goats bleating.", "The air carries the scent of forge fires and mountain herbs.", "A steep path leads toward stone buildings clinging to the hillside.", "This mountain village appears hardy and weathered by the elements."],
    'village': ["You can see the outlines of thatched roofs and hear faint sounds of daily life.", "The air carries the scent of hearth fires and livestock.", "A cluster of buildings stands before you, surrounded by cultivated fields.", "This appears to be a small village, perhaps a farming community."],
    'village_area': ["You can hear the distant, muffled sounds of a settlement.", "The faint smell of woodsmoke drifts on the wind.", "A well-trodden path leads toward signs of civilization.", "Fields and buildings suggest a nearby community."],
    'plains_sparse_forest': ["A small, welcoming cluster of trees offers a brief respite from the open sun.", "Birdsong, louder and more varied here, echoes from the branches.", "The ground beneath the trees is cool and littered with fallen leaves.", "This copse seems like an ideal spot for a short rest or a hidden meeting."],
    'plains_campsite': ["The charred remains of an old campfire are clearly visible.", "Someone has camped here recently; the ground is flattened and some supplies might be overlooked.", "Discarded scraps or a forgotten tool hint at previous occupants and their haste or carelessness.", "The area feels temporarily tamed, a brief pause in the wilderness."],
    'plains_lone_monolith': ["The monolith stands silent and imposing, a finger of stone pointing to the sky.", "Strange, weathered symbols might be etched into its ancient surface, telling a forgotten story.", "The stone feels unnaturally cold to the touch, even under the sun.", "The wind whistles around its sharp edges, creating an eerie tune."],
    'plains_boulder_field': ["Large, smooth boulders are scattered haphazardly across the landscape, like forgotten marbles of giants.", "This area could provide excellent cover or an ambush spot.", "The ground is uneven and rocky, requiring careful footing.", "Small, hardy plants grow in the crevices between the stones."],
    'mountain_default': [
        "The mountain air is thin, cold, and crisp in your lungs.",
        "Loose scree and sharp stones make footing treacherous in this spot.",
        "A sheer, unscalable cliff face looms nearby, its stone ancient and weathered.",
        "The wind howls with a lonely, mournful sound through a narrow pass just ahead.",
        "You spot a hardy, brightly colored mountain flower clinging tenaciously to life in a rock crevice.",
        "A massive boulder, streaked with unusual mineral deposits, rests precariously here.",
        "The silence is profound, broken only by the wind.",
        "Far below, the world unfurls like a map."
    ],
    'mountain_path': ["This narrow path is steep and winds precariously along the mountainside.", "Only the most sure-footed creatures—or determined climbers—would dare to travel here.", "Loose rocks and gravel skitter underfoot, threatening a dangerous slide.", "The view from this exposed path, though perilous, might be breathtakingly vast."],
    'mountain_rocky_terrain': ["Jagged, sharp rocks jut out from the ground like broken teeth.", "Dark cave entrances or hidden crevices might be concealed among the crags and shadows.", "This terrain is exceptionally difficult to navigate; progress is slow and requires concentration.", "You hear the distant, sharp crack of falling rocks echoing from higher up."],
    'mountain_snowy_patch': ["A patch of old, compacted snow clings stubbornly to the mountainside, defying the sun.", "The air is noticeably colder here, a pocket of lingering winter.", "The glistening surface of the snow might hide treacherous ice beneath.", "Faint tracks in the snow could reveal the recent passage of mountain creatures... or something else."],
    'hills_default': [
        "From this gentle rise, you can see the undulating green and gold landscape for miles around.",
        "A smooth, grassy slope leads downwards from your current position.",
        "Patches of colorful wildflowers dot the hillside, alive with the buzzing of bees and flitting butterflies.",
        "A few scattered, wind-sculpted trees offer sparse shade on the open hills.",
        "The ground here is covered in short, springy turf, pleasant to walk upon.",
        "You hear the distant, melodic bleating of sheep carried on the breeze.",
        "A weathered outcrop of rock provides a natural landmark.",
        "The air is fresh and carries the scent of wild herbs."
    ],
    'desert_default': [
        "The relentless sun beats down, and heat shimmers above the endless expanse of sand.",
        "A dry, hot wind whispers across the dunes, carrying fine grains that sting your eyes.",
        "You spot a surprisingly resilient desert plant, its waxy leaves a dull green against the ochre sand.",
        "The sand is incredibly fine and deep, shifting and sighing under your every step.",
        "A bleached animal skull, picked clean by scavengers, lies half-buried nearby – a stark reminder of the desert's harshness.",
        "The distant horizon is a mirage, a wavering line of heat and light.",
        "A large, flat rock offers a brief respite from the scorching sand.",
        "The silence of the desert is vast and almost deafening."
    ],
    'swamp_default': [
        "The air is thick and heavy with humidity, carrying the cloying smell of decay and stagnant water.",
        "Murky, dark water pools around your feet, disturbed by unseen movement from below.",
        "Gnarled, ancient trees with trailing Spanish moss create a gloomy, oppressive atmosphere.",
        "The incessant, high-pitched buzzing of mosquitoes and other unseen insects is a constant drone here.",
        "A patch of unnaturally bright green algae covers a stagnant pool, its surface unmoving.",
        "The ground is soft and treacherous; you feel it trying to suck your boots down with every step.",
        "A chorus of frogs erupts from a nearby patch of reeds.",
        "The remains of a rotted log bridge suggest a path once existed here."
    ],
    'ocean_default': [
        "The vast, endless ocean stretches to the horizon in all directions.",
        "Waves crash rhythmically against unseen shores or rise and fall in deep swells.",
        "The salty spray of the sea mists your face.",
        "A lone seabird cries overhead, circling before disappearing into the distance.",
        "The water here is a deep, mysterious blue.",
        "A piece of driftwood bobs on the surface nearby."
    ],
    'cave_default': [
        "The air is cool, damp, and still.",
        "Water drips rhythmically from a stalactite somewhere in the dark.",
        "The rocky floor is uneven and slick with moisture.",
        "Shadows dance on the walls, cast by unseen light sources.",
        "A faint draft suggests a larger chamber nearby.",
        "The silence is heavy, broken only by your own breathing."
    ],
    'dungeon_default': [
        "The air is stale and carries the scent of old stone and dust.",
        "Cobwebs hang in thick curtains from the ceiling.",
        "The floor is made of worn flagstones, cracked with age.",
        "Rusting iron fixtures line the walls.",
        "You hear the faint scuttling of vermin in the shadows.",
        "A sense of dread permeates these ancient halls."
    ],
    'wall': ["Solid rock blocks your path.", "A rough-hewn stone wall stands before you.", "The cave wall is damp and covered in lichen.", "An ancient masonry wall, built by forgotten hands."],
    'floor': ["The ground is level enough for easy travel.", "Rough stone floor, worn smooth by time.", "A patch of dirt floor, packed hard."],
    'pond': ["Ripples disturb the pond's surface; something is moving within.", "The water of the pond looks murky and deep, its bottom hidden.", "A chorus of frogs suddenly erupts from the reeds at the pond's edge.", "A faint glint from the pond's bottom catches your eye. Treasure, or just a reflection?"],
    'dense_thicket': ["It's almost impossible to see more than a few feet into the dense thicket.", "You hear a distinct rustling from deep within the bushes. Animal or something else?", "This looks like an excellent place to lay an ambush... or be ambushed.", "Only the smallest creatures could easily pass through this dense growth."],
    'ancient_stone_circle': ["The air around these ancient stones hums with a forgotten power.", "Are these massive stones arranged naturally, or by some long-lost design?", "A palpable sense of ancient ritual and unknown purpose hangs heavy in the air here.", "The ground within the circle feels strangely different, perhaps cooler or more barren."],
    'glowing_mushroom_grove': ["An eerie, pulsating luminescence emanates from this patch of exotic mushrooms.", "The air here smells unusually sweet and damp, a cloying, fungal aroma.", "These glowing fungi might be a source of magical power... or a deadly poison.", "The soft glow from the mushrooms casts strange, dancing shadows."],
    'oasis': ["The sight of fresh water and lush greenery is a stark, welcome relief in this arid land.", "Numerous animal tracks lead to the water's edge, indicating this is a vital resource.", "The shade of swaying palm trees offers a cool respite from the oppressive heat.", "The water looks clear, but is it safe to drink without purification?"],
    'rocky_mesa': ["The flat top of the distant mesa offers a commanding view of the surroundings.", "Climbing this sheer rock formation would be a significant challenge, even for the skilled.", "Wind has carved strange, hoodoo-like shapes into the weathered rock face.", "Perhaps a territorial creature lairs atop the mesa, guarding its domain."],
    'sand_dunes': ["The ever-shifting sands of these dunes make travel slow and arduous.", "Legends say ancient ruins or lost treasures can sometimes be found buried beneath these dunes.", "The wind whispers across the crests of the dunes, constantly reshaping the landscape.", "The intense heat shimmering above the dunes creates disorienting mirages."],
    'murky_pool': ["The water in this pool is dark, still, and utterly opaque.", "Large, slow bubbles occasionally rise to the surface, releasing a foul-smelling gas.", "The cloying smell of decay and stagnant water hangs heavy in the humid air.", "What unseen creatures might lurk in the muddy depths of this pool?"],
    'dense_reeds': ["The reeds grow incredibly tall and dense here, effectively blocking your view.", "You hear a distinct slithering or splashing sound from within the reeds, just out of sight.", "The ground beneath the reeds is soft, wet, and likely treacherous.", "A narrow, hidden path might wind its way through this dense patch of reeds."],
    'sunken_ruin_fragment': ["A fragment of an ancient, moss-covered stone structure juts defiantly from the muck.", "What forgotten building or monument was this part of, now lost to the swamp?", "Treasure, ancient knowledge, or lurking danger might be hidden within these sunken remains.", "The stone is cold, slimy, and surprisingly well-preserved despite its immersion."],
    'small_island': ["This small, sandy island offers a patch of solid ground amidst the water.", "Coconuts, driftwood, or perhaps even a washed-up chest might be found here.", "Nesting seabirds cry out defensively as you approach their isolated sanctuary.", "Is this island truly deserted, or does someone or something else call it home?"],
    'kelp_forest': ["Towering stalks of kelp sway rhythmically in the underwater currents, creating a dense, shifting forest.", "Schools of small, brightly colored fish dart amongst the protective fronds of kelp.", "The water is noticeably darker and more obscured within the kelp forest.", "Larger, predatory creatures might use the dense kelp as cover for ambushes."],
    'coral_reef': ["Vibrant, multi-colored corals create a stunning and complex underwater landscape.", "Countless schools of exotic fish swim gracefully among the reef's intricate structures.", "The sharp edges of the coral could be dangerous to the unwary swimmer.", "The reef might hide secret caves, valuable pearls, or the lairs of territorial marine creatures."]
};
