import {
  ArrowRight,
  BadgePercent,
  BookOpen,
  Bot,
  Boxes,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  DatabaseBackup,
  FileBarChart,
  Gift,
  Globe,
  Laptop,
  Headset,
  Mail,
  MessageCircle,
  Menu,
  Phone,
  Pill,
  Printer,
  Receipt,
  Scale,
  ScanBarcode,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Truck,
  Users,
  WifiOff,
  Wrench,
} from 'lucide-react'

export const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#product', label: 'Product tour' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export const FACTS = [
  { value: '25+', label: 'business modules in one app' },
  { value: '24 hrs', label: 'typical time to go live' },
  { value: '100%', label: 'GST-ready: GSTR-1, 3B, e-invoice' },
  { value: 'Daily', label: 'encrypted cloud backups' },
]

export const PAYMENT_MODES = ['UPI & QR', 'Cash', 'Debit / Credit cards', 'NEFT / RTGS', 'Split tender', 'Credit (Udhar)']

export const FEATURES = [
  {
    icon: Receipt,
    title: 'GST invoicing',
    body: 'Tax invoices, estimates, challans, credit and debit notes with automatic GST, e-invoice (IRN) and e-way bills.',
  },
  {
    icon: ScanBarcode,
    title: 'POS billing',
    body: 'A fast checkout counter with barcode scanning, weighing scale support, thermal receipts and split payments.',
  },
  {
    icon: Boxes,
    title: 'Inventory & warehouses',
    body: 'Live stock across stores and multiple warehouses or godowns, with batches, serial numbers, transfers, adjustments and low-stock alerts.',
  },
  {
    icon: Users,
    title: 'Parties & collections',
    body: 'Customer and supplier ledgers, aging, credit limits and one-tap WhatsApp payment reminders.',
  },
  {
    icon: BookOpen,
    title: 'Accounting',
    body: 'Double-entry books, cash and bank, expenses, journals, trial balance, P&L and balance sheet.',
  },
  {
    icon: FileBarChart,
    title: 'Reports & GST returns',
    body: 'GSTR-1 / 2 / 3B, HSN summary, bill-wise profit, stock and sales reports, ready for your CA.',
  },
  {
    icon: CalendarCheck,
    title: 'HR & payroll',
    body: 'Staff records, daily attendance with reminders, monthly salary runs, advances, deductions and partial payouts, all linked to your books.',
  },
  {
    icon: Gift,
    title: 'Loyalty & marketing',
    body: 'Reward points, membership cards, and WhatsApp, SMS and email campaigns that bring customers back.',
  },
  {
    icon: Globe,
    title: 'Customer portal & B2B shop',
    body: 'Let customers view invoices and statements online, and let dealers place orders from your own catalogue.',
  },
]

export const WIDGETS = [
  { img: '/landing/widget-sales-trend.jpg', title: 'Sales trend', body: 'Best day, 30-day total and invoice count.', wide: true },
  { img: '/landing/widget-invoice-status.jpg', title: 'Invoice status', body: 'Collected vs. overdue at a glance.' },
  { img: '/landing/widget-payment-modes.jpg', title: 'Payment modes', body: 'UPI vs. cash vs. card vs. bank.' },
  { img: '/landing/widget-top-debtors.jpg', title: 'Outstanding dues', body: 'Who to call first, ranked by days overdue.' },
  { img: '/landing/widget-top-products.jpg', title: 'Top products', body: 'Your best sellers by units and revenue.' },
  { img: '/landing/widget-cash-flow.jpg', title: 'Cash flow', body: 'Money in vs. money out, every day.', wide: true },
]

export const INDUSTRIES = [
  { icon: ShoppingBasket, name: 'Grocery & supermarkets', note: 'Fast POS, weighing scales, barcode labels' },
  { icon: Pill, name: 'Pharmacy & medical', note: 'Batch-wise stock and HSN-ready billing' },
  { icon: Cpu, name: 'Electronics & mobiles', note: 'Serial numbers, warranties and EMI-friendly split tender' },
  { icon: Shirt, name: 'Apparel & footwear', note: 'Size and colour variants with barcode tags' },
  { icon: Truck, name: 'Wholesale & distribution', note: 'Multiple godowns, B2B shop, e-way bills and credit limits' },
  { icon: Wrench, name: 'Hardware & auto parts', note: 'Thousands of SKUs with fast search' },
  { icon: Building2, name: 'Multi-outlet chains', note: 'Central control across every store' },
  { icon: BadgePercent, name: 'Service businesses', note: 'Quotations, invoices and payment tracking' },
]

export const PLATFORM = [
  {
    icon: Cloud,
    title: 'Cloud, from any browser',
    body: 'Sign in from a laptop, desktop or tablet. Your data is in sync across every counter and outlet.',
  },
  {
    icon: Laptop,
    title: 'macOS & Windows app',
    body: 'A native counter app for your billing counters, with one-click printing and automatic updates.',
  },
  {
    icon: Printer,
    title: 'Thermal & A4 printers',
    body: 'Print 58 mm and 80 mm thermal receipts (ESC/POS), A4 GST invoices and barcode labels straight from the counter.',
  },
  {
    icon: Scale,
    title: 'Weighing scale support',
    body: 'Read live weight from a connected scale into the bill, scan weight-embedded barcodes and sync PLU items to your scale.',
  },
  {
    icon: WifiOff,
    title: 'Keeps billing offline',
    body: 'If the shop internet drops, POS bills are queued on the counter and synced once you’re back online.',
  },
  {
    icon: Bot,
    title: 'Works with AI assistants',
    body: 'Ask Claude or ChatGPT about sales, dues or stock through the built-in MCP connector.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    body: 'Role-based permissions, two-factor login and a security audit log of who changed what.',
  },
  {
    icon: DatabaseBackup,
    title: 'Your data, always yours',
    body: 'Automatic daily backups, and export everything to Excel, CSV or PDF whenever you like.',
  },
]

/*
 * Support contact shown in the "Contact support" section. Accounts are created
 * by the support team (no self-signup), so every sign-up CTA points here.
 * TODO: fill in the real details — empty values are hidden on the page.
 */
export const SUPPORT = {
  phone: '', // e.g. '+91 98xxx xxxxx'
  whatsapp: '', // digits only with country code, e.g. '9198xxxxxxxx'
  email: '', // e.g. 'support@truerp.co.in'
}

export const SUPPORT_CHANNELS = [
  SUPPORT.phone && { icon: Phone, label: 'Call us', value: SUPPORT.phone, href: `tel:${SUPPORT.phone.replace(/[^\d+]/g, '')}` },
  SUPPORT.whatsapp && {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: `+${SUPPORT.whatsapp}`,
    href: `https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent('Hi, I would like to get a TruERP account.')}`,
  },
  SUPPORT.email && {
    icon: Mail,
    label: 'Email',
    value: SUPPORT.email,
    href: `mailto:${SUPPORT.email}?subject=${encodeURIComponent('New TruERP account')}`,
  },
].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string }[]

export const MOBILE_APP = {
  stores: [
    { id: 'play', name: 'Google Play' },
    { id: 'apple', name: 'App Store' },
  ],
  features: [
    { icon: Receipt, title: 'Bill on the go', body: 'Create GST invoices and quotations from your phone and share them on WhatsApp.' },
    { icon: FileBarChart, title: 'Sales at a glance', body: 'Today’s sales, collections and profit for every store, right on your home screen.' },
    { icon: Users, title: 'Dues & reminders', body: 'See who owes you and send payment reminders in a tap.' },
    { icon: Boxes, title: 'Stock in your pocket', body: 'Check stock levels and low-stock alerts across godowns, and scan barcodes with the camera.' },
  ],
}

export const STEPS = [
  { n: '01', title: 'Contact our team', body: 'Tell us about your business. We create your workspace with your GSTIN, store details and invoice template.', when: 'Right away' },
  { n: '02', title: 'Bring your data', body: 'Import parties, items with HSN codes and opening balances from Tally, Vyapar, Busy or Excel.', when: 'Within hours' },
  { n: '03', title: 'Connect your counters', body: 'Plug in barcode scanners and printers, invite staff and set their permissions.', when: 'Same day' },
  { n: '04', title: 'Start billing', body: 'Go live at every outlet, with support on WhatsApp and phone whenever you need it.', when: 'Ongoing' },
]

export type Plan = {
  name: string
  price: string | null
  period?: string
  note: string
  tagline: string
  popular?: boolean
  features: string[]
  cta: string
}

export const PLANS: Plan[] = [
  {
    name: 'Standard',
    price: '3,999',
    period: '/year',
    note: 'Billed yearly · GST extra',
    tagline: 'Everything a growing business needs to bill, sell and stay GST-compliant.',
    popular: true,
    features: [
      'Unlimited GST invoices, quotes & challans',
      'POS with barcode, weighing scale & thermal printing',
      'Inventory, batches & serial numbers',
      'Multiple warehouses / godowns with stock transfers',
      'Parties, ledgers & payment reminders',
      'Accounting, expenses and cash & bank',
      'HR & payroll: attendance, salaries & advances',
      'GSTR-1 / 3B, HSN & profit reports',
      'Web + macOS / Windows desktop app',
      'Android & iOS apps (coming soon)',
      'Cloud hosting & daily backups',
    ],
    cta: 'Contact support',
  },
  {
    name: 'Custom',
    price: null,
    note: 'Priced on demand for your business',
    tagline: 'For chains, distributors and businesses with specific workflows.',
    features: [
      'Everything in Standard, plus:',
      'Modules picked for your business',
      'Custom invoice templates & branding',
      'Customer portal & B2B ordering shop',
      'API & AI-assistant (MCP) integrations',
      'Assisted data migration from Tally / Vyapar / Excel',
      'Dedicated onboarding & staff training',
    ],
    cta: 'Talk to us',
  },
]

export const FAQS = [
  {
    q: 'Is TruERP suitable for a small shop with just one counter?',
    a: 'Yes. The Standard plan works for a single shop. You can start with simple billing and turn on inventory, accounting or loyalty only when you need them.',
  },
  {
    q: 'Do I need to buy a server or special hardware?',
    a: 'No. TruERP runs in the cloud, so any laptop, desktop or tablet with a browser works. It supports standard USB/Bluetooth barcode scanners, thermal (58 / 80 mm) and A4 printers, and weighing scales.',
  },
  {
    q: 'Can I move my data from Tally, Vyapar or Excel?',
    a: 'Yes. You can import customers, suppliers, items with HSN codes, opening stock and balances. On a Custom plan, our team does the migration for you.',
  },
  {
    q: 'What happens if the internet goes down at the counter?',
    a: 'The macOS and Windows counter app keeps the POS working. Bills are queued on the device and synced automatically once you’re back online.',
  },
  {
    q: 'Does it handle GST returns and e-invoicing?',
    a: 'TruERP prepares GSTR-1, GSTR-2 and GSTR-3B summaries and HSN reports that your CA can file directly, and supports e-invoice (IRN + QR) and e-way bill generation.',
  },
  {
    q: 'Is my business data safe?',
    a: 'Every workspace is isolated and served over encrypted connections. Backups run daily, staff only see what their role allows, and every sensitive change is recorded in an audit log. You can export all your data at any time.',
  },
  {
    q: 'How do I get a TruERP account?',
    a: 'Accounts are created by our support team. Contact us by phone, WhatsApp or email and we will set up your workspace, import your existing data and walk your team through billing.',
  },
]
