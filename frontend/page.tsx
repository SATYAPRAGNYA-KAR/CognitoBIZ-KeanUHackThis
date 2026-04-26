'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // In production, check auth state and redirect accordingly
    // For demo, redirect to dashboard after a brief landing
    const t = setTimeout(() => router.push('/dashboard'), 2800)
    return () => clearTimeout(t)
  }, [router])

  return (
    <main className="min-h-screen bg-obsidian-950 bg-grid flex items-center justify-center relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-jade-500/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center z-10"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8 flex justify-center"
        >
          <div className="w-20 h-20 rounded-2xl border border-gold-400/30 flex items-center justify-center glow-gold relative">
            <span className="text-4xl font-display font-bold text-gradient-gold">C</span>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-jade-400 status-live" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-5xl font-display font-bold mb-3"
        >
          <span className="text-gradient-gold">CognitoBIZ</span>{' '}
          <span className="text-white">AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-400 text-lg font-body font-light mb-10 max-w-md mx-auto"
        >
          Your governed AI Chief of Staff. Observing, advising, acting — with guardrails.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex items-center justify-center gap-2 text-gray-500 text-sm"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-jade-400 status-live" />
          <span>Initializing workspace...</span>
        </motion.div>
      </motion.div>
    </main>
  )
}