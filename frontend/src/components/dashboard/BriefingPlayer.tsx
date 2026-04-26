'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, RefreshCw, Mic, MicOff, Loader2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn, apiFetch } from '@/lib/utils'
import { toast } from 'react-hot-toast'

interface BriefingData {
  script: string
  audio_base64: string | null
  mime_type: string
  duration_estimate: number
  generated_at: string
  error: string | null
}

interface VoiceAnswer {
  answer: string
  audio_base64: string | null
  mime_type: string
  error: string | null
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

const BARS = Array.from({ length: 28 })

// Keep in sync with backend SUPPORTED_LANGUAGES + useVoice.ts
const BRIEFING_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
]

export function BriefingPlayer() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [fetching, setFetching] = useState(false)
  // ready = briefing has been fetched at least once; before that the button is clickable Play
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [languageCode, setLanguageCode] = useState('en')

  // Voice Q&A state
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [asking, setAsking] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [conversation, setConversation] = useState<{ role: string; content: string }[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const progressRef = useRef<any>(null)

  // ── Audio stop helper (defined before fetchBriefing so it's in scope) ────
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    clearInterval(progressRef.current)
    setPlaying(false)
  }, [])

  // ── Fetch briefing from backend ──────────────────────────────────────────
  // NOT called on mount — user triggers this by clicking Play or the ↺ button.
  const fetchBriefing = useCallback(async () => {
    setFetching(true)
    setProgress(0)
    stopAudio()
    try {
      const data = await apiFetch<BriefingData>(
        `/api/voice/briefing?language_code=${encodeURIComponent(languageCode)}`
      )
      setBriefing(data)
      setReady(true)
      if (data.error && !data.audio_base64) {
        toast.error('ElevenLabs key not configured — script only')
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not generate briefing')
    } finally {
      setFetching(false)
    }
  }, [stopAudio, languageCode])

  // ── Play button handler ───────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    // Not fetched yet → generate first, then auto-play
    if (!ready && !fetching) {
      await fetchBriefing()
      return
    }

    if (!briefing) return

    // Already playing → pause
    if (playing) {
      stopAudio()
      return
    }

    // No audio (ElevenLabs not configured) → simulate progress over script duration
    if (!briefing.audio_base64) {
      setPlaying(true)
      const totalMs = (briefing.duration_estimate || 60) * 1000
      const step = 100 / (totalMs / 100)
      progressRef.current = setInterval(() => {
        setProgress(p => {
          if (p + step >= 100) {
            clearInterval(progressRef.current)
            setPlaying(false)
            return 100
          }
          return p + step
        })
      }, 100)
      return
    }

    // Real audio playback
    const blob = base64ToBlob(briefing.audio_base64, briefing.mime_type || 'audio/mpeg')
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio

    audio.onplay = () => setPlaying(true)
    audio.onended = () => {
      setPlaying(false)
      setProgress(100)
      URL.revokeObjectURL(url)
    }
    audio.onerror = () => {
      setPlaying(false)
      toast.error('Audio playback failed')
      URL.revokeObjectURL(url)
    }

    progressRef.current = setInterval(() => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }, 200)

    audio.play().catch(() => {
      toast.error('Browser blocked autoplay — click play again')
      setPlaying(false)
    })
  }, [briefing, fetching, fetchBriefing, playing, ready, stopAudio])

  // When language changes, reset so next play regenerates in the new language
  useEffect(() => {
    setReady(false)
    setBriefing(null)
    stopAudio()
  }, [languageCode, stopAudio])

  // Cleanup on unmount
  useEffect(() => () => stopAudio(), [stopAudio])

  // ── Voice Q&A ─────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported — try Chrome')
      return
    }
    const r = new SpeechRecognition()
    r.continuous = false
    r.interimResults = true
    // Use selected language for speech recognition too
    r.lang = languageCode === 'zh' ? 'zh-CN'
           : languageCode === 'pt' ? 'pt-BR'
           : `${languageCode}-${languageCode.toUpperCase()}`
    let latest = ''
    r.onstart = () => { setListening(true); setTranscript(''); setAiReply('') }
    r.onresult = (e: any) => {
      latest = Array.from(e.results).map((x: any) => x[0].transcript).join('')
      setTranscript(latest)
    }
    r.onend = () => { setListening(false); if (latest) sendVoiceQuestion(latest) }
    r.onerror = () => setListening(false)
    recognitionRef.current = r
    r.start()
  }, [languageCode])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const sendVoiceQuestion = useCallback(async (question: string) => {
    if (!question.trim()) return
    setAsking(true)
    setConversation(prev => [...prev, { role: 'user', content: question }])
    try {
      const data = await apiFetch<VoiceAnswer>('/api/voice/ask', {
        method: 'POST',
        body: JSON.stringify({
          question,
          conversation_history: conversation.slice(-6),
          language_code: languageCode,
        }),
      })
      setAiReply(data.answer)
      setConversation(prev => [...prev, { role: 'assistant', content: data.answer }])
      if (data.audio_base64) {
        const blob = base64ToBlob(data.audio_base64, data.mime_type || 'audio/mpeg')
        const url = URL.createObjectURL(blob)
        const a = new Audio(url)
        a.onended = () => URL.revokeObjectURL(url)
        a.play().catch(() => {})
      }
    } catch (e: any) {
      toast.error(e.message || 'Voice Q&A failed')
    } finally {
      setAsking(false)
      setTranscript('')
    }
  }, [conversation, languageCode])

  const totalSecs = briefing?.duration_estimate || 60
  const elapsed = Math.floor((progress / 100) * totalSecs)

  // What icon to show in the play button
  const PlayIcon = () => {
    if (fetching) return <Loader2 size={16} className="animate-spin" />
    if (playing) return <Pause size={16} />
    return <Play size={16} />
  }

  return (
    <div className="space-y-3">
      {/* Language selector */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-white/6">
        <Globe size={11} className="text-gray-600 shrink-0" />
        <span className="text-[10px] text-gray-600 uppercase tracking-widest shrink-0">Language</span>
        <select
          value={languageCode}
          onChange={e => setLanguageCode(e.target.value)}
          disabled={fetching || playing}
          className={cn(
            'ml-auto text-[11px] rounded-md px-2 py-1',
            'bg-obsidian-800 border border-white/10 text-gray-300',
            'focus:outline-none focus:border-gold-400/40 cursor-pointer',
          )}
        >
          {BRIEFING_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>

      {/* Player row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button — always clickable, never disabled unless actively fetching */}
        <button
          onClick={handlePlay}
          disabled={fetching}
          className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-400/25 flex items-center justify-center text-gold-400 hover:bg-gold-500/25 transition-all shrink-0 disabled:opacity-40"
        >
          <PlayIcon />
        </button>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {BARS.map((_, i) => {
            const isPlayed = i / BARS.length < progress / 100
            return (
              <motion.div
                key={i}
                animate={playing
                  ? { height: [`${25 + Math.sin(i * 0.8) * 20}%`, `${50 + Math.sin(i * 1.2 + 1) * 30}%`, `${25 + Math.sin(i * 0.8) * 20}%`] }
                  : { height: `${15 + Math.sin(i * 1.3) * 25 + 20}%` }
                }
                transition={{ duration: 0.7, repeat: playing ? Infinity : 0, delay: i * 0.025 }}
                className={cn('w-1 rounded-full transition-colors', isPlayed ? 'bg-gold-400' : 'bg-obsidian-600')}
              />
            )
          })}
        </div>

        <span className="text-[10px] font-mono text-gray-500 shrink-0 w-10 text-right">
          {!ready ? 'ready' : playing ? `${elapsed}s` : `~${totalSecs}s`}
        </span>

        {/* Refresh — only shown after first fetch */}
        {ready && (
          <button
            onClick={fetchBriefing}
            disabled={fetching}
            className="text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
            title="Regenerate briefing"
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Pre-fetch hint */}
      {!ready && !fetching && (
        <p className="text-[11px] text-gray-600 italic">
          Click ▶ to generate your morning briefing with Gemma 4 + ElevenLabs
        </p>
      )}

      {/* Generating indicator */}
      {fetching && (
        <p className="text-[11px] text-gray-500 italic">
          Generating briefing with Gemma 4…
        </p>
      )}

      {/* Script preview after fetch */}
      {briefing?.script && !voiceOpen && !fetching && (
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 italic">
          &quot;{briefing.script.slice(0, 160)}…&quot;
        </p>
      )}
      {briefing?.error && !briefing.audio_base64 && (
        <p className="text-[10px] text-ember-400/70">⚠ {briefing.error}</p>
      )}

      {/* Voice Q&A */}
      <div className="border-t border-white/6 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Voice Q&A</span>
          <Button
            size="sm"
            variant="ghost"
            icon={voiceOpen ? <MicOff size={11} /> : <Mic size={11} />}
            onClick={() => setVoiceOpen(v => !v)}
          >
            {voiceOpen ? 'Close' : 'Ask'}
          </Button>
        </div>

        <AnimatePresence>
          {voiceOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-3">
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border transition-all shrink-0',
                    listening
                      ? 'bg-ember-400/15 border-ember-400/30 text-ember-400'
                      : 'bg-gold-400/10 border-gold-400/20 text-gold-400 hover:bg-gold-400/15'
                  )}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <span className="text-[10px] text-gray-600">
                  {listening ? 'Listening… release to send' : 'Hold to speak'}
                </span>
              </div>

              {transcript && (
                <div className="flex gap-2">
                  <span className="text-[10px] text-gray-600 shrink-0 mt-0.5">You:</span>
                  <p className="text-[11px] text-gray-300 italic">&quot;{transcript}&quot;</p>
                </div>
              )}
              {asking && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={11} className="animate-spin" />
                  <span className="text-[11px]">Thinking…</span>
                </div>
              )}
              {aiReply && !asking && (
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
