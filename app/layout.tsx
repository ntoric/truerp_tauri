import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { COLOR_THEME_BOOTSTRAP_SCRIPT } from '@/lib/colorThemes'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TruERP - GST Billing Software',
  description: 'Best GST Billing and ERP Software for Small Businesses in India',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_BOOTSTRAP_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
