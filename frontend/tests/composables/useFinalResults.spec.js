import { effectScope, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { getResults } from '@/api/games.api'
import { useGameStore } from '@/stores/game.store'
import { useFinalResults } from '@/composables/useFinalResults'

vi.mock('@/api/games.api', () => ({ getResults: vi.fn() }))

describe('finished room results', () => {
  let scope

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    scope = effectScope()
  })

  afterEach(() => scope.stop())

  it('keeps a private player board hidden after reload without requesting forbidden results', async () => {
    const game = useGameStore()
    game.setIdentity({ role: 'player', sessionId: 12 })
    game.applyLobby({ session_status: 'finished', config: { flow: { showLeaderboard: 'never' } } })

    const results = scope.run(() => useFinalResults())
    await nextTick()

    expect(getResults).not.toHaveBeenCalled()
    expect(results.leaderboard.value).toEqual([])
    expect(results.error.value).toBe('')
  })

  it('loads a visible board after reload', async () => {
    const board = [{ id: 3, rank: 1, player_score: 100 }]
    getResults.mockResolvedValue({ leaderboard: board, perQuestion: [] })
    const game = useGameStore()
    game.setIdentity({ role: 'player', sessionId: 12 })
    game.applyLobby({ session_status: 'finished', config: { flow: { showLeaderboard: 'end_only' } } })

    const results = scope.run(() => useFinalResults())
    await vi.waitFor(() => expect(results.leaderboard.value).toEqual(board))
    expect(getResults).toHaveBeenCalledWith(12)
  })
})
