import type { Server } from 'socket.io'
import { GameService } from './game.services.js'
import { pool } from '../../infrastructure/database/connection.js'
import { GameRepository } from './game.repository.js'
import { optionalSocketAuthMiddleware } from './socket.middleware.js'
import type { AuthSocket } from './game.type.js'

export class GameSocket {
  private io: Server
  private gameService: GameService
  private gameRepository: GameRepository

  constructor(io: Server) {
    this.io = io
    this.gameService = new GameService(pool)
    this.gameRepository = new GameRepository(pool)
    this.initialize()
  }

  private initialize() {
    this.io.use((socket, next) => {
      void optionalSocketAuthMiddleware(socket as AuthSocket, next)
    })

    this.io.on('connection', (socket: AuthSocket) => {
      console.log(`Socket connected: ${socket.id}${socket.user ? ` - User: ${socket.user.fullname}` : ' - Guest'}`)

      socket.on('game:join-room', this.handleJoinRoom(socket))
      socket.on('game:leave-room', this.handleLeaveRoom(socket))
      socket.on('game:start', this.handleStartGame(socket))
      socket.on('question:next', this.handleNextQuestion(socket))
      socket.on('answer:submit', this.handleSubmitAnswer(socket))
      socket.on('game:finish', this.handleFinishGame(socket))
      socket.on('player:kick', this.handleKickPlayer(socket))

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`)
      })
    })
  }

  private handleJoinRoom = (socket: AuthSocket) => async (data: { session_id: number; player_session_id: number }) => {
    try {
      const { session_id, player_session_id } = data

      const playerSession = await this.gameRepository.getPlayerSession(player_session_id)

      if (!playerSession) {
        socket.emit('error', { message: 'Player not found' })
        return
      }

      if (playerSession.game_session_id !== session_id) {
        socket.emit('error', { message: 'Player does not belong to this session' })
        return
      }

      if (socket.user && playerSession.player_id !== socket.user.id) {
        socket.emit('error', { message: 'You do not have permission to join this player_id' })
        return
      }

      const roomName = `game:${session_id}`
      await socket.join(roomName)

      const gameSession = await this.gameRepository.getGameSessionById(session_id)
      const players = await this.gameRepository.getPlayersByGameSession(session_id)

      this.io.to(roomName).emit('player:joined', {
        player: {
          player_id: playerSession.id,
          player_name: playerSession.player_name,
          is_host: playerSession.is_host
        },
        total_players: players.length
      })

      socket.emit('game:joined', {
        message: 'Joined room successfully',
        room: roomName,
        session_status: gameSession?.session_status,
        answered_count: playerSession.answered_questions.length
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleLeaveRoom = (socket: AuthSocket) => async (data: { session_id: number; player_id: number }) => {
    try {
      const { session_id, player_id } = data

      const playerSession = await this.gameRepository.getPlayerSession(player_id)

      if (!playerSession) {
        socket.emit('error', { message: 'Player not found' })
        return
      }

      if (socket.user && playerSession.player_id !== socket.user.id) {
        socket.emit('error', { message: 'You do not have permission to leave this player_id' })
        return
      }

      const roomName = `game:${session_id}`

      await this.gameService.leaveGame(player_id)

      this.io.to(roomName).emit('player:left', {
        player_id: player_id,
        player_name: playerSession.player_name
      })

      await socket.leave(roomName)
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

  private handleNextQuestion = (socket: AuthSocket) => async (data: { session_id: number; question_index: number }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'You must be logged in to switch questions' })
        return
      }

      const { session_id, question_index } = data

      const gameSession = await this.gameRepository.getGameSessionById(session_id)

      if (!gameSession) {
        socket.emit('error', { message: 'Session not found' })
        return
      }

      if (gameSession.session_host !== socket.user.id) {
        socket.emit('error', { message: 'Only the host can switch questions' })
        return
      }

      const question = await this.gameService.getQuestionForGame(session_id, question_index)

      const roomName = `game:${session_id}`
      this.io.to(roomName).emit('question:show', {
        question
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleSubmitAnswer = (socket: AuthSocket) => async (data: {
    player_session_id: number;
    question_id: number;
    answer_id: number;
    time_taken: number;
    session_id: number;
  }) => {
    try {
      const { player_session_id, question_id, answer_id, time_taken, session_id } = data

      const playerSession = await this.gameRepository.getPlayerSession(player_session_id)

      if (!playerSession) {
        socket.emit('error', { message: 'Player not found' })
        return
      }

      if (socket.user && playerSession.player_id !== socket.user.id) {
        socket.emit('error', { message: 'You do not have permission to answer for this player' })
        return
      }

      const result = await this.gameService.submitAnswer(player_session_id, {
        question_id,
        answer_id,
        time_taken
      })

      socket.emit('answer:result', {
        ...result
      })

      const leaderboard = await this.gameService.getLeaderboard(session_id)

      const roomName = `game:${session_id}`
      this.io.to(roomName).emit('leaderboard:update', {
        leaderboard
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      socket.emit('error', { message })
    }
  }

  private handleFinishGame = (socket: AuthSocket) => async (data: { session_id: number }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'You must be logged in to finish the game' })
        return
      }

      const { session_id } = data

      const result = await this.gameService.finishGame(session_id, socket.user.id)

      const roomName = `game:${session_id}`
      this.io.to(roomName).emit('game:finished', {
        message: 'Game finished',
        result
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

      const gameSession = await this.gameRepository.getGameSessionById(session_id)

      if (!gameSession) {
        socket.emit('error', { message: 'Session not found' })
        return
      }

      if (gameSession.session_host !== socket.user.id) {
        socket.emit('error', { message: 'Only the host can kick players' })
        return
      }

      const playerSession = await this.gameRepository.getPlayerSession(player_session_id)

      if (!playerSession) {
        socket.emit('error', { message: 'Player not found' })
        return
      }

      if (playerSession.is_host) {
        socket.emit('error', { message: 'You cannot kick the host' })
        return
      }

      await this.gameService.leaveGame(player_session_id)

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
