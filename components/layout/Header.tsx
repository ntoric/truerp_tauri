'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { ShoppingCart, Store, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NotificationBell from './NotificationBell'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Header() {
  const { user } = useAuth()
  const { stores, activeStore, canSwitchStores, setActiveStore, loading } = useStore()

  const switchableStores = stores.filter((s) => s.is_active)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-8">
      <div className="flex min-w-0 items-center gap-3">
        {canSwitchStores && switchableStores.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <Store className="h-4 w-4 shrink-0 text-slate-500" />
            <Select
              value={activeStore?.id || undefined}
              onValueChange={setActiveStore}
              disabled={loading || switchableStores.length === 0}
            >
              <SelectTrigger className="h-9 w-[220px] border-slate-200 bg-slate-50 text-sm">
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {switchableStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : activeStore ? (
          <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
            <Store className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="truncate font-medium text-slate-800">{activeStore.name}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Button asChild size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Link href="/pos" title="Open POS">
            <ShoppingCart className="h-4 w-4" />
            <span>POS</span>
          </Link>
        </Button>
        <NotificationBell />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User className="h-5 w-5" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500">{user?.role || 'Owner'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
