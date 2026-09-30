import { Link } from 'react-router-dom'
import RegisterForm from '../components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-emerald-500 bg-clip-text text-transparent inline-block">
            FinanceAI
          </Link>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-navy-100 mt-4">
            Create Your Account
          </h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            Start managing your finances smarter with AI
          </p>
        </div>

        <RegisterForm />
      </div>
    </div>
  )
}
