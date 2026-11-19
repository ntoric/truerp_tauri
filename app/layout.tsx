import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Providers } from './providers'
import { COLOR_THEME_BOOTSTRAP_SCRIPT } from '@/lib/colorThemes'
import { THEME_MODE_BOOTSTRAP_SCRIPT } from '@/lib/themeMode'
import { APPEARANCE_BOOTSTRAP_SCRIPT } from '@/lib/appearancePrefs'

// Gooseroot UI kit typeface — bundled locally so the desktop app works offline.
const poppins = localFont({
  src: [
    { path: './fonts/poppins-regular.woff', weight: '400', style: 'normal' },
    { path: './fonts/poppins-medium.woff', weight: '500', style: 'normal' },
    { path: './fonts/poppins-bold.woff', weight: '700', style: 'normal' },
  ],
  variable: '--font-poppins',
  display: 'swap',
  fallback: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'TruERP by Gooseroot - GST Billing Software',
  description: 'Best GST Billing and ERP Software for Small Businesses in India, built by Gooseroot.',
  applicationName: 'TruERP',
  authors: [{ name: 'Gooseroot' }],
  creator: 'Gooseroot',
  publisher: 'Gooseroot',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <body className="font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_MODE_BOOTSTRAP_SCRIPT + COLOR_THEME_BOOTSTRAP_SCRIPT + APPEARANCE_BOOTSTRAP_SCRIPT,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
