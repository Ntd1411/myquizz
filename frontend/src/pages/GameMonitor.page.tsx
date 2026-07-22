import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { socketService } from '@/services/socket.service'
import { Copy, Check, Users, Clock, ArrowRight, StopCircle } from 'lucide-react'

interface Player {
  player_id: number
  player_name: string
  player_score: number
  status: 'waiting' | 'answered-correct' | 'answered-wrong'
  is_host: boolean
}

interface QuestionStats {
  total_players: number
  answered_count: number
  correct_count: number
  wrong_count: number
}

export function GameMonitorPage() {
  const navigate = useNavigate()
  const { roomCode } = useParams<{ roomCode: string }>()
  const location = useLocation()
  
  const sessionId = location.state?.sessionId
  const playerSessionId = location.state?.playerSessionId
  
  const [players, setPlayers] = useState<Player[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [questionNumber, setQuestionNumber] = useState(1)
  const [totalQuestions] = useState(0)
  const [stats, setStats] = useState<QuestionStats>({
    total_players: 0,
    answered_count: 0,
    correct_count: 0,
    wrong_count: 0
  })
  const [copied, setCopied] = useState(false)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  useEffect(() => {
    if (!roomCode || !sessionId) {
      navigate('/dashboard')
      return
    }

    const socket = socketService.getSocket()
    if (!socket?.connected) {
      socketService.connect()
    }
    setIsSocketConnected(socket?.connected || false)

    // Listen for player answers
    socketService.onPlayerAnswered((data) => {
      console.log('Player answered:', data)
      setPlayers((prev) => 
        prev.map((p) => 
          p.player_id === data.player_session_id
            ? { 
                ...p, 
                player_score: data.score,
                status: data.is_correct ? 'answered-correct' : 'answered-wrong'
              }
            : p
        )
      )
      
      // Update stats
      setStats((prev) => ({
        ...prev,
        answered_count: prev.answered_count + 1,
        correct_count: data.is_correct ? prev.correct_count + 1 : prev.correct_count,
        wrong_count: !data.is_correct ? prev.wrong_count + 1 : prev.wrong_count
      }))
    })

    // Listen for question updates
    socketService.onQuestionUpdate((data) => {
      console.log('Question update:', data)
      setCurrentQuestion(data.question)
      setQuestionNumber(data.question_number)
      
      // Reset player statuses for new question
      setPlayers((prev) => prev.map((p) => ({ ...p, status: 'waiting' })))
      setStats({
        total_players: players.length,
        answered_count: 0,
        correct_count: 0,
        wrong_count: 0
      })
    })

    // Listen for game end
    socketService.onGameEnded((data) => {
      console.log('Game ended:', data)
      navigate(`/game/result/${roomCode}`, {
        state: {
          sessionId,
          results: data.results
        }
      })
    })

    // Listen for connection status
    socketService.onConnectionStatusChange((connected) => {
      setIsSocketConnected(connected)
    })

    return () => {
      socketService.off('player:answered')
      socketService.off('question:update')
      socketService.off('game:ended')
    }
  }, [navigate, roomCode, sessionId, players.length])

  const handleCopyRoomCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleNextQuestion = () => {
    if (!sessionId || !playerSessionId) return
    
    socketService.nextQuestion(sessionId, playerSessionId)
  }

  const handleEndGame = () => {
    setShowEndConfirm(true)
  }

  const confirmEndGame = () => {
    if (!sessionId || !playerSessionId) return
    
    socketService.endGame(sessionId, playerSessionId)
    setShowEndConfirm(false)
  }

  const sortedPlayers = [...players].sort((a, b) => b.player_score - a.player_score)
  const progressPercent = stats.total_players > 0 
    ? (stats.answered_count / stats.total_players) * 100 
    : 0
  const correctPercent = stats.answered_count > 0
    ? (stats.correct_count / stats.answered_count) * 100
    : 0

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-ink/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm text-ink-muted">Room Code:</span>
                <button
                  onClick={handleCopyRoomCode}
                  className="flex items-center gap-2 px-3 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                >
                  <span className="text-lg font-mono font-bold text-primary">
                    {roomCode}
                  </span>
                  {copied ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <Copy className="w-4 h-4 text-primary" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-muted">Question</span>
                <span className="font-semibold text-ink">
                  {questionNumber} / {totalQuestions}
                </span>
              </div>
              
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                isSocketConnected 
                  ? 'bg-success/10 text-success' 
                  : 'bg-danger/10 text-danger'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isSocketConnected ? 'bg-success' : 'bg-danger'
                }`} />
                <span className="text-xs font-medium">
                  {isSocketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Question Display */}
        {currentQuestion && (
          <div className="bg-surface rounded-xl border border-ink/10 p-6 mb-6">
            <h2 className="text-2xl font-bold text-ink mb-4">
              {currentQuestion.question_text}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options?.map((option: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    option.is_correct
                      ? 'bg-success/10 border-success text-success'
                      : 'bg-surface-hover border-ink/10 text-ink'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center font-semibold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="font-medium">{option.option_text}</span>
                    {option.is_correct && (
                      <Check className="w-5 h-5 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Stats */}
        <div className="bg-surface rounded-xl border border-ink/10 p-6 mb-6">
          <h3 className="text-lg font-semibold text-ink mb-4">
            Trạng thái trả lời
          </h3>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ink-muted">
                Đã trả lời: {stats.answered_count} / {stats.total_players}
              </span>
              <span className="text-ink font-medium">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="h-2 bg-ink/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Correct/Wrong Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-success/5 rounded-lg">
              <Check className="w-5 h-5 text-success" />
              <div>
                <div className="text-sm text-ink-muted">Đúng</div>
                <div className="text-xl font-bold text-success">
                  {stats.correct_count} ({Math.round(correctPercent)}%)
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-danger/5 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-danger flex items-center justify-center text-white text-xs">
                ✕
              </div>
              <div>
                <div className="text-sm text-ink-muted">Sai</div>
                <div className="text-xl font-bold text-danger">
                  {stats.wrong_count} ({Math.round(100 - correctPercent)}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-surface rounded-xl border border-ink/10 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-ink/10">
            <h3 className="text-lg font-semibold text-ink">
              Bảng xếp hạng ({players.length} người chơi)
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-ink/5">
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Hạng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Điểm
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase tracking-wider">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {sortedPlayers.map((player, index) => (
                  <tr
                    key={player.player_id}
                    className="hover:bg-ink/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-lg font-bold ${
                          index === 0 ? 'text-accent' :
                          index === 1 ? 'text-primary' :
                          index === 2 ? 'text-success' :
                          'text-ink-muted'
                        }`}>
                          #{index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">
                          {player.player_name}
                        </span>
                        {player.is_host && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
                            Host
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-ink">
                        {player.player_score}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.status === 'waiting' && (
                        <div className="flex items-center gap-2 text-ink-muted">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">Đang chờ...</span>
                        </div>
                      )}
                      {player.status === 'answered-correct' && (
                        <div className="flex items-center gap-2 text-success">
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Đúng</span>
                        </div>
                      )}
                      {player.status === 'answered-wrong' && (
                        <div className="flex items-center gap-2 text-danger">
                          <div className="w-4 h-4 rounded-full bg-danger flex items-center justify-center text-white text-xs">
                            ✕
                          </div>
                          <span className="text-sm font-medium">Sai</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Host Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleNextQuestion}
            disabled={stats.answered_count < stats.total_players || questionNumber >= totalQuestions}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <span>Câu tiếp theo</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleEndGame}
            className="flex items-center gap-2 px-6 py-3 bg-danger text-white rounded-lg hover:bg-danger-hover transition-colors font-medium"
          >
            <StopCircle className="w-5 h-5" />
            <span>Kết thúc</span>
          </button>
        </div>
      </div>

      {/* End Game Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full border border-ink/10">
            <h3 className="text-xl font-bold text-ink mb-2">
              Kết thúc game?
            </h3>
            <p className="text-ink-muted mb-6">
              Bạn có chắc muốn kết thúc game này? Tất cả người chơi sẽ được chuyển đến trang kết quả.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 px-4 py-2 bg-ink/5 text-ink rounded-lg hover:bg-ink/10 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={confirmEndGame}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger-hover transition-colors font-medium"
              >
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
