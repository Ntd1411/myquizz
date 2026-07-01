import { useEffect, useState, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { gameSocket } from '@/lib/socket'
import { Card, Button, LoadingSpinner } from '@/components/UI'
import { Users, Play, Copy, Check, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import type { GameSession, Question } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function GameHostPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [session] = useState<GameSession | null>(() => {
    const state = location.state as { session?: GameSession } | null
    return state?.session || null
  })
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [error, setError] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)
  const [startingGame, setStartingGame] = useState(false)
  const [loadingQuestion, setLoadingQuestion] = useState(false)
  const [finishingGame, setFinishingGame] = useState(false)

  const loadQuestionCallback = useCallback(
    async (index: number) => {
      setLoadingQuestion(true)
      setError('')
      try {
        if (!sessionId) return
        const question = await api.getQuestion(parseInt(sessionId), index)
        setCurrentQuestion(question)
        setQuestionIndex(index)
      } catch (error) {
        setError(`Không thể tải câu hỏi ${index + 1}. Vui lòng thử lại.`)
        console.error('Failed to load question:', error)
      } finally {
        setLoadingQuestion(false)
      }
    },
    [sessionId]
  )

  useEffect(() => {
    if (!sessionId || !session) {
      navigate('/dashboard')
      return
    }

    const numSessionId = parseInt(sessionId)
    if (isNaN(numSessionId)) {
      setError('ID phiên không hợp lệ')
      setLoading(false)
      return
    }

    try {
      gameSocket.connect(numSessionId, 0)
      setSocketConnected(true)
      setError('')
    } catch {
      setError('Không thể kết nối tới game server')
      setSocketConnected(false)
      setLoading(false)
      return
    }

    gameSocket.on('playerJoined', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('playerLeft', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('gameStarted', () => {
      setGameStatus('playing')
      void loadQuestionCallback(0)
    })

    gameSocket.on('gameFinished', () => {
      setGameStatus('finished')
      navigate(`/game/results/${sessionId}`)
    })

    setLoading(false)

    return () => {
      gameSocket.disconnect()
    }
  }, [sessionId, session, navigate, loadQuestionCallback])

  const loadQuestion = loadQuestionCallback

  const handleStartGame = async () => {
    if (playerCount === 0) {
      setError('Cần ít nhất 1 người chơi để bắt đầu')
      return
    }

    if (!sessionId) return

    setStartingGame(true)
    setError('')
    try {
      await api.startGame(parseInt(sessionId))
      setGameStatus('playing')
      await loadQuestion(0)
    } catch (error) {
      setError('Không thể bắt đầu game. Vui lòng thử lại.')
      console.error('Failed to start game:', error)
    } finally {
      setStartingGame(false)
    }
  }

  const handleNextQuestion = async () => {
    setLoadingQuestion(true)
    setError('')
    try {
      const nextIndex = questionIndex + 1
      await loadQuestion(nextIndex)
      gameSocket.emit('nextQuestion', { question_index: nextIndex })
    } catch (error) {
      setError('Không thể chuyển sang câu hỏi tiếp theo')
      console.error('Failed to load next question:', error)
    } finally {
      setLoadingQuestion(false)
    }
  }

  const handleFinishGame = async () => {
    if (!sessionId) return

    setFinishingGame(true)
    setError('')
    try {
      await api.finishGame(parseInt(sessionId))
      setGameStatus('finished')
      navigate(`/game/results/${sessionId}`)
    } catch (error) {
      setError('Không thể kết thúc game. Vui lòng thử lại.')
      setFinishingGame(false)
      console.error('Failed to finish game:', error)
    }
  }

  const copySessionCode = () => {
    if (!session) return
    void navigator.clipboard.writeText(session.session_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  if (error && !socketConnected) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
              <WifiSlash size={32} weight="duotone" className="text-error" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Lỗi kết nối</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">{error}</p>
            <Button onClick={() => navigate('/dashboard')} fullWidth>
              Quay lại Dashboard
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="max-w-2xl w-full">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <div className="text-center py-8">
                <h1 className="text-3xl font-semibold mb-6">Phòng chờ</h1>

                {error && (
                  <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                    <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
                    <p className="text-error text-sm text-left">{error}</p>
                  </div>
                )}

                {!socketConnected && (
                  <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
                    <WifiSlash size={20} weight="duotone" className="text-warning" />
                    <p className="text-warning text-sm">Đang kết nối lại...</p>
                  </div>
                )}

                <div className="mb-8">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Chia sẻ mã này với người chơi
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-5xl font-bold font-mono tracking-wider text-primary">
                      {session?.session_code}
                    </div>
                    <button
                      onClick={copySessionCode}
                      className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {copied ? <Check size={24} className="text-success" /> : <Copy size={24} />}
                    </button>
                  </div>
                </div>

                <div className="mb-8 p-6 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Users size={24} className="text-primary" weight="duotone" />
                    <span className="text-2xl font-bold">{playerCount}</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {playerCount === 0 ? 'Đang chờ người chơi' : `${playerCount} người chơi đã kết nối`}
                  </p>
                </div>

                <Button
                  onClick={() => void handleStartGame()}
                  disabled={playerCount === 0 || startingGame || !socketConnected}
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  {startingGame ? (
                    <LoadingSpinner size={20} />
                  ) : (
                    <>
                      <Play size={20} weight="fill" />
                      <span>Bắt đầu Game</span>
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Câu hỏi {questionIndex + 1}
          </div>
          <div className="flex items-center gap-2">
            <Users size={20} weight="duotone" />
            <span className="font-semibold">{playerCount}</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
            <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {!socketConnected && (
          <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
            <WifiSlash size={20} weight="duotone" className="text-warning" />
            <p className="text-warning text-sm">Mất kết nối với server. Đang thử kết nối lại...</p>
          </div>
        )}

        {loadingQuestion ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size={48} />
            </div>
          </Card>
        ) : currentQuestion ? (
          <Card>
            <h2 className="text-2xl font-semibold mb-6 leading-snug">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-2 mb-8">
              {currentQuestion.question_type === 'multiple_choice' &&
                currentQuestion.options?.map((option, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                  >
                    <span className="font-medium">{option}</span>
                  </div>
                ))}
            </div>

            <div className="p-4 bg-success/10 border border-success/20 rounded-lg mb-8">
              <p className="text-sm font-medium text-success">
                Đáp án đúng: {currentQuestion.correct_answer}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => void handleNextQuestion()}
                variant="secondary"
                disabled={loadingQuestion || !socketConnected}
              >
                Câu tiếp theo
              </Button>
              <Button
                onClick={() => void handleFinishGame()}
                variant="primary"
                disabled={finishingGame || !socketConnected}
              >
                {finishingGame ? 'Đang kết thúc...' : 'Kết thúc Game'}
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-zinc-600 dark:text-zinc-400">Không thể tải câu hỏi</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
