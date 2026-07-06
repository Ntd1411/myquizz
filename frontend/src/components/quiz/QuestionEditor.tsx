import { useState } from 'react'
import { X, Plus, Trash2, Image as ImageIcon, Clock } from 'lucide-react'
import { FocusTrap } from 'focus-trap-react'
import { cn } from '@/utils/cn'
import type { QuestionType, AnswerOption, CorrectAnswer } from '@/types/quiz.types'

interface QuestionEditorProps {
  question: {
    id: string
    question_type: QuestionType
    question_text: string
    time_limit: number
    question_image?: string
    answer_options?: AnswerOption[]
    correct_answer: CorrectAnswer | CorrectAnswer[]
  }
  index: number
  onUpdate: (index: number, question: any) => void
  onClose: () => void
  onSave: (index: number) => boolean
  onCancel?: (index: number) => void
}

export function QuestionEditor({
  question,
  index,
  onUpdate,
  onClose,
  onSave,
  onCancel
}: QuestionEditorProps) {
  const [localQuestion, setLocalQuestion] = useState(question)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const handleCancel = () => {
    if (onCancel) {
      onCancel(index)
    }
    onClose()
  }

  const validateQuestion = (): boolean => {
    const errors: Record<string, string> = {}
    
    console.log('[QuestionEditor] Validating question:', localQuestion)
    
    // Validate question text
    if (!localQuestion.question_text.trim()) {
      errors.question_text = 'Vui lòng nhập nội dung câu hỏi'
    } else if (localQuestion.question_text.length > 200) {
      errors.question_text = 'Nội dung không được vượt quá 200 ký tự'
    }
    
    // Validate answer options for multiple choice/select
    if (localQuestion.question_type === 'multiple_choice' || localQuestion.question_type === 'multiple_select') {
      if (!localQuestion.answer_options || localQuestion.answer_options.length < 2) {
        errors.answer_options = 'Phải có ít nhất 2 đáp án'
      } else {
        localQuestion.answer_options.forEach((opt, i) => {
          if (!opt.option_text.trim()) {
            errors[`option_${i}`] = 'Đáp án không được để trống'
          } else if (opt.option_text.length > 100) {
            errors[`option_${i}`] = 'Đáp án không được vượt quá 100 ký tự'
          }
        })
      }
      
      // Validate correct answer
      if (localQuestion.question_type === 'multiple_choice') {
        const correctAnswer = localQuestion.correct_answer as { option_text: string }
        if (!correctAnswer.option_text?.trim()) {
          errors.correct_answer = 'Vui lòng chọn đáp án đúng'
        }
      } else {
        const correctAnswers = localQuestion.correct_answer as Array<{ option_text: string }>
        if (!correctAnswers || correctAnswers.length === 0) {
          errors.correct_answer = 'Vui lòng chọn ít nhất 1 đáp án đúng'
        }
      }
    } else {
      // Validate text answer
      const correctAnswer = localQuestion.correct_answer as { option_text: string }
      console.log('[QuestionEditor] Validating text answer, correct_answer:', correctAnswer)
      if (!correctAnswer || !correctAnswer.option_text?.trim()) {
        errors.correct_answer = 'Vui lòng nhập đáp án đúng'
      } else if (correctAnswer.option_text.length > 100) {
        errors.correct_answer = 'Đáp án không được vượt quá 100 ký tự'
      }
    }
    
    setLocalErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = () => {
    if (validateQuestion()) {
      onSave(index)
    }
  }

  const handleChange = (field: string, value: any) => {
    let updated = { ...localQuestion, [field]: value }
    
    // Handle question type change - reset correct_answer structure
    if (field === 'question_type') {
      const newType = value as QuestionType
      if (newType === 'multiple_choice') {
        // Single answer object
        updated.correct_answer = { option_text: '' }
        // Keep answer_options or create default
        if (!updated.answer_options || updated.answer_options.length < 2) {
          updated.answer_options = [{ option_text: '' }, { option_text: '' }]
        }
      } else if (newType === 'multiple_select') {
        // Array of answers
        updated.correct_answer = []
        // Keep answer_options or create default
        if (!updated.answer_options || updated.answer_options.length < 2) {
          updated.answer_options = [{ option_text: '' }, { option_text: '' }]
        }
      } else {
        // short_answer or long_answer - single answer object
        updated.correct_answer = { option_text: '' }
        // Remove answer_options for text questions
        updated.answer_options = undefined
      }
    }
    
    setLocalQuestion(updated)
    onUpdate(index, updated)
    
    // Clear related errors when user makes changes
    if (field === 'question_text' && localErrors.question_text) {
      setLocalErrors(prev => {
        const { question_text, ...rest } = prev
        return rest
      })
    }
    if (field === 'answer_options' && localErrors.answer_options) {
      setLocalErrors(prev => {
        const { answer_options, ...rest } = prev
        return rest
      })
    }
    if (field === 'correct_answer' && localErrors.correct_answer) {
      setLocalErrors(prev => {
        const { correct_answer, ...rest } = prev
        return rest
      })
    }
  }

  const handleAddOption = () => {
    const currentOptions = localQuestion.answer_options || []
    handleChange('answer_options', [...currentOptions, { option_text: '' }])
  }

  const handleUpdateOption = (optionIndex: number, text: string) => {
    const options = [...(localQuestion.answer_options || [])]
    options[optionIndex] = { option_text: text }
    handleChange('answer_options', options)
    
    // Clear option error
    if (localErrors[`option_${optionIndex}`]) {
      setLocalErrors(prev => {
        const { [`option_${optionIndex}`]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleDeleteOption = (optionIndex: number) => {
    const options = (localQuestion.answer_options || []).filter((_, i) => i !== optionIndex)
    handleChange('answer_options', options)
  }

  const isMultipleChoice = localQuestion.question_type === 'multiple_choice'
  const isMultipleSelect = localQuestion.question_type === 'multiple_select'
  const needsOptions = isMultipleChoice || isMultipleSelect

  return (
    <div className="fixed inset-0 z-modal bg-ink/50 flex items-center justify-center p-4">
      <FocusTrap>
        <div className="bg-surface rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-semibold text-ink">
              Chỉnh sửa câu hỏi {index + 1}
            </h2>
            <button
              onClick={handleCancel}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question Type */}
          <div>
            <label htmlFor={`question_type_${index}`} className="block text-sm font-medium text-ink mb-2">
              Loại câu hỏi <span className="text-danger">*</span>
            </label>
            <select
              id={`question_type_${index}`}
              value={localQuestion.question_type}
              onChange={(e) => handleChange('question_type', e.target.value as QuestionType)}
              className={cn(
                'w-full px-4 py-2 bg-bg border rounded-base',
                'text-base text-ink',
                'transition-all duration-base',
                'focus:outline-none focus:ring-2',
                'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
              )}
            >
              <option value="multiple_choice">Trắc nghiệm (1 đáp án)</option>
              <option value="multiple_select">Trắc nghiệm (nhiều đáp án)</option>
              <option value="short_answer">Câu trả lời ngắn</option>
              <option value="long_answer">Câu trả lời dài</option>
            </select>
          </div>

          {/* Question Text */}
          <div>
            <label htmlFor={`question_text_${index}`} className="block text-sm font-medium text-ink mb-2">
              Nội dung câu hỏi <span className="text-danger">*</span>
            </label>
            <textarea
              id={`question_text_${index}`}
              value={localQuestion.question_text}
              onChange={(e) => handleChange('question_text', e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              rows={3}
              className={cn(
                'w-full px-4 py-2 bg-bg border rounded-base',
                'text-base text-ink placeholder:text-ink-muted',
                'transition-all duration-base',
                'focus:outline-none focus:ring-2',
                localErrors.question_text
                  ? 'border-danger focus:ring-danger/30'
                  : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30',
                'resize-none'
              )}
              maxLength={200}
            />
            {localErrors.question_text && (
              <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                {localErrors.question_text}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-muted">
              {localQuestion.question_text.length}/200 ký tự
            </p>
          </div>

          {/* Time Limit */}
          <div>
            <label htmlFor={`time_limit_${index}`} className="block text-sm font-medium text-ink mb-2">
              <Clock className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Thời gian (giây)
            </label>
            <input
              id={`time_limit_${index}`}
              type="number"
              min={5}
              max={300}
              value={localQuestion.time_limit}
              onChange={(e) => handleChange('time_limit', parseInt(e.target.value) || 30)}
              className={cn(
                'w-full px-4 py-2 bg-bg border rounded-base',
                'text-base text-ink',
                'transition-all duration-base',
                'focus:outline-none focus:ring-2',
                'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
              )}
            />
            <p className="mt-1 text-xs text-ink-muted">
              Thời gian người chơi có để trả lời câu hỏi này
            </p>
          </div>

          {/* Question Image */}
          <div>
            <label htmlFor={`question_image_${index}`} className="block text-sm font-medium text-ink mb-2">
              <ImageIcon className="w-4 h-4 inline mr-2" aria-hidden="true" />
              Hình ảnh (tùy chọn)
            </label>
            <input
              id={`question_image_${index}`}
              type="url"
              value={localQuestion.question_image || ''}
              onChange={(e) => handleChange('question_image', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={cn(
                'w-full px-4 py-2 bg-bg border rounded-base',
                'text-base text-ink placeholder:text-ink-muted',
                'transition-all duration-base',
                'focus:outline-none focus:ring-2',
                'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
              )}
            />
          </div>

          {/* Answer Options (for multiple choice/select) */}
          {needsOptions && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-ink">
                  Các đáp án <span className="text-danger">*</span>
                </label>
                <button
                  onClick={handleAddOption}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-base text-sm font-medium',
                    'bg-primary-subtle text-primary border border-primary-border',
                    'hover:bg-primary hover:text-white',
                    'transition-all duration-base',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
                  )}
                  aria-label="Thêm đáp án"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Thêm đáp án</span>
                </button>
              </div>

              {localErrors.answer_options && (
                <div className="mb-3 p-3 bg-danger-subtle border border-danger-border rounded-base" role="alert" aria-live="polite">
                  <p className="text-sm text-danger">{localErrors.answer_options}</p>
                </div>
              )}

              <div className="space-y-3">
                {(localQuestion.answer_options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-10 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full bg-primary-subtle text-primary text-sm font-semibold flex items-center justify-center">
                        {String.fromCharCode(65 + optionIndex)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={option.option_text}
                        onChange={(e) => handleUpdateOption(optionIndex, e.target.value)}
                        placeholder={`Đáp án ${String.fromCharCode(65 + optionIndex)}`}
                        className={cn(
                          'w-full px-4 py-2 bg-bg border rounded-base',
                          'text-base text-ink placeholder:text-ink-muted',
                          'transition-all duration-base',
                          'focus:outline-none focus:ring-2',
                          localErrors[`option_${optionIndex}`]
                            ? 'border-danger focus:ring-danger/30'
                            : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                        )}
                        maxLength={100}
                      />
                      {localErrors[`option_${optionIndex}`] && (
                        <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                          {localErrors[`option_${optionIndex}`]}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink-muted">
                        {option.option_text.length}/100 ký tự
                      </p>
                    </div>
                    {(localQuestion.answer_options || []).length > 2 && (
                      <button
                        onClick={() => handleDeleteOption(optionIndex)}
                        className={cn(
                          'p-2 rounded-base text-danger',
                          'hover:bg-danger-subtle',
                          'transition-colors duration-base',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30'
                        )}
                        aria-label={`Xóa đáp án ${String.fromCharCode(65 + optionIndex)}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct Answer */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Đáp án đúng <span className="text-danger">*</span>
            </label>
            
            {isMultipleChoice && (
              <div>
                <select
                  value={typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                    ? localQuestion.correct_answer.option_text
                    : ''}
                  onChange={(e) => handleChange('correct_answer', { option_text: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2 bg-bg border rounded-base',
                    'text-base text-ink',
                    'transition-all duration-base',
                    'focus:outline-none focus:ring-2',
                    localErrors.correct_answer
                      ? 'border-danger focus:ring-danger/30'
                      : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                  )}
                >
                  <option value="">Chọn đáp án đúng</option>
                  {(localQuestion.answer_options || []).map((option, i) => (
                    <option key={i} value={option.option_text}>
                      {String.fromCharCode(65 + i)}: {option.option_text || '(Chưa có nội dung)'}
                    </option>
                  ))}
                </select>
                {localErrors.correct_answer && (
                  <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                    {localErrors.correct_answer}
                  </p>
                )}
              </div>
            )}

            {isMultipleSelect && (
              <div>
                <div className="space-y-2">
                  {(localQuestion.answer_options || []).map((option, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-base cursor-pointer hover:border-border-strong transition-colors">
                      <input
                        type="checkbox"
                        checked={Array.isArray(localQuestion.correct_answer) &&
                          localQuestion.correct_answer.some(ca => ca.option_text === option.option_text)}
                        onChange={(e) => {
                          const currentAnswers = Array.isArray(localQuestion.correct_answer)
                            ? localQuestion.correct_answer
                            : []
                          
                          const newAnswers = e.target.checked
                            ? [...currentAnswers, { option_text: option.option_text }]
                            : currentAnswers.filter(ca => ca.option_text !== option.option_text)
                          
                          handleChange('correct_answer', newAnswers)
                        }}
                        className="w-4 h-4 text-primary focus:ring-2 focus:ring-primary/30"
                      />
                      <span className="text-sm text-ink">
                        {String.fromCharCode(65 + i)}: {option.option_text || '(Chưa có nội dung)'}
                      </span>
                    </label>
                  ))}
                </div>
                {localErrors.correct_answer && (
                  <p className="mt-2 text-xs text-danger" role="alert" aria-live="polite">
                    {localErrors.correct_answer}
                  </p>
                )}
              </div>
            )}

            {(localQuestion.question_type === 'short_answer' || localQuestion.question_type === 'long_answer') && (
              <div>
                <input
                  type="text"
                  value={typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                    ? localQuestion.correct_answer.option_text
                    : ''}
                  onChange={(e) => handleChange('correct_answer', { option_text: e.target.value })}
                  placeholder="Nhập đáp án đúng"
                  className={cn(
                    'w-full px-4 py-2 bg-bg border rounded-base',
                    'text-base text-ink placeholder:text-ink-muted',
                    'transition-all duration-base',
                    'focus:outline-none focus:ring-2',
                    localErrors.correct_answer
                      ? 'border-danger focus:ring-danger/30'
                      : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                  )}
                  maxLength={100}
                />
                {localErrors.correct_answer && (
                  <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                    {localErrors.correct_answer}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  {(typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                    ? localQuestion.correct_answer.option_text
                    : '').length}/100 ký tự
                </p>
              </div>
            )}
          </div>

          {/* Hint & Explanation */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Gợi ý (tùy chọn)
              </label>
              <input
                type="text"
                value={typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                  ? localQuestion.correct_answer.hint || ''
                  : ''}
                onChange={(e) => {
                  const current = typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                    ? localQuestion.correct_answer
                    : { option_text: '' }
                  handleChange('correct_answer', { ...current, hint: e.target.value })
                }}
                placeholder="Gợi ý giúp người chơi tìm ra đáp án"
                className={cn(
                  'w-full px-4 py-2 bg-bg border rounded-base',
                  'text-base text-ink placeholder:text-ink-muted',
                  'transition-all duration-base',
                  'focus:outline-none focus:ring-2',
                  'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                )}
                maxLength={200}
              />
              <p className="mt-1 text-xs text-ink-muted">
                {(typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                  ? localQuestion.correct_answer.hint || ''
                  : '').length}/200 ký tự
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Giải thích (tùy chọn)
              </label>
              <textarea
                value={typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                  ? localQuestion.correct_answer.explanation || ''
                  : ''}
                onChange={(e) => {
                  const current = typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                    ? localQuestion.correct_answer
                    : { option_text: '' }
                  handleChange('correct_answer', { ...current, explanation: e.target.value })
                }}
                placeholder="Giải thích đáp án đúng"
                rows={2}
                className={cn(
                  'w-full px-4 py-2 bg-bg border rounded-base',
                  'text-base text-ink placeholder:text-ink-muted',
                  'transition-all duration-base',
                  'focus:outline-none focus:ring-2',
                  'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30',
                  'resize-none'
                )}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-ink-muted">
                {(typeof localQuestion.correct_answer === 'object' && !Array.isArray(localQuestion.correct_answer)
                  ? localQuestion.correct_answer.explanation || ''
                  : '').length}/500 ký tự
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={handleSave}
            className={cn(
              'px-6 py-2 rounded-base font-medium',
              'bg-primary text-white',
              'hover:bg-primary-hover',
              'transition-all duration-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
          >
            Xong
          </button>
        </div>
        </div>
      </FocusTrap>
    </div>
  )
}
