import { io, Socket } from 'socket.io-client'

export type GameStatus = 'waiting' | 'active' | 'finished'

export interface Player {
  player_id: number
  player_name: string
  is_host: boolean
  player_score?: number
  correct_answers_count?: number
}

export interface Question {
  question_id: number
  text: string
  type: string
  time_limit: number
  answers: {
    id: number
    text: string
  }[]
}

export interface AnswerResult {
  is_correct: boolean
  correct_answer_id: number
  score_earned: number
  time_taken: number
}

export interface LeaderboardEntry {
  player_id: number
  player_name: string
  player_score: number
  correct_answers_count: number
  is_host: boolean
  rank: number
}

export interface GameInfo {
  session_id: number
  session_name: string
  session_code: string
  total_questions: number
  total_players: number
  status: GameStatus
}

class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    })

    this.setupConnectionHandlers()
    return this.socket
  }

  private setupConnectionHandlers() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.reconnectAttempts++
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      this.reconnectAttempts = 0
    })

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after', this.maxReconnectAttempts, 'attempts')
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  // Game events
  joinRoom(sessionCode: string, playerName: string, playerId?: number) {
    if (!this.socket) throw new Error('Socket not connected')
    
    this.socket.emit('game:join-room', {
      sessionCode,
      data: {
        player_name: playerName,
        player_id: playerId
      }
    })
  }

  startGame(sessionId: number) {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.emit('game:start', { session_id: sessionId })
  }

  submitAnswer(data: {
    player_session_id: number
    question_id: number
    answer_id: number
    time_taken: number
    session_id: number
  }) {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.emit('answer:submit-and-next', data)
  }

  getCurrentQuestion(playerSessionId: number, sessionId: number) {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.emit('question:get-current', {
      player_session_id: playerSessionId,
      session_id: sessionId
    })
  }

  kickPlayer(sessionId: number, playerSessionId: number) {
    if (!this.socket) throw new Error('Socket not connected')
    this.socket.emit('player:kick', {
      session_id: sessionId,
      player_session_id: playerSessionId
    })
  }

  // Event listeners
  onPlayerJoined(callback: (data: { player: Player }) => void) {
    this.socket?.on('player:joined', callback)
  }

  onGameJoined(callback: (data: { 
    message: string; 
    room: string; 
    session_id: number; 
    player_session_id: number; 
    is_host: boolean;
    players: Player[];
  }) => void) {
    this.socket?.on('game:joined', callback)
  }

  onGameStarted(callback: (data: { message: string; question: Question }) => void) {
    this.socket?.on('game:started', callback)
  }

  onAnswerResult(callback: (data: AnswerResult) => void) {
    this.socket?.on('answer:result', callback)
  }

  onNextQuestion(callback: (data: { question: Question; current_index: number; total_questions: number }) => void) {
    this.socket?.on('question:next-for-player', callback)
  }

  onCurrentQuestion(callback: (data: { question: Question; current_index: number; total_questions: number }) => void) {
    this.socket?.on('question:current', callback)
  }

  onPlayerCompleted(callback: (data: { message: string }) => void) {
    this.socket?.on('player:completed', callback)
  }

  onGameProgressUpdate(callback: (data: any) => void) {
    this.socket?.on('game:progress-update', callback)
  }

  onGameAllCompleted(callback: (data: { message: string; leaderboard: LeaderboardEntry[] }) => void) {
    this.socket?.on('game:all-completed', callback)
  }

  onPlayerKicked(callback: (data: { player_id: number; player_name: string }) => void) {
    this.socket?.on('player:kicked', callback)
  }

  onPlayerKickedSelf(callback: (data: { message: string }) => void) {
    this.socket?.on('player:kicked-self', callback)
  }

  onError(callback: (data: { message: string }) => void) {
    this.socket?.on('error', callback)
  }

  onConnectionStatusChange(callback: (connected: boolean) => void) {
    this.socket?.on('connect', () => callback(true))
    this.socket?.on('disconnect', () => callback(false))
  }

  // Clean up listeners
  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback)
  }

  offAll() {
    this.socket?.removeAllListeners()
  }
}

export const socketService = new SocketService()
