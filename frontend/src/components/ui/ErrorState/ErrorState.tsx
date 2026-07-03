import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode
  title?: string
  message: string
  action?: ReactNode
  variant?: 'error' | 'warning'
}

export const ErrorState = forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      icon,
      title = 'Đã xảy ra lỗi',
      message,
      action,
      variant = 'error',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center text-center p-8',
          className
        )}
        {...props}
      >
        {icon && (
          <div className={cn(
            'mb-4',
            variant === 'error' && 'text-danger',
            variant === 'warning' && 'text-warning'
          )}>
            {icon}
          </div>
        )}
        
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          variant === 'error' && 'text-danger',
          variant === 'warning' && 'text-warning'
        )}>
          {title}
        </h3>
        
        <p className="text-sm text-ink-muted mb-6 max-w-md">
          {message}
        </p>
        
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
    )
  }
)

ErrorState.displayName = 'ErrorState'
