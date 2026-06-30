import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { gameSocket } from '@/lib/socket'
import { Card, Button, LoadingSpinner } from '@/components/UI'
import { Users, Play, Copy, Check } from '@phosphor-icons/react'
import type { GameSession, Question } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function GameHostPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [session] = useState<GameSession>(location.state?.session)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)

  useEffect(() => {
    if (!sessionId || !session) {
      navigate('/dashboard')
      return
    }

    gameSocket.connect(parseInt(sessionId), 0)

    gameSocket.on('playerJoined', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('playerLeft', (data) => {
      setPlayerCount(data.player_count)
    })

    gameSocket.on('gameStarted', async () => {
      setGameStatus('playing')
      await loadQuestion(0)
    })

    gameSocket.on('gameFinished', () => {
      setGameStatus('finished')
      navigate(`/game/results/${sessionId}`)
    })

    setLoading(false)

    return () => {
      gameSocket.disconnect()
    }
  }, [sessionId, session, navigate])

  const loadQuestion = async (index: number) => {
    try {
      const question = await api.getQuestion(parseInt(sessionId!), index)
      setCurrentQuestion(question)
      setQuestionIndex(index)
    } catch (err) {
      console.error('Failed to load question:', err)
    }
  }

  const handleStartGame = async () => {
    try {
      await api.startGame(parseInt(sessionId!))
      setGameStatus('playing')
      await loadQuestion(0)
    } catch (err) {
      alert('Failed to start game')
    }
  }

  const handleNextQuestion = async () => {
    const nextIndex = questionIndex + 1
    await loadQuestion(nextIndex)
    gameSocket.emit('nextQuestion', { question_index: nextIndex })
  }

  const handleFinishGame = async () => {
    try {
      await api.finishGame(parseInt(sessionId!))
      setGameStatus('finished')
      navigate(`/game/results/${sessionId}`)
    } catch (err) {
      alert('Failed to finish game')
    }
  }

  const copySessionCode = () => {
    navigator.clipboard.writeText(session.session_code)
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
                <h1 className="text-3xl font-semibold mb-6">Game Lobby</h1>

                <div className="mb-8">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                    Share this code with players
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-5xl font-bold font-mono tracking-wider text-primary">
                      {session.session_code}
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
                    {playerCount === 0 ? 'Waiting for players' : `${playerCount} player${playerCount !== 1 ? 's' : ''} connected`}
                  </p>
                </div>

                <Button
                  onClick={handleStartGame}
                  disabled={playerCount === 0}
                  fullWidth
                  className="flex items-center justify-center gap-2"
                >
                  <Play size={20} weight="fill" />
                  <span>Start Game</span>
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
            Question {questionIndex + 1}
          </div>
          <div className="flex items-center gap-2">
            <Users size={20} weight="duotone" />
            <span className="font-semibold">{playerCount}</span>
          </div>
        </div>

        {currentQuestion && (
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
                Correct Answer: {currentQuestion.correct_answer}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleNextQuestion} variant="secondary">
                Next Question
              </Button>
              <Button onClick={handleFinishGame} variant="primary">
                Finish Game
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
