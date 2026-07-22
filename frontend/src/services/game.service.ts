import apiClient from '@/lib/api-client'
import type { 
  CreateGameRequest, 
  GameResponse, 
  JoinGameRequest, 
  JoinGameResponse,
  GameSession 
} from '@/types/game.types'

export type { 
  CreateGameRequest, 
  GameResponse, 
  JoinGameRequest, 
  JoinGameResponse,
  GameSession 
} from '@/types/game.types'

// Game Service
export const gameService = {
  async createGame(data: CreateGameRequest): Promise<GameResponse> {
    const response = await apiClient.post<{ message: string; data: GameResponse }>('/games/', data)
    return response.data.data
  },

  async joinGame(sessionCode: string, data: JoinGameRequest): Promise<JoinGameResponse> {
    const response = await apiClient.post<{ message: string; data: JoinGameResponse }>(
      `/games/${sessionCode}/join`, 
      data
    )
    return response.data.data
  },

  async startGame(sessionId: number): Promise<void> {
    await apiClient.post(`/games/${sessionId}/start`)
  },

  async finishGame(sessionId: number): Promise<void> {
    await apiClient.post(`/games/${sessionId}/finish`)
  },

  async getGameSession(sessionId: number): Promise<GameSession> {
    const response = await apiClient.get<{ data: GameSession }>(`/games/${sessionId}`)
    return response.data.data
  },

  async getLeaderboard(sessionId: number): Promise<any> {
    const response = await apiClient.get(`/games/${sessionId}/leaderboard`)
    return response.data.data
  }
}
