// Helper functions cho quiz tests

/**
 * Tạo quiz mới
 * @param {import('@playwright/test').Page} page
 * @param {object} quizData
 */
export async function createQuiz(page, quizData) {
  await page.goto('/quiz/create')
  
  // Điền thông tin cơ bản của quiz
  await page.fill('input[name="quiz_name"]', quizData.quiz_name)
  await page.fill('textarea[name="quiz_description"]', quizData.quiz_description || '')
  
  if (quizData.quiz_category) {
    await page.fill('input[name="quiz_category"]', quizData.quiz_category)
  }
  
  // Thêm câu hỏi
  if (quizData.questions && quizData.questions.length > 0) {
    for (let i = 0; i < quizData.questions.length; i++) {
      await addQuestion(page, quizData.questions[i], i)
    }
  }
  
  // Lưu quiz
  await page.click('button:has-text("Lưu quiz")')
}

/**
 * Thêm câu hỏi vào quiz
 * @param {import('@playwright/test').Page} page
 * @param {object} questionData
 * @param {number} index
 */
export async function addQuestion(page, questionData, index = 0) {
  // Click nút thêm câu hỏi nếu không phải câu hỏi đầu tiên
  if (index > 0) {
    await page.click('button:has-text("Thêm câu hỏi")')
  }
  
  // Chọn loại câu hỏi
  await page.selectOption(`select[name="questions.${index}.question_type"]`, questionData.question_type)
  
  // Điền nội dung câu hỏi
  await page.fill(`input[name="questions.${index}.question_text"]`, questionData.question_text)
  
  // Điền thời gian
  await page.fill(`input[name="questions.${index}.time_limit"]`, String(questionData.time_limit))
  
  // Thêm đáp án cho multiple choice
  if (questionData.question_type === 'multiple_choice' && questionData.answer_options) {
    for (let j = 0; j < questionData.answer_options.length; j++) {
      if (j > 0) {
        await page.click(`button:has-text("Thêm đáp án")`)
      }
      await page.fill(
        `input[name="questions.${index}.answer_options.${j}.option_text"]`,
        questionData.answer_options[j].option_text
      )
    }
    
    // Chọn đáp án đúng
    if (questionData.correct_answer) {
      await page.fill(
        `input[name="questions.${index}.correct_answer.option_text"]`,
        questionData.correct_answer.option_text
      )
    }
  }
}

/**
 * Tham gia phòng quiz
 * @param {import('@playwright/test').Page} page
 * @param {string} roomCode
 * @param {string} playerName
 */
export async function joinRoom(page, roomCode, playerName) {
  await page.goto('/game/join')
  
  await page.fill('input[name="roomCode"]', roomCode)
  await page.fill('input[name="playerName"]', playerName)
  
  await page.click('button[type="submit"]')
}

/**
 * Đợi cho đến khi vào được waiting room
 * @param {import('@playwright/test').Page} page
 * @param {string} roomCode
 */
export async function waitForWaitingRoom(page, roomCode) {
  await page.waitForURL(`**/game/waiting/${roomCode}`, { timeout: 10000 })
}

/**
 * Host bắt đầu game
 * @param {import('@playwright/test').Page} page
 */
export async function startGame(page) {
  await page.click('button:has-text("Bắt đầu")')
}

/**
 * Trả lời câu hỏi
 * @param {import('@playwright/test').Page} page
 * @param {number} answerIndex
 */
export async function answerQuestion(page, answerIndex) {
  await page.click(`[data-testid="answer-option-${answerIndex}"]`)
  await page.click('button:has-text("Gửi câu trả lời")')
}

/**
 * Đợi kết quả câu trả lời
 * @param {import('@playwright/test').Page} page
 */
export async function waitForAnswerResult(page) {
  await page.waitForSelector('[data-testid="answer-result"]', { timeout: 5000 })
}

/**
 * Đợi câu hỏi tiếp theo
 * @param {import('@playwright/test').Page} page
 */
export async function waitForNextQuestion(page) {
  await page.waitForSelector('[data-testid="question-text"]', { timeout: 10000 })
}

/**
 * Tạo dữ liệu quiz mẫu
 * @returns {object}
 */
export function generateQuizData() {
  const timestamp = Date.now()
  
  return {
    quiz_name: `Quiz Test ${timestamp}`,
    quiz_description: 'Đây là quiz test tự động',
    quiz_category: 'Test',
    quiz_language: 'vi',
    is_public: true,
    questions: [
      {
        question_type: 'multiple_choice',
        question_text: 'Câu hỏi 1: 2 + 2 = ?',
        time_limit: 30,
        answer_options: [
          { option_text: '3' },
          { option_text: '4' },
          { option_text: '5' },
          { option_text: '6' }
        ],
        correct_answer: {
          option_text: '4',
          explanation: 'Đáp án đúng là 4'
        }
      },
      {
        question_type: 'multiple_choice',
        question_text: 'Câu hỏi 2: Thủ đô của Việt Nam?',
        time_limit: 30,
        answer_options: [
          { option_text: 'Hà Nội' },
          { option_text: 'TP.HCM' },
          { option_text: 'Đà Nẵng' },
          { option_text: 'Huế' }
        ],
        correct_answer: {
          option_text: 'Hà Nội',
          explanation: 'Thủ đô của Việt Nam là Hà Nội'
        }
      }
    ]
  }
}

/**
 * Lấy room code từ trang quiz detail
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getRoomCode(page) {
  const roomCodeElement = await page.locator('[data-testid="room-code"]')
  return await roomCodeElement.textContent()
}

/**
 * Đợi cho đến khi game kết thúc
 * @param {import('@playwright/test').Page} page
 */
export async function waitForGameCompletion(page) {
  await page.waitForURL('**/game/result/**', { timeout: 30000 })
}
