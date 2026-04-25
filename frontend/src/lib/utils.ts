import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelative(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export function truncateTx(tx: string, chars = 6): string {
  if (!tx) return ''
  return `${tx.slice(0, chars)}...${tx.slice(-chars)}`
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    high: 'text-ember-400',
    medium: 'text-gold-400',
    low: 'text-jade-400',
    error: 'text-ember-400',
    warning: 'text-gold-400',
    success: 'text-jade-400',
    info: 'text-sapphire-400',
  }
  return map[severity] || 'text-gray-400'
}

export function getMilestoneColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'text-gray-400 bg-gray-400/10',
    submitted: 'text-gold-400 bg-gold-400/10',
    under_review: 'text-sapphire-400 bg-sapphire-400/10',
    approved: 'text-jade-400 bg-jade-400/10',
    revision_requested: 'text-ember-400 bg-ember-400/10',
    paid: 'text-jade-400 bg-jade-400/20',
  }
  return map[status] || 'text-gray-400 bg-gray-400/10'
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}