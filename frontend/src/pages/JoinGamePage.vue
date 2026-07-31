<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from '@/components/base/BrandLogo.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { getGameByCode, joinGame } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useAuthStore } from '@/stores/auth.store'
import { useGuestId } from '@/composables/useGuestId'
import { useUiStore } from '@/stores/ui.store'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Join a live game.
 *
 * Step 1: the room code is checked against GET /games/:code, which is public and
 *         never exposes answers. That way a wrong code fails before asking for a name.
 * Step 2: POST /games/:code/join. Auth is optional there: with a session cookie the
 *         backend takes the identity from the token and ignores the body, so the guest
 *         name field is only shown to visitors who are not signed in.
 * Step 3: the lobby. The player list is polled every 3s until the host starts the
 *         session; the returned socketToken is kept for the gameplay screen.
 */
const CODE_MAX = 8
const NAME_MAX = 50
const POLL_INTERVAL = 3000

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const pageEl = ref(null)
const step = ref('code') // 'code' | 'name' | 'lobby'
const code = ref('')
const playerName = ref('')
const error = ref('')
const checking = ref(false)
const joining = ref(false)

const room = reactive({ session: null, players: [], config: null })
const me = ref(null)
const socketToken = ref(null)

let pollTimer = null

const quizTitle = computed(() => room.session?.quiz?.quiz_name || room.session?.session_name || 'Quiz')
const hostName = computed(() => room.session?.host?.fullname || 'Host')
const playerCount = computed(() => room.players.length)
const allowsGuests = computed(() => room.config?.allow_guests !== false)
const needsName = computed(() => !auth.isLoggedIn)

/** Room codes are short and case-insensitive; the backend stores them uppercase. */
function normalizeCode(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_MAX)
}

function onCodeInput(event) {
  code.value = normalizeCode(event.target.value)
}

async function checkCode() {
  error.value = ''
  if (code.value.length < 4) {
    error.value = 'Enter the room code shown on the host screen.'
    return
  }

  checking.value = true
  try {
    const found = await getGameByCode(code.value)
    room.session = found.session
    room.players = found.players
    room.config = found.config

    const status = found.session?.status
    if (status && status !== 'lobby' && status !== 'waiting') {
      error.value = 'This game has already started.'
      return
    }
    if (needsName.value && !allowsGuests.value) {
      error.value = 'The host only allows signed-in players in this room.'
      return
    }

    // Signed-in players skip the name step: the backend uses their account.
    if (needsName.value) {
      await goToStep('name')
    } else {
      await submitJoin()
    }
  } catch (err) {
    error.value = toErrorMessage(err, 'Room not found. Check the code and try again.')
  } finally {
    checking.value = false
  }
}

async function submitJoin() {
  error.value = ''

  const nickname = playerName.value.trim()
  if (needsName.value && (nickname.length < 1 || nickname.length > NAME_MAX)) {
    error.value = `Pick a nickname of 1 to ${NAME_MAX} characters.`
    return
  }

  joining.value = true
  try {
    const result = await joinGame(
      code.value,
      needsName.value ? { playerName: nickname, guestId: useGuestId() } : {},
    )
    me.value = result.player
    socketToken.value = result.socketToken
    await goToStep('lobby')
    await refreshRoom()
    startPolling()
  } catch (err) {
    // 403 guests not allowed / host cannot join, 409 room full or already started.
    error.value = toErrorMessage(err, 'Could not join this room.')
  } finally {
    joining.value = false
  }
}

async function refreshRoom() {
  try {
    const found = await getGameByCode(code.value)
    room.session = found.session
    room.players = found.players
    room.config = found.config

    const status = found.session?.status
    if (status && status !== 'lobby' && status !== 'waiting') {
      // The host started the round. Gameplay runs over the socket connection, which
      // is not part of this screen yet, so tell the player instead of hanging here.
      stopPolling()
      ui.toast('The host has started the game.')
    }
  } catch {
    // A single failed poll is not worth an error state; the next tick retries.
  }
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(refreshRoom, POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
}

function leaveLobby() {
  stopPolling()
  me.value = null
  socketToken.value = null
  goToStep('code')
}

/**
 * Each step is a separate card, so it gets the same entrance animation the rest of the
 * app uses. Without this the card would swap in instantly and the flow would feel
 * disconnected from every other page.
 */
async function goToStep(next) {
  step.value = next
  error.value = ''
  await nextTick()
  revealOnEnter(pageEl.value, '[data-enter-step]', { y: 14 })
}

// A shared link can carry the code: /join?code=ABC123
onMounted(() => {
  revealOnEnter(pageEl.value)

  const fromQuery = route.query.code
  if (typeof fromQuery === 'string' && fromQuery) {
    code.value = normalizeCode(fromQuery)
    checkCode()
  }
})

onBeforeUnmount(stopPolling)

// Signing in while the name step is open makes that step pointless.
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && step.value === 'name') submitJoin()
  },
)
</script>

<template>
  <div ref="pageEl" class="container-page max-w-[560px] py-xxl">
    <div class="flex justify-center" data-enter>
      <BrandLogo />
    </div>

    <!-- Step 1: room code -->
    <section v-if="step === 'code'" class="card-surface mt-lg p-xl text-center" data-enter data-enter-step>
      <h1 class="text-heading-2 text-ink">
        Join a game
      </h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        Enter the code shown on the host screen.
      </p>

      <form class="mt-lg grid gap-md" @submit.prevent="checkCode">
        <input
          :value="code"
          class="field text-center text-heading-2 tracking-[0.3em]"
          type="text"
          inputmode="latin"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          :maxlength="CODE_MAX"
          placeholder="CODE"
          aria-label="Room code"
          @input="onCodeInput"
        >

        <p v-if="error" class="text-body-sm text-sticker-orange-deep">
          {{ error }}
        </p>

        <button class="btn-primary w-full justify-center" type="submit" :disabled="checking">
          {{ checking ? 'Checking…' : 'Continue' }}
        </button>
      </form>

      <p v-if="!auth.isLoggedIn" class="mt-md text-caption text-ink-faint">
        You can play as a guest, or
        <RouterLink :to="{ name: 'login', query: { redirect: '/join' } }" class="section-link">
          log in
        </RouterLink>
        to keep your scores.
      </p>
    </section>

    <!-- Step 2: nickname (guests only) -->
    <section v-else-if="step === 'name'" class="card-surface mt-lg p-xl" data-enter data-enter-step>
      <p class="eyebrow-label">
        Room {{ code }}
      </p>
      <h1 class="mt-xxs text-heading-2 text-ink">
        {{ quizTitle }}
      </h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        Hosted by {{ hostName }}
      </p>

      <form class="mt-lg grid gap-md" @submit.prevent="submitJoin">
        <label class="block">
          <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">Your nickname</span>
          <input
            v-model="playerName"
            class="field"
            type="text"
            :maxlength="NAME_MAX"
            placeholder="Everyone will see this"
            autocomplete="nickname"
          >
        </label>

        <p v-if="error" class="text-body-sm text-sticker-orange-deep">
          {{ error }}
        </p>

        <div class="flex items-center gap-xs">
          <button class="btn-primary" type="submit" :disabled="joining || !playerName.trim()">
            {{ joining ? 'Joining…' : 'Join game' }}
          </button>
          <button class="btn-ghost" type="button" :disabled="joining" @click="goToStep('code')">
            Back
          </button>
        </div>
      </form>
    </section>

    <!-- Step 3: lobby -->
    <section v-else class="card-surface mt-lg p-xl" data-enter data-enter-step>
      <div class="flex items-start justify-between gap-sm">
        <div>
          <p class="eyebrow-label">
            Room {{ code }}
          </p>
          <h1 class="mt-xxs text-heading-2 text-ink">
            {{ quizTitle }}
          </h1>
          <p class="mt-xs text-body-sm text-ink-muted">
            Hosted by {{ hostName }}
          </p>
        </div>
        <span class="chip whitespace-nowrap">{{ playerCount }} in room</span>
      </div>

      <div class="mt-lg flex items-center gap-xs text-body-sm text-ink-muted">
        <BaseSpinner />
        <span>Waiting for the host to start…</span>
      </div>

      <ul class="mt-md grid grid-cols-2 gap-xs sm:grid-cols-3">
        <li
          v-for="player in room.players"
          :key="player.id ?? player.player_name"
          class="flex items-center gap-xs rounded-md border border-hairline px-sm py-xs"
          :class="me && player.id === me.id ? 'bg-canvas-soft' : ''"
        >
          <span class="grid h-[24px] w-[24px] shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-caption font-semibold text-white">
            {{ (player.player_name || 'P').trim()[0].toUpperCase() }}
          </span>
          <span class="truncate text-body-sm text-ink">{{ player.player_name }}</span>
        </li>
      </ul>

      <div class="mt-lg flex items-center gap-xs">
        <button class="btn-utility" type="button" @click="refreshRoom">
          Refresh
        </button>
        <button class="btn-ghost" type="button" @click="leaveLobby">
          Leave
        </button>
        <button class="btn-ghost ml-auto" type="button" @click="router.push({ name: 'home' })">
          Back to home
        </button>
      </div>
    </section>
  </div>
</template>
