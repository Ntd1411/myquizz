import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  const reduce = useReducedMotion()

  const hoverAnimation = hover && !reduce ? {
    y: -4,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
  } : {}

  return (
    <motion.div
      className={`card ${className}`}
      whileHover={hoverAnimation}
    >
      {children}
    </motion.div>
  )
}

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  className?: string
  fullWidth?: boolean
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  fullWidth = false,
}: ButtonProps) {
  const baseClass = variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : 'btn-ghost'
  const widthClass = fullWidth ? 'w-full' : ''
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : ''

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${widthClass} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  )
}

interface InputProps {
  type?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  label,
  error,
  required = false,
  disabled = false,
}: InputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`input ${error ? 'border-error focus:ring-error' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      {error && <span className="text-sm text-error">{error}</span>}
    </div>
  )
}

interface TextAreaProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  label?: string
  error?: string
  required?: boolean
  rows?: number
}

export function TextArea({
  placeholder,
  value,
  onChange,
  label,
  error,
  required = false,
  rows = 4,
}: TextAreaProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`input resize-none ${error ? 'border-error focus:ring-error' : ''}`}
      />
      {error && <span className="text-sm text-error">{error}</span>}
    </div>
  )
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
  error?: string
  required?: boolean
}

export function Select({
  value,
  onChange,
  options,
  label,
  error,
  required = false,
}: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${error ? 'border-error focus:ring-error' : ''}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="text-sm text-error">{error}</span>}
    </div>
  )
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center">
      <motion.div
        className="border-2 border-primary border-t-transparent rounded-full"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
