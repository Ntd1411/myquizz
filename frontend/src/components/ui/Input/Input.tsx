import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      iconLeft,
      iconRight,
      fullWidth = false,
      disabled,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = !!error

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {iconLeft && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
              {iconLeft}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              // Base styles
              'h-10 w-full rounded-lg border bg-bg px-3 text-base text-ink',
              'transition-all duration-150 ease-out',
              'placeholder:text-ink-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              
              // Icon padding
              iconLeft && 'pl-10',
              iconRight && 'pr-10',
              
              // States
              !hasError && !disabled && [
                'border-border',
                'hover:border-border-strong',
                'focus-visible:border-primary focus-visible:ring-primary',
              ],
              hasError && [
                'border-danger',
                'focus-visible:border-danger focus-visible:ring-danger',
              ],
              disabled && [
                'opacity-50 cursor-not-allowed bg-surface',
              ],
              
              className
            )}
            {...props}
          />
          
          {iconRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none">
              {iconRight}
            </div>
          )}
        </div>
        
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-sm text-ink-muted"
          >
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
