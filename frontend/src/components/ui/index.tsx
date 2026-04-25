'use client'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'jade' | 'ember' | 'sapphire' | 'gray' | 'purple'
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = 'gray', dot = false, className }: BadgeProps) {
  const variants = {
    gold: 'bg-gold-400/10 text-gold-400 border-gold-400/20',
    jade: 'bg-jade-400/10 text-jade-400 border-jade-400/20',
    ember: 'bg-ember-400/10 text-ember-400 border-ember-400/20',
    sapphire: 'bg-sapphire-400/10 text-sapphire-400 border-sapphire-400/20',
    gray: 'bg-white/5 text-gray-400 border-white/10',
    purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  }
  const dotColors = {
    gold: 'bg-gold-400', jade: 'bg-jade-400', ember: 'bg-ember-400',
    sapphire: 'bg-sapphire-400', gray: 'bg-gray-400', purple: 'bg-purple-400',
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border', variants[variant], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full status-live', dotColors[variant])} />}
      {children}
    </span>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>}
        <input
          className={cn(
            'w-full bg-obsidian-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200',
            'placeholder:text-gray-600 focus:outline-none focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/20',
            'transition-all duration-200',
            icon && 'pl-9',
            error && 'border-ember-400/40',
            className
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-ember-400">{error}</span>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }: {
  label?: string; error?: string; className?: string
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
      <textarea
        className={cn(
          'w-full bg-obsidian-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200',
          'placeholder:text-gray-600 focus:outline-none focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/20',
          'transition-all duration-200 resize-none',
          error && 'border-ember-400/40',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-ember-400">{error}</span>}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn('relative glass-strong rounded-2xl w-full shadow-card', width)}
          >
            {title && (
              <div className="flex items-center justify-between p-5 border-b border-white/8">
                <h2 className="font-display font-semibold text-white">{title}</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Slider ───────────────────────────────────────────────────────────────────
interface SliderProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  label?: string
  formatValue?: (v: number) => string
}

export function Slider({ min, max, step = 1, value, onChange, label, formatValue }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex justify-between">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs text-gold-400 font-mono">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}
      <div className="relative h-1.5 bg-obsidian-700 rounded-full">
        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
// Using react-hot-toast — this exports a pre-configured toast caller
export { default as toast } from 'react-hot-toast'
export { Toaster } from 'react-hot-toast'