import { ImgHTMLAttributes, forwardRef, useState } from 'react'
import { cn } from '@/utils/cn'

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'size'> {
  size?: 'sm' | 'base' | 'lg' | 'xl'
  fallback?: string
  status?: 'online' | 'offline' | 'away' | 'busy'
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      size = 'base',
      fallback,
      status,
      src,
      alt = '',
      className,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false)
    const showFallback = !src || imageError

    const initials = fallback
      ? fallback
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : alt
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full bg-primary-subtle text-primary font-semibold shrink-0',
          size === 'sm' && 'h-8 w-8 text-xs',
          size === 'base' && 'h-10 w-10 text-sm',
          size === 'lg' && 'h-12 w-12 text-base',
          size === 'xl' && 'h-16 w-16 text-lg',
          className
        )}
      >
        {showFallback ? (
          <span>{initials || '?'}</span>
        ) : (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
            className="h-full w-full rounded-full object-cover"
            {...props}
          />
        )}

        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-2 border-bg',
              size === 'sm' && 'h-2 w-2',
              size === 'base' && 'h-2.5 w-2.5',
              size === 'lg' && 'h-3 w-3',
              size === 'xl' && 'h-4 w-4',
              status === 'online' && 'bg-success',
              status === 'offline' && 'bg-ink-subtle',
              status === 'away' && 'bg-warning',
              status === 'busy' && 'bg-danger'
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
