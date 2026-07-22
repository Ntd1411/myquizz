import CacheService from '../../infrastructure/cache/cache.service.js'
import type { PlayerSession, LeaderboardEntry } from './game.type.js'

/**
 * Service quản lý cache cho player sessions trong game
 * Sử dụng Redis Hash, Sorted Set và String để tối ưu performance
 */
export class PlayerCacheService {
  private static readonly CACHE_TTL = 7200 // 2 giờ

  /**
   * Tạo cache key cho player session
   */
  private static getPlayerKey(
    gameSessionId: number,
    playerSessionId: number
  ): string {
    return `game:${gameSessionId}:player_session:${playerSessionId}`
  }

  /**
   * Tạo cache key cho leaderboard
   */
  private static getLeaderboardKey(gameSessionId: number): string {
    return `game:${gameSessionId}:leaderboard`
  }

  /**
   * Tạo cache key cho danh sách players trong game
   */
  private static getPlayersSetKey(gameSessionId: number): string {
    return `game:${gameSessionId}:players`
  }

  /**
   * Lưu player session vào cache
   */
  static async savePlayerSession(playerSession: PlayerSession): Promise<void> {
    const key = this.getPlayerKey(
      playerSession.game_session_id,
      playerSession.id
    )

    // Lưu data chính vào hash
    const hashData = {
      id: playerSession.id.toString(),
      player_id: playerSession.player_id?.toString() || '',
      player_guest_id: playerSession.player_guest_id?.toString() || '',
      player_name: playerSession.player_name,
      player_score: playerSession.player_score.toString(),
      game_session_id: playerSession.game_session_id.toString(),
      answered_questions: JSON.stringify(
        playerSession.answered_questions || []
      ),
      current_question_index: (
        playerSession.answered_questions?.length || 0
      ).toString(),
      created_at: playerSession.created_at.toISOString(),
      updated_at: playerSession.updated_at.toISOString()
    }

    await CacheService.setHashMultiple(key, hashData, this.CACHE_TTL)

    // Lưu answered_questions riêng nếu có
    if (
      playerSession.answered_questions &&
      playerSession.answered_questions.length > 0
    ) {
      await CacheService.set(
        `${key}:answers`,
        playerSession.answered_questions,
        this.CACHE_TTL
      )
    }

    // Thêm vào leaderboard
    await CacheService.addToSortedSet(
      this.getLeaderboardKey(playerSession.game_session_id),
      playerSession.player_score,
      playerSession.id.toString()
    )

    // Thêm vào set players
    await CacheService.addToSet(
      this.getPlayersSetKey(playerSession.game_session_id),
      playerSession.player_id?.toString() ||
        (playerSession.player_guest_id?.toString() as string)
    )

    // Set TTL cho leaderboard và players set
    await CacheService.expire(
      this.getLeaderboardKey(playerSession.game_session_id),
      this.CACHE_TTL
    )
    await CacheService.expire(
      this.getPlayersSetKey(playerSession.game_session_id),
      this.CACHE_TTL
    )
  }

  /**
   * Lấy player session từ cache
   */
  static async getPlayerSession(
    gameSessionId: number,
    playerSessionId: number
  ): Promise<PlayerSession | null> {
    const key = this.getPlayerKey(gameSessionId, playerSessionId)

    const hashData = await CacheService.getAllHash<string>(key)

    if (!hashData || Object.keys(hashData).length === 0) {
      return null
    }

    // Lấy answered_questions
    const answers = await CacheService.get<PlayerSession['answered_questions']>(
      `${key}:answers`
    )

    const session: PlayerSession = {
      id: parseInt(hashData.id as string),
      player_name: hashData.player_name as string,
      player_score: parseInt(hashData.player_score as string),
      game_session_id: parseInt(hashData.game_session_id as string),
      answered_questions: answers || [],
      current_question_index: parseInt(
        hashData.current_question_index as string
      ),
      created_at: new Date(hashData.created_at as string),
      updated_at: new Date(hashData.updated_at as string)
    }

    // Chỉ gán player_id nếu có giá trị
    if (hashData.player_id) {
      session.player_id = parseInt(hashData.player_id)
    }

    // Chỉ gán player_guest_id nếu có giá trị
    if (hashData.player_guest_id) {
      session.player_guest_id = parseInt(hashData.player_guest_id)
    }

    return session
  }

  /**
   * Cập nhật điểm của player
   */
  static async updateScore(
    playerSessionId: number,
    scoreToAdd: number,
    gameSessionId: number
  ): Promise<number> {
    const key = this.getPlayerKey(gameSessionId, playerSessionId)

    // Tăng điểm trong hash
    const newScore = await CacheService.incrementHash(
      key,
      'player_score',
      scoreToAdd
    )

    // Cập nhật leaderboard
    await CacheService.incrementSortedSet(
      this.getLeaderboardKey(gameSessionId),
      playerSessionId.toString(),
      scoreToAdd
    )

    return newScore
  }

  /**
   * Thêm câu trả lời cho player
   */
  static async addAnswer(
    playerSessionId: number,
    gameSessionId: number,
    answer: {
      question_id: number;
      answer_id: number;
      is_correct: boolean;
      time_taken: number;
      score_earned: number;
      answered_at: Date;
    }
  ): Promise<void> {
    const key = this.getPlayerKey(gameSessionId, playerSessionId)

    // Lấy answers hiện tại
    const answersKey = `${key}:answers`
    const currentAnswers =
      (await CacheService.get<typeof answer[]>(answersKey)) || []

    // Thêm answer mới
    currentAnswers.push(answer)
    await CacheService.set(answersKey, currentAnswers, this.CACHE_TTL)

    // Tăng current_question_index
    await CacheService.incrementHash(key, 'current_question_index', 1)

    // Nếu đúng, tăng correct_answers_count
    if (answer.is_correct) {
      await CacheService.incrementHash(key, 'correct_answers_count', 1)
    }

    // Cập nhật điểm
    await this.updateScore(playerSessionId, answer.score_earned, gameSessionId)
  }

  /**
   * Lấy leaderboard từ cache
   */
  static async getLeaderboard(
    gameSessionId: number
  ): Promise<LeaderboardEntry[]> {
    const leaderboardKey = this.getLeaderboardKey(gameSessionId)

    // Lấy tất cả players với scores từ sorted set
    const playersWithScores = await CacheService.getTopFromSortedSet(
      leaderboardKey,
      0,
      -1,
      true
    )

    const leaderboard: LeaderboardEntry[] = []

    // Parse kết quả (format: [member1, score1, member2, score2, ...])
    for (let i = 0; i < playersWithScores.length; i += 2) {
      const playerSessionId = playersWithScores[i] as string
      const score = parseInt(playersWithScores[i + 1] as string)

      // Lấy thông tin chi tiết từ hash
      const playerKey = this.getPlayerKey(gameSessionId, parseInt(playerSessionId))
      const playerData = await CacheService.getAllHash<string>(playerKey)

      if (playerData && Object.keys(playerData).length > 0) {
        leaderboard.push({
          player_id: parseInt(playerSessionId),
          player_name: playerData.player_name as string,
          player_score: score,
          correct_answers_count: parseInt(playerData.correct_answers_count as string),
          is_host: playerData.is_host === '1',
          rank: i / 2 + 1
        })
      }
    }

    return leaderboard
  }

  /**
   * Lấy danh sách player IDs trong game
   */
  static async getPlayerIds(gameSessionId: number): Promise<number[]> {
    const playersSet = await CacheService.getSetMembers(
      this.getPlayersSetKey(gameSessionId)
    )

    return playersSet.map((id) => parseInt(id))
  }

  /**
   * Lấy rank của player trong leaderboard
   */
  static async getPlayerRank(
    playerSessionId: number,
    gameSessionId: number
  ): Promise<number | null> {
    const rank = await CacheService.getRankInSortedSet(
      this.getLeaderboardKey(gameSessionId),
      playerSessionId.toString()
    )

    // Redis trả về 0-based index, chuyển thành 1-based rank
    return rank !== null ? rank + 1 : null
  }

  /**
   * Xóa player khỏi game cache
   */
  static async removePlayer(
    playerSessionId: number,
    gameSessionId: number
  ): Promise<void> {
    const key = this.getPlayerKey(gameSessionId, playerSessionId)

    // Xóa hash data
    await CacheService.delete(key)

    // Xóa answers
    await CacheService.delete(`${key}:answers`)

    // Xóa khỏi leaderboard
    await CacheService.removeFromSortedSet(
      this.getLeaderboardKey(gameSessionId),
      playerSessionId.toString()
    )

    // Xóa khỏi players set
    await CacheService.removeFromSet(
      this.getPlayersSetKey(gameSessionId),
      playerSessionId.toString()
    )
  }

  /**
   * Xóa toàn bộ cache của game
   */
  static async clearGameCache(gameSessionId: number): Promise<void> {
    // Lấy danh sách players
    const playerIds = await this.getPlayerIds(gameSessionId)

    // Xóa cache của từng player
    const deletePromises = playerIds.map(async (playerId) => {
      const key = this.getPlayerKey(gameSessionId, playerId)
      await CacheService.delete(key)
      await CacheService.delete(`${key}:answers`)
    })

    await Promise.all(deletePromises)

    // Xóa leaderboard và players set
    await CacheService.delete(this.getLeaderboardKey(gameSessionId))
    await CacheService.delete(this.getPlayersSetKey(gameSessionId))
  }

  /**
   * Đếm số lượng players đã hoàn thành game
   */
  static async countCompletedPlayers(
    gameSessionId: number,
    totalQuestions: number
  ): Promise<number> {
    const playerIds = await this.getPlayerIds(gameSessionId)
    let completedCount = 0

    for (const playerId of playerIds) {
      const player = await this.getPlayerSession(gameSessionId, playerId)
      if (
        player &&
        (player.answered_questions?.length || 0) >= totalQuestions
      ) {
        completedCount++
      }
    }

    return completedCount
  }

  /**
   * Refresh TTL cho tất cả cache của game
   */
  static async refreshGameCacheTTL(gameSessionId: number): Promise<void> {
    const playerIds = await this.getPlayerIds(gameSessionId)

    const promises = playerIds.map(async (playerId) => {
      const key = this.getPlayerKey(gameSessionId, playerId)
      await CacheService.expire(key, this.CACHE_TTL)
      await CacheService.expire(`${key}:answers`, this.CACHE_TTL)
    })

    promises.push(
      CacheService.expire(
        this.getLeaderboardKey(gameSessionId),
        this.CACHE_TTL
      ),
      CacheService.expire(this.getPlayersSetKey(gameSessionId), this.CACHE_TTL)
    )

    await Promise.all(promises)
  }
}
