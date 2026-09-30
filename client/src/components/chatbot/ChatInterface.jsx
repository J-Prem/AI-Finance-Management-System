import { useState, useRef, useEffect } from 'react'
import { FaPaperPlane, FaRobot } from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'
import * as mlService from '../../services/mlService'
import toast from 'react-hot-toast'

const QUICK_SUGGESTIONS = [
  "How did I spend this month?",
  "Show my spending personality",
  "Am I saving enough?",
  "What's my financial health?",
  "Analyze my spending patterns",
  "What if I reduce food spending by 20%?",
]

export default function ChatInterface() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your AI financial assistant. Ask me anything about your finances!",
      sender: 'bot',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (text = input) => {
    if (!text.trim()) return

    const userMessage = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await mlService.chatbotQuery(
        text,
        messages.map((m) => ({ role: m.sender, content: m.text }))
      )

      const botMessage = {
        id: Date.now() + 1,
        text: response.message,
        sender: 'bot',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      toast.error('Failed to get response')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card h-[600px] flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-navy-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  {message.sender === 'bot' && <FaRobot className="mt-1 flex-shrink-0" size={14} />}
                  <div>
                    <p className="text-sm">{message.text}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="bg-navy-100 dark:bg-navy-800 px-4 py-3 rounded-lg flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary-500"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length === 1 && !loading && (
        <div className="px-6 py-4 border-t border-navy-200 dark:border-navy-700">
          <p className="text-xs text-navy-600 dark:text-navy-400 mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-navy-200 dark:border-navy-700 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about your finances..."
            className="input-base flex-1"
            disabled={loading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
