import { useState, useRef, useCallback, useEffect } from 'react'
import { apiFetch } from '@/lib/utils'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  audioBase64?: string
}

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [conversation, setConversation] = useState<ConversationMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser. Try Chrome.')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
      setError(null)
    }
    recognition.onresult = (event: any) => {
      const t = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setTranscript(t)
    }
    recognition.onend = async () => {
      setIsListening(false)
      if (transcript) {
        await askQuestion(transcript)
      }
    }
    recognition.onerror = (event: any) => {
      setIsListening(false)
      setError(`Microphone error: ${event.error}`)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, transcript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  const askQuestion = useCallback(async (question: string) => {
    if (!question.trim()) return
    setIsThinking(true)
    setConversation(prev => [...prev, { role: 'user', content: question }])

    try {
      const historyForApi = conversation.map(m => ({ role: m.role, content: m.content }))
      const data = await apiFetch<{
        answer: string
        audio_base64: string | null
        mime_type: string
        error?: string
      }>('/api/voice/ask', {
        method: 'POST',
        body: JSON.stringify({ question, conversation_history: historyForApi }),
      })

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: data.answer,
        audioBase64: data.audio_base64 || undefined,
      }
      setConversation(prev => [...prev, assistantMessage])

      // Play audio if available
      if (data.audio_base64) {
        playAudio(data.audio_base64, data.mime_type || 'audio/mpeg')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsThinking(false)
      setTranscript('')
    }
  }, [conversation])

  const playAudio = useCallback((base64: string, mimeType: string) => {
    const blob = base64ToBlob(base64, mimeType)
    const url = URL.createObjectURL(blob)
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onplay = () => setIsSpeaking(true)
    audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
    audio.onerror = () => setIsSpeaking(false)
    audio.play().catch(() => setIsSpeaking(false))
  }, [])

  const clearConversation = useCallback(() => {
    setConversation([])
    setTranscript('')
    setError(null)
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  return {
    isListening, isThinking, isSpeaking, transcript, conversation, error, isSupported,
    startListening, stopListening, askQuestion, clearConversation,
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteArr = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteArr], { type: mimeType })
}