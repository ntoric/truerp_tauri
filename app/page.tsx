import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'
import HomeRedirect, { HOME_GATE_SCRIPT, HOME_GATE_STYLE } from '@/components/landing/HomeRedirect'
import ChatWidget from '@/components/landing/ChatWidget'

export const metadata: Metadata = {
  metadataBase: new URL('https://truerp.co.in'),
  title: 'TruERP — GST Billing, POS & Inventory Software for Indian Businesses',
  description:
    'Create GST invoices, run a fast POS counter, manage stock across stores and keep CA-ready books with TruERP. Cloud + desktop app. Contact our team to get started.',
  openGraph: {
    title: 'TruERP — GST Billing, POS & Inventory Software',
    description: 'Billing, stock and accounts — all in one place. Built for Indian retailers, wholesalers and chains.',
    images: ['/landing/dashboard.jpg'],
  },
}

// Signed-in users and the desktop shell are redirected before paint (see
// HOME_GATE_SCRIPT); everyone else sees the server-rendered landing page.
export default function Home() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOME_GATE_STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: HOME_GATE_SCRIPT }} />
      <HomeRedirect />
      <LandingPage />
      <ChatWidget />
    </>
  )
}
