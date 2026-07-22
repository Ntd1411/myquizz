import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Clock, Globe, Users, BookOpen, AlertCircle, Loader2 } from 'lucide-react'
import { quizService, type Quiz } from '@/services/quiz.service'
import { gameService } from '@/services/game.service'
import { socketService } from '@/services/socket.service'
import { useAuthStore } from '@/stores/auth.store'
import type { Question } from '@/types/quiz.types'
import { cn } from '@/utils/cn'

export function QuizDetailPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [createGameError, setCreateGameError] = useState<string | null>(null)

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

  const handleCreateGame = async () => {
    if (!quiz || !quizId || !isAuthenticated) {
      setCreateGameError('Bạn cần đăng nhập để tạo phòng chơi')
      return
    }

    if (quiz.questions.length === 0) {
      setCreateGameError('Quiz phải có ít nhất 1 câu hỏi')
      return
    }

    setIsCreatingGame(true)
    setCreateGameError(null)

    try {
      // Tạo game session qua API
      const gameResponse = await gameService.createGame({
        quiz_id: parseInt(quizId),
        session_name: `${quiz.quiz_name} - ${new Date().toLocaleDateString('vi-VN')}`
      })

      // Connect socket nếu chưa connect
      let socket = socketService.getSocket()
      if (!socket || !socket.connected) {
        socket = socketService.connect()
        // Đợi socket connect
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Socket connection timeout'))
          }, 5000)

          if (socket?.connected) {
            clearTimeout(timeout)
            resolve()
          } else {
            socket?.once('connect', () => {
              clearTimeout(timeout)
              resolve()
            })
            socket?.once('connect_error', () => {
              clearTimeout(timeout)
              reject(new Error('Socket connection failed'))
            })
          }
        })
      }

      // Navigate trực tiếp đến waiting room với thông tin từ API
      // KHÔNG gọi joinRoom vì backend đã tạo player_session cho host rồi
      navigate(`/game/waiting/${gameResponse.session_code}`, {
        state: {
          playerName: user?.fullname || 'Host',
          roomCode: gameResponse.session_code,
          sessionId: gameResponse.session_id,
          playerSessionId: gameResponse.host_player_session_id,
          isHost: true,
          isCreator: true // Flag để biết đây là người tạo game
        }
      })

    } catch (err: any) {
      console.error('Error creating game:', err)
      
      if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
        setCreateGameError('Không thể kết nối với server. Vui lòng thử lại.')
      } else if (err.message?.includes('Socket connection')) {
        setCreateGameError('Lỗi kết nối socket. Vui lòng kiểm tra kết nối mạng.')
      } else if (err.response?.status === 404) {
        setCreateGameError('Quiz không tồn tại')
      } else if (err.response?.status === 403) {
        setCreateGameError('Bạn không có quyền tạo game với quiz này')
      } else {
        setCreateGameError(err.response?.data?.message || 'Không thể tạo phòng chơi. Vui lòng thử lại.')
      }
      setIsCreatingGame(false)
    }
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

        {/* Action Buttons */}
        <div className="mb-12">
          {/* Error Message */}
          {createGameError && (
            <div 
              className="mb-4 flex items-start gap-3 p-4 bg-danger-subtle border border-danger-border rounded-base"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-danger">{createGameError}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary Action - Tạo phòng chơi */}
            {isAuthenticated && (
              <button
                onClick={handleCreateGame}
                disabled={isCreatingGame || questionCount === 0}
                className={cn(
                  'flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-base text-lg',
                  'transition-all duration-base',
                  'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg',
                  'focus:outline-none focus:ring-4 focus:ring-primary/30',
                  'active:translate-y-0',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none'
                )}
                aria-label={isCreatingGame ? 'Đang tạo phòng chơi' : 'Tạo phòng chơi'}
              >
                {isCreatingGame ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                    <span>Đang tạo phòng...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6" aria-hidden="true" />
                    <span>Tạo phòng chơi</span>
                  </>
                )}
              </button>
            )}

            {/* Secondary Action - Join với mã */}
            <button
              onClick={handlePlayQuiz}
              className={cn(
                'flex items-center justify-center gap-3 px-8 py-4 bg-surface text-ink font-semibold rounded-base text-lg border-2 border-border',
                'transition-all duration-base',
                'hover:bg-surface-hover hover:border-primary/50',
                'focus:outline-none focus:ring-4 focus:ring-primary/30',
                isAuthenticated ? '' : 'flex-1'
              )}
            >
              <Users className="w-6 h-6" aria-hidden="true" />
              <span>Tham gia với mã</span>
            </button>
          </div>

          {/* Help Text */}
          {questionCount === 0 && isAuthenticated && (
            <p className="mt-3 text-sm text-ink-muted">
              Quiz cần có ít nhất 1 câu hỏi để tạo phòng chơi
            </p>
          )}
          
          {!isAuthenticated && (
            <p className="mt-3 text-sm text-ink-muted">
              <Link to="/auth/login" className="text-primary hover:underline">Đăng nhập</Link> để tạo phòng chơi của riêng bạn
            </p>
          )}
        </div>

        {/* Questions Preview */}
        {questionCount > 0 && (
          <div className="border-t border-border pt-8">
            <h2 className="text-2xl font-semibold text-ink mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" aria-hidden="true" />
              <span>Nội dung quiz</span>
            </h2>

            <div className="space-y-4">
              {quiz.questions.slice(0, 5).map((question: Question, index: number) => (
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
                        <span>{question.question_type === 'multiple_choice' ? 'Một đáp án' : question.question_type === 'multiple_select' ? 'Nhiều đáp án' : 'Văn bản'}</span>
                        <span>{question.time_limit}s</span>
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
