import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'base' | 'lg'
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          
          // Size variants
          size === 'sm' && 'h-8 px-3 text-sm',
          size === 'base' && 'h-10 px-4 text-base',
          size === 'lg' && 'h-12 px-6 text-lg',
          
          // Variant styles
          variant === 'primary' && [
            'bg-primary text-white',
            'hover:bg-primary-hover active:bg-primary-active',
            'focus-visible:ring-primary',
            'disabled:bg-primary/50 disabled:cursor-not-allowed',
          ],
          variant === 'secondary' && [
            'bg-surface text-ink border border-border',
            'hover:bg-surface-hover active:bg-surface-active',
            'focus-visible:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          variant === 'danger' && [
            'bg-danger text-white',
            'hover:bg-danger-hover active:bg-danger-hover',
            'focus-visible:ring-danger',
            'disabled:bg-danger/50 disabled:cursor-not-allowed',
          ],
          variant === 'ghost' && [
            'bg-transparent text-ink',
            'hover:bg-surface active:bg-surface-hover',
            'focus-visible:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          variant === 'outline' && [
            'bg-transparent text-ink border-2 border-border',
            'hover:bg-surface hover:border-border-strong',
            'active:bg-surface-hover',
            'focus-visible:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          
          // Full width
          fullWidth && 'w-full',
          
          // Loading state
          loading && 'relative text-transparent',
          
          className
        )}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
        
        {iconLeft && !loading && <span className="shrink-0">{iconLeft}</span>}
        {children}
        {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
