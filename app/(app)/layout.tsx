'use client'

import { ReactNode } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'

/**
 * Persistent app chrome across menu navigations.
 * Keeps Sidebar/Header mounted so pages can show their own loading state
 * inside the content area instead of replacing the whole screen.
 */
export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
