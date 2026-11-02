# Changelog

Thời gian ghi theo GMT+7 (UTC+07:00). Ghi công việc thực tế đã hoàn thành; kế hoạch chưa triển khai nằm trong tài liệu riêng.

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
