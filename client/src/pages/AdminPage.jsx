import { useState } from 'react'
import Layout from '../components/common/Layout'
import { FaUsers, FaChartLine, FaCreditCard, FaCheck } from 'react-icons/fa'
import StatCard from '../components/common/StatCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AdminPage() {
  const [selectedTab, setSelectedTab] = useState('overview')

  const revenueData = [
    { month: 'Jan', revenue: 5000, users: 120 },
    { month: 'Feb', revenue: 8000, users: 180 },
    { month: 'Mar', revenue: 12000, users: 250 },
    { month: 'Apr', revenue: 15000, users: 320 },
    { month: 'May', revenue: 18000, users: 400 },
    { month: 'Jun', revenue: 22000, users: 480 },
  ]

  const recentSignups = [
    { id: 1, name: 'John Doe', email: 'john@example.com', plan: 'Pro', joined: '2024-11-21' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', plan: 'Free', joined: '2024-11-20' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', plan: 'Enterprise', joined: '2024-11-19' },
  ]

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy-900 dark:text-navy-100">Admin Dashboard</h1>
          <p className="text-navy-600 dark:text-navy-400 mt-2">
            System overview and analytics
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={FaUsers}
            label="Total Users"
            value={1250}
            trend="up"
            trendValue={12.5}
            currency={false}
            color="primary"
          />
          <StatCard
            icon={FaCreditCard}
            label="Monthly Revenue"
            value={45000}
            trend="up"
            trendValue={8.2}
            color="emerald"
          />
          <StatCard
            icon={FaCheck}
            label="Active Subscriptions"
            value={850}
            trend="up"
            trendValue={5.3}
            currency={false}
            color="primary"
          />
          <StatCard
            icon={FaChartLine}
            label="Growth Rate"
            value={23.5}
            currency={false}
            suffix="%"
            color="amber"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-navy-200 dark:border-navy-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'subscriptions', label: 'Subscriptions' },
            { id: 'system', label: 'System' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-navy-600 dark:text-navy-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Revenue Chart */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-6">
                Revenue & User Growth
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Signups */}
            <div className="card overflow-hidden">
              <div className="p-6 border-b border-navy-200 dark:border-navy-700">
                <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100">
                  Recent Signups
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-800/50">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300">
                        Plan
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-navy-700 dark:text-navy-300">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSignups.map((signup) => (
                      <tr key={signup.id} className="border-b border-navy-200 dark:border-navy-700 hover:bg-navy-50 dark:hover:bg-navy-800">
                        <td className="px-6 py-4 text-sm font-medium text-navy-900 dark:text-navy-100">
                          {signup.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                          {signup.email}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="badge badge-primary">{signup.plan}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-navy-600 dark:text-navy-400">
                          {signup.joined}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'users' && (
          <div className="card p-6 text-center text-navy-600 dark:text-navy-400">
            User management features coming soon
          </div>
        )}

        {selectedTab === 'subscriptions' && (
          <div className="card p-6 text-center text-navy-600 dark:text-navy-400">
            Subscription analytics coming soon
          </div>
        )}

        {selectedTab === 'system' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-4">
              System Health
            </h3>
            <div className="space-y-3">
              {[
                { name: 'API Server', status: 'Operational', uptime: '99.9%' },
                { name: 'Database', status: 'Operational', uptime: '99.95%' },
                { name: 'ML Service', status: 'Operational', uptime: '99.8%' },
                { name: 'Cache Service', status: 'Operational', uptime: '99.7%' },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-navy-200 dark:border-navy-700 rounded-lg">
                  <span className="font-medium text-navy-900 dark:text-navy-100">{item.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-navy-600 dark:text-navy-400">Uptime: {item.uptime}</span>
                    <span className="badge badge-success">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
