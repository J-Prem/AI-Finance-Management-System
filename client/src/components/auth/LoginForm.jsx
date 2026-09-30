import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { FaEnvelope, FaLock, FaShieldAlt, FaFingerprint } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { login } from '../../store/slices/authSlice'
import LoadingSpinner from '../common/LoadingSpinner'

export default function LoginForm() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector((state) => state.auth)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.email || !formData.password) {
      toast.error('Please fill in all fields')
      return
    }

    const result = await dispatch(login(formData))
    if (login.fulfilled.match(result)) {
      toast.success('Logged in successfully')
      navigate('/dashboard')
    } else {
      toast.error(result.payload || 'Login failed')
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <FaEnvelope className="absolute left-4 top-3.5 text-navy-400 dark:text-navy-500" size={18} />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@example.com"
              className="input-base pl-12 w-full"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Password
          </label>
          <div className="relative">
            <FaLock className="absolute left-4 top-3.5 text-navy-400 dark:text-navy-500" size={18} />
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="input-base pl-12 w-full"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border border-navy-300 dark:border-navy-600"
            />
            <span className="text-sm text-navy-600 dark:text-navy-400">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-sm text-primary-500 hover:text-primary-600">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-3 text-[11px]">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
          <FaShieldAlt size={14} />
          <span className="font-medium">Bank-grade TLS 1.3</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
          <FaFingerprint size={14} />
          <span className="font-medium">SOC 2 · ISO 27001</span>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-navy-600 dark:text-navy-400">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
          Sign up
        </Link>
      </p>
    </div>
  )
}
