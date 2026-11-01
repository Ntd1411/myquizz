# Kiến trúc và hiện trạng backend

## Thành phần

- Node.js 22 theo CI, TypeScript ESM, Express 5; HTTP API dưới `/v1`, Socket.IO namespace `/game`.
- `src/modules/{auth,user,quiz,game,storage,admin}` theo route → controller → service → repository; schema xác thực đầu vào.
- PostgreSQL: dữ liệu người dùng, quiz, snapshot và phiên chơi; SQL trong `src/infrastructure/database/{schema,migrations,seeds}`.
- Redis: cache, giới hạn request, dữ liệu reset mật khẩu và trạng thái realtime. Cache nội dung lỗi có thể về DB; không suy ra toàn bộ game/reset vẫn hoạt động khi Redis lỗi.
- Object storage tương thích S3: presigned upload; SMTP: email; Google: đăng nhập.
- `src/docs/` là mã sinh/phục vụ OpenAPI và AsyncAPI; khác với thư mục Markdown `backend/docs/` này.

## Luồng quan trọng

- HTTP nhận cookie → kiểm tra blacklist/JWT/tài khoản → validation và nghiệp vụ → SQL có tham số.
- Mật khẩu dùng bcrypt cost 10; refresh token lưu hash, được thay khi refresh; cookie production có Secure, HttpOnly và SameSite=Lax.
- Socket handshake dùng JWT riêng gắn game/vai trò/player; server chấm điểm và đo thời gian. Đáp án đúng tách khỏi câu hỏi player; thông tin host gửi vào room riêng.
- Home/feed có cache TTL mặc định 300 giây, key phân biệt người dùng; listing dùng keyset và index; lịch sử có index riêng.

## Điểm cần xác minh và hoàn thiện

- `socket.middleware.ts`: TTL socket hiện đổi sang giây và có regression test; các token phát hành trước bản sửa cần xoay secret nếu phải thu hồi ngay.
- Refresh dùng transaction với token family; JWT có `jti`, access token gắn `session_version`. Cần test tranh chấp trên PostgreSQL thật.
- Vé reset được claim bằng Redis trước khi ghi mật khẩu; lỗi DB sẽ khôi phục vé trong TTL còn lại. Cần test lỗi hai kho dữ liệu thật.
- Auth có giới hạn trong bộ nhớ khi Redis lỗi; các route khác còn chính sách fail-open. Không thay thế rate limit sự kiện socket.
- Đổi/reset mật khẩu tăng `session_version`, thu hồi refresh và ngắt socket trong process. Cần kiểm tra nhiều instance và token cũ khi rollout.
- Trigram index tìm kiếm trong migration 007 đang được comment; chỉ bật sau đo truy vấn và kiểm tra quyền extension.

Xem [kế hoạch](backend-plan.md) để triển khai theo từng nhánh, không coi danh sách này là kết quả pentest.
