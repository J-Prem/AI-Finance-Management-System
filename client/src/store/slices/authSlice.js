import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as authService from '../../services/authService'

const extractErrorMessage = (error, fallback) => {
  const body = error?.response?.data
  if (body?.errors && Array.isArray(body.errors) && body.errors.length > 0) {
    // Validation errors — show joined field messages.
    return body.errors.map((e) => e.message).join('. ')
  }
  return body?.message || error?.message || fallback
}

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials)
      if (!data?.token) {
        return rejectWithValue('Login succeeded but no token was returned')
      }
      localStorage.setItem('token', data.token)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Login failed'))
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const data = await authService.register(userData)
      if (!data?.token) {
        return rejectWithValue('Registration succeeded but no token was returned')
      }
      localStorage.setItem('token', data.token)
      return data
    } catch (error) {
      return rejectWithValue(extractErrorMessage(error, 'Registration failed'))
    }
  }
)

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout()
      localStorage.removeItem('token')
      return null
    } catch (error) {
      return rejectWithValue('Logout failed')
    }
  }
)

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authService.refreshToken()
      localStorage.setItem('token', data.token)
      return data
    } catch (error) {
      return rejectWithValue('Token refresh failed')
    }
  }
)

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authService.getCurrentUser()
      return data
    } catch (error) {
      return rejectWithValue('Failed to fetch user')
    }
  }
)

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.token
        state.user = action.payload.user
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.isAuthenticated = false
      })
      .addCase(register.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false
        state.isAuthenticated = true
        state.token = action.payload.token
        state.user = action.payload.user
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.loading = false
        state.error = null
      })
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.loading = false
        state.isAuthenticated = false
        state.token = null
        localStorage.removeItem('token')
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
