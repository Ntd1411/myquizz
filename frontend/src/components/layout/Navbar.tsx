import { Link } from 'react-router-dom'
import { useThemeStore } from '@/stores'

export function Navbar() {
  const { theme, setTheme } = useThemeStore()

  const handleToggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(newTheme)
  }

  return (
    <nav className="bg-surface border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="font-display text-xl font-bold text-primary">
            MyQuizz
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleTheme}
              className="px-3 py-2 rounded-md text-sm font-medium text-ink hover:bg-surface-hover transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
