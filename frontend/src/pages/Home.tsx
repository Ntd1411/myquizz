import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, Input, Button, LoadingSpinner } from '@/components/UI'
import { MagnifyingGlass, GameController, WarningCircle } from '@phosphor-icons/react'
import type { Quiz } from '@/types'
import { motion, useReducedMotion } from 'motion/react'

export default function HomePage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [sessionCode, setSessionCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [joiningGame, setJoiningGame] = useState(false)
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    loadQuizzes()
  }, [])

  const loadQuizzes = async () => {
    setLoading(true)
    setSearchError('')
    try {
      const response = await api.listQuizzes(undefined, 1, 12)
      setQuizzes(response.quizzes)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Không thể tải danh sách quiz'
      setSearchError(errorMessage)
      console.error('Failed to load quizzes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      loadQuizzes()
      return
    }
    setIsSearching(true)
    setSearchError('')
    try {
      const response = await api.searchQuizzes({ keyword, page: 1, limit: 12 })
      setQuizzes(response.quizzes)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Tìm kiếm thất bại'
      setSearchError(errorMessage)
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!searchKeyword.trim()) {
      return
    }
    const timeoutId = setTimeout(() => {
      handleSearch(searchKeyword)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchKeyword, handleSearch])

  const handleJoinGame = async () => {
    if (!sessionCode.trim()) {
      setError('Vui lòng nhập mã phiên')
      return
    }
    if (!playerName.trim()) {
      setError('Vui lòng nhập tên của bạn')
      return
    }
    setError('')
    setJoiningGame(true)
    try {
      const playerSession = await api.joinGame(sessionCode, playerName)
      navigate(`/game/${playerSession.session_id}`, { state: { playerSession } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tham gia game')
    } finally {
      setJoiningGame(false)
    }
  }

  return (
    <div className="min-h-[100dvh] pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Join a quiz session
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Enter a session code to play or browse available quizzes
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <Card className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Quick Join</h2>
            <div className="space-y-4">
              {error && (
                <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}
              <Input
                placeholder="Enter session code"
                value={sessionCode}
                onChange={setSessionCode}
                label="Session Code"
                required
              />
              <Input
                placeholder="Your name"
                value={playerName}
                onChange={setPlayerName}
                label="Player Name"
                required
              />
              <Button onClick={handleJoinGame} disabled={joiningGame} fullWidth>
                {joiningGame ? 'Joining...' : 'Join Game'}
              </Button>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <GameController size={24} weight="duotone" className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">How to Join</h3>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
                  <li>1. Get the session code from your host</li>
                  <li>2. Enter the code above</li>
                  <li>3. Add your name and join</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlass
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                placeholder="Tìm kiếm quiz..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="input pl-12 w-full"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size={16} />
                </div>
              )}
            </div>
          </div>
        </div>

        {searchError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3"
          >
            <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-error text-sm font-medium">{searchError}</p>
            </div>
            <button
              onClick={() => {
                setSearchError('')
                loadQuizzes()
              }}
              className="text-error/60 hover:text-error text-sm font-medium"
            >
              Thử lại
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="py-20">
            <LoadingSpinner size={40} />
          </div>
        ) : quizzes.length === 0 ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-6">
              <GameController size={48} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-3">
              {searchKeyword ? 'Không tìm thấy quiz' : 'Chưa có quiz nào'}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
              {searchKeyword
                ? `Không tìm thấy quiz nào với từ khóa "${searchKeyword}"`
                : 'Hiện chưa có quiz công khai nào. Hãy thử lại sau!'}
            </p>
            {searchKeyword && (
              <Button
                onClick={() => {
                  setSearchKeyword('')
                  loadQuizzes()
                }}
                variant="secondary"
                className="mx-auto"
              >
                Xóa tìm kiếm
              </Button>
            )}
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
                  <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    {quiz.category && (
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded">
                        {quiz.category}
                      </span>
                    )}
                    {quiz.difficulty && (
                      <span className="capitalize">{quiz.difficulty}</span>
                    )}
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
