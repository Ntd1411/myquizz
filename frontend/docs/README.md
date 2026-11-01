# Ngữ cảnh frontend MyQuizz

## Kiến trúc hiện tại

Vue 3/Vite, Vue Router, Pinia, TanStack Vue Query, Tailwind và Socket.IO client. `src/pages/` chứa màn hình; `components/` chứa UI; `composables/` chứa hành vi tái sử dụng; `api/` chứa HTTP/socket, mapper và xử lý envelope; `assets/` và `public/` chứa tài nguyên.

`src/api/http.js` dùng Axios với withCredentials và promise dùng chung để gom refresh đồng thời. Không cần đề xuất xây lại cơ chế này như tính năng chưa có. Hiện refresh lỗi sẽ phát sự kiện hết phiên; cần phân biệt lỗi mạng tạm thời và lỗi phiên dứt điểm.
`useGameSocket.js` nối event với game store, xử lý join/sync khi reconnect; server là nguồn quyết định quyền và điểm.

## Phát triển và kiểm thử

Trong frontend: `pnpm install --frozen-lockfile`, `pnpm dev` (5173), `pnpm lint`, `pnpm test`, `pnpm build`; `pnpm test --coverage` thu thập V8 coverage. Dùng `.env.example` của frontend; backend cần cho phép origin local để cookie hoạt động.
Test trong `tests/**/*.spec.js` với Vitest, Vue Test Utils, happy-dom; mirror cây src. Chưa có ngưỡng coverage số. CI build.yml hiện chạy lint/build, chưa chạy frontend test.

Xem [kế hoạch](frontend-plan.md), [backend](../../backend/docs/README.md) và [quy trình](../../AGENTS.md). Đây là ngữ cảnh mã nguồn, chưa phải kết quả kiểm thử trình duyệt thực tế.
