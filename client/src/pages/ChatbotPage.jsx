import { useState, useEffect, useRef } from 'react'
import Layout from '../components/common/Layout'
import { chatWithAdvisor, getProviders } from '../services/llmAdvisorService'
import toast from 'react-hot-toast'

const QUICK_PROMPTS = [
  'How much should I save this month?',
  'Predict my bills for next month',
  'Find subscriptions I can cancel',
  'What kind of spender am I?',
  'Give me a 90-day savings plan',
]

// Friendly offline reply when the user isn't signed in or the server is unreachable.
function offlineReply(text) {
  const q = (text || '').toLowerCase()
  const lines = ['FinSight (offline preview):']
  if (q.includes('save') || q.includes('budget')) {
    lines.push('• Aim for 20% savings on take-home pay. Automate the transfer on payday.')
    lines.push('• Cap dining at 10% of income and entertainment at 5%.')
  } else if (q.includes('invest')) {
    lines.push('• Keep 3-6 months of expenses as an emergency fund before increasing risk.')
    lines.push('• Diversify across low-cost index funds; match employer 401(k) first.')
  } else if (q.includes('bill') || q.includes('subscription')) {
    lines.push('• Audit recurring charges used less than twice a month and cancel overlap.')
    lines.push('• Set reminders 3 days before each due date to avoid late fees.')
  } else {
    lines.push('• Sign in to get personalized advice using your transactions and receipts.')
    lines.push('• Ask about budgets, saving, subscriptions, bill predictions, or investments.')
  }
  return lines.join('\n')
}

// Normalize provider list coming from /api/llm/providers which returns
// [{ name: 'gemini', models: [...] }, ...]
function normalizeProviders(raw) {
  if (!Array.isArray(raw)) return ['local']
  return raw.map((p) => (typeof p === 'string' ? p : p?.name)).filter(Boolean)
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am FinSight, your AI financial advisor. Ask me about your spending, budgets, bills, or investments.' },
  ])
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState('auto')
  const [providers, setProviders] = useState(['local'])
  const [loading, setLoading] = useState(false)
  const scroller = useRef(null)

  useEffect(() => {
    getProviders()
      .then((r) => setProviders(normalizeProviders(r?.data)))
      .catch(() => setProviders(['local']))
  }, [])

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const newMsgs = [...messages, { role: 'user', content }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const res = await chatWithAdvisor({
        messages: newMsgs.map(({ role, content }) => ({ role, content })),
        provider: provider === 'auto' ? undefined : provider,
      })
      const d = res?.data || {}
      setMessages((m) => [...m, {
        role: 'assistant',
        content: d.reply || '(no response — try again in a moment)',
        meta: { provider: d.provider || 'local', model: d.model || 'fallback' },
      }])
    } catch (e) {
      // Graceful degradation: 401 (not signed in), network error, etc. still return something useful.
      const status = e?.response?.status
      const offline = offlineReply(content)
      setMessages((m) => [...m, {
        role: 'assistant',
        content: (status === 401
          ? 'You are not signed in, so I cannot use your live finance context. Here is a general answer:\n\n'
          : '') + offline,
        meta: { provider: 'local', model: 'offline-fallback' },
      }])
      if (status !== 401) toast.error('Live advisor unavailable — showing offline guidance')
    } finally { setLoading(false) }
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">AI Financial Advisor</h1>
            <p className="text-xs text-gray-500">Multi-LLM router · tries {providers.join(' -> ')} with automatic fallback</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="border rounded px-2 py-1 text-sm">
              <option value="auto">Auto (best available)</option>
              {providers.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={loading} className="text-xs px-3 py-1 bg-gray-100 dark:bg-navy-700 rounded-full hover:bg-gray-200">{p}</button>
          ))}
        </div>

        <div ref={scroller} className="flex-1 overflow-auto border rounded-xl p-4 bg-white dark:bg-navy-800 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl whitespace-pre-wrap text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-navy-700 text-gray-900 dark:text-gray-100'}`}>
                {m.content}
                {m.meta && <div className="text-[10px] opacity-60 mt-1">via {m.meta.provider} · {m.meta.model}</div>}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-gray-500">FinSight is thinking…</div>}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask anything about your money…"
            className="flex-1 border rounded-lg px-4 py-2"
          />
          <button onClick={() => send()} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">Send</button>
        </div>
      </div>
    </Layout>
  )
}
