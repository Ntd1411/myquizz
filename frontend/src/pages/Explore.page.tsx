import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, AlertCircle } from 'lucide-react'
import { quizService, type SearchQuizParams, type Quiz } from '@/services/quiz.service'
import { QuizCard, QuizCardSkeleton } from '@/components/ui/QuizCard'
import { cn } from '@/utils/cn'

const CATEGORIES = [
  { value: '', label: 'Tất cả danh mục' },
  { value: 'science', label: 'Khoa học' },
  { value: 'math', label: 'Toán học' },
  { value: 'history', label: 'Lịch sử' },
  { value: 'geography', label: 'Địa lý' },
  { value: 'literature', label: 'Văn học' },
  { value: 'art', label: 'Nghệ thuật' },
  { value: 'music', label: 'Âm nhạc' },
  { value: 'sports', label: 'Thể thao' },
  { value: 'technology', label: 'Công nghệ' },
  { value: 'general', label: 'Tổng hợp' }
]

const LANGUAGES = [
  { value: '', label: 'Tất cả ngôn ngữ' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' }
]

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false
  })

  // Get params from URL
  const keyword = searchParams.get('keyword') || ''
  const category = searchParams.get('category') || ''
  const language = searchParams.get('language') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)

  // Search input local state với debounce
  const [searchInput, setSearchInput] = useState(keyword)

  // Fetch quizzes
  const fetchQuizzes = useCallback(async (params: SearchQuizParams) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await quizService.searchQuizzes(params)
      setQuizzes(response.data)
      setPagination(response.pagination)
    } catch (err) {
      console.error('Error fetching quizzes:', err)
      setError('Đã xảy ra lỗi khi tải quiz. Vui lòng thử lại.')
      setQuizzes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== keyword) {
        const params = new URLSearchParams(searchParams)
        if (searchInput) {
          params.set('keyword', searchInput)
        } else {
          params.delete('keyword')
        }
        params.set('page', '1') // Reset to page 1 on new search
        setSearchParams(params)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, keyword, searchParams, setSearchParams])

  // Fetch when params change
  useEffect(() => {
    fetchQuizzes({
      keyword: keyword || undefined,
      category: category || undefined,
      language: language || undefined,
      page,
      limit: pagination.limit
    })
  }, [keyword, category, language, page, pagination.limit, fetchQuizzes])

  // Handle filter changes
  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('category', value)
    } else {
      params.delete('category')
    }
    params.set('page', '1')
    setSearchParams(params)
  }

  const handleLanguageChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set('language', value)
    } else {
      params.delete('language')
    }
    params.set('page', '1')
    setSearchParams(params)
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setSearchParams({})
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', newPage.toString())
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasActiveFilters = keyword || category || language

  return (
    <div className="min-h-screen bg-bg py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink mb-2">Khám phá Quiz</h1>
          <p className="text-lg text-ink-muted">Tìm kiếm và chơi hàng ngàn quiz thú vị</p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" aria-hidden="true" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm quiz theo tên hoặc mô tả..."
              className={cn(
                'w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-base',
                'text-base text-ink placeholder:text-ink-muted',
                'transition-all duration-base',
                'hover:border-border-strong',
                'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10'
              )}
              aria-label="Tìm kiếm quiz"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Category Select */}
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={cn(
                'px-4 py-2.5 bg-surface border border-border rounded-base',
                'text-sm text-ink cursor-pointer',
                'transition-all duration-base',
                'hover:border-border-strong',
                'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10'
              )}
              aria-label="Lọc theo danh mục"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            {/* Language Select */}
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className={cn(
                'px-4 py-2.5 bg-surface border border-border rounded-base',
                'text-sm text-ink cursor-pointer',
                'transition-all duration-base',
                'hover:border-border-strong',
                'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10'
              )}
              aria-label="Lọc theo ngôn ngữ"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-base',
                  'text-sm text-ink-muted hover:text-ink',
                  'transition-all duration-base',
                  'hover:bg-surface-hover hover:border-border-strong',
                  'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10'
                )}
                aria-label="Xóa bộ lọc"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>Xóa bộ lọc</span>
              </button>
            )}

            {/* Results Count */}
            {!isLoading && (
              <span className="text-sm text-ink-muted ml-auto">
                {pagination.total} kết quả
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          // Loading State
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <QuizCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          // Error State
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <AlertCircle className="w-12 h-12 text-danger mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-ink mb-2">Đã xảy ra lỗi</h2>
            <p className="text-ink-muted mb-6 max-w-md">{error}</p>
            <button
              onClick={() => fetchQuizzes({ keyword, category, language, page, limit: pagination.limit })}
              className={cn(
                'px-6 py-3 bg-primary text-white font-medium rounded-base',
                'transition-all duration-base',
                'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-sm',
                'focus:outline-none focus:ring-4 focus:ring-primary/30'
              )}
            >
              Thử lại
            </button>
          </div>
        ) : quizzes.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Search className="w-12 h-12 text-ink-subtle mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-ink mb-2">
              {hasActiveFilters ? 'Không tìm thấy quiz phù hợp' : 'Chưa có quiz nào'}
            </h2>
            <p className="text-ink-muted mb-6 max-w-md">
              {hasActiveFilters
                ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm kết quả.'
                : 'Hãy quay lại sau để khám phá các quiz mới.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className={cn(
                  'px-6 py-3 bg-primary text-white font-medium rounded-base',
                  'transition-all duration-base',
                  'hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-sm',
                  'focus:outline-none focus:ring-4 focus:ring-primary/30'
                )}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          // Quiz Grid
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {quizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className={cn(
                    'px-4 py-2 border rounded-base font-medium transition-all duration-base',
                    pagination.hasPreviousPage
                      ? 'bg-surface border-border text-ink hover:bg-surface-hover hover:border-border-strong'
                      : 'bg-surface border-border text-ink-subtle cursor-not-allowed opacity-50'
                  )}
                  aria-label="Trang trước"
                >
                  Trước
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 7) {
                      pageNum = i + 1
                    } else if (page <= 4) {
                      pageNum = i + 1
                    } else if (page >= pagination.totalPages - 3) {
                      pageNum = pagination.totalPages - 6 + i
                    } else {
                      pageNum = page - 3 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          'w-10 h-10 rounded-base font-medium transition-all duration-base',
                          pageNum === page
                            ? 'bg-primary text-white'
                            : 'bg-surface border border-border text-ink hover:bg-surface-hover hover:border-border-strong'
                        )}
                        aria-label={`Trang ${pageNum}`}
                        aria-current={pageNum === page ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!pagination.hasNextPage}
                  className={cn(
                    'px-4 py-2 border rounded-base font-medium transition-all duration-base',
                    pagination.hasNextPage
                      ? 'bg-surface border-border text-ink hover:bg-surface-hover hover:border-border-strong'
                      : 'bg-surface border-border text-ink-subtle cursor-not-allowed opacity-50'
                  )}
                  aria-label="Trang sau"
                >
                  Sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
