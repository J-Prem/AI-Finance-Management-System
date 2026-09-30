import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Share a single in-flight refresh so parallel 401s don't race.
let refreshInFlight = null

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config || {}
    const url = originalRequest.url || ''

    // Never try to refresh on the auth endpoints themselves.
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      const storedRefresh = localStorage.getItem('refreshToken')
      if (!storedRefresh) {
        localStorage.removeItem('token')
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      try {
        if (!refreshInFlight) {
          refreshInFlight = axios
            .post('/api/auth/refresh', { refreshToken: storedRefresh })
            .then((res) => {
              const tokens = res?.data?.data?.tokens
              if (tokens?.accessToken) {
                localStorage.setItem('token', tokens.accessToken)
              }
              if (tokens?.refreshToken) {
                localStorage.setItem('refreshToken', tokens.refreshToken)
              }
              return tokens?.accessToken
            })
            .finally(() => {
              refreshInFlight = null
            })
        }

        const newAccessToken = await refreshInFlight
        if (!newAccessToken) throw new Error('refresh-failed')

        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
