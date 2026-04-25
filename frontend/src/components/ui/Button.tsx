'use client'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'jade'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-body font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'bg-obsidian-600 hover:bg-obsidian-500 text-white border border-white/10 hover:border-white/20',
    secondary: 'bg-transparent hover:bg-obsidian-700 text-gray-300 border border-white/10 hover:border-white/20',
    ghost: 'bg-transparent hover:bg-obsidian-800 text-gray-400 hover:text-gray-200',
    danger: 'bg-ember-500/10 hover:bg-ember-500/20 text-ember-400 border border-ember-500/20 hover:border-ember-500/40',
    gold: 'bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/20 hover:border-gold-500/40 glow-gold',
    jade: 'bg-jade-500/10 hover:bg-jade-500/20 text-jade-400 border border-jade-500/20 hover:border-jade-500/40 glow-jade',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...(props as any)}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </motion.button>
  )
}