// Reusable real-time UI primitives used across Market, Budgets, Investments,
// and API Keys pages. Every component is dependency-light (uses framer-motion
// which is already a project dep) and guards against NaN / undefined.
import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { safeNum, clamp } from '../../utils/safe'

// ---------- LivePulse: pulsing status dot with "LIVE / DELAYED / OFFLINE"
export function LivePulse({ status = 'live', label, className = '' }) {
  const s = status.toLowerCase()
  const color =
    s === 'live' ? 'bg-emerald-500' :
    s === 'delayed' ? 'bg-amber-500' :
    s === 'connecting' ? 'bg-blue-500' :
    'bg-rose-500'
  const text =
    s === 'live' ? 'LIVE' :
    s === 'delayed' ? 'DELAYED' :
    s === 'connecting' ? 'CONNECTING' :
    'OFFLINE'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
      </span>
      <span className={
        s === 'live' ? 'text-emerald-600 dark:text-emerald-400' :
        s === 'delayed' ? 'text-amber-600 dark:text-amber-400' :
        s === 'connecting' ? 'text-blue-600 dark:text-blue-400' :
        'text-rose-600 dark:text-rose-400'
      }>{label || text}</span>
    </span>
  )
}

// ---------- PriceFlash: brief green/red wash when value changes
export function PriceFlash({ value, className = '', children }) {
  const [flash, setFlash] = useState(null) // 'up' | 'down' | null
  const prev = useRef(value)
  useEffect(() => {
    const p = safeNum(prev.current)
    const c = safeNum(value)
    if (p && c && p !== c) {
      setFlash(c > p ? 'up' : 'down')
      const t = setTimeout(() => setFlash(null), 900)
      prev.current = value
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value])
  return (
    <span
      className={`inline-block transition-colors duration-700 rounded px-1 ${
        flash === 'up' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
        flash === 'down' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' :
        ''
      } ${className}`}
    >
      {children}
    </span>
  )
}

// ---------- AnimatedCounter: smooth count-up animation
export function AnimatedCounter({ value, duration = 600, decimals = 0, prefix = '', suffix = '', className = '' }) {
  const [display, setDisplay] = useState(safeNum(value))
  const startRef = useRef(safeNum(value))
  useEffect(() => {
    const from = startRef.current
    const to = safeNum(value)
    if (from === to) return
    const t0 = performance.now()
    let frame
    const tick = (now) => {
      const p = clamp((now - t0) / duration, 0, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      const cur = from + (to - from) * ease
      setDisplay(cur)
      if (p < 1) frame = requestAnimationFrame(tick)
      else startRef.current = to
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  const text = display.toLocaleString(undefined, {
    maximumFractionDigits: decimals, minimumFractionDigits: decimals,
  })
  return <span className={`tabular-nums ${className}`}>{prefix}{text}{suffix}</span>
}

// ---------- Sparkline: inline SVG mini-line chart with gradient
export function Sparkline({ points = [], width = 80, height = 24, color, className = '', fill = true }) {
  const pts = Array.isArray(points) ? points.map(safeNum) : []
  if (pts.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    )
  }
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const stepX = width / (pts.length - 1)
  const y = (v) => height - ((v - min) / range) * (height - 4) - 2
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = `${path} L${width.toFixed(2)},${height} L0,${height} Z`
  const up = pts[pts.length - 1] >= pts[0]
  const stroke = color || (up ? '#10b981' : '#ef4444')
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={path} stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ---------- Skeleton: shimmering placeholder
export function Skeleton({ w = '100%', h = 16, rounded = 'rounded', className = '' }) {
  return (
    <div
      className={`relative overflow-hidden bg-navy-100 dark:bg-navy-800 ${rounded} ${className}`}
      style={{ width: w, height: h }}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
    </div>
  )
}

// ---------- GlassCard: glassmorphism panel
export function GlassCard({ children, className = '', gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`relative overflow-hidden backdrop-blur-xl bg-white/70 dark:bg-navy-900/60 border border-white/40 dark:border-navy-700/40 rounded-xl shadow-lg ${className}`}
    >
      {gradient && (
        <div className={`pointer-events-none absolute inset-0 opacity-20 bg-gradient-to-br ${gradient}`} />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  )
}

// ---------- CountdownChip: ticks down the seconds until the next refresh
export function CountdownChip({ seconds = 30, trigger = 0, className = '' }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => { setLeft(seconds) }, [trigger, seconds])
  useEffect(() => {
    if (left <= 0) return
    const t = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [left])
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold text-navy-500 ${className}`}>
      <span className="relative h-3 w-3">
        <svg viewBox="0 0 12 12" className="h-3 w-3 -rotate-90">
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeDasharray={`${(left / seconds) * 31.4} 31.4`} strokeLinecap="round" />
        </svg>
      </span>
      {left}s
    </span>
  )
}

// ---------- AnimatedDonut: weighted segmented donut
export function AnimatedDonut({ segments = [], size = 180, stroke = 22, center, palette }) {
  const colors = palette || ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#84cc16', '#ec4899']
  const total = segments.reduce((s, x) => s + safeNum(x.value), 0) || 1
  let acc = 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const frac = safeNum(s.value) / total
          const len = frac * c
          const dash = `${len} ${c}`
          const offset = c - acc
          acc += len
          return (
            <motion.circle
              key={s.label || i}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color || colors[i % colors.length]} strokeWidth={stroke}
              strokeLinecap="butt"
              initial={{ strokeDasharray: `0 ${c}` }}
              animate={{ strokeDasharray: dash, strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.05 }}
            />
          )
        })}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {center}
        </div>
      )}
    </div>
  )
}

// ---------- MetricDelta: arrow with delta percentage, animated
export function MetricDelta({ pct, className = '', size = 'md' }) {
  const n = safeNum(pct)
  const up = n >= 0
  const sizeCls = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  return (
    <motion.span
      key={n.toFixed(2)}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeCls} ${
        up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
           : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
      } ${className}`}
    >
      {up ? '▲' : '▼'} {Math.abs(n).toFixed(2)}%
    </motion.span>
  )
}

// ---------- WaveBar: vertical animated bar
export function WaveBar({ value = 0, max = 100, color = 'from-primary-500 to-indigo-500', h = 80 }) {
  const pct = clamp((safeNum(value) / safeNum(max, 1)) * 100, 0, 100)
  return (
    <div className="relative inline-block w-3 rounded-full overflow-hidden bg-navy-100 dark:bg-navy-800" style={{ height: h }}>
      <motion.div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${color}`}
        initial={{ height: '0%' }}
        animate={{ height: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ---------- LiveFeedRow: list item that enters with a slide animation
export function LiveFeedRow({ children, tone = 'neutral', idx = 0 }) {
  const bg =
    tone === 'up' ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10' :
    tone === 'down' ? 'border-l-rose-500 bg-rose-50/40 dark:bg-rose-900/10' :
    'border-l-primary-500'
  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, delay: idx * 0.03 }}
        className={`border-l-2 pl-3 py-2 ${bg}`}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ---------- useTickingSeries: emits a small mock series that walks randomly.
// Useful when a real socket or endpoint isn't available yet.
export function useTickingSeries(symbol, { length = 30, base = 100, volatility = 0.005, intervalMs = 3000 } = {}) {
  const [series, setSeries] = useState(() => {
    const out = []
    let v = base
    for (let i = 0; i < length; i++) {
      v = v * (1 + (Math.random() - 0.5) * volatility * 2)
      out.push(Number(v.toFixed(2)))
    }
    return out
  })
  useEffect(() => {
    const t = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1] || base
        const next = Number((last * (1 + (Math.random() - 0.5) * volatility * 2)).toFixed(2))
        return [...prev.slice(1), next]
      })
    }, intervalMs)
    return () => clearInterval(t)
  }, [symbol, intervalMs, volatility, base])
  return series
}

// ---------- Tooltip: tiny hover tooltip
export function Tooltip({ label, children }) {
  return (
    <span className="relative group inline-block">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-navy-900 dark:bg-navy-100 text-white dark:text-navy-900 text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </span>
  )
}

export default {
  LivePulse, PriceFlash, AnimatedCounter, Sparkline, Skeleton, GlassCard,
  CountdownChip, AnimatedDonut, MetricDelta, WaveBar, LiveFeedRow, useTickingSeries, Tooltip,
}
