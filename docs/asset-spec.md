# Art Asset Specification

- **Date:** 2026-11-17
- **Applies to:** all images used by the interface, whatever their source (self-drawn, commissioned, or licensed packs).
- **Integration point:** `packages/client/src/assets/manifest.ts`. Every image the interface shows is listed there. Until final art exists, each entry is a generated placeholder. Replacing an entry with a file that follows this specification requires no other code change.

---

## 1. General Rules

| Rule | Requirement |
|---|---|
| File format | PNG with transparency (8-bit palette or 32-bit RGBA). |
| Export size | 1× only: one image pixel per art pixel. The application enlarges by whole-number factors without smoothing. |
| Edges | No anti-aliasing, no blur, no soft shadows. Every pixel is either fully transparent or fully opaque. |
| Palette | One shared palette of at most 32 colours for all assets (Section 2). Colours outside the palette are not used. |
| Outline | A 1-pixel outline in the outline colour (`#2b2233`) on characters, icons, and stickers, so that they read on both light and dark backgrounds. |
| Text | No text inside images. All text is set in the interface in both languages. |
| Licence | Every file is recorded in `CREDITS.md` with its source, author, and licence (Section 8). |

---

## 2. Palette

The placeholders use the ten colours below. The final palette may add colours up to a total of 32, and may adjust these values; the interface colours in `app.scss` and the map style are then updated to match.

| Role | Colour | Placeholder letter |
|---|---|---|
| Outline, ink | `#2b2233` | `k` |
| Highlight, paper white | `#fffaf0` | `w` |
| Accent red | `#c8553d` | `r` |
| Gold | `#e0a43a` | `y` |
| Green | `#3d7a6a` | `g` |
| Blue | `#4a7fb5` | `b` |
| Brown | `#8a5a3c` | `n` |
| Skin | `#f2c6a0` | `p` |
| Grey | `#9a8fa3` | `s` |
| Pink (cheeks, hearts) | `#e58a9a` | `m` |

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
| Characters and pet | 32 × 32 per frame (recommended) | 2× | 64 px |
| Portraits (optional) | same as the character frame | 1× or 2× | 32 or 64 px |
| Badge icons (Phase 4) | 16 × 16 | 3× | 48 px |

**Character frame size.** 32 × 32 is recommended for a recognisable likeness. 16 × 16 and 24 × 24 are also accepted, provided that both partners and the pet use the same size. The application chooses the whole-number enlargement closest to 48 screen pixels: 3× for 16 × 16, 2× for 24 × 24 and 32 × 32.

---

## 4. Characters: Partners and Pet

### 4.1 Files

| Key | Content |
|---|---|
| `partner-a` | The partner who created the space (member slot 1) |
| `partner-b` | The partner who joined by invitation (member slot 2) |
| `pet` | The pet |

One sprite sheet per key.

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
- Idle: a small loop, for example breathing or blinking. Walk: a full step cycle in four frames (contact, passing, contact, passing).

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

### 5.2 Map Landmark Icons (12 × 12)

`pin`, `home`, `food`, `park`, `mountain`, `water`, `city`, `station`

Landmark icons are drawn on the map, so they need a clear silhouette and an outline that separates them from the map colours.

### 5.3 Logo (12 × 12)

`logo`

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
  portraits/partner-a.png       (optional, same for the others)
  categories/<key>.png
  places/<key>.png
  stickers/<key>.png
  logo.png
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

### 8.4 Swapping a Placeholder

In `manifest.ts`, replace the generated value with an import of the file, for example:

```ts
import partnerA from './art/characters/partner-a.png'

export const characterSheets = {
  'partner-a': { src: partnerA, frameWidth: 32, frameHeight: 32 },
  // ...
}
```
