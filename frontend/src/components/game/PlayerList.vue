<script setup>
import { computed, ref } from 'vue'

/**
 * Lobby player section, shared by the host and the player screens so both sides show the
 * exact same roster. The card, the heading and the counter live here too: the two lobbies
 * used to repeat that markup and drifted apart on every change.
 *
 * The whole section hides itself while the room is empty. An empty grid says nothing the
 * surrounding screen does not already say, and on the host side it only pushed the room
 * code out of view.
 *
 * Signed-in players carry `player_avatar`; guests have none, so they fall back to initials
 * on a colour derived from the name, which is stable enough to tell rows apart.
 */
const props = defineProps({
  players: { type: Array, default: () => [] },
  /** Player session id of the viewer, when the viewer is playing. */
  meId: { type: [Number, String], default: null },
  maxPlayers: { type: Number, default: null },
  showScore: { type: Boolean, default: false },
})

const AVATAR_COLORS = [
  '#6c4cf1',
  '#2f6be0',
  '#1ba968',
  '#ef4b45',
  '#f2b32e',
  '#8d6a9f',
  '#3d5a80',
  '#b5838d',
]

const STATUS_META = {
  connected: { label: '', dot: '#1ba968' },
  disconnected: { label: 'Offline', dot: '#8e92a4' },
  eliminated: { label: 'Out', dot: '#ef4b45' },
  finished: { label: 'Finished', dot: '#2f6be0' },
}

/** Keys of avatars whose image failed, so a dead URL degrades to initials once. */
const brokenAvatars = ref(new Set())

const connectedCount = computed(
  () => props.players.filter((player) => player.status !== 'disconnected').length,
)

function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'P'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Stable per name, so the same player keeps the same colour across reloads. */
function colorFor(player) {
  const seed = String(player?.player_name ?? player?.id ?? '')
  let hash = 0
  for (const char of seed) hash = (hash + char.codePointAt(0)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function statusOf(player) {
  return STATUS_META[player?.status] ?? STATUS_META.connected
}

function subtitle(player) {
  const status = statusOf(player).label
  if (status) return status
  if (player?.lives != null) return player.lives === 1 ? '1 life left' : `${player.lives} lives left`
  return ''
}

function isMe(player) {
  return props.meId != null && player?.id === props.meId
}

function keyOf(player) {
  return player?.id ?? player?.player_name
}

function avatarOf(player) {
  if (brokenAvatars.value.has(keyOf(player))) return ''
  return player?.player_avatar || ''
}

function onAvatarError(player) {
  brokenAvatars.value = new Set(brokenAvatars.value).add(keyOf(player))
}
</script>

<template>
  <section v-if="players.length" class="card-surface p-xl">
    <div class="flex items-center justify-between gap-sm">
      <h2 class="text-heading-3 text-ink">
        Players
      </h2>
      <span class="chip whitespace-nowrap">
        <span class="num">{{ connectedCount }}<template v-if="maxPlayers">/{{ maxPlayers }}</template></span>
      </span>
    </div>

    <TransitionGroup tag="ul" name="player" class="mt-md grid gap-xs sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="player in players"
        :key="keyOf(player)"
        class="flex items-center gap-sm rounded-md border px-sm py-xs"
        :class="isMe(player) ? 'border-spotlight-line bg-spotlight-soft' : 'border-hairline bg-paper'"
      >
        <!-- The clipping wrapper only holds the image: the status dot sits outside it, or
             `overflow-hidden` would cut the part that overlaps the avatar edge. -->
        <span class="relative block h-[34px] w-[34px] shrink-0">
          <span
            class="grid h-full w-full place-items-center overflow-hidden rounded-full text-caption font-semibold text-white"
            :style="{ backgroundColor: colorFor(player) }"
          >
            <img
              v-if="avatarOf(player)"
              :src="avatarOf(player)"
              :alt="player.player_name"
              class="h-full w-full object-cover"
              loading="lazy"
              @error="onAvatarError(player)"
            >
            <template v-else>{{ initials(player.player_name) }}</template>
          </span>
          <span
            class="absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full border-2 border-white"
            :style="{ backgroundColor: statusOf(player).dot }"
          />
        </span>

        <span class="min-w-0 grow">
          <span class="block truncate text-body-sm font-medium text-ink" :title="player.player_name">
            {{ player.player_name }}
          </span>
          <span v-if="subtitle(player)" class="block truncate text-caption text-ink-3">
            {{ subtitle(player) }}
          </span>
        </span>

        <span v-if="isMe(player)" class="shrink-0 text-caption font-semibold text-spotlight">You</span>
        <span v-else-if="showScore && player.player_score != null" class="num shrink-0 text-body-sm font-semibold text-ink-2">
          {{ player.player_score }}
        </span>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
/* Rows arrive and leave one by one, so the list should not jump between snapshots. */
.player-enter-active,
.player-leave-active {
  transition: opacity var(--t-ui) var(--ease), transform var(--t-ui) var(--ease);
}

.player-enter-from,
.player-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.player-leave-active {
  position: absolute;
}

.player-move {
  transition: transform var(--t-ui) var(--ease);
}
</style>
