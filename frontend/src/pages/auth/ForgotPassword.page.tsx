import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, AlertCircle, CheckCircle, ArrowLeft, ChevronLeft } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { authService } from '@/services/auth.service'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/validators/auth.validator'

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema)
  })

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      
      const response = await authService.forgotPassword(data)
      setSuccessMessage(response.message)
      reset()
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Gửi email thất bại. Vui lòng thử lại.')
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
            Khôi phục mật khẩu
          </p>
        </div>

        <Card>
          {successMessage ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 bg-success-subtle rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-ink">
                  Email đã được gửi
                </h2>
                <p className="text-ink-muted">
                  {successMessage}
                </p>
                <p className="text-sm text-ink-muted">
                  Vui lòng kiểm tra hộp thư của bạn và làm theo hướng dẫn để đặt lại mật khẩu.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setSuccessMessage(null)}
                >
                  Gửi lại email
                </Button>
                
                <Link to="/login" className="block">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                  >
                    Quay lại đăng nhập
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-ink">
                  Quên mật khẩu?
                </h2>
                <p className="text-sm text-ink-muted">
                  Nhập email của bạn và chúng tôi sẽ gửi hướng dẫn để đặt lại mật khẩu.
                </p>
              </div>

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
                autoFocus
                disabled={isLoading}
                {...register('email')}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                Gửi email khôi phục
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}
        </Card>

      </motion.div>
    </div>
  )
}
