# Tiến độ triển khai audit backend

Cập nhật: 2026-11-02 (GMT+7). Xem [bản audit](MYQUIZZ_BACKEND_AUDIT.md) để đọc tiêu chí của từng ID. Bảng này phân biệt mã đã sửa với phần đã kiểm thử trên dịch vụ thật. Đã chạy Compose với PostgreSQL/Redis mới, migration và smoke API/Socket.IO. Test Docker đã xác nhận phục hồi sau restart và sau khi xóa toàn bộ Redis hot state. Chưa chạy S3 thật, benchmark tải lớn hoặc restore backup production.

| Nhóm | Trạng thái |
| --- | --- |
| B01–B15, B18–B19, B21–B37, B39–B40 | Đã sửa mã và có lint/build; test tự động bao phủ một phần, chưa xác nhận tích hợp đầy đủ. |
| B16 | Phase/deadline, pause remaining, player clock và player progress được checkpoint PostgreSQL; boot rehydrate Redis rồi dựng lại timer. Unit test và Docker restart giữa câu, pause/resume, solo self-paced đều qua; `FLUSHALL` Redis trước restart cũng qua cho classic, solo và paused classic. |
| B17 | Redis lock tuần tự hóa host action và timer; timer so lại phase/index/deadline sau lock. Socket.IO Redis adapter chia sẻ room/event giữa process. Đã test hai host cạnh tranh và Docker hai backend: host instance 1, player instance 2 chạy trọn start/answer/end. |
| B20 | Game writes fail-closed khi Redis lỗi; cache warming của đường đọc vẫn optional. Claim answer, player snapshot và leaderboard là một Lua transaction, sau đó checkpoint DB. Docker ngắt Redis: lobby GET 200, join 503 trong ~12 ms, bật lại Redis join 201; xóa Redis rồi restart vẫn giữ tiến trình qua DB checkpoint. |
| B38 | Xác nhận key/chủ sở hữu, HEAD size/MIME và đọc range 16 byte để đối chiếu magic bytes JPEG/PNG/GIF/WebP. Unit test MIME giả qua; chưa chạy với provider S3 thật do local dùng placeholder. |
| B41 | Bootstrap DB/migration tường minh, live/ready, shutdown; realtime readiness chỉ true sau khi recovery kiểm tra room/paused clock/self-paced clock. Docker boot với room recoverable trả `realtime:true`. |

| Mục cải thiện | Trạng thái |
| --- | --- |
| C01 | Backend unit và API/Redis/PostgreSQL/Socket.IO smoke test chạy ở CI cho nhánh tính năng và trước deploy `main`; chưa có test nhiều backend instance hoặc tải/race dài hạn. |
| C02 | Lobby, kết quả, profile và session trong summary lịch sử có projection tường minh; lobby trả host ID, summary trả `finished_at` theo frontend. Còn response DTO khác cần rà soát. |
| C03 | PostgreSQL là recovery checkpoint; Redis là hot state, lock và Socket.IO pub/sub adapter. Timer dùng deadline chung, boot rehydrate Redis. Docker hai backend đã xác nhận cross-instance broadcast; PM2 vẫn 1 instance chờ sticky session cho polling fallback. |
| C04 | Guest join nhận token lịch sử có chữ ký và TTL; frontend gửi `x-guest-token`. UUID thô chỉ dùng rejoin seat và bị từ chối ở history. Socket token vẫn gắn room/player riêng. |
| C05 | Origin check cho cookie mutation đã có; cần test browser/subdomain/proxy thật. |
| C06 | Có baseline local 500 request và EXPLAIN recovery trên 10.028 room; cần lặp home/feed/search/history với dữ liệu production đại diện. |
| C07 | Insert/replace question dùng một batch statement; trigger question_count cập nhật cộng/trừ. 500 câu giảm tổng 75,649 xuống 29,436 ms, trigger giảm 65,590 xuống 19,166 ms. |
| C08 | Quiz CRUD đổi cache generation nguyên tử; thay đổi featured trực tiếp trong DB chưa tăng generation. |
| C09 | Continue-playing lọc trạng thái room/player. |
| C10 | Giới hạn handshake, socket/IP, event và payload; HTTP limiter fallback ngay khi Redis disconnected. Redis adapter chia sẻ event nhiều instance; counter socket vẫn theo process. Chưa đo ACK p95 tải lớn. |
| C11 | Có request ID/log JSON không ghi query; chưa có monitoring tập trung. |
| C12 | Kiểm tra nonempty JWT secrets, port và TTL; cần xác minh trên cấu hình production thực. |
| C13 | Giới hạn JSON, headers và timeout; cần test reverse proxy và IP gốc. |
| C14 | Đã chạy Compose: backend container non-root, PostgreSQL/Redis bind loopback và health/readiness 200. Chưa thử reverse proxy production. |
| C15 | Scoring job có advisory lock liên process; chưa đo query plan hoặc làm incremental stats. |
| C16 | Answer key marathon được ghi vào set và xóa khi room kết thúc. |
| C17 | Bỏ index refresh token trùng unique index; chưa benchmark index/retention lịch sử. |
| C18 | Dependency production 0 advisory; scan pattern secret trên file tracked 0 match. PostgreSQL dump/restore sang DB tạm qua và đối chiếu count; chưa diễn tập rollback trên production. |

## Kiểm tra đã chạy

- Backend `pnpm lint`, `pnpm test` (build và 51 test) qua.
- Frontend lint/build qua sau thay đổi liên quan; suite Vitest có các lỗi cũ ở GameResultsView, useGameSocket và envelope. Node 26 cần tắt experimental webstorage; CI dùng Node 22.
- `docker compose up -d --build` qua trên volume mới; backend/frontend/PostgreSQL/Redis chạy, 23 schema/migration được ghi nhận và chạy lại idempotent. Smoke register/login, quiz/game CRUD cơ bản, Socket.IO start/answer/end, quyền kết quả ẩn và 20 join đồng thời qua. Bài `pnpm test:integration` tái lập API create/join, Socket.IO answer/end và history summary. Ngắt Redis giữa câu trả lời xác nhận fail-closed; Redis khởi động lại và health phục hồi.

## Việc bắt buộc trước khi triển khai

1. Trên PostgreSQL/Redis/S3 cô lập, tiếp tục test refresh/reset/timeout/restart, seat trùng trước migration `014` trên DB có dữ liệu cũ, và thay avatar. Migration `012`–`017` đã chạy trên DB mới.
2. Chốt thiết kế B16/B17/B20/C03/C04, hoàn thiện mã và kiểm thử nhiều instance.
3. Đo baseline p50/p95, CPU/RAM và query plan trên dữ liệu đủ lớn trước khi quyết định C06/C07/C15/C17.
4. Kiểm tra lại dependency advisories định kỳ; kiểm tra proxy, restore backup và kịch bản rollback trên môi trường triển khai thực.
