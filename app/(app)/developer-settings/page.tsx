'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import { useStore } from '@/hooks/useStore'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isSuperAdmin } from '@/lib/roles'
import {
  defaultPageFeatures,
  groupToggleablePages,
  mergePageFeatures,
  type PageFeaturesMap,
} from '@/lib/pageFeatures'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Mail, MessageSquare, Send, Loader2, CheckCircle, XCircle,
  Smartphone, Save, LayoutGrid, Sparkles, Clock,
  DatabaseBackup, Upload, FileArchive, FileUp, FileDown, AlertTriangle, Store,
  Database,
} from 'lucide-react'
import { getServerTime, type ServerTimeInfo } from '@/lib/dailyReport'

// -----------------------------------------------------------------------------
// Data Migration types & config
//
// The migration tab drives the existing myBillBook import endpoints. The ZIP
// orchestrator runs a phased import (parties, purchase bills, payments,
// expenses); the per-entity importers let users migrate a single entity CSV.
// -----------------------------------------------------------------------------
interface MigrationStep {
  step: string
  imported: number
  errors: string[]
}

interface MigrationResult {
  steps: MigrationStep[]
}

interface EntityImportOption {
  formKey: string
  label: string
  type: 'text' | 'select'
  choices?: string[]
  placeholder?: string
  defaultValue?: string
}

interface EntityImportConfig {
  key: string
  label: string
  group: string
  description: string
  endpoint: string
  // Async migration kind used by POST /api/v1/migration/jobs. When set,
  // handleImport enqueues a job and polls for progress instead of calling
  // the synchronous endpoint. When omitted, the synchronous endpoint is
  // used as before.
  kind?: string
  // CSV template content: first line is the header, subsequent lines are
  // sample rows. Downloaded as a .csv file by the "Template" button.
  template: string
  // Optional default-value controls rendered below the file picker. Values
  // are sent as form fields and applied by the backend when a CSV cell is
  // blank.
  options?: EntityImportOption[]
  // Optional: split a column containing "value unit" (e.g. "33.0 PCS") into
  // two separate columns in the preview. The original column keeps just the
  // numeric value, and a new column with unitLabel is inserted right after it.
  // Before sending to the backend, the two columns are merged back.
  splitColumn?: {
    source: string
    unitLabel: string
  }
}

const ENTITY_IMPORTS: EntityImportConfig[] = [
  {
    key: 'parties',
    label: 'Parties  (myBillBook)',
    group: 'Parties',
    description:
      'Customers & vendors. Accepts myBillBook "All Party Balance" format or a flat CSV with the columns below.',
    endpoint: '/parties/import/csv',
    kind: 'parties',
    template:
      'Name,GST,Address,State,Pincode,Mob No.,Bal.,Party Category\n' +
      'Acme Corp,29ABCDE1234F1Z5,"123 Main St",Karnataka,560001,9876543210,5000,Customer\n' +
      'Global Supplies,27FGHIJ5678K1Z2,"45 Industrial Area",Maharashtra,400001,9123456780,12000,Vendor',
    options: [
      {
        formKey: 'default_party_type',
        label: 'Default party type',
        type: 'select',
        choices: ['customer', 'vendor'],
        defaultValue: 'customer',
      },
    ],
  },
  {
    key: 'categories',
    label: 'Product categories',
    group: 'Product categories',
    description:
      'Product categories. Use "Parent Category" to nest under an existing category (matched by name).',
    endpoint: '/migration/categories/import/csv',
    kind: 'categories',
    template:
      'Name,Description,Parent Category,Is Active\n' +
      'Electronics,Electronic items,,true\n' +
      'Mobile Phones,Smartphones,Electronics,true',
  },
  {
    key: 'products',
    label: 'Products',
    group: 'Products',
    description:
      'Product catalog. Category is matched by name; SKU and PLU are auto-generated when left blank.',
    endpoint: '/products/import/csv',
    kind: 'products',
    template:
      'Name,SKU,Item Code,PLU,Category,Unit,HSN Code,Purchase Price,Sale Price,MRP,Tax Rate %,Discount,Min Stock,Item Type,Low Stock Alert,Enable Batching,Sale Price With Tax,Purchase Price With Tax\n' +
      'Widget W100,W100,100001,,Electronics,PCS,8523,50,80,100,18,,5,product,true,false,true,true',
  },
  {
    key: 'inventory',
    label: 'Inventory (opening stock)',
    group: 'Inventory',
    description:
      'Opening stock balances. Products are matched by name or code; warehouse defaults to your primary warehouse.',
    endpoint: '/migration/inventory/import/csv',
    kind: 'inventory',
    template:
      'Product Name,Product Code,Warehouse,Quantity,Cost Price,Batch No,Mfg Date,Exp Date\n' +
      'Widget W100,W100,,100,50,BATCH001,01/01/2025,31/12/2025',
  },
  {
    key: 'stock-summary',
    label: 'Stock Summary Report (myBillBook)',
    group: 'Inventory',
    description:
      'Upload a myBillBook "Stock Summary Report" CSV. Categories and products are created automatically if they do not exist; PLU is auto-assigned from 1 and SKU is generated from the item name. Stock is updated per batch.',
    endpoint: '/migration/stock-summary/import/csv',
    kind: 'stock-summary',
    template:
      'Name,Batch No.,Item Code,Purchase Price,Selling Price,Stock Quantity,Stock Value,Item Category Name,MRP,exp. date,mfg date\n' +
      'MINT & LIME MIJITO MANAMA 750ML,07/03/26,8906000482032,255.0,270.0,33.0 PCS,8151.0,SYRUP,0.0,"",""\n' +
      'ALFAHAM / BBQ MARINADE,Batch #1,610998145354,375.0,430.0,4.0 PCS,1500.0,FROZEN,0.0,"",""',
    splitColumn: {
      source: 'Stock Quantity',
      unitLabel: 'Quantity Type',
    },
    options: [
      {
        formKey: 'default_category',
        label: 'Default category',
        type: 'text',
        placeholder: 'General',
      },
    ],
  },
  {
    key: 'batched-items',
    label: 'Item Batch Report (myBillBook)',
    group: 'Inventory',
    description:
      'Upload a myBillBook "Item Batched Report" CSV to update expiry date and manufacturing date on existing inventory batches (matched by item name + batch number, prices disambiguate duplicates). Current Stock is compared against inventory and differences are listed as mismatches without changing stock; unknown items and unmatched batches are reported as errors.',
    endpoint: '/migration/batched-items/import/csv',
    kind: 'batched-items',
    template:
      'Item Name,Batch Number,Expiry Date,MFG Date,MRP,Purchase Price,Selling Price,Current Stock\n' +
      'Widget W100,Batch #1,11/11/2026,01/01/2025,100.0,50.0,80.0,10.0 PCS\n' +
      'Gadget G200,BATCH#2,,"",200.0,120.0,180.0,0.0 PCS',
    splitColumn: {
      source: 'Current Stock',
      unitLabel: 'Quantity Type',
    },
  },
  {
    key: 'purchase-bills',
    label: 'Purchases (bills)  (myBillBook)',
    group: 'Purchases',
    description:
      'Vendor purchase bills. Accepts myBillBook "Purchase Summary Report" format or a flat CSV. Rows matching an existing bill (by Purchase No, ignoring prefixes) update its Purchase link; rows with no match are listed for confirmation before being imported.',
    endpoint: '/purchase/bills/import/csv',
    kind: 'purchase-bills',
    template:
      'Purchase No,Original Invoice No,Purchase Date,Party Name,Purchase Amount,Purchase link,Notes\n' +
      '1,INV-001,01/09/2025,Global Supplies,15000,,Monthly stock',
    options: [
      {
        formKey: 'default_vendor',
        label: 'Default vendor',
        type: 'text',
        placeholder: 'General Vendor',
      },
    ],
  },
  {
    key: 'purchase-payments',
    label: 'Purchase payment status  (myBillBook-custom)',
    group: 'Purchases',
    description:
      'Update payment status, total amount, paid amount, and balance for existing purchase bills. Matches by purchase number.',
    endpoint: '/migration/purchase-payments/import/csv',
    kind: 'purchase-payments',
    template:
      'purchase number,total amount,paid amount,balance,payment status\n' +
      '1,15000,15000,0,paid\n' +
      '2,10000,5000,5000,partial',
  },
  {
    key: 'purchase-items',
    label: 'Purchase bill items  (myBillBook - custom)',
    group: 'Purchases',
    description:
      'Add line items to purchase bills that already exist — run the "Purchases (bills)" import first. Matches purchase by purchase number and product by item name.',
    endpoint: '/migration/purchase-items/import/csv',
    kind: 'purchase-items',
    template:
      'purchase number,item name,quantity,rate,amount\n' +
      '1,Widget W100,10,50,500\n' +
      '1,Widget W200,5,80,400',
  },
  {
    key: 'purchase-returns',
    label: 'Purchase returns  (myBillBook)',
    group: 'Purchases',
    description:
      'Purchase return documents from the daybook-style myBillBook export — only "Purchase Return" rows are imported, other transaction types are skipped. Each row becomes a processed return numbered PR-<Sr No.>. Money columns are informational only: no payments, cash entries, or party balance changes are made (import those via Daybook / Cash & Bank statement).',
    endpoint: '/migration/purchase-returns/import/csv',
    kind: 'purchase-returns',
    template:
      'Date,Name,Transaction Type,Sr No.,Total Amount,Money In,Money Out,Balance Amount,Created By\n' +
      '16/10/2025,Global Supplies,Purchase Return,1,54.54,0.0,0.0,54.54,Admin\n' +
      '29/10/2025,Acme Corp,Purchase Return,2,2320.0,2320.0,0.0,0.0,Admin',
  },
  {
    key: 'sales',
    label: 'Sales (invoices)  (myBillBook)',
    group: 'Sales',
    description:
      'Sales invoices. Accepts myBillBook "Sales" export (Invoice No, Invoice Date, Contact Name, Amount, Remaining Amount, Invoice Status, Due Date, Invoice Link, Payment Type, Party Category, Created by). A summary line item is created per invoice since the export has no line-item detail. Rows matching an existing invoice (by Invoice No, ignoring prefixes) update its invoice link; rows with no match are listed for confirmation before being imported.',
    endpoint: '/migration/sales/import/csv',
    kind: 'sales',
    template:
      'Invoice No,Invoice Date,Contact Name,Amount,Remaining Amount,Invoice Status,Due Date,Invoice Link,Payment Type,Party Category,Created by\n' +
      'INV-001,01/09/2025,Acme Corp,5000,0,Paid,15/09/2025,https://mybillbook.in/cpp/abc123,Cash,Customer,Admin',
  },
  {
    key: 'sales-links',
    label: 'Sales invoice links  (myBillBook - custom)',
    group: 'Sales',
    description:
      'Backfill the myBillBook source link onto existing sales invoices whose link is empty. Matches Invoice No to invoice_number (ignoring prefixes). Invoices that already have a link are left unchanged; unmatched numbers are reported — nothing is created.',
    endpoint: '/migration/sales-links/import/csv',
    kind: 'sales-links',
    template:
      'Invoice No,Invoice Date,Contact Name,Amount,Remaining Amount,Invoice Status,Due Date,Invoice Link,Payment Type,Party Category,Created by\n' +
      '1,01/09/2025,Acme Corp,5000,0,Paid,15/09/2025,https://mybillbook.in/csi/abc123,Cash,Customer,Admin',
  },
  {
    key: 'sales-returns',
    label: 'Sales returns  (myBillBook)',
    group: 'Sales',
    description:
      'Sales return documents from the daybook-style myBillBook export — only "Sales Return" rows are imported, other transaction types are skipped. Each row becomes a processed return numbered SR-<Sr No.>. Money columns are informational only: no payments, cash entries, party balance, or stock changes are made (import refunds via Daybook / Cash & Bank statement).',
    endpoint: '/migration/sales-returns/import/csv',
    kind: 'sales-returns',
    template:
      'Date,Name,Transaction Type,Sr No.,Total Amount,Money In,Money Out,Balance Amount,Created By\n' +
      '16/10/2025,Acme Corp,Sales Return,1,1080.0,0.0,1080.0,0.0,Admin\n' +
      '29/10/2025,Global Traders,Sales Return,2,260.0,0.0,0.0,260.0,Admin',
  },
  {
    key: 'sales-items',
    label: 'Sales invoice items  (myBillBook - Custom)',
    group: 'Sales',
    description:
      'Add line items to sales invoices that already exist — run the "Sales (invoices)" import first. Matches invoice by invoice number and product by item name.',
    endpoint: '/migration/sales-items/import/csv',
    kind: 'sales-items',
    template:
      'invoice number,item name,quantity,rate,amount\n' +
      'INV-001,Widget W100,10,80,800\n' +
      'INV-001,Widget W200,5,120,600',
  },
  {
    key: 'expense-categories',
    label: 'Expense categories  (myBillBook)',
    group: 'Expense categories',
    description: 'Categories used to classify expenses.',
    endpoint: '/migration/expense-categories/import/csv',
    kind: 'expense-categories',
    template:
      'Name,Description,Is Active\n' +
      'Rent,Office rent,true\n' +
      'Utilities,Electricity and internet,true',
  },
  {
    key: 'expenses',
    label: 'Expenses  (myBillBook)',
    group: 'Expenses',
    description:
      'Expense transactions. Accepts myBillBook "Expense Transactions" format or a flat CSV.',
    endpoint: '/expenses/import/csv',
    kind: 'expenses',
    template:
      'Date,Serial No.,Exp. Name,Pymt Mode,Amt.,Notes\n' +
      '01/09/2025,1,Rent,bank_transfer,25000,September office rent',
  },
  {
    key: 'bank-accounts',
    label: 'Cash & Bank — accounts',
    group: 'Cash & Bank',
    description:
      'Bank and cash accounts. The first account imported is marked as primary.',
    endpoint: '/migration/bank-accounts/import/csv',
    kind: 'bank-accounts',
    template:
      'Account Name,Account Number,Bank Name,IFSC Code,Account Type,Opening Balance,Notes\n' +
      'HDFC Current,1234567890,HDFC Bank,HDFC0001234,current,50000,Main account\n' +
      'Cash In Hand,,Cash,,,10000,Petty cash',
    options: [
      {
        formKey: 'default_account_type',
        label: 'Default account type',
        type: 'select',
        choices: ['savings', 'current'],
        defaultValue: 'savings',
      },
    ],
  },
  {
    key: 'cash-transactions',
    label: 'Cash & Bank — transactions',
    group: 'Cash & Bank',
    description:
      'Cash in / cash out transactions. Type = add (money in) or reduce (money out). Account Name links to a bank account.',
    endpoint: '/migration/cash-transactions/import/csv',
    kind: 'cash-transactions',
    template:
      'Date,Type,Account Name,Amount,Description,Reference\n' +
      '01/09/2025,add,HDFC Current,50000,Opening deposit,DEP-001\n' +
      '02/09/2025,reduce,,5000,Office supplies,,'
  },
  {
    key: 'cash-bank-statement',
    label: 'Cash & Bank — statement  (myBillBook)',
    group: 'Cash & Bank',
    description:
      'myBillBook "Cash and Bank Statement" — run after the Daybook / all-transactions import. Each row is matched to an already-imported transaction by Txn No + type and its payment mode is updated: Cash stays in cash in hand, UPI/Card/Bank Transfer/Cheque move to the account mapped in the Cash & Bank payment-method settings. The import aborts with a warning if any used mode has no account configured; no documents are created.',
    endpoint: '/migration/cash-bank-statement/import/csv',
    kind: 'cash-bank-statement',
    template:
      'Date,Type,Txn No,Party,Invoice numbers,Mode,Paid,Received,Balance,Notes\n' +
      '20/09/2026,Sales Invoice,11932,Cash Sale,,Cash,0,300.0,-,\n' +
      '20/09/2026,Payment-in,247,UPI SALE,11906,Cash,0,180.0,-,\n' +
      '18/09/2026,Payment-out,256,MARKET PURCHASE,"480, 478",Upi,50964.0,0,-,\n' +
      '20/09/2026,Expense,768,,,Cash,30.0,0,-,\n' +
      '01/09/2026,Add Money,17,,,Cash,0,6000.0,-,Opening cash',
  },
  {
    key: 'daybook',
    label: 'Daybook — all transactions  (myBillBook)',
    group: 'Daybook',
    description:
      'Combined myBillBook "Daybook Report" import. Sales Invoice rows create invoices numbered by Sr No. (Money In becomes the paid amount), Purchase Bill rows create bills P-<Sr No.> (Money Out becomes the paid amount), Payment-in/out rows are added to the payment tables and allocated oldest-first across the party\'s open invoices/bills, Expense rows create expenses under the named category, Add/Reduce Money become cash in hand transactions, and Sales/Purchase Returns become refund payments. All money movements post to cash in hand — the export carries no payment mode.',
    endpoint: '/migration/daybook/import/csv',
    kind: 'daybook',
    template:
      'Date,Name,Transaction Type,Sr No.,Total Amount,Money In,Money Out,Balance Amount,Created By\n' +
      '13/10/2025,Acme Corp,Sales Invoice,19,149.0,149.0,0.0,0.0,Admin\n' +
      '13/10/2025,Acme Corp,Payment-in,1,149.0,149.0,0.0,0.0,Admin\n' +
      '14/10/2025,Global Supplies,Purchase Bill,46,1550.0,0.0,1550.0,0.0,Admin\n' +
      '14/10/2025,Global Supplies,Payment-out,1,500.0,0.0,500.0,0.0,Admin\n' +
      '14/10/2025,Rent Expense,Expense,1,4800.0,0.0,4800.0,0.0,Admin\n' +
      '12/10/2025,,Add Money,1,15000.0,15000.0,0.0,0.0,Admin',
  },
  {
    key: 'users',
    label: 'Users',
    group: 'Users',
    description:
      'Business user accounts. Role = admin or staff. Users are attached to your store.',
    endpoint: '/migration/users/import/csv',
    kind: 'users',
    template:
      'Name,Email,Password,Phone,Role\n' +
      'John Doe,john@example.com,TempPass123,9876543210,staff\n' +
      'Jane Smith,jane@example.com,TempPass456,9123456780,admin',
    options: [
      {
        formKey: 'default_role',
        label: 'Default role',
        type: 'select',
        choices: ['staff', 'admin'],
        defaultValue: 'staff',
      },
    ],
  },
  {
    key: 'staff',
    label: 'HR & Payroll — staff',
    group: 'HR & Payroll',
    description:
      'Staff / employee records. Salary Type = monthly, daily, or hourly.',
    endpoint: '/migration/staff/import/csv',
    kind: 'staff',
    template:
      'Name,Phone,Email,Designation,Department,Joining Date,Salary,Salary Type,Bank Name,Account Number,IFSC Code,Aadhar Number,PAN Number,Notes\n' +
      'Ravi Kumar,9876543210,ravi@example.com,Sales Executive,Sales,01/01/2025,25000,monthly,HDFC Bank,1234567890,HDFC0001234,123456789012,ABCDE1234F,',
    options: [
      {
        formKey: 'default_salary_type',
        label: 'Default salary type',
        type: 'select',
        choices: ['monthly', 'daily', 'hourly'],
        defaultValue: 'monthly',
      },
    ],
  },
]

// UnmatchedRow is a summary row returned by an importer (purchase bills,
// sales invoices) whose document number did not match any existing record.
// Listed for user confirmation before being imported as new records.
interface UnmatchedRow {
  row: number
  ref: string
  party_name: string
  amount: number
}

// StockMismatch is a batched-items report row whose "Current Stock" differs
// from the matched inventory batch quantity (report-only; not applied).
interface StockMismatch {
  row: number
  item_name: string
  batch_no: string
  unit?: string
  csv_stock: number
  inventory_stock: number
}

interface EntityImportResult {
  imported: number
  updated?: number
  unmatched?: UnmatchedRow[]
  mismatches?: StockMismatch[]
  payment_in?: number
  payment_out?: number
  categories_created?: number
  products_created?: number
  stock_updated?: number
  stock_created?: number
  sales_invoices?: number
  purchase_bills?: number
  expenses?: number
  cash_transactions?: number
  skipped?: number
  errors: string[]
}

// MigrationJob mirrors the backend MigrationJob model returned by
// GET /api/v1/migration/jobs/:id. Fields are optional because the backend
// omits zero-value timestamps.
interface MigrationJob {
  id: string
  user_id: string
  kind: string
  file_name: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  step?: string
  current_row: number
  total_rows: number
  imported: number
  result?: string // JSON string; parsed lazily when needed
  error_count: number
  errors?: string // JSON string array
  failure_reason?: string
  started_at?: string
  finished_at?: string
}

interface AiBusinessSettings {
  enable_ai_hsn_search: boolean
  enable_ai_bill_parsing: boolean
  gemini_api_key: string
  [key: string]: unknown
}

interface DeveloperSettings {
  id: string
  user_id: string
  email_provider: string
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password?: string
  from_email: string
  from_name: string
  mailgun_domain: string
  whatsapp_provider: string
  whatsapp_api_key?: string
  whatsapp_phone_number_id: string
  whatsapp_business_account_id: string
  twilio_account_sid: string
  twilio_auth_token?: string
  twilio_phone_number: string
  sms_provider: string
  twilio_sms_account_sid: string
  twilio_sms_auth_token?: string
  twilio_sms_phone_number: string
  msg91_sender_id: string
  msg91_auth_key?: string
  textlocal_sender_id: string
  textlocal_api_key?: string
  aws_access_key: string
  aws_secret_key?: string
  aws_region: string
  sendgrid_sms_api_key?: string
  timezone: string
}

// GET/PUT /api/v1/developer-settings/db-maintenance payload shape.
interface DBMaintenanceSettings {
  id: string
  is_enabled: boolean
  run_time: string
  vacuum_full: boolean
  last_run_at?: string | null
  last_run_status?: string
  last_run_error?: string
  last_run_tables?: number
  last_run_duration_ms?: number
}

interface DBMaintenanceInfo {
  settings: DBMaintenanceSettings
  running: boolean
  ist_time: string
  ist_timezone: string
  next_run_at: string
}

export default function DeveloperSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { setPagesLocal, refresh: refreshPageFeatures } = usePageFeatures()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState<DeveloperSettings>({
    id: '',
    user_id: '',
    email_provider: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    from_email: '',
    from_name: '',
    mailgun_domain: '',
    whatsapp_provider: 'meta',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    twilio_account_sid: '',
    twilio_phone_number: '',
    sms_provider: 'twilio',
    twilio_sms_account_sid: '',
    twilio_sms_phone_number: '',
    msg91_sender_id: '',
    textlocal_sender_id: '',
    aws_access_key: '',
    aws_region: '',
    timezone: '',
  })
  const [pageFeatures, setPageFeatures] = useState<PageFeaturesMap>(defaultPageFeatures)
  const [aiSettings, setAiSettings] = useState<AiBusinessSettings>({
    enable_ai_hsn_search: false,
    enable_ai_bill_parsing: false,
    gemini_api_key: '',
  })
  const [dbMaint, setDbMaint] = useState<DBMaintenanceSettings>({
    id: '',
    is_enabled: false,
    run_time: '01:00',
    vacuum_full: false,
  })
  const [dbMaintInfo, setDbMaintInfo] = useState<DBMaintenanceInfo | null>(null)
  const [dbMaintBusy, setDbMaintBusy] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'email' | 'whatsapp' | 'sms' | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [serverTime, setServerTime] = useState<ServerTimeInfo | null>(null)

  useEffect(() => {
    if (!authLoading && user && isSuperAdmin(user.role)) {
      fetchSettings()
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [authLoading, user])

  // Poll server time so the user can see the detected server timezone and the
  // current time in their configured timezone (which the scheduler uses).
  useEffect(() => {
    if (!user || !isSuperAdmin(user.role)) return
    let active = true
    const fetchServerTime = async () => {
      try {
        const info = await getServerTime()
        if (active) setServerTime(info)
      } catch {
        // ignore — non-critical
      }
    }
    void fetchServerTime()
    const interval = setInterval(fetchServerTime, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user])

  const fetchSettings = async () => {
    try {
      const [settingsRes, pagesRes, businessRes, maintRes] = await Promise.all([
        apiFetch('/developer-settings'),
        apiFetch('/page-features'),
        apiFetch('/business'),
        apiFetch('/developer-settings/db-maintenance'),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(data)
      }
      if (pagesRes.ok) {
        const data = await pagesRes.json()
        setPageFeatures(mergePageFeatures(data.pages))
      }
      if (businessRes.ok) {
        const data = await businessRes.json()
        setAiSettings(data)
      }
      if (maintRes.ok) {
        const data: DBMaintenanceInfo = await maintRes.json()
        setDbMaintInfo(data)
        if (data.settings) setDbMaint(data.settings)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeTab === 'pages') {
        const res = await apiFetch('/page-features', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pages: pageFeatures }),
        })
        if (res.ok) {
          const data = await res.json()
          const merged = mergePageFeatures(data.pages)
          setPageFeatures(merged)
          setPagesLocal(merged)
          await refreshPageFeatures()
          notifySuccess('Page features saved successfully')
        } else {
          notifyError('Failed to save page features')
        }
      } else if (activeTab === 'ai') {
        const res = await apiFetch('/business', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSettings),
        })
        if (res.ok) {
          notifySuccess('AI settings saved successfully')
        } else {
          notifyError('Failed to save AI settings')
        }
      } else if (activeTab === 'maintenance') {
        const res = await apiFetch('/developer-settings/db-maintenance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_enabled: dbMaint.is_enabled,
            run_time: dbMaint.run_time,
            vacuum_full: dbMaint.vacuum_full,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setDbMaint(data)
          notifySuccess('Maintenance settings saved successfully')
        } else {
          const data = await res.json().catch(() => ({}))
          notifyError(data.error || 'Failed to save maintenance settings')
        }
      } else {
        const res = await apiFetch('/developer-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        })
        if (res.ok) {
          notifySuccess('Settings saved successfully')
        } else {
          const data = await res.json().catch(() => ({}))
          notifyError(data.error || 'Failed to save settings')
        }
      }
    } catch (err) {
      console.error(err)
      notifyError(
        activeTab === 'pages'
          ? 'Failed to save page features'
          : activeTab === 'ai'
            ? 'Failed to save AI settings'
            : 'Failed to save settings'
      )
    } finally {
      setSaving(false)
    }
  }

  const setAllPages = (enabled: boolean) => {
    setPageFeatures((prev) =>
      Object.fromEntries(Object.keys(prev).map((key) => [key, enabled]))
    )
  }

  const testEmailConnection = async () => {
    setTesting('email')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_provider: settings.email_provider,
          smtp_host: settings.smtp_host,
          smtp_port: settings.smtp_port,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password,
          from_email: settings.from_email,
          from_name: settings.from_name,
        }),
      })
      const data = await res.json()
      setTestResult({
        success: res.ok,
        message: data.message || data.error || (res.ok ? 'Email connection successful' : 'Email connection failed'),
      })
    } catch (err) {
      setTestResult({ success: false, message: 'Email connection failed' })
    } finally {
      setTesting(null)
    }
  }

  const testWhatsAppConnection = async () => {
    setTesting('whatsapp')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setTestResult({ success: res.ok, message: data.message || (res.ok ? 'WhatsApp connection successful' : 'WhatsApp connection failed') })
    } catch (err) {
      setTestResult({ success: false, message: 'WhatsApp connection failed' })
    } finally {
      setTesting(null)
    }
  }

  const testSMSConnection = async () => {
    setTesting('sms')
    setTestResult(null)
    try {
      const res = await apiFetch('/developer-settings/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      setTestResult({ success: res.ok, message: data.message || (res.ok ? 'SMS connection successful' : 'SMS connection failed') })
    } catch (err) {
      setTestResult({ success: false, message: 'SMS connection failed' })
    } finally {
      setTesting(null)
    }
  }

  // Triggers a manual maintenance run on the backend, then polls the settings
  // endpoint until the run finishes so the status card stays up to date.
  const runMaintenanceNow = async () => {
    setDbMaintBusy(true)
    try {
      const res = await apiFetch('/developer-settings/db-maintenance/run-now', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to start maintenance run')
        return
      }
      notifySuccess('Maintenance run started')
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const infoRes = await apiFetch('/developer-settings/db-maintenance')
        if (!infoRes.ok) break
        const info: DBMaintenanceInfo = await infoRes.json()
        setDbMaintInfo(info)
        if (info.settings) setDbMaint(info.settings)
        if (!info.running) break
      }
    } catch {
      notifyError('Failed to start maintenance run')
    } finally {
      setDbMaintBusy(false)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!user || !isSuperAdmin(user.role)) {
    return (
      <DashboardLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only Super Admins can access Developer Settings.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="app-page-subheader">
          <div>
            <h1 className="app-page-title">Developer Settings</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {activeTab === 'pages'
              ? 'Save Page Features'
              : activeTab === 'ai'
                ? 'Save AI Settings'
                : 'Save Settings'}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 p-4 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {testResult.message}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Features
            </TabsTrigger>
            <TabsTrigger value="migration" className="flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4" />
              Migration
            </TabsTrigger>
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Pages & Menus
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Maintenance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timezone
                </CardTitle>
                <CardDescription>
                  Set the timezone used by all scheduled automations (e.g. the
                  daily report email send time). The server runs in UTC; this
                  setting converts the server clock to your local timezone so
                  scheduled times fire when you expect.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Configured timezone</Label>
                    <Select
                      value={settings.timezone ? settings.timezone : '__server__'}
                      onValueChange={(value) =>
                        setSettings({ ...settings, timezone: value === '__server__' ? '' : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Use server timezone (UTC)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__server__">
                          Use server timezone ({serverTime?.timezone_name || 'UTC'})
                        </SelectItem>
                        {(serverTime?.common_timezones || []).map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                        {settings.timezone &&
                          !(serverTime?.common_timezones || []).includes(settings.timezone) && (
                            <SelectItem value={settings.timezone}>{settings.timezone}</SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Choose an IANA timezone (e.g. Asia/Kolkata). Leave blank to use the
                      server&apos;s timezone.
                    </p>
                  </div>
                  <div className="space-y-1.5 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium text-gray-800">Server time:</span>{' '}
                      {serverTime ? (
                        <span>
                          {serverTime.server_time} ({serverTime.timezone_name})
                          {serverTime.utc_offset_hours !== 0 && (
                            <span className="text-gray-500">
                              {' '}· UTC{serverTime.utc_offset_hours > 0 ? '+' : ''}
                              {serverTime.utc_offset_hours}h
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">Loading…</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">Scheduler time:</span>{' '}
                      {serverTime ? (
                        <span>
                          {serverTime.configured_time} ({serverTime.configured_timezone_name || serverTime.configured_timezone || 'server-default'})
                          {serverTime.configured_utc_offset_hours !== 0 && (
                            <span className="text-gray-500">
                              {' '}· UTC{serverTime.configured_utc_offset_hours > 0 ? '+' : ''}
                              {serverTime.configured_utc_offset_hours}h
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">Loading…</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">Status:</span>{' '}
                      {serverTime?.has_configured_timezone ? (
                        <span className="text-green-700">Using configured timezone</span>
                      ) : (
                        <span className="text-amber-700">
                          No timezone configured — using server timezone. Set one above so the
                          daily report scheduler fires at your local time.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select
                      value={settings.email_provider}
                      onValueChange={(value) => setSettings({ ...settings, email_provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {settings.email_provider === 'smtp' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Host</Label>
                        <Input
                          value={settings.smtp_host}
                          onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Port</Label>
                        <Input
                          type="number"
                          value={settings.smtp_port}
                          onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Username</Label>
                        <Input
                          value={settings.smtp_username}
                          onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Password</Label>
                        <Input
                          type="password"
                          onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {settings.email_provider === 'mailgun' && (
                  <div className="space-y-2">
                    <Label>Mailgun Domain</Label>
                    <Input
                      value={settings.mailgun_domain}
                      onChange={(e) => setSettings({ ...settings, mailgun_domain: e.target.value })}
                      placeholder="mg.yourdomain.com"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input
                      value={settings.from_email}
                      onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
                      placeholder="noreply@yourdomain.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input
                      value={settings.from_name}
                      onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
                      placeholder="Your Business Name"
                    />
                  </div>
                </div>

                <Button onClick={testEmailConnection} disabled={testing === 'email'} variant="outline">
                  {testing === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test Email Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  WhatsApp Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>WhatsApp Provider</Label>
                  <Select
                    value={settings.whatsapp_provider}
                    onValueChange={(value) => setSettings({ ...settings, whatsapp_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">Meta (WhatsApp Business API)</SelectItem>
                      <SelectItem value="twilio">Twilio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.whatsapp_provider === 'meta' && (
                  <>
                    <div className="space-y-2">
                      <Label>WhatsApp API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, whatsapp_api_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input
                        value={settings.whatsapp_phone_number_id}
                        onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Account ID</Label>
                      <Input
                        value={settings.whatsapp_business_account_id}
                        onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.whatsapp_provider === 'twilio' && (
                  <>
                    <div className="space-y-2">
                      <Label>Twilio Account SID</Label>
                      <Input
                        value={settings.twilio_account_sid}
                        onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Phone Number</Label>
                      <Input
                        value={settings.twilio_phone_number}
                        onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button onClick={testWhatsAppConnection} disabled={testing === 'whatsapp'} variant="outline">
                  {testing === 'whatsapp' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test WhatsApp Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  SMS Service Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SMS Provider</Label>
                  <Select
                    value={settings.sms_provider}
                    onValueChange={(value) => setSettings({ ...settings, sms_provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="msg91">Msg91</SelectItem>
                      <SelectItem value="textlocal">TextLocal</SelectItem>
                      <SelectItem value="aws_sns">AWS SNS</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.sms_provider === 'twilio' && (
                  <>
                    <div className="space-y-2">
                      <Label>Twilio Account SID</Label>
                      <Input
                        value={settings.twilio_sms_account_sid}
                        onChange={(e) => setSettings({ ...settings, twilio_sms_account_sid: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Auth Token</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, twilio_sms_auth_token: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Twilio Phone Number</Label>
                      <Input
                        value={settings.twilio_sms_phone_number}
                        onChange={(e) => setSettings({ ...settings, twilio_sms_phone_number: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'msg91' && (
                  <>
                    <div className="space-y-2">
                      <Label>Msg91 Auth Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, msg91_auth_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Msg91 Sender ID</Label>
                      <Input
                        value={settings.msg91_sender_id}
                        onChange={(e) => setSettings({ ...settings, msg91_sender_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'textlocal' && (
                  <>
                    <div className="space-y-2">
                      <Label>TextLocal API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, textlocal_api_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TextLocal Sender ID</Label>
                      <Input
                        value={settings.textlocal_sender_id}
                        onChange={(e) => setSettings({ ...settings, textlocal_sender_id: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'aws_sns' && (
                  <>
                    <div className="space-y-2">
                      <Label>AWS Access Key</Label>
                      <Input
                        value={settings.aws_access_key}
                        onChange={(e) => setSettings({ ...settings, aws_access_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AWS Secret Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, aws_secret_key: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>AWS Region</Label>
                      <Input
                        value={settings.aws_region}
                        onChange={(e) => setSettings({ ...settings, aws_region: e.target.value })}
                        placeholder="us-east-1"
                      />
                    </div>
                  </>
                )}

                {settings.sms_provider === 'sendgrid' && (
                  <>
                    <div className="space-y-2">
                      <Label>SendGrid SMS API Key</Label>
                      <Input
                        type="password"
                        onChange={(e) => setSettings({ ...settings, sendgrid_sms_api_key: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button onClick={testSMSConnection} disabled={testing === 'sms'} variant="outline">
                  {testing === 'sms' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test SMS Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Features
                </CardTitle>
                <CardDescription>
                  Configure Gemini-powered HSN search and purchase bill parsing for this business.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_ai_hsn_search"
                      checked={!!aiSettings.enable_ai_hsn_search}
                      onCheckedChange={(checked) =>
                        setAiSettings((prev) => ({ ...prev, enable_ai_hsn_search: !!checked }))
                      }
                    />
                    <Label htmlFor="enable_ai_hsn_search">Enable AI-powered HSN code search using Gemini</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, you can use AI to find HSN codes based on product descriptions
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_ai_bill_parsing"
                      checked={!!aiSettings.enable_ai_bill_parsing}
                      onCheckedChange={(checked) =>
                        setAiSettings((prev) => ({ ...prev, enable_ai_bill_parsing: !!checked }))
                      }
                    />
                    <Label htmlFor="enable_ai_bill_parsing">Enable AI-powered purchase bill parsing using Gemini</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    When enabled, you can upload bill images and AI will extract vendor details, items, and amounts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gemini_api_key">Gemini API Key</Label>
                  <Input
                    id="gemini_api_key"
                    type="password"
                    value={String(aiSettings.gemini_api_key || '')}
                    onChange={(e) =>
                      setAiSettings((prev) => ({ ...prev, gemini_api_key: e.target.value }))
                    }
                    placeholder="Enter your Gemini API key"
                    disabled={!aiSettings.enable_ai_hsn_search && !aiSettings.enable_ai_bill_parsing}
                  />
                  <p className="text-xs text-gray-500">
                    Get your API key from{' '}
                    <a
                      href="https://makersuite.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="migration">
            <MigrationTab />
          </TabsContent>

          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  Pages & Menus
                </CardTitle>
                <CardDescription>
                  Disable a page to hide it from the side menu. Opening a disabled URL still shows a Coming Soon screen. Dashboard, core Settings tabs, and Developer Settings stay available. Settings &gt; Reminders and Settings &gt; CA Share can be enabled or disabled below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPages(true)}>
                    Enable all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAllPages(false)}>
                    Disable all
                  </Button>
                </div>

                {groupToggleablePages().map(({ group, pages }) => (
                  <div key={group} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{group}</h3>
                    <div className="divide-y rounded-lg border">
                      {pages.map((page) => (
                        <div key={page.key} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{page.label}</p>
                            <p className="text-xs text-gray-500">{page.key}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {pageFeatures[page.key] !== false ? 'Enabled' : 'Disabled'}
                            </span>
                            <Switch
                              checked={pageFeatures[page.key] !== false}
                              onCheckedChange={(checked) =>
                                setPageFeatures((prev) => ({ ...prev, [page.key]: checked }))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Maintenance
                </CardTitle>
                <CardDescription>
                  Nightly cleanup that removes dead tuples and prevents table
                  bloat (VACUUM ANALYZE on PostgreSQL, VACUUM + ANALYZE on
                  SQLite). Runs daily at the configured time in IST
                  (Asia/Kolkata).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Nightly database maintenance</p>
                    <p className="text-xs text-gray-500">
                      Vacuum and analyze all tables every day at the configured time.
                    </p>
                  </div>
                  <Switch
                    checked={dbMaint.is_enabled}
                    onCheckedChange={(checked) => setDbMaint({ ...dbMaint, is_enabled: checked })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Run time (IST)</Label>
                    <Input
                      type="time"
                      value={dbMaint.run_time}
                      onChange={(e) => setDbMaint({ ...dbMaint, run_time: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">
                      Interpreted in Asia/Kolkata — default 01:00.
                    </p>
                  </div>
                  <div className="flex items-start gap-2 self-center">
                    <Checkbox
                      id="vacuum-full"
                      checked={dbMaint.vacuum_full}
                      onCheckedChange={(checked) =>
                        setDbMaint({ ...dbMaint, vacuum_full: checked === true })
                      }
                    />
                    <Label htmlFor="vacuum-full" className="text-sm font-normal">
                      Full vacuum (VACUUM FULL) — rewrites tables to reclaim disk space,
                      but takes an exclusive lock per table. Keep off unless bloat is severe.
                    </Label>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-md border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium text-gray-800">IST time:</span>{' '}
                    {dbMaintInfo?.ist_time || '—'} ({dbMaintInfo?.ist_timezone || 'Asia/Kolkata'})
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Next run:</span>{' '}
                    {dbMaintInfo?.next_run_at
                      ? new Date(dbMaintInfo.next_run_at).toLocaleString()
                      : '—'}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Last run:</span>{' '}
                    {dbMaint.last_run_at ? (
                      <span>
                        {new Date(dbMaint.last_run_at).toLocaleString()} —{' '}
                        {dbMaint.last_run_status || 'unknown'}
                        {dbMaint.last_run_tables ? ` · ${dbMaint.last_run_tables} tables` : ''}
                        {dbMaint.last_run_duration_ms
                          ? ` · ${(dbMaint.last_run_duration_ms / 1000).toFixed(1)}s`
                          : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </div>
                  {dbMaint.last_run_error && (
                    <div className="text-red-600">Error: {dbMaint.last_run_error}</div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runMaintenanceNow}
                    disabled={dbMaintBusy || dbMaintInfo?.running}
                  >
                    {(dbMaintBusy || dbMaintInfo?.running) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Run now
                  </Button>
                  <span className="text-xs text-gray-500">
                    Runs the cleanup immediately in the background.
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

// -----------------------------------------------------------------------------
// Data Migration tab
//
// Renders the myBillBook ZIP orchestrator and the per-entity CSV importers.
// Mirrors the previous standalone /migration page; all importers are super
// admin gated by the route group and idempotent (skip duplicates by name or
// bill number).
// -----------------------------------------------------------------------------
function MigrationTab() {
  const { stores, activeStore } = useStore()
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [snapshotHtml, setSnapshotHtml] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<MigrationJob | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Default to the active store once stores have loaded.
  useEffect(() => {
    if (!selectedStoreId && activeStore?.id) {
      setSelectedStoreId(activeStore.id)
    }
  }, [selectedStoreId, activeStore?.id])

  // Headers that scope the import request to the selected store. When a store
  // is selected, this overrides the global X-Store-ID for migration requests
  // only (the rest of the app keeps using the active store).
  const storeHeaders: Record<string, string> = selectedStoreId
    ? { 'X-Store-ID': selectedStoreId }
    : {}

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setZipFile(f ?? null)
    setResult(null)
    setError(null)
  }

  const handleRun = async () => {
    if (!zipFile) {
      notifyError('Please select a myBillBook ZIP export first')
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    setJob(null)
    try {
      const form = new FormData()
      form.append('file', zipFile)
      form.append('kind', 'mybillbook')
      if (snapshotHtml) form.append('snapshot_html', 'true')
      // Enqueue the async job and poll for per-row progress.
      const enqueueRes = await apiFetch('/migration/jobs', {
        method: 'POST',
        headers: storeHeaders,
        body: form,
        timeoutMs: 2 * 60 * 1000,
      })
      if (!enqueueRes.ok) {
        const err = await enqueueRes.json().catch(() => ({}))
        throw new Error(err.error || 'Migration failed to start')
      }
      const enqueued = (await enqueueRes.json()) as { job_id: string }
      await pollZipJob(enqueued.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
      notifyError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setRunning(false)
    }
  }

  // pollZipJob polls the migration job status and updates the progress bar.
  // On completion it parses the steps summary from the result payload.
  const pollZipJob = async (jobID: string) => {
    const pollIntervalMs = 1000
    const maxAttempts = 60 * 60 // ~1 hour at 1s cadence (ZIP can be large)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await apiFetch(`/migration/jobs/${jobID}`, {
        method: 'GET',
        headers: storeHeaders,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'failed to fetch migration job status')
      }
      const j = (await res.json()) as MigrationJob
      setJob(j)
      if (j.status === 'completed' || j.status === 'failed') {
        if (j.status === 'failed') {
          throw new Error(j.failure_reason || 'Migration failed')
        }
        let parsed: MigrationResult | null = null
        if (j.result) {
          try {
            const r = JSON.parse(j.result) as { steps?: unknown }
            if (Array.isArray(r.steps)) {
              parsed = { steps: r.steps as MigrationStep[] }
            }
          } catch {
            // fall through to empty result
          }
        }
        setResult(parsed ?? { steps: [] })
        const totalImported = (parsed?.steps || []).reduce((s, st) => s + st.imported, 0)
        notifySuccess(`Migration complete — ${totalImported} record${totalImported === 1 ? '' : 's'} imported`)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
    throw new Error('Migration timed out waiting for completion')
  }

  const totalImported = result?.steps.reduce((s, st) => s + st.imported, 0) ?? 0
  const totalErrors = result?.steps.reduce((s, st) => s + st.errors.length, 0) ?? 0

  return (
    <div className="space-y-4">
      {/* Store selector — all imports below go into the selected store. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Target store
          </CardTitle>
          <CardDescription>
            All imports below — the ZIP orchestrator and every per-entity
            importer — will store data in the store selected here. This is
            independent of the store switcher in the header, so you can import
            into a specific store without changing your current view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="migration-store">Import into store</Label>
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
              disabled={stores.length === 0}
            >
              <SelectTrigger id="migration-store" className="w-full sm:w-80">
                <SelectValue placeholder="Select a store…" />
              </SelectTrigger>
              <SelectContent>
                {stores
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {stores.length === 0 && (
              <p className="text-xs text-amber-600">
                No stores available. Create a store first under Security →
                Stores.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" /> myBillBook ZIP import
          </CardTitle>
          <CardDescription>
            Upload the ZIP of myBillBook report CSVs and the migration
            orchestrator will run a phased import (parties, purchase bills,
            payments, expenses) with row-level error reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip-file">myBillBook export ZIP</Label>
            <div className="flex items-center gap-3">
              <Input
                id="zip-file"
                ref={inputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                disabled={running}
              />
              {zipFile && (
                <span className="whitespace-nowrap text-sm text-gray-500">
                  {zipFile.name} ({(zipFile.size / 1024).toFixed(0)} KB)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              The ZIP should contain the myBillBook report CSVs
              (all_party_balance_*.csv, purchase_summary_report_*.csv,
              cash_and_bank_statement_*.csv, expense_transactions_*.csv).
              File matching is by name substring, so the date suffix does not
              matter.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={snapshotHtml}
              onChange={(e) => setSnapshotHtml(e.target.checked)}
              disabled={running}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>
              Snapshot purchase source pages as HTML during import
              (recommended — preserves the original source document even if
              the myBillBook link later disappears)
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleRun()} disabled={running || !zipFile}>
              {running ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {running ? 'Running migration…' : 'Run migration'}
            </Button>
            {zipFile && !running && (
              <Button
                variant="outline"
                onClick={() => {
                  setZipFile(null)
                  setResult(null)
                  setError(null)
                  setJob(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {running && job && (
            <MigrationJobProgress job={job} />
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" /> Migration results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="rounded-md bg-green-50 px-3 py-2">
                <span className="font-medium text-green-700">{totalImported}</span>
                <span className="ml-1 text-green-600">records imported</span>
              </div>
              <div className="rounded-md bg-amber-50 px-3 py-2">
                <span className="font-medium text-amber-700">{totalErrors}</span>
                <span className="ml-1 text-amber-600">row warnings/errors</span>
              </div>
            </div>

            <div className="space-y-3">
              {result.steps.map((step) => (
                <div key={step.step} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">
                      {step.step.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {step.imported} imported
                      {step.errors.length > 0 && (
                        <span className="ml-2 text-amber-600">
                          · {step.errors.length} error{step.errors.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                  </div>
                  {step.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-500">
                        Show row errors
                      </summary>
                      <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-amber-700">
                        {step.errors.map((e, i) => (
                          <li key={i} className="font-mono">{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400">
              Re-running the migration with the same ZIP is safe — already
              imported records (matched by party name or bill number) are
              skipped. Purchase bills imported from myBillBook keep their
              original source link on the purchase invoice page, where you can
              open or download the source document.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Import a single entity
          </CardTitle>
          <CardDescription>
            Import one entity at a time by uploading its CSV. Download the
            template for each entity to see the expected columns and a sample
            row. Each importer is idempotent — already imported records
            (matched by name, email, or bill number) are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {ENTITY_GROUPS.map((group) => (
            <div key={group} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {group}
              </h3>
              {ENTITY_IMPORTS.filter((cfg) => cfg.group === group).map((cfg) => (
                <EntityImportRow key={cfg.key} config={cfg} storeHeaders={storeHeaders} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Unique groups in display order.
const ENTITY_GROUPS = Array.from(new Set(ENTITY_IMPORTS.map((e) => e.group)))

// downloadCSVTemplate triggers a browser download of the template content as
// a .csv file.
function downloadCSVTemplate(config: EntityImportConfig) {
  const blob = new Blob([config.template], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${config.key}-template.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// -----------------------------------------------------------------------------
// Client-side CSV parse / serialize for the editable preview.
// -----------------------------------------------------------------------------
interface CSVPreviewData {
  headers: string[]
  rows: string[][]
}

// parseCSVText parses CSV content into headers + rows. Handles BOM, CRLF, and
// quoted fields with embedded commas and quotes (RFC 4180).
function parseCSVText(content: string): CSVPreviewData | null {
  // Strip BOM.
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
  // Normalize CRLF.
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field)
        field = ''
      } else if (ch === '\n') {
        row.push(field)
        lines.push(row)
        row = []
        field = ''
      } else {
        field += ch
      }
    }
  }
  // Last field/row.
  if (field !== '' || row.length > 0) {
    row.push(field)
    lines.push(row)
  }
  if (lines.length === 0) return null
  // Remove trailing empty lines.
  while (lines.length > 1 && lines[lines.length - 1].every((c) => c.trim() === '')) {
    lines.pop()
  }
  const headers = lines[0]
  const rows = lines.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  return { headers, rows }
}

// serializeCSV converts headers + rows back into CSV text (RFC 4180 quoting).
function serializeCSV(data: CSVPreviewData): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return '"' + v.replace(/"/g, '""') + '"'
    }
    return v
  }
  const lines = [data.headers.map(escape).join(','), ...data.rows.map((r) => r.map(escape).join(','))]
  return lines.join('\n')
}

// splitQuantityColumn transforms the preview data so that a column like
// "Stock Quantity" containing "33.0 PCS" is split into two columns: the
// original column keeps "33.0" and a new column (unitLabel) gets "PCS".
function splitQuantityColumn(data: CSVPreviewData, source: string, unitLabel: string): CSVPreviewData {
  const colIdx = data.headers.findIndex((h) => h.trim().toLowerCase() === source.trim().toLowerCase())
  if (colIdx === -1) return data
  const headers = [...data.headers.slice(0, colIdx + 1), unitLabel, ...data.headers.slice(colIdx + 1)]
  const rows = data.rows.map((r) => {
    const raw = (r[colIdx] ?? '').trim()
    const parts = raw.split(/\s+/)
    const value = parts[0] ?? ''
    const unit = parts.slice(1).join(' ')
    // Replace the original column with just the numeric value, then insert
    // the unit column right after it.
    const newRow = [...r]
    newRow[colIdx] = value
    return [...newRow.slice(0, colIdx + 1), unit, ...newRow.slice(colIdx + 1)]
  })
  return { headers, rows }
}

// headerMatchScore returns the fraction of an importer's template columns
// that appear in the uploaded header (case-insensitive). Used to warn when a
// file clearly belongs to a different importer — e.g. the myBillBook "Sales"
// summary export uploaded to "Sales invoice items".
function headerMatchScore(config: EntityImportConfig, uploaded: Set<string>): number {
  const cols = (parseCSVText(config.template)?.headers ?? [])
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (cols.length === 0) return 0
  return cols.filter((h) => uploaded.has(h)).length / cols.length
}

// mergeQuantityColumn reverses splitQuantityColumn: combines the numeric
// column and the unit column back into "value unit" format for the backend.
function mergeQuantityColumn(data: CSVPreviewData, source: string, unitLabel: string): CSVPreviewData {
  const colIdx = data.headers.findIndex((h) => h.trim().toLowerCase() === source.trim().toLowerCase())
  const unitIdx = data.headers.findIndex((h) => h.trim().toLowerCase() === unitLabel.trim().toLowerCase())
  if (colIdx === -1 || unitIdx === -1) return data
  const headers = data.headers.filter((_, i) => i !== unitIdx)
  const rows = data.rows.map((r) => {
    const value = (r[colIdx] ?? '').trim()
    const unit = (r[unitIdx] ?? '').trim()
    const merged = unit ? `${value} ${unit}` : value
    const newRow = [...r]
    newRow[colIdx] = merged
    return newRow.filter((_, i) => i !== unitIdx)
  })
  return { headers, rows }
}

// -----------------------------------------------------------------------------
// CSVPreview — editable table shown after a file is uploaded.
// -----------------------------------------------------------------------------
function CSVPreview({
  data,
  onChange,
  disabled,
}: {
  data: CSVPreviewData
  onChange: (data: CSVPreviewData) => void
  disabled?: boolean
}) {
  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const rows = data.rows.map((r, i) =>
      i === rowIdx ? r.map((c, j) => (j === colIdx ? value : c)) : r
    )
    onChange({ headers: data.headers, rows })
  }

  const addRow = () => {
    onChange({ headers: data.headers, rows: [...data.rows, data.headers.map(() => '')] })
  }

  const deleteRow = (rowIdx: number) => {
    onChange({ headers: data.headers, rows: data.rows.filter((_, i) => i !== rowIdx) })
  }

  return (
    <div className="mt-3 overflow-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left font-medium text-gray-500">#</th>
            {data.headers.map((h, i) => (
              <th key={i} className="px-2 py-1 text-left font-medium text-gray-600">
                {h}
              </th>
            ))}
            <th className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-t hover:bg-gray-50">
              <td className="px-2 py-1 text-gray-400">{rowIdx + 1}</td>
              {data.headers.map((_, colIdx) => (
                <td key={colIdx} className="px-1 py-0.5">
                  <input
                    type="text"
                    value={row[colIdx] ?? ''}
                    onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                    disabled={disabled}
                    className="w-full rounded border border-transparent px-1 py-0.5 text-xs hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                  />
                </td>
              ))}
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => deleteRow(rowIdx)}
                  disabled={disabled}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                  title="Delete row"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr>
              <td colSpan={data.headers.length + 2} className="px-2 py-3 text-center text-xs text-gray-400">
                No data rows. Click "Add row" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t bg-gray-50 px-2 py-1">
        <span className="text-xs text-gray-500">
          {data.rows.length} row{data.rows.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          + Add row
        </button>
      </div>
    </div>
  )
}

// MigrationJobProgress renders a per-row progress bar for an in-flight
// migration job. The total may be 0 (unknown) until the runner has parsed
// the file; in that case an indeterminate bar is shown.
function MigrationJobProgress({ job }: { job: MigrationJob }) {
  const total = job.total_rows > 0 ? job.total_rows : 0
  const current = job.current_row > 0 ? job.current_row : 0
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  const statusLabel =
    job.status === 'queued'
      ? 'Queued…'
      : job.status === 'running'
        ? job.step
          ? `Running: ${job.step} (${current}/${total || '…'})`
        : `Running (${current}/${total || '…'})`
      : job.status
  return (
    <div className="mt-2 rounded-md border bg-gray-50 p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {statusLabel}
        </span>
        <span>
          {job.imported} imported
          {job.error_count > 0 && (
            <span className="ml-2 text-amber-600">{job.error_count} error{job.error_count === 1 ? '' : 's'}</span>
          )}
        </span>
      </div>
      {total > 0 ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-2 w-1/3 animate-pulse rounded-full bg-blue-400" />
        </div>
      )}
    </div>
  )
}

function EntityImportRow({
  config,
  storeHeaders,
}: {
  config: EntityImportConfig
  storeHeaders: Record<string, string>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CSVPreviewData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [formatWarning, setFormatWarning] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<EntityImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<MigrationJob | null>(null)
  const [optionValues, setOptionValues] = useState<Record<string, string>>(() => {
    // Initialize from each option's defaultValue.
    const init: Record<string, string> = {}
    for (const opt of config.options ?? []) {
      if (opt.defaultValue) init[opt.formKey] = opt.defaultValue
    }
    return init
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setResult(null)
    setError(null)
    setParseError(null)
    setFormatWarning(null)
    if (!f) {
      setPreview(null)
      return
    }
    try {
      const text = await f.text()
      const parsed = parseCSVText(text)
      if (!parsed || parsed.headers.length === 0) {
        setParseError('Could not parse CSV — file appears to be empty or malformed')
        setPreview(null)
        return
      }
      // Warn when the columns clearly match a different importer's template.
      const uploaded = new Set(
        parsed.headers.map((h) => h.trim().toLowerCase()).filter(Boolean)
      )
      const ownScore = headerMatchScore(config, uploaded)
      let best: EntityImportConfig | null = null
      let bestScore = 0
      for (const other of ENTITY_IMPORTS) {
        if (other.key === config.key) continue
        const s = headerMatchScore(other, uploaded)
        if (s > bestScore) {
          bestScore = s
          best = other
        }
      }
      if (best && bestScore >= 0.6 && bestScore - ownScore >= 0.2) {
        setFormatWarning(
          `This file's columns look like "${best.label}". You can still import here, but that importer is probably the right one.`
        )
      }
      // If this entity has a splitColumn config (e.g. stock summary's
      // "Stock Quantity" → "Stock Quantity" + "Quantity Type"), apply it
      // so the preview shows the unit as a separate editable column.
      if (config.splitColumn) {
        setPreview(splitQuantityColumn(parsed, config.splitColumn.source, config.splitColumn.unitLabel))
      } else {
        setPreview(parsed)
      }
    } catch {
      setParseError('Failed to read file')
      setPreview(null)
    }
  }

  const handleImport = async (extraOptions?: Record<string, string>) => {
    if (!file) {
      notifyError(`Select a ${config.label} CSV to import`)
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    setJob(null)
    try {
      const form = new FormData()
      // If we have an edited preview, send the serialized CSV; otherwise send
      // the original file unchanged.
      if (preview) {
        // Merge split columns back before serializing so the backend
        // receives the original "value unit" format.
        const dataToSend = config.splitColumn
          ? mergeQuantityColumn(preview, config.splitColumn.source, config.splitColumn.unitLabel)
          : preview
        const editedCSV = serializeCSV(dataToSend)
        const blob = new Blob([editedCSV], { type: 'text/csv;charset=utf-8' })
        form.append('file', blob, file.name)
      } else {
        form.append('file', file)
      }
      // Append any option values that have been set.
      for (const [key, value] of Object.entries(optionValues)) {
        if (value !== '') form.append(key, value)
      }
      // Caller-supplied extras (e.g. import_unmatched=true when the user
      // confirms importing rows that matched no existing record).
      for (const [key, value] of Object.entries(extraOptions ?? {})) {
        form.append(key, value)
      }

      // Async path: enqueue a migration job and poll for per-row progress.
      if (config.kind) {
        form.append('kind', config.kind)
        const enqueueRes = await apiFetch('/migration/jobs', {
          method: 'POST',
          headers: storeHeaders,
          body: form,
          // Uploading large files can take a moment; the actual processing
          // happens in the background after this returns.
          timeoutMs: 2 * 60 * 1000,
        })
        if (!enqueueRes.ok) {
          const err = await enqueueRes.json().catch(() => ({}))
          throw new Error(err.error || `${config.label} import failed to start`)
        }
        const enqueued = (await enqueueRes.json()) as { job_id: string }
        await pollMigrationJob(enqueued.job_id)
        return
      }

      // Synchronous fallback (no kind configured).
      const res = await apiFetch(config.endpoint, {
        method: 'POST',
        headers: storeHeaders,
        body: form,
        // Imports can process thousands of rows (categories, products, stock,
        // invoices, …) and routinely exceed the default 8s request timeout.
        timeoutMs: 5 * 60 * 1000,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `${config.label} import failed`)
      }
      const data = (await res.json()) as EntityImportResult
      setResult(data)
      const n = data.imported ?? 0
      notifySuccess(`${config.label}: ${n} record${n === 1 ? '' : 's'} imported`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `${config.label} import failed`)
      notifyError(err instanceof Error ? err.message : `${config.label} import failed`)
    } finally {
      setRunning(false)
    }
  }

  // pollMigrationJob polls GET /migration/jobs/:id until the job reaches a
  // terminal state, updating the `job` state for the progress bar. On
  // completion it parses the result payload into the same EntityImportResult
  // shape used by the synchronous path so the rest of the UI is unchanged.
  const pollMigrationJob = async (jobID: string) => {
    const pollIntervalMs = 1000
    // Overall safety cap so a stuck job does not poll forever; the backend
    // marks the job failed on panic, but a process restart could leave a
    // queued/running job orphaned. After this many attempts the UI gives up
    // and surfaces the last known state.
    const maxAttempts = 60 * 30 // ~30 minutes at 1s cadence
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await apiFetch(`/migration/jobs/${jobID}`, {
        method: 'GET',
        headers: storeHeaders,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'failed to fetch migration job status')
      }
      const j = (await res.json()) as MigrationJob
      setJob(j)
      if (j.status === 'completed' || j.status === 'failed') {
        if (j.status === 'failed') {
          throw new Error(j.failure_reason || `${config.label} import failed`)
        }
        // Parse the result payload (JSON string) into EntityImportResult.
        let parsed: EntityImportResult | null = null
        if (j.result) {
          try {
            const r = JSON.parse(j.result) as Record<string, unknown>
            parsed = {
              imported: typeof r.imported === 'number' ? r.imported : j.imported,
              updated: typeof r.updated === 'number' ? r.updated : undefined,
              unmatched: Array.isArray(r.unmatched)
                ? (r.unmatched as UnmatchedRow[])
                : undefined,
              mismatches: Array.isArray(r.mismatches)
                ? (r.mismatches as StockMismatch[])
                : undefined,
              payment_in: typeof r.payment_in === 'number' ? r.payment_in : undefined,
              payment_out: typeof r.payment_out === 'number' ? r.payment_out : undefined,
              categories_created: typeof r.categories_created === 'number' ? r.categories_created : undefined,
              products_created: typeof r.products_created === 'number' ? r.products_created : undefined,
              stock_updated: typeof r.stock_updated === 'number' ? r.stock_updated : undefined,
              stock_created: typeof r.stock_created === 'number' ? r.stock_created : undefined,
              sales_invoices: typeof r.sales_invoices === 'number' ? r.sales_invoices : undefined,
              purchase_bills: typeof r.purchase_bills === 'number' ? r.purchase_bills : undefined,
              expenses: typeof r.expenses === 'number' ? r.expenses : undefined,
              cash_transactions: typeof r.cash_transactions === 'number' ? r.cash_transactions : undefined,
              skipped: typeof r.skipped === 'number' ? r.skipped : undefined,
              errors: parseJobErrors(j),
            }
          } catch {
            parsed = { imported: j.imported, errors: parseJobErrors(j) }
          }
        } else {
          parsed = { imported: j.imported, errors: parseJobErrors(j) }
        }
        setResult(parsed)
        const n = parsed.imported ?? 0
        notifySuccess(`${config.label}: ${n} record${n === 1 ? '' : 's'} imported`)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
    throw new Error(`${config.label} import timed out waiting for completion`)
  }

  // parseJobErrors decodes the JSON-encoded errors array on a MigrationJob.
  const parseJobErrors = (j: MigrationJob): string[] => {
    if (!j.errors) return []
    try {
      const arr = JSON.parse(j.errors) as unknown
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string')
    } catch {
      // ignore malformed payload
    }
    return []
  }

  const imported = result?.imported ?? 0
  const errCount = result?.errors?.length ?? 0
  const unmatchedRows = result?.unmatched ?? []
  const mismatchRows = result?.mismatches ?? []

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{config.label}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => downloadCSVTemplate(config)}
            >
              <FileDown className="mr-1 h-3.5 w-3.5" />
              Template
            </Button>
            {result && (
              <span className="text-sm text-gray-500">
                {imported} imported
                {typeof result.updated === 'number' && result.updated > 0 && (
                  <span className="ml-1 text-gray-400">
                    ({result.updated} link{result.updated === 1 ? '' : 's'} updated)
                  </span>
                )}
                {typeof result.payment_in === 'number' && typeof result.payment_out === 'number' && (
                  <span className="ml-1 text-gray-400">
                    (in {result.payment_in} / out {result.payment_out})
                  </span>
                )}
                {typeof result.categories_created === 'number' && typeof result.products_created === 'number' && (
                  <span className="ml-1 text-gray-400">
                    ({result.categories_created} categories, {result.products_created} products, {result.stock_updated ?? 0} stock)
                  </span>
                )}
                {typeof result.stock_updated === 'number' && typeof result.categories_created !== 'number' && (
                  <span className="ml-1 text-gray-400">
                    ({result.stock_updated} stock updated{typeof result.stock_created === 'number' && result.stock_created > 0 ? `, ${result.stock_created} created` : ''})
                  </span>
                )}
                {mismatchRows.length > 0 && (
                  <span className="ml-2 text-amber-600">
                    · {mismatchRows.length} stock mismatch{mismatchRows.length === 1 ? '' : 'es'}
                  </span>
                )}
                {typeof result.cash_transactions === 'number' && (
                  <span className="ml-1 text-gray-400">
                    ({[
                      typeof result.sales_invoices === 'number' && result.sales_invoices > 0 ? `${result.sales_invoices} sales` : null,
                      typeof result.purchase_bills === 'number' && result.purchase_bills > 0 ? `${result.purchase_bills} bills` : null,
                      typeof result.expenses === 'number' && result.expenses > 0 ? `${result.expenses} expenses` : null,
                      result.cash_transactions > 0 ? `${result.cash_transactions} cash txns` : null,
                      typeof result.skipped === 'number' && result.skipped > 0 ? `${result.skipped} skipped` : null,
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
                {typeof result.cash_transactions !== 'number' &&
                  typeof result.skipped === 'number' && result.skipped > 0 && (
                    <span className="ml-1 text-gray-400">
                      ({result.skipped} skipped)
                    </span>
                  )}
                {errCount > 0 && (
                  <span className="ml-2 text-amber-600">
                    · {errCount} error{errCount === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">{config.description}</p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={running}
          className="flex-1"
        />
        <Button onClick={() => void handleImport()} disabled={running || !file} size="sm">
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {running ? 'Importing…' : 'Import'}
        </Button>
        {file && !running && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFile(null)
              setPreview(null)
              setParseError(null)
              setFormatWarning(null)
              setResult(null)
              setError(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {running && job && (
        <MigrationJobProgress job={job} />
      )}

      {parseError && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {formatWarning && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{formatWarning}</span>
        </div>
      )}

      {preview && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              Preview — edit cells before importing
            </span>
          </div>
          <CSVPreview
            data={preview}
            onChange={setPreview}
            disabled={running}
          />
        </div>
      )}

      {config.options && config.options.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-gray-50 p-2">
          <span className="text-xs font-medium text-gray-500">Defaults</span>
          {config.options.map((opt) => (
            <div key={opt.formKey} className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">{opt.label}</Label>
              {opt.type === 'select' && opt.choices ? (
                <Select
                  value={optionValues[opt.formKey] ?? ''}
                  onValueChange={(v) =>
                    setOptionValues((prev) => ({ ...prev, [opt.formKey]: v }))
                  }
                  disabled={running}
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder={opt.placeholder ?? 'Select…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {opt.choices.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="text"
                  value={optionValues[opt.formKey] ?? ''}
                  placeholder={opt.placeholder}
                  onChange={(e) =>
                    setOptionValues((prev) => ({
                      ...prev,
                      [opt.formKey]: e.target.value,
                    }))
                  }
                  disabled={running}
                  className="h-8 w-40 text-xs"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && errCount > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-500">
            Show row errors
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-amber-700">
            {result.errors.map((e, i) => (
              <li key={i} className="font-mono">{e}</li>
            ))}
          </ul>
        </details>
      )}

      {result && mismatchRows.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-medium text-amber-800">
            {mismatchRows.length} stock mismatch{mismatchRows.length === 1 ? '' : 'es'} — CSV
            current stock differs from inventory (inventory left unchanged)
          </p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-amber-700">
            {mismatchRows.map((m, i) => (
              <li key={i} className="font-mono">
                Row {m.row} · {m.item_name} · {m.batch_no || '(no batch)'} — report{' '}
                {m.csv_stock}
                {m.unit ? ` ${m.unit}` : ''}, inventory {m.inventory_stock}
                {m.unit ? ` ${m.unit}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && unmatchedRows.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1 text-xs text-amber-800">
              <p className="font-medium">
                {unmatchedRows.length} row{unmatchedRows.length === 1 ? '' : 's'} did not
                match any existing record
              </p>
              <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto font-mono">
                {unmatchedRows.map((u) => (
                  <li key={u.row}>
                    #{u.ref}
                    {u.party_name ? ` · ${u.party_name}` : ''}
                    {u.amount ? ` · ${u.amount}` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={running}
                  onClick={() => void handleImport({ import_unmatched: 'true' })}
                >
                  {running ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-3.5 w-3.5" />
                  )}
                  Import {unmatchedRows.length} new record{unmatchedRows.length === 1 ? '' : 's'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={running}
                  onClick={() =>
                    setResult((r) => (r ? { ...r, unmatched: [] } : r))
                  }
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
