import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Phone, AlertCircle, Eye, EyeOff, CheckCircle, ChevronLeft } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { authService, registerSchema, type RegisterInput } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

export default function Register() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema)
  })

  const password = watch('password', '')
  const confirmPassword = watch('confirmPassword', '')

  const passwordRequirements = [
    { label: 'Ít nhất 8 ký tự', met: password.length >= 8 }
  ]

  const isPasswordMatch = confirmPassword.length > 0 && password === confirmPassword

  const onSubmit = async (data: RegisterInput) => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      
      // Loại bỏ confirmPassword và phone nếu trống trước khi gửi lên backend
      const { confirmPassword, phone, ...registerData } = data
      const finalData = {
        ...registerData,
        ...(phone && phone.trim() !== '' && { phone })
      }
      
      const response = await authService.register(finalData)
      setUser(response.user)
      
      navigate('/app')
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Đăng ký thất bại. Vui lòng thử lại.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <a href="#main-content" className="skip-link">
        Chuyển đến nội dung chính
      </a>
      
      <Link
        to="/"
        className="fixed top-6 left-6 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Quay lại trang chủ
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
        id="main-content"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-display font-bold text-primary mb-2">
              MyQuizz
            </h1>
          </Link>
          <p className="text-ink-muted">
            Chào mừng bạn đến với MyQuizz
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-danger-subtle border border-danger-border rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{errorMessage}</p>
              </motion.div>
            )}

            <Input
              label="Họ và tên"
              type="text"
              placeholder="Nguyễn Văn A"
              error={errors.fullname?.message}
              iconLeft={<User className="h-5 w-5" />}
              autoComplete="name"
              disabled={isLoading}
              {...register('fullname')}
            />

            <Input
              label="Email"
              type="email"
              placeholder="ten@example.com"
              error={errors.email?.message}
              iconLeft={<Mail className="h-5 w-5" />}
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
            />

            <Input
              label="Số điện thoại (không bắt buộc)"
              type="tel"
              placeholder="+84987654321"
              error={errors.phone?.message}
              iconLeft={<Phone className="h-5 w-5" />}
              autoComplete="tel"
              disabled={isLoading}
              {...register('phone')}
            />

            <div className="space-y-2">
              <div className="relative">
                <Input
                  label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  error={errors.password?.message}
                  iconLeft={<Lock className="h-5 w-5" />}
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-ink-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-1"
                >
                  {passwordRequirements.map((req, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-sm"
                    >
                      <CheckCircle
                        className={`h-4 w-4 ${
                          req.met ? 'text-success' : 'text-ink-muted'
                        }`}
                      />
                      <span className={req.met ? 'text-success' : 'text-ink-muted'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  label="Nhập lại mật khẩu"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu"
                  error={errors.confirmPassword?.message}
                  iconLeft={<Lock className="h-5 w-5" />}
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[38px] text-ink-muted hover:text-ink transition-colors"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {isPasswordMatch && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-success">Mật khẩu khớp</span>
                </motion.div>
              )}
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <span className="text-sm text-ink">
                  Tôi đồng ý với{' '}
                  <Link to="/terms" className="text-primary hover:text-primary-hover">
                    Điều khoản sử dụng
                  </Link>{' '}
                  và{' '}
                  <Link to="/privacy" className="text-primary hover:text-primary-hover">
                    Chính sách bảo mật
                  </Link>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              Đăng ký
            </Button>

            <div className="text-center">
              <p className="text-sm text-ink-muted">
                Đã có tài khoản?{' '}
                <Link
                  to="/login"
                  className="text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  Đăng nhập
                </Link>
              </p>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
