import type { Server } from 'socket.io'
import * as gameService from './game.services.js'
import { optionalSocketAuthMiddleware } from './socket.middleware.js'
import type { AuthSocket } from './game.type.js'

export class GameSocket {
  private io: Server
  private gameService: typeof gameService

  constructor(io: Server) {
    this.io = io
    this.gameService = gameService
    this.initialize()
  }

  private initialize() {
    this.io.use((socket, next) => {
      void optionalSocketAuthMiddleware(socket as AuthSocket, next)
    })

    this.io.on('connection', (socket: AuthSocket) => {
      console.log(`Socket connected: ${socket.id}${socket.user ? ` - User: ${socket.user.fullname}` : ' - Guest'}`)

      socket.on('game:join-room', this.handleJoinRoom(socket))
      socket.on('game:start', this.handleStartGame(socket))
      socket.on('answer:submit-and-next', this.handleSubmitAnswerAndNext(socket))
      socket.on('question:get-current', this.handleGetCurrentQuestion(socket))
      socket.on('player:kick', this.handleKickPlayer(socket))

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })
  }

  private handleJoinRoom = (socket: AuthSocket) => async (data: {
    sessionCode: string
    playerSessionId: number
    isHost: boolean
  }) => {
    try {
      // Authenticated user must be the host if isHost is true
      if (data.isHost && !socket.user?.id) {
        socket.emit('error', { message: 'Host must be authenticated' })
        return
      }

      // Verify that the player session belongs to the authenticated user if isHost is true
      if (data.isHost && socket.user?.id) {
        const playerSession = await this.gameService.getPlayerSessionById(data.playerSessionId)
        if (!playerSession || playerSession.player_id !== socket.user.id) {
          socket.emit('error', { message: 'Invalid host credentials' })
          return
        }
      }

      const roomName = `game:${data.sessionCode}`
      await socket.join(roomName)

      // Store player_session_id và isHost into socket data
      if (!socket.data) {
        socket.data = {}
      }

      const socketData = socket.data as { player_session_id?: number; isHost?: boolean }
      socketData.player_session_id = data.playerSessionId
      socketData.isHost = data.isHost

      console.log(`${data.isHost ? 'Host' : 'Player'} joined room ${roomName} with player_session_id: ${data.playerSessionId}`)

      socket.emit('room:joined', {
        message: 'Joined room successfully',
        room: roomName,
        playerSessionId: data.playerSessionId,
        isHost: data.isHost
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleStartGame = (socket: AuthSocket) => async (data: {
    session_id: number;
    player_session_id?: number;
  }) => {
    try {
      const { session_id, player_session_id } = data

      // Get userId from authenticated user or from player session
      let userId: number | undefined = socket.user?.id

      if (!userId && player_session_id) {
        // Guest player - get userId from player session
        const playerSession = await this.gameService.getPlayerSessionById(player_session_id)
        if (playerSession?.player_id) {
          userId = playerSession.player_id
        }
      }

      if (!userId) {
        socket.emit('error', { message: 'Unable to identify player' })
        return
      }

      await this.gameService.startGame(session_id, userId)

      // Get session code to construct room name
      const gameSession = await this.gameService.getGameSessionById(session_id)
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' })
        return
      }

      const roomName = `game:${gameSession.session_code}`
      const firstQuestion = await this.gameService.getQuestionForGame(session_id, 0)

      this.io.to(roomName).emit('game:started', {
        message: 'Game started',
        question: firstQuestion
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleSubmitAnswerAndNext = (socket: AuthSocket) => async (data: {
    player_session_id: number;
    question_id: number;
    answer_id?: number;
    answer_text?: string;
    answer_ids?: number[];
    time_taken: number;
    session_id: number;
  }) => {
    try {
      const { player_session_id, question_id, answer_id, answer_text, answer_ids, time_taken, session_id } = data

      const response = await this.gameService.submitAnswerAndGetNext(
        player_session_id,
        socket.user?.id,
        { question_id, answer_id, answer_text, answer_ids, time_taken },
        session_id
      )

      socket.emit('answer:result', response.result)

      if (response.nextQuestion) {
        socket.emit('question:next-for-player', {
          question: response.nextQuestion,
          current_index: response.currentQuestionIndex,
          total_questions: response.totalQuestions
        })
      } else if (response.isCompleted) {
        socket.emit('player:completed', {
          message: 'You have completed all questions'
        })

        // Get session code for room name
        const gameSession = await this.gameService.getGameSessionById(session_id)
        if (gameSession) {
          const roomName = `game:${gameSession.session_code}`
          this.io.to(roomName).emit('game:progress-update', response.progressUpdate)

          if (response.allCompleted && response.leaderboard) {
            this.io.to(roomName).emit('game:all-completed', {
              message: 'All players have completed the game',
              leaderboard: response.leaderboard
            })
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleGetCurrentQuestion = (socket: AuthSocket) => async (data: {
    player_session_id: number;
    session_id: number;
  }) => {
    try {
      const { player_session_id, session_id } = data

      const response = await this.gameService.getCurrentQuestionForPlayer(
        player_session_id,
        socket.user?.id,
        session_id
      )

      if (response.isCompleted) {
        socket.emit('player:completed', {
          message: 'You have completed all questions'
        })
        return
      }

      socket.emit('question:current', {
        question: response.currentQuestion,
        current_index: response.currentQuestionIndex,
        total_questions: response.totalQuestions
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleKickPlayer = (socket: AuthSocket) => async (data: {
    session_id: number;
    player_session_id: number;
    host_player_session_id?: number;
  }) => {
    try {
      const { session_id, player_session_id, host_player_session_id } = data

      // Get userId from authenticated user or from host player session
      let userId: number | undefined = socket.user?.id

      if (!userId && host_player_session_id) {
        // Guest host - get userId from host player session
        const hostPlayerSession =
          await this.gameService.getPlayerSessionById(host_player_session_id)
        if (hostPlayerSession?.player_id) {
          userId = hostPlayerSession.player_id
        }
      }

      if (!userId) {
        socket.emit('error', { message: 'Unable to identify host' })
        return
      }

      const playerSession = await this.gameService.kickPlayer(userId, session_id, player_session_id)

      // Get session code for room name
      const gameSession = await this.gameService.getGameSessionById(session_id)
      if (!gameSession) {
        socket.emit('error', { message: 'Game session not found' })
        return
      }

      const roomName = `game:${gameSession.session_code}`

      // Find and disconnect the kicked player's socket
      const playerSockets = await this.io.in(roomName).fetchSockets()
      const kickedSocket = playerSockets.find(s =>
        (s.data as { player_session_id?: number }).player_session_id === player_session_id
      )

      if (kickedSocket) {
        kickedSocket.emit('player:kicked-self', {
          message: 'You have been kicked from the session'
        })
        kickedSocket.leave(roomName)
      }

      // Broadcast to all remaining players
      this.io.to(roomName).emit('player:kicked', {
        player_id: player_session_id,
        player_name: playerSession.player_name
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }
}
