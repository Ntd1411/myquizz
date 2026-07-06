import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import FocusTrap from 'focus-trap-react'
import { cn } from '@/utils/cn'

interface QuizPreviewProps {
  quiz: {
    quiz_name: string
    quiz_description: string
    quiz_category: string
    questions: Array<{
      id: string
      question_type: 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'
      question_text: string
      time_limit: number
      question_image?: string
      answer_options?: Array<{ option_text: string }>
      correct_answer: any
    }>
  }
  onClose: () => void
}

export function QuizPreview({ quiz, onClose }: QuizPreviewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const currentQuestion = quiz.questions[currentQuestionIndex]

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  if (!currentQuestion) {
    return null
  }

  const isMultipleChoice = currentQuestion.question_type === 'multiple_choice' || 
                          currentQuestion.question_type === 'multiple_select'

  return (
    <div className="fixed inset-0 z-modal bg-ink/50 flex items-center justify-center p-4">
      <FocusTrap>
        <div className="bg-surface rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-ink">{quiz.quiz_name}</h2>
                {quiz.quiz_description && (
                  <p className="text-sm text-ink-muted mt-1">{quiz.quiz_description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-base text-ink-muted hover:text-ink hover:bg-surface-hover',
                  'transition-colors duration-base',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                )}
                aria-label="Đóng"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div 
                className="flex-1 h-2 bg-bg rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={currentQuestionIndex + 1}
                aria-valuemin={1}
                aria-valuemax={quiz.questions.length}
                aria-label={`Câu hỏi ${currentQuestionIndex + 1} / ${quiz.questions.length}`}
              >
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-ink-muted whitespace-nowrap">
                {currentQuestionIndex + 1} / {quiz.questions.length}
            </span>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            {/* Question Text */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium text-ink-muted">
                  Câu hỏi {currentQuestionIndex + 1}
                </span>
                <span className="px-3 py-1 bg-primary-subtle text-primary text-xs font-medium rounded-full">
                  {currentQuestion.time_limit}s
                </span>
              </div>
              <h3 className="text-2xl font-semibold text-ink leading-snug">
                {currentQuestion.question_text}
              </h3>
            </div>

            {/* Question Image */}
            {currentQuestion.question_image && (
              <div className="mb-8">
                <img
                  src={currentQuestion.question_image}
                  alt="Question"
                  className="w-full rounded-lg border border-border"
                />
              </div>
            )}

            {/* Answer Options */}
            {isMultipleChoice && currentQuestion.answer_options && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.answer_options.map((option, index) => {
                  const isCorrect = currentQuestion.question_type === 'multiple_choice'
                    ? typeof currentQuestion.correct_answer === 'object' && 
                      !Array.isArray(currentQuestion.correct_answer) &&
                      currentQuestion.correct_answer.option_text === option.option_text
                    : Array.isArray(currentQuestion.correct_answer) &&
                      currentQuestion.correct_answer.some((ca: any) => ca.option_text === option.option_text)

                  return (
                    <div
                      key={index}
                      className={cn(
                        'relative p-6 rounded-lg border-2 transition-all duration-base',
                        isCorrect
                          ? 'border-success bg-success-subtle'
                          : 'border-border bg-surface hover:border-border-strong'
                      )}
                    >
                      {/* Answer Letter */}
                      <div className={cn(
                        'absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center',
                        'font-semibold text-sm border-2',
                        isCorrect
                          ? 'bg-success text-white border-success'
                          : 'bg-surface text-ink-muted border-border'
                      )}>
                        {String.fromCharCode(65 + index)}
                      </div>

                      {/* Answer Text */}
                      <p className="text-base text-ink font-medium pl-4">
                        {option.option_text}
                      </p>

                      {/* Correct Indicator */}
                      {isCorrect && (
                        <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-success" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Text Answer Preview */}
            {!isMultipleChoice && (
              <div className="space-y-4">
                <div className="p-6 bg-bg border border-border rounded-lg">
                  <p className="text-sm font-medium text-ink-muted mb-2">Đáp án mẫu:</p>
                  <p className="text-base text-ink">
                    {typeof currentQuestion.correct_answer === 'object' && 
                     !Array.isArray(currentQuestion.correct_answer)
                      ? currentQuestion.correct_answer.option_text
                      : 'Chưa có đáp án'}
                  </p>
                </div>
              </div>
            )}

            {/* Hint & Explanation */}
            {typeof currentQuestion.correct_answer === 'object' && 
             !Array.isArray(currentQuestion.correct_answer) && (
              <div className="mt-8 space-y-4">
                {currentQuestion.correct_answer.hint && (
                  <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                    <p className="text-sm font-medium text-info mb-1">Gợi ý:</p>
                    <p className="text-sm text-ink">{currentQuestion.correct_answer.hint}</p>
                  </div>
                )}
                
                {currentQuestion.correct_answer.explanation && (
                  <div className="p-4 bg-success-subtle border border-success-border rounded-lg">
                    <p className="text-sm font-medium text-success mb-1">Giải thích:</p>
                    <p className="text-sm text-ink">{currentQuestion.correct_answer.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-base font-medium',
              'bg-surface border border-border text-ink',
              'hover:bg-surface-hover hover:border-border-strong',
              'transition-all duration-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Xem câu hỏi trước"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span>Câu trước</span>
          </button>

          <div className="flex items-center gap-2">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-base',
                  index === currentQuestionIndex
                    ? 'bg-primary w-6'
                    : 'bg-border hover:bg-border-strong'
                )}
                aria-label={`Đi tới câu hỏi ${index + 1}`}
                aria-current={index === currentQuestionIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentQuestionIndex === quiz.questions.length - 1}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-base font-medium',
              'bg-primary text-white',
              'hover:bg-primary-hover',
              'transition-all duration-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Xem câu hỏi tiếp theo"
          >
            <span>Câu tiếp</span>
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        </div>
      </FocusTrap>
    </div>
  )
}
