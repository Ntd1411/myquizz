<script setup>
/**
 * Step 1 of quiz creation: pick a method. Manual goes straight to an empty editor;
 * the importers validate the input here and only hand a clean draft over to the
 * editor page, so the editor never has to deal with malformed files.
 */
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toErrorMessage } from '@/api/envelope'
import { setPendingDraft } from '@/composables/useQuizDraft'
import { revealOnEnter } from '@/composables/useMotion'
import {
  TABLE_COLUMNS,
  TEXT_TEMPLATE,
  collectQuestionIssues,
  downloadTemplate,
  parseCsv,
  parseJson,
  parseSpreadsheet,
  parseText,
} from '@/utils/quizImport'

const METHODS = [
  {
    value: 'manual',
    title: 'Write manually',
    hint: 'Start from an empty quiz and add questions one by one.',
    badge: 'Fastest to start',
  },
  {
    value: 'text',
    title: 'Paste plain text',
    hint: 'Bulk import a simple list of questions and options.',
    badge: 'Bulk',
  },
  {
    value: 'file',
    title: 'Import a file',
    hint: 'CSV, XLSX or JSON exported from a spreadsheet or another tool.',
    badge: 'CSV · XLSX · JSON',
  },
  {
    value: 'ai',
    title: 'Generate with AI',
    hint: 'Describe a topic and let AI draft the questions for you.',
    badge: 'Coming soon',
    disabled: true,
  },
]

const router = useRouter()

const pageEl = ref(null)
const method = ref('manual')
const pastedText = ref('')
const working = ref(false)
const issues = ref([])
const fileName = ref('')

const selected = computed(() => METHODS.find((item) => item.value === method.value))

onMounted(() => revealOnEnter(pageEl.value))

function selectMethod(item) {
  // The card already reads "Coming soon", so a disabled method simply does nothing.
  if (item.disabled) return
  method.value = item.value
  issues.value = []
  fileName.value = ''
}

function goToEmptyEditor() {
  router.push({ name: 'create-quiz' })
}

async function onDownloadTemplate(kind) {
  try {
    await downloadTemplate(kind)
  } catch (error) {
    // The issue list under the method is where this screen reports every problem.
    issues.value = [toErrorMessage(error, 'Could not build that template.')]
  }
}

/** Shared exit path: block on validation errors, otherwise hand over the draft. */
function handOver(questions, meta = {}, label = 'import') {
  if (!questions.length) {
    issues.value = ['No question could be read from your input. Check the expected format.']
    return
  }

  const found = collectQuestionIssues(questions)
  if (found.length) {
    // Every problem is listed with the row it belongs to, which a one-line notice
    // could never do.
    issues.value = found
    return
  }

  issues.value = []
  setPendingDraft({ quiz: meta, questions, source: label })
  // The editor opens with a banner counting the imported questions, so the hand-over
  // announces itself on the screen that received the work.
  router.push({ name: 'create-quiz' })
}

function convertText() {
  working.value = true
  try {
    handOver(parseText(pastedText.value), {}, 'text')
  } finally {
    working.value = false
  }
}

function insertTextSample() {
  pastedText.value = TEXT_TEMPLATE
}

async function onFilePicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  fileName.value = file.name
  issues.value = []
  working.value = true

  try {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      handOver(await parseSpreadsheet(file), {}, 'xlsx')
      return
    }

    const text = await file.text()
    if (/\.json$/i.test(file.name) || /^[[{]/.test(text.trim())) {
      const { meta, questions } = parseJson(text)
      handOver(questions, meta, 'json')
      return
    }
    if (/\.csv$/i.test(file.name) || text.includes(',')) {
      handOver(parseCsv(text), {}, 'csv')
      return
    }
    // A plain .txt file follows the paste format.
    handOver(parseText(text), {}, 'text')
  } catch (error) {
    issues.value = [toErrorMessage(error, 'Could not read that file.')]
  } finally {
    working.value = false
  }
}
</script>

<template>
  <div ref="pageEl" class="container-page py-xl">
    <header class="mb-lg" data-enter>
      <p class="eyebrow-label">
        Create
      </p>
      <h1 class="text-heading-1 text-ink">
        How do you want to build it?
      </h1>
      <p class="mt-xxs text-body-sm text-ink-muted">
        Every method ends in the same editor, so you can always review and edit before publishing.
      </p>
    </header>

    <!-- Method picker -->
    <section class="mb-lg grid gap-sm sm:grid-cols-2 lg:grid-cols-4" data-enter>
      <button
        v-for="item in METHODS"
        :key="item.value"
        type="button"
        class="method-card card-surface p-md text-left"
        :class="[
          method === item.value ? 'is-selected' : '',
          item.disabled ? 'is-disabled' : '',
        ]"
        :aria-pressed="method === item.value"
        @click="selectMethod(item)"
      >
        <span class="chip mb-sm !px-sm !py-[2px] text-caption text-ink-muted">{{ item.badge }}</span>
        <span class="block text-title text-ink">{{ item.title }}</span>
        <span class="mt-xxs block text-body-sm text-ink-muted">{{ item.hint }}</span>
      </button>
    </section>

    <!-- Validation report, shared by every importer -->
    <section
      v-if="issues.length"
      class="mb-lg rounded-lg border border-red-200 bg-red-50 p-md"
      role="alert"
    >
      <p class="text-body-sm font-semibold text-red-700">
        The input could not be converted{{ fileName ? ` (${fileName})` : '' }}
      </p>
      <ul class="mt-xs list-disc space-y-[2px] pl-lg text-body-sm text-red-600">
        <li v-for="(issue, index) in issues.slice(0, 10)" :key="index">
          {{ issue }}
        </li>
      </ul>
      <p v-if="issues.length > 10" class="mt-xs text-caption text-red-600">
        and {{ issues.length - 10 }} more
      </p>
    </section>

    <!-- Manual -->
    <section v-if="method === 'manual'" class="card-surface p-lg" data-enter>
      <h2 class="text-heading-3 text-ink">
        Start from scratch
      </h2>
      <p class="mt-xxs text-body-sm text-ink-muted">
        You get an empty quiz with one question ready to fill in.
      </p>
      <button type="button" class="btn btn-primary mt-md" @click="goToEmptyEditor">
        Open the editor
      </button>
    </section>

    <!-- Paste text -->
    <section v-else-if="method === 'text'" class="card-surface p-lg" data-enter>
      <div class="flex flex-wrap items-start justify-between gap-sm">
        <div>
          <h2 class="text-heading-3 text-ink">
            Paste your questions
          </h2>
          <p class="mt-xxs text-body-sm text-ink-muted">
            One blank line between questions. <code class="text-ink">-</code> for an option,
            <code class="text-ink">*</code> for a correct option, <code class="text-ink">=</code> for
            a short answer, <code class="text-ink">@30</code> for a time limit.
          </p>
        </div>
        <button type="button" class="btn btn-utility" @click="onDownloadTemplate('text')">
          Download .txt template
        </button>
      </div>

      <textarea
        v-model="pastedText"
        class="field mt-md min-h-[240px] resize-y font-mono text-[13px]"
        :placeholder="TEXT_TEMPLATE"
      />

      <div class="mt-md flex flex-wrap items-center gap-sm">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!pastedText.trim() || working"
          @click="convertText"
        >
          {{ working ? 'Converting…' : 'Validate and continue' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="insertTextSample">
          Insert sample
        </button>
      </div>
    </section>

    <!-- File import -->
    <section v-else-if="method === 'file'" class="card-surface p-lg" data-enter>
      <h2 class="text-heading-3 text-ink">
        Import a file
      </h2>
      <p class="mt-xxs text-body-sm text-ink-muted">
        CSV and XLSX use the columns
        <code class="text-ink">{{ TABLE_COLUMNS.join(', ') }}</code>, where
        <code class="text-ink">correct</code> is a letter such as <code class="text-ink">B</code> or
        <code class="text-ink">A,C</code> (leave the options empty for a short answer). JSON follows
        the API shape with a <code class="text-ink">questions</code> array.
      </p>

      <div class="mt-md flex flex-wrap items-center gap-sm">
        <label class="btn btn-primary cursor-pointer">
          {{ working ? 'Reading…' : 'Choose a file' }}
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json,.txt,text/csv,application/json"
            class="hidden"
            @change="onFilePicked"
          >
        </label>
        <span v-if="fileName" class="text-caption text-ink-muted">{{ fileName }}</span>
      </div>

      <div class="mt-lg border-t border-hairline pt-md">
        <p class="mb-xs text-caption text-ink-secondary">
          Templates
        </p>
        <div class="flex flex-wrap gap-sm">
          <button type="button" class="btn btn-utility" @click="onDownloadTemplate('csv')">
            Download .csv
          </button>
          <button type="button" class="btn btn-utility" @click="onDownloadTemplate('xlsx')">
            Download .xlsx
          </button>
          <button type="button" class="btn btn-utility" @click="onDownloadTemplate('json')">
            Download .json
          </button>
        </div>
        <p class="mt-xs text-caption text-ink-faint">
          XLSX reading and writing needs the optional "xlsx" package; the CSV template works in
          Excel and Google Sheets either way.
        </p>
      </div>
    </section>

    <!-- AI, not implemented yet -->
    <section v-else-if="method === 'ai'" class="card-surface p-lg" data-enter>
      <h2 class="text-heading-3 text-ink">
        Generate with AI
      </h2>
      <p class="mt-xxs text-body-sm text-ink-muted">
        This method is not available yet.
      </p>
    </section>

    <p class="mt-lg text-caption text-ink-faint">
      Selected method: {{ selected?.title }}
    </p>
  </div>
</template>

<style scoped>
/*
  Method cards are radio-like buttons, so they need press feedback and a clear selected
  state that matches the chips used elsewhere: dark border, no loud fill.
*/
.method-card {
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;
}

.method-card:hover {
  border-color: var(--ink-faint);
  box-shadow: var(--shadow-1);
}

.method-card:active {
  transform: scale(0.99);
}

.method-card.is-selected {
  border-color: var(--ink);
  box-shadow: var(--shadow-1);
}

.method-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.method-card.is-disabled:hover {
  border-color: var(--hairline);
  box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
  .method-card {
    transition: none;
  }

  .method-card:active {
    transform: none;
  }
}
</style>
