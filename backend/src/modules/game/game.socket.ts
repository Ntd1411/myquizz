import type { Server } from 'socket.io'
import { GameService } from './game.services.js'
import { pool } from '../../infrastructure/database/connection.js'
import { optionalSocketAuthMiddleware } from './socket.middleware.js'
import type { AuthSocket, PlayerSession } from './game.type.js'
import type { JoinGameRequest } from './game.schemas.js'

export class GameSocket {
  private io: Server
  private gameService: GameService

  constructor(io: Server) {
    this.io = io
    this.gameService = new GameService(pool)
    this.initialize()
  }

  private initialize() {
    this.io.use((socket, next) => {
      void optionalSocketAuthMiddleware(socket as AuthSocket, next)
    })

    this.io.on('connection', (socket: AuthSocket) => {
      console.log(`Socket connected: ${socket.id}${socket.user ? ` - User: ${socket.user.fullname}` : ' - Guest'}`)

      socket.on('game:join-room', this.handleJoinRoom(socket))
      socket.on('game:join-room-only', this.handleJoinRoomOnly(socket))
      socket.on('game:start', this.handleStartGame(socket))
      socket.on('answer:submit-and-next', this.handleSubmitAnswerAndNext(socket))
      socket.on('question:get-current', this.handleGetCurrentQuestion(socket))
      socket.on('player:kick', this.handleKickPlayer(socket))

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })
  }

  private handleJoinRoomOnly = (socket: AuthSocket) => async (data: {
    sessionCode: string
    playerSessionId: number
  }) => {
    try {
      const roomName = `game:${data.sessionCode}`
      await socket.join(roomName)

      // Store player_session_id in socket data
      if (!socket.data) {
        socket.data = {}
      }
      (socket.data as { player_session_id?: number }).player_session_id = data.playerSessionId

      console.log(`Host joined room ${roomName} with player_session_id: ${data.playerSessionId}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleJoinRoom = (socket: AuthSocket) => async (data: { sessionCode: string; data: JoinGameRequest }) => {
    try {
      const joinGameResponse = await this.gameService.joinGame(data.sessionCode, data.data)

      // Check if authenticated user is trying to join with a different player_id
      if (socket.user && data.data.player_id && data.data.player_id !== socket.user.id) {
        socket.emit('error', { message: 'You do not have permission to join with this player_id' })
        return
      }

      const roomName = `game:${data.sessionCode}`
      await socket.join(roomName)

      // Store player_session_id in socket data for later use (e.g., kick player)
      if (!socket.data) {
        socket.data = {}
      }
      (socket.data as { player_session_id?: number }).player_session_id = joinGameResponse.player_session_id

      // Get current players in room
      const players: PlayerSession[] = await this.gameService.getPlayersByGameSession(
        joinGameResponse.game_info.session_id
      )
      const playersList = players.map((p: PlayerSession) => ({
        player_id: p.id,
        player_name: p.player_name,
        is_host: p.is_host,
        player_score: p.player_score
      }))

      // Emit to current player với full players list
      socket.emit('game:joined', {
        message: 'Joined room successfully',
        room: roomName,
        session_id: joinGameResponse.game_info.session_id,
        player_session_id: joinGameResponse.player_session_id,
        is_host: joinGameResponse.is_host,
        players: playersList
      })

      // Broadcast to others (excluding current player) that someone joined
      socket.to(roomName).emit('player:joined', {
        player: {
          player_id: joinGameResponse.player_session_id,
          player_name: joinGameResponse.player_name,
          is_host: joinGameResponse.is_host,
          player_score: 0
        }
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
