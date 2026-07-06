import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  withCredentials: true, // Quan trọng: Gửi HttpOnly cookies tự động
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor để xử lý refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Nếu 401 và chưa retry, thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Gọi refresh endpoint - backend sẽ đọc refreshToken từ cookies
        // và set accessToken mới vào cookies
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        )

        // Retry request gốc - browser sẽ tự động gửi accessToken mới
        return apiClient(originalRequest)
      } catch (refreshError) {
        // Refresh thất bại - chỉ redirect nếu đang ở trang protected
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname
          const publicPaths = ['/welcome', '/login', '/register', '/forgot-password', '/explore', '/game/join']
          const isPublicPath = publicPaths.some(path => currentPath.startsWith(path))
          
          // Chỉ redirect nếu không phải trang public
          if (!isPublicPath) {
            window.location.href = '/welcome'
          }
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
