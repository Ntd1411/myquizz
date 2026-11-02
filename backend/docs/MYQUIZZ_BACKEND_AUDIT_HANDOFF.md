# Bàn giao triển khai và hướng dẫn kiểm tra audit backend

Cập nhật: 2026-11-02 (GMT+7).

Tài liệu này trả lời hai câu hỏi:

1. Những phần nào đã được thay đổi trong năm đợt audit backend.
2. Chủ dự án cần kiểm tra gì để chấp nhận thay đổi trước khi triển khai.

Đây là tài liệu kiểm thử chấp nhận, không thay thế [bản audit gốc](MYQUIZZ_BACKEND_AUDIT.md),
[bảng tiến độ](MYQUIZZ_BACKEND_AUDIT_PROGRESS.md) hoặc
[baseline hiệu năng](MYQUIZZ_BACKEND_AUDIT_BENCHMARK.md).

## 1. Trạng thái bàn giao

- Toàn bộ thay đổi đã được fast-forward vào nhánh local `main` và commit theo từng phần.
- Backend đã qua lint, build và 53/53 test tự động.
- Docker integration đã qua luồng tạo tài khoản, tạo quiz, tạo/join phòng, trả lời qua
  Socket.IO, kết thúc trận và đọc lịch sử.
- Frontend đã qua lint/build và dùng contract mới của backend.
- PostgreSQL migration đến `020_quiz_cache_invalidation.sql` đã chạy trong Docker.
- Readiness hiện kiểm tra PostgreSQL, Redis và khả năng phục hồi realtime.
- Không có commit nào chứa `backend/docs/android-plan.local.md` hoặc credential trong `.env`.

Docker local không thể thay thế việc kiểm tra Google OAuth, email, S3, HTTPS/reverse proxy,
dữ liệu production và hệ thống monitoring thật. Các phần đó được tách riêng ở mục 9.

## 2. Chuẩn bị môi trường kiểm tra

Chỉ chạy các lệnh package trong đúng thư mục package.

```bash
cd /d/Coding/myquizz
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:3000/health/ready
```

Kết quả mong đợi:

- Bốn service `backend`, `frontend`, `postgres`, `redis` đều chạy; backend, PostgreSQL và
  Redis báo healthy.
- Readiness trả về `{"db":true,"redis":true,"realtime":true}`.
- Frontend mở được tại `http://localhost:5173`.

Nên dùng hai cửa sổ ẩn danh hoặc hai browser profile:

- Browser A: host có tài khoản.
- Browser B: guest/player; có thể mở thêm Browser C để thử cạnh tranh và rejoin.

Không chạy `docker compose down -v`, `FLUSHALL` hoặc reset database nếu volume đang chứa
dữ liệu cần giữ. Các bài phá Redis/restart bên dưới chỉ dành cho stack local dùng làm test.

## 3. Smoke test ưu tiên trước khi deploy

Nếu chỉ có 30–45 phút, thực hiện lần lượt các bài sau.

### S01 — Tạo quiz và kiểm tra cache public/private

1. Đăng nhập ở Browser A và tạo một quiz public có ít nhất hai câu.
2. Mở Home/Discover ở Browser B và xác nhận quiz xuất hiện.
3. Sửa tên quiz; tải lại Home/Discover và xác nhận tên mới xuất hiện.
4. Chuyển quiz sang private; tải lại Home/Discover.
5. Mở URL chi tiết quiz bằng Browser B.

Kết quả mong đợi:

- Dữ liệu mới xuất hiện sau reload, không phải chờ TTL cache năm phút.
- Sau khi chuyển private, quiz biến mất khỏi danh sách công khai.
- Người không phải chủ sở hữu nhận 404 khi mở quiz private.

### S02 — Chơi trọn một trận bằng hai browser

1. Browser A tạo phòng từ quiz vừa tạo và giữ trang host.
2. Browser B nhập mã phòng dưới dạng guest.
3. Host bắt đầu; player trả lời từng câu.
4. Thử bấm trả lời hai lần thật nhanh ở một câu.
5. Kết thúc trận và mở leaderboard/lịch sử.

Kết quả mong đợi:

- Guest chỉ chiếm một seat và mỗi câu chỉ được chấm một lần.
- ACK trả lời không làm lộ đáp án của player khác.
- Điểm, streak, leaderboard và kết quả cá nhân nhất quán.
- Guest xem được lịch sử bằng signed guest token; chỉ UUID guest thô không đủ quyền.

### S03 — Rejoin, pause và restart backend

1. Tạo phòng giới hạn số người nhỏ và lấp đầy phòng.
2. Đóng Browser B, sau đó mở lại bằng cùng browser profile và rejoin.
3. Bắt đầu trận, pause giữa một câu.
4. Chạy `docker compose restart backend` tại thư mục gốc.
5. Chờ backend healthy, tải lại hai browser rồi resume.

Kết quả mong đợi:

- Player cũ rejoin được dù phòng đã đầy; player mới bị từ chối.
- Phòng vẫn ở trạng thái pause sau restart và giữ thời gian còn lại.
- Resume không phát trùng câu hoặc cộng điểm hai lần.

### S04 — Quyền xem kết quả

Lặp một phòng với từng cấu hình leaderboard hỗ trợ bởi UI.

Kết quả mong đợi:

- Player không đọc được kết quả cuối trước khi trận kết thúc.
- Cấu hình `never` chỉ cho host xem leaderboard.
- Player vẫn xem được kết quả cá nhân của chính mình.
- Không thể dùng token của phòng khác để đọc review/kết quả.

### S05 — Đổi mật khẩu và thu hồi phiên

1. Đăng nhập cùng tài khoản ở Browser A và Browser B.
2. Đổi mật khẩu ở Browser A.
3. Từ Browser B gọi một trang cần đăng nhập hoặc tải lại ứng dụng.
4. Thử đăng nhập bằng mật khẩu cũ và mật khẩu mới.

Kết quả mong đợi:

- Access/refresh session cũ bị từ chối sau khi version phiên thay đổi.
- Mật khẩu cũ không đăng nhập được; mật khẩu mới đăng nhập được.
- Socket cũ của tài khoản không tiếp tục có quyền sau khi phiên bị thu hồi.

## 4. Đợt 1 — Quyền truy cập và dữ liệu công khai

### Những gì đã thay đổi

- Sửa TTL socket token để `1h` thực sự hết hạn sau một giờ.
- Public lobby dùng DTO rõ ràng, không trả guest UUID, đáp án hoặc state nội bộ.
- Chỉ chủ quiz hoặc quiz public mới được dùng để tạo phòng.
- Kết quả/leaderboard kiểm tra trạng thái trận, cấu hình hiển thị và vai trò người xem.
- Avatar chỉ chấp nhận object thuộc đúng prefix của user; DB được cập nhật trước khi xóa ảnh cũ.
- Review token chỉ nhận qua header; reset ticket chuyển khỏi query string.
- Error log không ghi query chứa token/ticket.

### Kiểm tra chấp nhận

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| P1-01 | Người B thử tạo phòng bằng ID quiz private của người A | 404/403, không tạo snapshot hoặc room |
| P1-02 | Mở `GET /games/:code` trước và sau khi Redis đã được warm | Hai response cùng public shape, không có `player_guest_id`/`answered_questions` |
| P1-03 | Player gọi results trước khi finished | Bị từ chối |
| P1-04 | Phòng cấu hình leaderboard `never`; player và host cùng gọi endpoint | Player bị từ chối, host được phép |
| P1-05 | Upload lại đúng URL avatar đang dùng | Thành công idempotent, object không bị xóa |
| P1-06 | Gửi URL object của user khác hoặc hostname giả khi đổi avatar | Bị từ chối, avatar cũ còn nguyên |
| P1-07 | Gây request lỗi có query chứa token giả rồi xem log | Log chỉ có path đã loại query |

P1-05 và P1-06 cần object storage thật để xác nhận cả hành vi vật lý của object. Unit test đã
kiểm tra thứ tự DB/delete và các trường hợp URL ownership.

## 5. Đợt 2 — Phiên đăng nhập và tài khoản

### Những gì đã thay đổi

- JWT có `jti` ngẫu nhiên nên hai lần login cùng giây vẫn sinh token khác nhau.
- Refresh token được consume/rotate trong transaction và có token family.
- `session_version` thu hồi access/socket token sau đổi hoặc reset mật khẩu.
- Reset proof/ticket được claim nguyên tử; ticket được phục hồi nếu ghi DB thất bại.
- Forgot-password trả cùng response cho email có hoặc không tồn tại.
- Profile cache chỉ giữ projection cần thiết và được invalidation khi ban/restore.
- Auth rate limiter có fallback local khi Redis mất kết nối.
- Token hết hạn có expiry/index và job dọn định kỳ.

### Kiểm tra chấp nhận

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| P2-01 | Gửi hai login gần như đồng thời | Cả hai thành công và refresh token khác nhau |
| P2-02 | Gửi hai request refresh đồng thời với cùng token | Chỉ một rotation thắng; không tạo hai session hợp lệ |
| P2-03 | Dùng access token cũ sau đổi/reset password | Bị từ chối do session version cũ |
| P2-04 | Gửi hai request claim cùng reset proof/ticket | Chỉ một request được quyền tiếp tục |
| P2-05 | Forgot password với email thật và email không tồn tại | HTTP status và response body công khai giống nhau |
| P2-06 | Admin ban user đang mở socket | Profile cache bị xóa và socket mất quyền |
| P2-07 | Dừng Redis rồi spam login/refresh quá giới hạn | Limiter local vẫn trả 429, không fail-open |

Không kiểm tra nội dung email bằng log production. Dùng mailbox test hoặc mail provider staging.

## 6. Đợt 3 — Độ tin cậy của game realtime

### Những gì đã thay đổi

- Join/rejoin chạy trong transaction khóa room; partial unique index ngăn seat trùng.
- Rejoin được xét trước giới hạn `maxPlayers`; room finished/cancelled không nhận player.
- Redis được rehydrate từ PostgreSQL sau restart; quyết định sức chứa không dùng hash thiếu dữ liệu.
- Payload answer có question index; server từ chối answer sớm/cũ.
- Claim answer, cập nhật player snapshot và leaderboard là một Lua transaction.
- Player progress, phase, deadline, pause remaining và self-paced clock được checkpoint DB.
- Host action/timer dùng Redis lock và kiểm tra lại phase/index/deadline.
- Leave xử lý room host/player và nhiều socket của cùng seat.
- End game hủy self-timeout; game write fail-closed khi Redis không bảo đảm state.
- Socket.IO Redis adapter chia sẻ room/event giữa nhiều backend process.

### Kiểm tra chấp nhận

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| P3-01 | 20 client join đồng thời vào room `maxPlayers=2` | Chỉ đủ hai seat, không có seat trùng |
| P3-02 | Player cũ rejoin room đã đầy | Rejoin thành công; player mới bị từ chối |
| P3-03 | Join room finished với `allowLateJoin=true` | Bị từ chối |
| P3-04 | Hai host bấm start/next/end cùng lúc | Chỉ một transition/event hợp lệ |
| P3-05 | Gửi hai answer cùng câu hoặc answer sát timeout | Chỉ một claim; DB, Redis và điểm khớp nhau |
| P3-06 | Gửi answer mang index câu trước/câu sau | Bị từ chối, không đổi điểm |
| P3-07 | Pause, restart backend, resume | Giữ phase và remaining time |
| P3-08 | Restart backend giữa classic question | Recovery đóng/chuyển câu đúng deadline |
| P3-09 | Restart backend giữa solo/self-paced | Giữ clock và current question của player |
| P3-10 | End game trước self-timeout | Timeout cũ không ghi đè kết quả sau khi finished |
| P3-11 | Một seat mở hai socket, đóng một socket | Seat chưa bị đánh disconnected nếu socket còn lại sống |

#### Bài mất Redis trên stack local disposable

```bash
cd /d/Coding/myquizz
docker compose stop redis
# Thử submit answer hoặc join: phải nhận SERVICE_UNAVAILABLE nhanh, không treo.
docker compose start redis
# Chờ Redis healthy rồi kiểm tra readiness và rejoin.
curl -fsS http://localhost:3000/health/ready
```

Để thử mất toàn bộ hot state, chỉ trên dữ liệu test:

```bash
docker compose exec redis redis-cli FLUSHALL
docker compose restart backend
```

Sau restart, classic, paused classic và solo phải được dựng lại từ checkpoint PostgreSQL.

## 7. Đợt 4 — Quiz, upload, validation và bootstrap

### Những gì đã thay đổi

- Create/update quiz và questions nằm trong một transaction.
- Insert/replace questions dùng batch SQL; soft delete quiz giữ snapshot và lịch sử.
- Schema phân biệt multiple choice/select và typed answer; kiểm tra option ID và duplicate.
- Quiz description DB/API cùng giới hạn 500 ký tự; date query kiểm tra ngày lịch thật.
- Malformed JSON trả 400 thay vì 500.
- Upload size phải là integer; URL/key phải thuộc đúng owner.
- Backend HEAD object rồi đọc 16 byte đầu để đối chiếu magic bytes JPEG/PNG/GIF/WebP.
- Migration có advisory lock/transaction và bootstrap DB tường minh.
- Liveness/readiness và graceful shutdown được tách rõ.

### Kiểm tra chấp nhận

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| P4-01 | Tạo quiz nhưng một question cố ý không hợp lệ | Request 400; không có quiz/questions dở dang |
| P4-02 | Cập nhật metadata + questions rồi gây lỗi question | Toàn bộ update rollback |
| P4-03 | Xóa quiz đã có match history | Quiz biến mất khỏi listing, history/snapshot vẫn đọc được |
| P4-04 | Gửi correct option ngoài mảng, duplicate hoặc choice thiếu options | Validation 400 |
| P4-05 | Gửi ngày `2026-99-99`, `2025-02-29`, `2024-02-29` | Hai ngày đầu bị từ chối; ngày nhuận 2024 hợp lệ |
| P4-06 | Gửi JSON bị cắt/sai cú pháp | 400 `VALIDATION_ERROR`, không phải 500 |
| P4-07 | Upload script/text nhưng khai MIME `image/png`, rồi gắn vào quiz | Bị từ chối vì magic bytes không khớp |
| P4-08 | Restart hai backend cùng lúc trên DB đã migrate | Migration không chạy cạnh tranh; cả hai boot hoặc fail rõ ràng |

P4-07 bắt buộc chạy lại với provider S3 tương thích đang dùng ở staging. Local unit test đã bao
phủ magic bytes nhưng không chứng minh behavior HEAD/Range của provider thật.

## 8. Đợt 5 — Hiệu năng, cache và vận hành

### Những gì đã thay đổi

- Backend test và Docker API/Socket.IO smoke trở thành CI gate.
- Public DTO/projection được tách khỏi database row nội bộ.
- PostgreSQL là recovery checkpoint; Redis là hot state, lock và pub/sub adapter.
- Guest history dùng token ký thay vì UUID làm bearer credential.
- Cache generation invalidation ở DB cho create/delete, nội dung, public/private, featured,
  play count và scoring; question-only batch invalidation đúng một lần.
- Question count trigger chuyển từ đếm lại toàn bộ sang cộng/trừ nguyên tử.
- Continue-playing lọc room/player đã đóng.
- Socket event/payload/connections có limit; request có request ID và structured log.
- Env validation, security headers, JSON limit và server timeout được bổ sung.
- Backend container chạy non-root; PostgreSQL/Redis chỉ bind loopback trong Compose.
- Scoring có advisory lock; answer keys marathon được dọn theo set.
- Dependency production audit về 0 advisory tại thời điểm bàn giao.
- PostgreSQL dump/restore sang DB tạm đã được kiểm tra.

### Kiểm tra chấp nhận

| ID | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| P5-01 | Sửa public/private/featured trực tiếp hoặc qua API | `quiz_cache_generation` tăng và listing mới được dùng |
| P5-02 | Chạy scoring khi có score thay đổi | Generation tăng đúng một lần cho cả batch scoring |
| P5-03 | Import/replace quiz 500 questions trên staging | Không timeout; tốc độ không tệ hơn baseline local |
| P5-04 | Gửi Socket.IO payload quá lớn/spam event/connection | Bị giới hạn; ACK bình thường vẫn đáp ứng được |
| P5-05 | Boot với secret rỗng, port/TTL sai | Fail trước khi listen và không log giá trị secret |
| P5-06 | Kiểm tra user trong backend container | Không chạy bằng root |
| P5-07 | Chạy backup rồi restore vào DB staging mới | Migration/count quan trọng khớp, ứng dụng boot được |

Baseline local đã ghi nhận:

- Batch 500 questions: tổng 75,649 ms xuống 29,436 ms.
- Trigger time: 65,590 ms xuống 19,166 ms.
- Recovery query trên 10.028 room: 1,819 ms.
- Readiness 500 request/concurrency 25: p50 17,87 ms; p95 29,91 ms.

Không dùng các số local này làm SLA production; cần lặp trên cấu hình và dữ liệu đại diện.

## 9. Frontend đã thay đổi và cách kiểm tra

Frontend đã được điều chỉnh để đáp ứng các contract backend liên quan:

- Answer gửi kèm `index` của câu hỏi.
- Màn kết quả tuân theo trạng thái room và quyền leaderboard.
- Guest lưu signed history token trong localStorage và gửi `x-guest-token` cho history,
  summary và my-answers.
- Reset ticket không còn phụ thuộc query string ở API nhạy cảm.
- Compose build đúng API base `/v1`.
- Import spreadsheet dùng XLSX/CSV theo thư viện hiện tại; `.xls` cũ có hướng dẫn chuyển đổi.

Kiểm tra bằng DevTools Network/Application:

1. Guest join và xác nhận response có `guestToken`.
2. Xác nhận localStorage giữ token theo room nhưng UI không hiển thị token.
3. History request gửi `x-guest-token`; không gửi UUID thô làm quyền lịch sử.
4. `question:answer` có `index` đúng current question.
5. Khi leaderboard bị ẩn, frontend không gọi endpoint trái quyền rồi hiện lỗi giả.
6. Mở lại trang kết quả room finished: frontend dùng REST state, không phụ thuộc socket sống.

Lệnh kiểm tra frontend:

```bash
cd /d/Coding/myquizz/frontend
pnpm lint
pnpm build
NODE_OPTIONS=--no-experimental-webstorage pnpm vitest run tests/composables/useFinalResults.spec.js
```

Full Vitest local hiện có 209/215 test qua. Sáu lỗi còn lại nằm trong các test bị
`frontend/.gitignore` bỏ qua và đang mô tả contract cũ: answer không có index, API review cũ,
tin trực tiếp error prose từ backend và import store đã bị xóa. Không nên sửa ngược source mới
để làm các expectation cũ này qua; nếu muốn đưa toàn bộ suite thành CI gate, cần đưa test vào
Git và cập nhật chúng theo contract hiện hành.

## 10. Kiểm tra bắt buộc trên staging hoặc dịch vụ thật

| Hạng mục | Vì sao Docker local chưa đủ | Cần xác nhận |
| --- | --- | --- |
| S3/object storage | Local dùng cấu hình placeholder | HEAD/Range, MIME signature, ownership, delete avatar cũ và CORS upload |
| Google OAuth | Phụ thuộc redirect URI/provider | Login, callback lỗi, account linking và domain production |
| Email | Phụ thuộc SMTP/provider | Forgot/reset mail, expiry, retry và không lộ account existence |
| HTTPS/reverse proxy | Thay đổi Origin/IP/cookie/WebSocket | CORS, SameSite, secure cookie, client IP, timeout và WebSocket upgrade |
| Nhiều backend instance | Polling cần routing ổn định | Redis adapter, sticky session nếu bật polling và không phát event trùng |
| Dữ liệu production | Có thể có seat trùng/dữ liệu cũ | Preflight trước migration `014`, thời gian migrate và query plan |
| Monitoring | Repository chỉ có structured log/readiness | Thu log tập trung, alert DB/Redis/mail/room recovery và retention |
| Rollback | Migration forward đã test local | Backup, deploy, rollback app và restore trên staging |

## 11. Lệnh xác minh tự động

Backend:

```bash
cd /d/Coding/myquizz/backend
pnpm lint
pnpm test
pnpm build
MYQUIZZ_INTEGRATION_DISPOSABLE=1 pnpm test:integration
```

`test:integration` tạo dữ liệu trong database đang cấu hình. Chỉ đặt
`MYQUIZZ_INTEGRATION_DISPOSABLE=1` khi database đó thực sự là dữ liệu test.

Compose:

```bash
cd /d/Coding/myquizz
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:3000/health/live
curl -fsS http://localhost:3000/health/ready
```

Trước khi đẩy code:

```bash
cd /d/Coding/myquizz
git status
git log --oneline origin/main..main
```

Chỉ push sau khi đã xem danh sách commit và chọn đúng remote/branch theo quy trình của dự án.

## 12. Mẫu ghi kết quả kiểm thử

Khi test thủ công, ghi tối thiểu:

```text
Môi trường/commit:
Thời gian:
Test case ID:
Tài khoản/room test (không ghi token hoặc mật khẩu):
Các bước đã làm:
Kết quả thực tế:
Kết quả mong đợi:
Pass/Fail:
Ảnh/video/log request ID:
```

Ưu tiên xử lý mọi lỗi liên quan quyền truy cập, mất dữ liệu, điểm sai, room treo hoặc migration
trước khi deploy. Lỗi chỉ xảy ra với dịch vụ thật cần giữ request ID và timestamp, không chép
credential/token vào issue hoặc log chia sẻ.
