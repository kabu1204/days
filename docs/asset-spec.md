# Art Asset Specification

- **Date:** 2026-11-17 (revised 2026-11-21: final built-in art, headpieces)
- **Applies to:** all images used by the interface, whatever their source (self-drawn, commissioned, or licensed packs).
- **Integration point:** `packages/client/src/assets/manifest.ts`. Every image the interface shows is listed there and imported from `packages/client/src/assets/art/`. The built-in images are original art drawn for this project and generated from source drawings (Section 8.4). Replacing a file with one that follows this specification requires no other code change.

---

## 1. General Rules

| Rule | Requirement |
|---|---|
| File format | PNG with transparency (8-bit palette or 32-bit RGBA). |
| Export size | 1× only: one image pixel per art pixel. The application enlarges by whole-number factors without smoothing. |
| Edges | No anti-aliasing, no blur, no soft shadows. Every pixel is either fully transparent or fully opaque. |
| Palette | One shared palette of at most 32 colours for all assets (Section 2). Colours outside the palette are not used. |
| Outline | A 1-pixel outline in the outline colour (`#2e1f2b`, dark plum rather than black) on characters, icons, and stickers, so that they read on both light and dark backgrounds. The upper-left part of a figure's outline may use the soft outline colour (`#5a3a4a`), as the side facing the light. |
| Shading | Three tones per material (highlight, base, shade) with light from the upper left: shade on the lower right, highlight on the upper left. No dithering. |
| Text | No text inside images. All text is set in the interface in both languages. |
| Licence | Every file is recorded in `CREDITS.md` with its source, author, and licence (Section 8). |

---

## 2. Palette

The built-in art uses the 29 colours below (at most 32 are allowed). Each colour has a one-character key used in the source drawings (`packages/client/art/palette.ts`). The style is warm and soft, in the manner of cosy night-restaurant pixel games: plum outlines, cream and paper tones, lantern red and amber accents.

| Role | Colour | Key |
|---|---|---|
| Outline, ink | `#2e1f2b` | `k` |
| Soft outline (lit side), inner lines | `#5a3a4a` | `K` |
| Highlight, paper white | `#fff8ec` | `w` |
| Paper, cream | `#f1dfc0` | `W` |
| Paper shade | `#d6bd98` | `V` |
| Lantern red | `#d1453b` | `r` |
| Red shade | `#93302f` | `R` |
| Amber | `#f0a83a` | `y` |
| Amber light | `#ffd77e` | `Y` |
| Amber shade | `#bf7426` | `o` |
| Leaf green | `#6f9e4c` | `g` |
| Green shade | `#3f6b3a` | `G` |
| Sky blue | `#6fa8d6` | `b` |
| Blue shade | `#3e6a9e` | `B` |
| Night indigo | `#2f3363` | `i` |
| Indigo light | `#525694` | `I` |
| Grey | `#b0a3ad` | `s` |
| Grey shade | `#74677a` | `S` |
| Wood | `#9c5b3b` | `n` |
| Wood shade | `#663a2c` | `N` |
| Wood light | `#cf9259` | `l` |
| Sakura pink | `#f4a8bb` | `p` |
| Pink shade | `#d27590` | `P` |
| Blush | `#ee8c86` | `m` |
| Peach light | `#ffe9d6` | `e` |
| Peach | `#f6c6ae` | `q` |
| Peach shade | `#de9f88` | `Q` |
| Mochi cream | `#fbeedd` | `c` |
| Mochi cream shade | `#e6cbb0` | `C` |

The partners' bodies use three tones that depend on the partner: partner A (cream) `w`, `c`, `C`; partner B (peach) `e`, `q`, `Q`.

Interface colours that are not used in images: page `#f4ecd8`, panel `#e9d8a6`, muted text `#7d6f84`, quiet `#cdbfa6`.

Map colours (vector style, no images): water `#6fa3a8`, land `#e9d8a6`, vegetation `#c2c58a` and `#b5c78f`, buildings `#d2b48c`, roads `#fffaf0`, borders `#2b2233`.

---

## 3. Grid Sizes and Display Sizes

| Asset group | Grid (art pixels) | Shown at | Screen size |
|---|---|---|---|
| Category icons | 12 × 12 | 2×, 3×, 4× | 24, 36, 48 px |
| Map landmark icons | 12 × 12 | 2×, 3× | 24, 36 px |
| Logo | 12 × 12 | 3× | 36 px |
| Reaction stickers | 16 × 16 | 2× | 32 px |
| Decorative stickers | 16 × 16 | 3× | 48 px |
| Characters, headpieces, and pet | 32 × 32 per frame | 2× | 64 px |
| Portraits (optional) | same as the character frame | 1× or 2× | 32 or 64 px |
| Badge icons (Phase 4) | 16 × 16 | 3× | 48 px |

**Character frame size.** 32 × 32 is recommended for a recognisable likeness. 16 × 16 and 24 × 24 are also accepted, provided that both partners and the pet use the same size. The application chooses the whole-number enlargement closest to 48 screen pixels: 3× for 16 × 16, 2× for 24 × 24 and 32 × 32.

---

## 4. Characters: Partners and Pet

### 4.1 Files

| Key | Content |
|---|---|
| `characters/partner-a` | Body of the partner who created the space (member slot 1): a cream mochi (rice-cake) creature |
| `characters/partner-b` | Body of the partner who joined by invitation (member slot 2): a peach mochi creature |
| `characters/pet` | The pet: a cream cat with amber patches and a red collar with a bell |
| `headpieces/rosette` | Red rosette with ribbon tails, worn on the side of the head |
| `headpieces/top-hat` | Indigo top hat with a red band |
| `headpieces/chef-hat` | White chef's hat |
| `headpieces/cat-ears` | Brown cat ears with pink insides |

One sprite sheet per key. All are original designs.

**Headpieces.** A partner is drawn as two layers: the body sheet of their slot, and over it the headpiece sheet they have chosen. Each member chooses one of the four headpieces in the settings (stored as the member's `spriteId`); the defaults are the rosette for partner A and the top hat for partner B. A headpiece sheet has the same layout and frame size as the body sheets and is drawn so that, frame by frame, it sits on the head of either body, following the squash, stretch, and hop of the walk. Everything outside the headpiece is transparent.

### 4.2 Sheet Layout

A sheet is a grid of **4 columns × 8 rows** of equal frames. For 32 × 32 frames the sheet is 128 × 256 pixels.

| Row | Animation | Facing | Frames used | Duration per frame |
|---|---|---|---|---|
| 0 | Idle | Down (towards the viewer) | Columns 0–1 | 500 ms |
| 1 | Idle | Left | Columns 0–1 | 500 ms |
| 2 | Idle | Right | Columns 0–1 | 500 ms |
| 3 | Idle | Up (away from the viewer) | Columns 0–1 | 500 ms |
| 4 | Walk | Down | Columns 0–3 | 125 ms |
| 5 | Walk | Left | Columns 0–3 | 125 ms |
| 6 | Walk | Right | Columns 0–3 | 125 ms |
| 7 | Walk | Up | Columns 0–3 | 125 ms |

- Columns 2–3 of the idle rows stay transparent.
- The right-facing rows must be filled even when they are a mirror image of the left-facing rows.
- Idle: a small loop, for example breathing or blinking. Walk: a full step cycle in four frames (contact, passing, contact, passing). The mochi bodies hop instead: squash, stretch upwards, top of the hop, landing.

### 4.3 Position Within a Frame

- The feet (or paws) touch the bottom pixel row of the frame in every frame, apart from the vertical movement of the walk cycle.
- The figure is centred horizontally.
- At least 1 pixel of transparent margin on the left, right, and top.
- The pet may be drawn smaller than the partners within the same frame size; it stands on the same bottom row.

### 4.4 Portraits (optional)

Dialogue boxes show a portrait of the speaker. Without a portrait file, the first idle frame facing down is used. A portrait file, if supplied, is one frame of the same size showing head and shoulders, facing the viewer.

### 4.5 Where Characters Appear

| Place | Use |
|---|---|
| Timeline | The two partners and the pet stand above the month ruler and walk to the selected month. |
| Map | The same group stands at the selected Place and walks to the next selected Place. |
| Memory page | Portraits in the dialogue boxes and next to reactions. |
| Speech bubbles | A bubble appears above the character who speaks. |

Walks are short (at most 0.6 seconds) and stop at once when the user selects something else.

---

## 5. Icons

### 5.1 Category Icons (12 × 12)

`daily`, `food`, `travel`, `film`, `walk`, `home`, `gift`, `festival`, `music`, `other`

Built-in drawings: sun, steaming bowl, suitcase, clapperboard, shoe, house, gift box, firework, music note, gem.

### 5.2 Map Landmark Icons (12 × 12)

`pin`, `home`, `food`, `park`, `mountain`, `water`, `city`, `station`

Built-in drawings: map pin, house, rice ball, tree, snow-capped mountain, waves, buildings, train.

Landmark icons are drawn on the map, so they need a clear silhouette and an outline that separates them from the map colours.

### 5.3 Logo and Speech Icon (12 × 12)

`logo`: a red paper lantern with a heart. `speech`: a speech bubble, shown next to comment counts.

---

## 6. Stickers (16 × 16)

### 6.1 Reaction Stickers

Placed under a memory, at most one of each kind per partner.

`heart`, `laugh`, `wow`, `tear`, `hug`, `clap`

### 6.2 Decorative Stickers

Placed anywhere on a memory's cover photo, like stickers on a printed photo.

`flower`, `sparkle`, `ribbon`, `sun`, `cloud`, `note`, `leaf`, `cat`, `paw`, `cake`, `balloon`, `moon`

Decorative stickers are placed on photos of any colour, so each needs the outline and at least one light and one dark area.

---

## 7. Interface Frames

Dialog boxes, cards, buttons, and year badges are currently drawn with CSS from the palette and need no image files. If drawn frames are preferred, each is supplied as a nine-slice image:

| Key | Image size | Corner size |
|---|---|---|
| `frame-dialog` | 24 × 24 | 8 × 8 |
| `frame-card` | 24 × 24 | 8 × 8 |
| `frame-button` | 12 × 12 | 4 × 4 |
| `frame-year` | 12 × 12 | 4 × 4 |

The edge segments between the corners are repeated, not stretched, so they must tile without visible seams.

---

## 8. Delivery

### 8.1 File Locations and Names

```
packages/client/src/assets/art/
  characters/partner-a.png      partner-b.png      pet.png
  headpieces/rosette.png        top-hat.png        chef-hat.png      cat-ears.png
  portraits/partner-a.png       (optional, same for the others)
  categories/<key>.png
  places/<key>.png
  stickers/<key>.png
  logo.png
  speech.png
  CREDITS.md
```

File names are the keys listed in this document, in lower case.

### 8.2 Licence Record

`CREDITS.md` lists, for every file or group of files:

- source (author, shop, or pack name, and address);
- licence (for example CC0, CC-BY 4.0, CC-BY-SA 4.0, or the terms of a purchase or commission);
- required attribution text, if any;
- changes made, if the licence requires them to be stated.

Licences that forbid modification, or that limit use to non-private or non-commercial projects in a way that conflicts with a private two-person application, are not used. For commissioned work, the agreement should allow use in this application and in its exports, and modification.

### 8.3 Acceptance Check

1. The file has the exact size given by this document (for a 32 × 32 character sheet: 128 × 256).
2. All pixels are fully transparent or fully opaque.
3. All colours are in the palette.
4. The file appears correctly on the pixel-rendering validation page (Settings → Validation pages → Pixel rendering) on both phones.
5. The file is listed in `CREDITS.md`.

### 8.4 Source Drawings and Build

The built-in images are not edited as PNG files. They are generated from source drawings in `packages/client/art/`:

| File | Content |
|---|---|
| `palette.ts` | The palette of Section 2 and the body tones of the two partners |
| `render.ts` | A small rasteriser for cel-shaded figures: shapes drawn back to front, outline, inner lines, shade and highlight |
| `characters.ts` | The mochi bodies (poses per frame, face per facing) |
| `headpieces.ts` | The four headpieces, placed on the head in every frame |
| `pet.ts` | The cat |
| `stickers.ts`, `icons.ts` | Stickers, category and landmark icons, logo, speech icon |
| `build.ts`, `png.ts` | Builds all files and encodes PNG |
| `check.ts` | The acceptance check of Section 8.3, items 1–3 |

After changing a drawing, run:

```bash
pnpm art
```

This writes every file of Section 8.1, writes `CREDITS.md`, writes a contact sheet of all art to `docs/art/preview.png`, and runs the acceptance check. Generated files are committed.

To use art from another source instead, replace the PNG file with one that follows this specification and stop regenerating that file (or remove its drawing from `build.ts`), and record it in `CREDITS.md`.
