# Ngữ cảnh dự án MyQuizz

Bộ tài liệu phục vụ các phiên phát triển sau. Đọc mã nguồn để xác minh khi tài liệu và triển khai khác nhau. Không chép secrets từ `.env` vào tài liệu.

## Chỉ mục

- [Kiến trúc và hiện trạng](architecture.md): thành phần, luồng xử lý và giới hạn đã biết.
- [Phát triển và kiểm thử](development.md): môi trường, lệnh và tình huống kiểm tra.
- [Kế hoạch backend](backend-plan.md): bảo mật, hiệu năng và tiêu chí nghiệm thu.
- [Rà soát backend chi tiết](MYQUIZZ_BACKEND_AUDIT.md): bug, rủi ro, mức ưu tiên, cách sửa và nghiệm thu.
- [Tiến độ triển khai audit](MYQUIZZ_BACKEND_AUDIT_PROGRESS.md): phần đã sửa, kiểm tra đã chạy và việc còn mở.
- [Baseline hiệu năng audit](MYQUIZZ_BACKEND_AUDIT_BENCHMARK.md): p50/p95, query plan, trigger trước/sau và kiểm tra restore.
- `android-plan.local.md`: kế hoạch Android riêng, chỉ lưu local và được Git ignore; không có trong checkout mới.
- [Ngữ cảnh frontend](../../frontend/docs/README.md) và [kế hoạch frontend](../../frontend/docs/frontend-plan.md).
- [Quy trình cộng tác](../../AGENTS.md) và [nhật ký](../../CHANGELOG.md).

## Phạm vi và độ tin cậy

Hiện trạng backend/frontend được đọc trực tiếp từ repository. Android thuộc repository riêng https://github.com/An-K4/MyQuizApp; đánh giá trước đó dựa trên main tại commit `346230b5c2c966a9da9a6b1b77b8c9e82f78718a`, cần đọc lại trước khi sửa.
Các mục kế hoạch đều CHƯA TRIỂN KHAI trong đợt tạo tài liệu này. Chưa có benchmark hoặc kiểm thử xâm nhập để kết luận mức an toàn/hiệu năng.
