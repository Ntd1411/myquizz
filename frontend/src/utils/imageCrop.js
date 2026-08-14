/**
 * Cropping a picture the author already has, to the sizes the product stores images at.
 *
 * Two things a plain <img> cannot give the editor live here: pixels a canvas is
 * allowed to read back, and a file that already fits the presign rules. Keeping both
 * out of the component means the cropper is only an interaction surface, and the size
 * contract stays next to the generator in utils/defaultCover.js.
 *
 * Every surface stores one size, chosen from the largest place it is displayed. A
 * single asset per image means no resize pipeline, no srcset bookkeeping and one URL
 * per row, at the cost of over-serving the smallest surface.
 */

// 16:10 at the size QuizCard, the detail page and the generated cover all use, so a
// cropped cover is indistinguishable from a generated one.
export const COVER_WIDTH = 1600
export const COVER_HEIGHT = 1000

// 16:9 for a question illustration: it sits above the answer grid during play, where
// the usable area is a wide band rather than the 16:10 of a card.
export const QUESTION_WIDTH = 1280
export const QUESTION_HEIGHT = 720

// Square, because every avatar frame in the app is a circle. 512 covers the largest
// one (84 CSS px on the profile card) at any sane pixel ratio.
export const AVATAR_SIZE = 512

// Mirrors the presign limit in api/storage.api.js: a crop above it would be rejected
// after the round trip instead of here.
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
// Highest quality first, and the first encoding that fits wins: a flat drawing keeps
// its crispness and only a detailed photograph pays for its own weight.
const JPEG_QUALITIES = [0.92, 0.85, 0.75, 0.6, 0.45]

/** Decodes a URL into an Image, rejecting instead of leaving a half-loaded element. */
function decode(src, withCors) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (withCors) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('This image could not be loaded.'))
    image.src = src
  })
}

/**
 * Loads an image in a form a canvas may read back, and returns the handle that frees
 * it again.
 *
 * A stored cover is served from object storage, so reading its pixels needs an
 * explicit cross-origin read: without one the canvas is tainted and toBlob throws at
 * the end of the crop instead of at the start. The blob is fetched first because that
 * also gives a URL to revoke; the crossOrigin attribute is the fallback for a server
 * that answers the image request but not the fetch.
 */
export async function loadCroppableImage(src) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return { image: await decode(src, false), release: () => {} }
  }

  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(`This image could not be read (${res.status}).`)

    const url = URL.createObjectURL(await res.blob())
    return { image: await decode(url, false), release: () => URL.revokeObjectURL(url) }
  } catch {
    return { image: await decode(src, true), release: () => {} }
  }
}

/**
 * Keeps a crop rectangle inside the picture, absorbing the rounding of a drag.
 *
 * Exported because the cropper stores the frame it used: the rectangle it hands to the
 * editor has to be the same one drawn here, or reopening the cropper would restore a
 * frame slightly off from the crop that was saved.
 */
export function clampCrop(image, crop) {
  const width = Math.min(Math.max(crop.width, 1), image.naturalWidth)
  const height = Math.min(Math.max(crop.height, 1), image.naturalHeight)

  return {
    x: Math.min(Math.max(crop.x, 0), image.naturalWidth - width),
    y: Math.min(Math.max(crop.y, 0), image.naturalHeight - height),
    width,
    height,
  }
}

/**
 * Draws a crop rectangle, in the natural pixels of the source, as a JPEG File ready
 * for uploadImage().
 *
 * The output size is fixed by the caller rather than taken from the crop: a small crop
 * is upscaled here, once, instead of by every card that later shows it.
 */
export async function cropToFile(
  image,
  crop,
  { width = COVER_WIDTH, height = COVER_HEIGHT, name = 'crop.jpg' } = {},
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot crop images.')

  const rect = clampCrop(image, crop)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)

  for (const quality of JPEG_QUALITIES) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('The crop could not be encoded.')

    if (blob.size <= MAX_OUTPUT_BYTES) {
      return new File([blob], name, { type: 'image/jpeg' })
    }
  }

  throw new Error('The cropped image stays above the 2MB limit. Try a tighter crop.')
}
