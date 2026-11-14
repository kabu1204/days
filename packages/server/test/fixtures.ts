import sharp from 'sharp'

export interface SampleOptions {
  /** `YYYY:MM:DD HH:mm:ss` as written by cameras. */
  dateTime?: string
  latitude?: number
  longitude?: number
  color?: string
  width?: number
  height?: number
}

function dms(value: number): string {
  const abs = Math.abs(value)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const s = Math.round(((abs - d) * 60 - m) * 60 * 100)
  return `${d}/1 ${m}/1 ${s}/100`
}

/** Creates a JPEG that carries capture time and coordinates like a phone photo. */
export async function sampleJpeg(opts: SampleOptions = {}): Promise<Buffer> {
  const exif: Record<string, Record<string, string>> = {}
  if (opts.dateTime) exif.IFD2 = { DateTimeOriginal: opts.dateTime }
  if (opts.latitude !== undefined && opts.longitude !== undefined) {
    exif.IFD3 = {
      GPSLatitudeRef: opts.latitude >= 0 ? 'N' : 'S',
      GPSLatitude: dms(opts.latitude),
      GPSLongitudeRef: opts.longitude >= 0 ? 'E' : 'W',
      GPSLongitude: dms(opts.longitude),
    }
  }
  let img = sharp({
    create: { width: opts.width ?? 2400, height: opts.height ?? 1800, channels: 3, background: opts.color ?? '#c8553d' },
  }).jpeg({ quality: 80 })
  if (Object.keys(exif).length) img = img.withExif(exif)
  return img.toBuffer()
}
