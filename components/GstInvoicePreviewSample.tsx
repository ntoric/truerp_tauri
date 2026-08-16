'use client'

import type { InvoiceSettingsRecord, InvoiceTemplateCustomization } from '@/lib/invoiceTemplateSettings'
import { invoiceLogoClass } from '@/lib/logoAspect'

export interface GstPreviewBusiness {
  name?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  phone?: string
  gstin?: string
  logo_url?: string
  logo_aspect_ratio?: string
}

const SAMPLE_ITEMS = [
  {
    name: 'SAMSUNG A30',
    hsn: '85171300',
    qty: '1 PCS',
    rate: 10000,
    discPct: 10,
    discAmt: 1000,
    taxPct: 18,
    taxAmt: 1620,
    amount: 10620,
  },
  {
    name: 'PARLE-G 200G',
    hsn: '19053100',
    qty: '1 BOX',
    rate: 342.86,
    discPct: 10,
    discAmt: 34.29,
    taxPct: 5,
    taxAmt: 15.43,
    amount: 324,
  },
  {
    name: 'PUMA BLUE ROUND NECK T-SHIRT',
    hsn: '61091000',
    qty: '1 PCS',
    rate: 900,
    discPct: 10,
    discAmt: 90,
    taxPct: 5,
    taxAmt: 40.5,
    amount: 850.5,
  },
]

function formatInr(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  settings: InvoiceSettingsRecord
  customization: InvoiceTemplateCustomization
  business?: GstPreviewBusiness
}

export default function GstInvoicePreviewSample({ settings, customization, business }: Props) {
  const primary = settings.primary_color || '#111827'
  const secondary = settings.secondary_color || '#374151'
  const cols = customization.item_columns
  const theme = settings.template

  const companyName = business?.name || 'HONEYS WHOLESALE'
  const companyLine =
    business?.address ||
    '14, Gandhi Nagar, Opp. Anna Bus Stand, Coimbatore, Tamil Nadu, 641001'
  const companyPhone = business?.phone || '9876543210'

  const headerClass =
    theme === 'modern'
      ? 'rounded-lg px-4 py-3 text-white'
      : theme === 'minimal'
        ? 'border-b-2 border-gray-900 pb-3'
        : 'border-b-4 pb-3'
  const headerStyle =
    theme === 'modern'
      ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
      : theme === 'stylish' || theme === 'luxury' || theme === 'advanced_gst'
        ? { borderColor: primary }
        : { borderColor: '#e5e7eb' }

  return (
    <div className="mx-auto max-w-[720px] rounded-lg border border-gray-200 bg-white p-6 text-[11px] leading-snug text-gray-900 shadow-sm">
      <div className={`mb-4 ${headerClass}`} style={headerStyle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            {settings.show_logo ? (
              business?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo_url} alt="" className={invoiceLogoClass(business.logo_aspect_ratio)} />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  LOGO
                </div>
              )
            ) : null}
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">{companyName}</p>
              <p className="mt-1 max-w-xs text-[10px] text-gray-600">{companyLine}</p>
              {customization.theme_settings.show_phone_on_invoice ? (
                <p className="text-[10px] text-gray-600">Mobile {companyPhone}</p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: theme === 'modern' ? '#fff' : primary }}>
              TAX INVOICE
            </p>
            <p className="text-[9px] text-gray-500">ORIGINAL FOR RECIPIENT</p>
          </div>
        </div>
      </div>

      {(customization.invoice_details.show_invoice_number ||
        customization.invoice_details.show_invoice_date ||
        customization.invoice_details.show_due_date) && (
        <div
          className="mb-4 grid grid-cols-3 gap-2 rounded px-3 py-2 text-[10px] text-white"
          style={{ backgroundColor: primary }}
        >
          {customization.invoice_details.show_invoice_number ? (
            <div>
              <span className="opacity-80">Invoice No.</span>
              <p className="font-semibold">AABBCCDD/202</p>
            </div>
          ) : null}
          {customization.invoice_details.show_invoice_date ? (
            <div>
              <span className="opacity-80">Invoice Date</span>
              <p className="font-semibold">17/01/2023</p>
            </div>
          ) : null}
          {customization.invoice_details.show_due_date ? (
            <div>
              <span className="opacity-80">Due Date</span>
              <p className="font-semibold">16/02/2023</p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mb-4">
        <p className="mb-1 text-[10px] font-bold uppercase text-gray-500">Bill To</p>
        {customization.party_details.show_party_name ? (
          <p className="font-semibold">Sample Party</p>
        ) : null}
        {customization.party_details.show_party_address ? (
          <p className="text-gray-600">
            No F2, Outer Circle, Connaught Circus, New Delhi, Delhi, 110001
          </p>
        ) : null}
        {customization.party_details.show_party_phone &&
        customization.theme_settings.show_phone_on_invoice ? (
          <p className="text-gray-600">Mobile +919876543210</p>
        ) : null}
        {customization.party_details.show_party_gstin ? (
          <p className="text-gray-600">GSTIN 07ABCCH2702H4ZZ</p>
        ) : null}
      </div>

      <table className="mb-4 w-full border-collapse text-[10px]">
        <thead>
          <tr style={{ backgroundColor: `${primary}15` }}>
            {cols.items ? (
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold">ITEMS</th>
            ) : null}
            {cols.hsn ? (
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold">HSN</th>
            ) : null}
            {cols.batch ? (
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold">BATCH</th>
            ) : null}
            {cols.qty ? (
              <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold">QTY.</th>
            ) : null}
            {cols.rate ? (
              <th className="border border-gray-200 px-2 py-1.5 text-right font-semibold">RATE</th>
            ) : null}
            {cols.disc ? (
              <th className="border border-gray-200 px-2 py-1.5 text-right font-semibold">DISC.</th>
            ) : null}
            {cols.tax ? (
              <th className="border border-gray-200 px-2 py-1.5 text-right font-semibold">TAX</th>
            ) : null}
            {cols.amount ? (
              <th className="border border-gray-200 px-2 py-1.5 text-right font-semibold">AMOUNT</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((row) => (
            <tr key={row.name}>
              {cols.items ? (
                <td className="border border-gray-200 px-2 py-1.5 align-top">
                  <div className="font-medium">{row.name}</div>
                  {customization.theme_settings.show_item_description ? (
                    <div className="text-[9px] text-gray-500">Sample description</div>
                  ) : null}
                </td>
              ) : null}
              {cols.hsn ? (
                <td className="border border-gray-200 px-2 py-1.5">{row.hsn}</td>
              ) : null}
              {cols.batch ? (
                <td className="border border-gray-200 px-2 py-1.5">BATCH001</td>
              ) : null}
              {cols.qty ? (
                <td className="border border-gray-200 px-2 py-1.5">{row.qty}</td>
              ) : null}
              {cols.rate ? (
                <td className="border border-gray-200 px-2 py-1.5 text-right">{formatInr(row.rate)}</td>
              ) : null}
              {cols.disc ? (
                <td className="border border-gray-200 px-2 py-1.5 text-right">
                  <div>{formatInr(row.discAmt)}</div>
                  <div className="text-[9px] text-gray-500">{row.discPct}%</div>
                </td>
              ) : null}
              {cols.tax ? (
                <td className="border border-gray-200 px-2 py-1.5 text-right">
                  <div>{formatInr(row.taxAmt)}</div>
                  <div className="text-[9px] text-gray-500">{row.taxPct}%</div>
                </td>
              ) : null}
              {cols.amount ? (
                <td className="border border-gray-200 px-2 py-1.5 text-right font-medium">
                  {formatInr(row.amount)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-4">
        <div>
          {customization.invoice_details.show_notes ? (
            <div className="mb-3">
              <p className="font-semibold text-gray-700">Notes</p>
              <p className="text-gray-600">Sample Note</p>
            </div>
          ) : null}
          {customization.invoice_details.show_terms_and_conditions && settings.show_terms ? (
            <div>
              <p className="font-semibold text-gray-700">Terms and Conditions</p>
              <p className="text-[9px] text-gray-500">
                Goods once sold will not be taken back. Subject to local jurisdiction.
              </p>
            </div>
          ) : null}
        </div>
        <div className="space-y-1 text-right text-[10px]">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>₹ 11,794.50</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Taxable Amount</span>
            <span>₹ 10,594.50</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>IGST @5%</span>
            <span>₹ 55.93</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>IGST @18%</span>
            <span>₹ 1,620.00</span>
          </div>
          <div
            className="flex justify-between border-t pt-1 text-sm font-bold"
            style={{ color: primary }}
          >
            <span>Total Amount</span>
            <span>₹ 11,794.50</span>
          </div>
          {customization.invoice_details.show_received_amount ? (
            <div className="flex justify-between text-gray-600">
              <span>Received Amount</span>
              <span>₹ 0.00</span>
            </div>
          ) : null}
          {customization.invoice_details.show_balance_due ? (
            <div className="flex justify-between font-medium">
              <span>Balance</span>
              <span>₹ 11,794.50</span>
            </div>
          ) : null}
          {customization.theme_settings.show_party_balance ? (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Previous Balance</span>
                <span>₹ 0.00</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Current Balance</span>
                <span>₹ 11,794.50</span>
              </div>
            </>
          ) : null}
          {customization.invoice_details.show_amount_in_words ? (
            <p className="pt-2 text-left text-[9px] text-gray-500">
              Eleven Thousand Seven Hundred Ninety Four Rupees and Fifty Paise Only
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
