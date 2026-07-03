import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: 'sm' | 'base' | 'lg'
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  showLabel?: boolean
  label?: string
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      size = 'base',
      variant = 'primary',
      showLabel = false,
      label,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    return (
      <div
        ref={ref}
        className={cn('w-full', className)}
        {...props}
      >
        {(showLabel || label) && (
          <div className="mb-2 flex items-center justify-between text-sm">
            {label && <span className="text-ink-muted">{label}</span>}
            {showLabel && (
              <span className="font-medium text-ink">{Math.round(percentage)}%</span>
            )}
          </div>
        )}
        
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={cn(
            'w-full rounded-full bg-surface overflow-hidden',
            size === 'sm' && 'h-1',
            size === 'base' && 'h-2',
            size === 'lg' && 'h-3'
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300 ease-out',
              variant === 'primary' && 'bg-primary',
              variant === 'success' && 'bg-success',
              variant === 'warning' && 'bg-warning',
              variant === 'danger' && 'bg-danger'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }
)

Progress.displayName = 'Progress'
