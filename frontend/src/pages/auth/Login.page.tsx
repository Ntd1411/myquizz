import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, AlertCircle, Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { authService } from '@/services/auth.service'
import { loginSchema, type LoginInput } from '@/validators/auth.validator'
import { useAuthStore } from '@/stores/auth.store'

export default function Login() {
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginInput) => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      
      const response = await authService.login(data)
      setUser(response.user)
      
      navigate('/', { replace: true })
    } catch (error: any) {
      console.error('Login error:', error)
      
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message)
      } else if (error.response?.status === 401) {
        setErrorMessage('Email hoặc mật khẩu không chính xác')
      } else if (error.response?.status === 400) {
        setErrorMessage('Thông tin đăng nhập không hợp lệ')
      } else if (error.message) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Đăng nhập thất bại. Vui lòng thử lại sau')
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
        to="/welcome"
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
          <Link to="/welcome" className="inline-block">
            <h1 className="text-3xl font-display font-bold text-primary mb-2">
              MyQuizz
            </h1>
          </Link>
          <p className="text-ink-muted">
            Đăng nhập với tài khoản MyQuizz của bạn
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              label="Email"
              type="email"
              placeholder="ten@example.com"
              error={errors.email?.message}
              iconLeft={<Mail className="h-5 w-5" />}
              autoComplete="email"
              disabled={isLoading}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Mật khẩu"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                error={errors.password?.message}
                iconLeft={<Lock className="h-5 w-5" />}
                autoComplete="current-password"
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

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              Đăng nhập
            </Button>

            <div className="text-center">
              <p className="text-sm text-ink-muted">
                Chưa có tài khoản?{' '}
                <Link
                  to="/register"
                  className="text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
