import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/UI'
import { EnvelopeSimple, LockKey, User, Phone } from '@phosphor-icons/react'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
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
      navigate('/login', { state: { message: 'Account created successfully. Please sign in.' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Create account</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Join MyQuizz and start creating quizzes</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <User
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                placeholder="Full name"
                value={formData.fullname}
                onChange={(e) => updateField('fullname', e.target.value)}
                required
                className="input pl-12"
              />
            </div>

            <div className="relative">
              <EnvelopeSimple
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                className="input pl-12"
              />
            </div>

            <div className="relative">
              <Phone
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="input pl-12"
              />
            </div>

            <div className="relative">
              <LockKey
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                className="input pl-12"
              />
            </div>

            <div className="relative">
              <LockKey
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                className="input pl-12"
              />
            </div>

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
