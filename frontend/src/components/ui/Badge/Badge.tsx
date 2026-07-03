import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'base' | 'lg'
  dot?: boolean
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      dot = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          'transition-colors duration-150',
          
          // Size variants
          size === 'sm' && 'px-2 py-0.5 text-xs',
          size === 'base' && 'px-2.5 py-1 text-sm',
          size === 'lg' && 'px-3 py-1.5 text-base',
          
          // Variant styles
          variant === 'primary' && 'bg-primary-subtle text-primary border border-primary-border',
          variant === 'secondary' && 'bg-surface text-ink border border-border',
          variant === 'success' && 'bg-success-subtle text-success border border-success-border',
          variant === 'warning' && 'bg-warning-subtle text-warning border border-warning-border',
          variant === 'danger' && 'bg-danger-subtle text-danger border border-danger-border',
          variant === 'info' && 'bg-info-subtle text-info border border-info-border',
          
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'inline-block rounded-full',
              size === 'sm' && 'h-1.5 w-1.5',
              size === 'base' && 'h-2 w-2',
              size === 'lg' && 'h-2.5 w-2.5',
              variant === 'primary' && 'bg-primary',
              variant === 'secondary' && 'bg-ink-muted',
              variant === 'success' && 'bg-success',
              variant === 'warning' && 'bg-warning',
              variant === 'danger' && 'bg-danger',
              variant === 'info' && 'bg-info'
            )}
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
