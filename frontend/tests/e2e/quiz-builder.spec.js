import { test, expect } from '@playwright/test'
import { register, login, generateUserData, waitForRegisterSuccess } from '../helpers/auth.helper.js'
import { createQuiz, generateQuizData } from '../helpers/quiz.helper.js'

test.describe('Tạo quiz', () => {
  test.beforeEach(async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
  })
  
  test('Truy cập trang tạo quiz thành công', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await expect(page.locator('text=/tạo quiz mới/i')).toBeVisible()
    await expect(page.locator('input[name="quiz_name"]')).toBeVisible()
  })
  
  test('Tạo quiz đơn giản thành công', async ({ page }) => {
    const quizData = generateQuizData()
    
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', quizData.quiz_name)
    await page.fill('textarea[name="quiz_description"]', quizData.quiz_description)
    await page.fill('input[name="quiz_category"]', quizData.quiz_category)
    
    await page.click('button:has-text("Thêm câu hỏi")')
    
    await page.fill('input[name="questions.0.question_text"]', quizData.questions[0].question_text)
    await page.fill('input[name="questions.0.time_limit"]', String(quizData.questions[0].time_limit))
    
    for (let i = 0; i < quizData.questions[0].answer_options.length; i++) {
      if (i > 0) {
        await page.click('button:has-text("Thêm đáp án")')
      }
      await page.fill(
        `input[name="questions.0.answer_options.${i}.option_text"]`,
        quizData.questions[0].answer_options[i].option_text
      )
    }
    
    await page.fill(
      'input[name="questions.0.correct_answer.option_text"]',
      quizData.questions[0].correct_answer.option_text
    )
    
    await page.click('button:has-text("Lưu quiz")')
    
    await page.waitForURL('**/quiz/**', { timeout: 10000 })
    
    await expect(page.locator(`text=${quizData.quiz_name}`)).toBeVisible()
  })
  
  test('Hiển thị lỗi khi tên quiz để trống', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await page.click('button:has-text("Lưu quiz")')
    
    await expect(page.locator('text=/tên quiz.*không được để trống|bắt buộc/i')).toBeVisible()
  })
  
  test('Hiển thị lỗi khi tên quiz quá ngắn', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', 'AB')
    await page.click('button:has-text("Lưu quiz")')
    
    await expect(page.locator('text=/tên quiz.*ít nhất 3 ký tự/i')).toBeVisible()
  })
  
  test('Thêm nhiều câu hỏi thành công', async ({ page }) => {
    const quizData = generateQuizData()
    
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', quizData.quiz_name)
    
    for (let i = 0; i < quizData.questions.length; i++) {
      await page.click('button:has-text("Thêm câu hỏi")')
      
      await page.fill(
        `input[name="questions.${i}.question_text"]`,
        quizData.questions[i].question_text
      )
      await page.fill(
        `input[name="questions.${i}.time_limit"]`,
        String(quizData.questions[i].time_limit)
      )
      
      for (let j = 0; j < quizData.questions[i].answer_options.length; j++) {
        if (j > 0) {
          await page.click('button:has-text("Thêm đáp án")')
        }
        await page.fill(
          `input[name="questions.${i}.answer_options.${j}.option_text"]`,
          quizData.questions[i].answer_options[j].option_text
        )
      }
      
      await page.fill(
        `input[name="questions.${i}.correct_answer.option_text"]`,
        quizData.questions[i].correct_answer.option_text
      )
    }
    
    const questionCount = await page.locator('[data-testid="question-card"]').count()
    expect(questionCount).toBe(quizData.questions.length)
  })
  
  test('Xóa câu hỏi hoạt động đúng', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.click('button:has-text("Thêm câu hỏi")')
    
    let questionCount = await page.locator('[data-testid="question-card"]').count()
    expect(questionCount).toBe(2)
    
    await page.click('[data-testid="delete-question-0"]')
    
    questionCount = await page.locator('[data-testid="question-card"]').count()
    expect(questionCount).toBe(1)
  })
  
  test('Preview quiz hoạt động đúng', async ({ page }) => {
    const quizData = generateQuizData()
    
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', quizData.quiz_name)
    
    await page.click('button:has-text("Thêm câu hỏi")')
    await page.fill('input[name="questions.0.question_text"]', quizData.questions[0].question_text)
    
    await page.click('button:has-text("Xem trước")')
    
    await expect(page.locator('[data-testid="quiz-preview"]')).toBeVisible()
    await expect(page.locator(`text=${quizData.questions[0].question_text}`)).toBeVisible()
  })
  
  test('Chuyển đổi loại câu hỏi hoạt động đúng', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Thêm câu hỏi")')
    
    await page.selectOption('select[name="questions.0.question_type"]', 'short_answer')
    
    await expect(page.locator('select[name="questions.0.question_type"]')).toHaveValue('short_answer')
  })
  
  test('Upload ảnh cho câu hỏi hoạt động đúng', async ({ page }) => {
    await page.goto('/quiz/create')
    
    await page.fill('input[name="quiz_name"]', 'Test Quiz')
    await page.click('button:has-text("Thêm câu hỏi")')
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/test-image.png')
    
    await expect(page.locator('[data-testid="uploaded-image"]')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Chỉnh sửa quiz', () => {
  test.beforeEach(async ({ page }) => {
    const userData = generateUserData()
    await register(page, userData)
    await waitForRegisterSuccess(page)
  })
  
  test('Chỉnh sửa quiz đã tạo thành công', async ({ page }) => {
    const quizData = generateQuizData()
    
    await page.goto('/quiz/create')
    await page.fill('input[name="quiz_name"]', quizData.quiz_name)
    await page.click('button:has-text("Lưu quiz")')
    
    await page.waitForURL('**/quiz/**', { timeout: 10000 })
    
    const quizId = page.url().split('/').pop()
    
    await page.goto(`/quiz/edit/${quizId}`)
    
    const newName = 'Quiz Đã Chỉnh Sửa'
    await page.fill('input[name="quiz_name"]', newName)
    await page.click('button:has-text("Lưu quiz")')
    
    await page.waitForURL('**/quiz/**', { timeout: 10000 })
    
    await expect(page.locator(`text=${newName}`)).toBeVisible()
  })
})
