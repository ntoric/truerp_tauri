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
    <header className="sticky top-0 z-30 flex h-[var(--app-header-h)] items-center justify-between border-b bg-white px-3 sm:px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-2">
        {canSwitchStores && switchableStores.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <Store className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <Select
              value={activeStore?.id || undefined}
              onValueChange={setActiveStore}
              disabled={loading || switchableStores.length === 0}
            >
              <SelectTrigger className="h-8 w-[180px] border-slate-200 bg-slate-50 text-xs sm:w-[200px] sm:text-sm">
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
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
            <Store className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate font-medium text-slate-800">{activeStore.name}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="h-8 gap-1.5 bg-blue-600 px-2.5 hover:bg-blue-700">
          <Link href="/pos" title="Open POS">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">POS</span>
          </Link>
        </Button>
        <NotificationBell />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-medium leading-tight text-gray-900">{user?.name || 'User'}</p>
            <p className="text-[11px] leading-tight text-gray-500">{user?.role || 'Owner'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
