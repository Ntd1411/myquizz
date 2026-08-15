import { computed, ref, watch } from 'vue'
import { getResults } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useGameStore } from '@/stores/game.store'

/**
 * Final standings of a finished match.
 *
 * `game:ended` carries everything the end screen needs, but it is a one-shot broadcast:
 * a player who was offline when the host ended the room, or anyone who reloads the page
 * afterwards, never receives it. Worse, the server clears Redis right after the final
 * flush, so a late `player:sync` returns a snapshot without a leaderboard.
 *
 * Postgres is the source of truth from that moment on, which is why this falls back to
 * `GET /games/:id/results`. The socket payload still wins when it is there: it arrives
 * without a round trip and already matches what the other players are looking at.
 */
export function useFinalResults() {
  const game = useGameStore()

  const fetched = ref(null)
  const loading = ref(false)
  const error = ref('')

  const leaderboard = computed(
    () => game.finalResults?.leaderboard ?? fetched.value?.leaderboard ?? [],
  )
  const perQuestion = computed(
    () => game.finalResults?.perQuestion ?? fetched.value?.perQuestion ?? [],
  )

  // The REST answer has no `review_enabled`, so the room config answers instead: both
  // read the same `flow.reviewMode`, and the server checks it again before replying.
  const reviewEnabled = computed(
    () => game.finalResults?.review_enabled ?? game.config?.flow?.reviewMode ?? false,
  )

  async function load() {
    if (loading.value || !game.sessionId) return
    loading.value = true
    error.value = ''

    const data = await getResults(game.sessionId).catch((err) => {
      error.value = toErrorMessage(err, 'Could not load the results of this match.')
      return null
    })
    if (data) fetched.value = data
    loading.value = false
  }

  // Only fetch what the socket did not bring. An empty leaderboard is not a reason to
  // call: the host can hide the standings on purpose (`showLeaderboard: 'never'`).
  watch(
    () => game.isFinished && !game.finalResults && Boolean(game.sessionId),
    (needed) => {
      if (needed && !fetched.value) load()
    },
    { immediate: true },
  )

  return { leaderboard, perQuestion, reviewEnabled, loading, error, load }
}
