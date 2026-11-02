# Changelog

Thời gian ghi theo GMT+7 (UTC+07:00). Ghi công việc thực tế đã hoàn thành; kế hoạch chưa triển khai nằm trong tài liệu riêng.

## 2026-11-02 15:36:18 GMT+7

### Invalidation cache quiz đầy đủ

- Migration `020` tăng cache generation ở tầng PostgreSQL khi quiz được tạo/xóa hoặc thay đổi nội dung, public/private, featured và play count; question batch chỉ invalidation một lần.
- Scoring và generation được cập nhật trong cùng một statement, chỉ khi thực sự có score thay đổi, nên home/feed không giữ thứ tự cũ đến hết TTL.
- Xác minh: backend lint/build và 53/53 test; Compose áp migration, readiness 200; transaction featured tăng generation và rollback sạch; scoring sửa 1 quiz rồi tăng generation; Docker API/Socket.IO integration qua.

## 2026-11-02 15:32:47 GMT+7

### Batch câu hỏi và baseline vận hành

- Insert/replace câu hỏi bằng một statement; migration `019` đổi trigger question_count từ đếm lại toàn bộ sang cộng/trừ nguyên tử.
- Docker 500 câu: tổng 75,649 → 29,436 ms; riêng trigger 65,590 → 19,166 ms. Recovery query 10.028 room chạy 1,819 ms; HTTP health 500 request concurrency 25 đạt p50 17,87 ms, p95 29,91 ms.
- PostgreSQL dump/restore vào DB tạm qua; production dependency audit 0 advisory hai package, scan pattern secret tracked 0 match. Chi tiết ở tài liệu baseline audit.

## 2026-11-02 15:28:54 GMT+7

### Readiness của realtime recovery

- Recovery trả báo cáo health; `/health/ready` chỉ trả 200 khi DB, Redis và checkpoint của các room mở đều phục hồi được. Paused room thiếu remaining time hoặc self-paced player thiếu clock làm realtime readiness fail.
- Xác minh: backend lint/build và 51/51 test. Docker boot kiểm tra 1 room recovery, log `healthy=true`; readiness trả 200 với `realtime:true`.

## 2026-11-02 15:27:12 GMT+7

### Kiểm tra chữ ký nội dung ảnh upload

- Sau HEAD metadata, backend đọc range 16 byte đầu object và đối chiếu magic bytes JPEG/PNG/GIF/WebP trước khi cho gắn URL vào dữ liệu.
- Xác minh: backend lint/build và 50/50 test; test chấp nhận bốn định dạng hợp lệ và từ chối nội dung script khai MIME PNG. Chưa gọi provider S3 thật vì cấu hình local dùng placeholder.

## 2026-11-02 15:24:41 GMT+7

### Socket.IO nhiều backend instance

- Gắn Socket.IO Redis adapter bằng pub/sub connection riêng; room broadcast và socket lookup hoạt động giữa các process, trong khi Redis host lock tiếp tục tuần tự hóa transition/timer.
- Xác minh: backend lint/build và 49/49 test. Docker chạy hai backend ở cổng 3000/3001: host nối instance 1, player nối instance 2; start, answer, end và summary đều qua. Container instance 2 đã được xóa sau test.
- PM2 production vẫn để một instance cho đến khi reverse proxy có sticky session cho polling fallback; WebSocket test hai instance đã qua.

## 2026-11-02 15:20:39 GMT+7

### Guest token cho lịch sử trận

- Join guest trả token lịch sử có chữ ký và hạn bằng refresh TTL; frontend lưu token trong localStorage và gửi riêng qua `x-guest-token` cho history/summary/my-answers.
- UUID guest chỉ dùng để rejoin seat, không còn đủ quyền đọc lịch sử. Cookie tài khoản vẫn ưu tiên nếu đồng thời có guest token.
- Xác minh: backend lint/build và 49/49 test, frontend lint/build, Docker API/Socket.IO smoke qua; UUID thô bị từ chối 403 còn signed token đọc summary thành công.

## 2026-11-02 12:47:05 GMT+7

### Checkpoint và phục hồi game sau mất Redis

- Gộp claim đáp án, cập nhật player và leaderboard vào một Lua transaction; checkpoint player xuống PostgreSQL ngay sau answer/timeout. Phase, deadline, thời gian pause và clock self-paced cũng được ghi xuyên xuống PostgreSQL qua migration `018`.
- Khi boot, backend dựng lại session/clock từ PostgreSQL nếu Redis trống. Chuẩn hóa timestamp PostgreSQL trước khi so deadline để timer không bỏ nhầm phase hợp lệ.
- Xác minh: backend lint/build và 48/48 test; Docker API/Socket.IO smoke qua. `FLUSHALL` Redis rồi restart backend giữa câu đã tự kết thúc đúng cho classic (room 21), solo (room 22) và pause/resume classic (room 24).

## 2026-11-02 12:38:18 GMT+7

### API và Socket.IO integration gate

- Thêm `pnpm test:integration`: kịch bản localhost tạo tài khoản, quiz, phòng; join guest; chơi qua Socket.IO; xác minh ACK không tiết lộ kết quả và xem summary cuối trận. Yêu cầu cờ xác nhận DB disposable.
- CI nhánh và workflow deploy chạy smoke test trên PostgreSQL/Redis/backend Compose riêng, dọn volumes trong runner sau job.
- Xác minh: Docker Compose local chạy API create/join, Socket.IO answer, host end và history summary thành công; backend lint và `git diff --check` qua. Chưa kiểm tra Socket.IO trên nhiều instance.

## 2026-11-02 12:32:47 GMT+7

### Backend test gate trước deploy

- Workflow `main` chạy `pnpm test` (bao gồm build và 47 test backend) trước job deploy; workflow nhánh tính năng đã dùng lệnh này.
- Xác minh: backend `pnpm test` 47/47 qua ở checkout hiện tại; kiểm tra lệnh trong hai workflow và `git diff --check`. Chưa có integration gate cho PostgreSQL/Redis/Socket.IO trong CI.

## 2026-11-02 12:31:44 GMT+7

### Projection phòng lịch sử

- `GET /games/:id/summary` trả danh sách trường session tường minh, gồm `finished_at` mà màn lịch sử đang dùng; cột DB thêm sau này không tự lộ ra response. Bổ sung schema OpenAPI riêng.
- Xác minh: backend lint/build và 47/47 test; Docker trả summary 200 cho guest thuộc trận 16, có `finished_at` và không có `quiz_snapshot_id`/`deleted_at`. Frontend lint/build qua; suite Vitest đầy đủ còn 6 lỗi ở test cũ.

## 2026-11-02 12:28:06 GMT+7

### Timer game và thao tác host

- Các timer countdown, hết giờ câu hỏi và tự chuyển câu dùng cùng Redis host lock với thao tác host; kiểm tra phase, index và deadline sau khi lấy lock để bỏ timer cũ sau pause hoặc đổi phase. Khi lock đang bận, timer thử lại sau 100 ms.
- Backend lint/build và 46/46 test qua, gồm hồi quy timer chạy sau khi host pause. Docker build lại backend và restart giữa câu: phòng 16 tự kết thúc sau deadline. Chưa kiểm tra nhiều backend instance.

## 2026-11-02 12:24:29 GMT+7

### Rate limiter khi Redis ngắt

- Bỏ chờ hàng đợi retry Redis trong HTTP rate limiter khi client đã disconnected; auth/reset dùng bộ đếm local, các limiter còn lại theo chính sách fallback sẵn có.
- Docker ngắt Redis: GET lobby 200, POST join 503 trong ~12 ms thay vì ~57 giây; bật lại Redis và join 201. Readiness trở lại 200.
- Xác minh: backend lint/build và 45/45 test. Chưa đo tải p95 hoặc kiểm tra nhiều instance.

## 2026-11-02 12:22:42 GMT+7

### Phân biệt Redis cache đọc và game state bắt buộc

- Game writes session/player và đọc clock/answer stats fail-closed với `SERVICE_UNAVAILABLE`; cache warming ở đường REST đọc vẫn fallback PostgreSQL. Kiểm tra cả lỗi được trả về trong Redis MULTI.
- Docker ngắt Redis: GET lobby 200, POST join 503, sau khi bật lại Redis join 201 và readiness 200. Đường HTTP mất khoảng 57 giây do rate limiter retry Redis, sẽ xử lý ở phần riêng.
- Xác minh: backend lint/build và 44/44 test. Giới hạn: claim answer và cập nhật player chưa nguyên tử, DB chưa checkpoint đầy đủ nếu Redis mất hot state.

## 2026-11-02 12:18:54 GMT+7

### Kiểm chứng restart solo

- Docker restart backend giữa câu ở mode solo: clock Redis được dựng lại và trận tự chuyển sang `finished` sau deadline. Stack backend/frontend/PostgreSQL/Redis đang chạy, backend health/ready 200.
- Xác minh: quan sát trạng thái phòng qua REST sau restart; chưa kiểm thử survival/marathon hoặc Redis mất hot state.

## 2026-11-02 12:17:29 GMT+7

### Chủ phòng trong lobby công khai

- Bổ sung `session_host` vào projection session công khai để frontend nhận diện người mở link phòng của chính mình và chuyển sang màn host; trường này đã có trong tài liệu API.
- Xác minh: backend lint/build/test và response lobby trên Docker; frontend không đổi mã.

## 2026-11-02 12:14:54 GMT+7

### Phục hồi deadline game sau backend restart

- Tái hiện trên Docker trước sửa: restart backend giữa câu để phòng ở `question_active` sau khi deadline hết.
- Khi boot, đọc các phòng active/paused từ PostgreSQL và hot state Redis để dựng lại timer countdown/câu/kết quả và clock self-paced; lưu thời gian còn lại khi pause vào Redis để resume sau restart.
- Xác minh: backend lint/build và 43/43 test; Docker restart giữa câu và pause/resume rồi restart đều đưa trận đến `finished` sau deadline. Chưa test self-paced restart; còn thiếu checkpoint DB và phục hồi khi Redis mất hot state.

## 2026-11-01 23:23:18 GMT+7

### URL API cho frontend Compose

- Compose truyền URL API và Google client ID vào build frontend; mặc định API đúng `/v1` thay vì mẫu `/api/v1`. Sửa FRONTEND_URL và callback URL trong `.env.example` theo cổng/route hiện tại.
- Xác minh: `docker compose config --quiet`, build lại image frontend và kiểm tra bundle dùng `/v1`; chưa xác nhận OAuth với nhà cung cấp thật.

## 2026-11-01 23:21:50 GMT+7

### Redis gián đoạn khi chơi

- Kiểm tra trạng thái Redis trước khi nhận answer, player-next, host transition và ghi player clock; trả `SERVICE_UNAVAILABLE` ngay khi Redis đã mất kết nối.
- Docker test ngắt Redis giữa câu: trước sửa answer không phản hồi trong 15 giây, sau sửa nhận lỗi 503 kịp thời; khởi động lại Redis và readiness phục hồi 200.
- Xác minh: backend lint/build/test và smoke Docker. Giới hạn: các đường ghi game khác vẫn cần fail-closed; claim answer và cập nhật player chưa nguyên tử với nhau.

## 2026-11-01 23:18:19 GMT+7

### Kiểm thử Docker và chuyển trạng thái host

- Dựng Compose trên volume mới; PostgreSQL ghi nhận 23 schema/migration và lần chạy migration thứ hai không thêm bản ghi. Backend/frontend/PostgreSQL/Redis chạy; health/ready 200.
- Smoke API/Socket.IO qua đăng ký, tạo quiz/phòng, join, trả lời/chặn trùng, kết thúc và quyền kết quả ẩn. 20 yêu cầu join đồng thời chỉ nhận đủ 2 ghế; rejoin khi đầy và từ chối join sau khi kết thúc hoạt động đúng.
- Tái hiện hai host socket phát trùng `game:started`; thêm Redis lock cho thao tác host và payload `index`/`phase` cho `game:next`. Thử lại hai host đồng thời cho start/next/end, mỗi chuyển trạng thái chỉ phát một lần.
- Xác minh: backend lint/build/test và frontend lint/build; chưa thử nhiều backend instance, timer cạnh tranh với host, restart/recovery hoặc S3.

## 2026-11-01 23:05:14 GMT+7

### Kết quả phòng đã đóng trên frontend

- Dùng trạng thái phòng từ REST khi mở lại kết quả; không kết nối Socket.IO cho phòng đã kết thúc. Host vẫn được backend kiểm tra quyền qua host-token.
- Người chơi trong phòng ẩn bảng xếp hạng không gọi endpoint results bị từ chối 403 và không thấy lỗi giả.
- Xác minh: 2 test hồi quy useFinalResults, frontend lint/build. Toàn bộ Vitest: 209/215 qua, 6 test cũ ở GameResultsView/envelope/useGameSocket còn thất bại. Không chạy được Docker integration vì daemon không hoạt động và không có quyền khởi động dịch vụ.

## 2026-11-01 22:49:44 GMT+7

### Định dạng nhập bảng tính

- Chỉ cho chọn `.xlsx` trong giao diện; `.xls` nhận lỗi hướng dẫn chuyển sang `.xlsx` hoặc `.csv`, vì bộ đọc mới chỉ hỗ trợ XLSX.
- Xác minh: frontend lint/build; chưa thử bằng trình duyệt thực.

## 2026-11-01 22:48:46 GMT+7

### Dependency production

- Cập nhật backend Express, Nodemailer, Socket.IO, Zod và dependency gián tiếp; gỡ Joi không dùng.
- Cập nhật frontend Axios, Vue, Socket.IO client và các dependency gián tiếp; thay SheetJS `xlsx` bằng `read-excel-file` và `write-excel-file` cho nhập/xuất mẫu XLSX.
- Xác minh: backend lint/build và 41/41 test qua; frontend lint/build qua, vòng đọc/ghi XLSX mẫu qua; `pnpm audit --prod` báo 0 advisory ở cả hai gói.
- Giới hạn: frontend Vitest còn 6 test thất bại ở GameResultsView, envelope và useGameSocket do fixture/contract cũ; chưa kiểm thử XLSX trên trình duyệt thực hoặc các dịch vụ tích hợp.

## 2026-11-01 22:43:26 GMT+7

### Đợt 5: một phần vận hành và bảo mật

- Bổ sung lọc continue-playing, projection session công khai, giới hạn Socket.IO, kiểm tra Origin cho cookie mutation, request ID/log JSON, env validation và HTTP headers/timeout.
- Dùng cache generation trong PostgreSQL để invalidation home/feed sau quiz CRUD; dọn answer keys marathon; scoring job có advisory lock; bỏ index refresh token trùng.
- Chạy backend image bằng user không có quyền root và bind DB/Redis vào loopback trong Compose.
- Xác minh: backend lint/build và 41/41 test, `docker compose config --quiet`; quét `pnpm audit --prod` phát hiện backend 1 critical/8 high/16 moderate/2 low, frontend 15 high/5 moderate. Chưa sửa dependency trong phần này.
- Giới hạn: không đo p50/p95, EXPLAIN, CPU/RAM, backup restore hoặc test nhiều instance vì Docker daemon/PostgreSQL/Redis không có trong môi trường; chi tiết ở `backend/docs/MYQUIZZ_BACKEND_AUDIT_PROGRESS.md`.

## 2026-11-01 22:35:48 GMT+7

### Đợt 4: dữ liệu quiz, upload và khởi động

- Gộp tạo/cập nhật quiz và câu hỏi trong transaction; xóa quiz bằng `deleted_at` để giữ snapshot, room và lịch sử trận.
- Ràng buộc đáp án theo loại câu hỏi và option ID, kiểm tra ngày lịch thật, mở rộng mô tả quiz lên 500 ký tự bằng migration `015`.
- Yêu cầu kích thước upload nguyên và kiểm tra URL/object ảnh quiz/câu hỏi thuộc người dùng trước khi gắn; giữ URL ảnh cũ khi sửa quiz để tương thích dữ liệu có sẵn.
- Kết nối DB tường minh lúc bootstrap, thêm liveness/readiness và đóng HTTP/Socket.IO/DB/Redis khi có tín hiệu dừng.
- Xác minh: backend lint/build và 38/38 test; frontend lint/build. Chưa chạy migration, API hoặc S3 trên dịch vụ thật vì Docker daemon không sẵn có. HEAD metadata không phát hiện nội dung ảnh giả mạo nếu object storage tin Content-Type do client khai báo.

## 2026-11-01 22:21:33 GMT+7

### Đợt 3: một phần độ tin cậy game

- Join kiểm tra trạng thái và sức chứa trong transaction khóa room, cho phép rejoin seat cũ kể cả khi phòng đầy; thêm unique partial indexes cho user/guest seat.
- Tránh đọc hash Redis chưa được rehydrate sau restart; answer và timeout cùng claim một slot Redis bằng Lua, gắn `index` vào payload để chặn câu trả lời sớm/cũ.
- Rời room xóa cả membership host/player và tránh đánh dấu mất kết nối khi seat còn socket khác; hủy toàn bộ self timeout khi game kết thúc; Redis lỗi ở answer/clock trả `SERVICE_UNAVAILABLE`.
- Xác minh: backend 34/34 test, lint/build; frontend lint/build. Chưa chạy PostgreSQL/Redis/Socket.IO tích hợp vì Docker daemon không sẵn có.
- Chưa xử lý bền vững timer/recovery sau restart (B16), CAS cho host transition (B17) và toàn bộ đường ghi game khi Redis lỗi (B20). Migration `014` cần rà soát seat trùng trước khi áp dụng lên DB có dữ liệu.

## 2026-11-01 22:15:49 GMT+7

### Đợt 2: phiên và tài khoản

- Thêm `jti` cho JWT, xoay refresh token trong transaction với token family và thời gian đệm 10 giây cho request đồng thời; tăng `session_version` khi đổi/reset mật khẩu để thu hồi access và socket token cũ.
- Claim proof và ticket reset bằng Redis theo thao tác nguyên tử, có khôi phục ticket trong TTL còn lại nếu ghi PostgreSQL lỗi; phản hồi forgot-password không xác nhận email có tồn tại.
- Dùng cache projection tối thiểu cho profile công khai, invalidation khi admin khóa/mở tài khoản, ngắt socket trong process khi tài khoản bị khóa hoặc đổi mật khẩu.
- Giới hạn auth bằng bộ đếm dự phòng trong RAM khi Redis lỗi, tăng Redis counter và TTL bằng Lua, giới hạn refresh/Google; dọn token hết hạn định kỳ và thêm migration `012`–`013`.
- Gộp test mới vào `pnpm test`; xác minh backend build, lint và 32/32 test. Chưa chạy test tích hợp PostgreSQL/Redis vì Docker daemon không sẵn có; chính sách socket disconnect hiện chỉ áp dụng trong một process.

## 2026-11-01 22:05:54 GMT+7

### Đợt 1: quyền truy cập và dữ liệu công khai

- Sửa thời hạn JWT socket, giới hạn tạo phòng từ quiz riêng tư, lọc trường player trả bởi lobby và chặn đọc kết quả trước khi trận kết thúc hoặc khi bảng xếp hạng bị ẩn.
- Kiểm tra URL và object avatar thuộc tài khoản trước khi gắn vào profile; cập nhật DB trước khi dọn ảnh cũ; tránh xóa avatar đang dùng khi gửi lại cùng URL.
- Bỏ token review khỏi query, chuyển kiểm tra reset ticket sang POST body, tránh ghi query chứa secret vào error log; cập nhật frontend và tài liệu API.
- Xác minh: 7/7 backend regression tests, backend lint/build, frontend lint/build. Frontend full test: 208/213 đạt; 5 lỗi hiện hữu ở GameResultsView, useGameSocket, envelope không liên quan thay đổi API ticket. Node 26 cần `--no-experimental-webstorage` cho Vitest; production dùng Node 22.
- Giới hạn: chưa chạy test tích hợp với PostgreSQL, Redis, S3 hoặc Android; token socket đã cấp trước bản sửa vẫn còn hạn theo giá trị cũ đến khi secret được xoay vòng.

## 2026-11-01 21:33:53 GMT+7

### Rà soát backend

- Chuyển bản rà soát backend 59 mục vào `backend/docs/MYQUIZZ_BACKEND_AUDIT.md` và liên kết từ chỉ mục tài liệu.
- Lưu harness tái hiện 12 tình huống và kết quả vào `backend/docs`; chỉnh đường dẫn để chạy từ checkout hiện tại.
- Xác minh: 59 hàng phát hiện/cải thiện, 12/12 tình huống tái hiện, kiểm tra liên kết và `git diff --check`. Không sửa mã ứng dụng hoặc chạy lại lint/build vì đây là phần chuyển tài liệu; lint/TypeScript/unit test đã chạy khi lập báo cáo.
- Giới hạn: các mục cần PostgreSQL, Redis, Socket.IO và đo tải thực tế chưa được xác nhận bằng test tích hợp.

## 2026-11-01 21:02:56 GMT+7

### Tài liệu và quy trình

- Tạo backend/docs: chỉ mục ngữ cảnh, kiến trúc/hiện trạng, hướng dẫn phát triển/kiểm thử và kế hoạch bảo mật/hiệu năng backend.
- Tạo frontend/docs: hiện trạng web và kế hoạch tương ứng; ghi nhận single-flight refresh đã có.
- Tạo kế hoạch Android riêng tại backend/docs/android-plan.local.md; thêm Git ignore để không commit nội dung này.
- Bổ sung AGENTS.md: đọc tài liệu khi cần; tách nhánh từng phần; ưu tiên test; tự commit sau kiểm tra đạt; commit tiếng Anh theo Conventional Commits; không push; báo bước thủ công khi kết thúc.
- Nhánh: docs/project-context-and-workflow. Không thay đổi mã ứng dụng hoặc triển khai các mục kế hoạch.
- Xác minh: kiểm tra liên kết Markdown local, file bắt buộc, timestamp GMT+7, Git ignore Android và git diff --check trước commit. Không chạy test ứng dụng vì chỉ thay đổi tài liệu/quy trình.
