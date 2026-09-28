# src/rendering2d

A small library of 2D canvas art parts. No game code calls this library yet.

## Where it came from

The RealmSmith 2D town painter stack was dead code. It had zero importers.
Remy retired the stack on 2026-09-14 (Agora task `agora-e840.5`).
The ruling was: keep the glyphs, the palette, and the light pool. Delete the rest.

These three files are the salvage. The rest of the stack is gone:

- `src/services/RealmSmithAssetPainter.ts`
- `src/services/RealmSmithTownGenerator.ts`
- `src/services/realmsmith/painters/*`

## The files

### `doodadGlyphs.ts`

22 hand-drawn canvas glyphs. Each glyph draws one map object.
The set holds trees, a bush, a cactus, a rock, a stump, a crystal,
crops, a pumpkin, a well, a crate, a barrel, a street lamp, and a tombstone.

Each glyph is a pure function with this shape:

```ts
glyph(ctx, x, y, size, seed)
```

The source painter called `Math.random` for the willow strands and the crops.
That made the art change on every redraw. The glyphs now take a seed instead.
The same seed always draws the same shape.

`DOODAD_GLYPHS` holds every glyph by name. `drawDoodadGlyph` draws one by name.

### `biomePalette.ts`

The color table for 20 biomes. Each row gives a grass hue, two water colors,
and two optional building overrides. The source used a switch statement with a
default branch. This file uses a plain table. Every biome has an explicit row.

`getBiomeColors` reads one row. It returns the default row for an unknown name.

### `lightPool.ts`

The 2D night pass. The pass dims the map. The pass then adds light pools in
screen blend mode. Each pool is a radial gradient.

The source pass read RealmSmith tiles and buildings. This version does not.
The caller collects the lights and passes them in. `LIGHT_PRESETS` keeps the
color and the radius of each light that the retired painter knew.

## Intended consumer

The next-gen 2D combat map. That map is a Pixi prototype. Open it with
`?pixiboard=1`. See the plan-map topic `combat-map-nextgen`.

## Rules for this library

- A draw function must stay pure. It must not call `Math.random` or `Date.now`.
- A draw function must not import game types. It takes plain numbers and strings.
- A context type must name only the members that the function uses. A test can
  then supply a small fake object.
