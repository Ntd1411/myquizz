import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Card, Button, LoadingSpinner } from '@/components/UI'
import { Plus, GameController, Pencil, Trash, Play, WarningCircle } from '@phosphor-icons/react'
import type { Quiz } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const user = useAuthStore((state) => state.user)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [startingId, setStartingId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => {
    loadMyQuizzes()
  }, [user])

  const loadMyQuizzes = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const response = await api.listQuizzes(user.id, 1, 20)
      setQuizzes(response.quizzes)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể tải danh sách quiz'
      setError(errorMessage)
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
    setDeletingId(quizId)
    setError('')
    try {
      await api.deleteQuiz(quizId)
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId))
      setConfirmDelete(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể xóa quiz'
      setError(errorMessage)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartGame = async (quizId: number) => {
    setStartingId(quizId)
    setError('')
    try {
      const session = await api.createGame(quizId)
      navigate(`/game/host/${session.id}`, { state: { session } })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể tạo phiên chơi'
      setError(errorMessage)
      setStartingId(null)
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

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3"
          >
            <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-error text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-error/60 hover:text-error text-sm font-medium"
            >
              Đóng
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="py-20">
            <LoadingSpinner size={40} />
          </div>
        ) : error && quizzes.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-6">
              <WarningCircle size={48} className="text-error" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">Không thể tải quiz</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
              Đã xảy ra lỗi khi tải danh sách quiz của bạn
            </p>
            <Button onClick={loadMyQuizzes} className="mx-auto">
              Thử lại
            </Button>
          </motion.div>
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
                  ease: [0.16, 1, 0.3, 1]
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
                      disabled={startingId === quiz.id || deletingId === quiz.id}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-success hover:bg-success/90 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Start Game"
                    >
                      {startingId === quiz.id ? (
                        <LoadingSpinner size={16} />
                      ) : (
                        <>
                          <Play size={16} weight="fill" />
                          <span>Play</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleEditQuiz(quiz.id)}
                      disabled={startingId === quiz.id || deletingId === quiz.id}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Edit Quiz"
                    >
                      <Pencil size={16} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(quiz.id)}
                      disabled={startingId === quiz.id || deletingId === quiz.id}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete Quiz"
                    >
                      {deletingId === quiz.id ? (
                        <LoadingSpinner size={16} />
                      ) : (
                        <>
                          <Trash size={16} />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                  <WarningCircle size={24} weight="fill" className="text-error" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Xác nhận xóa quiz</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Bạn có chắc chắn muốn xóa quiz này? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDelete(null)}
                  disabled={deletingId === confirmDelete}
                >
                  Hủy
                </Button>
                <button
                  onClick={() => handleDeleteQuiz(confirmDelete)}
                  disabled={deletingId === confirmDelete}
                  className="px-6 py-3 bg-error hover:bg-error/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deletingId === confirmDelete ? (
                    <>
                      <LoadingSpinner size={16} />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    'Xóa quiz'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
