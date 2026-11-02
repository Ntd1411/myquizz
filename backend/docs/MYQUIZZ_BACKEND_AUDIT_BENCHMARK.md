# Baseline hiệu năng audit backend

Đo lúc 2026-11-02 trên Docker local, PostgreSQL 16, Redis 7 và Node 22. Đây là baseline phát triển, không thay thế load test trên máy production.

| Tình huống | Dữ liệu/tải | Kết quả |
| --- | --- | --- |
| `GET /health/ready` | 500 request, concurrency 25 | p50 17,87 ms; p95 29,91 ms; p99 101,65 ms; max 105,42 ms |
| Recovery room query | 10.028 room trong transaction, 101 active | 1,819 ms; 168 shared hit blocks; sequential scan |
| Insert 500 question, trigger cũ | transaction rollback | tổng 75,649 ms; trigger 65,590 ms |
| Insert 500 question, trigger incremental | transaction rollback | tổng 29,436 ms; trigger 19,166 ms |
| Idle resource sau test | Compose stack | backend 54,48 MiB; PostgreSQL 78,1 MiB; Redis 14,11 MiB |

Trigger incremental giảm tổng thời gian batch khoảng 61% và riêng thời gian trigger khoảng 71%. Recovery query ở 10 nghìn room vẫn dưới 2 ms nên chưa thêm index trạng thái; cần đo lại khi dữ liệu production lớn hơn hoặc tỷ lệ active tăng.

Kiểm tra vận hành cùng đợt: backup PostgreSQL custom format restore sang database tạm thành công, đối chiếu 24 migration, 28 quiz và 28 game session rồi xóa database tạm. `pnpm audit --prod` báo 0 advisory ở cả backend/frontend; scan pattern credential phổ biến trên file tracked trả 0 match.
