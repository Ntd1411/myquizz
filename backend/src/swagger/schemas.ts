/* eslint-disable max-len */
/**
 * @openapi
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: accessToken
 *   schemas:
 *     ApiMeta:
 *       type: object
 *       properties:
 *         timestamp: { type: string, format: date-time }
 *         pagination: { $ref: '#/components/schemas/Pagination' }
 *     Pagination:
 *       type: object
 *       properties:
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 10 }
 *         total: { type: integer, example: 42 }
 *         totalPages: { type: integer, example: 5 }
 *         hasPreviousPage: { type: boolean }
 *         hasNextPage: { type: boolean }
 *     SuccessEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         data: { type: object }
 *         error: { type: object, nullable: true, example: null }
 *         meta: { $ref: '#/components/schemas/ApiMeta' }
 *     ErrorEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         data: { nullable: true, example: null }
 *         error:
 *           type: object
 *           properties:
 *             message: { type: string }
 *             details: { nullable: true }
 *         meta: { $ref: '#/components/schemas/ApiMeta' }
 *     User:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 3 }
 *         fullname: { type: string, example: Nguyen Van A }
 *         email: { type: string, format: email }
 *         phone: { type: string, nullable: true }
 *         role: { type: string, example: user }
 *         avatar: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     PublicUser:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         fullname: { type: string }
 *         email: { type: string }
 *         avatar: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *     Quiz:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         quiz_owner: { type: integer }
 *         quiz_name: { type: string }
 *         quiz_description: { type: string, nullable: true }
 *         quiz_language: { type: string }
 *         quiz_image: { type: string, nullable: true }
 *         quiz_category: { type: string, nullable: true }
 *         is_public: { type: boolean }
 *         deleted_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         questions:
 *           type: array
 *           items: { $ref: '#/components/schemas/Question' }
 *     Question:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         quiz_id: { type: integer }
 *         question_type: { type: string, enum: [multiple_choice, multiple_select, short_answer, long_answer] }
 *         question_text: { type: string }
 *         time_limit: { type: integer, example: 30 }
 *         question_image: { type: string, nullable: true }
 *         question_hint: { type: string, nullable: true }
 *         explanation: { type: string, nullable: true }
 *         answer_options:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: integer }
 *               option_text: { type: string }
 *         correct_answer:
 *           oneOf:
 *             - { type: array, items: { type: integer } }
 *             - { type: string }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         deleted_at: { type: string, format: date-time, nullable: true }
 *     GameMode:
 *       type: string
 *       enum: [classic, solo, survival, marathon, practice]
 *       default: classic
 *     GameConfig:
 *       type: object
 *       properties:
 *         version: { type: integer, enum: [1], default: 1 }
 *         scoring:
 *           type: object
 *           properties:
 *             basePoints: { type: number, default: 1000 }
 *             speedBonus: { type: boolean, default: true }
 *             streak:
 *               type: object
 *               properties:
 *                 enabled: { type: boolean, default: false }
 *                 bonusPerStep: { type: number, default: 100 }
 *                 max: { type: number, default: 500 }
 *             negativeMarking: { type: boolean, default: false }
 *             latePenaltyRatio: { type: number, minimum: 0, maximum: 1, default: 0.9 }
 *         timing:
 *           type: object
 *           properties:
 *             countdownSeconds: { type: number, default: 3 }
 *             perQuestionSeconds: { type: number, nullable: true, default: null }
 *             autoAdvance: { type: boolean, default: true }
 *             showResultsSeconds: { type: number, default: 2 }
 *             totalMatchSeconds: { type: number, nullable: true, default: null }
 *         lobby:
 *           type: object
 *           properties:
 *             maxPlayers: { type: number, default: 100 }
 *             allowLateJoin: { type: boolean, default: false }
 *             allowGuests: { type: boolean, default: true }
 *         flow:
 *           type: object
 *           properties:
 *             pacing: { type: string, enum: [host, self], default: host }
 *             showCorrectAnswer: { type: boolean, default: true }
 *             showLeaderboard: { type: string, enum: [never, between_questions, end_only], default: between_questions }
 *             lives: { type: number, nullable: true, default: null }
 *             allowAnswerLate: { type: boolean, default: false }
 *             shuffleQuestions: { type: boolean, default: false }
 *             shuffleOptions: { type: boolean, default: false }
 *             showHint: { type: boolean, default: false }
 *             reviewMode: { type: boolean, default: true }
 *     ModeConfigDescriptor:
 *       type: object
 *       description: One entry returned by GET /games/game-modes (from describeModeConfig)
 *       properties:
 *         mode: { $ref: '#/components/schemas/GameMode' }
 *         pacing: { type: string, enum: [host, self] }
 *         scored: { type: boolean }
 *         defaultConfig: { $ref: '#/components/schemas/GameConfig' }
 *         editable:
 *           type: object
 *           additionalProperties:
 *             type: object
 *             description: FieldSpec plus current default (kind, min/max/nullable/values, default)
 *         locked:
 *           type: object
 *           additionalProperties: true
 *           description: Dotted path mapped to current value, rendered read-only
 *     GameSession:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         quiz_snapshot_id: { type: integer }
 *         session_name: { type: string }
 *         session_code: { type: string, example: K7QM2B }
 *         session_host: { type: integer }
 *         total_players: { type: integer }
 *         total_questions: { type: integer }
 *         session_status: { type: string, enum: [lobby, active, paused, finished, cancelled] }
 *         game_mode: { $ref: '#/components/schemas/GameMode' }
 *         config: { $ref: '#/components/schemas/GameConfig' }
 *         current_question_index: { type: integer }
 *         current_phase: { type: string, enum: [lobby, countdown, question_active, question_locked, showing_results, finished] }
 *         phase_ends_at: { type: string, format: date-time, nullable: true }
 *     PlayerSession:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         game_session_id: { type: integer }
 *         player_id: { type: integer, nullable: true }
 *         player_guest_id: { type: string, format: uuid, nullable: true }
 *         player_name: { type: string }
 *         player_score: { type: integer }
 *         correct_answers_count: { type: integer }
 *         streak: { type: integer }
 *         lives: { type: integer, nullable: true }
 *         current_question_index: { type: integer }
 *         status: { type: string, enum: [connected, disconnected, eliminated, finished] }
 *     LobbyPlayer:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         player_name: { type: string }
 *         player_score: { type: integer }
 *         status: { type: string }
 *     LeaderboardEntry:
 *       type: object
 *       properties:
 *         rank: { type: integer }
 *         id: { type: integer }
 *         player_name: { type: string }
 *         player_score: { type: integer }
 *         correct_answers_count: { type: integer }
 *         streak: { type: integer }
 *         status: { type: string }
 *     QuestionStat:
 *       type: object
 *       properties:
 *         question_id: { type: integer }
 *         answer_count: { type: integer }
 *         correct_count: { type: integer }
 *     PresignResult:
 *       type: object
 *       properties:
 *         uploadUrl: { type: string, description: PUT the binary here within 5 minutes }
 *         publicUrl: { type: string }
 *         key: { type: string, description: "object key, format {folder}/{userId}/{uuid}" }
 */
