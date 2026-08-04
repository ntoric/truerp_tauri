'use client'

const SAMPLE_ITEMS = [
  {
    sn: 1,
    name: 'Cleanic 100% bleach',
    qty: '1.0 PCS',
    rate: 168.64,
    mrp: 199,
    amt: 189.05,
    code: 'CLN1001',
    disc: '5.00%',
    tax: '18.00%',
  },
  {
    sn: 2,
    name: 'AP Honey 500g',
    qty: '2.0 PCS',
    rate: 211.86,
    mrp: 265,
    amt: 500.0,
    code: 'APH28292',
    disc: '—',
    tax: '18.00%',
  },
  {
    sn: 3,
    name: 'Colgate Electric Toothbrush',
    qty: '1.0 PCS',
    rate: 651.69,
    mrp: 899,
    amt: 730.55,
    code: 'RTTE88292',
    disc: '5.00%',
    tax: '18.00%',
  },
]

export type ThermalPreviewBusiness = {
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  logo_url?: string
}

const DEFAULT_BUSINESS: ThermalPreviewBusiness = {
  name: 'HONEYS WHOLESALE',
  address: 'Marudhamalai Rd, Aishwarya Nagar, P N Pudur',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '641041',
  phone: '9894404450',
}

function formatInr(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function TwoInchItemTable() {
  return (
    <div className="font-mono text-[7px] leading-tight">
      <div className="flex justify-between font-semibold">
        <span>SN Items</span>
        <span>Amt</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>
          Qty&nbsp;&nbsp;&nbsp;Rate&nbsp;&nbsp;&nbsp;MRP
        </span>
        <span>Tax</span>
      </div>
      <div className="font-semibold">Item Code&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Disc</div>
      <hr className="my-1 border-t border-dashed border-gray-400" />
      {SAMPLE_ITEMS.map((item) => {
        const discDisplay = item.disc === '—' ? '-' : item.disc
        const codeDisplay = item.sn === 1 ? '-' : item.code
        return (
          <div key={item.sn} className="mb-1.5 border-b border-dashed border-gray-300 pb-1 last:border-0">
            <div className="flex gap-1">
              <span className="w-3 shrink-0">{item.sn}</span>
              <span className="min-w-0 flex-1 break-words">{item.name}</span>
            </div>
            <div className="flex justify-between gap-1 pl-3">
              <span className="truncate">
                {item.qty}&nbsp;&nbsp;{item.rate.toFixed(2)}&nbsp;&nbsp;{item.mrp}
              </span>
              <span className="shrink-0 tabular-nums">{item.amt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-1 pl-3 tabular-nums text-gray-800">
              <span className="max-w-[38%] truncate">{codeDisplay}</span>
              <span className="text-center">{discDisplay}</span>
              <span className="shrink-0">{item.tax}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InvoiceTotals() {
  return (
    <>
      <hr className="my-2 border-t border-dashed border-gray-400" />
      <div className="space-y-0.5 text-[8px]">
        <div className="flex justify-between">
          <span>Sub Total</span>
          <span>{formatInr(1419.6)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxable Amount</span>
          <span>{formatInr(1203.05)}</span>
        </div>
        <div className="flex justify-between">
          <span>SGST 9%</span>
          <span>{formatInr(108.27)}</span>
        </div>
        <div className="flex justify-between">
          <span>CGST 9%</span>
          <span>{formatInr(108.27)}</span>
        </div>
        <hr className="my-1 border-t border-dashed border-gray-400" />
        <div className="flex justify-between font-bold">
          <span>Total Amount</span>
          <span>{formatInr(1636.15)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid Amount</span>
          <span>{formatInr(1220.6)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Balance Amount</span>
          <span>{formatInr(0)}</span>
        </div>
      </div>
      <hr className="my-2 border-t border-gray-800" />
    </>
  )
}

function InvoiceFooter({ wide }: { wide: boolean }) {
  return (
    <>
      <p className="text-[7px] font-semibold">Notes</p>
      <p className="text-[7px] leading-snug text-gray-800">
        {wide
          ? 'We offer doorstep delivery for large orders. Call us to schedule delivery in Coimbatore.'
          : 'We offer doorstep delivery for large orders. Enquire at cash counter or call us for details.'}
      </p>
      <p className="mt-2 text-[7px] font-semibold">Terms and Conditions</p>
      <ol className="list-decimal pl-3 text-[6px] leading-snug text-gray-800">
        <li>Goods once sold will not be taken back or exchanged</li>
        <li>
          {wide
            ? 'All disputes are subject to local jurisdiction only.'
            : 'All disputes are subject to PUNE jurisdiction only'}
        </li>
      </ol>
      <p className="mt-2 text-center text-[8px] font-medium">Thank you for your purchase</p>
    </>
  )
}

type Props = {
  printSize: '1inch' | '1.5inch' | '2inch' | '3inch'
  business?: Partial<ThermalPreviewBusiness>
}

export default function ThermalInvoicePreviewSample({ printSize, business }: Props) {
  const merged = { ...DEFAULT_BUSINESS, ...business }
  const b = {
    ...merged,
    name: merged.name?.trim() ? merged.name : DEFAULT_BUSINESS.name,
  }
  const isWide = printSize === '3inch'
  const isCompact = printSize === '1inch' || printSize === '1.5inch'
  const widthPx =
    printSize === '1inch' ? 120 : printSize === '1.5inch' ? 168 : isWide ? 302 : 219
  const fontSize = printSize === '1inch' ? 6 : printSize === '1.5inch' ? 7 : isWide ? 9 : 7
  const addressLines2Inch = [
    'Marudhamalai Rd, Aishwarya Nagar,',
    'P N Pudur, Coimbatore, Tamil Nadu',
    '641041, Coimbatore, Tamil Nadu,',
    '641041',
  ]
  const addressLineWide = [b.address, b.city, b.state, b.pincode].filter(Boolean).join(', ')
  const useCustomAddress =
    Boolean(b.address?.trim()) || Boolean(b.city?.trim()) || Boolean(b.state?.trim())

  return (
    <div
      className="mx-auto bg-white text-black shadow-md"
      style={{
        width: widthPx,
        maxWidth: '100%',
        fontFamily: isWide ? 'Arial, Helvetica, sans-serif' : 'Courier New, Courier, monospace',
        fontSize,
        lineHeight: 1.35,
      }}
    >
      <div className="border border-gray-300 p-2">
        {b.logo_url && !isCompact ? (
          <div className="mb-2 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.logo_url}
              alt=""
              className="max-h-[70px] max-w-[210px] object-contain grayscale"
            />
          </div>
        ) : null}

        <p className={`text-center font-bold tracking-wide ${isCompact ? 'text-[8px]' : 'text-[11px]'}`}>
          TAX INVOICE
        </p>
        <p className={`mt-1 text-center font-bold uppercase ${isCompact ? 'text-[8px]' : 'text-[10px]'}`}>
          {b.name}
        </p>
        {isWide ? (
          <p className="text-center text-[8px] leading-snug text-gray-800">{addressLineWide}</p>
        ) : useCustomAddress ? (
          <p className="text-center text-[7px] leading-snug text-gray-800">{addressLineWide}</p>
        ) : (
          addressLines2Inch.map((line) => (
            <p key={line} className="text-center text-[7px] leading-snug text-gray-800">
              {line}
            </p>
          ))
        )}
        {b.phone ? (
          <p className="text-center text-[8px]">Phone No: {b.phone}</p>
        ) : null}

        <hr className="my-2 border-t border-gray-800" />

        <div className="space-y-0.5 text-[8px]">
          <p>
            <span className="font-semibold">Invoice Number:</span> RT/24/272
          </p>
          <p>
            <span className="font-semibold">Invoice Date:</span>
            {isWide ? ` ${new Date().toLocaleDateString('en-IN')}` : ''}
          </p>
          <p>
            <span className="font-semibold">Bill To:</span> Cash Sale
          </p>
        </div>

        <hr className="my-2 border-t border-dashed border-gray-400" />

        {isWide ? (
          <table className="w-full border-collapse text-[7px]">
            <thead>
              <tr className="border-b border-dashed border-gray-400">
                <th className="py-0.5 text-left font-semibold">SN</th>
                <th className="py-0.5 text-left font-semibold">Items</th>
                <th className="py-0.5 text-right font-semibold">Qty</th>
                <th className="py-0.5 text-right font-semibold">Rate</th>
                <th className="py-0.5 text-right font-semibold">MRP</th>
                <th className="py-0.5 text-right font-semibold">Amt</th>
              </tr>
              <tr className="border-b border-dashed border-gray-400 text-[6px]">
                <th colSpan={2} />
                <th colSpan={4} className="py-0.5 text-left font-semibold">
                  Item Code · Disc · Tax
                </th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ITEMS.map((item) => (
                <tr key={item.sn} className="border-b border-dashed border-gray-300 align-top">
                  <td className="py-1 pr-0.5">{item.sn}</td>
                  <td className="py-1 pr-1">{item.name}</td>
                  <td className="py-1 text-right whitespace-nowrap">{item.qty}</td>
                  <td className="py-1 text-right">{item.rate.toFixed(2)}</td>
                  <td className="py-1 text-right">{item.mrp}</td>
                  <td className="py-1 text-right font-medium">{item.amt.toFixed(2)}</td>
                </tr>
              ))}
              {SAMPLE_ITEMS.map((item) => (
                <tr key={`${item.sn}-meta`} className="border-b border-dashed border-gray-200 text-[6px] text-gray-700">
                  <td colSpan={2} />
                  <td colSpan={4} className="pb-1">
                    {item.code} · Disc {item.disc} · Tax {item.tax}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <TwoInchItemTable />
        )}

        <InvoiceTotals />
        <InvoiceFooter wide={isWide} />
      </div>
    </div>
  )
}
