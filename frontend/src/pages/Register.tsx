import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/UI'
import { EnvelopeSimple, LockKey, User, Phone, WarningCircle } from '@phosphor-icons/react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    fullname?: string
    email?: string
    phone?: string
    password?: string
    confirmPassword?: string
  }>({})

  const validateForm = () => {
    const errors: typeof fieldErrors = {}

    if (!formData.fullname.trim()) {
      errors.fullname = 'Họ tên không được để trống'
    } else if (formData.fullname.trim().length < 2) {
      errors.fullname = 'Họ tên phải có ít nhất 2 ký tự'
    } else if (formData.fullname.trim().length > 100) {
      errors.fullname = 'Họ tên không được vượt quá 100 ký tự'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email không được để trống'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email không hợp lệ'
    }

    if (formData.phone && !/^\d{10,11}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
      errors.phone = 'Số điện thoại phải có 10-11 chữ số'
    }

    if (!formData.password) {
      errors.password = 'Mật khẩu không được để trống'
    } else if (formData.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
    } else if (formData.password.length > 100) {
      errors.password = 'Mật khẩu không được vượt quá 100 ký tự'
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu'
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp'
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
      await api.register(
        formData.email,
        formData.password,
        formData.fullname,
        formData.phone || undefined
      )
      navigate('/login', { state: { message: 'Tạo tài khoản thành công. Vui lòng đăng nhập.' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Tạo tài khoản</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Tham gia MyQuizz và bắt đầu tạo quiz</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                <WarningCircle size={20} weight="fill" className="text-error flex-shrink-0 mt-0.5" />
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Họ và tên
              </label>
              <div className="relative">
                <User
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={formData.fullname}
                  onChange={(e) => updateField('fullname', e.target.value)}
                  className={`input pl-12 w-full ${fieldErrors.fullname ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.fullname && (
                <span className="text-sm text-error">{fieldErrors.fullname}</span>
              )}
            </div>

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
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={`input pl-12 w-full ${fieldErrors.email ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.email && (
                <span className="text-sm text-error">{fieldErrors.email}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Số điện thoại (tùy chọn)
              </label>
              <div className="relative">
                <Phone
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="tel"
                  placeholder="0987654321"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={`input pl-12 w-full ${fieldErrors.phone ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.phone && (
                <span className="text-sm text-error">{fieldErrors.phone}</span>
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
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className={`input pl-12 w-full ${fieldErrors.password ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.password && (
                <span className="text-sm text-error">{fieldErrors.password}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <LockKey
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className={`input pl-12 w-full ${fieldErrors.confirmPassword ? 'border-error focus:ring-error' : ''}`}
                />
              </div>
              {fieldErrors.confirmPassword && (
                <span className="text-sm text-error">{fieldErrors.confirmPassword}</span>
              )}
            </div>

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
