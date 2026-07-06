// Performance monitoring utilities

/**
 * Measure and log performance metrics
 */
export const measurePerformance = () => {
  if (typeof window === 'undefined') return

  // Wait for page load
  window.addEventListener('load', () => {
    // Get navigation timing
    const perfData = window.performance.timing
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart
    const connectTime = perfData.responseEnd - perfData.requestStart
    const renderTime = perfData.domComplete - perfData.domLoading

    if (import.meta.env.DEV) {
      console.log('Performance Metrics:', {
        pageLoadTime: `${pageLoadTime}ms`,
        connectTime: `${connectTime}ms`,
        renderTime: `${renderTime}ms`,
      })
    }

    // Get resource timing
    const resources = window.performance.getEntriesByType('resource')
    const jsResources = resources.filter((r) => r.name.endsWith('.js'))
    const cssResources = resources.filter((r) => r.name.endsWith('.css'))

    if (import.meta.env.DEV) {
      console.log('Resource Stats:', {
        totalResources: resources.length,
        jsFiles: jsResources.length,
        cssFiles: cssResources.length,
      })
    }
  })
}

/**
 * Mark custom performance events
 */
export const markPerformance = (name: string) => {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.mark(name)
  }
}

/**
 * Measure time between two marks
 */
export const measureBetween = (name: string, startMark: string, endMark: string) => {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      window.performance.measure(name, startMark, endMark)
      const measure = window.performance.getEntriesByName(name)[0]
      if (import.meta.env.DEV && measure) {
        console.log(`${name}: ${measure.duration.toFixed(2)}ms`)
      }
      return measure?.duration
    } catch (e) {
      // Marks might not exist
    }
  }
}

/**
 * Report long tasks (tasks > 50ms)
 */
export const observeLongTasks = () => {
  if (typeof window === 'undefined') return

  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (import.meta.env.DEV && entry.duration > 50) {
            console.warn('Long Task detected:', {
              duration: `${entry.duration.toFixed(2)}ms`,
              startTime: entry.startTime,
            })
          }
        }
      })

      observer.observe({ entryTypes: ['longtask'] })
    } catch (e) {
      // Long tasks API might not be supported
    }
  }
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
