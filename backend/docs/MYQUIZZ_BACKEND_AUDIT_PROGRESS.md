# Tiến độ triển khai audit backend

Cập nhật: 2026-11-01 (GMT+7). Xem [bản audit](MYQUIZZ_BACKEND_AUDIT.md) để đọc tiêu chí của từng ID. Bảng này phân biệt mã đã sửa với phần đã kiểm thử trên dịch vụ thật. Đã chạy Compose với PostgreSQL/Redis mới, migration và smoke API/Socket.IO. Chưa chạy S3 HEAD, restart/recovery, benchmark hoặc restore backup.

| Nhóm | Trạng thái |
| --- | --- |
| B01–B15, B18–B19, B21–B37, B39–B40 | Đã sửa mã và có lint/build; test tự động bao phủ một phần, chưa xác nhận tích hợp đầy đủ. |
| B16 | Chưa triển khai checkpoint và phục hồi toàn bộ timer/game state sau restart. |
| B17 | Redis lock tuần tự hóa thao tác host start/next/pause/resume/end; `game:next` mang index và phase kỳ vọng. Đã test hai host socket đồng thời cho start/next/end trên một backend instance; chưa test nhiều instance hoặc timer cạnh tranh với host. |
| B20 | Answer, player-next, host transition và player clock kiểm tra Redis ready trước thao tác; Docker test ngắt Redis giữa câu trả `SERVICE_UNAVAILABLE` thay vì treo quá 15 giây. Các đường ghi cache game khác vẫn có thể fail-open hoặc mất trạng thái nếu Redis hỏng giữa claim và cập nhật player. |
| B38 | Đã xác nhận key, chủ sở hữu và metadata S3 HEAD; chưa đọc lại nội dung thực để phát hiện MIME giả. |
| B41 | Đã tách DB connect khỏi import, thêm live/ready và shutdown; readiness chưa đo khả năng phục hồi room realtime. |

| Mục cải thiện | Trạng thái |
| --- | --- |
| C01 | Backend test script và CI gate đã có; chưa có PostgreSQL/Redis/Socket.IO integration gate. |
| C02 | Lobby, kết quả và profile có projection tường minh; còn response DTO khác cần rà soát. |
| C03–C04 | Chưa hoàn tất nguồn sự thật game/recovery và guest token gắn phòng. |
| C05 | Origin check cho cookie mutation đã có; cần test browser/subdomain/proxy thật. |
| C06–C07 | Chưa có benchmark/EXPLAIN và tối ưu trigger theo số liệu. |
| C08 | Quiz CRUD đổi cache generation nguyên tử; thay đổi featured trực tiếp trong DB chưa tăng generation. |
| C09 | Continue-playing lọc trạng thái room/player. |
| C10 | Giới hạn handshake, socket/IP, event và payload trong một process; chưa đo ACK p95 hoặc bảo vệ nhiều instance. |
| C11 | Có request ID/log JSON không ghi query; chưa có monitoring tập trung. |
| C12 | Kiểm tra nonempty JWT secrets, port và TTL; cần xác minh trên cấu hình production thực. |
| C13 | Giới hạn JSON, headers và timeout; cần test reverse proxy và IP gốc. |
| C14 | Đã chạy Compose: backend container non-root, PostgreSQL/Redis bind loopback và health/readiness 200. Chưa thử reverse proxy production. |
| C15 | Scoring job có advisory lock liên process; chưa đo query plan hoặc làm incremental stats. |
| C16 | Answer key marathon được ghi vào set và xóa khi room kết thúc. |
| C17 | Bỏ index refresh token trùng unique index; chưa benchmark index/retention lịch sử. |
| C18 | Đã cập nhật dependency và thay `xlsx`; `pnpm audit --prod` hiện báo 0 advisory ở backend và frontend. Chưa chạy secret scanner hoặc backup restore. |

## Kiểm tra đã chạy

- Backend `pnpm lint`, `pnpm test` (build và 41 test) qua.
- Frontend lint/build qua sau thay đổi liên quan; suite Vitest có các lỗi cũ ở GameResultsView, useGameSocket và envelope. Node 26 cần tắt experimental webstorage; CI dùng Node 22.
- `docker compose up -d --build` qua trên volume mới; backend/frontend/PostgreSQL/Redis chạy, 23 schema/migration được ghi nhận và chạy lại idempotent. Smoke register/login, quiz/game CRUD cơ bản, Socket.IO start/answer/end, quyền kết quả ẩn và 20 join đồng thời qua. Ngắt Redis giữa câu trả lời xác nhận fail-closed; Redis khởi động lại và health phục hồi.

## Việc bắt buộc trước khi triển khai

1. Dùng PostgreSQL/Redis/S3 cô lập để chạy migration `012`–`017`, rà soát seat trùng trước `014`, test refresh/reset/join/timeout/restart và thay avatar.
2. Chốt thiết kế B16/B17/B20/C03/C04, hoàn thiện mã và kiểm thử nhiều instance.
3. Đo baseline p50/p95, CPU/RAM và query plan trên dữ liệu đủ lớn trước khi quyết định C06/C07/C15/C17.
4. Kiểm tra lại dependency advisories định kỳ; kiểm tra proxy, restore backup và kịch bản rollback trên môi trường triển khai thực.
