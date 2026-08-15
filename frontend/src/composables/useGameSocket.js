import { onScopeDispose } from 'vue'
import {
  connectGameSocket,
  disconnectGameSocket,
  emitGameEvent,
  emitGameEventWithAck,
  getGameSocket,
  isFatalSocketError,
  parseSocketError,
  updateGameSocketToken,
} from '@/api/socket'
import { useGameStore } from '@/stores/game.store'

/**
 * Single place where the `/game` namespace is wired to the store.
 *
 * Screens never talk to socket.io directly: they call the emitters below and read
 * the store. That keeps the event contract (and the reveal rules that come with it)
 * in one file instead of spread over every gameplay page.
 */
export function useGameSocket() {
  const game = useGameStore()

  let socket = null
  let hasJoined = false

  // server -> client. The host-only events are registered for both roles on purpose:
  // the server decides who is in the host room, the client never has to filter.
  const handlers = {
    'game:state': (payload) => game.applyState(payload),
    'lobby:updated': (payload) => game.applyLobby(payload),
    'game:started': (payload) => game.applyStarted(payload),
    'game:countdown': (payload) => game.applyCountdown(payload),
    'question:started': (payload) => game.applyQuestion(payload),
    'question:locked': (payload) => game.applyLocked(payload),
    'question:results': (payload) => game.applyResults(payload),
    'question:awaiting_next': (payload) => game.applyAwaitingNext(payload),
    'question:timeout': (payload) => game.applyTimeout(payload),
    'answer:received': (payload) => game.applyAnswerReceived(payload),
    'leaderboard:updated': (payload) => game.applyLeaderboard(payload),
    'leaderboard:host': (payload) => game.applyHostLeaderboard(payload),
    'host:question': (payload) => game.applyHostQuestion(payload),
    'host:answer-received': (payload) => game.applyAnswerReceived(payload),
    'host:player-progress': (payload) => game.applyPlayerProgress(payload),
    'player:eliminated': (payload) => game.applyEliminated(payload),
    'player:finished': (payload) => game.applyPlayerFinished(payload),
    'game:ended': (payload) => game.applyEnded(payload),
    error: (payload) => {
      const parsed = parseSocketError(payload?.message ?? '')
      console.error(`[game] ${payload?.event ?? 'event'} failed: ${parsed.code} - ${parsed.message}`)
      game.setError({ ...parsed, event: payload?.event ?? null })
    },
  }

  function onConnect() {
    game.setConnection('connected')
    // lobby:join is idempotent: it re-joins the rooms and answers with the current
    // state, so it is also the right first call after a reconnect.
    emitGameEvent('lobby:join')
    // A reconnect needs the full snapshot on top: the question clock keeps running on
    // the server, so the client has to be told where it is instead of restarting it.
    if (hasJoined) emitGameEvent('player:sync')
    hasJoined = true
  }

  function onDisconnect(reason) {
    // 'io client disconnect' is our own leave() call, everything else is a real drop.
    game.setConnection(reason === 'io client disconnect' ? 'closed' : 'reconnecting')
  }

  function onConnectError(error) {
    const parsed = parseSocketError(error)
    game.setConnection(isFatalSocketError(error) ? 'closed' : 'reconnecting', parsed)
  }

  function bind(instance) {
    instance.on('connect', onConnect)
    instance.on('disconnect', onDisconnect)
    instance.on('connect_error', onConnectError)
    for (const [event, handler] of Object.entries(handlers)) instance.on(event, handler)
  }

  function unbind(instance) {
    if (!instance) return
    instance.off('connect', onConnect)
    instance.off('disconnect', onDisconnect)
    instance.off('connect_error', onConnectError)
    for (const [event, handler] of Object.entries(handlers)) instance.off(event, handler)
  }

  /**
   * @param {string} token socketToken from POST /games/:code/join or /games/:id/host-token
   * @param {object} identity role / code / sessionId, only used for the local state
   */
  function connect(token, identity = {}) {
    game.setIdentity(identity)
    game.setConnection('connecting')
    const instance = connectGameSocket(token)
    if (instance !== socket) {
      unbind(socket)
      socket = instance
      hasJoined = false
      bind(socket)
    }
    // connectGameSocket may hand back an already connected socket, which will not fire
    // 'connect' again: join right away in that case.
    if (socket.connected) onConnect()
    return socket
  }

  /** Used after a rejoin hands out a new token for the same room. */
  function reconnectWithToken(token) {
    game.setConnection('connecting')
    const instance = updateGameSocketToken(token)
    if (instance !== socket) {
      unbind(socket)
      socket = instance
      bind(socket)
    }
    return socket
  }

  function leave() {
    if (socket) emitGameEvent('lobby:leave')
    unbind(socket)
    disconnectGameSocket()
    socket = null
    hasJoined = false
    game.setConnection('closed')
  }

  // client -> server
  const joinLobby = () => emitGameEvent('lobby:join')
  const sync = () => emitGameEvent('player:sync')
  const start = () => emitGameEvent('game:start')
  const next = () => emitGameEvent('game:next')
  const pause = () => emitGameEvent('game:pause')
  const resume = () => emitGameEvent('game:resume')
  const endGame = () => emitGameEvent('game:end')
  const playerNext = () => emitGameEvent('question:next')

  /**
   * Host config patch. The ack echoes what the server stored plus every path it
   * refused (`ignored`), which the lobby has to surface instead of pretending it saved.
   */
  function updateConfig(config) {
    return emitGameEventWithAck('lobby:config-update', { config })
  }

  /**
   * Submits an answer. The UI is locked optimistically so a double tap cannot send
   * twice, and the lock is released again if the server refuses the answer.
   */
  async function answer(value) {
    game.markAnswerPending(value)
    const ack = await emitGameEventWithAck('question:answer', { answer: value }).catch((error) => {
      game.rejectAnswer()
      game.setError({ ...parseSocketError(error), event: 'question:answer' })
      throw error
    })
    game.applyAnswerAck(ack)
    return ack
  }

  // A screen unmounting must not keep feeding the store, but the socket itself is kept
  // alive on purpose: navigating from the lobby to the game view reuses it.
  onScopeDispose(() => {
    unbind(socket ?? getGameSocket())
    socket = null
  })

  return {
    connect,
    reconnectWithToken,
    leave,
    joinLobby,
    sync,
    start,
    next,
    pause,
    resume,
    endGame,
    playerNext,
    updateConfig,
    answer,
  }
}
