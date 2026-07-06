# Hướng Dẫn Test E2E - MyQuizz Frontend

Tài liệu này hướng dẫn cách chạy và viết test E2E cho MyQuizz frontend sử dụng Playwright.

## Mục Lục

- [Cài Đặt](#cài-đặt)
- [Chạy Test](#chạy-test)
- [Cấu Trúc Test](#cấu-trúc-test)
- [Viết Test Mới](#viết-test-mới)
- [Debugging](#debugging)
- [Best Practices](#best-practices)

## Cài Đặt

### Cài đặt dependencies

```bash
cd frontend
npm install
```

### Cài đặt Playwright browsers

```bash
npx playwright install
```

## Chạy Test

### Chạy tất cả test

```bash
npm run test:e2e
```

### Chạy test ở chế độ UI

```bash
npm run test:e2e:ui
```

### Chạy test cụ thể

```bash
npx playwright test tests/e2e/auth.spec.js
```

### Chạy test trên browser cụ thể

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Chạy test ở chế độ headed (hiển thị browser)

```bash
npx playwright test --headed
```

### Chạy test với debug

```bash
npx playwright test --debug
```

### Xem report sau khi test

```bash
npx playwright show-report
```

## Cấu Trúc Test

```
tests/
├── e2e/                    # Test files
│   ├── auth.spec.js        # Test đăng nhập, đăng ký
│   ├── quiz-builder.spec.js # Test tạo và chỉnh sửa quiz
│   ├── join-room.spec.js   # Test tham gia phòng
│   ├── quiz-play.spec.js   # Test chơi quiz (single player)
│   └── multiplayer.spec.js # Test chơi quiz (multiplayer)
├── helpers/                # Helper functions
│   ├── auth.helper.js      # Helpers cho authentication
│   └── quiz.helper.js      # Helpers cho quiz operations
└── fixtures/               # Test data
    └── test-data.js        # Test data mẫu
```

## Các Test Cases

### 1. Authentication Tests (auth.spec.js)

#### Đăng ký
- Đăng ký thành công với thông tin hợp lệ
- Hiển thị lỗi khi email đã tồn tại
- Hiển thị lỗi khi email không hợp lệ
- Hiển thị lỗi khi mật khẩu quá ngắn
- Hiển thị lỗi khi mật khẩu xác nhận không khớp
- Hiển thị lỗi khi các trường bắt buộc để trống
- Toggle hiển thị mật khẩu hoạt động đúng

#### Đăng nhập
- Đăng nhập thành công với thông tin hợp lệ
- Hiển thị lỗi khi email không tồn tại
- Hiển thị lỗi khi mật khẩu sai
- Hiển thị lỗi khi email để trống
- Hiển thị lỗi khi mật khẩu để trống
- Toggle hiển thị mật khẩu hoạt động đúng
- Link đăng ký hoạt động

#### Đăng xuất
- Đăng xuất thành công

### 2. Quiz Builder Tests (quiz-builder.spec.js)

#### Tạo quiz
- Truy cập trang tạo quiz thành công
- Tạo quiz đơn giản thành công
- Hiển thị lỗi khi tên quiz để trống
- Hiển thị lỗi khi tên quiz quá ngắn
- Thêm nhiều câu hỏi thành công
- Xóa câu hỏi hoạt động đúng
- Preview quiz hoạt động đúng
- Chuyển đổi loại câu hỏi hoạt động đúng
- Upload ảnh cho câu hỏi hoạt động đúng

#### Chỉnh sửa quiz
- Chỉnh sửa quiz đã tạo thành công

### 3. Join Room Tests (join-room.spec.js)

#### Tham gia phòng
- Truy cập trang tham gia phòng thành công
- Hiển thị lỗi khi mã phòng để trống
- Hiển thị lỗi khi tên người chơi để trống
- Hiển thị lỗi khi mã phòng không tồn tại
- Format mã phòng tự động chuyển thành chữ hoa
- Giới hạn mã phòng tối đa 6 ký tự
- Hiển thị trạng thái kết nối socket

#### Waiting Room
- Hiển thị danh sách người chơi
- Host có thể bắt đầu game
- Player thường không thấy nút bắt đầu
- Hiển thị mã phòng trong waiting room
- Cập nhật danh sách khi có người chơi mới tham gia

### 4. Quiz Play Tests (quiz-play.spec.js)

#### Single Player
- Bắt đầu game và hiển thị câu hỏi đầu tiên
- Hiển thị thời gian đếm ngược
- Chọn và gửi câu trả lời
- Hiển thị kết quả đúng khi trả lời đúng
- Hiển thị kết quả sai khi trả lời sai
- Chuyển sang câu hỏi tiếp theo sau khi trả lời
- Hiển thị trang kết quả sau khi hoàn thành quiz
- Không thể gửi câu trả lời nếu chưa chọn đáp án
- Hiển thị progress bar của quiz

### 5. Multiplayer Tests (multiplayer.spec.js)

#### Multiplayer
- Hai người chơi có thể tham gia cùng phòng
- Host bắt đầu game cho tất cả người chơi
- Tất cả người chơi nhìn thấy cùng câu hỏi
- Người chơi có thể trả lời độc lập

## Viết Test Mới

### Cấu trúc cơ bản

```javascript
import { test, expect } from '@playwright/test'
import { register, login, generateUserData } from '../helpers/auth.helper.js'

test.describe('Tên nhóm test', () => {
  test.beforeEach(async ({ page }) => {
    // Setup trước mỗi test
    const userData = generateUserData()
    await register(page, userData)
  })
  
  test('Mô tả test case', async ({ page }) => {
    // Các bước test
    await page.goto('/path')
    await page.fill('input[name="field"]', 'value')
    await page.click('button[type="submit"]')
    
    // Assertions
    await expect(page.locator('text=Success')).toBeVisible()
  })
})
```

### Sử dụng Helper Functions

```javascript
// Authentication
import { register, login, logout, generateUserData } from '../helpers/auth.helper.js'

const userData = generateUserData()
await register(page, userData)
await login(page, userData.email, userData.password)
await logout(page)

// Quiz operations
import { createQuiz, joinRoom, startGame } from '../helpers/quiz.helper.js'

const quizData = generateQuizData()
await createQuiz(page, quizData)
await joinRoom(page, roomCode, playerName)
await startGame(page)
```

## Debugging

### Debug mode

```bash
npx playwright test --debug
```

### Trace viewer

```bash
npx playwright show-trace trace.zip
```

### Screenshots

Test tự động chụp screenshot khi fail. Xem trong `test-results/` folder.

### Videos

Test tự động record video khi fail. Xem trong `test-results/` folder.

## Best Practices

### 1. Sử dụng data-testid

```javascript
// Good
await page.click('[data-testid="submit-button"]')

// Avoid
await page.click('button.btn-primary')
```

### 2. Sử dụng waitFor

```javascript
// Good
await page.waitForURL('**/app')
await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

// Avoid
await page.waitForTimeout(3000)
```

### 3. Tạo helper functions cho logic tái sử dụng

```javascript
// Đặt trong helpers/
export async function loginAsAdmin(page) {
  await page.goto('/auth/login')
  await page.fill('input[name="email"]', 'admin@test.com')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/app')
}
```

### 4. Sử dụng generateUserData() để tránh conflict

```javascript
// Good - mỗi test có user riêng
const userData = generateUserData()
await register(page, userData)

// Avoid - hardcode data có thể bị conflict
await register(page, { email: 'test@test.com', ... })
```

### 5. Clean up sau test nếu cần

```javascript
test.afterEach(async ({ page }) => {
  // Cleanup logic
  await logout(page)
})
```

## Troubleshooting

### Test timeout

Tăng timeout trong playwright.config.js:

```javascript
export default defineConfig({
  timeout: 60000, // 60 seconds
  // ...
})
```

### Server không start

Kiểm tra port 5173 có bị chiếm không:

```bash
lsof -i :5173  # Mac/Linux
netstat -ano | findstr :5173  # Windows
```

### Browser không cài đặt

```bash
npx playwright install --with-deps
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install dependencies
  run: cd frontend && npm ci

- name: Install Playwright Browsers
  run: cd frontend && npx playwright install --with-deps

- name: Run tests
  run: cd frontend && npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: frontend/playwright-report/
```

## Liên Hệ

Nếu có câu hỏi hoặc vấn đề, vui lòng tạo issue trên GitHub repository.
