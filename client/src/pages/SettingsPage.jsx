import { useState, useEffect } from 'react'
import Layout from '../components/common/Layout'
import { useAuth } from '../hooks/useAuth'
import { useDispatch } from 'react-redux'
import { getCurrentUser } from '../store/slices/authSlice'
import { FaBell, FaLock, FaUser, FaShieldAlt } from 'react-icons/fa'
import toast from 'react-hot-toast'
import * as authService from '../services/authService'

const NOTIF_KEY = 'ai-finance-notification-prefs'

const DEFAULT_PREFS = {
  budgetAlerts: true,
  transactionAlerts: false,
  insightsTips: true,
  weeklySummary: true,
}

export default function SettingsPage() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const [selectedTab, setSelectedTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}')) }
    } catch { return DEFAULT_PREFS }
  })

  // Keep in sync with auth state when user loads later
  useEffect(() => {
    setFormData((f) => ({ ...f, name: user?.name || f.name, email: user?.email || f.email }))
  }, [user])

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FaUser },
    { id: 'security', label: 'Security', icon: FaLock },
    { id: 'notifications', label: 'Notifications', icon: FaBell },
    { id: 'privacy', label: 'Privacy', icon: FaShieldAlt },
  ]

  const handleSaveProfile = async () => {
    if (!formData.name?.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await authService.updateProfile({ name: formData.name })
      dispatch(getCurrentUser())
      toast.success('Profile updated')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!formData.currentPassword || !formData.newPassword) {
      toast.error('Please enter both passwords'); return
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match'); return
    }
    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return
    }
    setSaving(true)
    try {
      await authService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      })
      toast.success('Password changed successfully')
      setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Password change failed')
    } finally { setSaving(false) }
  }

  const handleNotifChange = (key) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
    toast.success('Preference saved')
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Settings</h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      selectedTab === tab.id
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-navy-600 dark:text-navy-400 hover:bg-navy-100 dark:hover:bg-navy-800'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {selectedTab === 'profile' && (
              <div className="card p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100 mb-6">
                    Profile Information
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input-base w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="input-base w-full opacity-75"
                      />
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'security' && (
              <div className="card p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100 mb-6">
                    Change Password
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className="input-base w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="input-base w-full"
                      />
                      <p className="text-xs text-navy-500 mt-1">
                        At least 8 chars, include upper, lower, number & special.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-navy-700 dark:text-navy-300 mb-2">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="input-base w-full"
                      />
                    </div>
                    <button onClick={handleChangePassword} disabled={saving} className="btn-primary">
                      {saving ? 'Updating…' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'notifications' && (
              <div className="card p-8 space-y-6">
                <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100 mb-6">
                  Notification Preferences
                </h2>
                <div className="space-y-4">
                  {[
                    { key: 'budgetAlerts', label: 'Budget Alerts', desc: 'Get notified when spending exceeds budget' },
                    { key: 'transactionAlerts', label: 'Transaction Alerts', desc: 'Get notified for every transaction' },
                    { key: 'insightsTips', label: 'Insights & Tips', desc: 'Receive AI-powered financial insights' },
                    { key: 'weeklySummary', label: 'Weekly Summary', desc: 'Get a weekly summary of your finances' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 border border-navy-200 dark:border-navy-700 rounded-lg">
                      <div>
                        <p className="font-medium text-navy-900 dark:text-navy-100">{item.label}</p>
                        <p className="text-sm text-navy-600 dark:text-navy-400">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!notifPrefs[item.key]}
                        onChange={() => handleNotifChange(item.key)}
                        className="w-5 h-5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'privacy' && (
              <div className="card p-8 space-y-6">
                <h2 className="text-xl font-semibold text-navy-900 dark:text-navy-100 mb-6">Privacy</h2>
                <p className="text-navy-600 dark:text-navy-400">
                  Your data is stored encrypted in MongoDB Atlas. AI features route through Google Gemini
                  and Hugging Face Inference APIs (free tier); neither provider trains on your data when
                  accessed via API. Receipts and transactions are scoped to your user ID only.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
