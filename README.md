# Days

A pixel-RPG styled memory book for exactly two people. This repository contains the first web build (Taro H5): Phase 0 (validation pages), Phase 1 (core record), Phase 2 (map), and Phase 3 (co-creation and characters) of the [implementation plan](docs/implementation-plan.md).

## Contents

| Path | Content |
|---|---|
| `packages/shared` | Types and logic used by both sides: date filing, bulk-import grouping, Place suggestion, marker grouping |
| `packages/server` | Hono server: accounts, memories, photo storage, export, SQLite |
| `packages/client` | Taro 4 application (React, TypeScript), built for H5 |
| `e2e` | End-to-end check that drives a browser through the full flow |
| `docs` | The implementation plan and the [art asset specification](docs/asset-spec.md) |

## Requirements

- Node.js 22 or later
- pnpm 10

## Development

```bash
pnpm install
```

Start the server (port 8787, data in `packages/server/data/`):

```bash
pnpm dev:server
```

Start the client with live reload (port 10086; requests to `/api`, `/files`, and `/tiles` are forwarded to the server):

```bash
pnpm dev:client
```

Open `http://localhost:10086/`. The first visit shows the setup page for the first account. The second account is created through the single-use invitation link shown on the settings page.

## Regular use (one process)

```bash
pnpm build
```

```bash
DATA_DIR=/var/lib/days COOKIE_SECURE=1 pnpm start
```

The server then also serves the built client. Place it behind a reverse proxy that provides HTTPS.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listening port |
| `HOST` | `0.0.0.0` | Listening address |
| `DATA_DIR` | `packages/server/data` | Database (`days.sqlite`), photo files (`files/`), map tiles (`tiles/`) |
| `MAP_TILES` | first `.pmtiles` file in `DATA_DIR/tiles/` | File name of the map tile file used by the map view |
| `COOKIE_SECURE` | off | Set to `1` when served over HTTPS, so that the session cookie is sent only over HTTPS |
| `SETUP_TOKEN` | none | When set, creating the first account requires this value. Recommended on a server reachable from the internet, because otherwise the first visitor can create the space. |
| `MAX_UPLOAD_MB` | `60` | Largest accepted photo file |
| `CLIENT_DIST` | `packages/client/dist` | Location of the built client |

### Backup

```bash
BACKUP_DIR=/mnt/backup/days pnpm --filter @days/server backup
```

This copies the database consistently and copies photo files that are not yet in the destination. Run it nightly with a scheduler.

## Tests

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build && pnpm e2e
```

The end-to-end check needs Playwright with Chromium. It writes screenshots to `e2e/out/`.

## Phase 0: validation pages

The three pages are reachable from the settings page, or directly. They do not require an account.

| Test | Address | What to check |
|---|---|---|
| a. Photo metadata | `/#/pages/lab/exif` | On **both phones**, select several photos from the photo library. The page reports for each photo whether capture time and coordinates were delivered by the browser. |
| b. Map | `/#/pages/lab/map` | Enter the address of a PMTiles file and judge appearance and load time, with and without reduced-resolution rendering. |
| c. Pixel rendering | `/#/pages/lab/pixel` | On different screens, check that text, frame, sprite, and icons have sharp, even edges, and note which text sizes are acceptable. |

Test a must be performed on the phones themselves, over the network address of the development machine or of the deployed server.

### Map tiles

The map view and test b expect a PMTiles file in the Protomaps basemap layout. A regional extract can be created with the `pmtiles` command-line tool from a Protomaps daily build, for example for the Yangtze River Delta:

```bash
pmtiles extract https://build.protomaps.com/20260101.pmtiles region.pmtiles --bbox=118.0,29.0,123.0,33.0 --maxzoom=14
```

Place the file in `DATA_DIR/tiles/`; the server serves it at `/tiles/region.pmtiles`. The map view uses it automatically (or the file named by `MAP_TILES`); on the test page, enter that address. Without a tile file, the map view shows the Place markers on a plain background.

In this repository the map has been checked only with a small generated tile file (see `e2e/make-pmtiles.ts`), not with a real regional extract.

## What is implemented

- Two accounts, bound one-to-one. The limit of two members is enforced by the database schema. The invitation link works once; creating a new link cancels the previous one.
- Memories with title, note, start date, optional end date, day or month precision, and a category. Both members can edit every memory.
- Photos: the original is stored unchanged; a thumbnail (400 px) and a medium copy (1600 px) are created without metadata. Capture time and coordinates are read from the photo.
- Timeline: year nodes, month ruler with lit and quiet months, monthly card list, detail view, image viewer with pinch zoom that loads the original on demand.
- Desktop bulk import: photos are grouped by day and by distance; groups can be renamed, re-dated, merged, split, and skipped before import.
- Trash: deleted memories and photos can be restored for 30 days.
- Export: a ZIP archive with originals in `YYYY/MM/` folders, `data.json` with all text, and `index.html` for browsing without the service.
- Interface in Simplified Chinese and English.
- Places (Phase 2): one optional Place per memory, shared by all memories at that location. When the photos of a new memory have coordinates, a saved Place within 100 m is offered, or a new Place at the photo location. Without coordinates, a saved Place is chosen from a list with search, or a point is chosen on the map. Places can be renamed, moved, merged, separated (selected memories move to a new Place), and deleted (the memories are kept).
- Bulk import proposes a saved Place for each group whose photos are within 100 m of it; a new Place can be named for a group during review.
- Map view: all Places with memories, with landmark icons; markers that would overlap are grouped into one numbered marker at low zoom levels. Selecting a Place lists its memories oldest first.
- Two-way navigation: the location tag of a memory opens the map at its Place with the memory selected; each memory on the map opens its month on the timeline with the card selected; the map button on the timeline returns to the Place of the selected memory.
- The map is drawn at reduced resolution (pixel style) by default; this can be switched per device in the settings.
- The export archive includes all Places, and each memory names its Place.

- Co-creation (Phase 3): either partner can add photos to any memory; when both have contributed, each photo shows a small portrait of the member who added it.
- Conversation: comments appear as dialogue boxes with the author's portrait. Only the author can delete a line; deleted lines can be restored from the trash for 30 days.
- Stickers: six reactions (at most one of each kind per member, shown with the portraits of those who placed them) and twelve decorative stickers placed anywhere on the cover photo (at most 20 per cover; either member can remove them). Cards on the timeline show the decorative stickers, the reactions, and the number of conversation lines.
- Quiet marker for new items: a memory is marked "New" when the partner created or edited it, or added photos, comments, or stickers, since the viewer last opened it. Months and years with such memories carry a small mark. Opening the memory clears the mark. Items that existed before a member joined are never marked.
- Characters: the two partners and the pet stand above the month ruler and walk to the selected month; on the map they stand at the selected Place and walk to the next one. Walks last at most 0.6 seconds, stop at once on a new selection, and are replaced by an immediate move when the device asks for reduced motion.
- Speech bubbles: key dates on the day and in the 30 days before, memories from the same day in earlier years, quotes from notes and comments, and everyday lines by time of day. The first line appears once per visit; tapping the characters shows the next one; a line about a memory opens it. No line refers to missing entries or to time since the last entry.
- Key dates are managed in the settings and included in the export, together with comments and stickers.

Not yet implemented: playful features (Phase 4).

## Notes for later work

### Art

All built-in images are original pixel art drawn for this project: the two partners are round mochi (rice-cake) creatures, cream for partner A and peach for partner B, and the pet is a cat. Each member chooses a headpiece in the settings (rosette, top hat, chef's hat, or cat ears), drawn as a layer over the body. The icons, stickers, and the logo (a paper lantern with a heart) use the same warm palette and three-tone shading.

The images are generated from source drawings in `packages/client/art/` with `pnpm art`, which also checks them against the specification and writes a contact sheet to [docs/art/preview.png](docs/art/preview.png). They are listed in `packages/client/src/assets/manifest.ts`. Sizes, sheet layout, palette, and delivery are specified in [docs/asset-spec.md](docs/asset-spec.md).

### Typeface

The interface uses [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) (12 px, proportional, Simplified Chinese), licensed under the SIL Open Font License 1.1, installed through the `@fontsource/fusion-pixel-12px-proportional-sc` package. The font file is about 600 KB and is cached by the browser.

### Mini program migration

Code that depends on the browser is confined to `packages/client/src/browser/` (file selection and photo metadata, the map component and its on-demand loader, font registration, scrolling to an element) and to `uploadPhoto` in `packages/client/src/api/client.ts`. All other code uses Taro components and Taro APIs. Unit conversion is disabled for H5 so that pixel art keeps fixed sizes.

### Hosting

The hosting location is still open (Section 9 of the plan). The server is a single Node.js process with one data directory, which suits either option.
