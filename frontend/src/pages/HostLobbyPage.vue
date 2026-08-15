<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import GameShell from '@/components/game/GameShell.vue'
import HostGameConsole from '@/components/game/HostGameConsole.vue'
import HostResultsBoard from '@/components/game/HostResultsBoard.vue'
import HostSelfPacedBoard from '@/components/game/HostSelfPacedBoard.vue'
import PlayerList from '@/components/game/PlayerList.vue'
import RoomSettingsDialog from '@/components/game/RoomSettingsDialog.vue'
import { getGameByCode, getHostToken, listGameModes, updateGameConfig } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { buildPatch, changedValues, ignoredMessage, modeLabel, readValues } from '@/constants/gameConfig'
import { useGameSocket } from '@/composables/useGameSocket'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Host lobby for /host/:code.
 *
 * The room code in the URL is public, so it proves nothing. Hosting rights come from
 * `POST /games/:id/host-token`, which the server only signs for the account that owns the
 * session: if that call fails, this page has nothing to show and says so.
 *
 *   GET  /games/:code            -> the session row, its players and its config
 *   POST /games/:id/host-token   -> the socket token, then the /game namespace as host
 *   lobby:updated                -> the player list and the config from then on
 *
 * The screen is projected on a wall, so the code is the loudest thing on it and settings
 * live in a dialog behind one icon. The site header and footer are gone for the same
 * reason: a host who wanders into Discover mid-room drops the socket.
 *
 * Settings are edited through `lobby:config-update` because that broadcast is what keeps
 * the players in sync; `PATCH /games/:id/config` is only the fallback while the socket is
 * down. Either way the answer carries `ignored`, the paths the server refused, and those
 * are shown instead of pretending everything was saved.
 */
const props = defineProps({
  code: { type: String, required: true },
})

const game = useGameStore()
const ui = useUiStore()
const socket = useGameSocket()

const pageEl = ref(null)
const loading = ref(true)
const loadError = ref('')
const session = ref(null)
const spec = ref(null)
const baseline = ref({})
const values = ref({})
const saving = ref(false)
const configError = ref('')
const ignored = ref([])
const starting = ref(false)
const settingsOpen = ref(false)

const roomCode = computed(() => (session.value?.session_code ?? props.code ?? '').toUpperCase())
const roomName = computed(() => session.value?.session_name ?? '')
const quizName = computed(() => session.value?.quiz?.quiz_name ?? 'Quiz')
const modeName = computed(() => game.mode ?? session.value?.game_mode ?? session.value?.mode ?? '')
const shareLink = computed(() => `${window.location.origin}/join?code=${roomCode.value}`)

// The live list comes from lobby:updated; the REST answer only fills the first paint.
const players = computed(() => game.players ?? [])
const maxPlayers = computed(() => game.config?.lobby?.maxPlayers ?? null)
const status = computed(() => game.sessionStatus ?? session.value?.session_status ?? 'lobby')
const statusLabel = computed(() => {
  const s = status.value
  return s.charAt(0).toUpperCase() + s.slice(1)
})
const inLobby = computed(() => status.value === 'lobby')
// A running match owns the viewport; the lobby and the report keep the page gutter.
const inMatch = computed(() => !inLobby.value && !game.isFinished)
const connection = computed(() => game.connection ?? 'idle')
// A healthy socket says nothing: only a broken one is worth a line on the screen, because
// then the player list has stopped updating and the host needs to know why.
const connectionProblem = computed(() => ['error', 'disconnected', 'reconnecting'].includes(connection.value))
const dirty = computed(() => Object.keys(changedValues(values.value, baseline.value)).length > 0)
const ignoredMessages = computed(() => ignored.value.map((entry) => ignoredMessage(entry)))

function applyConfig(config) {
  if (!spec.value || !config) return
  baseline.value = readValues(spec.value.editable, config)
  values.value = { ...baseline.value }
}

async function loadSpec(row, config) {
  const list = await listGameModes().catch(() => [])
  const name = row.game_mode ?? row.mode
  spec.value = list.find((entry) => entry.mode === name) ?? null
  applyConfig(config ?? row.config)
}

async function load() {
  loading.value = true
  loadError.value = ''

  const room = await getGameByCode(props.code).catch((error) => {
    loadError.value = toErrorMessage(error)
    return null
  })
  if (!room?.session) {
    loading.value = false
    return
  }
  session.value = room.session

  const token = await getHostToken(room.session.id).catch((error) => {
    loadError.value = toErrorMessage(error)
    return null
  })
  if (!token) {
    loading.value = false
    return
  }

  await loadSpec(room.session, room.config)
  loading.value = false
  socket.connect(token, { role: 'host', code: roomCode.value, sessionId: room.session.id })
}

async function saveConfig() {
  if (saving.value || !spec.value) return
  const patch = buildPatch(changedValues(values.value, baseline.value))
  if (!Object.keys(patch).length) {
    ui.toast('Nothing to save yet.')
    return
  }

  saving.value = true
  configError.value = ''
  ignored.value = []

  const overSocket = connection.value === 'connected'
  const result = overSocket
    ? await socket.updateConfig(patch).catch((error) => {
      configError.value = error?.message || 'Could not save the room settings.'
      return null
    })
    : await updateGameConfig(session.value.id, patch).catch((error) => {
      configError.value = toErrorMessage(error)
      return null
    })
  saving.value = false
  if (!result) return
  if (result.ok === false) {
    configError.value = 'The server refused the change.'
    return
  }

  ignored.value = result.ignored ?? []
  applyConfig(result.config)
  ui.toast(ignored.value.length ? 'Saved, some settings were kept as they were.' : 'Room settings saved.')
  // The dialog stays open when the server kept a value, so the host can see which one.
  if (!ignored.value.length) settingsOpen.value = false
}

function resetConfig() {
  values.value = { ...baseline.value }
  ignored.value = []
  configError.value = ''
}

function closeSettings() {
  resetConfig()
  settingsOpen.value = false
}

function start() {
  if (starting.value || !inLobby.value) return
  starting.value = true
  socket.start()
}

async function copy(text, label) {
  const ok = await navigator.clipboard
    ?.writeText(text)
    .then(() => true)
    .catch(() => false)
  ui.toast(ok ? `${label} copied.` : 'Copy failed, select the text instead.')
}

// A config change made from another host tab arrives as lobby:updated. It is only mirrored
// into the form while nothing is being edited here, so it cannot overwrite typing.
watch(
  () => game.config,
  (config) => {
    if (!dirty.value) applyConfig(config)
  },
)

watch(status, (value) => {
  if (value === 'lobby') return
  starting.value = false
  settingsOpen.value = false
})

onMounted(() => {
  revealOnEnter(pageEl.value)
  load()
})

onBeforeUnmount(() => {
  // Leaving the host room does not cancel the session: the server keeps it alive.
  socket.leave()
  game.reset()
})
</script>

<template>
  <GameShell width="max-w-none" :wide="!inMatch" :bleed="inMatch">
    <div ref="pageEl" class="flex w-full grow flex-col">
      <div v-if="loading" class="flex justify-center py-xxl">
        <BaseSpinner />
      </div>

      <div v-else-if="loadError" class="card-surface mx-auto max-w-[560px] p-xl" data-enter>
        <h1 class="text-heading-2 text-ink">
          This room cannot be hosted
        </h1>
        <p class="mt-sm text-body-sm text-ink-2">
          {{ loadError }}
        </p>
        <p class="mt-xs text-caption text-ink-3">
          Only the account that created the room can host it.
        </p>
        <div class="mt-lg flex flex-wrap gap-xs">
          <button class="btn-utility" type="button" @click="load">
            Try again
          </button>
          <RouterLink :to="{ name: 'library' }" class="btn-ghost">
            Back to my library
          </RouterLink>
        </div>
      </div>

      <div v-else class="flex w-full grow flex-col gap-lg">
        <!-- Lobby. The code is the whole point of this card, so it leads. -->
        <section v-if="inLobby" class="wash-panel relative p-xl text-center" data-enter>
          <!-- Settings sit behind one icon: the code, not the setup, owns this screen. -->
          <button
            v-if="spec"
            class="icon-btn absolute right-md top-md"
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

          <p class="eyebrow-label">
            {{ modeLabel(modeName) }} room
          </p>
          <h1 class="mx-auto mt-xs line-clamp-2 max-w-[36ch] break-words text-heading-2 text-ink" :title="roomName || quizName">
            {{ roomName || quizName }}
          </h1>
          <p class="mt-xxs truncate text-body-sm text-ink-2" :title="quizName">
            {{ quizName }}
          </p>

          <div class="card-soft mx-auto mt-lg max-w-[520px] px-lg py-lg">
            <p class="eyebrow-label">
              Room code
            </p>
            <p class="num mt-sm break-all text-[52px] font-medium leading-none tracking-[0.14em] text-ink">
              {{ roomCode }}
            </p>
            <div class="mt-lg flex flex-wrap items-center justify-center gap-xs">
              <button class="btn-utility" type="button" @click="copy(roomCode, 'Room code')">
                Copy code
              </button>
              <button class="btn-utility" type="button" @click="copy(shareLink, 'Join link')">
                Copy join link
              </button>
            </div>
            <p class="mt-sm break-all text-caption text-ink-3">
              {{ shareLink }}
            </p>
          </div>

          <div class="mt-lg flex flex-wrap items-center justify-center gap-xs">
            <button
              class="btn-primary"
              type="button"
              :disabled="!inLobby || starting || !players.length"
              @click="start"
            >
              {{ starting ? 'Starting\u2026' : 'Start the game' }}
            </button>
            <span v-if="!inLobby" class="chip">{{ statusLabel }}</span>
          </div>

          <p v-if="connectionProblem" class="mt-sm text-caption text-ans-a">
            Live updates are down ({{ connection }}). The player list may be out of date.
          </p>
          <p v-else-if="inLobby && !players.length" class="mt-sm text-caption text-ink-3">
            Waiting for the first player to join.
          </p>
        </section>

        <PlayerList
          v-if="inLobby"
          flat
          :players="players"
          :max-players="maxPlayers"
          data-enter
        />

        <!-- Once the match runs the console owns the screen: the code is done recruiting. -->
        <template v-else>
          <section class="card-surface flex flex-wrap items-center justify-between gap-sm p-lg" data-enter>
            <p class="eyebrow-label">
              Room <span class="num">{{ roomCode }}</span>
            </p>
            <span class="chip">{{ statusLabel }}</span>
          </section>
          <!-- Finished: there is nothing left to drive, so the report takes over. -->
          <HostResultsBoard v-if="game.isFinished" data-enter />
          <!-- Self-paced: no shared question to drive, only progress to watch. -->
          <HostSelfPacedBoard v-else-if="game.isSelfPaced" data-enter />
          <HostGameConsole v-else data-enter />
        </template>
      </div>
    </div>

    <RoomSettingsDialog
      v-if="spec"
      v-model="values"
      :open="settingsOpen"
      :editable="spec.editable"
      :disabled="saving || !inLobby"
      description="Changes reach every player right away, and only work before the start."
      @close="closeSettings"
    >
      <template #notes>
        <p v-if="configError" class="mt-md text-body-sm text-ans-a">
          {{ configError }}
        </p>

        <div v-if="ignoredMessages.length" class="mt-md">
          <p class="text-caption text-ink-2">
            The server kept its own value for:
          </p>
          <ul class="mt-xxs grid gap-xxs">
            <li v-for="message in ignoredMessages" :key="message" class="text-caption text-ink-3">
              {{ message }}
            </li>
          </ul>
        </div>
      </template>

      <template #footer>
        <button class="btn-ghost" type="button" :disabled="!dirty || saving" @click="resetConfig">
          Undo
        </button>
        <button
          class="btn-primary"
          type="button"
          :disabled="!dirty || saving || !inLobby"
          @click="saveConfig"
        >
          {{ saving ? 'Saving\u2026' : 'Save settings' }}
        </button>
      </template>
    </RoomSettingsDialog>
  </GameShell>
</template>
