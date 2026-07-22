import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { useEffect } from 'react'
import { useThemeStore } from '@/stores'
import { useAuthStore } from '@/stores/auth.store'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const updateResolvedTheme = useThemeStore((state) => state.updateResolvedTheme)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    updateResolvedTheme()

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => updateResolvedTheme()
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [updateResolvedTheme])

  // Check auth khi app khởi động
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
