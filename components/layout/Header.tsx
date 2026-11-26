'use client'

import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { useThemeMode } from '@/hooks/useThemeMode'
import { LogOut, MessageCircle, Moon, Palette, Settings, ShoppingCart, Store, Sun, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NotificationBell from './NotificationBell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function Header() {
  const { user, logout } = useAuth()
  const { stores, activeStore, canSwitchStores, setActiveStore, loading } = useStore()
  const { resolvedMode, setMode } = useThemeMode()

  const switchableStores = stores.filter((s) => s.is_active)
  const initials =
    (user?.name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || null

  return (
    // Outer strip keeps --app-header-h for sticky offsets; the inner card floats 0.5rem below the top.
    <header className="sticky top-0 z-30 h-[var(--app-header-h)] bg-background/85 px-2 pt-2 backdrop-blur-md">
      <div className="flex h-full items-center justify-between rounded-2xl bg-card px-2.5 shadow-gr-sm dark:ring-1 dark:ring-white/[0.06] sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/dashboard" className="shrink-0 md:hidden" aria-label="TruERP dashboard"><BrandLogo showWordmark={false} iconClassName="h-7 w-7" /></Link>
        {canSwitchStores && switchableStores.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-primary dark:bg-[hsl(var(--theme-500)/0.15)]">
              <Store className="h-4 w-4" />
            </span>
            <Select
              value={activeStore?.id || undefined}
              onValueChange={setActiveStore}
              disabled={loading || switchableStores.length === 0}
            >
              <SelectTrigger className="h-8 w-[180px] rounded-full border-border bg-surface-2 px-3.5 text-xs font-medium transition-colors hover:bg-card sm:w-[210px] sm:text-sm">
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-primary dark:bg-[hsl(var(--theme-500)/0.15)]">
              <Store className="h-4 w-4" />
            </span>
            <span className="truncate font-semibold tracking-tight text-slate-800">{activeStore.name}</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          asChild
          size="sm"
          className="h-8 gap-1.5 rounded-full px-4 font-medium"
        >
          <Link href="/pos" title="Open POS">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">POS</span>
          </Link>
        </Button>
        <NotificationBell />
        <button
          type="button"
          onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
          aria-label={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-accent md:pr-3"
              aria-label="Account menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-button-gradient text-xs font-bold text-primary-foreground">
                {initials ?? <User className="h-4 w-4" />}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-xs font-semibold leading-tight text-slate-900">{user?.name || 'User'}</p>
                <p className="text-[11px] capitalize leading-tight text-slate-500">{user?.role || 'Owner'}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-tight text-gray-900">{user?.name || 'User'}</p>
                {user?.email && (
                  <p className="text-[11px] leading-tight text-gray-500">{user.email}</p>
                )}
                <p className="text-[11px] leading-tight text-gray-500">{user?.role || 'Owner'}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/appearance" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span>Appearance</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/chat-access" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>Chat access</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => logout()}
              className="flex items-center gap-2 text-red-600 focus:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </header>
  )
}
