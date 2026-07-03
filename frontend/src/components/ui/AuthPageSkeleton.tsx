import { Skeleton } from './Skeleton'
import { Card } from './Card'

export function AuthPageSkeleton() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          {/* Title skeleton */}
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />

          {/* Form fields skeleton */}
          <div className="space-y-6">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-11 w-full" />
            </div>

            {/* Button skeleton */}
            <Skeleton className="h-11 w-full" />

            {/* Footer links skeleton */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
