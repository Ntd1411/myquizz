import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { gameSocket } from '@/lib/socket'
import { Card, Button, LoadingSpinner } from '@/components/UI'
import { Crown, Medal } from '@phosphor-icons/react'
import type { Question, LeaderboardEntry, PlayerSession } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function GamePlayerPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [playerSession] = useState<PlayerSession>(location.state?.playerSession)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [hasAnswered, setHasAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [playerCount, setPlayerCount] = useState(1)

  useEffect(() => {
    if (!sessionId || !playerSession) {
      navigate('/home')
      return
    }

    gameSocket.connect(parseInt(sessionId), playerSession.id)

    gameSocket.on('playerJoined', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('playerLeft', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('gameStarted', async (data) => {
      setGameStatus('playing')
      await loadQuestion(data.current_question)
    })

    gameSocket.on('questionChanged', async (data) => {
      setQuestionIndex(data.question_index)
      setSelectedAnswer('')
      setHasAnswered(false)
      setTimeLeft(data.time_limit)
      await loadQuestion(data.question_index)
    })

    gameSocket.on('leaderboardUpdated', (data) => {
      setLeaderboard(data.leaderboard)
    })

    gameSocket.on('gameFinished', (data) => {
      setGameStatus('finished')
      setLeaderboard(data.final_scores)
    })

    gameSocket.on('error', (data) => {
      console.error('Game error:', data.message)
    })

    setLoading(false)

    return () => {
      gameSocket.disconnect()
    }
  }, [sessionId, playerSession, navigate])

  useEffect(() => {
    if (gameStatus !== 'playing' || hasAnswered) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitAnswer()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameStatus, hasAnswered])

  const loadQuestion = async (index: number) => {
    try {
      const question = await api.getQuestion(parseInt(sessionId!), index)
      setCurrentQuestion(question)
      setTimeLeft(question.time_limit || 30)
    } catch (err) {
      console.error('Failed to load question:', err)
    }
  }

  const handleSubmitAnswer = () => {
    if (hasAnswered || !currentQuestion) return

    const timeSpent = (currentQuestion.time_limit || 30) - timeLeft
    gameSocket.submitAnswer(playerSession.id, selectedAnswer, timeSpent)
    setHasAnswered(true)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    )
  }

  if (gameStatus === 'waiting') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-md"
        >
          <Card>
            <div className="py-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
              >
                <div className="w-12 h-12 rounded-full bg-primary" />
              </motion.div>
              <h2 className="text-2xl font-semibold mb-3">Waiting for host</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                The game will start soon. {playerCount} {playerCount === 1 ? 'player' : 'players'} connected.
              </p>
              <div className="text-sm text-zinc-500">
                Session Code: <span className="font-mono font-bold text-lg">{sessionId}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  if (gameStatus === 'finished') {
    const myRank = leaderboard.findIndex(
      (entry) => entry.player_name === playerSession.player_name
    )

    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-semibold mb-4">Game Over!</h1>
            {myRank !== -1 && (
              <p className="text-xl text-zinc-600 dark:text-zinc-400">
                You finished in{' '}
                <span className="font-bold text-primary">
                  {myRank + 1}
                  {myRank === 0 ? 'st' : myRank === 1 ? 'nd' : myRank === 2 ? 'rd' : 'th'}
                </span>{' '}
                place
              </p>
            )}
          </motion.div>

          <Card>
            <h2 className="text-xl font-semibold mb-6">Final Leaderboard</h2>
            <div className="space-y-3">
              {leaderboard.map((entry, index) => {
                const isMe = entry.player_name === playerSession.player_name
                return (
                  <motion.div
                    key={index}
                    initial={reduce ? false : { opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.1,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`flex items-center gap-4 p-4 rounded-lg ${
                      isMe
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-zinc-50 dark:bg-zinc-800'
                    }`}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center">
                      {index === 0 ? (
                        <Crown size={24} weight="fill" className="text-warning" />
                      ) : index === 1 ? (
                        <Medal size={24} weight="fill" className="text-zinc-400" />
                      ) : index === 2 ? (
                        <Medal size={24} weight="fill" className="text-orange-600" />
                      ) : (
                        <span className="font-bold text-zinc-500">#{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isMe ? 'text-primary' : ''}`}>
                        {entry.player_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{entry.score}</p>
                      <p className="text-xs text-zinc-500">points</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </Card>

          <div className="mt-8 text-center">
            <Button onClick={() => navigate('/home')}>Back to Home</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Question {questionIndex + 1}
          </div>
          <div className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-error' : 'text-primary'}`}>
            {timeLeft}s
          </div>
        </div>

        {currentQuestion && (
          <Card>
            <h2 className="text-2xl font-semibold mb-8 leading-snug">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3">
              {currentQuestion.question_type === 'multiple_choice' &&
                currentQuestion.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !hasAnswered && setSelectedAnswer(option)}
                    disabled={hasAnswered}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      selectedAnswer === option
                        ? 'border-primary bg-primary/10'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-primary/50'
                    } ${hasAnswered ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-medium">{option}</span>
                  </button>
                ))}
            </div>

            <div className="mt-8">
              <Button
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer || hasAnswered}
                fullWidth
              >
                {hasAnswered ? 'Answer Submitted' : 'Submit Answer'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
