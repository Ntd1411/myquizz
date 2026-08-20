# MyQuizz — Frontend

[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Pinia](https://img.shields.io/badge/Pinia-2-FFD859?logo=vue.js&logoColor=black)](https://pinia.vuejs.org)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5-FF4154?logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![Vitest](https://img.shields.io/badge/Vitest-2-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

The MyQuizz client: browse and search quizzes, write them, host a live room, play as a signed-in user or as a guest, and read a match back afterwards.

Vue 3 with the Composition API in plain JavaScript, Vite for the build, Pinia for the little state that is truly global, TanStack Query for server data, and Socket.IO for gameplay. Styling is Tailwind on top of a CSS custom-property token layer.

Live at [myquizz.dpdns.org](https://myquizz.dpdns.org), talking to [api.myquizz.dpdns.org](https://api.myquizz.dpdns.org).

> Part of the [MyQuizz](../README.md) monorepo. The API lives in [`backend/`](../backend/README.md) and its reference is at [/v1/docs](https://api.myquizz.dpdns.org/v1/docs) (gameplay events at [/v1/docs/socket](https://api.myquizz.dpdns.org/v1/docs/socket)). To run the whole stack with Docker in one command, see the [root README](../README.md#quick-start-with-docker).

---

## Table of contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment](#environment)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Routes](#routes)
- [Talking to the API](#talking-to-the-api)
- [Authentication](#authentication)
- [Errors](#errors)
- [Realtime gameplay](#realtime-gameplay)
- [Design system](#design-system)
- [Motion](#motion)
- [Notable components](#notable-components)
- [Testing](#testing)
- [Build and deploy](#build-and-deploy)
- [Conventions](#conventions)

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Vue 3, Composition API, `<script setup>`, plain JavaScript (no TypeScript) |
| Build | Vite 5, with `@` aliased to `src/` |
| Router | Vue Router 4, history mode, one global `beforeEach` guard |
| Global state | Pinia — `auth.store.js` (session) and `game.store.js` (live match) |
| Server data | TanStack Query (`@tanstack/vue-query`): `staleTime` 60s, no refetch on focus, one retry |
| HTTP | axios instance with `withCredentials: true` and a single-flight refresh interceptor |
| Realtime | `socket.io-client`, namespace `/game`, one socket per tab |
| Style | Tailwind 3 over a `:root` token layer (design v2.1 "Daylight Studio") |
| Motion | GSAP (Flip, ScrollTrigger) + Lenis smooth scroll |
| Spreadsheet import | `xlsx`, used by the create flow |
| Tests | Vitest + `@vue/test-utils` + happy-dom |

## Getting started

Requires Node.js 20+ and a running backend.

```bash
cd frontend
pnpm install            # or npm install
cp .env.example .env    # then point VITE_API_BASE_URL at your backend
pnpm dev
```

The dev server runs on **http://localhost:5173** with `strictPort: true`: if the port is taken, Vite fails instead of silently moving to another one, because the origin has to match what the backend allows.

> The API authenticates with HttpOnly cookies, so the dev origin **must** be listed in the backend's `FRONTEND_URL` / `ALLOW_ORIGIN`. Otherwise the browser drops the credentials and every request looks like a guest.

## Environment

| Variable | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the REST API, no trailing slash (for example `http://localhost:3000/api/v1`) |
| `VITE_GOOGLE_CLIENT_ID` | Google Identity Services client id, the same one the backend uses. Leave it empty to disable One Tap and fall back to the `/auth/google` redirect flow |

Socket.IO is **not** served under the REST path prefix: `api/socket.js` reduces `VITE_API_BASE_URL` to its bare origin and connects to `<origin>/game`.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server on port 5173 |
| `build` | Production build into `dist/` |
| `preview` | Serves the built bundle |
| `lint` / `lint:fix` | ESLint over the whole package |
| `test` | `vitest run` — the specs in `tests/` |

`scripts/fake-player.mjs` is a Node companion that joins a room as a synthetic player, for testing a live match without a second browser.

## Project structure

```
src/
  main.js               App, Pinia, router, Vue Query, global styles
  App.vue               Layout shell, `bare` routes, auth-expired handling
  api/                  One file per endpoint group; the only place axios is used
    http.js               axios instance + single-flight 401 refresh interceptor
    envelope.js           unwrap / readPagination / readCached / ApiError / toErrorMessage
    errors.js             Error code and status to sentence tables (all UI wording)
    socket.js             /game connection, ack helper, fatal-code handling
    auth.api.js  users.api.js  quizzes.api.js  games.api.js  storage.api.js
    quiz.mapper.js        API quiz shapes to the shape the components expect
  stores/               Pinia: auth.store.js, game.store.js
  composables/          useCursorList, useInfiniteScroll, useGameSocket, useServerClock,
                        usePlayerSession, usePreviewGame, useFinalResults, useQuizDraft,
                        useGuestId, useGoogleOneTap, useMotion
  constants/            gameConfig.js (mode metadata, labels, config patching), quizMeta.js
  utils/                defaultCover, defaultAvatar, formatNumber, imageCrop, linkify,
                        previewScoring, quizImport, resetTicket
  components/
    base/                 Field, PasswordField, PinInput, Combo, Spinner, Skeleton,
                          StateBlock, UserAvatar, BrandLogo
    layout/               TopBar, AppFooter
    auth/                 AuthShell (split-screen auth layout)
    quiz/                 QuizCard, QuizRail, QuizEditor, AnswerTile, TimerRing, ImageCropper
    game/                 GameShell, QuestionStage, PlayerGameView, SelfPacedGameView,
                          HostGameConsole, HostSelfPacedBoard, HostResultsBoard,
                          GameResultsView, PreviewSummaryView, AnswerReviewList,
                          LeaderboardList, PlayerList, GameConfigForm, RoomSettingsDialog
  pages/                One component per route
  router/index.js       Route table, auth guard, Lenis-aware scroll behaviour
  assets/main.css       Tailwind entry + design tokens + shared utility classes
tests/                  Vitest specs, mirroring the src/ tree
```

The layering is one-directional: **pages** compose components and composables, **composables** own state and effects, **api/** owns every HTTP and socket call. A component never calls axios and never touches `import.meta.env`.

## Routes

`meta.requiresAuth` sends a guest to `/login?redirect=...`, `meta.guestOnly` sends a signed-in user home, and `meta.bare` drops the site header and footer because that screen owns the whole viewport.

| Path | Name | Access | Notes |
| --- | --- | --- | --- |
| `/` | `home` | public | Home rails |
| `/discover` | `discover` | public | Search, filters, infinite feed |
| `/quizzes/:id` | `quiz-detail` | public | Never renders `correct_answer` |
| `/quizzes/:id/preview` | `quiz-preview` | public, bare | Local run of the quiz, no room and no socket |
| `/login`, `/register` | `login`, `register` | guestOnly, bare | Split-screen auth shell |
| `/forgot-password` | `forgot-password` | public, bare | Step 1 and 2 of the reset: request and verify the code |
| `/reset-password` | `reset-password` | public, bare | Step 3, using the ticket verification handed out |
| `/reset-password/link` | `reset-password-link` | public, bare | Where the emailed link lands, with its token |
| `/auth/callback` | `auth-callback` | public | Landing route after the Google redirect flow |
| `/join` | `join-game` | public, bare | Guests play with a nickname; `?code=ABC123` prefills |
| `/host/new/:quizId` | `host-setup` | requiresAuth | Mode and config form before the room exists |
| `/host/:code` | `host-lobby` | requiresAuth, bare | Asks the API for a host token before showing anything |
| `/play/:code` | `play-lobby` | public, bare | Seat comes from the socket token, never from the URL |
| `/library` | `library` | requiresAuth | Own quizzes |
| `/history` | `history` | public | Play history, Played / Hosted |
| `/history/:sessionId` | `history-detail` | public | One finished match |
| `/users/:id` | `user-profile` | public | Public creator profile |
| `/settings/profile` | `profile` | requiresAuth | Profile, avatar, password |
| `/create` | `create-start` | requiresAuth | Pick a creation method |
| `/create/quiz`, `/quizzes/:id/edit` | `create-quiz`, `edit-quiz` | requiresAuth | The editor |
| `*` | `not-found` | public | |

`/history` is deliberately public: a guest's matches are tied to the UUID their own browser carries, so `requiresAuth` would lock out exactly the readers who need that screen. Permission is decided by the API for every row, never by the URL.

## Talking to the API

Every response, success or failure, arrives in the same envelope:

```json
{ "success": true, "data": { }, "error": null, "meta": { "timestamp": "..." } }
```

Rules that hold everywhere in `src/api/`:

- **Never read `res.data` directly.** Always go through `unwrap(envelope)`, which returns the payload or throws an `ApiError`.
- **Pagination lives in `meta`**, not in the payload: `readPagination(envelope)` returns `{ limit, nextCursor, hasMore, total? }`. `total` stays `undefined` unless the request asked for it with `include_total=true`.
- **Cached endpoints** (`/quizzes/home`, `/quizzes/feed`) report it through `meta.cached`, read with `readCached`.
- **Listings are keyset paginated.** `useCursorList` drives them and expects a `fetchPage` that resolves to `{ quizzes, pagination }`; `useInfiniteScroll` watches a sentinel element to ask for the next page. The cursor encodes the query and sort, so filters must be reset, not mutated mid-pagination.
- **Guest reads carry an identity header.** `useGuestId` keeps a UUID in `localStorage` under `player_guest_id`, sent as `x-guest-id` by the calls that a guest may make (join, and their own play history).

## Authentication

The API stores `accessToken` and `refreshToken` in HttpOnly cookies. JavaScript cannot read them, and there is no `Authorization` header anywhere in this codebase.

- Every request goes through the axios instance with `withCredentials: true`. **No token is ever written to `localStorage`.**
- On a `401`, the interceptor calls `POST /auth/refresh` **once** — a burst of parallel 401s waits on the same promise — then replays the original request.
- `/auth/refresh`, `/auth/login`, `/auth/register` and `/auth/logout` never trigger that cycle: their own `401` / `403` is the answer the page has to show.
- Requests marked `skipAuthHandling` (the bootstrap `/users/me` probe) stay silent, because for a guest a `401` is the correct answer, not an expired session.
- `403`, `404` and `429` are final and travel straight back to the caller; retrying changes nothing.
- When the refresh itself fails, the session is over: the app dispatches `myquizz:auth-expired`, which `App.vue` turns into a cleared session and a trip to `/login`.
- `auth.store.js` resolves the session exactly once (`bootstrap()`), and the router awaits it before the first guarded navigation, so a hard refresh on a private page never flashes the login screen.
- Google sign-in has two doors: One Tap through `useGoogleOneTap` when `VITE_GOOGLE_CLIENT_ID` is set, and otherwise the redirect flow that lands on `/auth/callback`.

## Errors

The API reports failures as **a status and a code**, nothing else — no prose and no field dump. All user-facing wording therefore lives in the frontend, in `api/errors.js`.

- `toErrorCode(error)` and `toErrorStatus(error)` read either an `ApiError` or a raw axios error.
- `toErrorMessage(error, fallback)` resolves, in order: the code table, a network failure, the status table, then the `fallback` you pass. **Always pass a fallback** phrased as what the reader was attempting.
- `error.message` and any `details` are developer text. Log them, never render them.
- **There are no toasts.** A failure is rendered where it happened — inline under a field, or as a `StateBlock` in place of the content — so the same problem is never announced twice.

## Realtime gameplay

REST creates and configures a room; once the match starts, everything runs over Socket.IO on the `/game` namespace.

- The socket token comes from REST (`POST /games/:id/host-token` for a host, `POST /games/:code/join` for a player) and is passed in the handshake. It carries the room, the role and the player row, so **identity is never taken from the URL**.
- One socket per tab. `connectGameSocket` reuses the connection while the token is unchanged and tears it down when the identity changes.
- `emitGameEventWithAck` wraps an acknowledged emit with an 8s timeout and rejects with an `Error` carrying both the code and a ready-to-render sentence.
- Fatal codes (`GAME_TOKEN_INVALID`, `GAME_ROOM_NOT_FOUND`, `GAME_NOT_HOST`, ...) stop the reconnect loop: retrying with the same token can never succeed, so the screen decides whether to rejoin or leave.
- The player seat is kept per tab in `sessionStorage` by `usePlayerSession`, so two tabs are two players and closing one does not steal the other's seat.
- **The server is authoritative.** The client never receives `correct_answer` while a question is open, and never grades or scores anything itself.
- **Clocks come from the server.** `useServerClock` works from `serverTime` / `endsAt` and an offset; the local clock is never trusted.

## Design system

Tokens are defined twice on purpose and must stay in sync: as CSS custom properties in `assets/main.css` (used by `<style scoped>` blocks) and as Tailwind theme entries in `tailwind.config.js` (used by utility classes). Both mirror design v2.1 "Daylight Studio".

| Group | Tokens |
| --- | --- |
| Surfaces | `--paper`, `--canvas`, `--wash`, `--wash-2`, `--hairline` |
| Text | `--ink`, `--ink-2`, `--ink-3` |
| Brand | `--spotlight`, `--spotlight-press`, `--spotlight-soft`, `--spotlight-line` |
| Answer quartet | `--ans-a` / `-b` / `-c` / `-d` and their `-soft` tints |
| Shape | `--r-sm` 8, `--r-md` 12, `--r-lg` 16, `--r-xl` 22, `--r-full` |
| Depth | `--sh-1`, `--sh-2`, `--sh-brand` |
| Motion | `--t-fast` 140ms, `--t-ui` 220ms, `--t-slow` 420ms, `--ease`, `--spring` |

Three rules the palette exists to enforce:

1. **No dark surface.** `ink` is a text colour and must never paint a background.
2. **Spotlight sits outside the answer quartet**, so a button is never read as an answer. One primary action per screen.
3. **The four answer colours are product material**: solid on answer tiles, soft as tints on tags and badges.

`main.css` also carries the shared utility classes the pages compose from — `container-page`, the type scale (`text-heading-2`, `text-title`, `text-body-sm`, `eyebrow-label`), the buttons (`btn-primary`, `btn-ghost`, `btn-utility`, `btn-danger`), `card-surface`, `field`, `num` for the numeric face, plus the spacing helpers. Reach for those before writing new CSS, and when a screen does need its own rules, write them in `<style scoped>` against the tokens rather than hard-coded hex values.

Every number the user reads — PIN, timer, score, counts — is set in the numeric face (`.num` / `font-numeric`). Never a sentence.

## Motion

`composables/useMotion.js` owns GSAP and Lenis so no component talks to either directly.

- `revealOnEnter(root)` reveals the `[data-enter]` blocks of a page once it mounts; `revealAppended(elements)` does the same for rows added by pagination.
- Lenis drives the window from its own RAF loop, which is why the router's `scrollBehavior` delegates to `window.__lenis` instead of scrolling itself.
- `main.js` sets `history.scrollRestoration = 'manual'`, so a reload always starts at the top while back and forward still restore their position.
- **`prefers-reduced-motion` is respected everywhere**: Lenis is never started, reveals resolve to their final state, and every scoped stylesheet ends with a `@media (prefers-reduced-motion: reduce)` block that switches its transitions off.

## Notable components

- **`QuizRail`** — the home carousel. A fixed window of N cards (4 / 3 / 2 / 1 by breakpoint), GSAP Flip between states, `index` clamped to `[0, total - perView]` so it never loops, the real "See all" card as the last item, and every card kept in the DOM so Flip stays stable.
- **`QuizEditor`** — the shared body of the create and edit pages, backed by `useQuizDraft`. A choice question carries **2 to 4 options**, the same bound the API enforces.
- **`GameConfigForm`** — rendered from `GET /games/game-modes` (`editable` / `locked` per field), never from a hardcoded list. Fields a mode locks are shown as locked instead of being silently dropped; `HIDDEN_MODES` in `constants/gameConfig.js` keeps unfinished modes out of the picker.
- **`GameShell` + `QuestionStage`** — the play surface, shared by the host console, the live player view, the self-paced view and the preview run.
- **`AnswerReviewList`** — one review row per question, used by both the end-of-game screen and the history detail page: red or green left border per item, the correct option in green, a wrongly picked option in red, and a "Your answer" label above the reader's own choice.
- **`StateBlock` / `SkeletonBlock`** — the standard empty, error and loading surfaces. Every list screen shows a skeleton first, then content, an empty state with an action, or an inline error with a retry.

## Testing

```bash
pnpm test
```

Vitest reuses `vite.config.js` on purpose, so the `@` alias and the Vue plugin cannot drift between the app and the specs. The environment is happy-dom, the Vitest API is global, and `tests/` mirrors the `src/` tree it covers (`tests/api`, `tests/components/game`, `tests/composables`, `tests/stores`, `tests/utils`, with shared payloads in `tests/fixtures`).

What is worth a spec here: envelope and mapper behaviour, the game socket and player-session composables, the config constants, and the components that decide something (results, leaderboard, question stage). Pure presentation is not tested.

## Build and deploy

```bash
pnpm build      # -> dist/
pnpm preview    # serve the build locally
```

`Dockerfile` builds the bundle and serves it with nginx using `nginx.conf`, which falls back to `index.html` so the history-mode router keeps working on a deep link. `VITE_*` variables are compile-time: a different API URL means a different build, which is what `.env.prod` is for.

## Conventions

- ESLint flat config, mirroring the backend where it makes sense: **no semicolons, single quotes, two-space indent**, trailing commas on multiline, `max-len` 120 (off inside `.vue`, where Tailwind attributes cannot be wrapped). Run `pnpm lint` before pushing.
- **Comments, logs and identifiers are written in English.** User-facing strings live in `api/errors.js` or in the component that renders them.
- Vue SFCs are `<script setup>` first, then `<template>`, then `<style scoped>`. Attribute order follows `vue/attributes-order`; components are referenced in PascalCase.
- `console.log` is a lint warning: keep `console.warn` and `console.error` for things a developer needs to see.
- Prefer a composable over a store. Pinia holds only what genuinely outlives a route — the session and the live match.
- Never introduce a second styling system. Tailwind utilities and the token-based scoped CSS above are the two allowed options.
- The API contract is the backend's OpenAPI document. When an endpoint changes, update `src/api/` and the affected screen in the same commit.
