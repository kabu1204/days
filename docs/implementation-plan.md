# Pixel-RPG Relationship Memory Book — Implementation Plan

- **Date:** 2026-11-14
- **Status:** Agreed plan for the first implementation (web build). Two points remain open; see Section 11.
- **Basis:** Product requirements document, Sections 1–4 (positioning, functional requirements, visual requirements, data ownership).

---

## 1. Scope

### 1.1 Confirmed decisions

| Topic | Decision |
|---|---|
| Client technology | Taro + React + TypeScript |
| Build target | H5 (web) only |
| WeChat Mini Program | Out of scope for this plan. Migration and adaptation will be done later by the project owner. |
| Domain | No ICP-filed domain is available. |
| Users | Exactly two people, bound one-to-one. |

### 1.2 Priorities

The core value of the product is in requirement Sections 2.1 (timeline and map views) and 2.2 (memory logging and co-creation). Sections 2.3 (avatars and pet) and 2.4 (playful features) are enhancements and are delivered after the core.

### 1.3 Excluded from the first version

- Video and Live Photos
- A character editor for avatars (fixed sprites are used instead)
- End-to-end encryption
- Push notifications
- Printed keepsake book layout (the export archive is the input for this later)

---

## 2. Main Technical Risk: Photo Location in Mobile Browsers

Requirement 2.2 assumes that GPS coordinates can be read from selected photos. In mobile browsers this is not guaranteed.

- **Android:** Photos selected through a web page are delivered without coordinates; only native applications holding a specific permission receive them [1]. A user-controlled option in the system photo picker was reported in 2026 [2]; whether it applies to browsers is not confirmed.
- **iOS:** Behaviour depends on the system version. From iOS 16.4, coordinates were removed while other metadata, including timestamps, was kept [3]. A later developer report states that coordinates are retained on iPadOS 17.4.1 and 18.3 [4].

**Consequences for the design**

1. The behaviour is tested on both partners' phones before other work starts (Phase 0, test a).
2. Automatic filing by year and month relies on the timestamp, which is expected to survive in both cases.
3. When coordinates are absent, the user selects a saved Place or picks a point on the map. This path is always available, because older photos and screenshots need it in any case.
4. Bulk import of existing photos is done in a desktop browser, where files read from disk keep their full metadata.

---

## 3. Resolutions for Points Left Open by the Requirements

| Point | Resolution | Reason |
|---|---|---|
| Meaning of "retro adventure-styled map" | A real geographic map with a restricted retro colour palette and no text labels, with pixel-art landmark icons on top. Rendering at reduced resolution and enlarging without smoothing is tested in Phase 0 as a way to obtain a pixel look. | A fully hand-drawn map cannot represent arbitrary real coordinates. |
| Same-location grouping | "Place" is a stored entity. A new memory within about 100 m of an existing Place is offered that Place. Users can rename, merge, and separate Places. | GPS readings for the same venue differ between visits, so grouping by raw coordinates is unreliable. |
| Dates | Each memory has a start date, an optional end date, and a precision (day or month). A memory is filed under the month of its start date. | Older memories often have no exact day; trips span several days. |
| Location per memory | One Place per memory (optional). Individual photos keep their own coordinates when available. | Keeps the map and the timeline consistent with each other. |
| Existing history | A desktop bulk import: select many photos, group them by day and by distance, then confirm and title each group. | The first use of the product is importing years of photos. |
| "Custom avatars" | Fixed sprite sheets drawn once for the two partners and the pet. | A character editor multiplies the art workload for two users. |
| Privacy model | The server is trusted. Files are private and are served only to the two signed-in accounts. | End-to-end encryption complicates image previews, export, and account recovery. |
| Editing rights | Both partners may edit every memory. Deleted items are recoverable for 30 days. Either partner may export the full archive at any time. | The requirements do not cover accidental deletion or the end of the pairing. |
| Partner activity | A quiet marker on new items inside the application. | Consistent with the zero-pressure principle. |
| Empty periods and badges | No counters of missing days, no progress bars toward badges. Badges appear only when unlocked. | Consistent with the zero-pressure principle. |

---

## 4. Architecture

### 4.1 Overview

```
Phone / desktop browser
  Taro H5 application (React, TypeScript)
    - Timeline view, memory editor, image viewer   (Taro components)
    - FootprintMap component                        (browser-only)
    - Photo metadata reader                         (browser-only)
    - Sprite layer for avatars and pet              (browser-only)
            |
            |  HTTPS, JSON API, file upload
            v
  Server (TypeScript)
    - API and session handling
    - Image processing (browsing copies)
    - Export archive builder
    - SQLite database, files on disk, nightly backup
```

### 4.2 Component decisions

| Component | Decision | Reason |
|---|---|---|
| Interface | Taro components with pixel-styled borders, dialogs, and buttons. System dialogs are not used. | Requirement 3: unified RPG appearance. |
| Browser-only code | Confined to three modules: the map component, the photo metadata reader, and the sprite layer. | Keeps the rest of the code independent of the page model. |
| Map | MapLibre GL inside one `FootprintMap` component (inputs: places, focus target, sprite position; outputs: place selected, view changed). | Taro's own `Map` component is not implemented for H5 [5]. |
| Map tiles | A regional map extract hosted as a single static file on the project's server (for example in the PMTiles format). Alternative: a domestic map provider's web interface. Chosen in Phase 0. | No dependence on overseas tile services. These tiles use WGS-84, the same system as photo metadata, so no coordinate conversion is required. |
| Pixel rendering | Fixed pixel units for sprites, borders, and the typeface; unsmoothed image scaling; assets exported at whole-number enlargements. | Taro's default unit conversion scales sizes with screen width, which can blur pixel art. To be confirmed in Phase 0, test c. |
| Typeface | Fusion Pixel Font (8, 10, and 12 pixel sizes, SIL Open Font License 1.1) [6], reduced to the characters needed if the file size requires it. | The related Ark Pixel project still lacks many Chinese characters and refers production users to Fusion Pixel [7]. |
| Image viewer | A custom pixel-framed viewer with pinch zoom that loads the original on demand. | Requirement 3: high-resolution viewing with a consistent appearance. |
| Images | The original is stored unmodified. The server creates a thumbnail (about 400 px on the long edge) and a medium copy (about 1600 px). Metadata is removed from the copies and kept in the original. | Fast lists and previews; originals preserved for export. |
| Identity | Two accounts. The first account creates the shared space and issues a single-use invitation link for the second. Sessions are long-lived. | Requirement 4: one-to-one binding, no public registration. |
| Two-member limit | Enforced in the database, not only in the interface. | The binding must hold even if the interface is bypassed. |
| Simultaneous edits | Photos, comments, and stickers are added as new records. For titles and notes, the most recent save is kept. | Two users rarely edit the same field at the same time. |
| Backend | A small TypeScript server, SQLite, files on disk, sharing type definitions with the client. | Two users do not need more infrastructure. |
| Export | The server builds a ZIP archive: originals in `YYYY/MM/` folders, one data file with all text, and a static page for offline browsing. | Requirement 4: full data ownership, readable without the service. |
| Backup | Nightly copy of the database and files to a second location. | The archive is irreplaceable. |

---

## 5. Data Model

| Entity | Main fields | Notes |
|---|---|---|
| Space | id, created_at | Exactly one per pairing |
| Member | id, space_id, display_name, sprite_id | At most two per Space |
| Invitation | token, space_id, used_at | Single use |
| Memory | id, space_id, title, note, start_date, end_date, date_precision, category, place_id, created_by, created_at, deleted_at | `deleted_at` implements the 30-day recovery period |
| Photo | id, memory_id, uploaded_by, original_path, medium_path, thumb_path, taken_at, latitude, longitude, sort_order | Coordinates in WGS-84, may be empty |
| Place | id, space_id, name, latitude, longitude, city, icon | Shared by all memories at that location |
| Comment | id, memory_id, author_id, text, created_at | Displayed as RPG dialogue boxes |
| Sticker placement | id, memory_id, sticker_key, placed_by, x, y | Decorative stickers and reactions |
| Badge unlock | id, space_id, badge_key, unlocked_at | Rules are evaluated when data is saved |
| Key date | id, space_id, label, date | Used for anniversary countdowns in speech bubbles |
| Wish item | id, space_id, kind (destination or food), text, done | Source list for the date decision tools |

---

## 6. Delivery Phases

Effort is a rough estimate in focused working days for one developer and excludes art production. Each phase ends in a usable product.

### Phase 0 — Validation (about 2 days)

| Test | Question answered | Result decides |
|---|---|---|
| a. Select photos on both phones in the browser and read their metadata | Are coordinates and timestamps available? | Whether location entry is automatic or manual on phones |
| b. MapLibre inside a Taro H5 page with self-hosted tiles, the retro palette, and one pixel marker | Is the map appearance and loading speed acceptable? | Tile source; whether the reduced-resolution rendering is used |
| c. One fully styled screen with the pixel typeface, a dialog frame, and one animated sprite | Is pixel art sharp at all screen sizes? | Unit settings and asset export sizes |

### Phase 1 — Core record (6–8 days)

- Accounts, shared space, single-use invitation
- Memory creation: photos (single and multiple), title, note, date, category icon, automatic date from metadata
- Timeline: year nodes, month ruler with lit and quiet months, monthly card list, detail view
- Image copies for browsing, image viewer with zoom
- Export archive
- Desktop bulk import

**Complete when:** both partners can sign in, import existing photos, browse them by year and month on their phones, and download a full export.

### Phase 2 — Map (4–6 days)

- Place entity, automatic Place suggestion, manual Place selection, merge and separate
- Map view with pixel landmarks and grouping at low zoom levels
- Chronological browsing of all memories at one Place
- Two-way navigation: location tag to map; map memory to its month on the timeline

**Complete when:** every memory with a Place is reachable from both views, and switching between them keeps the selected memory.

### Phase 3 — Co-creation and characters (5–7 days)

- Adding photos to a partner's memory
- Dialogue-box comments, reaction and decorative stickers
- Quiet marker for new items
- Avatars and pet as the reading cursor on the timeline and the map; movement is short and can be interrupted
- Speech bubbles: quotes from past memories, anniversary countdowns, everyday lines

### Phase 4 — Playful features (3–5 days)

- Random flashback (treasure chest)
- Badges and collection album, with rules evaluated when data is saved
- Date decision tools (destination draw, food wheel) with a wish list; a result becomes a memory draft

**Total:** about 20–28 focused days.

---

## 7. Art Assets

Art production is the largest cost not stated in the requirements.

| Asset | Quantity (first version) |
|---|---|
| Partner sprites: idle and walking in four directions | 2 characters |
| Pet sprite: idle and walking | 1 |
| Category icons (food, travel, film, walk, and others) | about 10 |
| Decorative and reaction stickers | about 20 |
| Interface frames: dialog, card (Polaroid), button, year badge | about 6 |
| Landmark icons for the map | about 8 |
| Badge icons | about 10 |
| Colour palette and map style | 1 |

---

## 8. Privacy and Data Ownership

- No public pages, no discovery, no sharing features.
- No live location. Coordinates exist only on Photos and Places.
- All files require a signed-in session of one of the two members.
- Metadata is removed from browsing copies and kept only in originals.
- Either partner can export everything at any time.
- All traffic uses HTTPS.

---

## 9. Hosting

Development runs locally. Without an ICP-filed domain, a mainland server cannot serve the site publicly, so the choices for regular use are:

1. A server outside the mainland.
2. A machine on the home network.

This decision is needed near the end of Phase 1 and does not affect earlier work.

---

## 10. Risks

| Risk | Effect | Response |
|---|---|---|
| Coordinates unavailable on one or both phones | Location is not automatic on phones | Manual Place selection; desktop bulk import |
| Preparing self-hosted map tiles is costly | Delay in Phase 2 | Use a domestic map provider's web interface (requires conversion to GCJ-02 for display) |
| Chinese pixel typeface file is large | Slow first load | Reduce to the characters needed; cache in the browser |
| Art production takes longer than development | Phase 3 delayed | Phases 1 and 2 need only icons and frames; sprites are required from Phase 3 |
| Loss of the server | Loss of the archive | Nightly backup to a second location; regular exports |

---

## 11. Open Points

1. **Hosting location** (Section 9) — needed near the end of Phase 1.
2. **Art source** — self-drawn, commissioned, or licensed asset packs. Affects Phase 0 test c and Phase 3.

---

## References

1. Android metadata removal on web upload — https://www.technetexperts.com/fix-android-exif-data-upload/amp/
2. Android Photo Picker location control (2026) — https://nokiapoweruser.com/android-photo-picker-location-metadata-privacy-update/
3. WebKit bug 257534, location removed from file input on iOS 16.4 — https://bugs.webkit.org/show_bug.cgi?id=257534
4. Apple Developer Forums thread 773990 — https://developer.apple.com/forums/thread/773990
5. Taro documentation, component description (Map not supported on H5) — https://nervjs.github.io/taro/en/docs/components-desc
6. Fusion Pixel Font — https://github.com/TakWolf/fusion-pixel-font
7. Ark Pixel Font — https://github.com/TakWolf/ark-pixel-font
