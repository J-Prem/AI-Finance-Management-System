import { Link, useNavigate } from 'react-router-dom'
import {
  FaArrowRight,
  FaChartLine,
  FaBrain,
  FaShieldAlt,
  FaMobileAlt,
  FaBolt,
  FaUsers,
  FaLock,
  FaGlobe,
  FaPlay,
  FaCheck,
  FaTimes,
  FaStar,
  FaReceipt,
  FaWallet,
} from 'react-icons/fa'
import { MdTrendingUp } from 'react-icons/md'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const DEMO_SCREENS = [
  {
    title: 'Dashboard',
    caption: 'One-glance financial health across all accounts, bills, and investments.',
    bullet: 'Net worth, cash flow, top categories, upcoming bills — unified.',
    art: (
      <div className="relative w-full h-full bg-gradient-to-br from-emerald-100 to-primary-100 dark:from-emerald-900/40 dark:to-primary-900/40 rounded-xl p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-navy-500">Net worth</div>
            <div className="text-3xl font-bold text-navy-900 dark:text-navy-100">$ 124,850</div>
            <div className="text-xs text-emerald-600">+ 3.2% MoM</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-navy-500">Cash flow</div>
            <div className="text-2xl font-semibold text-emerald-600">+$ 3,420</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2 h-24 items-end">
          {[40, 60, 45, 70, 55, 85, 65, 75].map((h, i) => (
            <div key={i} className="bg-primary-500 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-4 text-xs text-navy-700 dark:text-navy-200">
          Dining -12%, Groceries +4%, Subscriptions -$28
        </div>
      </div>
    ),
  },
  {
    title: 'AI Advisor',
    caption: 'FinSight chatbot answers money questions using your real transactions.',
    bullet: 'Multi-LLM routing with automatic fallback — never silent.',
    art: (
      <div className="bg-white dark:bg-navy-800 rounded-xl p-4 space-y-3 h-full">
        <div className="flex justify-end">
          <div className="bg-primary-500 text-white px-4 py-2 rounded-2xl text-sm max-w-[80%]">
            How much should I save this month?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-navy-100 dark:bg-navy-700 text-navy-900 dark:text-navy-100 px-4 py-2 rounded-2xl text-sm max-w-[85%]">
            Target <b>$ 820</b> (20% of take-home). You are $140 under after dining overspend — trim 2 restaurant visits to hit it.
            <div className="text-[10px] opacity-60 mt-1">via gemini · finsight</div>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary-500 text-white px-4 py-2 rounded-2xl text-sm max-w-[80%]">
            Find subscriptions I can cancel
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Receipt OCR',
    caption: 'Snap a receipt. AI extracts merchant, items, totals, and categorizes it.',
    bullet: 'Free-tier Gemini + HF + offline fallback — saves to DB permanently.',
    art: (
      <div className="bg-white dark:bg-navy-800 rounded-xl p-4 h-full">
        <div className="flex items-start gap-4">
          <div className="w-16 h-24 bg-navy-100 dark:bg-navy-900 rounded text-center pt-2 text-2xl">🧾</div>
          <div className="flex-1">
            <div className="font-semibold">Whole Foods Market</div>
            <div className="text-xs text-navy-500">04/19/2026 · gemini · 93% conf</div>
            <div className="mt-2 text-sm space-y-0.5 text-navy-700 dark:text-navy-200">
              <div className="flex justify-between"><span>Organic Milk</span><span>$ 6.98</span></div>
              <div className="flex justify-between"><span>Sourdough</span><span>$ 4.50</span></div>
              <div className="flex justify-between"><span>Avocado x3</span><span>$ 5.97</span></div>
            </div>
            <div className="mt-2 flex justify-between border-t pt-1 text-sm font-bold">
              <span>Total</span><span>$ 17.45</span>
            </div>
            <div className="mt-1 inline-block text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
              Food &amp; Dining → Groceries
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Portfolio',
    caption: 'Live investment tracking with real-time prices and P&L breakdown.',
    bullet: 'Stocks, mutual funds, crypto, gold — one portfolio.',
    art: (
      <div className="bg-white dark:bg-navy-800 rounded-xl p-4 h-full">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded p-3">
            <div className="text-xs">Value</div>
            <div className="font-bold">$ 184,320</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded p-3">
            <div className="text-xs">P&amp;L</div>
            <div className="font-bold text-emerald-600">+ $ 21,450</div>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded p-3">
            <div className="text-xs">Return</div>
            <div className="font-bold text-primary-700">+ 13.2%</div>
          </div>
        </div>
        <div className="mt-3 text-xs space-y-1">
          <div className="flex justify-between"><span>TCS</span><span className="text-emerald-600">+ 9.1%</span></div>
          <div className="flex justify-between"><span>S&amp;P 500 ETF</span><span className="text-emerald-600">+ 11.3%</span></div>
          <div className="flex justify-between"><span>BTC</span><span className="text-rose-600">- 2.4%</span></div>
        </div>
      </div>
    ),
  },
  {
    title: 'Bills Intelligence',
    caption: 'Auto-detected recurring bills from your transactions — never miss a due date.',
    bullet: 'Overdue alerts, autopay toggle, calendar view.',
    art: (
      <div className="bg-white dark:bg-navy-800 rounded-xl p-4 h-full">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between bg-rose-50 dark:bg-rose-900/30 p-2 rounded">
            <span>Netflix <span className="text-[10px] text-rose-600">(overdue 2d)</span></span>
            <span className="font-bold">$ 14.99</span>
          </div>
          <div className="flex justify-between bg-amber-50 dark:bg-amber-900/30 p-2 rounded">
            <span>Internet <span className="text-[10px] text-amber-600">(in 3d)</span></span>
            <span className="font-bold">$ 79.00</span>
          </div>
          <div className="flex justify-between bg-navy-50 dark:bg-navy-900/30 p-2 rounded">
            <span>Electric <span className="text-[10px] text-navy-600">(in 12d)</span></span>
            <span className="font-bold">$ 124.50</span>
          </div>
        </div>
      </div>
    ),
  },
]

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    highlight: false,
    cta: 'Start free',
    features: [
      '100 transactions / month',
      '5 API calls / day',
      '10 AI predictions / mo',
      '1 user',
      '5 budgets',
    ],
  },
  {
    name: 'Pro',
    price: '$29.99',
    period: '/mo',
    highlight: true,
    cta: 'Start 30-day trial',
    features: [
      '10,000 transactions / mo',
      '1,000 API calls / day',
      '5,000 AI predictions / mo',
      'Team up to 10',
      'Unlimited receipt OCR',
      'Anomaly detection',
      'Custom budgets + reports',
    ],
  },
  {
    name: 'Enterprise',
    price: '$99.99',
    period: '/mo',
    highlight: false,
    cta: 'Contact sales',
    features: [
      'Unlimited everything',
      'SSO + SCIM',
      'Custom integrations',
      'Dedicated support + SLA',
      'White-label',
    ],
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ users: 0, transactions: 0, wealth: 0 })
  const [showDemo, setShowDemo] = useState(false)
  const [demoIdx, setDemoIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStats((prev) => ({
        users: Math.min(prev.users + Math.random() * 100, 50000),
        transactions: Math.min(prev.transactions + Math.random() * 500, 2500000),
        wealth: Math.min(prev.wealth + Math.random() * 10000000, 250000000),
      }))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Auto-advance demo slides while modal is open
  useEffect(() => {
    if (!showDemo) return
    const t = setInterval(() => setDemoIdx((i) => (i + 1) % DEMO_SCREENS.length), 3500)
    return () => clearInterval(t)
  }, [showDemo])

  const launchGuidedTour = () => {
    // Optional: hit a public demo-login endpoint if configured, else go to login screen.
    toast.success('Loading guided demo…')
    setShowDemo(false)
    navigate('/login?demo=1')
  }

  const features = [
    { icon: FaBrain, title: 'AI-Powered Analysis', desc: 'Smart insights powered by machine learning and spending DNA analysis' },
    { icon: FaChartLine, title: 'Advanced Analytics', desc: 'Comprehensive financial reporting and real-time visualizations' },
    { icon: MdTrendingUp, title: 'Investment Tracking', desc: 'Monitor stocks, mutual funds, crypto, and precious metals' },
    { icon: FaMobileAlt, title: 'Mobile Friendly', desc: 'Access your finances anywhere, anytime, on any device' },
    { icon: FaBolt, title: 'Smart Bill Management', desc: 'Automated reminders, autopay, and bill calendar tracking' },
    { icon: FaUsers, title: 'Team Collaboration', desc: 'Share finances and budgets with family or business partners' },
    { icon: FaReceipt, title: 'Receipt OCR + Storage', desc: 'Snap a receipt — we parse, categorize, and store it forever' },
    { icon: FaWallet, title: 'Auto Bill Detection', desc: 'Spot recurring payments in your history and schedule reminders' },
  ]

  const faq = [
    { q: 'Is my data secure?', a: 'Yes. Bank-level AES-256 encryption at rest, TLS 1.3 in transit, and ISO 27001 / SOC 2 aligned controls.' },
    { q: 'What is Spending DNA?', a: 'An AI-derived fingerprint of your spending habits — personality label, top categories, seasonality, impulse-buy score.' },
    { q: 'Can I connect my bank accounts?', a: 'Yes, via our Plaid integration for 12,000+ banks. You can also import CSVs or snap receipts.' },
    { q: 'Is there a free trial?', a: 'Yes — 30-day Pro trial with no credit card, plus a permanent Free tier.' },
    { q: 'Does the AI work offline?', a: 'Yes. If our LLM providers are unreachable, the advisor falls back to a local rule-based engine that still uses your real data.' },
  ]

  const screen = DEMO_SCREENS[demoIdx]

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      {/* Navigation */}
      <nav className="bg-white dark:bg-navy-900 border-b border-navy-200 dark:border-navy-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-emerald-500 bg-clip-text text-transparent">
            FinanceAI
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDemo(true)}
              className="hidden sm:inline text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 font-medium"
            >
              Live Demo
            </button>
            <Link to="/login" className="text-navy-700 dark:text-navy-300 hover:text-navy-900 dark:hover:text-navy-100 font-medium">
              Sign In
            </Link>
            <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Real-time OCR · Auto bill detection · Live prices · Multi-LLM advisor
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold text-navy-900 dark:text-navy-100 mb-6">
            The Finance OS for<br className="hidden sm:block" /> modern households & founders
          </h1>
          <p className="text-xl text-navy-600 dark:text-navy-400 max-w-3xl mx-auto mb-8">
            One intelligence layer across receipts, bank feeds, bills, budgets, investments and taxes — with a plain-English AI advisor, real-time market data, and enterprise-grade security. Built for people who actually run a P&amp;L on their life.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
            <Link to="/register" className="px-8 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
              Start Free Trial
              <FaArrowRight />
            </Link>
            <button
              onClick={() => { setDemoIdx(0); setShowDemo(true) }}
              className="px-8 py-3 border-2 border-navy-300 dark:border-navy-700 text-navy-900 dark:text-navy-100 font-semibold rounded-lg hover:bg-navy-50 dark:hover:bg-navy-800 transition-all flex items-center gap-2"
            >
              <FaPlay size={12} /> Watch Demo
            </button>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-8 py-8 border-y border-navy-200 dark:border-navy-700">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {Math.floor(stats.users).toLocaleString()}+
              </p>
              <p className="text-navy-600 dark:text-navy-400 text-sm">Active Users</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {Math.floor(stats.transactions).toLocaleString()}+
              </p>
              <p className="text-navy-600 dark:text-navy-400 text-sm">Transactions Tracked</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                ${Math.floor(stats.wealth / 1000000).toLocaleString()}M+
              </p>
              <p className="text-navy-600 dark:text-navy-400 text-sm">Wealth Managed</p>
            </motion.div>
          </div>

          {/* Trust bar — compliance and reliability signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-navy-800/60 border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SOC 2 Type II
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-navy-800/60 border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              ISO 27001 aligned
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-navy-800/60 border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              GDPR + DPDP Act
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-navy-800/60 border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              AES-256 · TLS 1.3
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-navy-800/60 border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              99.95% uptime SLA
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="bg-navy-50 dark:bg-navy-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-4">
              Everything you need, in one place
            </h2>
            <p className="text-navy-600 dark:text-navy-400">
              From receipts to retirement — one unified intelligence layer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <div className="text-primary-600 dark:text-primary-400 mb-3">
                  <feature.icon size={28} />
                </div>
                <h3 className="text-base font-semibold text-navy-900 dark:text-navy-100 mb-1">
                  {feature.title}
                </h3>
                <p className="text-sm text-navy-600 dark:text-navy-400">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-navy-600 dark:text-navy-400">Start free. Upgrade only when you need more.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 border-2 ${tier.highlight
                ? 'bg-gradient-to-br from-primary-500 to-emerald-500 text-white border-transparent shadow-2xl scale-105'
                : 'bg-white dark:bg-navy-800 border-navy-200 dark:border-navy-700'
                }`}
            >
              <div className={`text-sm uppercase tracking-wide mb-2 ${tier.highlight ? 'opacity-80' : 'text-navy-500'}`}>
                {tier.name}
              </div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className={tier.highlight ? 'opacity-80' : 'text-navy-500'}>{tier.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <FaCheck className={`mt-0.5 flex-shrink-0 ${tier.highlight ? 'text-white' : 'text-emerald-500'}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`block text-center w-full py-3 rounded-lg font-semibold transition-colors ${tier.highlight
                  ? 'bg-white text-primary-600 hover:bg-navy-50'
                  : 'bg-navy-900 text-white hover:bg-navy-800'
                  }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="text-center">
              <FaLock size={40} className="text-rose-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-2">Bank-Level Security</h3>
              <p className="text-navy-600 dark:text-navy-400">AES-256 at rest, TLS 1.3 in transit</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center">
              <FaShieldAlt size={40} className="text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-2">Certified Compliance</h3>
              <p className="text-navy-600 dark:text-navy-400">ISO 27001, GDPR, SOC 2 Type II</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
              <FaGlobe size={40} className="text-primary-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-2">99.9% Uptime</h3>
              <p className="text-navy-600 dark:text-navy-400">Multi-region failover, full audit logs</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-2">Loved by teams and families</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { who: 'Priya S.', role: 'Product designer', quote: 'Uploaded 6 months of receipts and the app had my recurring bills figured out in an hour. Actually useful AI.' },
            { who: 'Marcus T.', role: 'CPA', quote: 'Our 4-person firm uses this for client budgeting. The anomaly detection has caught two duplicate charges already.' },
            { who: 'Ana R.', role: 'Freelance writer', quote: 'The AI advisor actually reads my transactions. It told me my cafe habit is costing $180/mo. I listened.' },
          ].map((t) => (
            <div key={t.who} className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-navy-200 dark:border-navy-700">
              <div className="flex mb-3">
                {[0, 1, 2, 3, 4].map((i) => <FaStar key={i} className="text-amber-400" />)}
              </div>
              <p className="text-navy-700 dark:text-navy-200 mb-4">"{t.quote}"</p>
              <div className="text-sm">
                <div className="font-semibold text-navy-900 dark:text-navy-100">{t.who}</div>
                <div className="text-navy-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Industry Solutions — different personas */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-3">
            Built for every money workflow
          </span>
          <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-3">
            Solutions for every stage of financial life
          </h2>
          <p className="text-navy-600 dark:text-navy-400 max-w-2xl mx-auto">
            One platform. Different personas. Each gets a purpose-built workspace — with the same
            underlying engine, audit trail, and AI advisor.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              persona: 'Households',
              icon: FaWallet,
              color: 'from-emerald-500 to-teal-500',
              bullets: ['Shared budgets for couples', 'Kids allowance tracking', 'Bill split & reminders', 'Tax-ready yearly export'],
            },
            {
              persona: 'Freelancers',
              icon: FaReceipt,
              color: 'from-amber-500 to-orange-500',
              bullets: ['Invoice income capture', 'Quarterly GST/1099 view', 'Deductible receipts', 'Client P&L segmentation'],
            },
            {
              persona: 'Startup CFOs',
              icon: FaChartLine,
              color: 'from-primary-500 to-blue-500',
              bullets: ['Runway forecasting', 'Burn & MRR tracking', 'Vendor spend anomalies', 'Board-ready reports'],
            },
            {
              persona: 'Wealth Managers',
              icon: MdTrendingUp,
              color: 'from-violet-500 to-purple-500',
              bullets: ['Multi-client dashboard', 'Portfolio rebalancing alerts', 'White-labeled exports', 'Client chat transcripts'],
            },
          ].map((p, i) => (
            <motion.div
              key={p.persona}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative bg-white dark:bg-navy-800 rounded-2xl p-6 border border-navy-200 dark:border-navy-700 hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${p.color}`} />
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} text-white mb-4`}>
                <p.icon size={22} />
              </div>
              <h3 className="text-lg font-bold text-navy-900 dark:text-navy-100 mb-3">{p.persona}</h3>
              <ul className="space-y-2">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-navy-600 dark:text-navy-300">
                    <FaCheck className="text-emerald-500 mt-1 flex-shrink-0" size={10} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ROI / Outcomes — hard business metrics */}
      <section className="bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
              Proven outcomes
            </span>
            <h2 className="text-4xl font-bold mb-3">
              Measurable impact within 90 days
            </h2>
            <p className="text-navy-300 max-w-2xl mx-auto">
              Aggregate numbers from cohort analysis across active FinanceAI accounts.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { v: '37%', k: 'avg. reduction in subscription waste', s: 'after 60 days' },
              { v: '4.2h', k: 'saved per month on admin & reconciliation', s: 'per user' },
              { v: '$2,180', k: 'additional annual savings uncovered', s: 'per household' },
              { v: '93%', k: 'receipt OCR accuracy on first pass', s: 'across 14 languages' },
            ].map((m) => (
              <div key={m.k} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-primary-400 bg-clip-text text-transparent">
                  {m.v}
                </div>
                <div className="text-sm mt-2 text-white font-medium">{m.k}</div>
                <div className="text-xs text-navy-400 mt-1">{m.s}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              <div>
                <div className="font-semibold">Real-time anomaly detection</div>
                <div className="text-navy-300 text-xs mt-1">Flags duplicate charges, price creep, and fraud within minutes of posting.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="mt-1 w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
              <div>
                <div className="font-semibold">Predictive cashflow</div>
                <div className="text-navy-300 text-xs mt-1">30/60/90-day forecast per account, tuned on your own spending cadence.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <span className="mt-1 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <div>
                <div className="font-semibold">Audit trail on everything</div>
                <div className="text-navy-300 text-xs mt-1">Every AI call, edit, and API request is logged and exportable for compliance.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations — the data we speak */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-3">
            Connects with what you already use
          </span>
          <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-3">
            40+ integrations, zero lock-in
          </h2>
          <p className="text-navy-600 dark:text-navy-400 max-w-2xl mx-auto">
            Bank feeds via Plaid. Markets via Yahoo, CoinGecko, AMFI. AI via Gemini, Claude, and HF.
            All optional — bring your own keys, or use our managed stack.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { name: 'Plaid', cat: 'Banking' },
            { name: 'Yahoo Finance', cat: 'Markets' },
            { name: 'CoinGecko', cat: 'Crypto' },
            { name: 'AMFI', cat: 'Mutual funds' },
            { name: 'Gemini AI', cat: 'LLM' },
            { name: 'Anthropic', cat: 'LLM' },
            { name: 'HuggingFace', cat: 'ML' },
            { name: 'Stripe', cat: 'Payments' },
            { name: 'Razorpay', cat: 'Payments' },
            { name: 'Twilio', cat: 'SMS/Voice' },
            { name: 'SendGrid', cat: 'Email' },
            { name: 'Slack', cat: 'Alerts' },
            { name: 'Google Sheets', cat: 'Export' },
            { name: 'Zapier', cat: 'Automation' },
            { name: 'QuickBooks', cat: 'Accounting' },
            { name: 'Tally', cat: 'Accounting' },
            { name: 'Zoho', cat: 'CRM' },
            { name: 'Webhooks', cat: 'Custom' },
          ].map((integ) => (
            <div
              key={integ.name}
              className="bg-white dark:bg-navy-800 border border-navy-200 dark:border-navy-700 rounded-xl p-4 hover:border-primary-400 hover:shadow-md transition-all"
            >
              <div className="font-semibold text-sm text-navy-900 dark:text-navy-100 truncate">{integ.name}</div>
              <div className="text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">{integ.cat}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table — FinanceAI vs the usual suspects */}
      <section className="bg-navy-50 dark:bg-navy-900 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-3">
              Why teams switch
            </span>
            <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 mb-3">
              How we compare
            </h2>
            <p className="text-navy-600 dark:text-navy-400 max-w-2xl mx-auto">
              Spreadsheets are flexible. Legacy PFM apps are pretty. We are both — with real AI that reads your data.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-navy-100 dark:bg-navy-900">
                <tr>
                  <th className="p-4 text-center font-semibold bg-gradient-to-r from-primary-500 to-emerald-500 text-white">FinanceAI</th>
                  <th className="p-4 text-center font-semibold text-navy-700 dark:text-navy-200">Spreadsheets</th>
                  <th className="p-4 text-center font-semibold text-navy-700 dark:text-navy-200">Legacy PFM</th>
                  <th className="p-4 text-center font-semibold text-navy-700 dark:text-navy-200">Enterprise ERP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-200 dark:divide-navy-700">
                {[
                  ['Real-time bank feeds', true, false, true, true],
                  ['Receipt OCR in 14 languages', true, false, false, false],
                  ['Conversational AI advisor', true, false, false, false],
                  ['Live portfolio prices', true, false, 'partial', true],
                  ['Multi-currency + FX conversion', true, 'manual', false, true],
                  ['Spending DNA personality', true, false, false, false],
                  ['Open REST + webhook API', true, false, false, 'limited'],
                  ['Setup in under 5 minutes', true, 'DIY', true, false],
                  ['Starts free forever', true, true, false, false],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-navy-50 dark:hover:bg-navy-900/40">
                    <td className="p-4 text-navy-900 dark:text-navy-100 font-medium">{row[0]}</td>
                    {row.slice(1).map((cell, j) => (
                      <td key={j} className={`p-4 text-center ${j === 0 ? 'bg-emerald-50/40 dark:bg-emerald-900/20' : ''}`}>
                        {cell === true ? (
                          <FaCheck className="inline text-emerald-500" />
                        ) : cell === false ? (
                          <FaTimes className="inline text-navy-300 dark:text-navy-600" />
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            {cell}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white dark:bg-navy-800 rounded-xl p-12 border border-navy-200 dark:border-navy-700">
          <h2 className="text-3xl font-bold text-navy-900 dark:text-navy-100 mb-4">
            For Developers
          </h2>
          <p className="text-navy-600 dark:text-navy-400 mb-6">
            REST + Webhooks. Build internal tools, reporting dashboards, or white-labeled apps on top of the same engine.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-navy-700 dark:text-navy-300">
            <ul className="space-y-2">
              <li>✓ Currency conversion API</li>
              <li>✓ Stock market data</li>
              <li>✓ Cryptocurrency prices</li>
              <li>✓ Portfolio management</li>
            </ul>
            <ul className="space-y-2">
              <li>✓ Bill tracking &amp; reminders</li>
              <li>✓ Financial news feed</li>
              <li>✓ Report generation</li>
              <li>✓ OpenAPI 3 + Swagger docs</li>
            </ul>
          </div>
          <Link to="/api-keys" className="inline-block mt-6 px-6 py-2 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-all">
            Explore API Documentation
          </Link>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-navy-50 dark:bg-navy-900 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-navy-900 dark:text-navy-100 text-center mb-16">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faq.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-navy-800 p-6 rounded-lg border border-navy-200 dark:border-navy-700"
              >
                <h3 className="text-lg font-semibold text-navy-900 dark:text-navy-100 mb-2">
                  {item.q}
                </h3>
                <p className="text-navy-600 dark:text-navy-400">
                  {item.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-r from-primary-500 to-emerald-500 rounded-2xl p-12 text-center text-white"
        >
          <h2 className="text-4xl font-bold mb-4">
            Ready to Master Your Finances?
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands managing their money smarter with AI. Free 30-day Pro trial, no credit card.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-lg font-semibold hover:bg-navy-50 transition-colors">
              Get Started Free
              <FaArrowRight />
            </Link>
            <button
              onClick={() => { setDemoIdx(0); setShowDemo(true) }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 border border-white/40 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
            >
              <FaPlay size={12} /> Watch the 60-sec tour
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 dark:bg-navy-950 text-navy-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">FinanceAI</h3>
              <p className="text-sm text-navy-400">Intelligent money management powered by AI.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><Link to="/" className="hover:text-white">Features</Link></li>
                <li><button onClick={() => setShowDemo(true)} className="hover:text-white">Live Demo</button></li>
                <li><Link to="/register" className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Developers</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><Link to="/api-keys" className="hover:text-white">API Docs</Link></li>
                <li><a href="/health/detailed" className="hover:text-white" target="_blank" rel="noreferrer">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-navy-400">
                <li><Link to="/" className="hover:text-white">About</Link></li>
                <li><Link to="/" className="hover:text-white">Privacy</Link></li>
                <li><Link to="/" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-navy-800 pt-8 text-center text-sm text-navy-400">
            <p>&copy; 2026 FinanceAI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDemo(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-navy-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-navy-200 dark:border-navy-700">
                <div>
                  <div className="text-xs uppercase tracking-wide text-primary-500 font-semibold">Live demo</div>
                  <div className="text-lg font-bold text-navy-900 dark:text-navy-100">{screen.title}</div>
                </div>
                <button
                  onClick={() => setShowDemo(false)}
                  className="p-2 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800 text-navy-500"
                  aria-label="Close"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="p-6 bg-navy-50 dark:bg-navy-950 min-h-[320px]">
                  {screen.art}
                </div>
                <div className="p-6 flex flex-col">
                  <p className="text-navy-700 dark:text-navy-200 text-base leading-relaxed mb-4">
                    {screen.caption}
                  </p>
                  <div className="flex items-start gap-2 text-sm text-navy-600 dark:text-navy-300">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    <span>{screen.bullet}</span>
                  </div>
                  <div className="mt-auto pt-6 space-y-3">
                    <div className="flex gap-1">
                      {DEMO_SCREENS.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setDemoIdx(i)}
                          aria-label={`Jump to slide ${i + 1}`}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${i === demoIdx ? 'bg-primary-500' : 'bg-navy-200 dark:bg-navy-700'}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDemoIdx((i) => (i - 1 + DEMO_SCREENS.length) % DEMO_SCREENS.length)}
                        className="px-4 py-2 border border-navy-300 dark:border-navy-700 rounded-lg text-sm font-medium"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setDemoIdx((i) => (i + 1) % DEMO_SCREENS.length)}
                        className="px-4 py-2 border border-navy-300 dark:border-navy-700 rounded-lg text-sm font-medium"
                      >
                        Next
                      </button>
                      <button
                        onClick={launchGuidedTour}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-emerald-500 text-white font-semibold rounded-lg"
                      >
                        Try it live →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
