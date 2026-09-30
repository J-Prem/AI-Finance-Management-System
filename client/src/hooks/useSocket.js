import { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'

// Default to the current origin so the Vite dev proxy (ws: true) handles
// /socket.io, and production works out-of-the-box on the same host as the API.
const defaultUrl = () =>
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000')

export const useSocket = (url) => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const target = url || defaultUrl()
    const sock = io(target, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    })
    socketRef.current = sock
    sock.on('connect', () => setConnected(true))
    sock.on('disconnect', () => setConnected(false))
    sock.on('connect_error', () => setConnected(false))

    return () => {
      try { sock.close() } catch (_) { /* ignore */ }
      socketRef.current = null
    }
  }, [url])

  return { socket: socketRef.current, connected }
}

export const useSocketListener = (socket, event, callback) => {
  useEffect(() => {
    if (!socket) return

    socket.on(event, callback)

    return () => {
      socket.off(event, callback)
    }
  }, [socket, event, callback])
}
