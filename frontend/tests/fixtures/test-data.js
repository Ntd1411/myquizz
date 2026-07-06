// Test data fixtures

export const testUsers = {
  validUser: {
    fullname: 'Test User Valid',
    email: 'testvalid@test.com',
    username: 'testvalid',
    password: 'Test@123456',
    confirmPassword: 'Test@123456'
  },
  
  adminUser: {
    email: 'admin@myquizz.com',
    password: 'Admin@123456'
  }
}

export const invalidUserData = {
  emptyEmail: {
    email: '',
    password: 'Test@123456'
  },
  
  invalidEmail: {
    email: 'invalid-email',
    password: 'Test@123456'
  },
  
  shortPassword: {
    email: 'test@test.com',
    password: '123'
  },
  
  mismatchPassword: {
    fullname: 'Test User',
    email: 'test@test.com',
    username: 'testuser',
    password: 'Test@123456',
    confirmPassword: 'Different@123'
  }
}

export const sampleQuizzes = {
  simpleQuiz: {
    quiz_name: 'Quiz Đơn Giản',
    quiz_description: 'Một quiz đơn giản để test',
    quiz_category: 'Test',
    quiz_language: 'vi',
    is_public: true,
    questions: [
      {
        question_type: 'multiple_choice',
        question_text: '2 + 2 = ?',
        time_limit: 30,
        answer_options: [
          { option_text: '3' },
          { option_text: '4' },
          { option_text: '5' }
        ],
        correct_answer: {
          option_text: '4'
        }
      }
    ]
  },
  
  multipleQuestionsQuiz: {
    quiz_name: 'Quiz Nhiều Câu Hỏi',
    quiz_description: 'Quiz với nhiều câu hỏi',
    quiz_category: 'Test',
    quiz_language: 'vi',
    is_public: true,
    questions: [
      {
        question_type: 'multiple_choice',
        question_text: 'Câu hỏi 1',
        time_limit: 30,
        answer_options: [
          { option_text: 'Đáp án A' },
          { option_text: 'Đáp án B' }
        ],
        correct_answer: {
          option_text: 'Đáp án A'
        }
      },
      {
        question_type: 'multiple_choice',
        question_text: 'Câu hỏi 2',
        time_limit: 30,
        answer_options: [
          { option_text: 'Đáp án X' },
          { option_text: 'Đáp án Y' }
        ],
        correct_answer: {
          option_text: 'Đáp án Y'
        }
      },
      {
        question_type: 'multiple_choice',
        question_text: 'Câu hỏi 3',
        time_limit: 30,
        answer_options: [
          { option_text: 'Đáp án 1' },
          { option_text: 'Đáp án 2' }
        ],
        correct_answer: {
          option_text: 'Đáp án 1'
        }
      }
    ]
  }
}

export const roomCodes = {
  valid: 'ABC123',
  invalid: 'INVALID',
  expired: 'EXPIRE'
}
