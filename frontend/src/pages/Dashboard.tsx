import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Card, Button, LoadingSpinner } from '@/components/UI'
import { Plus, GameController, Pencil, Trash, Play } from '@phosphor-icons/react'
import type { Quiz } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const user = useAuthStore((state) => state.user)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMyQuizzes()
  }, [user])

  const loadMyQuizzes = async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await api.listQuizzes(user.id, 1, 20)
      setQuizzes(response.quizzes)
    } catch (err) {
      console.error('Failed to load quizzes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateQuiz = () => {
    navigate('/dashboard/create')
  }

  const handleEditQuiz = (quizId: number) => {
    navigate(`/dashboard/edit/${quizId}`)
  }

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return
    try {
      await api.deleteQuiz(quizId)
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId))
    } catch (err) {
      alert('Failed to delete quiz')
    }
  }

  const handleStartGame = async (quizId: number) => {
    try {
      const session = await api.createGame(quizId)
      navigate(`/game/host/${session.id}`, { state: { session } })
    } catch (err) {
      alert('Failed to create game session')
    }
  }

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
              My Quizzes
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Create and manage your quiz library
            </p>
          </div>
          <Button onClick={handleCreateQuiz} className="flex items-center gap-2">
            <Plus size={20} weight="bold" />
            <span>Create Quiz</span>
          </Button>
        </motion.div>

        {loading ? (
          <div className="py-20">
            <LoadingSpinner size={40} />
          </div>
        ) : quizzes.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
              <GameController size={48} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">No quizzes yet</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
              Create your first quiz to start hosting interactive learning sessions
            </p>
            <Button onClick={handleCreateQuiz} className="flex items-center gap-2 mx-auto">
              <Plus size={20} weight="bold" />
              <span>Create Your First Quiz</span>
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz, index) => (
              <motion.div
                key={quiz.id}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Card hover className="h-full flex flex-col">
                  {quiz.thumbnail && (
                    <img
                      src={quiz.thumbnail}
                      alt={quiz.title}
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="text-lg font-semibold mb-2 line-clamp-2">{quiz.title}</h3>
                  {quiz.description && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 flex-1">
                      {quiz.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                    {quiz.category && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                        {quiz.category}
                      </span>
                    )}
                    {quiz.difficulty && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded capitalize">
                        {quiz.difficulty}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded ${
                      quiz.is_public
                        ? 'bg-success/10 text-success'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      {quiz.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      onClick={() => handleStartGame(quiz.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-success hover:bg-success/90 text-white rounded-lg transition-colors text-sm font-medium"
                      title="Start Game"
                    >
                      <Play size={16} weight="fill" />
                      <span>Play</span>
                    </button>
                    <button
                      onClick={() => handleEditQuiz(quiz.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium"
                      title="Edit Quiz"
                    >
                      <Pencil size={16} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors text-sm font-medium"
                      title="Delete Quiz"
                    >
                      <Trash size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
