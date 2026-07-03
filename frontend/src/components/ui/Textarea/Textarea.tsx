import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  fullWidth?: boolean
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      fullWidth = false,
      resize = 'vertical',
      disabled,
      className,
      id,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = !!error

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined
          }
          className={cn(
            // Base styles
            'w-full rounded-lg border bg-bg px-3 py-2 text-base text-ink',
            'transition-all duration-150 ease-out',
            'placeholder:text-ink-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            
            // Resize
            resize === 'none' && 'resize-none',
            resize === 'vertical' && 'resize-y',
            resize === 'horizontal' && 'resize-x',
            resize === 'both' && 'resize',
            
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
        
        {error && (
          <p
            id={`${textareaId}-error`}
            className="text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p
            id={`${textareaId}-hint`}
            className="text-sm text-ink-muted"
          >
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
