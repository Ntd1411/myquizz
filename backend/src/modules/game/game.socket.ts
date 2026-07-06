import type { Server } from 'socket.io'
import { GameService } from './game.services.js'
import { pool } from '../../infrastructure/database/connection.js'
import { optionalSocketAuthMiddleware } from './socket.middleware.js'
import type { AuthSocket } from './game.type.js'
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
      socket.on('game:start', this.handleStartGame(socket))
      socket.on('answer:submit-and-next', this.handleSubmitAnswerAndNext(socket))
      socket.on('question:get-current', this.handleGetCurrentQuestion(socket))
      socket.on('player:kick', this.handleKickPlayer(socket))

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })
  }

  private handleJoinRoom = (socket: AuthSocket) => async (data: { sessionCode: string; data: JoinGameRequest }) => {
    try {
      const joinGameResponse = await this.gameService.joinGame(data.sessionCode, data.data)

      if (socket.user && joinGameResponse.player_session_id !== socket.user.id) {
        socket.emit('error', { message: 'You do not have permission to join this player_id' })
        return
      }

      const roomName = `game:${data.sessionCode}`
      await socket.join(roomName)

      this.io.to(roomName).emit('player:joined', {
        player: {
          player_id: joinGameResponse.player_session_id,
          player_name: joinGameResponse.player_name,
          is_host: joinGameResponse.is_host
        }
      })

      socket.emit('game:joined', {
        message: 'Joined room successfully',
        room: roomName,
        session_id: joinGameResponse.game_info.session_id,
        player_session_id: joinGameResponse.player_session_id,
        is_host: joinGameResponse.is_host,
        players: [] // Will be populated by player:joined events
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleStartGame = (socket: AuthSocket) => async (data: { session_id: number }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'You must be logged in to start a game' })
        return
      }

      const { session_id } = data

      await this.gameService.startGame(session_id, socket.user.id)

      const roomName = `game:${session_id}`
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
    answer_id: number;
    time_taken: number;
    session_id: number;
  }) => {
    try {
      const { player_session_id, question_id, answer_id, time_taken, session_id } = data

      const response = await this.gameService.submitAnswerAndGetNext(
        player_session_id,
        socket.user?.id,
        { question_id, answer_id, time_taken },
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

        const roomName = `game:${session_id}`
        this.io.to(roomName).emit('game:progress-update', response.progressUpdate)

        if (response.allCompleted && response.leaderboard) {
          this.io.to(roomName).emit('game:all-completed', {
            message: 'All players have completed the game',
            leaderboard: response.leaderboard
          })
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
  }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'You must be logged in to kick a player' })
        return
      }

      const { session_id, player_session_id } = data
      const playerSession = await this.gameService.kickPlayer(socket.user.id, session_id, player_session_id)

      const roomName = `game:${session_id}`
      this.io.to(roomName).emit('player:kicked', {
        player_id: player_session_id,
        player_name: playerSession.player_name
      })

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }
}
