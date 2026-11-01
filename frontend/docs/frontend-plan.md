# Kế hoạch frontend tương ứng

Các mục đều chưa triển khai. Mỗi phần dùng nhánh riêng, kiểm tra trước khi commit; không push.

| Nhánh gợi ý | Công việc | Kiểm tra |
| --- | --- | --- |
| `fix/web-session-error-handling` | Giữ single-flight refresh hiện có; phân biệt mất mạng/5xx với phiên bị thu hồi, tránh phát hết phiên sai. Đồng bộ rotation backend. | Nhiều 401 chỉ một refresh; lỗi tạm thời không xóa phiên; refresh invalid kết thúc phiên; không retry vòng lặp. |
| `fix/web-private-cache-lifecycle` | Rà soát query cache/Pinia khi logout, đổi tài khoản; không hiện dữ liệu riêng cũ. | A → logout → B, 401/403/404; dọn state liên quan và không phục hồi trái quyền. |
| `test/web-reset-and-permissions` | Kiểm thử deep link/reset ticket, admin/owner/player và xử lý mã lỗi từ backend. | Link sai/hết hạn/dùng lại; UI phản ánh 403 đúng, server luôn thực thi quyền. |
| `test/web-socket-lifecycle` | Kiểm tra đăng ký/hủy listener, reconnect/sync và ACK timeout; đồng bộ TTL/rate limit mới. | Vào/ra phòng nhiều lần không nhân event; không gửi lặp câu trả lời; không lộ đáp án trước hạn. |
| `perf/web-game-rendering` | Đo render leaderboard, timer, ảnh và payload; chỉ tối ưu điểm nghẽn đã đo. | Ghi baseline/after trên cùng trình duyệt, dữ liệu và mạng; state/điểm giữ đúng. |
| `ci/frontend-unit-tests` | Thêm pnpm test vào CI phù hợp sau khi xác minh suite hiện tại. | Pipeline chạy test, lưu báo cáo lỗi và không cần secrets production. |

## Nghiệm thu chung

Chạy test mục tiêu, lint/build theo phạm vi. Test trình duyệt thực khi cần cookie/CORS, nhiều tab, reconnect hoặc ảnh; ghi rõ phần chưa tự chạy. Cập nhật hợp đồng API/socket trong backend/src/docs khi thay đổi tương ứng, và CHANGELOG.md bằng timestamp GMT+7.
