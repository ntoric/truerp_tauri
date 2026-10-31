import { apiFetch } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/accountingExport'

// ---- Types ----------------------------------------------------------------

export interface GstRegistration {
  id: string
  gstin: string
  legal_name: string
  trade_name: string
  state_code: string
  state: string
  registration_type: 'composition' | 'regular'
  composition_category: string
  composition_rate: number
  effective_from: string
  effective_to?: string | null
  filing_frequency: string
  status: string
  notes?: string
  created_at?: string
}

export interface GstReturnPeriod {
  id: string
  gst_registration_id: string
  registration?: GstRegistration
  financial_year: string
  period_type: 'quarterly' | 'annual'
  quarter: number
  period_start: string
  period_end: string
  return_type: 'CMP-08' | 'GSTR-4'
  status: string
  generated_at?: string | null
  finalized_at?: string | null
  filed_at?: string | null
  portal_reference?: string
  filing_notes?: string
}

export interface GstSnapshot {
  id: string
  gst_return_period_id: string
  version: number
  calculation_rule: string
  source_data_version: string
  turnover_basis: number
  composition_rate: number
  cgst_liability: number
  sgst_liability: number
  total_composition_liability: number
  rcm_taxable_value: number
  rcm_liability: number
  interest_amount: number
  late_fee_amount: number
  adjustments_total: number
  total_payable: number
  calculation_details?: string
  generated_at: string
}

export interface GstValidationIssue {
  id: string
  gst_return_period_id: string
  report_version: number
  severity: 'ERROR' | 'WARNING' | 'INFO'
  code: string
  message: string
  source_transaction_type: string
  source_transaction_id?: string | null
  source_reference: string
  resolution_status: 'open' | 'resolved'
  resolution_note?: string
  resolved_at?: string | null
  created_at: string
}

export interface GstTaxPayment {
  id: string
  gst_return_period_id: string
  payment_date: string
  amount: number
  component: string
  challan_reference: string
  portal_confirmed: boolean
  portal_reference: string
  notes?: string
}

export interface GstReconciliationRecord {
  id: string
  gst_return_period_id: string
  reconciliation_type: string
  system_calculated_value: number
  recorded_return_value: number
  portal_confirmed_value?: number | null
  difference: number
  resolution_status: 'open' | 'explained' | 'resolved'
  resolution_note?: string
  created_at: string
}

export interface GstReportExport {
  id: string
  gst_return_period_id?: string | null
  export_type: string
  file_format: string
  file_name: string
  report_version: number
  record_count: number
  validation_status: string
  generated_at: string
}

export interface GstSalesRegisterRow {
  financial_year: string
  tax_period: string
  invoice_number: string
  invoice_date: string
  invoice_status: string
  document_type: string
  customer_name: string
  customer_gstin: string
  customer_state: string
  place_of_supply: string
  transaction_type: string
  gross_amount: number
  discount_amount: number
  return_amount: number
  net_amount: number
  taxable_value: number
  exempt_value: number
  nil_rated_value: number
  non_gst_value: number
  tax_amount: number
  supply_classification: string
  composition_turnover: string
  is_inter_state: boolean
  included_in_totals: boolean
  source_type: string
  source_id: string
}

export interface GstPurchaseRegisterRow {
  financial_year: string
  tax_period: string
  purchase_invoice_number: string
  purchase_date: string
  status: string
  document_type: string
  supplier_name: string
  supplier_gstin: string
  supplier_registration: string
  supplier_state: string
  place_of_supply: string
  purchase_category: string
  gross_amount: number
  discount_amount: number
  return_amount: number
  net_amount: number
  taxable_value: number
  exempt_value: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  reverse_charge: boolean
  rcm_taxable_value: number
  rcm_tax_amount: number
  is_inter_state: boolean
  included_in_totals: boolean
  source_type: string
  source_id: string
}

// ---- Scope ------------------------------------------------------------------

export type GstScopeMode = 'quarter' | 'annual' | 'custom'

export interface GstScope {
  registrationId: string
  fy: string
  quarter: number
  mode: GstScopeMode
  startDate: string
  endDate: string
}

export function currentIndianFY(now = new Date()): string {
  const y = now.getFullYear()
  const start = now.getMonth() >= 3 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

export function fyOptions(count = 6): string[] {
  const cur = currentIndianFY()
  const startYear = parseInt(cur.slice(0, 4), 10)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const y = startYear - i
    out.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`)
  }
  return out
}

export function currentQuarter(now = new Date()): number {
  const m = now.getMonth()
  if (m >= 3 && m <= 5) return 1
  if (m >= 6 && m <= 8) return 2
  if (m >= 9 && m <= 11) return 3
  return 4
}

export function defaultGstScope(): GstScope {
  return {
    registrationId: '',
    fy: currentIndianFY(),
    quarter: currentQuarter(),
    mode: 'quarter',
    startDate: '',
    endDate: '',
  }
}

export function buildGstScopeQuery(scope: GstScope): string {
  const p = new URLSearchParams()
  if (scope.registrationId) p.set('registration_id', scope.registrationId)
  if (scope.mode === 'custom' && scope.startDate && scope.endDate) {
    p.set('start_date', scope.startDate)
    p.set('end_date', scope.endDate)
    return p.toString()
  }
  p.set('fy', scope.fy)
  if (scope.mode === 'quarter') p.set('quarter', String(scope.quarter))
  return p.toString()
}

// ---- Fetch helpers ------------------------------------------------------------

export async function gstGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(`/gst/composition${path}`, { timeoutMs: 30000 })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return (body as { data: T }).data
}

export async function gstSend<T = any>(path: string, method: string, payload?: any): Promise<T> {
  const res = await apiFetch(`/gst/composition${path}`, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    timeoutMs: 30000,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `Request failed (${res.status})`)
    ;(err as any).body = body
    throw err
  }
  return (body as { data: T }).data
}

export type GstExportKind =
  | 'filing-summary/excel'
  | 'filing-summary/pdf'
  | 'sales-register/excel'
  | 'sales-register/csv'
  | 'purchase-register/excel'
  | 'purchase-register/csv'
  | 'cmp08/excel'
  | 'cmp08/pdf'
  | 'gstr4/excel'

const EXT_FOR: Record<GstExportKind, string> = {
  'filing-summary/excel': 'xlsx',
  'filing-summary/pdf': 'pdf',
  'sales-register/excel': 'xlsx',
  'sales-register/csv': 'csv',
  'purchase-register/excel': 'xlsx',
  'purchase-register/csv': 'csv',
  'cmp08/excel': 'xlsx',
  'cmp08/pdf': 'pdf',
  'gstr4/excel': 'xlsx',
}

export async function downloadGstExport(scope: GstScope, kind: GstExportKind, periodId?: string) {
  const p = new URLSearchParams(buildGstScopeQuery(scope))
  if (periodId) p.set('period_id', periodId)
  const res = await apiFetch(`/gst/composition/export/${kind}?${p.toString()}`, { timeoutMs: 120000 })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Export failed')
  }
  const blob = await res.blob()
  if (!blob.size) throw new Error('Export was empty')
  const ext = EXT_FOR[kind]
  const q = scope.mode === 'quarter' ? `_Q${scope.quarter}` : ''
  await downloadBlob(`GST_Composition_FY${scope.fy}${q}_${kind.replace('/', '_')}.${ext}`, blob, {
    label: `Exporting ${kind.split('/')[0].toUpperCase()} ${ext.toUpperCase()}`,
  })
}

export const GST_COMPOSITION_CATEGORIES = [
  { value: 'trader', label: 'Trader (goods) — 1%' },
  { value: 'manufacturer', label: 'Manufacturer — 1%' },
  { value: 'restaurant', label: 'Restaurant (non-alcohol) — 5%' },
  { value: 'service_provider', label: 'Service provider — 6%' },
]

export const GST_PERIOD_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  GENERATED: 'bg-blue-100 text-blue-700',
  VALIDATED: 'bg-emerald-100 text-emerald-700',
  FINALIZED: 'bg-violet-100 text-violet-700',
  EXPORTED: 'bg-cyan-100 text-cyan-700',
  FILED: 'bg-green-100 text-green-700',
  RECONCILIATION_REQUIRED: 'bg-amber-100 text-amber-700',
}

export const GST_SEVERITY_COLORS: Record<string, string> = {
  ERROR: 'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  INFO: 'bg-sky-100 text-sky-700',
}
