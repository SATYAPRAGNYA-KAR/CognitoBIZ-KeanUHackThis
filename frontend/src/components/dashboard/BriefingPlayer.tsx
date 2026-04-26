'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, RefreshCw, Mic, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useVoice } from '@/hooks/useVoice'

type BriefingResponse = {
  script: string
  audio_base64: string | null
  mime_type: string
  duration_estimate?: number
  duration_estimate_seconds?: number
  generated_at?: string
  error?: string | null
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteArr = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteArr], { type: mimeType })
}

export function BriefingPlayer() {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null)
  const [loadingBriefing, setLoadingBriefing] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  const {
    isListening,
    isThinking,
    isSpeaking,
    transcript,
    conversation,
    error: voiceError,
    isSupported,
    startListening,
  } = useVoice()

  const lastAssistantReply = useMemo(() => {
    return [...conversation].reverse().find((message) => message.role === 'assistant')?.content || ''
  }, [conversation])

  const fetchBriefing = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoadingBriefing(true)
    }

    try {
      const response = await fetch('/api/voice/briefing', {
        cache: 'no-store',
      })

      const data = await response.json().catch(() => ({ detail: 'Unable to load morning briefing.' })) as BriefingResponse & {
        detail?: string
      }

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Unable to load morning briefing.')
      }

      setBriefing(data)
      setBriefingError(data.error || null)
      setProgress(0)
      setPlaying(false)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    } catch (error) {
      setBriefingError(error instanceof Error ? error.message : 'Unable to load morning briefing.')
    } finally {
      setLoadingBriefing(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchBriefing()
  }, [])

  useEffect(() => {
    if (!briefing?.audio_base64) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
      return
    }

    const blob = base64ToBlob(briefing.audio_base64, briefing.mime_type || 'audio/mpeg')
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)

    audioRef.current = audio
    audioUrlRef.current = url

    audio.onplay = () => setPlaying(true)
    audio.onpause = () => setPlaying(false)
    audio.onended = () => {
      setPlaying(false)
      setProgress(100)
    }
    audio.ontimeupdate = () => {
      if (!audio.duration || Number.isNaN(audio.duration)) return
      setProgress((audio.currentTime / audio.duration) * 100)
    }

    return () => {
      audio.pause()
      audio.src = ''
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }
      audioRef.current = null
    }
  }, [briefing?.audio_base64, briefing?.mime_type])

  const handlePlay = async () => {
    if (!audioRef.current || !briefing?.audio_base64) return

    if (playing) {
      audioRef.current.pause()
      return
    }

    try {
      await audioRef.current.play()
    } catch {
      setBriefingError('Audio playback was blocked by the browser.')
    }
  }

  const handleRegenerate = async () => {
    await fetchBriefing(true)
  }

  const totalDuration = Math.round(
    briefing?.duration_estimate_seconds || briefing?.duration_estimate || 60
  )

  const bars = Array.from({ length: 28 })
  const voiceQueryActive = isListening || isThinking || conversation.length > 0 || Boolean(transcript)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlay}
          disabled={loadingBriefing || refreshing || !briefing?.audio_base64}
          className="w-10 h-10 rounded-xl bg-gold-500/15 border border-gold-400/25 flex items-center justify-center text-gold-400 hover:bg-gold-500/25 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingBriefing || refreshing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
        </button>

        <div className="flex-1 flex items-center gap-0.5 h-8">
          {bars.map((_, i) => {
            const playedFraction = progress / 100
            const barFraction = i / bars.length
            const isPlayed = barFraction < playedFraction
            const staticHeight = `${45 + Math.sin(i * 1.3) * 20}%`

            return (
              <motion.div
                key={i}
                animate={{ height: playing ? ['30%', `${40 + Math.sin(i) * 30}%`, '30%'] : staticHeight }}
                transition={{ duration: 0.6, repeat: playing ? Infinity : 0, delay: i * 0.03 }}
                className={cn('w-1 rounded-full transition-colors', isPlayed ? 'bg-gold-400' : 'bg-obsidian-600')}
                style={{ height: staticHeight }}
              />
            )
          })}
        </div>

        <span className="text-[10px] font-mono text-gray-500 shrink-0 w-12 text-right">
          {playing ? `${Math.floor((progress * totalDuration) / 100)}s` : `~${totalDuration}s`}
        </span>

        <button
          onClick={handleRegenerate}
          disabled={loadingBriefing || refreshing}
          className="text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {!voiceQueryActive && (
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 italic">
          "{briefing?.script ? `${briefing.script.slice(0, 160)}...` : 'Loading your morning briefing...'}"
        </p>
      )}

      {briefingError ? (
        <div className="flex gap-2 rounded-xl border border-ember-500/20 bg-ember-500/8 px-3 py-2">
          <AlertCircle size={12} className="text-ember-300 mt-0.5 shrink-0" />
          <p className="text-[11px] text-ember-300/90">
            {briefingError}
          </p>
        </div>
      ) : null}

      <div className="border-t border-white/6 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Ask Veritas</span>
          <Button
            size="sm"
            variant="ghost"
            icon={<Mic size={11} />}
            onClick={startListening}
            disabled={!isSupported || isListening || isThinking}
          >
            Voice Q&A
          </Button>
        </div>

        <AnimatePresence>
          {voiceQueryActive && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
              {isListening && (
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

              {!lastAssistantReply && isThinking && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={11} className="animate-spin" />
                  <span className="text-[11px]">Thinking...</span>
                </div>
              )}

              {lastAssistantReply && (
                <div className="flex gap-2">
                  <Volume2 size={12} className={cn('shrink-0 mt-0.5', isSpeaking ? 'text-gold-400' : 'text-gray-500')} />
                  <p className="text-[11px] text-gray-300 leading-relaxed">{lastAssistantReply}</p>
                </div>
              )}

              {voiceError ? (
                <p className="text-[11px] text-ember-300">{voiceError}</p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
