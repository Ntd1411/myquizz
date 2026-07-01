import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/UI'
import { EnvelopeSimple, LockKey, WarningCircle } from '@phosphor-icons/react'

export default function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}

    if (!email.trim()) {
      errors.email = 'Email không được để trống'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email không hợp lệ'
    }

    if (!password) {
      errors.password = 'Mật khẩu không được để trống'
    } else if (password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await api.login(email, password)
      setUser(response.user)
      navigate('/home')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Chào mừng trở lại</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Đăng nhập để tiếp tục sử dụng MyQuizz</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setFieldErrors(prev => ({ ...prev, email: undefined }))
                  }}
                  className={`input pl-12 w-full ${fieldErrors.email ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.email && (
                <span className="text-sm text-error">{fieldErrors.email}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mật khẩu
              </label>
              <div className="relative">
                <LockKey
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors(prev => ({ ...prev, password: undefined }))
                  }}
                  className={`input pl-12 w-full ${fieldErrors.password ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.password && (
                <span className="text-sm text-error">{fieldErrors.password}</span>
              )}
            </div>

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
