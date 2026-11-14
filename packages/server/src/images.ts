import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import exifr from 'exifr'
import sharp from 'sharp'
import { toLocalIso } from '@days/shared'

export const THUMB_EDGE = 400
export const MEDIUM_EDGE = 1600

export interface StoredImage {
  originalPath: string
  mediumPath: string
  thumbPath: string
  mime: string
  size: number
  width: number
  height: number
  takenAt: string | null
  latitude: number | null
  longitude: number | null
}

export class ImageError extends Error {}

const FORMATS: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  webp: { ext: 'webp', mime: 'image/webp' },
  gif: { ext: 'gif', mime: 'image/gif' },
  tiff: { ext: 'tif', mime: 'image/tiff' },
  avif: { ext: 'avif', mime: 'image/avif' },
  heif: { ext: 'heic', mime: 'image/heic' },
}

/** ISO base media files with a HEIC brand; `sharp` builds often cannot decode these. */
function looksLikeHeic(buf: Buffer): boolean {
  if (buf.length < 12 || buf.toString('latin1', 4, 8) !== 'ftyp') return false
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(buf.toString('latin1', 8, 12))
}

async function heicToJpeg(buf: Buffer): Promise<Buffer> {
  // @ts-expect-error the package has no type declarations
  const { default: convert } = await import('heic-convert')
  return Buffer.from(await convert({ buffer: buf, format: 'JPEG', quality: 0.92 }))
}

export interface PhotoMetadata {
  takenAt: string | null
  latitude: number | null
  longitude: number | null
}

/** Reads the capture time and WGS-84 coordinates from a photo, when present. */
export async function readMetadata(buf: Buffer): Promise<PhotoMetadata> {
  const out: PhotoMetadata = { takenAt: null, latitude: null, longitude: null }
  try {
    const tags = await exifr.parse(buf, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'],
    })
    if (!tags) return out
    const date = tags.DateTimeOriginal ?? tags.CreateDate
    if (date instanceof Date && !Number.isNaN(date.getTime())) out.takenAt = toLocalIso(date)
    const { latitude, longitude } = tags
    if (
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
      !(latitude === 0 && longitude === 0)
    ) {
      out.latitude = latitude
      out.longitude = longitude
    }
  } catch {
    /* a file without readable metadata is still a valid photo */
  }
  return out
}

/**
 * Stores the original unmodified and creates the two browsing copies.
 * The copies are re-encoded, so they carry no metadata.
 */
export async function storeImage(filesDir: string, input: Buffer): Promise<StoredImage> {
  let decodable = input
  let format: string | undefined
  let meta: sharp.Metadata | undefined
  try {
    meta = await sharp(input).metadata()
    format = meta.format
  } catch {
    /* handled below */
  }
  const heic = looksLikeHeic(input)
  if (heic) format = 'heif'

  const info = format ? FORMATS[format] : undefined
  if (!info) throw new ImageError('unsupported_image')

  const id = crypto.randomUUID()
  const sub = id.slice(0, 2)
  const rel = {
    original: path.posix.join('original', sub, `${id}.${info.ext}`),
    medium: path.posix.join('medium', sub, `${id}.jpg`),
    thumb: path.posix.join('thumb', sub, `${id}.jpg`),
  }

  const copy = (src: Buffer, edge: number, quality: number) =>
    sharp(src)
      .rotate() // apply the orientation flag before the metadata is dropped
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })

  let medium: { data: Buffer; info: sharp.OutputInfo }
  try {
    medium = await copy(decodable, MEDIUM_EDGE, 84)
  } catch (err) {
    if (!heic) throw new ImageError('unsupported_image')
    try {
      decodable = await heicToJpeg(input)
      medium = await copy(decodable, MEDIUM_EDGE, 84)
    } catch {
      throw new ImageError('unsupported_image')
    }
  }
  const thumb = await copy(medium.data, THUMB_EDGE, 80)

  // Dimensions as displayed, after the orientation flag is applied.
  const oriented = await sharp(decodable).rotate().toBuffer({ resolveWithObject: true }).then(
    (r) => ({ width: r.info.width, height: r.info.height }),
    () => ({ width: medium.info.width, height: medium.info.height }),
  )

  for (const [key, data] of [['original', input], ['medium', medium.data], ['thumb', thumb.data]] as const) {
    const abs = path.join(filesDir, rel[key])
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, data)
  }

  const exif = await readMetadata(input)
  return {
    originalPath: rel.original,
    mediumPath: rel.medium,
    thumbPath: rel.thumb,
    mime: info.mime,
    size: input.length,
    width: oriented.width,
    height: oriented.height,
    ...exif,
  }
}

export async function removeImageFiles(filesDir: string, paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => fs.rm(path.join(filesDir, p), { force: true })))
}
