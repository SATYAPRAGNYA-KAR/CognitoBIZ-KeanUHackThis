'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; text: string }

const DEMO_QA: Record<string, string> = {
  default: "Your cash position is $182,400 with 11.2 months of runway at current burn. Revenue is up 8% month-over-month. What would you like to dig into?",
  infrastructure: "Your infrastructure spend is $3,400 this month — up from a $980 average. The spike ties directly to your product launch on April 3rd, when EC2 instance count tripled. Traffic has since normalized, so rightsizing your instances could bring costs back to around $1,100 next month.",
  runway: "At your current $4,840 monthly burn and $54,200 cash position, you have 11.2 months of runway. If you hire two engineers at $120k/year each, that drops to 6.8 months. I'd recommend raising before September to stay comfortable.",
  burn: "Your monthly burn is $4,840 — about 12% above average this month, mostly from Stripe processing fees tied to your best revenue day. The underlying operational burn is on target at $4,320.",
}

function matchQuery(q: string): string {
  const lower = q.toLowerCase()
  if (lower.includes('infrastructure') || lower.includes('aws') || lower.includes('cloud')) return DEMO_QA.infrastructure
  if (lower.includes('runway') || lower.includes('how long')) return DEMO_QA.runway
  if (lower.includes('burn')) return DEMO_QA.burn
  return DEMO_QA.default
}

export function VoiceAssistant({ onClose }: { onClose?: () => void }) {
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [transcript, setTranscript] = useState('')
  const recogRef = useRef<SpeechRecognition | null>(null)

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      // fallback: simulate
      simulateRecognition()
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recog = new SpeechRecognition()
    recog.continuous = false
    recog.interimResults = true
    recog.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setTranscript(t)
    }
    recog.onend = () => { setListening(false); if (transcript) sendQuery(transcript) }
    recog.start()
    recogRef.current = recog
    setListening(true)
    setTranscript('')
  }

  const stopListening = () => {
    recogRef.current?.stop()
    setListening(false)
  }

  const simulateRecognition = () => {
    setListening(true)
    setTranscript('')
    const queries = ["What's driving our infrastructure costs?", "What's our runway?", "What's our burn rate?"]
    const q = queries[Math.floor(Math.random() * queries.length)]
    let i = 0
    const int = setInterval(() => {
      setTranscript(q.slice(0, ++i))
      if (i >= q.length) { clearInterval(int); setListening(false); sendQuery(q) }
    }, 40)
  }

  const sendQuery = async (q: string) => {
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setTranscript('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    const reply = matchQuery(q)
    setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    setLoading(false)
  }

  // Waveform bars
  const bars = Array.from({ length: 20 })

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[100px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-6">
            <Volume2 size={24} className="mx-auto mb-2 text-gray-700" />
            Ask CognitoBIZ anything about your finances
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center shrink-0 mt-0.5">
                <Volume2 size={10} className="text-gold-400" />
              </div>
            )}
            <div className={cn('px-3 py-2 rounded-xl text-xs max-w-[80%]',
              m.role === 'user' ? 'bg-gold-400/10 border border-gold-400/15 text-gold-400' : 'bg-obsidian-800 border border-white/8 text-gray-300')}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
              <Loader2 size={10} className="text-gold-400 animate-spin" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-obsidian-800 border border-white/8 text-xs text-gray-500">Thinking…</div>
          </div>
        )}
        {transcript && (
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-xl bg-gold-400/8 border border-gold-400/10 text-xs text-gold-400/70 italic">{transcript}</div>
          </div>
        )}
      </div>

      {/* Waveform + mic */}
      <div className="flex items-center gap-3">
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center border transition-all shrink-0',
            listening
              ? 'bg-ember-400/15 border-ember-400/30 text-ember-400'
              : 'bg-gold-400/10 border-gold-400/20 text-gold-400 hover:bg-gold-400/15'
          )}
        >
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {bars.map((_, i) => (
            <motion.div key={i}
              animate={listening ? { height: [`${20 + Math.sin(i) * 15}%`, `${40 + Math.sin(i * 1.3 + 1) * 30}%`, `${20 + Math.sin(i) * 15}%`] } : { height: `${15 + Math.sin(i * 0.8) * 10 + 10}%` }}
              transition={{ duration: 0.5, repeat: listening ? Infinity : 0, delay: i * 0.04 }}
              className={cn('flex-1 rounded-full', listening ? 'bg-ember-400' : 'bg-obsidian-600')}
            />
          ))}
        </div>

        <div className="text-[10px] text-gray-600 shrink-0">
          {listening ? 'Release to send' : 'Hold to speak'}
        </div>
      </div>
    </div>
  )
}