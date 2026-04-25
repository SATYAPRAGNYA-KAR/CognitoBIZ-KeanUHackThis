'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, RefreshCw, Mic, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const SAMPLE_BRIEFING = "Good morning. The headline today is strong — yesterday was your best revenue day this month at eighteen thousand four hundred dollars. Your burn came in at four thousand eight hundred and forty, about twelve percent above average, but that's expected given the Stripe processing fees on that revenue. Two items need your attention. First, your Figma subscription renews in three days — I've flagged that three team members haven't logged in. Consider downgrading before Thursday. Second, WorkContract zero zero four seven has a milestone submission ready for your review — Gemma's assessment is positive. Your runway sits at eleven point two months. A solid position. One action item for today: review that Figma renewal before it auto-charges."

export function BriefingPlayer() {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [voiceQuery, setVoiceQuery] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [aiReply, setAiReply] = useState('')
  const intervalRef = useRef<any>(null)
  const totalDuration = 60 // seconds simulated

  const handlePlay = async () => {
    if (playing) {
      setPlaying(false)
      clearInterval(intervalRef.current)
      return
    }
    setLoading(true)
    await new Promise(r => setTimeout(r, 800)) // simulate API call
    setLoading(false)
    setPlaying(true)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(intervalRef.current); setPlaying(false); return 100 }
        return p + (100 / totalDuration / 10)
      })
    }, 100)
  }

  const handleRegenerate = () => {
    setProgress(0)
    setPlaying(false)
    clearInterval(intervalRef.current)
  }

  const handleVoiceQ = () => {
    setVoiceQuery(true)
    setListening(true)
    setTranscript('')
    setAiReply('')
    // Simulate browser speech recognition
    setTimeout(() => {
      setTranscript("What's driving our infrastructure costs?")
      setListening(false)
      setTimeout(() => {
        setAiReply("Your infrastructure spend is $3,400 this month — up from a $980 average. The spike ties directly to your product launch on April 3rd, when EC2 instance count tripled. Traffic has since normalized, so rightsizing your instances could bring costs back to around $1,100 next month. Want me to prepare a specific list of instances to review?")
      }, 1200)
    }, 2000)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  // Waveform bars
  const bars = Array.from({ length: 28 })

  return (
    <div className="space-y-3">
      {/* Player */}
      <div className="flex items-center gap-3">
        {/* Play button */}
        <button
          onClick={handlePlay}
          disabled={loading}
          className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-400/25 flex items-center justify-center text-gold-400 hover:bg-gold-500/25 transition-all shrink-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : playing ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {bars.map((_, i) => {
            const playedFraction = progress / 100
            const barFraction = i / bars.length
            const isPlayed = barFraction < playedFraction
            const height = playing
              ? `${20 + Math.sin(Date.now() / 200 + i) * 12}%`
              : `${15 + Math.sin(i * 1.3) * 25 + 30}%`
            return (
              <motion.div
                key={i}
                animate={{ height: playing ? ['30%', `${40 + Math.sin(i) * 30}%`, '30%'] : height }}
                transition={{ duration: 0.6, repeat: playing ? Infinity : 0, delay: i * 0.03 }}
                className={cn(
                  'w-1 rounded-full transition-colors',
                  isPlayed ? 'bg-gold-400' : 'bg-obsidian-600'
                )}
                style={{ height }}
              />
            )
          })}
        </div>

        {/* Time */}
        <span className="text-[10px] font-mono text-gray-500 shrink-0 w-12 text-right">
          {playing ? `${Math.floor(progress * totalDuration / 100)}s` : `~${totalDuration}s`}
        </span>

        {/* Regenerate */}
        <button onClick={handleRegenerate} className="text-gray-600 hover:text-gray-400 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Briefing text preview */}
      {!voiceQuery && (
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 italic">
          "{SAMPLE_BRIEFING.slice(0, 160)}..."
        </p>
      )}

      {/* Voice Q&A */}
      <div className="border-t border-white/6 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Ask Veritas</span>
          <Button size="sm" variant="ghost" icon={<Mic size={11} />} onClick={handleVoiceQ}>
            Voice Q&A
          </Button>
        </div>

        <AnimatePresence>
          {voiceQuery && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              {listening && (
                <div className="flex items-center gap-2 text-jade-400">
                  <span className="w-2 h-2 rounded-full bg-jade-400 status-live" />
                  <span className="text-[11px]">Listening...</span>
                </div>
              )}
              {transcript && (
                <div className="flex gap-2">
                  <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">You:</span>
                  <p className="text-[11px] text-gray-300 italic">"{transcript}"</p>
                </div>
              )}
              {!aiReply && transcript && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={11} className="animate-spin" />
                  <span className="text-[11px]">Thinking...</span>
                </div>
              )}
              {aiReply && (
                <div className="flex gap-2">
                  <Volume2 size={12} className="text-gold-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-300 leading-relaxed">{aiReply}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}