import { Link } from 'react-router-dom'
import { Book, Users, Clock } from 'lucide-react'
import type { Quiz } from '@/services/quiz.service'
import { cn } from '@/utils/cn'

interface QuizCardProps {
  quiz: Quiz
  className?: string
}

export function QuizCard({ quiz, className }: QuizCardProps) {
  const questionCount = quiz.questions?.length || 0
  const ownerName = quiz.owner?.fullname || 'Unknown'

  // Generate gradient fallback dựa trên category
  const getCategoryGradient = (category?: string) => {
    if (!category) return 'linear-gradient(135deg, oklch(0.92 0.035 212), oklch(0.88 0.055 212))'
    
    const categoryColors: Record<string, string> = {
      'science': 'linear-gradient(135deg, oklch(0.92 0.045 145), oklch(0.88 0.070 145))',
      'math': 'linear-gradient(135deg, oklch(0.92 0.055 25), oklch(0.88 0.090 25))',
      'history': 'linear-gradient(135deg, oklch(0.92 0.050 65), oklch(0.88 0.080 65))',
      'geography': 'linear-gradient(135deg, oklch(0.92 0.035 230), oklch(0.88 0.055 230))',
      'literature': 'linear-gradient(135deg, oklch(0.92 0.045 285), oklch(0.88 0.070 285))',
      'art': 'linear-gradient(135deg, oklch(0.92 0.050 340), oklch(0.88 0.080 340))',
      'music': 'linear-gradient(135deg, oklch(0.92 0.045 320), oklch(0.88 0.070 320))',
      'sports': 'linear-gradient(135deg, oklch(0.92 0.050 120), oklch(0.88 0.080 120))',
      'technology': 'linear-gradient(135deg, oklch(0.92 0.035 200), oklch(0.88 0.055 200))',
      'general': 'linear-gradient(135deg, oklch(0.92 0.035 212), oklch(0.88 0.055 212))'
    }
    
    return categoryColors[category.toLowerCase()] || categoryColors.general
  }

  return (
    <Link
      to={`/quiz/${quiz.id}`}
      className={cn(
        'group block bg-surface border border-border rounded-base overflow-hidden',
        'transition-all duration-base ease-out',
        'hover:bg-surface-hover hover:border-border-strong hover:shadow-sm hover:-translate-y-0.5',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
        className
      )}
    >
      {/* Quiz Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-surface">
        {quiz.quiz_image ? (
          <img
            src={quiz.quiz_image}
            alt={quiz.quiz_name}
            className="w-full h-full object-cover transition-transform duration-base group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: getCategoryGradient(quiz.quiz_category) }}
          >
            <Book className="w-12 h-12 text-primary opacity-40" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {/* Category Badge */}
        {quiz.quiz_category && (
          <span className="inline-block px-3 py-1 text-xs font-medium text-primary bg-primary-subtle border border-primary-border rounded-sm">
            {quiz.quiz_category}
          </span>
        )}

        {/* Title */}
        <h3 className="text-xl font-semibold text-ink leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {quiz.quiz_name}
        </h3>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5" title={`${questionCount} câu hỏi`}>
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>{questionCount} câu</span>
          </span>
          <span className="flex items-center gap-1.5" title={`Tác giả: ${ownerName}`}>
            <Users className="w-4 h-4" aria-hidden="true" />
            <span className="truncate max-w-[120px]">{ownerName}</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

// Skeleton variant cho loading state
export function QuizCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'block bg-surface border border-border rounded-base overflow-hidden',
        className
      )}
    >
      {/* Image skeleton */}
      <div className="aspect-video w-full bg-surface-hover animate-pulse" />

      {/* Content skeleton */}
      <div className="p-6 space-y-3">
        {/* Category badge skeleton */}
        <div className="w-20 h-6 bg-surface-hover rounded-sm animate-pulse" />

        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-6 bg-surface-hover rounded animate-pulse" />
          <div className="h-6 bg-surface-hover rounded animate-pulse w-3/4" />
        </div>

        {/* Metadata skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-4 bg-surface-hover rounded animate-pulse" />
          <div className="w-24 h-4 bg-surface-hover rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}
