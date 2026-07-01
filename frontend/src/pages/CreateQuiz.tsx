import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, Input, TextArea, Select, Button } from '@/components/UI'
import { Plus, Trash, ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import type { Quiz, Question } from '@/types'

export default function CreateQuizPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [showExitWarning, setShowExitWarning] = useState(false)

  const [quizData, setQuizData] = useState<Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'created_by'>>({
    title: '',
    description: '',
    category: '',
    language: 'en',
    difficulty: 'medium',
    time_limit: 30,
    is_public: true,
    questions: []
  })

  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 100,
      time_limit: 30,
      order_index: 0
    }
  ])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasChanges])

  const handleBack = () => {
    if (hasChanges) {
      setShowExitWarning(true)
    } else {
      navigate('/dashboard')
    }
  }

  const updateQuizField = (field: string, value: string | boolean) => {
    setQuizData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const updateQuestion = (index: number, field: string, value: string | string[] | number) => {
    setQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setHasChanges(true)
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const options = [...(updated[questionIndex].options || [])]
      options[optionIndex] = value
      updated[questionIndex] = { ...updated[questionIndex], options }
      return updated
    })
    setHasChanges(true)
  }

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
        points: 100,
        time_limit: 30,
        order_index: prev.length
      }
    ])
    setHasChanges(true)
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      setError('Quiz phải có ít nhất một câu hỏi')
      return
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i })))
    setHasChanges(true)
  }

  const handleSubmit = async () => {
    setError('')

    // Validate quiz title
    if (!quizData.title.trim()) {
      setError('Tiêu đề quiz không được để trống')
      return
    }

    if (quizData.title.length > 200) {
      setError('Tiêu đề quiz không được vượt quá 200 ký tự')
      return
    }

    // Validate questions exist
    if (questions.length === 0) {
      setError('Quiz phải có ít nhất một câu hỏi')
      return
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      if (!q.question_text.trim()) {
        setError(`Câu hỏi ${i + 1}: Nội dung câu hỏi không được để trống`)
        return
      }

      if (q.question_text.length > 500) {
        setError(`Câu hỏi ${i + 1}: Nội dung không được vượt quá 500 ký tự`)
        return
      }

      if (q.question_type === 'multiple_choice') {
        if (!q.options || q.options.length < 2) {
          setError(`Câu hỏi ${i + 1}: Phải có ít nhất 2 lựa chọn`)
          return
        }

        const nonEmptyOptions = q.options.filter(opt => opt.trim())
        if (nonEmptyOptions.length < 2) {
          setError(`Câu hỏi ${i + 1}: Phải có ít nhất 2 lựa chọn có nội dung`)
          return
        }

        if (q.options.some(opt => opt.length > 200)) {
          setError(`Câu hỏi ${i + 1}: Mỗi lựa chọn không được vượt quá 200 ký tự`)
          return
        }
      }

      if (!q.correct_answer || (typeof q.correct_answer === 'string' && !q.correct_answer.trim())) {
        setError(`Câu hỏi ${i + 1}: Vui lòng nhập đáp án đúng`)
        return
      }

      if (q.question_type === 'multiple_choice' && typeof q.correct_answer === 'string' && !q.options?.includes(q.correct_answer)) {
        setError(`Câu hỏi ${i + 1}: Đáp án đúng phải là một trong các lựa chọn`)
        return
      }

      if (q.points <= 0) {
        setError(`Câu hỏi ${i + 1}: Điểm phải lớn hơn 0`)
        return
      }

      if (q.time_limit !== undefined && q.time_limit <= 0) {
        setError(`Câu hỏi ${i + 1}: Thời gian phải lớn hơn 0`)
        return
      }
    }

    setLoading(true)

    try {
      await api.createQuiz({ ...quizData, questions })
      setHasChanges(false)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo quiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>

        <h1 className="text-4xl font-semibold tracking-tight mb-8">Create New Quiz</h1>

        {error && (
          <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm mb-6">
            {error}
          </div>
        )}

        <Card className="mb-8">
          <h2 className="text-xl font-semibold mb-6">Quiz Details</h2>
          <div className="space-y-6">
            <Input
              label="Quiz Title"
              placeholder="Enter quiz title"
              value={quizData.title}
              onChange={(value) => updateQuizField('title', value)}
              required
            />
            <TextArea
              label="Description"
              placeholder="Describe your quiz"
              value={quizData.description || ''}
              onChange={(value) => updateQuizField('description', value)}
              rows={3}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Category"
                placeholder="e.g., Science, History"
                value={quizData.category || ''}
                onChange={(value) => updateQuizField('category', value)}
              />
              <Select
                label="Difficulty"
                value={quizData.difficulty || 'medium'}
                onChange={(value) => updateQuizField('difficulty', value)}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' }
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_public"
                checked={quizData.is_public}
                onChange={(e) => updateQuizField('is_public', e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <label htmlFor="is_public" className="text-sm font-medium">
                Make this quiz public
              </label>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Questions</h2>
            <Button onClick={addQuestion} variant="secondary" className="flex items-center gap-2">
              <Plus size={20} />
              <span>Add Question</span>
            </Button>
          </div>

          {questions.map((question, index) => (
            <Card key={index}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">Question {index + 1}</h3>
                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(index)}
                    className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors"
                  >
                    <Trash size={20} />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <TextArea
                  label="Question Text"
                  placeholder="Enter your question"
                  value={question.question_text}
                  onChange={(value) => updateQuestion(index, 'question_text', value)}
                  required
                  rows={2}
                />

                <Select
                  label="Question Type"
                  value={question.question_type}
                  onChange={(value) => updateQuestion(index, 'question_type', value)}
                  options={[
                    { value: 'multiple_choice', label: 'Multiple Choice' },
                    { value: 'true_false', label: 'True/False' }
                  ]}
                />

                {question.question_type === 'multiple_choice' && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Options</label>
                    {(question.options || []).map((option, optIndex) => (
                      <Input
                        key={optIndex}
                        placeholder={`Option ${optIndex + 1}`}
                        value={option}
                        onChange={(value) => updateQuestionOption(index, optIndex, value)}
                      />
                    ))}
                  </div>
                )}

                <Input
                  label="Correct Answer"
                  placeholder="Enter the correct answer"
                  value={question.correct_answer as string}
                  onChange={(value) => updateQuestion(index, 'correct_answer', value)}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Points"
                    type="number"
                    value={String(question.points)}
                    onChange={(value) => updateQuestion(index, 'points', parseInt(value) || 100)}
                  />
                  <Input
                    label="Time Limit (seconds)"
                    type="number"
                    value={String(question.time_limit || 30)}
                    onChange={(value) => updateQuestion(index, 'time_limit', parseInt(value) || 30)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <Button onClick={() => void handleSubmit()} disabled={loading} fullWidth>
            {loading ? 'Creating...' : 'Create Quiz'}
          </Button>
          <Button onClick={handleBack} variant="secondary">
            Cancel
          </Button>
        </div>

        {showExitWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <WarningCircle size={24} weight="fill" className="text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Bạn có thay đổi chưa lưu</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Nếu rời khỏi trang này, các thay đổi của bạn sẽ bị mất. Bạn có chắc chắn muốn tiếp tục?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowExitWarning(false)}
                >
                  Ở lại
                </Button>
                <button
                  onClick={() => {
                    setHasChanges(false)
                    navigate('/dashboard')
                  }}
                  className="px-6 py-3 bg-error hover:bg-error/90 text-white font-medium rounded-lg transition-colors"
                >
                  Rời khỏi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
