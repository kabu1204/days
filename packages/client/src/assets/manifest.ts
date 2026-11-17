import type { CategoryKey, PlaceIconKey } from '@days/shared'
import { pixelSvg } from './pixel'

/**
 * The single source of all art used by the interface. Every entry is a
 * placeholder. To use final art, replace a value with an imported image file
 * exported at a whole-number enlargement of its pixel grid.
 */

export const categoryIcons: Record<CategoryKey, string> = {
  daily: pixelSvg([
    '............', '.....yy.....', '..y..yy..y..', '...y....y...', '....yyyy....', '.yy.yyyy.yy.',
    '.yy.yyyy.yy.', '....yyyy....', '...y....y...', '..y..yy..y..', '.....yy.....', '............',
  ]),
  food: pixelSvg([
    '............', '....s..s....', '...s..s.....', '....s..s....', '............', 'kkkkkkkkkkkk',
    'krrrrrrrrrrk', '.krrrrrrrrk.', '.krrrrrrrrk.', '..krrrrrrk..', '...kkkkkk...', '............',
  ]),
  travel: pixelSvg([
    '............', '....kkkk....', '....k..k....', '.kkkkkkkkkk.', '.knnnnnnnnk.', '.knnnnnnnnk.',
    '.kyynnnnyyk.', '.knnnnnnnnk.', '.knnnnnnnnk.', '.kkkkkkkkkk.', '..kk....kk..', '............',
  ]),
  film: pixelSvg([
    '............', '.kkkkkkkkkk.', '.kwkwkwkwkk.', '.kkwkwkwkwk.', '.kkkkkkkkkk.', '.kssssssssk.',
    '.kssssssssk.', '.kssssssssk.', '.kssssssssk.', '.kkkkkkkkkk.', '............', '............',
  ]),
  walk: pixelSvg([
    '............', '....gggg....', '...gggggg...', '..gggggggg..', '..gggggggg..', '...gggggg...',
    '....gggg....', '.....nn.....', '.....nn.....', '.....nn.....', '...gggggg...', '............',
  ]),
  home: pixelSvg([
    '............', '.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.',
    '..kwwwwwwk..', '..kwwnnwwk..', '..kwwnnwwk..', '..kwwnnwwk..', '..kkkkkkkk..', '............',
  ]),
  gift: pixelSvg([
    '............', '...yy..yy...', '..y..yy..y..', '.kkkkyykkkk.', '.krrryyrrrk.', '.kkkkyykkkk.',
    '..krryyrrk..', '..krryyrrk..', '..krryyrrk..', '..krryyrrk..', '..kkkkkkkk..', '............',
  ]),
  festival: pixelSvg([
    '............', '.....yy.....', '.....yy.....', '....yyyy....', '.yyyyyyyyyy.', '..yyyyyyyy..',
    '...yyyyyy...', '...yyyyyy...', '..yyy..yyy..', '..yy....yy..', '............', '............',
  ]),
  music: pixelSvg([
    '............', '....kkkkkk..', '....kkkkkk..', '....k....k..', '....k....k..', '....k....k..',
    '....k....k..', '..kkk..kkk..', '.kkkk.kkkk..', '.kkk..kkk...', '............', '............',
  ]),
  other: pixelSvg([
    '............', '............', '...bbbbbb...', '..bwbbbbbb..', '.bbbbbbbbbb.', '..bbbbbbbb..',
    '...bbbbbb...', '....bbbb....', '.....bb.....', '............', '............', '............',
  ]),
}

export const logo = pixelSvg([
  '............', '..rr....rr..', '.rrrr..rrrr.', '.rwrrrrrrrr.', '.rrrrrrrrrr.', '.rrrrrrrrrr.',
  '..rrrrrrrr..', '...rrrrrr...', '....rrrr....', '.....rr.....', '............', '............',
])

/** Two idle frames of the test sprite used by the pixel-rendering validation page. */
export const testSprite = {
  size: 16,
  frames: [
    pixelSvg([
      '................', '.....kkkkkk.....', '....knnnnnnk....', '...knnnnnnnnk...', '...knppppppnk...',
      '...kpkppppkpk...', '...kppppppppk...', '....kpprrppk....', '.....kkkkkk.....', '....kbbbbbbk....',
      '...kpbbbbbbpk...', '...kpbbbbbbpk...', '....kbbbbbbk....', '....kssk.kssk...', '....kkkk.kkkk...',
      '................',
    ]),
    pixelSvg([
      '................', '................', '.....kkkkkk.....', '....knnnnnnk....', '...knnnnnnnnk...',
      '...knppppppnk...', '...kpkppppkpk...', '...kppppppppk...', '....kpprrppk....', '.....kkkkkk.....',
      '...kpbbbbbbpk...', '...kpbbbbbbpk...', '....kbbbbbbk....', '...kssk...kssk..', '...kkkk...kkkk..',
      '................',
    ]),
  ],
}

/** Landmark icons for Places on the map and in lists (12 × 12 pixel grid). */
export const placeIcons: Record<PlaceIconKey, string> = {
  pin: pixelSvg([
    '....kkkk....', '...krrrrk...', '..krrrrrrk..', '..krrwwrrk..', '..krrwwrrk..', '..krrrrrrk..',
    '...krrrrk...', '...krrrrk...', '....krrk....', '....krrk....', '.....kk.....', '............',
  ]),
  home: pixelSvg([
    '.....kk.....', '....knnk....', '...knnnnk...', '..knnnnnnk..', '.knnnnnnnnk.', 'kkkkkkkkkkkk',
    '.kwwwwwwwwk.', '.kwbbwwnnwk.', '.kwbbwwnnwk.', '.kwwwwwnnwk.', '.kkkkkkkkkk.', '............',
  ]),
  food: pixelSvg([
    '...s.s.s....', '....s.s.s...', '...s.s.s....', '............', 'kkkkkkkkkkkk', 'kwwwwwwwwwwk',
    'kyyyyyyyyyyk', '.kyyyyyyyyk.', '.kyyyyyyyyk.', '..kyyyyyyk..', '...kkkkkk...', '............',
  ]),
  park: pixelSvg([
    '....kkkk....', '...kggggk...', '..kggggggk..', '.kggggggggk.', '.kggggggggk.', '..kggggggk..',
    '...kkggkk...', '.....nn.....', '.....nn.....', '.....nn.....', '..gggggggg..', '............',
  ]),
  mountain: pixelSvg([
    '............', '.....kk.....', '....kwwk....', '...kwwssk...', '...kssssk...', '..kssssssk..',
    '..kssssssk..', '.kssssssssk.', '.kssssssssk.', 'kssssssssssk', 'kkkkkkkkkkkk', '............',
  ]),
  water: pixelSvg([
    '............', '............', '.bb...bb....', 'b..b.b..b.b.', '....b....b..', '............',
    '..bb...bb...', '.b..b.b..b.b', '...b....b...', '............', 'bbbbbbbbbbbb', '............',
  ]),
  city: pixelSvg([
    '............', '...kkkk.....', '...kwwk.kkk.', '...kbwk.kwk.', '...kwwk.kbk.', 'kkkkbwk.kwk.',
    'kwwkwwkkkbk.', 'kbwkbwkwkwk.', 'kwwkwwkbkbk.', 'kbwkbwkwkwk.', 'kkkkkkkkkkk.', '............',
  ]),
  station: pixelSvg([
    '............', '..kkkkkkkk..', '.krrrrrrrrk.', '.krwwrrwwrk.', '.krwwrrwwrk.', '.krrrrrrrrk.',
    '.krrrrrrrrk.', '.kryrrrryrk.', '.kkkkkkkkkk.', '..kk....kk..', 'ssssssssssss', '............',
  ]),
}
