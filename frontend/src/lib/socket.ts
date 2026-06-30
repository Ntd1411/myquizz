import { io, Socket } from 'socket.io-client'

interface GameEvents {
  playerJoined: (data: { player_name: string; player_count: number }) => void
  playerLeft: (data: { player_name: string; player_count: number }) => void
  gameStarted: (data: { session_id: number; current_question: number }) => void
  questionChanged: (data: { question_index: number; time_limit: number }) => void
  playerAnswered: (data: { player_name: string; is_correct: boolean; score: number }) => void
  leaderboardUpdated: (data: { leaderboard: any[] }) => void
  gameFinished: (data: { final_scores: any[] }) => void
  error: (data: { message: string }) => void
}

class GameSocket {
  private socket: Socket | null = null
  private listeners: Map<string, Set<Function>> = new Map()

  connect(sessionId: number, playerSessionId: number) {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io('/', {
      query: {
        session_id: sessionId,
        player_session_id: playerSessionId,
      },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  on<K extends keyof GameEvents>(event: K, callback: GameEvents[K]) {
    if (!this.socket) return

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)?.add(callback)
    this.socket.on(event, callback as any)
  }

  off<K extends keyof GameEvents>(event: K, callback?: GameEvents[K]) {
    if (!this.socket) return

    if (callback) {
      this.socket.off(event, callback as any)
      this.listeners.get(event)?.delete(callback)
    } else {
      this.socket.off(event)
      this.listeners.delete(event)
    }
  }

  emit(event: string, data?: any) {
    if (!this.socket) {
      console.warn('Socket not connected')
      return
    }
    this.socket.emit(event, data)
  }

  submitAnswer(playerSessionId: number, answer: string, timeSpent: number) {
    this.emit('submitAnswer', {
      player_session_id: playerSessionId,
      answer,
      time_spent: timeSpent,
    })
  }

  isConnected() {
    return this.socket?.connected || false
  }
}

export const gameSocket = new GameSocket()
