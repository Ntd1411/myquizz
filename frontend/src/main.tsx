import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useAuthStore } from './lib/store'
import { api } from './lib/api'
import './styles/app.css'

function AppWithAuth() {
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    const token = api.getAccessToken()
    if (token) {
      api.getMe()
        .then((user) => setUser(user))
        .catch(() => {
          api.setAccessToken(null)
          setUser(null)
        })
    }
  }, [setUser])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithAuth />
  </StrictMode>
)
