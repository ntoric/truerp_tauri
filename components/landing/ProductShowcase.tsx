'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { BrowserFrame } from './BrowserFrame'

const TABS = [
  {
    id: 'billing',
    label: 'GST Billing',
    title: 'Professional GST invoices in under a minute',
    body: 'Create tax invoices, estimates, delivery challans, credit and debit notes from one screen. Tax splits, HSN codes and place of supply are worked out for you.',
    points: [
      'Auto CGST / SGST / IGST from the party’s GSTIN and state',
      'E-invoice (IRN + QR) and E-way bill generation',
      'Convert an estimate to an invoice in one click',
      'Share on WhatsApp, email or the customer portal',
    ],
    img: '/landing/invoice-create.jpg',
    url: 'truerp.co.in/invoices/create',
  },
  {
    id: 'pos',
    label: 'POS Counter',
    title: 'A checkout counter that keeps the queue moving',
    body: 'Scan, bill and print in seconds. Built for supermarkets, retail stores and busy counters, with keyboard shortcuts for every action.',
    points: [
      'Barcode scanners, weighing scales and thermal printers',
      'Split payments across cash, UPI, card and credit',
      'Hold bills and resume them later',
      'Keeps billing even when the internet drops (desktop app)',
    ],
    img: '/landing/pos.jpg',
    url: 'truerp.co.in/pos',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    title: 'Know exactly what’s on the shelf, everywhere',
    body: 'Live stock across stores and warehouses, with batch and serial-number tracking, transfers and adjustments recorded with a full audit trail.',
    points: [
      'Multiple warehouses / godowns with stock per location',
      'Low-stock alerts before you run out',
      'Batches, serial numbers and product variants',
      'Inter-store and warehouse stock transfers',
      'Stock value and movement reports',
    ],
    img: '/landing/inventory.jpg',
    url: 'truerp.co.in/inventory',
  },
  {
    id: 'parties',
    label: 'Parties & Dues',
    title: 'Collect payments faster, with no awkward calls',
    body: 'Every customer and supplier has a ledger, up to date to the rupee. See who owes what and how long it has been overdue, then send a reminder in one tap.',
    points: [
      'Party ledgers, statements and receivables aging',
      'Credit limits and opening balances',
      'WhatsApp and SMS payment reminders',
      'Loyalty points and membership cards',
    ],
    img: '/landing/parties.jpg',
    url: 'truerp.co.in/parties',
  },
  {
    id: 'reports',
    label: 'Reports & GST',
    title: 'Books your CA will thank you for',
    body: 'GSTR-1, GSTR-3B, HSN summary, P&L, balance sheet and bill-wise profit, always up to date and ready to export.',
    points: [
      'GSTR-1 / 2 / 3B and HSN summaries',
      'Profit & loss, balance sheet, trial balance',
      'Daily, bill-wise and item-wise profit',
      'Export to Excel, CSV or PDF in one click',
    ],
    img: '/landing/reports.jpg',
    url: 'truerp.co.in/reports',
  },
] as const

export default function ProductShowcase() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('billing')
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  return (
    <div>
      <div className="lp-segwrap">
        <div role="tablist" aria-label="Product areas" className="lp-seg">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={t.id === active}
              aria-controls={`showcase-${t.id}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div id={`showcase-${tab.id}`} role="tabpanel" className="lp-showcase">
        <div>
          <h3 className="lp-h2" style={{ fontSize: 28, lineHeight: '34px' }}>
            {tab.title}
          </h3>
          <p className="lp-lead" style={{ marginTop: 14, fontSize: 16, lineHeight: '26px' }}>
            {tab.body}
          </p>
          <ul className="lp-list">
            {tab.points.map((p) => (
              <li key={p}>
                <Check className="lp-check" strokeWidth={2.4} />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <BrowserFrame url={tab.url}>
          <img key={tab.img} src={tab.img} alt={`${tab.label} screen in TruERP`} width={1600} height={1000} />
        </BrowserFrame>
      </div>
    </div>
  )
}
