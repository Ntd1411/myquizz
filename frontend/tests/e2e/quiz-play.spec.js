import { test, expect } from '@playwright/test'
import { register, generateUserData, waitForRegisterSuccess } from '../helpers/auth.helper.js'
import { 
  joinRoom, 
  waitForWaitingRoom, 
  startGame, 
  answerQuestion,
  waitForAnswerResult,
  waitForNextQuestion,
  waitForGameCompletion 
} from '../helpers/quiz.helper.js'

test.describe('Chơi quiz - Single player', () => {
  test.beforeEach(async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
  })
  
  test('Bắt đầu game và hiển thị câu hỏi đầu tiên', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Câu hỏi test')
    await page.fill('input[name="questions.0.time_limit"]', '30')
    
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
    
    await startGame(page)
    
    await page.waitForURL('**/game/play/**', { timeout: 10000 })
    
    await expect(page.locator('[data-testid="question-text"]')).toBeVisible()
    await expect(page.locator('text=/câu hỏi test/i')).toBeVisible()
  })
  
  test('Hiển thị thời gian đếm ngược', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '60')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    
    await page.waitForURL('**/game/play/**')
    
    const timer = page.locator('[data-testid="timer"]')
    await expect(timer).toBeVisible()
    
    const initialTime = await timer.textContent()
    await page.waitForTimeout(2000)
    const currentTime = await timer.textContent()
    
    expect(parseInt(currentTime)).toBeLessThan(parseInt(initialTime))
  })
  
  test('Chọn và gửi câu trả lời', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
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
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await page.click('[data-testid="answer-option-0"]')
    
    await expect(page.locator('[data-testid="answer-option-0"]')).toHaveClass(/selected/)
    
    await page.click('button:has-text("Gửi câu trả lời")')
    
    await expect(page.locator('[data-testid="answer-result"]')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hiển thị kết quả đúng khi trả lời đúng', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '60')
    
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.0.option_text"]', 'Đáp án Đúng')
    
    await page.fill('input[name="questions.0.correct_answer.option_text"]', 'Đáp án Đúng')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await page.click('[data-testid="answer-option-0"]')
    await page.click('button:has-text("Gửi câu trả lời")')
    
    await expect(page.locator('text=/đúng|correct/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Hiển thị kết quả sai khi trả lời sai', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '60')
    
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.0.option_text"]', 'Đáp án Sai')
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.1.option_text"]', 'Đáp án Đúng')
    
    await page.fill('input[name="questions.0.correct_answer.option_text"]', 'Đáp án Đúng')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await page.click('[data-testid="answer-option-0"]')
    await page.click('button:has-text("Gửi câu trả lời")')
    
    await expect(page.locator('text=/sai|incorrect/i')).toBeVisible({ timeout: 5000 })
  })
  
  test('Chuyển sang câu hỏi tiếp theo sau khi trả lời', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Câu hỏi 1')
    await page.fill('input[name="questions.0.time_limit"]', '30')
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.0.option_text"]', 'Đáp án 1')
    await page.fill('input[name="questions.0.correct_answer.option_text"]', 'Đáp án 1')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.1.question_text"]', 'Câu hỏi 2')
    await page.fill('input[name="questions.1.time_limit"]', '30')
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.1.answer_options.0.option_text"]', 'Đáp án 2')
    await page.fill('input[name="questions.1.correct_answer.option_text"]', 'Đáp án 2')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await expect(page.locator('text=/câu hỏi 1/i')).toBeVisible()
    
    await page.click('[data-testid="answer-option-0"]')
    await page.click('button:has-text("Gửi câu trả lời")')
    
    await page.waitForTimeout(3000)
    
    await expect(page.locator('text=/câu hỏi 2/i')).toBeVisible({ timeout: 10000 })
  })
  
  test('Hiển thị trang kết quả sau khi hoàn thành quiz', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    await page.fill('input[name="questions.0.time_limit"]', '30')
    await page.click('button:has-text("Thêm đáp án")')
    await page.fill('input[name="questions.0.answer_options.0.option_text"]', 'Đáp án')
    await page.fill('input[name="questions.0.correct_answer.option_text"]', 'Đáp án')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await page.click('[data-testid="answer-option-0"]')
    await page.click('button:has-text("Gửi câu trả lời")')
    
    await page.waitForURL('**/game/result/**', { timeout: 15000 })
    
    await expect(page.locator('text=/kết quả|hoàn thành/i')).toBeVisible()
  })
  
  test('Không thể gửi câu trả lời nếu chưa chọn đáp án', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Test Question')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    const submitButton = page.locator('button:has-text("Gửi câu trả lời")')
    await expect(submitButton).toBeDisabled()
  })
  
  test('Hiển thị progress bar của quiz', async ({ page }) => {
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', 'Câu 1')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.1.question_text"]', 'Câu 2')
    
    await page.click('button:has-text("Lưu quiz")')
    await page.waitForURL('**/quiz/**')
    
    await page.click('button:has-text("Bắt đầu chơi")')
    
    const roomCode = await page.locator('[data-testid="room-code"]').textContent()
    await waitForWaitingRoom(page, roomCode)
    
    await startGame(page)
    await page.waitForURL('**/game/play/**')
    
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
    await expect(page.locator('text=/1.*2|câu 1.*2/i')).toBeVisible()
  })
})
