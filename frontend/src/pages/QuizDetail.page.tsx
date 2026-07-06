import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Clock, Globe, Users, BookOpen, AlertCircle } from 'lucide-react'
import { quizService, type Quiz } from '@/services/quiz.service'
import { cn } from '@/utils/cn'

export function QuizDetailPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!quizId) return

    const fetchQuiz = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await quizService.getQuizById(quizId)
        setQuiz(data)
      } catch (err: any) {
        console.error('Error fetching quiz:', err)
        if (err.response?.status === 404) {
          setError('Quiz không tồn tại hoặc đã bị xóa.')
        } else {
          setError('Đã xảy ra lỗi khi tải quiz. Vui lòng thử lại.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuiz()
  }, [quizId])

  const handlePlayQuiz = () => {
    // Navigate to join room page to start a game
    navigate('/game/join')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back button skeleton */}
          <div className="mb-6 h-10 w-24 bg-surface-hover rounded-base animate-pulse" />

          {/* Hero skeleton */}
          <div className="mb-8 space-y-4">
            <div className="aspect-video w-full bg-surface-hover rounded-lg animate-pulse" />
            <div className="h-10 bg-surface-hover rounded animate-pulse" />
            <div className="h-6 bg-surface-hover rounded animate-pulse w-32" />
          </div>

          {/* Metadata skeleton */}
          <div className="mb-8 flex flex-wrap gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-32 bg-surface-hover rounded animate-pulse" />
            ))}
          </div>

          {/* Description skeleton */}
          <div className="space-y-2">
            <div className="h-4 bg-surface-hover rounded animate-pulse" />
            <div className="h-4 bg-surface-hover rounded animate-pulse" />
            <div className="h-4 bg-surface-hover rounded animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-bg py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            to="/explore"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 mb-8',
              'text-sm font-medium text-ink-muted hover:text-ink',
              'transition-colors duration-base',
              'focus:outline-none focus:ring-2 focus:ring-primary rounded-base'
            )}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay lại</span>
          </Link>

          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <AlertCircle className="w-16 h-16 text-danger mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-ink mb-2">
              {error?.includes('không tồn tại') ? 'Quiz không tồn tại' : 'Đã xảy ra lỗi'}
            </h1>
            <p className="text-ink-muted mb-6 max-w-md">{error}</p>
            <button
              onClick={() => navigate('/explore')}
              className={cn(
                'px-6 py-3 bg-primary text-white font-medium rounded-base',
                'transition-all duration-base',
                'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-sm',
                'focus:outline-none focus:ring-4 focus:ring-primary/30'
              )}
            >
              Khám phá quiz khác
            </button>
          </div>
        </div>
      </div>
    )
  }

  const questionCount = quiz.questions?.length || 0
  const ownerName = quiz.owner?.fullname || 'Unknown'

  return (
    <div className="min-h-screen bg-bg py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <Link
          to="/explore"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 mb-8',
            'text-sm font-medium text-ink-muted hover:text-ink',
            'transition-colors duration-base',
            'focus:outline-none focus:ring-2 focus:ring-primary rounded-base'
          )}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Quay lại</span>
        </Link>

        {/* Hero Section */}
        <div className="mb-8">
          {/* Quiz Image */}
          {quiz.quiz_image ? (
            <div className="aspect-video w-full mb-6 rounded-lg overflow-hidden bg-surface">
              <img
                src={quiz.quiz_image}
                alt={quiz.quiz_name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className="aspect-video w-full mb-6 rounded-lg overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, oklch(0.92 0.035 212), oklch(0.88 0.055 212))'
              }}
            >
              <BookOpen className="w-24 h-24 text-primary opacity-40" aria-hidden="true" />
            </div>
          )}

          {/* Title & Category */}
          <h1 className="text-4xl font-bold text-ink mb-4 leading-tight">
            {quiz.quiz_name}
          </h1>

          {quiz.quiz_category && (
            <span className="inline-block px-3 py-1.5 text-sm font-medium text-primary bg-primary-subtle border border-primary-border rounded-base">
              {quiz.quiz_category}
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="mb-8 flex flex-wrap gap-6 text-ink-muted">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">
              <strong className="text-ink font-semibold">{questionCount}</strong> câu hỏi
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">
              Tác giả: <strong className="text-ink font-semibold">{ownerName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">
              {quiz.quiz_language === 'vi' ? 'Tiếng Việt' : quiz.quiz_language === 'en' ? 'English' : quiz.quiz_language}
            </span>
          </div>
        </div>

        {/* Description */}
        {quiz.quiz_description && (
          <div className="mb-8 prose prose-base max-w-none">
            <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">
              {quiz.quiz_description}
            </p>
          </div>
        )}

        {/* Play Button */}
        <div className="mb-12">
          <button
            onClick={handlePlayQuiz}
            className={cn(
              'flex items-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-base text-lg',
              'transition-all duration-base',
              'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg',
              'focus:outline-none focus:ring-4 focus:ring-primary/30',
              'active:translate-y-0'
            )}
          >
            <Play className="w-6 h-6" aria-hidden="true" />
            <span>Chơi quiz này</span>
          </button>
        </div>

        {/* Questions Preview */}
        {questionCount > 0 && (
          <div className="border-t border-border pt-8">
            <h2 className="text-2xl font-semibold text-ink mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" aria-hidden="true" />
              <span>Nội dung quiz</span>
            </h2>

            <div className="space-y-4">
              {quiz.questions.slice(0, 5).map((question, index) => (
                <div
                  key={question.id}
                  className="p-4 bg-surface border border-border rounded-base"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-subtle text-primary font-semibold rounded-base text-sm">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-ink font-medium">
                        {question.question_text}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
                        <span>{question.question_type === 'single' ? 'Một đáp án' : question.question_type === 'multiple' ? 'Nhiều đáp án' : 'Đúng/Sai'}</span>
                        <span>{question.question_time_limit}s</span>
                        <span>{question.question_points} điểm</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {questionCount > 5 && (
                <p className="text-sm text-ink-muted text-center py-2">
                  và {questionCount - 5} câu hỏi khác...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
