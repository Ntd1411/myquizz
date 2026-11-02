# Tiến độ triển khai audit backend

Cập nhật: 2026-11-02 (GMT+7). Xem [bản audit](MYQUIZZ_BACKEND_AUDIT.md) để đọc tiêu chí của từng ID. Bảng này phân biệt mã đã sửa với phần đã kiểm thử trên dịch vụ thật. Đã chạy Compose với PostgreSQL/Redis mới, migration và smoke API/Socket.IO. Test Docker đã xác nhận phục hồi sau restart và sau khi xóa toàn bộ Redis hot state. Chưa chạy S3 thật, benchmark tải lớn hoặc restore backup production.

| Nhóm | Trạng thái |
| --- | --- |
| B01–B15, B18–B19, B21–B37, B39–B40 | Đã sửa mã và có lint/build; test tự động bao phủ một phần, chưa xác nhận tích hợp đầy đủ. |
| B16 | Phase/deadline, pause remaining, player clock và player progress được checkpoint PostgreSQL; boot rehydrate Redis rồi dựng lại timer. Unit test và Docker restart giữa câu, pause/resume, solo self-paced đều qua; `FLUSHALL` Redis trước restart cũng qua cho classic, solo và paused classic. |
| B17 | Redis lock tuần tự hóa thao tác host start/next/pause/resume/end và timer countdown/question/results; timer so lại phase/index/deadline sau khi lấy lock. `game:next` mang index và phase kỳ vọng. Đã test hai host socket đồng thời cho start/next/end và unit test timer cũ chạy sau pause; chưa test nhiều instance hoặc tranh chấp thật qua Socket.IO. |
| B20 | Game writes fail-closed khi Redis lỗi; cache warming của đường đọc vẫn optional. Claim answer, player snapshot và leaderboard là một Lua transaction, sau đó checkpoint DB. Docker ngắt Redis: lobby GET 200, join 503 trong ~12 ms, bật lại Redis join 201; xóa Redis rồi restart vẫn giữ tiến trình qua DB checkpoint. |
| B38 | Đã xác nhận key, chủ sở hữu và metadata S3 HEAD; chưa đọc lại nội dung thực để phát hiện MIME giả. |
| B41 | Đã tách DB connect khỏi import, thêm live/ready và shutdown; readiness chưa đo khả năng phục hồi room realtime. |

| Mục cải thiện | Trạng thái |
| --- | --- |
| C01 | Backend unit và API/Redis/PostgreSQL/Socket.IO smoke test chạy ở CI cho nhánh tính năng và trước deploy `main`; chưa có test nhiều backend instance hoặc tải/race dài hạn. |
| C02 | Lobby, kết quả, profile và session trong summary lịch sử có projection tường minh; lobby trả host ID, summary trả `finished_at` theo frontend. Còn response DTO khác cần rà soát. |
| C03 | PostgreSQL là recovery checkpoint; Redis là hot state và lock. Timer dùng deadline chung, boot rehydrate Redis. Chưa kiểm thử adapter/broadcast nhiều backend instance. |
| C04 | Chưa hoàn tất guest token ký gắn phòng; UUID hiện vẫn là bearer identity cho lịch sử. |
| C05 | Origin check cho cookie mutation đã có; cần test browser/subdomain/proxy thật. |
| C06–C07 | Chưa có benchmark/EXPLAIN và tối ưu trigger theo số liệu. |
| C08 | Quiz CRUD đổi cache generation nguyên tử; thay đổi featured trực tiếp trong DB chưa tăng generation. |
| C09 | Continue-playing lọc trạng thái room/player. |
| C10 | Giới hạn handshake, socket/IP, event và payload trong một process; rate limiter HTTP dùng fallback ngay khi Redis disconnected. Chưa đo ACK p95 hoặc bảo vệ nhiều instance. |
| C11 | Có request ID/log JSON không ghi query; chưa có monitoring tập trung. |
| C12 | Kiểm tra nonempty JWT secrets, port và TTL; cần xác minh trên cấu hình production thực. |
| C13 | Giới hạn JSON, headers và timeout; cần test reverse proxy và IP gốc. |
| C14 | Đã chạy Compose: backend container non-root, PostgreSQL/Redis bind loopback và health/readiness 200. Chưa thử reverse proxy production. |
| C15 | Scoring job có advisory lock liên process; chưa đo query plan hoặc làm incremental stats. |
| C16 | Answer key marathon được ghi vào set và xóa khi room kết thúc. |
| C17 | Bỏ index refresh token trùng unique index; chưa benchmark index/retention lịch sử. |
| C18 | Đã cập nhật dependency và thay `xlsx`; `pnpm audit --prod` hiện báo 0 advisory ở backend và frontend. Chưa chạy secret scanner hoặc backup restore. |

## Kiểm tra đã chạy

- Backend `pnpm lint`, `pnpm test` (build và 48 test) qua.
- Frontend lint/build qua sau thay đổi liên quan; suite Vitest có các lỗi cũ ở GameResultsView, useGameSocket và envelope. Node 26 cần tắt experimental webstorage; CI dùng Node 22.
- `docker compose up -d --build` qua trên volume mới; backend/frontend/PostgreSQL/Redis chạy, 23 schema/migration được ghi nhận và chạy lại idempotent. Smoke register/login, quiz/game CRUD cơ bản, Socket.IO start/answer/end, quyền kết quả ẩn và 20 join đồng thời qua. Bài `pnpm test:integration` tái lập API create/join, Socket.IO answer/end và history summary. Ngắt Redis giữa câu trả lời xác nhận fail-closed; Redis khởi động lại và health phục hồi.

## Việc bắt buộc trước khi triển khai

1. Trên PostgreSQL/Redis/S3 cô lập, tiếp tục test refresh/reset/timeout/restart, seat trùng trước migration `014` trên DB có dữ liệu cũ, và thay avatar. Migration `012`–`017` đã chạy trên DB mới.
2. Chốt thiết kế B16/B17/B20/C03/C04, hoàn thiện mã và kiểm thử nhiều instance.
3. Đo baseline p50/p95, CPU/RAM và query plan trên dữ liệu đủ lớn trước khi quyết định C06/C07/C15/C17.
4. Kiểm tra lại dependency advisories định kỳ; kiểm tra proxy, restore backup và kịch bản rollback trên môi trường triển khai thực.
