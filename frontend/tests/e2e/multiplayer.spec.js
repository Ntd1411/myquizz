import { test, expect } from '@playwright/test'
import { register, generateUserData, waitForRegisterSuccess } from '../helpers/auth.helper.js'
import { joinRoom, waitForWaitingRoom, startGame } from '../helpers/quiz.helper.js'

test.describe('Chơi quiz - Multiplayer', () => {
  test('Hai người chơi có thể tham gia cùng phòng', async ({ page, context }) => {
    const userData1 = generateUserData()
    await register(page, userData1)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/builder')
    await page.fill('input[name="quiz_name"]', 'Multiplayer Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '60')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    const playerCount1 = await page.locator('[data-testid="player-item"]').count()
    const playerCount2 = await page2.locator('[data-testid="player-item"]').count()
    
    expect(playerCount1).toBe(2)
    expect(playerCount2).toBe(2)
  })
  
  test('Host bắt đầu game cho tất cả người chơi', async ({ page, context }) => {
    const userData1 = generateUserData()
    await register(page, userData1)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/builder')
    await page.fill('input[name="quiz_name"]', 'Multiplayer Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    await startGame(page)
    
    await page.waitForURL('**/game/play/**', { timeout: 10000 })
    await page2.waitForURL('**/game/play/**', { timeout: 10000 })
    
    await expect(page.locator('[data-testid="question-text"]')).toBeVisible()
    await expect(page2.locator('[data-testid="question-text"]')).toBeVisible()
  })
  
  test('Tất cả người chơi nhìn thấy cùng câu hỏi', async ({ page, context }) => {
    const userData1 = generateUserData()
    await register(page, userData1)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/builder')
    await page.fill('input[name="quiz_name"]', 'Multiplayer Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    const questionText = 'Câu hỏi multiplayer test'
    await page.fill('input[name="questions.0.question_text"]', questionText)
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    await startGame(page)
    
    await page.waitForURL('**/game/play/**')
    await page2.waitForURL('**/game/play/**')
    
    const question1 = await page.locator('[data-testid="question-text"]').textContent()
    const question2 = await page2.locator('[data-testid="question-text"]').textContent()
    
    expect(question1).toBe(question2)
    expect(question1).toContain(questionText)
  })
  
  test('Người chơi có thể trả lời độc lập', async ({ page, context }) => {
    const userData1 = generateUserData()
    await register(page, userData1)
    await waitForRegisterSuccess(page)
    
    await page.goto('/quiz/builder')
    await page.fill('input[name="quiz_name"]', 'Multiplayer Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '60')
    
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.0.option_text"]', 'Đáp án A')
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.1.option_text"]', 'Đáp án B')
    
    await page.fill('input[name="questions.0.correct_answer.option_text"]', 'Đáp án A')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    const page2 = await context.newPage()
    const userData2 = generateUserData()
    await register(page2, userData2)
    await waitForRegisterSuccess(page2)
    
    await joinRoom(page2, roomCode, userData2.fullname)
    await waitForWaitingRoom(page2, roomCode)
    
    await startGame(page)
    
    await page.waitForURL('**/game/play/**')
    await page2.waitForURL('**/game/play/**')
    
    await page.click('[data-testid="answer-option-0"]')
    await page2.click('[data-testid="answer-option-1"]')
    
    await page.click('button:has-text("Gửi câu trả lời")')
    await page2.click('button:has-text("Gửi câu trả lời")')
    
    await expect(page.locator('text=/đúng/i')).toBeVisible({ timeout: 5000 })
    await expect(page2.locator('text=/sai/i')).toBeVisible({ timeout: 5000 })
  })
})
