/**
 * Default quiz cover generation.
 *
 * A quiz saved without a cover used to render as an empty grey box on every card
 * and rail. Instead of one shared placeholder, the cover is drawn from what the
 * quiz already carries: its name on the colour its category owns in
 * constants/quizMeta.js. The same drawing serves two purposes, which is why it
 * lives here rather than inside the editor: a data URL for the preview shown
 * before saving, and a PNG File uploaded on save so the URL works everywhere the
 * quiz appears (cards, lobbies, link previews) and not only inside this app.
 */
import { categoryTheme } from '@/constants/quizMeta'

// 16:10, the ratio QuizCard stores its thumbnail at, so a card crops nothing. The
// detail page and the editor cap the height instead, which crops the same picture
// to a wide band; the text is therefore drawn inside a vertically centred safe
// area and the accent bar runs the full height, so a band crop takes background
// only.
const WIDTH = 1600
const HEIGHT = 1000
const BAR_WIDTH = 32
const PADDING_X = 120
const LINE_HEIGHT = 108
const TITLE_SIZE = 88
const LABEL_SIZE = 40
const LABEL_GAP = 34
const MAX_LINES = 3

/** Greedy word wrap measured against the real canvas font. */
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    // A single word wider than the line still has to be placed somewhere.
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)

  if (lines.length <= MAX_LINES) return lines

  // Past the third line the name is cut rather than shrunk: the cover is a
  // thumbnail and the full name is always printed next to it.
  const kept = lines.slice(0, MAX_LINES)
  kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].replace(/[\s.,;:]+$/, '')}\u2026`
  return kept
}

/**
 * Draws the cover onto a canvas that is already sized by the caller.
 * Returns false when the 2D context is unavailable, so callers can fall back to
 * showing nothing instead of a broken image.
 */
function drawCover(canvas, quizName, category) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const theme = categoryTheme(category)

  ctx.fillStyle = theme.tint
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // A solid bar in the category colour keeps two covers of different categories
  // apart even at thumbnail size.
  ctx.fillStyle = theme.color
  ctx.fillRect(0, 0, BAR_WIDTH, HEIGHT)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = theme.color

  const label = (category || '').trim().toUpperCase()
  const title = (quizName || '').trim() || 'Untitled quiz'

  ctx.font = `700 ${TITLE_SIZE}px Inter, system-ui, sans-serif`
  const lines = wrapLines(ctx, title, WIDTH - PADDING_X * 2)

  // Centre the whole text block so a crop to a wider ratio keeps all of it.
  const labelBlock = label ? LABEL_SIZE + LABEL_GAP : 0
  const blockHeight = labelBlock + lines.length * LINE_HEIGHT
  let y = Math.max((HEIGHT - blockHeight) / 2, LINE_HEIGHT / 2)

  if (label) {
    ctx.font = `600 ${LABEL_SIZE}px Inter, system-ui, sans-serif`
    ctx.fillText(label, PADDING_X, y)
    y += labelBlock
  }

  ctx.font = `700 ${TITLE_SIZE}px Inter, system-ui, sans-serif`
  lines.forEach((line, index) => {
    ctx.fillText(line, PADDING_X, y + index * LINE_HEIGHT)
  })

  return true
}

/** Creates the offscreen canvas both entry points draw on. */
function makeCanvas() {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  return canvas
}

/**
 * The cover as a data URL, for previewing what will be uploaded on save.
 * Returns an empty string when it cannot be drawn, which templates can treat as
 * "no cover".
 */
export function createDefaultCoverDataUrl(quizName, category) {
  const canvas = makeCanvas()
  if (!canvas || !drawCover(canvas, quizName, category)) return ''

  return canvas.toDataURL('image/png')
}

/**
 * The cover as a PNG File ready for uploadImage().
 * Resolves with null when it cannot be drawn, so saving a quiz never fails
 * because a decorative cover could not be produced.
 */
export async function createDefaultCoverFile(quizName, category) {
  const canvas = makeCanvas()
  if (!canvas || !drawCover(canvas, quizName, category)) return null

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null

  return new File([blob], 'quiz-cover.png', { type: 'image/png' })
}
