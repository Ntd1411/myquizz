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

- `socket.middleware.ts`: `ms(...)` trả mili giây nhưng `expiresIn` dạng số nhận giây; cần sửa và test thời hạn.
- Refresh đang đọc/xóa/tạo phiên bằng nhiều truy vấn; cần xử lý cạnh tranh và thêm định danh JWT duy nhất.
- Ticket reset đọc trước, cập nhật mật khẩu rồi mới xóa: cần đảm bảo một lần sử dụng khi request đồng thời.
- Rate limiter HTTP cho qua khi Redis lỗi; cần chính sách riêng cho login/reset. Không thay thế rate limit sự kiện socket.
- Reset thu hồi refresh session nhưng access token đã cấp vẫn có thể sống tới hạn; quyết định rõ yêu cầu thu hồi tức thời.
- Trigram index tìm kiếm trong migration 007 đang được comment; chỉ bật sau đo truy vấn và kiểm tra quyền extension.

Xem [kế hoạch](backend-plan.md) để triển khai theo từng nhánh, không coi danh sách này là kết quả pentest.
