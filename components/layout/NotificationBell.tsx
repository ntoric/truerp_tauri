'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications')
      if (res.ok) {
        setNotifications(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const recentNotifications = useMemo(() => notifications.slice(0, 8), [notifications])

  const markRead = async (id: string) => {
    const res = await apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
    }
  }

  const markAllRead = async () => {
    const res = await apiFetch('/notifications/read-all', { method: 'PUT' })
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) fetchNotifications()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentNotifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet</p>
          ) : (
            recentNotifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  notification.is_read ? 'bg-white' : 'bg-blue-50/50'
                }`}
                onClick={() => {
                  if (!notification.is_read) markRead(notification.id)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  {!notification.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{notification.message}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {formatRelativeTime(notification.created_at)}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="border-t px-4 py-2">
          <Link
            href="/notifications?tab=alerts"
            className="block rounded-md py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
