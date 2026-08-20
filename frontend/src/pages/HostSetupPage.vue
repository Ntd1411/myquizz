<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import RoomSettingsDialog from '@/components/game/RoomSettingsDialog.vue'
import { createGame, listGameModes } from '@/api/games.api'
import { getQuizById } from '@/api/quizzes.api'
import { toErrorMessage } from '@/api/envelope'
import {
  HIDDEN_MODES,
  MODE_META,
  buildPatch,
  changedValues,
  ignoredMessage,
  readValues,
} from '@/constants/gameConfig'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Room setup for /host/new/:quizId, the screen behind "Host a game".
 *
 * It is a page and not a dialog because the mode is a real choice: it decides how the room
 * plays and which settings even exist. The settings themselves are a dialog, since the
 * defaults are already playable and most hosts only pick a name and a mode.
 *
 *   GET  /games/game-modes -> which paths a mode allows and which ones it owns
 *   POST /games            -> the room, plus the `ignored` paths the server dropped
 *
 * Only values that really differ from the mode default are sent: the server normalizes a
 * config after every merge, so echoing untouched values back would come home as `ignored`
 * and read like a failure.
 */
const props = defineProps({
  quizId: { type: String, required: true },
})

const NAME_MIN = 2
const NAME_MAX = 100
const router = useRouter()

const pageEl = ref(null)
const loading = ref(true)
const loadError = ref('')
const modes = ref([])
const mode = ref('classic')
const sessionName = ref('')
const values = ref({})
const submitting = ref(false)
const formError = ref('')
const ignored = ref([])
const settingsOpen = ref(false)

const visibleModes = computed(() => modes.value.filter((entry) => !HIDDEN_MODES.includes(entry.mode)))
const spec = computed(() => visibleModes.value.find((entry) => entry.mode === mode.value) ?? null)
const baseline = computed(() => readValues(spec.value?.editable, spec.value?.defaultConfig))
const ignoredMessages = computed(() => ignored.value.map((entry) => ignoredMessage(entry)))
const nameError = computed(() => sessionName.value.trim().length < NAME_MIN)
const changedCount = computed(() => Object.keys(changedValues(values.value, baseline.value)).length)

function metaFor(name) {
  return MODE_META[name] ?? { label: name, tagline: '' }
}

function resetValues() {
  values.value = { ...baseline.value }
}

function pickMode(name) {
  if (name === mode.value) return
  mode.value = name
  // Every mode exposes a different set of paths, so the values are rebuilt, not merged.
  resetValues()
  ignored.value = []
  formError.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''

  // Both requests leave in the same tick. Only the mode catalogue is required: the quiz is
  // read to prefill the room name, so a failure there is not worth blocking the page for.
  const [detail, list] = await Promise.all([
    getQuizById(props.quizId).catch(() => null),
    listGameModes().catch((error) => {
      loadError.value = toErrorMessage(error, 'Could not load the game modes.')
      return []
    }),
  ])

  modes.value = list
  if (!visibleModes.value.some((entry) => entry.mode === mode.value)) {
    mode.value = visibleModes.value[0]?.mode ?? ''
  }
  if (detail?.title) sessionName.value = String(detail.title).slice(0, NAME_MAX)
  resetValues()
  loading.value = false
}

async function submit() {
  if (submitting.value || !spec.value || nameError.value) return
  formError.value = ''
  ignored.value = []
  submitting.value = true

  const patch = buildPatch(changedValues(values.value, baseline.value))
  const result = await createGame({
    quizId: props.quizId,
    sessionName: sessionName.value.trim(),
    mode: mode.value,
    config: Object.keys(patch).length ? patch : undefined,
  }).catch((error) => {
    formError.value = toErrorMessage(error, 'Could not create the room.')
    return null
  })
  submitting.value = false
  if (!result?.session) return

  ignored.value = result.ignored ?? []
  const code = result.session.session_code ?? result.session.code ?? ''
  if (!code) {
    formError.value = 'The room was created but the server returned no room code.'
    return
  }
  // The lobby shows the settings again, so anything the server refused is visible there.
  router.push({ name: 'host-lobby', params: { code } })
}

onMounted(() => {
  revealOnEnter(pageEl.value)
  load()
})
</script>

<template>
  <div ref="pageEl" class="container-page py-xxl">
    <div v-if="loading" class="flex justify-center py-xxl">
      <BaseSpinner />
    </div>

    <div v-else-if="loadError && !spec" class="card-surface p-xl" data-enter>
      <h1 class="text-heading-2 text-ink">
        This quiz cannot be hosted right now
      </h1>
      <p class="mt-sm text-body-sm text-ink-muted">
        {{ loadError }}
      </p>
      <div class="mt-lg flex flex-wrap gap-xs">
        <button class="btn btn-utility" type="button" @click="load">
          Try again
        </button>
        <RouterLink :to="{ name: 'library' }" class="btn btn-ghost">
          Back to my library
        </RouterLink>
      </div>
    </div>

    <form v-else class="grid gap-lg" @submit.prevent="submit">
      <section class="card-surface p-xl" data-enter>
        <div class="flex items-start justify-between gap-sm">
          <p class="eyebrow-label">
            Room details
          </p>
          <div v-if="spec" class="flex shrink-0 items-center gap-xs">
            <span v-if="changedCount" class="chip">{{ changedCount }} changed</span>
            <button
              class="rounded-md p-xxs text-ink-muted transition-colors hover:text-ink"
              type="button"
              title="Room settings"
              @click="settingsOpen = true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-[20px] w-[20px]"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.9 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.1a2 2 0 1 1-4 0v-.16a1.7 1.7 0 0 0-2.8-1.14l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.1 13.6H4a2 2 0 1 1 0-4h.16A1.7 1.7 0 0 0 5.3 5.8l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.87 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.9 9.4v.16A1.7 1.7 0 0 0 21 10.7h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.1.9Z" />
              </svg>
              <span class="sr-only">Room settings</span>
            </button>
          </div>
        </div>

        <label class="mt-md block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Room name</span>
          <input
            v-model="sessionName"
            class="field w-full"
            type="text"
            :maxlength="NAME_MAX"
            placeholder="Friday review round"
          >
          <span v-if="nameError" class="mt-xxs block text-caption text-sticker-orange-deep">
            At least {{ NAME_MIN }} characters.
          </span>
          <span v-else class="mt-xxs block text-caption text-ink-faint">
            Players see this name in the lobby.
          </span>
        </label>

        <fieldset class="mt-lg">
          <legend class="text-body-sm font-medium text-ink-secondary">
            Mode
          </legend>
          <div class="mt-sm grid gap-sm sm:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="entry in visibleModes"
              :key="entry.mode"
              class="rounded-md border-hairline p-md text-left transition-all duration-150"
              :class="entry.mode === mode
                ? 'border-primary bg-canvas-soft text-ink shadow-sm ring-2 ring-primary/50'
                : 'text-ink-secondary hover:-translate-y-[1px] hover:border-ink/25 hover:bg-canvas-soft hover:text-ink hover:shadow-sm'"
              type="button"
              :aria-pressed="entry.mode === mode"
              @click="pickMode(entry.mode)"
            >
              <span class="flex items-center gap-xs">
                <span
                  class="text-body-sm"
                  :class="entry.mode === mode ? 'font-semibold' : 'font-medium'"
                >
                  {{ metaFor(entry.mode).label }}
                </span>
                <span v-if="!entry.scored" class="chip">No score</span>
              </span>
              <span class="mt-xxs block text-caption text-ink-faint">
                {{ metaFor(entry.mode).tagline }}
              </span>
            </button>
          </div>
        </fieldset>
      </section>

      <div v-if="formError || ignoredMessages.length">
        <p v-if="formError" class="text-body-sm text-sticker-orange-deep">
          {{ formError }}
        </p>
        <div v-if="ignoredMessages.length" class="mt-xs">
          <p class="text-caption text-ink-muted">
            The server kept its own value for:
          </p>
          <ul class="mt-xxs grid gap-xxs">
            <li v-for="message in ignoredMessages" :key="message" class="text-caption text-ink-faint">
              {{ message }}
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-xs" data-enter>
        <button class="btn btn-primary" type="submit" :disabled="submitting || !spec || nameError">
          {{ submitting ? 'Creating\u2026' : 'Create room' }}
        </button>
        <RouterLink :to="{ name: 'quiz-detail', params: { id: quizId } }" class="btn btn-ghost">
          Cancel
        </RouterLink>
      </div>
    </form>

    <RoomSettingsDialog
      v-if="spec"
      v-model="values"
      :open="settingsOpen"
      :editable="spec.editable"
      :disabled="submitting"
      description="The defaults are ready to play. Everything here can still be changed in the lobby."
      @close="settingsOpen = false"
    />
  </div>
</template>
