---
Date: 2026-06-08
Content Type: Asset Generation Reference
---

# World Asset Generation Prompts

Prompts for generating the Phase-2 world-art PNGs with ChatGPT (DALL·E 3 / GPT-image). Drop each rendered file at the exact filename shown into `src/assets/world/`. The same style prefix on every prompt keeps the set visually coherent.

## How to use this file

1. Paste the **Style Prefix** at the top of every prompt (or include `{style prefix}` and let the model expand from earlier context in the same chat).
2. ChatGPT/DALL·E usually outputs 1024×1024 with a checker or solid background. **Strip the background to transparent in an image editor** (Photoshop "Remove Background", remove.bg, GIMP color-to-alpha) before saving.
3. Save with the exact filename listed — the game's asset loader keys on it.
4. The "Source PNG" dimensions are what you save; the game scales each sprite to the "displayed at" size at runtime for crispness on hi-DPI screens.

## Style Prefix

Use this on every prompt:

```
3D claymation toy diorama style, soft global illumination, rounded chunky shapes,
cel-shaded with soft drop shadows, bright cheerful saturated colors, isolated
subject on a transparent background, casual mobile game asset, square crop.
```

---

## Cliffs

### `cliff-left`

- **Save to:** `src/assets/world/cliff-left.png`
- **Source PNG:** 1024×1024 (displayed at 280×200 in-world)
- **Aspect to crop after generation:** ~14:10 wide

```
{style prefix}
Chunky toy 3D cliff facing right, lush bright green grass top edge with a few
short blades and small daisies, warm tan-brown rocky body underneath with rounded
boulder shapes, soft top-left lighting, two small darker rock outcrops at the
base. Vertical right edge is straight (this side joins a canyon). The bottom-right
corner slopes down and inward into the canyon. Empty transparent background.
Single object, no other scenery.
```

### `cliff-right`

- **Save to:** `src/assets/world/cliff-right.png`
- **Source PNG:** 1024×1024 (displayed at 280×200)

```
{style prefix}
Chunky toy 3D cliff facing LEFT (mirror of the left cliff), lush bright green
grass top edge, warm tan-brown rocky body, soft top-left lighting. Vertical left
edge is straight. The bottom-left corner slopes down and inward into the canyon.
Empty transparent background. Single object.
```

---

## Vehicles

> **Code note:** the current renderer draws the dark wheel circles procedurally even when a sprite is present. For sprite vehicles to look right, the renderer needs a one-line patch to skip the procedural wheels when a vehicle sprite exists. Either generate vehicles **without wheels** for now, or generate with wheels and request the patch before testing.

The prompts below assume the patch lands and the sprite includes wheels (more faithful to the reference image).

### `car`

- **Save to:** `src/assets/world/car.png`
- **Source PNG:** 512×320 (displayed at 80×48)

```
{style prefix}
Chunky toy 3D sedan car viewed from the side, bright orange body with a sloped
white-windowed cabin, two black rubber wheels with light gray hubs, slight front
bumper detail, soft top-down lighting, rounded edges, cute and cheerful. Side
profile only, vehicle horizontal. Empty transparent background.
```

### `truck`

- **Save to:** `src/assets/world/truck.png`
- **Source PNG:** 512×320 (displayed at 80×48)

```
{style prefix}
Chunky toy 3D delivery truck viewed from the side, terracotta-orange cargo box
on the back, short white cab on the right with a blue windshield square, three
black wheels (one front, two dual-rear), soft rounded edges. Side profile, truck
horizontal, facing right. Empty transparent background.
```

### `tank`

- **Save to:** `src/assets/world/tank.png`
- **Source PNG:** 512×320 (displayed at 80×48)

```
{style prefix}
Chunky toy 3D military tank viewed from the side, olive-drab green hull, dark
gray treads with visible segments running along the bottom, small rounded turret
on top with a short barrel pointing right, soft rounded edges, cute toy-like
proportions. Side profile, tank horizontal. Empty transparent background.
```

---

## Clouds

> **Code note:** clouds have no placement code yet. Once PNGs exist, a `drawClouds()` pass needs to be added to `LevelScene` to scatter them across the top third of the canvas. Three variants give visual variety.

### `cloud-1`, `cloud-2`, `cloud-3`

- **Save to:** `src/assets/world/cloud-1.png`, `cloud-2.png`, `cloud-3.png`
- **Source PNG each:** 512×256 (displayed at ~140×70)

Base prompt:

```
{style prefix}
Chunky toy 3D cumulus cloud, pure white with soft cool-blue shadow on the
underside, fluffy round lobes, slightly volumetric like polished clay or felt.
Single cloud, horizontal orientation, empty transparent background.
```

Variants for the second and third clouds (append to the base prompt):

- `cloud-2`: "wider and flatter, more spread out"
- `cloud-3`: "smaller and rounder, two lobes only"

---

## Water

- **Save to:** `src/assets/world/water.png`
- **Source PNG:** 1024×256 (displayed as a tiling band beneath `waterY`)

```
{style prefix}
Stylized toy 3D water surface viewed from a low angle, bright cyan top fading to
deep teal at the bottom, soft repeating wave ripples with white-foam highlights
on the crests, smooth glossy finish. Horizontal seamless tile, edges fade out
softly. Empty transparent background above the waterline.
```

---

## Flag

- **Save to:** `src/assets/world/flag.png`
- **Source PNG:** 256×512 (displayed at ~40×80)

```
{style prefix}
Chunky toy 3D triangular pennant flag on a thin pole, bright orange triangular
flag pointing to the right as if catching wind, soft cream-white pole stuck into
the ground, soft top-left lighting, rounded edges. Single object, vertical
composition. Empty transparent background.
```

---

## Tree

- **Save to:** `src/assets/world/tree.png`
- **Source PNG:** 512×512 (displayed at ~80×80)

```
{style prefix}
Chunky toy 3D round tree, deep saturated green spherical canopy made of two or
three rounded lobes, short stubby brown trunk, soft top-left lighting, cute and
cheerful, cartoon proportions. Single object, vertical. Empty transparent
background.
```

---

## After generation

1. Drop files into `src/assets/world/`.
2. `npm run dev` and reload. Cliffs and vehicles take over from their placeholders automatically.
3. For vehicles: request the one-line patch to suppress procedural wheels (or generate vehicles without wheels in the meantime).
4. For clouds, water, flag, tree to appear, request the placement-code pass in `LevelScene` (`drawClouds`, water band beneath `waterY`, flag at right anchor, etc.).

## Tips for ChatGPT runs

- If DALL·E centers the subject in a square, that's fine — transparency tooling crops to the subject.
- If colors come out muted, append "vibrant saturated colors" again at the end.
- If style drifts toward photorealism on a specific asset, prepend "stylized" and "toy-like" twice.
- Generate all assets in **one chat session** if possible — model style stays more consistent within a single context window.
