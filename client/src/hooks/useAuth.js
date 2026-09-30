import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getCurrentUser, logout } from '../store/slices/authSlice'

export const useAuth = () => {
  const dispatch = useDispatch()
  const { user, isAuthenticated, loading, token } = useSelector((state) => state.auth)

  useEffect(() => {
    if (token && !user) {
      dispatch(getCurrentUser())
    }
  }, [token, user, dispatch])

  const handleLogout = () => {
    dispatch(logout())
  }

  return {
    user,
    isAuthenticated,
    loading,
    logout: handleLogout,
  }
}
