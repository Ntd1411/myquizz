import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  variant?: 'default' | 'danger' | 'ghost'
  size?: 'sm' | 'base' | 'lg'
  loading?: boolean
  'aria-label': string // Required for accessibility
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'default',
      size = 'base',
      loading = false,
      disabled,
      className,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-label={ariaLabel}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-lg',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          
          // Size variants
          size === 'sm' && 'h-8 w-8 text-sm',
          size === 'base' && 'h-10 w-10 text-base',
          size === 'lg' && 'h-12 w-12 text-lg',
          
          // Variant styles
          variant === 'default' && [
            'bg-transparent text-ink',
            'hover:bg-surface active:bg-surface-hover',
            'focus-visible:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          variant === 'danger' && [
            'bg-transparent text-danger',
            'hover:bg-danger-subtle active:bg-danger-subtle/80',
            'focus-visible:ring-danger',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          variant === 'ghost' && [
            'bg-transparent text-ink-muted',
            'hover:text-ink hover:bg-surface',
            'active:bg-surface-hover',
            'focus-visible:ring-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ],
          
          // Loading state
          loading && 'relative',
          
          className
        )}
        {...props}
      >
        {loading ? (
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
        ) : (
          icon
        )}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
