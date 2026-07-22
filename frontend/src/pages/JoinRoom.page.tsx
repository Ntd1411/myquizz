import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { socketService } from '@/services/socket.service'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/utils/cn'

export function JoinRoomPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  useEffect(() => {
    // Connect socket on mount
    const socket = socketService.connect()
    setIsSocketConnected(socket.connected)

    // Listen for connection status
    socketService.onConnectionStatusChange((connected) => {
      setIsSocketConnected(connected)
      if (!connected) {
        setError('Mất kết nối. Đang thử kết nối lại...')
      } else {
        setError(null)
      }
    })

    // Listen for successful join
    socketService.onGameJoined((data) => {
      console.log('Joined room:', data)
      
      // Dùng fullname nếu đã login, nếu không thì dùng playerName đã nhập
      const finalPlayerName = isAuthenticated && user?.fullname 
        ? user.fullname 
        : playerName

      // Navigate to waiting room with room code and session info
      navigate(`/game/waiting/${roomCode}`, {
        state: {
          playerName: finalPlayerName,
          roomCode,
          sessionId: data.session_id,
          playerSessionId: data.player_session_id,
          isHost: data.is_host,
          players: data.players || []
        }
      })
    })

    // Listen for errors
    socketService.onError((data) => {
      setError(data.message)
      setIsConnecting(false)
    })

    return () => {
      socketService.off('game:joined')
      socketService.off('error')
    }
  }, [navigate, roomCode, playerName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!roomCode.trim()) {
      setError('Vui lòng nhập mã phòng')
      return
    }

    // Nếu chưa đăng nhập thì bắt buộc nhập tên
    const finalPlayerName = isAuthenticated && user?.fullname 
      ? user.fullname 
      : playerName.trim()

    if (!finalPlayerName) {
      setError('Vui lòng nhập tên của bạn')
      return
    }

    if (!isSocketConnected) {
      setError('Chưa kết nối đến server. Vui lòng thử lại.')
      return
    }

    setIsConnecting(true)

    try {
      // Nếu đã đăng nhập thì gửi kèm user_id
      const userId = isAuthenticated && user?.user_id ? parseInt(user.user_id) : undefined
      socketService.joinRoom(roomCode.trim().toUpperCase(), finalPlayerName, userId)
      // Navigation will happen in onGameJoined listener
    } catch (err) {
      console.error('Join room error:', err)
      setError('Không thể tham gia phòng. Vui lòng thử lại.')
      setIsConnecting(false)
    }
  }

  const formatRoomCode = (value: string) => {
    // Auto uppercase and limit to 6 characters
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  }

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRoomCode(e.target.value)
    setRoomCode(formatted)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Connection Status */}
        <div className="mb-6 flex items-center justify-center gap-2 text-sm">
          {isSocketConnected ? (
            <>
              <Wifi className="w-4 h-4 text-success" aria-hidden="true" />
              <span className="text-success">Đã kết nối</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-danger" aria-hidden="true" />
              <span className="text-danger">Đang kết nối...</span>
            </>
          )}
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-lg p-8 shadow-base">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-ink mb-2">Tham gia phòng</h1>
            <p className="text-ink-muted">Nhập mã phòng để bắt đầu chơi quiz</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Room Code Input */}
            <div>
              <label htmlFor="roomCode" className="block text-sm font-medium text-ink mb-2">
                Mã phòng
              </label>
              <div className="relative">
                <Hash 
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" 
                  aria-hidden="true" 
                />
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  placeholder="VD: ABC123"
                  maxLength={6}
                  className={cn(
                    'w-full pl-12 pr-4 py-3 bg-bg border rounded-base',
                    'text-lg font-mono text-center tracking-wider',
                    'transition-all duration-base',
                    'placeholder:text-ink-muted placeholder:font-sans placeholder:tracking-normal',
                    error && !roomCode.trim()
                      ? 'border-danger focus:border-danger focus:ring-4 focus:ring-danger/10'
                      : 'border-border hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/10',
                    'focus:outline-none'
                  )}
                  disabled={isConnecting}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-ink-muted">Mã phòng gồm 6 ký tự</p>
            </div>

            {/* Player Name Input - Chỉ hiển thị nếu chưa đăng nhập */}
            {!isAuthenticated && (
              <div>
                <label htmlFor="playerName" className="block text-sm font-medium text-ink mb-2">
                  Tên của bạn
                </label>
                <input
                  id="playerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên hiển thị"
                  maxLength={50}
                  className={cn(
                    'w-full px-4 py-3 bg-bg border rounded-base',
                    'text-base',
                    'transition-all duration-base',
                    'placeholder:text-ink-muted',
                    error && !playerName.trim()
                      ? 'border-danger focus:border-danger focus:ring-4 focus:ring-danger/10'
                      : 'border-border hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/10',
                    'focus:outline-none'
                  )}
                  disabled={isConnecting}
                />
              </div>
            )}

            {/* Hiển thị tên nếu đã đăng nhập */}
            {isAuthenticated && user?.fullname && (
              <div className="p-4 bg-primary-subtle border border-primary-border rounded-base">
                <p className="text-sm text-ink-muted mb-1">Tham gia với tên</p>
                <p className="text-lg font-medium text-ink">{user.fullname}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div 
                className="flex items-start gap-3 p-4 bg-danger-subtle border border-danger-border rounded-base"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isConnecting || !isSocketConnected}
              className={cn(
                'w-full px-6 py-3 rounded-base font-semibold text-base',
                'transition-all duration-base',
                'focus:outline-none focus:ring-4 focus:ring-primary/30',
                isConnecting || !isSocketConnected
                  ? 'bg-border text-ink-subtle cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'
              )}
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Đang tham gia...</span>
                </span>
              ) : (
                'Tham gia phòng'
              )}
            </button>
          </form>
        </div>

        {/* Helper Text */}
        <p className="mt-6 text-center text-sm text-ink-muted">
          Chưa có mã phòng?{' '}
          <a 
            href="/explore" 
            className="text-primary hover:text-primary-hover font-medium transition-colors"
          >
            Khám phá quiz
          </a>
        </p>
      </div>
    </div>
  )
}
