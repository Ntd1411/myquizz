import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Eye, ArrowLeft, Loader2, AlertCircle, Plus, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { CreateQuizRequest, CreateQuestionRequest } from '@/types/quiz.types'
import { QuestionEditor } from '@/components/quiz/QuestionEditor'
import { QuizPreview } from '@/components/quiz/QuizPreview'
import { quizService } from '@/services/quiz.service'
import { createQuizSchema, updateQuizSchema } from '@/validators/quiz.validator'
import { ZodError } from 'zod'

interface QuizFormData {
  quiz_name: string
  quiz_description: string
  quiz_language: string
  quiz_category: string
  quiz_image: string
  is_public: boolean
  questions: QuestionFormData[]
}

interface QuestionFormData extends Omit<CreateQuestionRequest, 'correct_answer'> {
  id: string // temporary ID for frontend
  question_type: 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'
  question_text: string
  time_limit: number
  question_image?: string
  answer_options?: Array<{ option_text: string }>
  correct_answer: {
    option_text: string
    hint?: string
    explanation?: string
  } | Array<{ option_text: string; hint?: string; explanation?: string }>
}

export function QuizBuilderPage() {
  const navigate = useNavigate()
  const { quizId } = useParams<{ quizId: string }>()
  const isEditMode = Boolean(quizId)

  const [formData, setFormData] = useState<QuizFormData>({
    quiz_name: '',
    quiz_description: '',
    quiz_language: 'vi',
    quiz_category: '',
    quiz_image: '',
    is_public: true,
    questions: []
  })

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [questionSnapshots, setQuestionSnapshots] = useState<Map<number, QuestionFormData>>(new Map())

  // Load quiz data if editing
  useEffect(() => {
    if (isEditMode && quizId) {
      const loadQuiz = async () => {
        try {
          const quiz = await quizService.getQuizById(quizId)
          
          // Transform backend data to frontend format
          setFormData({
            quiz_name: quiz.quiz_name,
            quiz_description: quiz.quiz_description || '',
            quiz_language: quiz.quiz_language,
            quiz_category: quiz.quiz_category || '',
            quiz_image: quiz.quiz_image || '',
            is_public: quiz.is_public,
            questions: (quiz.questions as any[]).map((q: any) => ({
              id: `existing_${q.id}`,
              question_type: q.question_type,
              question_text: q.question_text,
              time_limit: q.time_limit,
              question_image: q.question_image,
              answer_options: q.answer_options,
              correct_answer: q.correct_answer
            }))
          })
        } catch (err: any) {
          console.error('Load quiz error:', err)
          setError('Không thể tải quiz. Vui lòng thử lại.')
        }
      }
      
      loadQuiz()
    }
  }, [isEditMode, quizId])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    try {
      // Transform frontend data to backend format for validation
      const quizData = {
        quiz_name: formData.quiz_name,
        quiz_description: formData.quiz_description || undefined,
        quiz_language: formData.quiz_language,
        quiz_image: formData.quiz_image || undefined,
        quiz_category: formData.quiz_category || undefined,
        is_public: formData.is_public,
        questions: formData.questions.map(q => ({
          question_type: q.question_type,
          question_text: q.question_text,
          time_limit: q.time_limit,
          question_image: q.question_image,
          answer_options: q.answer_options,
          correct_answer: q.correct_answer
        }))
      }

      // Use zod schema to validate
      if (isEditMode) {
        updateQuizSchema.parse(quizData)
      } else {
        createQuizSchema.parse(quizData)
      }

      setValidationErrors({})
      return true
    } catch (err) {
      if (err instanceof ZodError) {
        // Transform zod errors to readable format
        err.errors.forEach(error => {
          const path = error.path
          
          // Quiz level errors
          if (path[0] === 'quiz_name') {
            errors.quiz_name = 'Tên quiz: ' + error.message
          } else if (path[0] === 'quiz_description') {
            errors.quiz_description = 'Mô tả: ' + error.message
          } else if (path[0] === 'quiz_language') {
            errors.quiz_language = 'Ngôn ngữ: ' + error.message
          } else if (path[0] === 'quiz_image') {
            errors.quiz_image = 'Ảnh bìa: ' + error.message
          } else if (path[0] === 'quiz_category') {
            errors.quiz_category = 'Danh mục: ' + error.message
          } else if (path[0] === 'questions' && path.length === 1) {
            errors.questions = error.message
          }
          // Question level errors
          else if (path[0] === 'questions' && typeof path[1] === 'number') {
            const questionIndex = path[1]
            const field = path[2] as string
            const errorKey = `question_${questionIndex}_${field}`
            
            if (field === 'question_text') {
              errors[errorKey] = `Câu ${questionIndex + 1} - Nội dung: ${error.message}`
            } else if (field === 'time_limit') {
              errors[errorKey] = `Câu ${questionIndex + 1} - Thời gian: ${error.message}`
            } else if (field === 'question_image') {
              errors[errorKey] = `Câu ${questionIndex + 1} - Ảnh: ${error.message}`
            } else if (field === 'answer_options') {
              errors[errorKey] = `Câu ${questionIndex + 1} - Đáp án: ${error.message}`
            } else if (field === 'correct_answer') {
              errors[errorKey] = `Câu ${questionIndex + 1} - Đáp án đúng: ${error.message}`
            } else {
              errors[errorKey] = `Câu ${questionIndex + 1}: ${error.message}`
            }
          }
        })
      }
      setValidationErrors(errors)
      return false
    }
  }

  const handleSave = async () => {
    if (!validateForm()) {
      // Scroll to top to see errors
      window.scrollTo({ top: 0, behavior: 'smooth' })
      
      setError(`Vui lòng kiểm tra lại thông tin bên dưới.`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Transform frontend data to backend format
      console.log('[QuizBuilder] Transforming data before save...')
      const quizData: CreateQuizRequest = {
        quiz_name: formData.quiz_name,
        quiz_description: formData.quiz_description || undefined,
        quiz_language: formData.quiz_language,
        quiz_image: formData.quiz_image || undefined,
        quiz_category: formData.quiz_category || undefined,
        is_public: formData.is_public,
        questions: formData.questions.map(q => ({
          question_type: q.question_type,
          question_text: q.question_text,
          time_limit: q.time_limit,
          question_image: q.question_image,
          // Only include answer_options for multiple choice/select
          answer_options: (q.question_type === 'multiple_choice' || q.question_type === 'multiple_select') 
            ? q.answer_options 
            : undefined,
          correct_answer: q.correct_answer
        }))
      }

      console.log('[QuizBuilder] Final quiz data to send:', JSON.stringify(quizData, null, 2))

      if (isEditMode && quizId) {
        await quizService.updateQuiz(quizId, quizData)
      } else {
        await quizService.createQuiz(quizData)
      }
      
      // Navigate to quiz list or dashboard
      navigate('/')
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.response?.data?.message || err.message || 'Không thể lưu quiz. Vui lòng thử lại.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePreview = () => {
    setShowPreview(true)
  }

  const handleAddQuestion = () => {
    setError(null)
    
    const newQuestion: QuestionFormData = {
      id: `temp_${Date.now()}`,
      question_type: 'multiple_choice',
      question_text: '',
      time_limit: 30,
      answer_options: [
        { option_text: '' },
        { option_text: '' }
      ],
      correct_answer: {
        option_text: ''
      }
    }

    const newIndex = formData.questions.length

    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }))
    
    // Save snapshot for rollback
    setQuestionSnapshots(prev => new Map(prev).set(newIndex, newQuestion))
    setActiveQuestionIndex(newIndex)
  }

  const handleDeleteQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
    
    if (activeQuestionIndex === index) {
      setActiveQuestionIndex(null)
    } else if (activeQuestionIndex !== null && activeQuestionIndex > index) {
      setActiveQuestionIndex(activeQuestionIndex - 1)
    }
  }

  const handleUpdateQuestion = (index: number, updatedQuestion: any) => {
    // Save snapshot before first update if not exists
    if (!questionSnapshots.has(index)) {
      setQuestionSnapshots(prev => new Map(prev).set(index, formData.questions[index]))
    }
    
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? updatedQuestion : q)
    }))
  }

  const handleQuestionEditorClose = () => {
    setActiveQuestionIndex(null)
  }

  const handleOpenQuestionEditor = (index: number) => {
    // Save snapshot when opening editor
    if (!questionSnapshots.has(index)) {
      setQuestionSnapshots(prev => new Map(prev).set(index, formData.questions[index]))
    }
    setActiveQuestionIndex(index)
  }

  const handleQuestionEditorSave = (index: number): boolean => {
    setError(null)
    setActiveQuestionIndex(null)
    // Clear snapshot after successful save
    setQuestionSnapshots(prev => {
      const newMap = new Map(prev)
      newMap.delete(index)
      return newMap
    })
    return true
  }

  const handleQuestionEditorCancel = (index: number) => {
    const snapshot = questionSnapshots.get(index)
    
    if (snapshot) {
      // Check if this is a new question (empty question_text in snapshot)
      if (!snapshot.question_text.trim()) {
        // Remove the new question entirely
        setFormData(prev => ({
          ...prev,
          questions: prev.questions.filter((_, i) => i !== index)
        }))
      } else {
        // Rollback to snapshot
        setFormData(prev => ({
          ...prev,
          questions: prev.questions.map((q, i) => i === index ? snapshot : q)
        }))
      }
      
      // Clear snapshot
      setQuestionSnapshots(prev => {
        const newMap = new Map(prev)
        newMap.delete(index)
        return newMap
      })
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-sticky bg-surface border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                'p-2 rounded-base text-ink-muted hover:text-ink hover:bg-surface-hover',
                'transition-colors duration-base',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-ink">
                {isEditMode ? 'Chỉnh sửa quiz' : 'Tạo quiz mới'}
              </h1>
              {formData.quiz_name && (
                <p className="text-sm text-ink-muted">{formData.quiz_name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={formData.questions.length === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-base font-medium',
                'bg-surface border border-border text-ink',
                'hover:bg-surface-hover hover:border-border-strong',
                'transition-all duration-base',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Xem trước quiz"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>Xem trước</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-6 py-2 rounded-base font-medium',
                'bg-primary text-white',
                'hover:bg-primary-hover',
                'transition-all duration-base',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label={isSaving ? 'Đang lưu quiz' : 'Lưu quiz'}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>Lưu quiz</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-danger-subtle border-b border-danger-border" role="alert" aria-live="assertive">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Quiz Settings */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="text-xl font-semibold text-ink mb-4">Thông tin quiz</h2>
              
              <div className="space-y-4">
                {/* Quiz Name */}
                <div>
                  <label htmlFor="quiz_name" className="block text-sm font-medium text-ink mb-2">
                    Tên quiz <span className="text-danger">*</span>
                  </label>
                  <input
                    id="quiz_name"
                    type="text"
                    value={formData.quiz_name}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, quiz_name: e.target.value }))
                      if (validationErrors.quiz_name) {
                        setValidationErrors(prev => {
                          const { quiz_name, ...rest } = prev
                          return rest
                        })
                      }
                    }}
                    placeholder="Nhập tên quiz"
                    className={cn(
                      'w-full px-4 py-2 bg-bg border rounded-base',
                      'text-base text-ink placeholder:text-ink-muted',
                      'transition-all duration-base',
                      'focus:outline-none focus:ring-2',
                      validationErrors.quiz_name
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                    )}
                    maxLength={100}
                  />
                  {validationErrors.quiz_name && (
                    <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                      {validationErrors.quiz_name}
                    </p>
                  )}
                </div>

                {/* Quiz Description */}
                <div>
                  <label htmlFor="quiz_description" className="block text-sm font-medium text-ink mb-2">
                    Mô tả
                  </label>
                  <textarea
                    id="quiz_description"
                    value={formData.quiz_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, quiz_description: e.target.value }))}
                    placeholder="Mô tả ngắn về quiz của bạn"
                    rows={3}
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
                    {formData.quiz_description.length}/500 ký tự
                  </p>
                </div>

                {/* Language */}
                <div>
                  <label htmlFor="quiz_language" className="block text-sm font-medium text-ink mb-2">
                    Ngôn ngữ <span className="text-danger">*</span>
                  </label>
                  <select
                    id="quiz_language"
                    value={formData.quiz_language}
                    onChange={(e) => setFormData(prev => ({ ...prev, quiz_language: e.target.value }))}
                    className={cn(
                      'w-full px-4 py-2 bg-bg border rounded-base',
                      'text-base text-ink',
                      'transition-all duration-base',
                      'focus:outline-none focus:ring-2',
                      'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                    )}
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="quiz_category" className="block text-sm font-medium text-ink mb-2">
                    Danh mục
                  </label>
                  <input
                    id="quiz_category"
                    type="text"
                    value={formData.quiz_category}
                    onChange={(e) => setFormData(prev => ({ ...prev, quiz_category: e.target.value }))}
                    placeholder="VD: Toán học, Lịch sử..."
                    className={cn(
                      'w-full px-4 py-2 bg-bg border rounded-base',
                      'text-base text-ink placeholder:text-ink-muted',
                      'transition-all duration-base',
                      'focus:outline-none focus:ring-2',
                      'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                    )}
                    maxLength={50}
                  />
                </div>

                {/* Quiz Image */}
                <div>
                  <label htmlFor="quiz_image" className="block text-sm font-medium text-ink mb-2">
                    Ảnh bìa
                  </label>
                  <input
                    id="quiz_image"
                    type="url"
                    value={formData.quiz_image}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, quiz_image: e.target.value }))
                      if (validationErrors.quiz_image) {
                        setValidationErrors(prev => {
                          const { quiz_image, ...rest } = prev
                          return rest
                        })
                      }
                    }}
                    placeholder="https://example.com/image.jpg"
                    className={cn(
                      'w-full px-4 py-2 bg-bg border rounded-base',
                      'text-base text-ink placeholder:text-ink-muted',
                      'transition-all duration-base',
                      'focus:outline-none focus:ring-2',
                      validationErrors.quiz_image
                        ? 'border-danger focus:ring-danger/30'
                        : 'border-border hover:border-border-strong focus:border-primary focus:ring-primary/30'
                    )}
                  />
                  {validationErrors.quiz_image && (
                    <p className="mt-1 text-xs text-danger" role="alert" aria-live="polite">
                      {validationErrors.quiz_image}
                    </p>
                  )}
                  {formData.quiz_image && !validationErrors.quiz_image && (
                    <div className="mt-2">
                      <img 
                        src={formData.quiz_image} 
                        alt="Quiz preview" 
                        className="w-full h-32 object-cover rounded-base"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          setValidationErrors(prev => ({ ...prev, quiz_image: 'URL ảnh không hợp lệ' }))
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Public/Private */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_public}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                      className={cn(
                        'w-4 h-4 rounded border-border',
                        'text-primary focus:ring-2 focus:ring-primary/30',
                        'transition-colors duration-base'
                      )}
                    />
                    <div>
                      <span className="text-sm font-medium text-ink">Quiz công khai</span>
                      <p className="text-xs text-ink-muted">Cho phép người khác tìm và chơi quiz này</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Questions */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-ink">
                Câu hỏi ({formData.questions.length})
              </h2>
              <button
                onClick={handleAddQuestion}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-base font-medium',
                  'bg-primary text-white',
                  'hover:bg-primary-hover',
                  'transition-all duration-base',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                )}
                aria-label="Thêm câu hỏi mới"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Thêm câu hỏi</span>
              </button>
            </div>

            {validationErrors.questions && (
              <div className="mb-4 p-4 bg-danger-subtle border border-danger-border rounded-base" role="alert" aria-live="polite">
                <p className="text-sm text-danger">{validationErrors.questions}</p>
              </div>
            )}

            {/* Questions List */}
            {formData.questions.length === 0 ? (
              <div className="text-center py-16 bg-surface border-2 border-dashed border-border rounded-lg">
                <div className="w-16 h-16 bg-primary-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">Chưa có câu hỏi</h3>
                <p className="text-sm text-ink-muted mb-6">
                  Thêm câu hỏi đầu tiên để bắt đầu tạo quiz
                </p>
                <button
                  onClick={handleAddQuestion}
                  className={cn(
                    'inline-flex items-center gap-2 px-6 py-3 rounded-base font-medium',
                    'bg-primary text-white',
                    'hover:bg-primary-hover',
                    'transition-all duration-base',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  )}
                  aria-label="Thêm câu hỏi đầu tiên"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span>Thêm câu hỏi đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className={cn(
                      'bg-surface border-2 rounded-lg p-4',
                      'transition-all duration-base',
                      activeQuestionIndex === index
                        ? 'border-primary'
                        : 'border-border hover:border-border-strong'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        className="mt-1 p-1 text-ink-muted hover:text-ink cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-base"
                        aria-label="Kéo để sắp xếp"
                      >
                        <GripVertical className="w-5 h-5" aria-hidden="true" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-ink-muted">
                                Câu hỏi {index + 1}
                              </span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                question.question_type === 'multiple_choice' && 'bg-blue-100 text-blue-700',
                                question.question_type === 'multiple_select' && 'bg-purple-100 text-purple-700',
                                question.question_type === 'short_answer' && 'bg-green-100 text-green-700',
                                question.question_type === 'long_answer' && 'bg-orange-100 text-orange-700'
                              )}>
                                {question.question_type === 'multiple_choice' && 'Một đáp án'}
                                {question.question_type === 'multiple_select' && 'Nhiều đáp án'}
                                {question.question_type === 'short_answer' && 'Trả lời ngắn'}
                                {question.question_type === 'long_answer' && 'Trả lời dài'}
                              </span>
                              <span className="text-xs text-ink-muted">
                                {question.time_limit}s
                              </span>
                            </div>
                            <h3 className="text-base font-medium text-ink mb-2">
                              {question.question_text || <span className="text-ink-muted italic">Chưa có nội dung</span>}
                            </h3>
                            
                            {/* Show answer options preview */}
                            {(question.question_type === 'multiple_choice' || question.question_type === 'multiple_select') && question.answer_options && question.answer_options.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {question.answer_options.map((option, optIndex) => {
                                  const letter = String.fromCharCode(65 + optIndex)
                                  let isCorrect = false
                                  
                                  if (question.question_type === 'multiple_choice') {
                                    const correctAnswer = question.correct_answer as { option_text: string }
                                    isCorrect = correctAnswer?.option_text === option.option_text
                                  } else if (question.question_type === 'multiple_select') {
                                    const correctAnswers = question.correct_answer
                                    isCorrect = Array.isArray(correctAnswers) && correctAnswers.some(ca => ca.option_text === option.option_text)
                                  }
                                  
                                  return (
                                    <div key={optIndex} className={cn(
                                      "text-sm flex items-start gap-2 px-2 py-1 rounded-base",
                                      isCorrect 
                                        ? "bg-success-subtle text-success border border-success-border" 
                                        : "text-ink-muted"
                                    )}>
                                      <span className={cn(
                                        "font-semibold min-w-[20px]",
                                        isCorrect ? "text-success" : "text-ink-muted"
                                      )}>
                                        {letter}.
                                      </span>
                                      <span className="flex-1">
                                        {option.option_text || <span className="italic">Đáp án trống</span>}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            
                            {/* Show correct answer preview */}
                            {(question.question_type === 'short_answer' || question.question_type === 'long_answer') && (
                              <div className="mt-2 text-sm">
                                <span className="text-ink-muted">Đáp án: </span>
                                <span className="text-ink">
                                  {(question.correct_answer as { option_text: string })?.option_text || <span className="italic text-ink-muted">Chưa có</span>}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteQuestion(index)}
                            className={cn(
                              'p-2 rounded-base text-danger-hover bg-danger-subtle',
                              'hover:bg-danger hover:text-white',
                              'transition-all duration-base',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30'
                            )}
                            aria-label={`Xóa câu hỏi ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleOpenQuestionEditor(index)}
                          className={cn(
                            'text-sm font-medium',
                            'text-primary hover:text-primary-hover',
                            'transition-colors duration-base',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-base px-2 py-1'
                          )}
                          aria-label={`Chỉnh sửa câu hỏi ${index + 1}`}
                        >
                          {activeQuestionIndex === index ? 'Thu gọn' : 'Chỉnh sửa'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question Editor Modal */}
      {activeQuestionIndex !== null && formData.questions[activeQuestionIndex] && (
        <QuestionEditor
          question={formData.questions[activeQuestionIndex]}
          index={activeQuestionIndex}
          onUpdate={handleUpdateQuestion}
          onClose={handleQuestionEditorClose}
          onSave={handleQuestionEditorSave}
          onCancel={handleQuestionEditorCancel}
        />
      )}

      {/* Quiz Preview Modal */}
      {showPreview && (
        <QuizPreview
          quiz={formData}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
