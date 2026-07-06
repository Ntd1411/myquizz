import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Users, Crown, Loader2, Play, AlertCircle, Wifi, WifiOff, UserX } from 'lucide-react'
import { socketService, type Player } from '@/services/socket.service'
import { cn } from '@/utils/cn'

export function WaitingRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [players, setPlayers] = useState<Player[]>([])
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  const playerName = location.state?.playerName || 'Unknown'
  const isHost = location.state?.isHost || false
  const sessionId = location.state?.sessionId || null
  const playerSessionId = location.state?.playerSessionId || null

  useEffect(() => {
    const socket = socketService.getSocket()
    if (!socket || !socket.connected) {
      setError('Mất kết nối. Đang thử kết nối lại...')
      return
    }

    setIsSocketConnected(true)

    // Listen for players joining
    socketService.onPlayerJoined((data) => {
      setPlayers((prev) => {
        const exists = prev.find(p => p.player_id === data.player.player_id)
        if (exists) return prev
        return [...prev, data.player]
      })
    })

    // Listen for game start
    socketService.onGameStarted((data) => {
      console.log('Game started:', data)
      navigate(`/game/play/${roomCode}`, {
        state: {
          playerName,
          roomCode,
          sessionId,
          playerSessionId,
          firstQuestion: data.question
        }
      })
    })

    // Listen for player kicked
    socketService.onPlayerKicked((data) => {
      setPlayers((prev) => prev.filter(p => p.player_id !== data.player_id))
    })

    // Listen for being kicked
    socketService.onPlayerKickedSelf((data) => {
      setError(data.message)
      setTimeout(() => {
        navigate('/game/join')
      }, 2000)
    })

    // Listen for errors
    socketService.onError((data) => {
      setError(data.message)
      setIsStarting(false)
    })

    // Listen for connection status
    socketService.onConnectionStatusChange((connected) => {
      setIsSocketConnected(connected)
      if (!connected) {
        setError('Mất kết nối. Đang thử kết nối lại...')
      }
    })

    return () => {
      socketService.off('player:joined')
      socketService.off('game:started')
      socketService.off('player:kicked')
      socketService.off('player:kicked-self')
      socketService.off('error')
    }
  }, [navigate, roomCode, playerName, sessionId])

  const handleStartGame = () => {
    if (!sessionId) {
      setError('Không tìm thấy session ID')
      return
    }

    setIsStarting(true)
    setError(null)

    try {
      socketService.startGame(sessionId)
    } catch (err) {
      console.error('Start game error:', err)
      setError('Không thể bắt đầu game. Vui lòng thử lại.')
      setIsStarting(false)
    }
  }

  const handleKickPlayer = (playerId: number) => {
    if (!sessionId) return
    
    try {
      // playerId here is actually player_session_id from backend
      socketService.kickPlayer(sessionId, playerId)
    } catch (err) {
      console.error('Kick player error:', err)
      setError('Không thể kick người chơi')
    }
  }

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-subtle border border-primary-border rounded-base mb-4">
            {isSocketConnected ? (
              <Wifi className="w-4 h-4 text-primary" aria-hidden="true" />
            ) : (
              <WifiOff className="w-4 h-4 text-danger" aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-ink">
              {isSocketConnected ? 'Đã kết nối' : 'Đang kết nối lại...'}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-ink mb-2">Phòng chờ</h1>
          <div className="flex items-center justify-center gap-3 text-lg">
            <span className="text-ink-muted">Mã phòng:</span>
            <span className="font-mono text-2xl font-bold text-primary tracking-wider">
              {roomCode}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="mb-6 flex items-start gap-3 p-4 bg-danger-subtle border border-danger-border rounded-base"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Players List */}
        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" aria-hidden="true" />
              <span>Người chơi ({players.length})</span>
            </h2>
          </div>

          {players.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-ink-muted animate-spin mx-auto mb-3" aria-hidden="true" />
              <p className="text-ink-muted">Đang chờ người chơi tham gia...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={player.player_id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-base',
                    'bg-bg border border-border',
                    'transition-all duration-base',
                    player.is_host && 'border-accent bg-accent-subtle'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
                      player.is_host 
                        ? 'bg-accent text-white'
                        : 'bg-primary-subtle text-primary'
                    )}>
                      {player.player_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{player.player_name}</span>
                        {player.is_host && (
                          <Crown className="w-4 h-4 text-accent" aria-label="Host" />
                        )}
                      </div>
                      <span className="text-xs text-ink-muted">
                        {player.is_host ? 'Chủ phòng' : `Người chơi ${index + 1}`}
                      </span>
                    </div>
                  </div>

                  {isHost && !player.is_host && (
                    <button
                      onClick={() => handleKickPlayer(player.player_id)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-base',
                        'bg-danger-subtle text-danger border border-danger-border',
                        'hover:bg-danger hover:text-white',
                        'transition-all duration-base',
                        'focus:outline-none focus:ring-2 focus:ring-danger/30'
                      )}
                      aria-label={`Kick ${player.player_name}`}
                    >
                      <UserX className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start Button (Host Only) */}
        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={isStarting || players.length < 1 || !isSocketConnected}
            className={cn(
              'w-full px-6 py-4 rounded-base font-semibold text-lg',
              'transition-all duration-base',
              'focus:outline-none focus:ring-4 focus:ring-primary/30',
              isStarting || players.length < 1 || !isSocketConnected
                ? 'bg-border text-ink-subtle cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'
            )}
          >
            {isStarting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span>Đang bắt đầu...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Play className="w-5 h-5" aria-hidden="true" />
                <span>Bắt đầu game</span>
              </span>
            )}
          </button>
        )}

        {/* Waiting Message (Non-Host) */}
        {!isHost && (
          <div className="text-center p-6 bg-surface border border-border rounded-lg">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" aria-hidden="true" />
            <p className="text-ink-muted">Đang chờ chủ phòng bắt đầu game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
