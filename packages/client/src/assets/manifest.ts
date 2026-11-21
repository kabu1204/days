import type { BadgeKey, BodyKey, CategoryKey, HeadpieceKey, PlaceIconKey, StickerKey } from '@days/shared'
// Generated images: run `pnpm art` after changing a drawing in packages/client/art/.
import bodyCream from './art/bodies/cream.png'
import bodyPeach from './art/bodies/peach.png'
import bodySakura from './art/bodies/sakura.png'
import bodyMatcha from './art/bodies/matcha.png'
import bodyKinako from './art/bodies/kinako.png'
import bodySesame from './art/bodies/sesame.png'
import pet from './art/characters/pet.png'
import headRosette from './art/headpieces/rosette.png'
import headTopHat from './art/headpieces/top-hat.png'
import headChefHat from './art/headpieces/chef-hat.png'
import headCatEars from './art/headpieces/cat-ears.png'
import badgeFirstMemory from './art/badges/first-memory.png'
import badgeTenMemories from './art/badges/ten-memories.png'
import badgeHundredMemories from './art/badges/hundred-memories.png'
import badgeFirstTrip from './art/badges/first-trip.png'
import badgeFoodie from './art/badges/foodie.png'
import badgeFivePlaces from './art/badges/five-places.png'
import badgeThreeCities from './art/badges/three-cities.png'
import badgeBothHands from './art/badges/both-hands.png'
import badgeAlbum from './art/badges/album.png'
import badgeOneYear from './art/badges/one-year.png'
import badgeKeyDate from './art/badges/key-date.png'
import badgeWishGranted from './art/badges/wish-granted.png'
import chestClosedPng from './art/chest-closed.png'
import chestOpenPng from './art/chest-open.png'
import pointerPng from './art/pointer.png'
import stickerHeart from './art/stickers/heart.png'
import stickerLaugh from './art/stickers/laugh.png'
import stickerWow from './art/stickers/wow.png'
import stickerTear from './art/stickers/tear.png'
import stickerHug from './art/stickers/hug.png'
import stickerClap from './art/stickers/clap.png'
import stickerFlower from './art/stickers/flower.png'
import stickerSparkle from './art/stickers/sparkle.png'
import stickerRibbon from './art/stickers/ribbon.png'
import stickerSun from './art/stickers/sun.png'
import stickerCloud from './art/stickers/cloud.png'
import stickerNote from './art/stickers/note.png'
import stickerLeaf from './art/stickers/leaf.png'
import stickerCat from './art/stickers/cat.png'
import stickerPaw from './art/stickers/paw.png'
import stickerCake from './art/stickers/cake.png'
import stickerBalloon from './art/stickers/balloon.png'
import stickerMoon from './art/stickers/moon.png'
import stickerMochiStar from './art/stickers/mochi-star.png'
import stickerMochiWink from './art/stickers/mochi-wink.png'
import stickerMochiSleep from './art/stickers/mochi-sleep.png'
import stickerMochiHeart from './art/stickers/mochi-heart.png'
import categoryDaily from './art/categories/daily.png'
import categoryFood from './art/categories/food.png'
import categoryTravel from './art/categories/travel.png'
import categoryFilm from './art/categories/film.png'
import categoryWalk from './art/categories/walk.png'
import categoryHome from './art/categories/home.png'
import categoryGift from './art/categories/gift.png'
import categoryFestival from './art/categories/festival.png'
import categoryMusic from './art/categories/music.png'
import categoryOther from './art/categories/other.png'
import placePin from './art/places/pin.png'
import placeHome from './art/places/home.png'
import placeFood from './art/places/food.png'
import placePark from './art/places/park.png'
import placeMountain from './art/places/mountain.png'
import placeWater from './art/places/water.png'
import placeCity from './art/places/city.png'
import placeStation from './art/places/station.png'
import logoPng from './art/logo.png'
import speechPng from './art/speech.png'

/**
 * The single source of all art used by the interface. Every image is original
 * art generated from the drawings in `packages/client/art/` (docs/asset-spec.md).
 */

/** Category icons (12 × 12 pixel grid). */
export const categoryIcons: Record<CategoryKey, string> = {
  daily: categoryDaily,
  food: categoryFood,
  travel: categoryTravel,
  film: categoryFilm,
  walk: categoryWalk,
  home: categoryHome,
  gift: categoryGift,
  festival: categoryFestival,
  music: categoryMusic,
  other: categoryOther,
}

/** A paper lantern with a heart (12 × 12 pixel grid). */
export const logo: string = logoPng

/** One sprite sheet: 4 columns × 8 rows of frames (docs/asset-spec.md, Section 4). */
export interface CharacterSheet {
  src: string
  frameWidth: number
  frameHeight: number
}
/** Sheets drawn over one another, bottom first; all have the same frame size. */
export type Look = CharacterSheet[]

const FRAME = 32
const sheetOf = (src: string): CharacterSheet => ({ src, frameWidth: FRAME, frameHeight: FRAME })

/** The partners' bodies, one per flavour. */
export const bodySheets: Record<BodyKey, CharacterSheet> = {
  cream: sheetOf(bodyCream),
  peach: sheetOf(bodyPeach),
  sakura: sheetOf(bodySakura),
  matcha: sheetOf(bodyMatcha),
  kinako: sheetOf(bodyKinako),
  sesame: sheetOf(bodySesame),
}

/** The pet (a cat). */
export const petSheet: CharacterSheet = sheetOf(pet)

/** Headpiece overlays, aligned frame by frame with the partners' bodies. */
export const headpieceSheets: Record<HeadpieceKey, CharacterSheet> = {
  'rosette': sheetOf(headRosette),
  'top-hat': sheetOf(headTopHat),
  'chef-hat': sheetOf(headChefHat),
  'cat-ears': sheetOf(headCatEars),
}

/** Reaction and decorative stickers (16 × 16 pixel grid). */
export const stickerIcons: Record<StickerKey, string> = {
  heart: stickerHeart,
  laugh: stickerLaugh,
  wow: stickerWow,
  tear: stickerTear,
  hug: stickerHug,
  clap: stickerClap,
  flower: stickerFlower,
  sparkle: stickerSparkle,
  ribbon: stickerRibbon,
  sun: stickerSun,
  cloud: stickerCloud,
  note: stickerNote,
  leaf: stickerLeaf,
  cat: stickerCat,
  paw: stickerPaw,
  cake: stickerCake,
  balloon: stickerBalloon,
  moon: stickerMoon,
  'mochi-star': stickerMochiStar,
  'mochi-wink': stickerMochiWink,
  'mochi-sleep': stickerMochiSleep,
  'mochi-heart': stickerMochiHeart,
}

/** Speech icon shown with comment counts (12 × 12 pixel grid). */
export const speechIcon: string = speechPng

/** Landmark icons for Places on the map and in lists (12 × 12 pixel grid). */
export const placeIcons: Record<PlaceIconKey, string> = {
  pin: placePin,
  home: placeHome,
  food: placeFood,
  park: placePark,
  mountain: placeMountain,
  water: placeWater,
  city: placeCity,
  station: placeStation,
}

/** Badge medals for the album (16 × 16 pixel grid). */
export const badgeIcons: Record<BadgeKey, string> = {
  'first-memory': badgeFirstMemory,
  'ten-memories': badgeTenMemories,
  'hundred-memories': badgeHundredMemories,
  'first-trip': badgeFirstTrip,
  'foodie': badgeFoodie,
  'five-places': badgeFivePlaces,
  'three-cities': badgeThreeCities,
  'both-hands': badgeBothHands,
  'album': badgeAlbum,
  'one-year': badgeOneYear,
  'key-date': badgeKeyDate,
  'wish-granted': badgeWishGranted,
}

/** The treasure chest of the random flashback (16 × 16) and the food wheel's pointer (12 × 12). */
export const chestIcons = { closed: chestClosedPng, open: chestOpenPng }
export const pointerIcon: string = pointerPng
