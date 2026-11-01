# Repository Guidelines

## Project Structure & Module Organization

- `backend/src/modules/` contains TypeScript feature modules: auth, user, quiz, game, storage, and admin. Follow the existing route → controller → service → repository structure; keep validation in schema files.
- `backend/src/infrastructure/` holds PostgreSQL schemas/migrations, Redis, mail, configuration, and jobs. Shared middleware and utilities live in `backend/src/shared/`; API documentation lives in `backend/src/docs/`.
- `frontend/src/` contains the Vue 3 client: pages, components, composables, Pinia stores, API code, and assets. Static files live in `frontend/public/`; tests live in `frontend/tests/`.
- Root Docker Compose and deployment files support the full stack. The Android client is maintained in a separate repository.

## Build, Test, and Development Commands

Run package commands inside `backend/` or `frontend/`, not the repository root.

- `pnpm install`: install each package's dependencies.
- `pnpm dev`: start the backend watcher on port 3000 or Vite on port 5173.
- `pnpm build`: compile the backend and copy SQL files, or build the frontend bundle.
- `pnpm lint` / `pnpm lint:fix`: check or fix ESLint violations in either package.
- `pnpm test` in `frontend/`: run Vitest once; `pnpm test --coverage` collects V8 coverage.
- `pnpm db:migrate` in `backend/`: apply database migrations; startup also runs migrations.
- `docker compose up -d --build` at the root: build and start the full stack.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and no semicolons. Backend rules prohibit trailing commas; frontend rules require them in multiline structures. Follow each package's ESLint configuration. Use backend names such as `quiz.service.ts`, PascalCase Vue components such as `QuizCard.vue`, and `useSomething.js` composables. Preserve `.js` extensions in backend ESM imports.

## Testing Guidelines

Frontend tests use Vitest, Vue Test Utils, and happy-dom. Name specs `tests/**/*.spec.js`, mirroring source directories. No numeric coverage threshold is configured. The backend currently has no test script. Validate backend changes with lint/build and relevant API or Socket.IO scenarios; record results in the PR.

## Commit & Pull Request Guidelines

Follow the history's Conventional Commit style: `feat(admin): ...`, `fix: ...`, or `docs: ...`. Keep changes focused. PRs should explain behavior, link related issues, list validation performed, and include screenshots for UI changes. Document API, socket, configuration, and migration changes.

## Security & Configuration

Use package-specific `.env.example` files for local development and the root example for Compose. Never commit credentials or log tokens. Preserve authorization checks and server-side grading. Run database reset and volume-deletion commands only against disposable data.

## Project Context & Delivery Workflow

Read `backend/docs/README.md` and relevant linked documents when context is needed; use `frontend/docs/` for web changes. The Android plan at `backend/docs/android-plan.local.md` is local-only: never stage or commit it. Verify documentation against current source and update it when behavior changes. Plans do not authorize implementing all listed features.

Create a separate branch for each independent feature/fix/documentation part (for example `fix/socket-token-expiry`); choose the appropriate base and keep unrelated work separate. Preserve existing user changes and stage only intended files.

Prioritize meaningful automated tests for behavior that can be tested. Run relevant tests and checks before committing; documentation-only changes need content/link/diff validation. Do not label failed or unrun checks as passing. When required checks pass, commit completed work immediately without requesting user confirmation. If checks fail, fix relevant failures or document blockers; never bypass checks silently.

Write commit messages in English using Conventional Commits: `feat: ...`, `feat(auth): ...`, `fix(game): ...`, `docs: ...`, `test: ...`. Commit locally only; do not push unless explicitly requested. Update root `CHANGELOG.md` for each completed part with the actual timestamp in `YYYY-MM-DD HH:mm:ss GMT+7`, changes, verification, and remaining limitations. Do not include secrets.

Continue through the authorized request; reserve the user-facing list of manual tests, setup steps, and remaining actions for the final completion report. Keep necessary progress updates brief and report genuine blockers when they arise.
