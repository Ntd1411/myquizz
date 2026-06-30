import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, Input, TextArea, Select, Button } from '@/components/UI'
import { Plus, Trash, ArrowLeft } from '@phosphor-icons/react'
import type { Quiz, Question } from '@/types'

export default function CreateQuizPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [quizData, setQuizData] = useState<Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'created_by'>>({
    title: '',
    description: '',
    category: '',
    language: 'en',
    difficulty: 'medium',
    time_limit: 30,
    is_public: true,
    questions: [],
  })

  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      points: 100,
      time_limit: 30,
      order_index: 0,
    },
  ])

  const updateQuizField = (field: string, value: any) => {
    setQuizData((prev) => ({ ...prev, [field]: value }))
  }

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setQuestions((prev) => {
      const updated = [...prev]
      const options = [...(updated[questionIndex].options || [])]
      options[optionIndex] = value
      updated[questionIndex] = { ...updated[questionIndex], options }
      return updated
    })
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
        order_index: prev.length,
      },
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i })))
  }

  const handleSubmit = async () => {
    setError('')

    if (!quizData.title.trim()) {
      setError('Quiz title is required')
      return
    }

    if (questions.length === 0) {
      setError('Add at least one question')
      return
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} text is required`)
        return
      }
      if (q.question_type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
        setError(`Question ${i + 1} needs at least 2 options`)
        return
      }
      if (!q.correct_answer) {
        setError(`Question ${i + 1} must have a correct answer`)
        return
      }
    }

    setLoading(true)

    try {
      await api.createQuiz({ ...quizData, questions })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
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
                  { value: 'hard', label: 'Hard' },
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
                    { value: 'true_false', label: 'True/False' },
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
          <Button onClick={handleSubmit} disabled={loading} fullWidth>
            {loading ? 'Creating...' : 'Create Quiz'}
          </Button>
          <Button onClick={() => navigate('/dashboard')} variant="secondary">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
