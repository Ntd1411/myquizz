# Tiến độ triển khai audit backend

Cập nhật: 2026-11-01 (GMT+7). Xem [bản audit](MYQUIZZ_BACKEND_AUDIT.md) để đọc tiêu chí của từng ID. Bảng này phân biệt mã đã sửa với phần đã kiểm thử trên dịch vụ thật. Môi trường hiện tại không có Docker daemon hoặc PostgreSQL/Redis chạy cục bộ; chưa chạy migration, test API/Socket.IO tích hợp, S3 HEAD, thử restart, benchmark hoặc restore backup.

| Nhóm | Trạng thái |
| --- | --- |
| B01–B15, B18–B19, B21–B37, B39–B40 | Đã sửa mã và có lint/build; test tự động bao phủ một phần, chưa xác nhận tích hợp đầy đủ. |
| B16 | Chưa triển khai checkpoint và phục hồi toàn bộ timer/game state sau restart. |
| B17 | Chưa có CAS cho mọi host transition; hai host socket vẫn có thể cạnh tranh. |
| B20 | Answer và player clock fail-closed; các đường ghi cache game khác vẫn có thể fail-open. |
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
| C14 | Container backend chạy non-root, PostgreSQL/Redis chỉ bind loopback mặc định; chưa chạy thử image/deployment. |
| C15 | Scoring job có advisory lock liên process; chưa đo query plan hoặc làm incremental stats. |
| C16 | Answer key marathon được ghi vào set và xóa khi room kết thúc. |
| C17 | Bỏ index refresh token trùng unique index; chưa benchmark index/retention lịch sử. |
| C18 | Đã quét `pnpm audit --prod`: backend 1 critical, 8 high, 16 moderate, 2 low; frontend 15 high, 5 moderate. Chưa sửa dependency, chưa chạy secret scanner hoặc backup restore. |

## Kiểm tra đã chạy

- Backend `pnpm lint`, `pnpm test` (build và 41 test) qua.
- Frontend lint/build qua sau thay đổi liên quan; suite Vitest có các lỗi cũ ở GameResultsView, useGameSocket và envelope. Node 26 cần tắt experimental webstorage; CI dùng Node 22.
- `docker compose config --quiet` qua; Docker daemon không chạy nên chưa build/chạy container.

## Việc bắt buộc trước khi triển khai

1. Dùng PostgreSQL/Redis/S3 cô lập để chạy migration `012`–`017`, rà soát seat trùng trước `014`, test refresh/reset/join/timeout/restart và thay avatar.
2. Chốt thiết kế B16/B17/B20/C03/C04, hoàn thiện mã và kiểm thử nhiều instance.
3. Đo baseline p50/p95, CPU/RAM và query plan trên dữ liệu đủ lớn trước khi quyết định C06/C07/C15/C17.
4. Rà soát dependency advisories, proxy, restore backup và kịch bản rollback trên môi trường triển khai thực.
