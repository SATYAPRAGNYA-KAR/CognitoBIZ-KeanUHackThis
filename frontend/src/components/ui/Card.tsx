'use client'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: 'gold' | 'jade' | 'ember' | 'sapphire' | 'none'
  onClick?: () => void
  animate?: boolean
}

export function Card({ children, className, hover = false, glow = 'none', onClick, animate = false }: CardProps) {
  const glowMap = {
    gold: 'hover:shadow-gold hover:border-gold-400/20',
    jade: 'hover:shadow-jade hover:border-jade-400/20',
    ember: 'hover:glow-ember hover:border-ember-400/20',
    sapphire: 'hover:shadow-[0_0_20px_rgba(96,165,250,0.15)] hover:border-sapphire-400/20',
    none: '',
  }

  const base = (
    <div
      onClick={onClick}
      className={cn(
        'glass rounded-2xl p-5 transition-all duration-300',
        hover && 'hover:bg-obsidian-800/80 cursor-pointer',
        glow !== 'none' && glowMap[glow],
        className
      )}
    >
      {children}
    </div>
  )

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onClick={onClick}
        className={cn(
          'glass rounded-2xl p-5 transition-all duration-300',
          hover && 'hover:bg-obsidian-800/80 cursor-pointer',
          glow !== 'none' && glowMap[glow],
          className
        )}
      >
        {children}
      </motion.div>
    )
  }

  return base
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-medium text-gray-400 uppercase tracking-widest', className)}>{children}</h3>
}