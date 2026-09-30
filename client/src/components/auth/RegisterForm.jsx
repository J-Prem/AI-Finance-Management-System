import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { FaUser, FaEnvelope, FaLock } from 'react-icons/fa'
import toast from 'react-hot-toast'
import { register } from '../../store/slices/authSlice'

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [agreeTerms, setAgreeTerms] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector((state) => state.auth)

  // Server requires: 8+ chars, upper, lower, digit, special char.
  const strongPasswordRe =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[\s\S]{8,}$/

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (!strongPasswordRe.test(formData.password)) {
      toast.error(
        'Password must be 8+ chars with uppercase, lowercase, number, and special character'
      )
      return
    }

    if (!agreeTerms) {
      toast.error('Please agree to the terms and conditions')
      return
    }

    const result = await dispatch(register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
    }))

    if (register.fulfilled.match(result)) {
      toast.success('Account created successfully')
      navigate('/dashboard')
    } else {
      toast.error(result.payload || 'Registration failed')
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Full Name
          </label>
          <div className="relative">
            <FaUser className="absolute left-4 top-3.5 text-navy-400 dark:text-navy-500" size={18} />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="input-base pl-12 w-full"
              required
            />
          </div>
        </div>

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
          <p className="mt-2 text-xs text-navy-500 dark:text-navy-400">
            Must be at least 8 characters and include an uppercase letter, lowercase letter,
            number, and special character.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <FaLock className="absolute left-4 top-3.5 text-navy-400 dark:text-navy-500" size={18} />
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="input-base pl-12 w-full"
              required
            />
          </div>
        </div>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="w-4 h-4 rounded border border-navy-300 dark:border-navy-600 mt-1"
            required
          />
          <span className="text-sm text-navy-600 dark:text-navy-400">
            I agree to the{' '}
            <Link to="#" className="text-primary-500 hover:text-primary-600">
              Terms and Conditions
            </Link>
          </span>
        </label>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-600 dark:text-navy-400">
        Already have an account?{' '}
        <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
