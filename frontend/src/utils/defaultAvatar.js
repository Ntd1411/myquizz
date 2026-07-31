/**
 * Default avatar generation.
 *
 * New accounts get a real image instead of a CSS-only placeholder: the first letter of
 * the name on a random background from the sticker palette, drawn on a canvas and
 * exported as PNG. The file goes through /storage/presign like any other upload, so the
 * avatar URL works everywhere (game lobbies, quiz cards, emails) and not just inside
 * this app.
 */
const PALETTE = [
  '#62aef0',
  '#2a9d99',
  '#1aae39',
  '#dd5b00',
  '#ff64c8',
  '#391c57',
  '#523410',
  '#0075de',
  '#213183',
]

const SIZE = 256

export function pickAvatarColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

/** First letter of the name, or of the email, upper-cased. Falls back to "M". */
export function avatarLetter(source) {
  const text = (source || '').trim()
  const letter = text ? text[0] : ''
  return (letter || 'M').toUpperCase()
}

/**
 * Draws the avatar and resolves with a PNG File ready for uploadImage().
 * Resolves with null when the canvas is unavailable, so signup never fails
 * just because the decorative avatar could not be produced.
 */
export async function createDefaultAvatarFile(source, color = pickAvatarColor()) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = color
  ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(SIZE * 0.46)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Optical centring: most fonts sit slightly high on the middle baseline.
  ctx.fillText(avatarLetter(source), SIZE / 2, SIZE / 2 + SIZE * 0.02)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null

  return new File([blob], 'avatar.png', { type: 'image/png' })
}
