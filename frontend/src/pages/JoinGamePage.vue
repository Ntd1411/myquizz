<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameShell from '@/components/game/GameShell.vue'
import { getGameByCode, joinGame } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useGuestId } from '@/composables/useGuestId'
import { revealOnEnter } from '@/composables/useMotion'
import { readLastGuestName, savePlayerSession } from '@/composables/usePlayerSession'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Join a live game: the room code, and a nickname only the first time a guest plays.
 *
 * Room codes are exactly six characters, so the sixth keystroke is the answer to the only
 * question this screen asks: there is nothing left to confirm and the join starts by itself.
 * The button stays for keyboards and screen readers, and as a retry after a failure.
 *
 * The code is checked against GET /games/:code, which is public and never exposes answers,
 * so a wrong code fails before anyone types a name. The room rules (guests, late join,
 * capacity) are read from the same response only to explain a refusal early; the backend
 * checks them again on join.
 *
 * Nobody is asked for something the app already knows:
 * - the host of this room is sent to /host/:code instead of taking a seat in it, which the
 *   backend would refuse anyway ('Host can not join game');
 * - a signed-in player joins with the identity in the session cookie;
 * - a returning guest joins with the nickname kept from the last room, because the backend
 *   reuses the player row tied to the guest id and would ignore a new name anyway.
 *
 * Waiting for the host happens on /play/:code, which owns the socket connection.
 */
const CODE_LENGTH = 6
const NAME_MAX = 50

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const pageEl = ref(null)
const codeInput = ref(null)
const step = ref('code') // 'code' | 'name'
const code = ref('')
const playerName = ref('')
const error = ref('')
const checking = ref(false)
const joining = ref(false)
const codeFocused = ref(false)

const room = reactive({ session: null, players: [], config: null })

const quizTitle = computed(
  () => room.session?.session_name || room.session?.quiz?.quiz_name || 'Quiz',
)
const hostName = computed(() => room.session?.host?.fullname || 'Host')
const asGuest = computed(() => !auth.isLoggedIn)
const busy = computed(() => checking.value || joining.value)
const complete = computed(() => code.value.length === CODE_LENGTH)

const cells = computed(() =>
  Array.from({ length: CODE_LENGTH }, (_, index) => ({ index, char: code.value[index] ?? '' })),
)
const activeCell = computed(() => Math.min(code.value.length, CODE_LENGTH - 1))

/** Room codes are short and case-insensitive; the backend stores them uppercase. */
function normalizeCode(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, CODE_LENGTH)
}

function onCodeInput(event) {
  code.value = normalizeCode(event.target.value)
  error.value = ''
  // The last character is the submit: no extra tap once the code is whole.
  if (complete.value && !busy.value) checkCode()
}

function focusCode() {
  codeInput.value?.focus()
}

/**
 * Reasons this room would refuse the visitor. Returns an empty string when the room is
 * open, so the caller can go straight on.
 */
function roomBlocker() {
  const status = room.session?.session_status
  const lobby = room.config?.lobby ?? {}

  if (status === 'finished' || status === 'cancelled') return 'This game is already over.'
  if (status && status !== 'lobby' && lobby.allowLateJoin === false)
    return 'This game has already started and the host closed late joining.'
  if (asGuest.value && lobby.allowGuests === false)
    return 'The host only allows signed-in players in this room.'
  if (lobby.maxPlayers && room.players.length >= lobby.maxPlayers)
    return 'This room is full.'
  return ''
}

async function checkCode() {
  if (busy.value) return
  error.value = ''
  if (!complete.value) {
    error.value = `The room code has ${CODE_LENGTH} characters.`
    return
  }

  checking.value = true
  const found = await getGameByCode(code.value).catch((err) => {
    error.value = toErrorMessage(err, 'Room not found. Check the code and try again.')
    return null
  })
  checking.value = false
  if (!found) return

  room.session = found.session
  room.players = found.players
  room.config = found.config

  // The owner of the room belongs on the host screen, not in the player list.
  if (auth.isLoggedIn && found.session?.session_host === auth.user?.id) {
    router.replace({ name: 'host-lobby', params: { code: code.value } })
    return
  }

  const blocked = roomBlocker()
  if (blocked) {
    error.value = blocked
    return
  }

  // Only a first-time guest still owes us something.
  if (asGuest.value && !playerName.value.trim()) await goToStep('name')
  else await submitJoin()
}

async function submitJoin() {
  error.value = ''

  const nickname = playerName.value.trim()
  if (asGuest.value && (nickname.length < 1 || nickname.length > NAME_MAX)) {
    error.value = `Pick a nickname of 1 to ${NAME_MAX} characters.`
    return
  }

  joining.value = true
  // 403 guests not allowed / host cannot join, 409 room full or already started.
  const joined = await joinGame(
    code.value,
    asGuest.value ? { playerName: nickname, guestId: useGuestId() } : {},
  ).catch((err) => {
    error.value = toErrorMessage(err, 'Could not join this room.')
    return null
  })
  joining.value = false
  if (!joined?.socketToken) {
    if (!error.value) error.value = 'The room did not hand out a seat. Try again.'
    // A stored nickname that the room refused is worth asking about again.
    if (asGuest.value && step.value === 'code') await goToStep('name')
    return
  }

  savePlayerSession({
    code: code.value,
    sessionId: room.session?.id ?? null,
    playerId: joined.player?.id ?? null,
    playerName: joined.player?.player_name ?? nickname,
    socketToken: joined.socketToken,
  })
  router.push({ name: 'play-lobby', params: { code: code.value } })
}

/**
 * Each step is a separate card, so it gets the same entrance animation the rest of the
 * app uses. Without this the card would swap in instantly and the flow would feel
 * disconnected from every other page.
 */
async function goToStep(next) {
  step.value = next
  await nextTick()
  revealOnEnter(pageEl.value, '[data-enter-step]', { y: 14 })
  if (next === 'code') focusCode()
}

// A shared link can carry the code: /join?code=ABC123
onMounted(() => {
  revealOnEnter(pageEl.value)
  // Guests keep the nickname of their last room, so a return visit is one tap.
  playerName.value = readLastGuestName()

  const fromQuery = route.query.code
  if (typeof fromQuery === 'string' && fromQuery) {
    code.value = normalizeCode(fromQuery)
    if (complete.value) {
      checkCode()
      return
    }
  }
  focusCode()
})

// Signing in while the name step is open makes that step pointless.
watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && step.value === 'name') submitJoin()
  },
)
</script>

<template>
  <GameShell width="max-w-[520px]">
    <div ref="pageEl">
      <!-- Step 1: room code -->
      <section v-if="step === 'code'" class="card-surface p-xl text-center" data-enter data-enter-step>
        <p class="eyebrow-label">
          Join a game
        </p>
        <h1 class="mt-xs text-heading-2 text-ink">
          Enter the room code
        </h1>
        <p class="mt-xxs text-body-sm text-ink-2">
          It is on the host screen.
        </p>

        <form class="mt-lg" @submit.prevent="checkCode">
          <!-- One field drawn as cells: the input itself stays invisible on top of them,
               so the caret, mobile keyboards and paste all keep working. -->
          <div class="relative" @click="focusCode">
            <div class="flex flex-wrap justify-center gap-xs">
              <span
                v-for="cell in cells"
                :key="cell.index"
                class="pin-cell"
                :class="{
                  'is-filled': cell.char,
                  'is-active': codeFocused && cell.index === activeCell,
                }"
              >{{ cell.char }}</span>
            </div>
            <input
              ref="codeInput"
              :value="code"
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="text"
              inputmode="latin"
              autocomplete="one-time-code"
              autocapitalize="characters"
              spellcheck="false"
              :maxlength="CODE_LENGTH"
              aria-label="Room code"
              @input="onCodeInput"
              @focus="codeFocused = true"
              @blur="codeFocused = false"
            >
          </div>

          <p v-if="error" class="mt-md text-body-sm text-ans-a">
            {{ error }}
          </p>

          <button
            class="btn-primary mt-lg w-full"
            type="submit"
            :disabled="busy || !complete"
          >
            {{ busy ? 'Joining\u2026' : 'Join game' }}
          </button>
        </form>

        <p v-if="asGuest" class="mt-md text-caption text-ink-3">
          Playing as a guest.
          <RouterLink class="section-link" :to="{ name: 'login', query: { redirect: '/join' } }">
            Log in
          </RouterLink>
          to keep your scores.
        </p>
      </section>

      <!-- Step 2: nickname, asked only once per browser -->
      <section v-else class="card-surface p-xl" data-enter data-enter-step>
        <p class="eyebrow-label">
          Room <span class="num">{{ code }}</span>
        </p>
        <h1 class="mt-xs line-clamp-2 break-words text-heading-2 text-ink" :title="quizTitle">
          {{ quizTitle }}
        </h1>
        <p class="mt-xxs truncate text-body-sm text-ink-2">
          Hosted by {{ hostName }}
        </p>

        <form class="mt-lg grid gap-md" @submit.prevent="submitJoin">
          <label class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-2">Your nickname</span>
            <input
              v-model="playerName"
              class="field"
              type="text"
              :maxlength="NAME_MAX"
              placeholder="Everyone will see this"
              autocomplete="nickname"
            >
          </label>

          <p v-if="error" class="text-body-sm text-ans-a">
            {{ error }}
          </p>

          <div class="flex items-center gap-xs">
            <button class="btn-primary" type="submit" :disabled="joining || !playerName.trim()">
              {{ joining ? 'Joining\u2026' : 'Join game' }}
            </button>
            <button class="btn-ghost" type="button" :disabled="joining" @click="goToStep('code')">
              Back
            </button>
          </div>
        </form>
      </section>
    </div>
  </GameShell>
</template>
