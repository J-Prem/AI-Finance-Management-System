import api from './api'

/**
 * Backend shape (after the axios response interceptor unwraps .data):
 *   register / login:
 *     { success, message, data: { user, tokens: { accessToken, refreshToken } } }
 *   refresh:
 *     { success,          data: {       tokens: { accessToken, refreshToken } } }
 *   me:
 *     { success,          data: { user } }
 *
 * We persist both access + refresh tokens in localStorage so that the axios
 * refresh interceptor can recover expired sessions.
 */

const REFRESH_KEY = 'refreshToken'

export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials)
  const accessToken = response?.data?.tokens?.accessToken
  const refreshToken = response?.data?.tokens?.refreshToken
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken)
  }
  return { token: accessToken, user: response?.data?.user }
}

export const register = async (userData) => {
  const response = await api.post('/auth/register', userData)
  const accessToken = response?.data?.tokens?.accessToken
  const refreshToken = response?.data?.tokens?.refreshToken
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken)
  }
  return { token: accessToken, user: response?.data?.user }
}

export const logout = async () => {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem(REFRESH_KEY)
  }
}

export const refreshToken = async () => {
  const stored = localStorage.getItem(REFRESH_KEY)
  const response = await api.post('/auth/refresh', { refreshToken: stored })
  const accessToken = response?.data?.tokens?.accessToken
  const newRefresh = response?.data?.tokens?.refreshToken
  if (newRefresh) {
    localStorage.setItem(REFRESH_KEY, newRefresh)
  }
  return { token: accessToken }
}

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me')
  return response?.data?.user
}

// Server route is PATCH /api/auth/profile (not PUT).
export const updateProfile = async (data) => {
  return api.patch('/auth/profile', data)
}

export const changePassword = async (data) => {
  return api.post('/auth/change-password', data)
}

export const forgotPassword = async (email) => {
  return api.post('/auth/forgot-password', { email })
}

export const resetPassword = async (token, password) => {
  return api.post('/auth/reset-password', { token, password })
}

export const verifyEmail = async (token) => {
  return api.post('/auth/verify-email', { token })
}

export const resendVerificationEmail = async (email) => {
  return api.post('/auth/resend-verification', { email })
}
