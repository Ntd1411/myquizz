# Changelog

Thời gian ghi theo GMT+7 (UTC+07:00). Ghi công việc thực tế đã hoàn thành; kế hoạch chưa triển khai nằm trong tài liệu riêng.

## 2026-11-01 21:02:56 GMT+7

### Tài liệu và quy trình

- Tạo backend/docs: chỉ mục ngữ cảnh, kiến trúc/hiện trạng, hướng dẫn phát triển/kiểm thử và kế hoạch bảo mật/hiệu năng backend.
- Tạo frontend/docs: hiện trạng web và kế hoạch tương ứng; ghi nhận single-flight refresh đã có.
- Tạo kế hoạch Android riêng tại backend/docs/android-plan.local.md; thêm Git ignore để không commit nội dung này.
- Bổ sung AGENTS.md: đọc tài liệu khi cần; tách nhánh từng phần; ưu tiên test; tự commit sau kiểm tra đạt; commit tiếng Anh theo Conventional Commits; không push; báo bước thủ công khi kết thúc.
- Nhánh: docs/project-context-and-workflow. Không thay đổi mã ứng dụng hoặc triển khai các mục kế hoạch.
- Xác minh: kiểm tra liên kết Markdown local, file bắt buộc, timestamp GMT+7, Git ignore Android và git diff --check trước commit. Không chạy test ứng dụng vì chỉ thay đổi tài liệu/quy trình.
