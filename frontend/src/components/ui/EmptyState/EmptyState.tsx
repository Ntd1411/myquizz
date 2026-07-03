import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      title,
      description,
      action,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center p-8',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mb-4 text-ink-subtle">
            {icon}
          </div>
        )}
        
        <h3 className="text-lg font-semibold text-ink mb-2">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-ink-muted mb-6 max-w-md">
            {description}
          </p>
        )}
        
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </div>
    )
  }
)

EmptyState.displayName = 'EmptyState'
