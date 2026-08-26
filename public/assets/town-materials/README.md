# Town surface images

These seven base-color images were generated with OpenAI Image Generation for
the Real 3D town visual iteration. They are reusable product assets, not render
captures. The prompts requested square, repeatable, evenly lit material views
without perspective, cast shadows, text, or objects.

| File | Requested surface |
| --- | --- |
| roof-shingles.png | Neutral gray overlapping roof shingles, small courses |
| lime-plaster.png | Fine cream lime plaster with restrained weathering |
| limestone.png | Gray-beige rectangular limestone masonry |
| reed-thatch.png | Beige vertical reeds in overlapping thatch courses |
| weatherboard.png | Horizontal weathered oak boards, restrained knots and grain |
| clay-tiles.png | Overlapping curved pale clay tiles |
| brickwork.png | Handmade buff brick in staggered running bond |

`src/components/World3D/townSurfaceTextures.ts` shares textures across buildings.
Resolved construction keys select plaster, stone, shingles, thatch, wood,
brick, or clay. Sod still lacks a dedicated image, and log walls share the wood
image while their modeled courses distinguish the assembly. Seeded colors are
blended toward construction-specific colors so plaster reads as lime and thatch
as straw. Wall coordinates repeat at physical scale; roof coordinates follow
each slope. These are color maps, not scanned PBR
materials; seamless edges and calibrated roughness have not been established.
