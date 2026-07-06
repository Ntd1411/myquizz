import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { socketService, type Question, type AnswerResult } from '@/services/socket.service'
import { cn } from '@/utils/cn'

export function QuizPlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [question, setQuestion] = useState<Question | null>(location.state?.firstQuestion || null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionStartTime = useRef<number>(Date.now())

  const playerName = location.state?.playerName
  const sessionId = location.state?.sessionId
  const playerSessionId = location.state?.playerSessionId

  // Initialize timer when question changes
  useEffect(() => {
    if (question) {
      setTimeLeft(question.time_limit)
      questionStartTime.current = Date.now()
      setSelectedAnswer(null)
      setAnswerResult(null)
      setIsSubmitting(false)
    }
  }, [question])

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || answerResult || isCompleted) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto submit when time runs out
          if (selectedAnswer !== null && !isSubmitting) {
            handleSubmitAnswer(selectedAnswer)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [timeLeft, answerResult, isCompleted, selectedAnswer, isSubmitting])

  // Socket listeners
  useEffect(() => {
    // Listen for answer result
    socketService.onAnswerResult((result) => {
      setAnswerResult(result)
      setIsSubmitting(false)
    })

    // Listen for next question
    socketService.onNextQuestion((data) => {
      setQuestion(data.question)
      setCurrentIndex(data.current_index)
      setTotalQuestions(data.total_questions)
    })

    // Listen for completion
    socketService.onPlayerCompleted((data) => {
      console.log('Player completed:', data)
      setIsCompleted(true)
      // Wait a bit then navigate to result
      setTimeout(() => {
        navigate(`/game/result/${roomCode}`, {
          state: {
            playerName,
            sessionId
          }
        })
      }, 2000)
    })

    // Listen for errors
    socketService.onError((data) => {
      setError(data.message)
      setIsSubmitting(false)
    })

    return () => {
      socketService.off('answer:result')
      socketService.off('question:next-for-player')
      socketService.off('player:completed')
      socketService.off('error')
    }
  }, [navigate, roomCode, playerName, sessionId])

  const handleSubmitAnswer = (answerId: number) => {
    if (isSubmitting || answerResult || !question) return

    const timeTaken = Math.floor((Date.now() - questionStartTime.current) / 1000)
    setIsSubmitting(true)
    setError(null)

    try {
      socketService.submitAnswer({
        player_session_id: playerSessionId,
        question_id: question.question_id,
        answer_id: answerId,
        time_taken: timeTaken,
        session_id: sessionId
      })
    } catch (err) {
      console.error('Submit answer error:', err)
      setError('Không thể gửi câu trả lời. Vui lòng thử lại.')
      setIsSubmitting(false)
    }
  }

  const handleAnswerClick = (answerId: number) => {
    if (answerResult || isSubmitting || timeLeft <= 0) return
    
    setSelectedAnswer(answerId)
    handleSubmitAnswer(answerId)
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">Đang tải câu hỏi...</p>
        </div>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-ink mb-2">Hoàn thành!</h2>
          <p className="text-ink-muted">Đang chuyển đến kết quả...</p>
        </div>
      </div>
    )
  }

  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0
  const timerPercent = question.time_limit > 0 ? (timeLeft / question.time_limit) * 100 : 0
  const isTimeWarning = timeLeft <= 5 && timeLeft > 0

  return (
    <div className="min-h-screen bg-bg">
      {/* Progress Bar */}
      <div className="h-2 bg-surface border-b border-border">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
        />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-sm text-ink-muted">
            Câu hỏi {currentIndex + 1} / {totalQuestions}
          </div>
          
          {/* Timer */}
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-base border font-semibold transition-all duration-base',
            isTimeWarning
              ? 'bg-warning-subtle border-warning text-warning animate-pulse'
              : 'bg-surface border-border text-ink'
          )}>
            <Clock className="w-5 h-5" aria-hidden="true" />
            <span className="text-lg min-w-[3ch] text-right">{timeLeft}s</span>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="mb-8 h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear',
              isTimeWarning ? 'bg-warning' : 'bg-primary'
            )}
            style={{ width: `${timerPercent}%` }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-6 flex items-start gap-3 p-4 bg-danger-subtle border border-danger-border rounded-base"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Question */}
        <div className="bg-surface border border-border rounded-lg p-8 mb-8 text-center">
          <h2 className="text-2xl font-semibold text-ink leading-snug">
            {question.text}
          </h2>
        </div>

        {/* Answers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {question.answers.map((answer, index) => {
            const isSelected = selectedAnswer === answer.id
            const isCorrect = answerResult?.correct_answer_id === answer.id
            const isWrong = isSelected && answerResult && !answerResult.is_correct
            const showResult = answerResult !== null

            return (
              <button
                key={answer.id}
                onClick={() => handleAnswerClick(answer.id)}
                disabled={showResult || isSubmitting || timeLeft <= 0}
                className={cn(
                  'relative p-6 rounded-lg border-2 text-left',
                  'transition-all duration-base',
                  'focus:outline-none focus:ring-4',
                  !showResult && !isSubmitting && timeLeft > 0 && cn(
                    'hover:border-primary hover:bg-surface-hover hover:-translate-y-1 hover:shadow-lg',
                    isSelected ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'
                  ),
                  showResult && isCorrect && 'border-success bg-success-subtle',
                  showResult && isWrong && 'border-danger bg-danger-subtle',
                  showResult && !isCorrect && !isSelected && 'border-border bg-surface opacity-60',
                  (isSubmitting || timeLeft <= 0) && 'cursor-not-allowed opacity-60'
                )}
              >
                {/* Answer Letter */}
                <div className={cn(
                  'absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center',
                  'font-semibold text-sm border-2',
                  !showResult && (isSelected ? 'bg-primary text-white border-primary' : 'bg-surface text-ink-muted border-border'),
                  showResult && isCorrect && 'bg-success text-white border-success',
                  showResult && isWrong && 'bg-danger text-white border-danger'
                )}>
                  {String.fromCharCode(65 + index)}
                </div>

                {/* Answer Text */}
                <p className="text-lg text-ink font-medium pl-4">
                  {answer.text}
                </p>

                {/* Result Icons */}
                {showResult && isCorrect && (
                  <CheckCircle2 className="absolute top-4 right-4 w-6 h-6 text-success" aria-label="Đúng" />
                )}
                {showResult && isWrong && (
                  <XCircle className="absolute top-4 right-4 w-6 h-6 text-danger" aria-label="Sai" />
                )}
              </button>
            )
          })}
        </div>

        {/* Result Feedback */}
        {answerResult && (
          <div className={cn(
            'mt-8 p-6 rounded-lg text-center',
            answerResult.is_correct ? 'bg-success-subtle' : 'bg-danger-subtle'
          )}>
            <div className="flex items-center justify-center gap-3 mb-2">
              {answerResult.is_correct ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-success" aria-hidden="true" />
                  <h3 className="text-2xl font-bold text-success">Chính xác!</h3>
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 text-danger" aria-hidden="true" />
                  <h3 className="text-2xl font-bold text-danger">Sai rồi!</h3>
                </>
              )}
            </div>
            <p className="text-lg text-ink">
              {answerResult.is_correct ? `+${answerResult.score_earned} điểm` : 'Không được điểm'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
