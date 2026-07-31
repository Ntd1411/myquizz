/**
 * Shared quiz authoring helpers: draft shape, importers (text / CSV / XLSX / JSON),
 * downloadable templates, validation and the final API payload builder.
 *
 * Every limit mirrors backend/src/modules/quiz/quiz.schema.ts so the client can
 * reject bad input before spending a round trip.
 */

export const LIMITS = {
  nameMin: 3,
  nameMax: 100,
  descriptionMax: 500,
  questionTextMax: 200,
  optionMax: 100,
  optionsMin: 2,
  optionsMax: 4,
}

export const CATEGORIES = ['General', 'Science', 'Geography', 'Movies', 'Sports', 'Music']

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
]

export const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple choice (one answer)' },
  { value: 'multiple_select', label: 'Multiple select (several answers)' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'long_answer', label: 'Long answer' },
]

export const TIME_LIMITS = [10, 15, 20, 30, 45, 60, 90, 120]

export const isChoice = (type) => type === 'multiple_choice' || type === 'multiple_select'

let nextQuestionId = 1

/** Fresh editor draft for one question. */
export function makeQuestion(type = 'multiple_choice') {
  return {
    id: nextQuestionId++,
    question_type: type,
    question_text: '',
    time_limit: 30,
    question_image: '',
    answer_options: ['', '', '', ''],
    correctIndexes: [],
    correctText: '',
    uploading: false,
  }
}

export function makeQuizMeta() {
  return {
    quiz_name: '',
    quiz_description: '',
    quiz_language: 'en',
    quiz_category: 'General',
    quiz_image: '',
    is_public: true,
  }
}

function padOptions(options) {
  return [...options, '', '', '', ''].slice(0, LIMITS.optionsMax)
}

/** Normalises any API / imported question shape into an editor draft. */
export function toDraft(raw) {
  const type = QUESTION_TYPES.some((item) => item.value === raw.question_type)
    ? raw.question_type
    : 'multiple_choice'
  const draft = makeQuestion(type)
  draft.question_text = String(raw.question_text ?? raw.question ?? '').slice(0, LIMITS.questionTextMax)
  draft.time_limit = Number(raw.time_limit) > 0 ? Number(raw.time_limit) : 30
  draft.question_image = typeof raw.question_image === 'string' ? raw.question_image : ''

  if (isChoice(type)) {
    const options = Array.isArray(raw.answer_options)
      ? raw.answer_options.map((option) => String(option).slice(0, LIMITS.optionMax))
      : []
    draft.answer_options = padOptions(options)
    draft.correctIndexes = Array.isArray(raw.correct_answer)
      ? raw.correct_answer.map(Number).filter((index) => Number.isInteger(index) && index >= 0)
      : []
  } else {
    draft.correctText = typeof raw.correct_answer === 'string' ? raw.correct_answer : ''
  }
  return draft
}

/** Turns an API quiz into { quiz, questions } editor state. */
export function quizToDraft(source) {
  return {
    quiz: {
      quiz_name: String(source?.quiz_name ?? source?.title ?? '').slice(0, LIMITS.nameMax),
      quiz_description: String(source?.quiz_description ?? source?.description ?? '').slice(
        0,
        LIMITS.descriptionMax,
      ),
      quiz_language: source?.quiz_language ?? 'en',
      quiz_category: source?.quiz_category ?? source?.category ?? 'General',
      quiz_image: source?.quiz_image ?? '',
      is_public: source?.is_public ?? true,
    },
    questions: (source?.questions ?? []).map(toDraft),
  }
}

/* ------------------------------------------------------------------ *
 * Text importer
 * ------------------------------------------------------------------ */

/**
 * Plain-text bulk format, one blank line between questions:
 *   first line  -> question text (a leading "1." is stripped)
 *   "- option"  -> answer option
 *   "* option"  -> answer option marked as correct
 *   "= answer"  -> free-text answer instead of options
 *   "@25"       -> time limit in seconds
 */
export function parseText(text) {
  const blocks = String(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const header = lines.shift() ?? ''
    const draft = makeQuestion()
    draft.question_text = header.replace(/^\d+[.)]\s*/, '').slice(0, LIMITS.questionTextMax)

    const options = []
    const correctIndexes = []
    let freeAnswer = ''

    for (const line of lines) {
      if (line.startsWith('@')) {
        const seconds = Number(line.slice(1).trim())
        if (seconds > 0) draft.time_limit = seconds
        continue
      }
      if (line.startsWith('=')) {
        freeAnswer = line.slice(1).trim()
        continue
      }
      const marked = line.startsWith('*') || /\[x\]\s*$/i.test(line)
      const value = line
        .replace(/^[*\-\u2022]\s*/, '')
        .replace(/\[x\]\s*$/i, '')
        .trim()
      if (!value) continue
      if (marked) correctIndexes.push(options.length)
      options.push(value.slice(0, LIMITS.optionMax))
    }

    if (freeAnswer && !options.length) {
      draft.question_type = 'short_answer'
      draft.correctText = freeAnswer
      return draft
    }

    draft.question_type = correctIndexes.length > 1 ? 'multiple_select' : 'multiple_choice'
    draft.answer_options = padOptions(options)
    draft.correctIndexes = correctIndexes
    return draft
  })
}

/* ------------------------------------------------------------------ *
 * Tabular importers (CSV + XLSX share the same row shape)
 * ------------------------------------------------------------------ */

export const TABLE_COLUMNS = [
  'question',
  'option1',
  'option2',
  'option3',
  'option4',
  'correct',
  'time',
]

/** Minimal CSV row splitter with double-quote support. */
function splitCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

const isHeaderRow = (cells) => /^question(\s|_|$)/i.test(String(cells[0] ?? '').trim())

/** Maps rows of [question, option1..4, correct, time] into drafts. */
function rowsToDrafts(rows) {
  const usable = rows
    .map((row) => row.map((cell) => (cell === undefined || cell === null ? '' : String(cell).trim())))
    .filter((row) => row.some(Boolean))
  if (!usable.length) return []
  if (isHeaderRow(usable[0])) usable.shift()

  return usable.map((row) => {
    const [questionText, o1, o2, o3, o4, correct, time] = row
    const options = [o1, o2, o3, o4].filter(Boolean)
    const draft = makeQuestion()
    draft.question_text = String(questionText ?? '').slice(0, LIMITS.questionTextMax)
    if (Number(time) > 0) draft.time_limit = Number(time)

    const letters = String(correct ?? '')
      .split(/[;,|]/)
      .map((token) => token.trim().toUpperCase())
      .filter((token) => /^[A-D]$/.test(token))
      .map((token) => token.charCodeAt(0) - 65)

    if (options.length >= LIMITS.optionsMin && letters.length) {
      draft.question_type = letters.length > 1 ? 'multiple_select' : 'multiple_choice'
      draft.answer_options = padOptions(options.map((option) => option.slice(0, LIMITS.optionMax)))
      draft.correctIndexes = letters.filter((index) => index < options.length)
    } else {
      draft.question_type = 'short_answer'
      draft.correctText = String(correct ?? '').trim()
    }
    return draft
  })
}

export function parseCsv(text) {
  const rows = String(text)
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map(splitCsvLine)
  return rowsToDrafts(rows)
}

/**
 * XLSX needs SheetJS, which is an optional dependency here: the import is lazy so
 * the rest of the app never pays for it, and a missing package is reported clearly.
 */
export async function parseSpreadsheet(file) {
  let XLSX
  try {
    XLSX = await import('xlsx')
  } catch {
    throw new Error('XLSX import needs the "xlsx" package. Run: pnpm add xlsx (or use CSV instead).')
  }
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The workbook has no sheet.')
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  })
  return rowsToDrafts(rows)
}

/* ------------------------------------------------------------------ *
 * JSON importer
 * ------------------------------------------------------------------ */

/** Accepts either a bare questions array or a full quiz export object. */
export function parseJson(text) {
  const parsed = JSON.parse(text)
  const list = Array.isArray(parsed) ? parsed : (parsed?.questions ?? [])
  if (!Array.isArray(list)) throw new Error('Expected an array of questions under "questions".')

  const meta = {}
  if (!Array.isArray(parsed) && parsed) {
    if (parsed.quiz_name) meta.quiz_name = String(parsed.quiz_name).slice(0, LIMITS.nameMax)
    if (parsed.quiz_description) {
      meta.quiz_description = String(parsed.quiz_description).slice(0, LIMITS.descriptionMax)
    }
    if (parsed.quiz_category) meta.quiz_category = String(parsed.quiz_category)
    if (parsed.quiz_language) meta.quiz_language = String(parsed.quiz_language)
    if (typeof parsed.is_public === 'boolean') meta.is_public = parsed.is_public
  }

  return { meta, questions: list.map(toDraft) }
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** Per-question problems, used to block a bad import before the editor opens. */
export function collectQuestionIssues(questions) {
  const issues = []

  questions.forEach((question, index) => {
    const label = `Question ${index + 1}`
    const text = question.question_text.trim()
    if (!text) issues.push(`${label}: the question text is missing.`)
    else if (text.length > LIMITS.questionTextMax) {
      issues.push(`${label}: the question text is longer than ${LIMITS.questionTextMax} characters.`)
    }

    if (isChoice(question.question_type)) {
      const filled = question.answer_options.map((option) => option.trim())
      const options = filled.filter(Boolean)
      if (options.length < LIMITS.optionsMin) {
        issues.push(`${label}: needs at least ${LIMITS.optionsMin} answer options.`)
      }
      if (options.some((option) => option.length > LIMITS.optionMax)) {
        issues.push(`${label}: an option is longer than ${LIMITS.optionMax} characters.`)
      }
      // Correct indexes point at the filtered list, so gaps must be rejected first.
      const firstEmpty = filled.findIndex((option) => !option)
      if (firstEmpty !== -1 && filled.slice(firstEmpty).some(Boolean)) {
        issues.push(`${label}: the answer options have a gap between them.`)
      }
      if (!question.correctIndexes.length) issues.push(`${label}: no correct answer is marked.`)
      else if (question.correctIndexes.some((position) => !filled[position])) {
        issues.push(`${label}: a correct answer points at an empty option.`)
      } else if (question.question_type === 'multiple_select' && question.correctIndexes.length < 2) {
        issues.push(`${label}: multiple select needs at least two correct answers.`)
      }
    } else if (!question.correctText.trim()) {
      issues.push(`${label}: the expected answer is missing.`)
    }
  })

  return issues
}

/** Full check before create/update. Returns the first problem, or ''. */
export function validateQuiz(quiz, questions) {
  const name = quiz.quiz_name.trim()
  if (name.length < LIMITS.nameMin) return `Quiz name must be at least ${LIMITS.nameMin} characters.`
  if (name.length > LIMITS.nameMax) return `Quiz name must be at most ${LIMITS.nameMax} characters.`
  if (quiz.quiz_description.length > LIMITS.descriptionMax) {
    return `Description must be at most ${LIMITS.descriptionMax} characters.`
  }
  if (!quiz.quiz_language) return 'Please pick a language.'
  if (!questions.length) return 'A quiz needs at least one question.'
  return collectQuestionIssues(questions)[0] ?? ''
}

/** Builds the exact body accepted by POST /quizzes and PATCH /quizzes/id/:id. */
export function buildPayload(quiz, questions) {
  return {
    quiz_name: quiz.quiz_name.trim(),
    ...(quiz.quiz_description.trim() ? { quiz_description: quiz.quiz_description.trim() } : {}),
    quiz_language: quiz.quiz_language,
    ...(quiz.quiz_category ? { quiz_category: quiz.quiz_category } : {}),
    ...(quiz.quiz_image ? { quiz_image: quiz.quiz_image } : {}),
    is_public: quiz.is_public,
    questions: questions.map((question) => {
      const base = {
        question_type: question.question_type,
        question_text: question.question_text.trim(),
        time_limit: Number(question.time_limit),
        ...(question.question_image ? { question_image: question.question_image } : {}),
      }
      if (!isChoice(question.question_type)) {
        return { ...base, correct_answer: question.correctText.trim() }
      }
      const options = question.answer_options.map((option) => option.trim()).filter(Boolean)
      return {
        ...base,
        answer_options: options,
        correct_answer: [...question.correctIndexes].sort((a, b) => a - b),
      }
    }),
  }
}

/* ------------------------------------------------------------------ *
 * Downloadable templates
 * ------------------------------------------------------------------ */

export const TEXT_TEMPLATE = `Which planet is known as the red planet?
- Earth
* Mars
- Venus
- Jupiter
@20

Which of these are programming languages?
* Python
* Rust
- Photoshop
- Illustrator

What is the capital of Japan?
= Tokyo
`

export const CSV_TEMPLATE = `question,option1,option2,option3,option4,correct,time
"Which planet is known as the red planet?",Earth,Mars,Venus,Jupiter,B,20
"Which of these are programming languages?",Python,Rust,Photoshop,Illustrator,"A,B",30
"What is the capital of Japan?",,,,,Tokyo,30
`

export const JSON_TEMPLATE = JSON.stringify(
  {
    quiz_name: 'Sample quiz',
    quiz_description: 'Replace this with your own description.',
    quiz_language: 'en',
    quiz_category: 'General',
    is_public: true,
    questions: [
      {
        question_type: 'multiple_choice',
        question_text: 'Which planet is known as the red planet?',
        time_limit: 20,
        answer_options: ['Earth', 'Mars', 'Venus', 'Jupiter'],
        correct_answer: [1],
      },
      {
        question_type: 'multiple_select',
        question_text: 'Which of these are programming languages?',
        time_limit: 30,
        answer_options: ['Python', 'Rust', 'Photoshop', 'Illustrator'],
        correct_answer: [0, 1],
      },
      {
        question_type: 'short_answer',
        question_text: 'What is the capital of Japan?',
        time_limit: 30,
        correct_answer: 'Tokyo',
      },
    ],
  },
  null,
  2,
)

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads the template for one import kind. The XLSX template is generated with
 * SheetJS when available and falls back to CSV otherwise.
 */
export async function downloadTemplate(kind) {
  if (kind === 'text') {
    saveBlob(new Blob([TEXT_TEMPLATE], { type: 'text/plain;charset=utf-8' }), 'myquizz-template.txt')
    return
  }
  if (kind === 'csv') {
    saveBlob(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }), 'myquizz-template.csv')
    return
  }
  if (kind === 'json') {
    saveBlob(
      new Blob([JSON_TEMPLATE], { type: 'application/json;charset=utf-8' }),
      'myquizz-template.json',
    )
    return
  }
  if (kind === 'xlsx') {
    try {
      const XLSX = await import('xlsx')
      const rows = [
        TABLE_COLUMNS,
        ['Which planet is known as the red planet?', 'Earth', 'Mars', 'Venus', 'Jupiter', 'B', 20],
        ['Which of these are programming languages?', 'Python', 'Rust', 'Photoshop', 'Illustrator', 'A,B', 30],
        ['What is the capital of Japan?', '', '', '', '', 'Tokyo', 30],
      ]
      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions')
      const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      saveBlob(
        new Blob([output], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'myquizz-template.xlsx',
      )
      return
    } catch {
      // SheetJS is missing: a CSV template opens in Excel just as well.
      saveBlob(new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }), 'myquizz-template.csv')
      return
    }
  }
  throw new Error(`Unknown template kind: ${kind}`)
}
