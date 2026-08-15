<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import UserAvatar from '@/components/base/UserAvatar.vue'
import GameResultsView from '@/components/game/GameResultsView.vue'
import GameShell from '@/components/game/GameShell.vue'
import PlayerGameView from '@/components/game/PlayerGameView.vue'
import PlayerList from '@/components/game/PlayerList.vue'
import SelfPacedGameView from '@/components/game/SelfPacedGameView.vue'
import { getGameByCode, joinGame } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useGameSocket } from '@/composables/useGameSocket'
import { useGuestId } from '@/composables/useGuestId'
import {
  clearPlayerSession,
  clearRoomTicket,
  readPlayerSession,
  readRoomTicket,
  savePlayerSession,
} from '@/composables/usePlayerSession'
import { revealOnEnter } from '@/composables/useMotion'
import { modeLabel } from '@/constants/gameConfig'
import { useAuthStore } from '@/stores/auth.store'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * Player lobby at /play/:code.
 *
 * The seat itself comes from the join step, not from this route: the room code in the URL
 * is public, so a shared link can never be enough to sit down. This screen only reuses the
 * socket token kept in sessionStorage, which is what makes a reload keep the same player
 * row instead of creating a new one.
 *
 * A guest who closed the tab is rejoined silently from the room ticket, and the host of
 * this room is sent to the host screen: the backend refuses a host seat anyway.
 *
 * The player list is realtime (`lobby:updated`); the REST call is only for the room title,
 * which the socket state does not carry.
 */
const props = defineProps({
  code: { type: String, required: true },
})

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const game = useGameStore()
const socket = useGameSocket()

const pageEl = ref(null)
const loading = ref(true)
const loadError = ref('')
const session = ref(null)

const roomCode = computed(() => String(props.code || '').toUpperCase())
const roomName = computed(() => session.value?.session_name || '')
const quizName = computed(() => session.value?.quiz?.quiz_name || '')
const modeName = computed(() => modeLabel(game.mode || session.value?.game_mode || ''))
const players = computed(() => game.players)
const maxPlayers = computed(() => game.config?.lobby?.maxPlayers ?? null)
const waiting = computed(() => game.sessionStatus === 'lobby')
const cancelled = computed(() => game.sessionStatus === 'cancelled')
const connectionProblem = computed(() => ['reconnecting', 'closed'].includes(game.connection))

// The room row now carries the host identity, so the lobby can show who is running it.
const hostName = computed(() => session.value?.session_host_name || '')
const hostAvatar = computed(() => session.value?.session_host_avatar || '')

// A running match owns the whole viewport; the lobby and the end screen stay on a page grid.
const inMatch = computed(() => !waiting.value && !cancelled.value && !game.isFinished)

/**
 * The room can be closed while the player waits, which is not a load error. Once the
 * match is running the gameplay view says everything, so the room card stays quiet.
 */
const roomMessage = computed(() => {
  if (cancelled.value) return 'The host closed this room.'
  return ''
})

async function load() {
  loading.value = true
  loadError.value = ''

  const found = await getGameByCode(roomCode.value).catch((error) => {
    loadError.value = toErrorMessage(error, 'Room not found. Check the code and try again.')
    return null
  })
  if (!found) {
    loading.value = false
    return
  }

  // Opening a join link for your own room should host it, not fail on a refused seat.
  if (auth.isLoggedIn && found.session?.session_host === auth.user?.id) {
    router.replace({ name: 'host-lobby', params: { code: roomCode.value } })
    return
  }

  session.value = found.session
  // Paint the room from REST first so the list is never empty while the socket connects.
  game.applyLobby({
    session_status: found.session?.session_status ?? 'lobby',
    config: found.config,
    players: found.players,
  })

  const stored = readPlayerSession(roomCode.value)
  let token = stored?.socketToken ?? null
  let playerId = stored?.playerId ?? null

  if (!token) {
    // No seat in this tab: either a fresh tab or the previous one was closed, which wipes
    // sessionStorage. A signed-in visitor is rejoined from the session cookie; a guest is
    // rejoined from the room ticket (nickname) plus the guest id in localStorage, which is
    // what makes the backend hand back the same player row instead of a second one.
    const ticket = readRoomTicket(roomCode.value)
    if (!auth.isLoggedIn && !ticket?.playerName) {
      router.replace({ name: 'join-game', query: { code: roomCode.value } })
      return
    }

    const joined = await joinGame(
      roomCode.value,
      auth.isLoggedIn ? {} : { playerName: ticket.playerName, guestId: useGuestId() },
    ).catch((error) => {
      // A refused rejoin (room closed, full, no late join) makes the ticket worthless.
      clearRoomTicket(roomCode.value)
      loadError.value = toErrorMessage(error, 'Could not join this room.')
      return null
    })
    if (!joined?.socketToken) {
      loading.value = false
      return
    }

    token = joined.socketToken
    playerId = joined.player?.id ?? null
    savePlayerSession({
      code: roomCode.value,
      sessionId: found.session?.id ?? null,
      playerId,
      playerName: joined.player?.player_name ?? ticket?.playerName ?? '',
      socketToken: token,
    })
  }

  socket.connect(token, {
    role: 'player',
    code: roomCode.value,
    sessionId: found.session?.id ?? null,
    playerId,
  })
  loading.value = false
}

onMounted(() => {
  revealOnEnter(pageEl.value)
  load()
})

// The status change is the only signal a player gets about the host pressing Start.
watch(
  () => game.sessionStatus,
  (status, previous) => {
    if (status === previous) return
    if (status === 'active') ui.toast('The host started the game.')
    if (status === 'cancelled') {
      clearPlayerSession(roomCode.value)
      ui.toast('The host closed this room.', 'error')
    }
  },
)

// A fatal socket error (revoked token, room gone) leaves the player stuck otherwise.
watch(
  () => game.lastError,
  (error) => {
    if (!error) return
    if (['UNAUTHORIZED', 'FORBIDDEN', 'GONE'].includes(error.code)) {
      clearPlayerSession(roomCode.value)
      loadError.value = error.message || 'This room is no longer available.'
    }
  },
)
</script>

<template>
  <GameShell width="max-w-none" :wide="!inMatch" :bleed="inMatch">
    <div ref="pageEl" class="flex w-full grow flex-col">
      <div v-if="loading" class="flex items-center gap-xs text-body-sm text-ink-2" data-enter>
        <BaseSpinner />
        <span>Joining the room&hellip;</span>
      </div>

      <section v-else-if="loadError" class="mx-auto w-full max-w-[560px]" data-enter>
        <h1 class="text-heading-2 text-ink">
          Cannot join this room
        </h1>
        <p class="mt-xs text-body-sm text-ink-2">
          {{ loadError }}
        </p>
        <div class="mt-lg flex items-center gap-xs">
          <RouterLink class="btn-primary" :to="{ name: 'join-game' }">
            Try another code
          </RouterLink>
          <button class="btn-ghost" type="button" @click="load">
            Retry
          </button>
        </div>
      </section>

      <!-- Lobby: flat information, then the roster. No cards, the page is the card. -->
      <div v-else-if="waiting || roomMessage" class="flex w-full grow flex-col gap-xl">
        <header class="flex flex-wrap items-end justify-between gap-md" data-enter>
          <div class="min-w-0">
            <p class="eyebrow-label">
              Room <span class="num">{{ roomCode }}</span>
            </p>
            <h1 class="mt-xs break-words text-heading-1 text-ink" :title="roomName || quizName">
              {{ roomName || quizName || 'Quiz room' }}
            </h1>
            <p v-if="quizName" class="mt-xxs truncate text-body-md text-ink-2" :title="quizName">
              {{ quizName }}
            </p>
          </div>
          <span v-if="modeName" class="chip shrink-0 whitespace-nowrap">{{ modeName }}</span>
        </header>

        <div class="flex flex-wrap items-center gap-lg border-y border-hairline py-md" data-enter>
          <div v-if="hostName" class="flex items-center gap-sm">
            <UserAvatar :name="hostName" :src="hostAvatar" :size="36" />
            <span class="min-w-0">
              <span class="block text-caption text-ink-3">Host</span>
              <span class="block truncate text-body-sm font-medium text-ink">{{ hostName }}</span>
            </span>
          </div>

          <div v-if="waiting" class="flex items-center gap-sm text-body-sm text-ink-2">
            <BaseSpinner />
            <span>You are in. Waiting for the host to start&hellip;</span>
          </div>
          <p v-else-if="roomMessage" class="text-body-sm text-ink-2">
            {{ roomMessage }}
          </p>
        </div>

        <p v-if="connectionProblem" class="text-body-sm text-ans-a" data-enter>
          Live updates are down ({{ game.connection }}). The player list may be out of date.
        </p>

        <PlayerList
          v-if="waiting"
          flat
          :players="players"
          :me-id="game.playerId"
          :max-players="maxPlayers"
          data-enter
        />
      </div>

      <!-- Finished: the end screen owns the page, reload or not. -->
      <GameResultsView v-else-if="game.isFinished" data-enter />
      <!-- Self-paced modes run on their own clock, with lives and a match budget. -->
      <SelfPacedGameView v-else-if="game.isSelfPaced" data-enter />
      <PlayerGameView v-else data-enter />
    </div>
  </GameShell>
</template>
