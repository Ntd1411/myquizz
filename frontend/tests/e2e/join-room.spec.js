import { test, expect } from '@playwright/test'
import { register, generateUserData, waitForRegisterSuccess } from '../helpers/auth.helper.js'
import { joinRoom, waitForWaitingRoom } from '../helpers/quiz.helper.js'

test.describe('Tham gia phòng quiz', () => {
  test.beforeEach(async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
  })
  
  test('Truy cập trang tham gia phòng thành công', async ({ page }) => {
    await page.goto('/game/join')
    
    await expect(page.locator('text=/tham gia phòng/i')).toBeVisible()
    await expect(page.locator('input[name="roomCode"]')).toBeVisible()
    await expect(page.locator('input[name="playerName"]')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi mã phòng để trống', async ({ page }) => {
    await page.goto('/game/join')
    
    await page.fill('input[name="playerName"]', 'Test Player')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/vui lòng nhập mã phòng/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi tên người chơi để trống', async ({ page }) => {
    await page.goto('/game/join')
    
    await page.fill('input[name="roomCode"]', 'ABC123')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/vui lòng nhập tên/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi mã phòng không tồn tại', async ({ page }) => {
    await page.goto('/game/join')
    
    await page.fill('input[name="roomCode"]', 'INVALID')
    await page.fill('input[name="playerName"]', 'Test Player')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=/không tìm thấy phòng|mã phòng không hợp lệ/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Format mã phòng tự động chuyển thành chữ hoa', async ({ page }) => {
    await page.goto('/game/join')
    
    const roomCodeInput = page.locator('input[name="roomCode"]')
    await roomCodeInput.fill('abc123')
    
    await expect(roomCodeInput).toHaveValue('ABC123')
  })
  
  test('Giới hạn mã phòng tối đa 6 ký tự', async ({ page }) => {
    await page.goto('/game/join')
    
    const roomCodeInput = page.locator('input[name="roomCode"]')
    await roomCodeInput.fill('ABCDEFGH')
    
    const value = await roomCodeInput.inputValue()
    expect(value.length).toBeLessThanOrEqual(6)
  })
  
  test('Hiển thị trạng thái kết nối socket', async ({ page }) => {
    await page.goto('/game/join')
    
    await expect(page.locator('[data-testid="socket-status"]')).toBeVisible()
  })
})

test.describe('Waiting Room', () => {
  test('Hiển thị danh sách người chơi', async ({ page, context }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    // Tạo quiz và lấy room code từ page 1
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    
    await waitForWaitingRoom(page, roomCode)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    const playerList = page.locator('[data-testid="player-list"]')
    await expect(playerList).toBeVisible()
    
    const playerCount = await page.locator('[data-testid="player-item"]').count()
    expect(playerCount).toBeGreaterThanOrEqual(2)
  })
  
  test('Host có thể bắt đầu game', async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    const startButton = page.locator('button:has-text("Bắt đầu")')
    await expect(startButton).toBeVisible()
    await expect(startButton).toBeEnabled()
  })
  
  test('Player thường không thấy nút bắt đầu', async ({ page, context }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    const startButton = page2.locator('button:has-text("Bắt đầu")')
    await expect(startButton).not.toBeVisible()
  })
  
  test('Hiển thị mã phòng trong waiting room', async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    
    await waitForWaitingRoom(page, roomCode)
    
    await expect(page.locator(`text=${roomCode}`)).toBeVisible()
  })
  
  test('Cập nhật danh sách khi có người chơi mới tham gia', async ({ page, context }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    let playerCount = await page.locator('[data-testid="player-item"]').count()
    const initialCount = playerCount
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    
    await page.waitForTimeout(2000)
    
    playerCount = await page.locator('[data-testid="player-item"]').count()
    expect(playerCount).toBe(initialCount + 1)
  })
})
