'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, AlertTriangle, CheckCircle, Info, Zap, FileText } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import type { Notification } from '@/types'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { _id: '1', companyId: 'c1', userId: 'u1', type: 'hitl', title: 'Payment Approval Required', message: 'Acme Corp invoice $2,400 awaiting your approval.', severity: 'warning', read: false, link: '/payments', createdAt: new Date(Date.now() - 300000).toISOString() },
  { _id: '2', companyId: 'c1', userId: 'u1', type: 'anomaly', title: 'Anomaly Detected', message: 'AWS spend is 247% above your monthly average.', severity: 'error', read: false, link: '/dashboard', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { _id: '3', companyId: 'c1', userId: 'u1', type: 'milestone', title: 'Milestone Submitted', message: 'Vendor submitted evidence for WorkContract #0047 Milestone 2.', severity: 'info', read: false, link: '/contracts', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { _id: '4', companyId: 'c1', userId: 'u1', type: 'payment', title: 'Payment Released', message: '$800 released to Acme Dev — Milestone 1 complete.', severity: 'success', read: true, link: '/audit', createdAt: new Date(Date.now() - 86400000).toISOString() },
]

const icons: Record<string, React.ReactNode> = {
  warning: <AlertTriangle size={14} className="text-gold-400" />,
  error: <AlertTriangle size={14} className="text-ember-400" />,
  success: <CheckCircle size={14} className="text-jade-400" />,
  info: <Info size={14} className="text-sapphire-400" />,
}

const severityBorder: Record<string, string> = {
  warning: 'border-l-gold-400/60',
  error: 'border-l-ember-400/60',
  success: 'border-l-jade-400/60',
  info: 'border-l-sapphire-400/60',
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)

  const markAllRead = () => setNotifications(n => n.map(x => ({ ...x, read: true })))
  const unread = notifications.filter(n => !n.read).length

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed right-4 top-20 z-50 w-80 glass-strong rounded-2xl shadow-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-gold-400" />
                <span className="text-sm font-medium text-white">Notifications</span>
                {unread > 0 && (
                  <span className="bg-gold-500 text-obsidian-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-gray-500 hover:text-jade-400 transition-colors">
                    Mark all read
                  </button>
                )}
                <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
              {notifications.map(n => {
                const severity = n.severity ?? 'info'

                return (
                  <motion.div
                    key={n._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      'px-4 py-3 border-l-2 transition-colors',
                      severityBorder[severity] || 'border-l-transparent',
                      n.read ? 'opacity-60' : 'bg-white/[0.02]'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{icons[severity]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{n.title}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{n.message}</p>
                        <p className="text-[10px] text-gray-600 mt-1">{formatRelative(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0 mt-1" />}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/8">
              <button className="w-full text-[11px] text-center text-gray-500 hover:text-gold-400 transition-colors py-1">
                View all notifications
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
