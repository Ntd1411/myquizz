import { useState, useEffect, useMemo } from 'react'
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
  const [actualSessionId, setActualSessionId] = useState<number | null>(null)
  const [actualPlayerSessionId, setActualPlayerSessionId] = useState<number | null>(null)

  const playerName = location.state?.playerName || 'Unknown'
  const isHost = location.state?.isHost || false
  const sessionId = location.state?.sessionId || null
  const playerSessionId = location.state?.playerSessionId || null
  const isCreator = location.state?.isCreator || false // Flag để biết đây là host tạo game
  const initialPlayers = location.state?.players || [] // Players từ game:joined event
  
  // Memoize initial player (chỉ host creator mới dùng)
  const initialPlayer = useMemo(() => {
    if (isCreator && playerSessionId && playerName) {
      return {
        player_id: playerSessionId,
        player_name: playerName,
        is_host: true,
        player_score: 0
      }
    }
    return null
  }, [isCreator, playerSessionId, playerName])

  // Initialize players once on mount
  useEffect(() => {
    if (initialPlayer) {
      setPlayers([initialPlayer])
    } else if (initialPlayers && initialPlayers.length > 0) {
      setPlayers(initialPlayers)
    }
  }, []) // Chỉ chạy 1 lần khi mount

  useEffect(() => {
    // Kiểm tra nếu thiếu dữ liệu quan trọng (do reload page)
    if (!roomCode || !playerName) {
      setError('Phiên làm việc đã hết hạn. Vui lòng tham gia lại.')
      setTimeout(() => {
        navigate('/game/join')
      }, 2000)
      return
    }

    const socket = socketService.getSocket()
    if (!socket || !socket.connected) {
      setError('Mất kết nối. Đang thử kết nối lại...')
      // Try to reconnect
      socketService.connect()
    }

    setIsSocketConnected(socket?.connected || false)

    // Nếu là host creator, chỉ cần join socket room (không gọi game:join-room vì đã có player_session)
    if (isCreator && roomCode && playerSessionId && socket?.connected) {
      console.log('Host joining socket room:', roomCode)
      socket.emit('game:join-room-only', {
        sessionCode: roomCode,
        playerSessionId: playerSessionId
      })
    }

    // Lắng nghe game:joined (backup case nếu chưa có players)
    socketService.onGameJoined((data) => {
      console.log('Game joined event:', data)
      setActualSessionId(data.session_id)
      setActualPlayerSessionId(data.player_session_id)
      
      // Chỉ set players nếu chưa có
      setPlayers((prev) => {
        if (prev.length === 0 && data.players && data.players.length > 0) {
          return data.players
        }
        return prev
      })
    })

    // Listen for players joining
    socketService.onPlayerJoined((data) => {
      console.log('Player joined event:', data)
      setPlayers((prev) => {
        // Kiểm tra duplicate
        const exists = prev.find(p => p.player_id === data.player.player_id)
        if (exists) {
          console.log('Player already exists, skipping')
          return prev
        }
        console.log('Adding new player to list')
        return [...prev, data.player]
      })
    })

    // Listen for game start
    socketService.onGameStarted((data) => {
      console.log('Game started:', data)
      
      // Host vào trang monitor, players khác vào trang play
      if (isHost) {
        navigate(`/game/monitor/${roomCode}`, {
          state: {
            playerName,
            roomCode,
            sessionId,
            playerSessionId
          }
        })
      } else {
        navigate(`/game/play/${roomCode}`, {
          state: {
            playerName,
            roomCode,
            sessionId,
            playerSessionId,
            firstQuestion: data.question
          }
        })
      }
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
      } else {
        setError(null)
        // KHÔNG tự động rejoin vì sẽ tạo player mới
        // User cần refresh hoặc join lại manually
      }
    })

    return () => {
      socketService.off('player:joined')
      socketService.off('game:started')
      socketService.off('game:joined')
      socketService.off('player:kicked')
      socketService.off('player:kicked-self')
      socketService.off('error')
    }
  }, [navigate, roomCode, playerName, sessionId, isCreator, playerSessionId])

  const handleStartGame = () => {
    const finalSessionId = actualSessionId || sessionId
    const finalPlayerSessionId = actualPlayerSessionId || playerSessionId
    
    if (!finalSessionId) {
      setError('Không tìm thấy session ID')
      return
    }

    if (!finalPlayerSessionId) {
      setError('Không tìm thấy player session ID. Vui lòng thử lại.')
      return
    }

    setIsStarting(true)
    setError(null)

    try {
      socketService.startGame(finalSessionId, finalPlayerSessionId)
    } catch (err) {
      console.error('Start game error:', err)
      setError('Không thể bắt đầu game. Vui lòng thử lại.')
      setIsStarting(false)
    }
  }

  const handleKickPlayer = (playerId: number) => {
    const finalSessionId = actualSessionId || sessionId
    const finalPlayerSessionId = actualPlayerSessionId || playerSessionId
    
    if (!finalSessionId || !finalPlayerSessionId) {
      setError('Không tìm thấy session ID hoặc player session ID')
      return
    }
    
    try {
      console.log('Kicking player:', { finalSessionId, playerId, finalPlayerSessionId })
      // playerId here is actually player_session_id from backend
      socketService.kickPlayer(finalSessionId, playerId, finalPlayerSessionId)
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
