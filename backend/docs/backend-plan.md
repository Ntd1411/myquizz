# Kế hoạch backend: bảo mật và hiệu năng

Trạng thái ban đầu: toàn bộ mục dưới đây là đề xuất, chưa triển khai. Mỗi hàng là một phần độc lập với nhánh gợi ý; tạo nhánh khi bắt đầu phần đó, không tạo hàng loạt nhánh trống.

| Ưu tiên | Nhánh gợi ý | Công việc | Nghiệm thu |
| --- | --- | --- | --- |
| P0 | `fix/socket-token-expiry` | Sửa đơn vị TTL JWT socket; kiểm tra cấu hình thời hạn. | `exp - iat` đúng số giây; token quá hạn bị từ chối. |
| P1 | `fix/refresh-session-rotation` | Thêm jti, rotation nguyên tử; thiết kế token family/replay và xử lý request đồng thời. | Hai request dùng token cũ không sinh hai nhánh phiên hợp lệ; login cùng giây không trùng token; lỗi DB không làm hỏng phiên ngoài chính sách. |
| P1 | `fix/password-reset-consumption` | Nhận quyền dùng ticket nguyên tử; xử lý lỗi giữa Redis và PostgreSQL; xác định thu hồi access token. | Ticket chỉ thực hiện một lần; hai request cạnh tranh không đổi mật khẩu hai lần; có đường phục hồi lỗi được test. |
| P1 | `feat/auth-rate-limit-fallback` | Chính sách hạn chế login/reset khi Redis lỗi; bộ đếm nguyên tử và TTL. | Không mở vô hạn luồng nhạy cảm; cache nội dung vẫn suy giảm có kiểm soát. |
| P1 | `feat/socket-abuse-protection` | Giới hạn sự kiện theo player/room, payload và số kết nối; test phân quyền host/player và lộ đáp án. | Spam bị chặn; không ảnh hưởng chơi bình thường; player không nhận dữ liệu host trước hạn. |
| P2 | `perf/quiz-query-benchmarks` | Baseline API/cache lạnh-ấm; EXPLAIN ANALYZE cho search/list/history; index khi có bằng chứng. | Báo cáo p50/p95, query plan và tài nguyên với cùng dữ liệu; quyền truy cập giữ đúng. |
| P2 | `perf/realtime-broadcasts` | Đo và giảm broadcast/bảng xếp hạng dư thừa; đánh giá state/timer khi nhiều instance. | Đo payload, ACK p95, CPU; điểm và state nhất quán sau reconnect. |

## Hai học phần

- An toàn và bảo mật: mô hình đe dọa, ma trận kiểm thử, demo lỗi đã sửa, regression test và rủi ro còn lại.
- Tối ưu: baseline trước/sau, tải xác định, cache hit, p50/p95 và chi phí bảo mật; không đánh đổi phân quyền để giảm độ trễ.

## Phụ thuộc và cập nhật

Đồng bộ mã lỗi, cookie, TTL, event và quy tắc retry với Android/frontend trước khi đổi contract. Không tự triển khai kế hoạch chỉ vì đọc tài liệu này. Khi được giao một phần: sửa mã, chạy kiểm tra phù hợp, cập nhật tài liệu/changelog rồi commit riêng bằng tiếng Anh; không push.
