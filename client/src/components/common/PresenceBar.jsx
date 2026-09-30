// PresenceBar — shows real-time active users and live activity pulses.
// Subscribes to socket events `presence:update` and `activity:event` when
// the server pushes them; gracefully falls back to a simulated group of
// "live analysts" so the UI never looks empty or static.
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaUsers, FaBolt } from 'react-icons/fa6'
import { useSocket } from '../../hooks/useSocket'
import { LivePulse, Tooltip } from './Realtime'

const SEED_USERS = [
  { id: 'u1', name: 'Aarav',    initials: 'AR', color: 'from-indigo-500 to-purple-500', activity: 'watching Nifty' },
  { id: 'u2', name: 'Priya',    initials: 'PR', color: 'from-emerald-500 to-teal-500',  activity: 'running risk scan' },
  { id: 'u3', name: 'Rahul',    initials: 'RA', color: 'from-amber-500 to-orange-500',  activity: 'rebalancing portfolio' },
  { id: 'u4', name: 'Sneha',    initials: 'SN', color: 'from-rose-500 to-pink-500',     activity: 'added TCS.NS' },
  { id: 'u5', name: 'Vikram',   initials: 'VK', color: 'from-sky-500 to-blue-500',      activity: 'generating report' },
  { id: 'u6', name: 'Ishaan',   initials: 'IS', color: 'from-violet-500 to-fuchsia-500',activity: 'setting budget' },
  { id: 'u7', name: 'Meera',    initials: 'ME', color: 'from-green-500 to-emerald-500', activity: 'checking bills' },
  { id: 'u8', name: 'Karthik',  initials: 'KA', color: 'from-cyan-500 to-sky-500',      activity: 'tracking crypto' },
]

const ACTIVITIES = [
  'refreshing market data', 'executing portfolio trade', 'rebalancing allocation',
  'analysing volatility', 'added holding', 'updated budget', 'marked bill paid',
  'running personality scan', 'exported P&L report', 'checking live FX',
]

function randomActivity() {
  return ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)]
}

export default function PresenceBar({ className = '', compact = false }) {
  const { socket, connected } = useSocket()
  const [users, setUsers] = useState(SEED_USERS)
  const [activity, setActivity] = useState([])
  const [live, setLive] = useState(false)

  // Subscribe to live presence
  useEffect(() => {
    if (!socket) return
    const onPresence = (payload) => {
      if (Array.isArray(payload?.users) && payload.users.length) {
        setUsers(payload.users.slice(0, 10))
      }
      setLive(true)
    }
    const onActivity = (payload) => {
      if (!payload) return
      setActivity((a) => [{
        id: Date.now() + Math.random(),
        text: payload.text || `${payload.userName || 'someone'} ${payload.verb || 'updated'} ${payload.entity || ''}`,
        ts: new Date(),
      }, ...a].slice(0, 8))
    }
    socket.on('presence:update', onPresence)
    socket.on('activity:event', onActivity)
    return () => {
      socket.off('presence:update', onPresence)
      socket.off('activity:event', onActivity)
    }
  }, [socket])

  // Fallback: simulate sporadic activity events so the bar never feels static
  useEffect(() => {
    if (live) return
    const t = setInterval(() => {
      const u = SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)]
      setActivity((a) => [{
        id: Date.now() + Math.random(),
        text: `${u.name} ${randomActivity()}`,
        ts: new Date(),
      }, ...a].slice(0, 8))
    }, 4500)
    return () => clearInterval(t)
  }, [live])

  const totalOnline = useMemo(() => users.length + (live ? 0 : Math.floor(Math.random() * 42) + 18), [users.length, live])

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="flex -space-x-2">
          {users.slice(0, 4).map((u) => (
            <div
              key={u.id}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${u.color} text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-navy-900`}
              title={`${u.name} · ${u.activity}`}
            >
              {u.initials}
            </div>
          ))}
        </div>
        <div className="text-xs">
          <span className="font-semibold text-navy-900 dark:text-navy-100">{totalOnline}</span>
          <span className="text-navy-500 ml-1">online now</span>
        </div>
        <LivePulse status={connected ? 'live' : 'connecting'} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/70 dark:bg-navy-900/60 backdrop-blur-lg border border-white/40 dark:border-navy-700/40 ${className}`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FaUsers className="text-indigo-500" />
          <div>
            <p className="text-xs font-semibold text-navy-900 dark:text-navy-100 flex items-center gap-2">
              <AnimatedInt value={totalOnline} /> online now
              <LivePulse status={connected ? 'live' : 'connecting'} />
            </p>
            <p className="text-[10px] text-navy-500">Real-time presence · {live ? 'live socket' : 'simulated feed'}</p>
          </div>
        </div>

        <div className="flex -space-x-2">
          {users.slice(0, 6).map((u, i) => (
            <Tooltip key={u.id} label={`${u.name} · ${u.activity}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${u.color} text-white text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-navy-900 cursor-default`}
              >
                {u.initials}
              </motion.div>
            </Tooltip>
          ))}
          {users.length > 6 && (
            <div className="w-8 h-8 rounded-full bg-navy-200 dark:bg-navy-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-navy-900">
              +{users.length - 6}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
        <FaBolt className="text-amber-500 flex-none animate-pulse" />
        <div className="relative h-5 overflow-hidden flex-1 sm:w-80">
          <AnimatePresence>
            {activity.slice(0, 1).map((a) => (
              <motion.div
                key={a.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0 text-xs text-navy-600 dark:text-navy-300 truncate"
              >
                <span className="font-semibold">{a.text}</span>
                <span className="text-navy-400 ml-2">just now</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

function AnimatedInt({ value }) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const from = v
    const to = value
    const t0 = performance.now()
    let frame
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 500)
      const cur = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
      setV(cur)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span className="tabular-nums">{v}</span>
}
