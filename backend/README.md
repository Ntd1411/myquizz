## 1. Overview & tech stack

MyQuizz is a real-time quiz app (Kahoot-style) with two communication channels:

- **REST API** (`/api/v1`): auth, user management, quiz management, game-room creation/management, image upload.
- **Socket.IO** (namespace `/game`): the whole real-time gameplay (lobby, countdown, Q&A, leaderboard, results).

**Backend stack**

- Node.js + TypeScript, **Express 5**
- **Socket.IO 4** (namespace `/game`)
- **PostgreSQL** — durable data
- **Redis** — real-time game state (session, players, clock, leaderboard, answer stats); required, the server pings Redis on boot
- **S3-compatible object storage** (DigitalOcean Spaces) for images, uploaded directly from the client via presigned URLs
- **Google OAuth 2.0** + Google One Tap
- Auth via **JWT stored in HttpOnly cookies** (not Bearer headers)
- Swagger UI at `/api-docs`

## 2. Conventions (read before touching the frontend)

### 2.1 Base URL & versioning

- Every REST endpoint is prefixed with `/api/v1`.
- Socket.IO connects to the `/game` namespace.

### 2.2 Response envelope

Every REST response (success or error) is wrapped in a single, consistent shape:

```json
// success(res, data, status = 200, meta = {})
{
  "success": true,
  "data": { /* real payload */ },
  "error": null,
  "meta": { "timestamp": "2026-07-31T00:00:00.000Z" }
}

// fail(res, message, details, status = 400)
{
  "success": false,
  "data": null,
  "error": { "message": "...", "details": null },
  "meta": { "timestamp": "..." }
}
```

- The real payload is **always under `data`**. Branch on `success` / `error`.
- Paginated endpoints put the items under `data.<collection>` and the page info under **`meta.pagination`**.
- All "Success `data`" columns below describe the content of `data`.

### 2.3 Cookie authentication (IMPORTANT)

The backend does **not** return tokens in the body for `localStorage`. Instead it sets two HttpOnly cookies:

- `accessToken` — lifetime `JWT_EXPIRES_IN`
- `refreshToken` — lifetime `JWT_REFRESH_EXPIRES_IN`

Cookie attributes:

- `httpOnly: true` → JS **cannot read** the token (so you cannot attach an Authorization header yourself).
- Production: `secure: true`, `sameSite: 'none'` → the frontend **must run on HTTPS** and calls are cross-site.
- Dev: `secure: false`, `sameSite: 'lax'`.

**Consequences for the frontend**

- Every request (REST and Socket.IO) must send cookies:
    - `fetch(url, { credentials: 'include' })`
    - `axios.create({ withCredentials: true })`
    - `io('/game', { withCredentials: true })`
- CORS reads allowed origins from `FRONTEND_URL` + `ALLOW_ORIGIN` (comma-separated) with `credentials: true`. Your frontend origin must be in that list.
- When `accessToken` expires → call `POST /auth/refresh` (the cookie is sent automatically) to rotate tokens, then retry. Add an interceptor that auto-refreshes on `401`.

### 2.4 Rate limiting

There is a global limiter plus dedicated ones for auth (`authRateLimiter`), password reset (`resetPasswordRateLimiter`) and upload (`uploadRateLimiter`). Handle `429`.

## 3. REST API

### 3.1 Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Request body | Success `data` |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | none | `{ email, password(min 8), fullname(2-100), phone? }` | `{ user }` (201) + sets cookies |
| POST | `/auth/login` | none | `{ email, password }` | `{ user }`  • sets cookies |
| POST | `/auth/refresh` | cookie `refreshToken` | — | `{ accessToken, refreshToken }`  • rotates cookies |
| POST | `/auth/logout` | cookie | — | `{ message }`  • clears cookies |
| GET | `/auth/google` | none | — | 302 redirect to Google |
| GET | `/auth/google/callback` | none | query `code`, `state` | 302 redirect to `FRONTEND_URL/auth/callback` (error: `?error=...`) |
| POST | `/auth/google/one-tap` | none | `{ credential }` (Google ID token) | `{ user }`  • sets cookies |

**`user` object:** `{ id, fullname, email, phone, role, avatar, description, created_at, updated_at }` (never returns `password`).

> Google redirect flow: send the browser to `/api/v1/auth/google`, then handle a `/auth/callback` route in the frontend (cookies are already set — just call `/users/me`, or read `?error=`).
> 

### 3.2 Users — `/api/v1/users`

| Method | Endpoint | Auth | Request body | Success `data` |
| --- | --- | --- | --- | --- |
| GET | `/users/me` | cookie | — | `{ user }` |
| PATCH | `/users/me` | cookie | `{ fullname?, email?, phone?, description?(<=200) }` | `{ user }` |
| DELETE | `/users/me` | cookie | `{ password }` | `{ message }` (soft delete) |
| GET | `/users/:userId` | none | — | `{ user }` public (`id, fullname, email, avatar, description`); 404 / 410 if deactivated |
| PATCH | `/users/me/password` | cookie | `{ oldPassword, newPassword }` (min 8) | `{ message }` |
| PATCH | `/users/me/avatar` | cookie | `{ fileUrl }` (JSON, see note) | `{ avatarUrl }` |
| POST | `/users/forgot-password` | none | `{ email }` | `{ resetTime }` (OTP emailed) |
| POST | `/users/reset-password` | none | `{ email, otp(6 chars), newPassword }` | `{ message }` |
| POST | `/users/reset-password-token` | none | `{ token, newPassword }` | `{ message }` |

<aside>
⚠️

**Avatar is NOT a multipart upload.** `PATCH /users/me/avatar` takes a JSON body `{ fileUrl }` and returns `{ avatarUrl }`. First upload the image via `/storage/presign` (folder `avatars`) + a `PUT` to the presigned URL, then send the resulting `publicUrl` here as `fileUrl`. (The old Swagger showed a `multipart` field `avatar` returning `{ message, fileUrl }` — that is wrong.)

</aside>

### 3.3 Quizzes — `/api/v1/quizzes`

| Method | Endpoint | Auth | Notes | Success `data` |
| --- | --- | --- | --- | --- |
| POST | `/quizzes` | cookie | Create quiz + questions | `{ quiz }` (201) |
| GET | `/quizzes/search` | optional | Query: `keyword?, language?, category?, page=1, limit=10(max 20)` | `{ quizzes: Quiz[] }`  • `meta.pagination` |
| GET | `/quizzes/users/id/:ownerId` | optional | Query: `page, limit` | `{ quizzes: Quiz[] }`  • `meta.pagination` |
| GET | `/quizzes/id/:quizId` | optional | Detail + questions | `{ quiz }` |
| PATCH | `/quizzes/id/:quizId` | cookie | Partial; sending `questions` replaces the whole list | `{ quiz }` |
| DELETE | `/quizzes/id/:quizId` | cookie | Soft delete | `{ quiz }` |

**Create-quiz schema (`createQuizSchema`)**

```tsx
{
  quiz_name: string        // 3-100 chars
  quiz_description?: string // <= 500
  quiz_language: string     // required
  quiz_image?: string       // valid URL
  quiz_category?: string    // <= 50
  is_public: boolean
  questions: CreateQuestion[] // >= 1
}

// CreateQuestion
{
  question_type: 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'
  question_text: string     // 1-200 chars
  time_limit: number         // default 30, >= 0 (0 = no limit)
  question_image?: string    // valid URL
  answer_options?: string[]  // 2-4 options, each 1-100 chars (choice questions only)
  correct_answer: number[] | string // index array (choice) OR string (text answer)
}
```

**Question object when reading a quiz (`Question`)**

```tsx
{
  id: number
  quiz_id: number
  question_type: 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'
  question_text: string
  time_limit: number
  question_image?: string
  question_hint?: string
  explanation?: string
  answer_options?: { id: number; option_text: string }[] // has ids on read
  correct_answer: number[] | string
  created_at: string; updated_at: string; deleted_at: string | null
}
```

> On **create**, `answer_options` is a `string[]`; on **read**, each option is `{ id, option_text }`. `correct_answer` is an index array (multiple_choice = 1 index, multiple_select = several) or a string for text questions.
> 

**Pagination object (`meta.pagination`):** `{ page, limit, total, totalPages, hasPreviousPage, hasNextPage }`.

### 3.4 Storage — `/api/v1/storage`

| Method | Endpoint | Auth | Success `data` |
| --- | --- | --- | --- |
| POST | `/storage/presign` | cookie | `{ presignedUrl: { uploadUrl, publicUrl, key } }` |

**Body (`presignUploadSchema`)**

```tsx
{
  contentType: 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/gif' | 'image/webp'
  folder: 'avatars' | 'quizzes' | 'questions' | 'uploads'
  fileSize: number // 1 .. 2_097_152 (max 2MB)
}
```

<aside>
⚠️

The result is nested under **`data.presignedUrl`** (i.e. `data.presignedUrl.uploadUrl`), not directly on `data`. The object key is `{folder}/{userId}/{uuid}` and `uploadUrl` expires after **5 minutes**.

</aside>

**Image upload flow**

1. `POST /storage/presign` with `contentType`, `folder`, `fileSize`.
2. `PUT` the raw file to `uploadUrl` with a `Content-Type` matching `contentType`.
3. Use `publicUrl` as `quiz_image` / `question_image` (or as `fileUrl` for the avatar endpoint).

### 3.5 Games (REST) — `/api/v1/games`

| Method | Endpoint | Auth | Success `data` (see nesting notes) |
| --- | --- | --- | --- |
| GET | `/games/game-modes` | — | `{ gameModes: ModeDescriptor[] }` |
| POST | `/games` | cookie | `{ data: { session }, ignored }` (201) — note the double `data` |
| GET | `/games/:code` | — | `{ session: { session, players, config } }` (public lobby) |
| PATCH | `/games/:id/config` | cookie (host) | `{ config, changed, ignored }` (lobby only) |
| POST | `/games/:id/host-token` | cookie (host) | `{ hostToken: { socketToken } }` |
| POST | `/games/:code/join` | optional | `{ player, socketToken }` (201) |
| GET | `/games/:id/leaderboard` | — | `{ leaderboard: LeaderboardEntry[] }` |
| GET | `/games/:id/results` | — | `{ results: { session, leaderboard, perQuestion } }` |

<aside>
⚠️

Mind the response nesting: create returns `data.data.session`, lobby returns `data.session.{session,players,config}`, host-token returns `data.hostToken.socketToken`, results returns `data.results.{session,leaderboard,perQuestion}`.

</aside>

**Create a room (`createGameSchema`)**

```tsx
{
  quiz_id: number            // required, positive
  session_name: string       // 2-100 chars
  mode: 'classic' | 'solo' | 'survival' | 'marathon' | 'practice' // default 'classic'
  config?: Partial<GameConfig> // patch over the mode default; invalid/locked fields are dropped and reported in `ignored`
}
```

> Mode `team` appears in the OpenAPI enum but is **NOT** in `createGameSchema` → the backend does not support it, hide it in the UI.
> 

**Join a room (`joinGameSchema`)**

```tsx
{
  player_name: string        // 1-50 chars
  player_id?: number          // when logged in
  player_guest_id?: string    // UUID, required for guests
}
```

- With a valid auth cookie → the server uses the user's `fullname` + `id` and ignores the body.
- As a guest → send `player_name` + `player_guest_id` (a client-generated UUID; store it in `localStorage` to reconnect with the same identity).
- The returned **`socketToken`** is the key to open the Socket.IO connection (see section 4).

**`ModeDescriptor`** (each item of `GET /games/game-modes`, from `describeModeConfig`): `{ mode, pacing('host'|'self'), scored, defaultConfig, editable, locked }`.

- `editable`: dotted-path → field spec + current default (`kind`, `min`/`max`/`nullable`/`values`, `default`).
- `locked`: dotted-path → current value, rendered read-only.
- Render the create/config form from this — do **not** hardcode the fields.

## 4. Socket.IO — namespace `/game`

### 4.1 Connecting & auth

- Connect to `/game` with `withCredentials: true`.
- Pass the **`socketToken`** (from REST) to the `socketAuth` middleware. The token carries: `code` (session_code), `role` (`'host'` or `'player'`), `gameId`, `playerSessionId`.
    - Host: token from `POST /games/:id/host-token`.
    - Player/guest: token from `POST /games/:code/join`.

```tsx
import { io } from 'socket.io-client'

const socket = io(`${API_ORIGIN}/game`, {
  withCredentials: true,
  auth: { token: socketToken } // socketToken from join / host-token
})
```

- Internal rooms: `game:${code}` (whole room) and `game:${code}:host` (host only — the only place the correct answer is sent while a question is open).

### 4.2 Security principle ("answer oracle")

- The **correct answer is never sent to players while a question is open.** It is only revealed after the question is locked (`question:results`) and only when `flow.showCorrectAnswer = true`.
- The host room gets its own `host:question` (with `correct_answer`) and `host:answer-received` (with `is_correct`).
- Host-paced: the `question:answer` ack only says `accepted: true` while the question is open; correctness + score are revealed at lock time. Self-paced (if `showCorrectAnswer`): the ack returns the result immediately.
- Scoring is 100% server-side. `publicQuestion` strips the answer and applies `shuffleOptions` / `showHint` before sending.

### 4.3 Client → Server events

| Event | Role | Payload | Notes |
| --- | --- | --- | --- |
| `lobby:join` | host & player | — | Enter the room/lobby |
| `lobby:leave` | player | — | Leave (player becomes `disconnected`, row kept for reconnect) |
| `lobby:config-update` | host | `{ config }` or bare config | ack `{ ok, changed, config, ignored }` |
| `game:start` | host | — | Start the match (lobby → countdown/active) |
| `game:next` | host | — | Host-paced + `autoAdvance=false` only: lock the question or move to the next |
| `game:pause` | host | — | Pause, freeze the clock |
| `game:resume` | host | — | Resume, restore the frozen time |
| `game:end` | host | — | End the match early |
| `question:answer` | player | `{ answer }`  • ack | Submit an answer (once per question). See ack below |
| `question:next` | player | — | Self-paced + `autoAdvance=false` only: move to the next question after answering |
| `player:sync` | host & player | — | Request a fresh snapshot (reconnect) → `game:state` |
| `game:review` | player | — | Review your own answers (only when the match is `finished`  • `reviewMode`) |

**`question:answer` ack**

```tsx
{
  accepted: true,
  isLate: boolean,
  lives: number | null,
  eliminated: boolean,
  serverTime: string,
  // Only when self-paced + showCorrectAnswer = true:
  isCorrect?: boolean,
  scoreEarned?: number,
  totalScore?: number,
  streak?: number,
  correct_answer?: number[] | string
}
```

### 4.4 Server → Client events

| Event | Recipient | Main payload |
| --- | --- | --- |
| `lobby:updated` | whole room | Player list + lobby state |
| `game:started` | whole room | `{ mode, config, total_questions, serverTime }` |
| `game:countdown` | room / one socket | `{ seconds, startsAt, serverTime }` |
| `question:started` | player | `{ question, time_limit, endsAt, serverTime, ... }` — **no answer**. Self-paced adds `matchEndsAt, allow_answer_late, remainingSeconds, lives` |
| `host:question` | host room | `{ question, correct_answer, time_limit, endsAt, total_questions, serverTime }` |
| `answer:received` | player | `{ index, answered, activePlayers, serverTime }` — counts only, no identities |
| `host:answer-received` | host room | `{ index, answered, activePlayers, player, is_correct, serverTime }` |
| `host:player-progress` | host room | Per-player progress (self-paced) |
| `question:locked` | whole room | index, reason ('time_up' / 'all_answered'), serverTime |
| `question:results` | whole room | `{ index, question_id, correct_answer(if showCorrectAnswer), stats, nextQuestionAt, serverTime }` |
| `question:awaiting_next` | player | Self-paced `autoAdvance=false`: `{ previous_result, player_score, lives, serverTime }` |
| `question:timeout` | player | Self-paced time-up: `{ index, question_id, is_correct, correct_answer, lives, eliminated, serverTime }` |
| `leaderboard:updated` | player | Lean leaderboard: `rank, name, score` |
| `leaderboard:host` | host room | Full leaderboard for monitoring |
| `player:eliminated` | whole room | `{ id, player_name, serverTime }` (survival) |
| `player:finished` | player + host | `{ player, leaderboard?, serverTime }` (one player done, match still running) |
| `game:state` | player/host | Full snapshot (reconnect / pause / resume) — see 4.5 |
| `game:review` | player | `{ player_score, correct_answers_count, total_questions, items[], serverTime }` |
| `game:ended` | whole room | `{ leaderboard, perQuestion, review_enabled, serverTime }` (host gets the full board) |
| `error` | offending socket | Error message (thrown as `CONFLICT: ...`, `FORBIDDEN: ...`) |

### 4.5 `game:state` snapshot (reconnect)

Contains: `session_status, current_phase, mode, config, index, total_questions, question(if in a question, answer stripped), countdown, endsAt, matchEndsAt, allow_answer_late, remainingSeconds, serverTime, player, leaderboard`.

> Server-based clock: every event carries `serverTime`, `endsAt`, `remainingSeconds`. Reconnecting does **not** reset the question clock (anti-time-farming). Compute countdowns from the `serverTime` ↔ local-time offset.
> 

## 5. Game state machine

**`session_status`:** `lobby` → `active` → (`paused`) → `finished` / `cancelled`

**`current_phase`:** `lobby` → `countdown` → `question_active` → `question_locked` → `showing_results` → (next question / `finished`)

### Host-paced (classic)

1. `game:start` → `game:started` + `game:countdown` (if `countdownSeconds > 0`).
2. `startQuestion`: emit `question:started` (player) & `host:question` (host); arm a timer based on `time_limit`.
3. Players submit `question:answer` → `answer:received` (counts). Enough answers or time-up → `question:locked`.
4. `showResults`: emit `question:results` (+ answer if enabled), `leaderboard:updated` (if `showLeaderboard='between_questions'`).
5. `autoAdvance=true` → auto-advance after `showResultsSeconds`; `false` → host emits `game:next`.
6. Out of questions → `game:ended`.

### Self-paced (solo / survival / marathon / practice)

- Each player has their own progress + clock (`sendSelfQuestion`); questions/options can be shuffled per player.
- After answering: `autoAdvance=true` sends the next question automatically; `false` → player emits `question:next` (gets `question:awaiting_next` while waiting).
- One question times out → `question:timeout`. Out of questions / lives / time budget → `player:finished`. All done → `game:ended`.

## 6. Game modes & GameConfig

### 6.1 GameConfig (full shape + defaults)

```tsx
{
  version: 1,
  scoring: {
    basePoints: 1000,
    speedBonus: true,
    streak: { enabled: false, bonusPerStep: 100, max: 500 },
    negativeMarking: false,
    latePenaltyRatio: 0.9
  },
  timing: {
    countdownSeconds: 3,
    perQuestionSeconds: null, // null = use each question's time_limit
    autoAdvance: true,
    showResultsSeconds: 2,
    totalMatchSeconds: null   // marathon uses a total time budget
  },
  lobby: { maxPlayers: 100, allowLateJoin: false, allowGuests: true },
  flow: {
    pacing: 'host',          // 'host' | 'self'
    showCorrectAnswer: true,
    showLeaderboard: 'between_questions', // 'never' | 'between_questions' | 'end_only'
    lives: null,
    allowAnswerLate: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    showHint: false,
    reviewMode: true
  }
}
```

### 6.2 Scoring formula (`computeScore`)

```tsx
// Wrong: 0 (or -0.25 * basePoints if negativeMarking is on)
// Late (self-paced): round(basePoints * latePenaltyRatio), no speed/streak bonus
// Correct and on time:
speed  = speedBonus && timeLimit > 0
         ? max(0, ((timeLimit - timeTaken) / timeLimit) * basePoints * 0.5)
         : 0
streak = streak.enabled
         ? min((currentStreak + 1) * streak.bonusPerStep, streak.max)
         : 0
score  = round(basePoints + speed + streak)
```

### 6.3 Per-mode characteristics

| Mode | pacing | Scored | Lives | showLeaderboard | Notes |
| --- | --- | --- | --- | --- | --- |
| `classic` | host | yes | none | between_questions | Whole room in lockstep, host-controlled |
| `solo` | self | yes | none | end_only (default) | Play at your own pace; shuffles questions + options, `allowAnswerLate=true`, review on |
| `survival` | self | yes | 3 (default) | end_only | Wrong/timeout costs a life, eliminated at 0; shuffles questions + options |
| `marathon` | self | yes | null (default) | end_only | `totalMatchSeconds=300`: loops the question bank until the total time runs out |
| `practice` | self | no | none | never | `basePoints=0`, no time limit, always shows the answer + review; still tracks streak |

### 6.4 Config rules the server enforces

Each mode ships a `defaultConfig` and its own **editable / locked** field set (returned by `GET /games/game-modes`). The server runs `sanitizeConfigPatch` to drop unknown/locked/invalid fields (reported in `ignored`) and `normalizeConfig` to rewrite mode-owned fields. Key behaviors:

- **Always locked** (any mode): `version`, `flow.pacing`, `flow.allowAnswerLate`, `timing.countdownSeconds`, `timing.showResultsSeconds`, `scoring.basePoints`, `scoring.latePenaltyRatio`, `scoring.streak.*`.
- `flow.pacing` is forced to the mode's pacing; non-lives modes force `flow.lives = null`; non-budget modes force `timing.totalMatchSeconds = null`.
- `marathon` forces `autoAdvance = true`, `showResultsSeconds = 2`, `showCorrectAnswer = true`.
- Self-paced + `showLeaderboard='between_questions'` → coerced to `end_only`.
- `reviewMode=true` forces `showCorrectAnswer=true`.
- `perQuestionSeconds=0` (no deadline) forces `speedBonus=false`.
- Self-paced + `autoAdvance=false` + a real deadline → `allowAnswerLate` auto-enabled.
- Unscored mode (`practice`): `basePoints=0`, `speedBonus=false`, streak off, negativeMarking off.
- Editable ranges: `perQuestionSeconds` 0–600, `totalMatchSeconds` 30–7200, `lobby.maxPlayers` 1–500, `flow.lives` 1–10.

> Render the config form from `editable` / `locked` returned by the API — never hardcode.
> 

## 7. Core data models

**GameSession**

```tsx
{
  id: number
  quiz_snapshot_id: number
  session_name: string
  session_code: string      // room code players use to join
  session_host: number
  total_players: number
  total_questions: number
  session_status: 'lobby' | 'active' | 'paused' | 'finished' | 'cancelled'
  game_mode: 'classic' | 'solo' | 'survival' | 'marathon' | 'practice'
  config: GameConfig
  current_question_index: number
  current_phase: 'lobby' | 'countdown' | 'question_active' | 'question_locked' | 'showing_results' | 'finished'
  phase_ends_at: string | null
}
```

**PlayerSession**

```tsx
{
  id: number
  game_session_id: number
  player_id: number | null        // null for guests
  player_guest_id: string | null  // null for logged-in users
  player_name: string
  player_score: number
  correct_answers_count: number
  answered_questions: AnsweredQuestion[]
  streak: number
  lives: number | null
  current_question_index: number
  status: 'connected' | 'disconnected' | 'eliminated' | 'finished'
}

// AnsweredQuestion
{
  question_id: number
  question_index: number
  answer: unknown
  is_correct: boolean
  is_late: boolean
  time_taken: number
  score_earned: number
  answered_at: string
}
```

**LeaderboardEntry:** `{ rank, id, player_name, player_score, correct_answers_count, streak, status }`

**QuestionStat** (per-question breakdown in results): `{ question_id, answer_count, correct_count }`

**Public question over socket (`publicQuestion`)** strips `correct_answer` and `explanation`; `answer_options` is `{ id, option_text }[]` (shuffled if enabled); `question_hint` only appears when `showHint=true`.

## 8. Environment variables

The repo ships two example files:

- **`.env.example`** (repo root) — Docker / production values (`DB_HOST=postgres`, `REDIS_HOST=redis`, `JWT_EXPIRES_IN=1d`, placeholder Spaces credentials).
- **`backend/.env.example`** — local development values (`DB_HOST=localhost`, `REDIS_HOST=localhost`, `JWT_EXPIRES_IN=15m`).

Every variable below is **required** — on boot the server validates `process.env` with Zod (`envconfig.ts`) and exits if any is missing or invalid.

| Group | Variables | Notes (frontend impact in **bold**) |
| --- | --- | --- |
| Server | `PORT`, `NODE_ENV` | **`NODE_ENV=production` enables cookie `secure` and `sameSite=none` (frontend must be HTTPS)** |
| CORS | `FRONTEND_URL`, `ALLOW_ORIGIN` | **`FRONTEND_URL` is a single origin (CORS + OAuth redirect base to `/auth/callback`); `ALLOW_ORIGIN` is a comma-separated list. Your frontend origin must appear in one of them.** |
| JWT (access) | `JWT_SECRET`, `JWT_EXPIRES_IN` | Access-token cookie lifetime (dev 15m, prod/docker 1d) |
| JWT (refresh) | `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Refresh-token cookie lifetime (7d); separate secret from the access token |
| Socket | `SOCKET_JWT_SECRET`, `SOCKET_TOKEN_TTL` | **Signs the Socket.IO `socketToken`; TTL 6h — the token is short-lived, always fetch a fresh one from join / host-token before connecting** |
| PostgreSQL | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_CONNECTION_TIMEOUT` | Backend only |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Real-time game state; required |
| Object storage (Spaces) | `SPACES_ACCESS_KEY`, `SPACES_SECRET_KEY`, `SPACES_BUCKET`, `SPACES_REGION`, `SPACES_ENDPOINT`, `SPACES_PUBLIC_URL` | **`SPACES_PUBLIC_URL` is the base of every returned `publicUrl`** |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | OTP / password-reset emails |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | **`GOOGLE_CALLBACK_URL` = `{server}/api/v1/auth/google/callback`** |
