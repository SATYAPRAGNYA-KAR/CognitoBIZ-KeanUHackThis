'use client'
import { motion } from 'framer-motion'
import { Mic, MicOff, Volume2, Loader2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVoice, SUPPORTED_LANGUAGES } from '@/hooks/useVoice'

export function VoiceAssistant({ onClose }: { onClose?: () => void }) {
  const {
    isListening,
    isThinking,
    isSpeaking,
    transcript,
    conversation,
    error,
    isSupported,
    languageCode,
    setLanguageCode,
    startListening,
    stopListening,
  } = useVoice()

  const bars = Array.from({ length: 20 })

  return (
    <div className="flex flex-col h-full">
      {/* Language selector */}
      <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-white/6">
        <Globe size={11} className="text-gray-600 shrink-0" />
        <span className="text-[10px] text-gray-600 uppercase tracking-widest shrink-0">
          Language
        </span>
        <select
          value={languageCode}
          onChange={e => setLanguageCode(e.target.value)}
          className={cn(
            'ml-auto text-[11px] rounded-md px-2 py-1',
            'bg-obsidian-800 border border-white/10 text-gray-300',
            'focus:outline-none focus:border-gold-400/40',
            'cursor-pointer',
          )}
          disabled={isListening || isThinking}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[100px]">
        {conversation.length === 0 && !isListening && !isThinking && (
          <div className="text-center text-gray-600 text-sm py-6">
            <Volume2 size={24} className="mx-auto mb-2 text-gray-700" />
            Ask CognitoBIZ anything about your finances
          </div>
        )}
        {conversation.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center shrink-0 mt-0.5">
                <Volume2
                  size={10}
                  className={cn(
                    'text-gold-400',
                    isSpeaking && i === conversation.length - 1 && 'animate-pulse',
                  )}
                />
              </div>
            )}
            <div
              className={cn(
                'px-3 py-2 rounded-xl text-xs max-w-[80%]',
                m.role === 'user'
                  ? 'bg-gold-400/10 border border-gold-400/15 text-gold-400'
                  : 'bg-obsidian-800 border border-white/8 text-gray-300',
              )}
            >
              {m.content}
            </div>
          </motion.div>
        ))}
        {isThinking && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
              <Loader2 size={10} className="text-gold-400 animate-spin" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-obsidian-800 border border-white/8 text-xs text-gray-500">
              Thinking…
            </div>
          </div>
        )}
        {transcript && (
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-xl bg-gold-400/8 border border-gold-400/10 text-xs text-gold-400/70 italic">
              {transcript}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-ember-400 text-center">{error}</p>}
      </div>

      {/* Waveform + mic */}
      <div className="flex items-center gap-3">
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          disabled={!isSupported}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center border transition-all shrink-0',
            isListening
              ? 'bg-ember-400/15 border-ember-400/30 text-ember-400'
              : 'bg-gold-400/10 border-gold-400/20 text-gold-400 hover:bg-gold-400/15',
            !isSupported && 'opacity-40 cursor-not-allowed',
          )}
        >
          {isListening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {bars.map((_, i) => (
            <motion.div
              key={i}
              animate={
                isListening
                  ? {
                      height: [
                        `${20 + Math.sin(i) * 15}%`,
                        `${40 + Math.sin(i * 1.3 + 1) * 30}%`,
                        `${20 + Math.sin(i) * 15}%`,
                      ],
                    }
                  : { height: `${15 + Math.sin(i * 0.8) * 10 + 10}%` }
              }
              transition={{ duration: 0.5, repeat: isListening ? Infinity : 0, delay: i * 0.04 }}
              className={cn(
                'flex-1 rounded-full',
                isListening ? 'bg-ember-400' : isSpeaking ? 'bg-gold-400' : 'bg-obsidian-600',
              )}
            />
          ))}
        </div>

        <div className="text-[10px] text-gray-600 shrink-0">
          {!isSupported
            ? 'Chrome only'
            : isListening
              ? 'Release to send'
              : isThinking
                ? 'Processing…'
                : 'Hold to speak'}
        </div>
      </div>
    </div>
  )
}