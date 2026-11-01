# Phát triển và kiểm thử

## Môi trường

CI dùng Node.js 22, pnpm 10. Backend và frontend là hai package riêng, không chạy lệnh package ở root.
Dùng `.env.example` tương ứng cho từng package; root `.env.example` dành cho Compose. Giữ nguyên file cấu hình local đã có; không ghi đè hoặc đưa secrets vào commit.

- Root: `docker compose up -d --build` khởi động PostgreSQL, Redis, API và web.
- Trong `backend/`: `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm lint`, `pnpm build`.
- `pnpm db:migrate` chạy migrations; startup cũng chạy migration. `pnpm db:seed:demo` và `pnpm db:score` dùng với DB phát triển được cho phép.
- `GET /health` kiểm tra DB/Redis; `/v1/docs` là API reference; `/v1/docs/socket` là tài liệu socket. `/v1/api-docs` cần được bảo vệ ở reverse proxy trong production.
- `pnpm docs:export` xuất đặc tả khi thay đổi hợp đồng API.

## Chiến lược xác minh

Backend có `pnpm test` chạy build và Node test runner cho `tests/*.test.mjs` và `tests/*.test.cjs`. Test DB/Redis cần dịch vụ cô lập; unit test mô phỏng không thay thế kiểm tra cạnh tranh trên dịch vụ thật.
Chạy lint/build khi sửa code; kiểm tra tài liệu/link/diff cho thay đổi chỉ có Markdown. Nếu check lỗi có sẵn, ghi rõ nguyên nhân và phạm vi; không sửa lan man hoặc tự coi là đạt.

Các kịch bản trọng tâm: 401/403 và phân quyền chéo tài khoản; refresh đồng thời/replay; reset hết hạn/dùng lại; token socket hết hạn/sai room; trả lời trùng/quá giờ; reconnect không đặt lại thời gian; Redis gián đoạn; upload sai kiểu/kích thước.
Dùng DB/Redis test cô lập. Không reset dữ liệu thật hoặc chạy load test vào production.

## Quy trình Git

Mỗi phần độc lập dùng nhánh riêng từ base phù hợp; không đưa commit của phần chưa liên quan vào nhánh mới. Stage theo đường dẫn và kiểm tra staged diff. Test được phần nào thì chạy phần đó; đạt kiểm tra liên quan thì commit không cần hỏi lại. Không push nếu chưa có yêu cầu.
Cập nhật CHANGELOG với timestamp GMT+7, nội dung đã làm, kiểm tra thực tế và hạn chế. Báo các bước kiểm tra thủ công/cấu hình còn lại khi hoàn tất yêu cầu.
