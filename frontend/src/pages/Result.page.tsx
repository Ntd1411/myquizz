import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Trophy, Medal, Award, Home, Loader2 } from 'lucide-react'
import { socketService, type LeaderboardEntry } from '@/services/socket.service'
import { cn } from '@/utils/cn'

export function ResultPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const playerName = location.state?.playerName

  useEffect(() => {
    // Listen for game completion and leaderboard
    socketService.onGameAllCompleted((data) => {
      console.log('Game completed with leaderboard:', data)
      setLeaderboard(data.leaderboard)
      setIsLoading(false)
      // Animate leaderboard entrance
      setTimeout(() => setShowLeaderboard(true), 300)
    })

    return () => {
      socketService.off('game:all-completed')
    }
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-500" aria-label="Hạng 1" />
      case 2:
        return <Medal className="w-8 h-8 text-gray-400" aria-label="Hạng 2" />
      case 3:
        return <Award className="w-8 h-8 text-amber-600" aria-label="Hạng 3" />
      default:
        return <span className="text-2xl font-bold text-ink-muted">#{rank}</span>
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-50 border-yellow-500'
      case 2:
        return 'bg-gray-50 border-gray-400'
      case 3:
        return 'bg-amber-50 border-amber-600'
      default:
        return 'bg-surface border-border'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">Đang chờ người chơi khác hoàn thành...</p>
        </div>
      </div>
    )
  }

  const currentPlayer = leaderboard.find(p => p.player_name === playerName)
  const topPlayer = leaderboard[0]

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Winner Announcement */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-4">
            <Trophy className="w-12 h-12 text-yellow-500" aria-hidden="true" />
          </div>
          <h1 className="text-4xl font-bold text-ink mb-2">Kết quả</h1>
          {topPlayer && (
            <p className="text-xl text-ink-muted">
              Chúc mừng <span className="font-semibold text-ink">{topPlayer.player_name}</span> đã chiến thắng!
            </p>
          )}
        </div>

        {/* Current Player Stats */}
        {currentPlayer && (
          <div className="bg-primary-subtle border-2 border-primary rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-muted mb-1">Kết quả của bạn</p>
                <p className="text-2xl font-bold text-ink">{currentPlayer.player_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-muted mb-1">Hạng {currentPlayer.rank}</p>
                <p className="text-3xl font-bold text-primary">{currentPlayer.player_score} điểm</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-primary-border">
              <p className="text-sm text-ink-muted">
                Trả lời đúng: <span className="font-semibold text-ink">{currentPlayer.correct_answers_count}</span> câu
              </p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-ink mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" aria-hidden="true" />
            <span>Bảng xếp hạng</span>
          </h2>

          <div className="space-y-3">
            {leaderboard.map((player, index) => (
              <div
                key={player.player_id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-500',
                  getRankColor(player.rank),
                  showLeaderboard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 flex items-center justify-center">
                    {getRankIcon(player.rank)}
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{player.player_name}</p>
                    <p className="text-sm text-ink-muted">
                      {player.correct_answers_count} câu đúng
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ink">{player.player_score}</p>
                  <p className="text-xs text-ink-muted">điểm</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/explore')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-base font-semibold',
              'bg-surface border-2 border-border text-ink',
              'hover:bg-surface-hover hover:border-border-strong',
              'transition-all duration-base',
              'focus:outline-none focus:ring-4 focus:ring-primary/30'
            )}
          >
            <Home className="w-5 h-5" aria-hidden="true" />
            <span>Về trang chủ</span>
          </button>
          
          <button
            onClick={() => navigate('/game/join')}
            className={cn(
              'flex-1 px-6 py-3 rounded-base font-semibold',
              'bg-primary text-white',
              'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg',
              'transition-all duration-base',
              'focus:outline-none focus:ring-4 focus:ring-primary/30'
            )}
          >
            Chơi lại
          </button>
        </div>
      </div>
    </div>
  )
}
