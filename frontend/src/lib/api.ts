import type {
  User,
  Quiz,
  GameSession,
  PlayerSession,
  LeaderboardEntry,
  AuthResponse,
  Question
} from '@/types'

const API_BASE = '/api'

class ApiClient {
  private accessToken: string | null = null

  setAccessToken(token: string | null) {
    this.accessToken = token
    if (token) {
      localStorage.setItem('accessToken', token)
    } else {
      localStorage.removeItem('accessToken')
    }
  }

  getAccessToken() {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('accessToken')
    }
    return this.accessToken
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    if (response.status === 401) {
      this.setAccessToken(null)
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const contentType = response.headers.get('content-type')
    const hasJsonContent = contentType?.includes('application/json')
    const hasContent = response.status !== 204 && response.headers.get('content-length') !== '0'

    let data: any = null
    if (hasContent) {
      const text = await response.text()
      if (text) {
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error('Lỗi parse JSON:', text)
          if (!response.ok) {
            throw new Error(`Lỗi server: ${response.status} - ${text.substring(0, 100)}`)
          }
          throw new Error('Phản hồi không đúng định dạng JSON')
        }
      }
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `Lỗi ${response.status}`
      throw new Error(errorMessage)
    }

    return data
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    this.setAccessToken(data.accessToken)
    return data
  }

  async register(
    email: string,
    password: string,
    fullname: string,
    phone?: string
  ): Promise<{ message: string; user: User }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullname, phone }),
    })
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
    this.setAccessToken(null)
  }

  async getMe(): Promise<User> {
    return this.request('/users/me')
  }

  async updateProfile(data: Partial<User>): Promise<{ message: string }> {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async uploadAvatar(file: File): Promise<{ fileUrl: string }> {
    const formData = new FormData()
    formData.append('avatar', file)
    const token = this.getAccessToken()

    const response = await fetch(`${API_BASE}/users/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      credentials: 'include',
    })

    return response.json()
  }

  async createQuiz(quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'created_by'>): Promise<Quiz> {
    return this.request('/quizzes', {
      method: 'POST',
      body: JSON.stringify(quiz),
    })
  }

  async getQuiz(quizId: number): Promise<Quiz> {
    return this.request(`/quizzes/${quizId}`)
  }

  async listQuizzes(ownerId?: number, page = 1, limit = 10) {
    const endpoint = ownerId
      ? `/quizzes/owner/${ownerId}?page=${page}&limit=${limit}`
      : `/quizzes?page=${page}&limit=${limit}`
    return this.request<{ quizzes: Quiz[]; total: number; page: number; limit: number }>(endpoint)
  }

  async searchQuizzes(params: {
    keyword?: string
    language?: string
    category?: string
    page?: number
    limit?: number
  }) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) query.append(key, String(value))
    })
    return this.request<{ quizzes: Quiz[]; total: number }>(`/quizzes/search?${query}`)
  }

  async updateQuiz(quizId: number, quiz: Partial<Quiz>): Promise<Quiz> {
    return this.request(`/quizzes/${quizId}`, {
      method: 'PUT',
      body: JSON.stringify(quiz),
    })
  }

  async deleteQuiz(quizId: number): Promise<{ message: string }> {
    return this.request(`/quizzes/${quizId}`, { method: 'DELETE' })
  }

  async createGame(quizId: number): Promise<GameSession> {
    const response = await this.request<{ data: GameSession }>('/games', {
      method: 'POST',
      body: JSON.stringify({ quiz_id: quizId }),
    })
    return response.data
  }

  async joinGame(sessionCode: string, playerName?: string): Promise<PlayerSession> {
    const response = await this.request<{ data: PlayerSession }>(`/games/${sessionCode}/join`, {
      method: 'POST',
      body: JSON.stringify(playerName ? { player_name: playerName } : {}),
    })
    return response.data
  }

  async startGame(sessionId: number): Promise<void> {
    await this.request(`/games/${sessionId}/start`, { method: 'POST' })
  }

  async getQuestion(sessionId: number, index: number): Promise<Question> {
    const response = await this.request<{ data: Question }>(
      `/games/${sessionId}/question?index=${index}`
    )
    return response.data
  }

  async getLeaderboard(sessionId: number): Promise<LeaderboardEntry[]> {
    const response = await this.request<{ data: LeaderboardEntry[] }>(
      `/games/${sessionId}/leaderboard`
    )
    return response.data
  }

  async finishGame(sessionId: number): Promise<{ final_scores: LeaderboardEntry[] }> {
    const response = await this.request<{ data: { final_scores: LeaderboardEntry[] } }>(
      `/games/${sessionId}/finish`,
      { method: 'POST' }
    )
    return response.data
  }

  async getGameSession(sessionId: number): Promise<GameSession> {
    const response = await this.request<{ data: GameSession }>(`/games/${sessionId}`)
    return response.data
  }

  async reconnect(playerSessionId: number): Promise<PlayerSession> {
    const response = await this.request<{ data: PlayerSession }>(
      `/games/reconnect/${playerSessionId}`
    )
    return response.data
  }
}

export const api = new ApiClient()
