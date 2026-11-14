// Browser-only: file selection and photo metadata. A mini program build
// replaces this module (for example with `chooseMedia`), keeping the same
// exported functions.
import exifr from 'exifr'
import { toLocalIso } from '@days/shared'

export interface LocalPhoto {
  key: string
  file: File
  /** `YYYY-MM-DDTHH:mm:ss` from the photo's metadata, or null. */
  takenAt: string | null
  latitude: number | null
  longitude: number | null
  /** Number of metadata fields found; used by the validation page. */
  fieldCount: number
  preview: string
}

let counter = 0

/** Opens the system file selector for images. Resolves with an empty list when cancelled. */
export function pickImages(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // No `capture` attribute: the user chooses from the library, which keeps
    // the files as they are stored on the device.
    input.accept = 'image/*,.heic,.heif'
    input.multiple = multiple
    input.style.display = 'none'
    input.setAttribute('data-testid', 'file-input')
    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => finish([]))
    document.body.appendChild(input)
    input.click()
  })
}

export async function readLocalPhoto(file: File, cheapPreview = false): Promise<LocalPhoto> {
  const photo: LocalPhoto = {
    key: `p${++counter}`,
    file,
    takenAt: null,
    latitude: null,
    longitude: null,
    fieldCount: 0,
    preview: '',
  }
  try {
    const tags = await exifr.parse(file, { gps: true, tiff: true, exif: true })
    if (tags) {
      photo.fieldCount = Object.keys(tags).length
      const date = tags.DateTimeOriginal ?? tags.CreateDate
      if (date instanceof Date && !Number.isNaN(date.getTime())) photo.takenAt = toLocalIso(date)
      const { latitude, longitude } = tags
      if (
        Number.isFinite(latitude) && Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
        !(latitude === 0 && longitude === 0)
      ) {
        photo.latitude = latitude
        photo.longitude = longitude
      }
    }
  } catch {
    /* files without readable metadata are still accepted */
  }
  if (cheapPreview) {
    // The small preview stored inside most camera files avoids decoding
    // thousands of full-size images during a bulk import.
    try {
      photo.preview = (await exifr.thumbnailUrl(file)) ?? ''
    } catch {
      /* fall through to the full image */
    }
  }
  if (!photo.preview) photo.preview = URL.createObjectURL(file)
  return photo
}

export function releaseLocalPhotos(photos: LocalPhoto[]): void {
  for (const p of photos) if (p.preview.startsWith('blob:')) URL.revokeObjectURL(p.preview)
}

export function downloadUrl(url: string): void {
  window.location.assign(url)
}

export function currentOrigin(): string {
  return window.location.origin
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function deviceInfo(): { userAgent: string; dpr: number; width: number; height: number } {
  return { userAgent: navigator.userAgent, dpr: window.devicePixelRatio, width: window.innerWidth, height: window.innerHeight }
}
