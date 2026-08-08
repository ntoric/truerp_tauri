'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import { Package, Plus, Search, Trash2, Download, Upload, Printer, Edit, MoreVertical, Eye, Power, Barcode, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { asArray, cn, skuFromProductName } from '@/lib/utils'
import { DEFAULT_CATEGORY_NAME, pickDefaultCategoryName } from '@/lib/defaultCategories'
import { notifyError, notifySuccess } from '@/lib/notify'
import { accountingExportDateStamp, downloadBlob, downloadCsv } from '@/lib/accountingExport'
import { isProductGstEnabled } from '@/lib/numbers'
import { runWithExportProgress } from '@/lib/exportProgress'
import ProductImageField from '@/components/ProductImageField'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import {
  BARCODE_LABEL_SIZE_OPTIONS,
  type BarcodeLabelSize,
} from '@/components/PrintSettingsCard'
import { printHtmlDocument } from '@/lib/printDocument'
import { printBarcodeLabels, type BarcodeLabelsPayload } from '@/lib/barcodeLabelPrint'
import { normalizeThermalPrintSize } from '@/lib/printSizes'
import {
  A4_LABEL_SHEET_PRESETS,
  layoutFromPresetKey,
  normalizeA4SheetPreset,
  stickerPositionToRowCol,
  type A4LabelSheetPresetKey,
} from '@/lib/a4LabelSheets'
import {
  WEIGHING_ITEM_CODE_MAX_LEN,
  isWeightBasedUnit,
  weighingItemCodeError,
} from '@/lib/weighingScale'

interface Category {
  id: string
  name: string
  description?: string
}

interface Product {
  id: string
  name: string
  sku: string
  item_code?: string
  category: string
  purchase_price: number
  sale_price: number
  mrp?: number
  unit?: string
  tax_rate: number
  gst_enabled: boolean
  discount: string
  is_service: boolean
  low_stock_alert: boolean
  min_stock: number
  hsn_code: string
  description: string
  enable_batching: boolean
  sale_price_with_tax: boolean
  purchase_price_with_tax: boolean
  image_url?: string
  is_active: boolean
}

const PRODUCT_IMPORT_HEADERS = [
  'Name',
  'SKU',
  'Item Code',
  'Category',
  'Unit',
  'HSN Code',
  'Purchase Price',
  'Sale Price',
  'MRP',
  'Tax Rate %',
  'Discount',
  'Min Stock',
  'Item Type',
  'Low Stock Alert',
  'Enable Batching',
  'Sale Price With Tax',
  'Purchase Price With Tax',
]

const PRODUCT_IMPORT_SAMPLE_ROW: (string | number)[] = [
  'Sample Product',
  'SKU001',
  'ITEM001',
  'General',
  'PCS',
  '8471',
  100,
  150,
  180,
  18,
  '5',
  10,
  'product',
  'true',
  'false',
  'true',
  'true',
]

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const {
    fieldErrors,
    clearErrors,
    clearFieldError,
    setError,
    handleApiError,
    validateRequired,
    showSuccessToast,
    showErrorToast,
  } = useFormErrors()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [createTab, setCreateTab] = useState('basic')
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printQuantity, setPrintQuantity] = useState(1)
  const [printLabelSize, setPrintLabelSize] = useState<BarcodeLabelSize>('2inch')
  const [printBarcodeMode, setPrintBarcodeMode] = useState<'label' | 'a4'>('a4')
  const [printSheetPreset, setPrintSheetPreset] = useState<A4LabelSheetPresetKey>('48.5x25.4')
  const [printStartPosition, setPrintStartPosition] = useState(1)
  const [printSheetColumns, setPrintSheetColumns] = useState(4)
  const [printSheetRows, setPrintSheetRows] = useState(11)
  const [printPreviewHtml, setPrintPreviewHtml] = useState('')
  const [printPreviewLoading, setPrintPreviewLoading] = useState(false)
  const printPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedProductForPrint, setSelectedProductForPrint] = useState<string | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)
  const [drafts, setDrafts] = useState<any[]>([])
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [hsnSearchResults, setHsnSearchResults] = useState<any[]>([])
  const [showHsnDropdown, setShowHsnDropdown] = useState(false)
  const [useAISearch, setUseAISearch] = useState(false)
  const [businessSettings, setBusinessSettings] = useState<any>(null)
  const [showHsnSearchModal, setShowHsnSearchModal] = useState(false)
  const [hsnSearchQuery, setHsnSearchQuery] = useState('')
  const [hsnSearchLoading, setHsnSearchLoading] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })
  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    item_code: '',
    category: DEFAULT_CATEGORY_NAME,
    unit: 'PCS',
    purchase_price: 0,
    sale_price: 0,
    mrp: 0,
    min_stock: 0,
    tax_rate: 0,
    gst_enabled: false,
    item_type: 'product',
    low_stock_alert: true,
    hsn_code: '',
    description: '',
    discount: '',
    enable_batching: false,
    sale_price_with_tax: true,
    purchase_price_with_tax: true,
    image_url: '',
  })
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const importFileRef = useRef<HTMLInputElement>(null)
  const skuManuallyEdited = useRef(false)

  useEffect(() => { if (!authLoading && user) fetchCategories() }, [authLoading, user])
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true)
      router.replace('/products', { scroll: false })
    }
  }, [searchParams, router])
  useEffect(() => { if (!authLoading && user) fetchBusinessSettings() }, [authLoading, user])
  useEffect(() => { if (!authLoading && user) fetchProducts() }, [authLoading, user, selectedCategory, searchQuery])

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(products)

  useEffect(() => {
    resetPage()
  }, [selectedCategory, searchQuery])
  useEffect(() => { if (showDraftsModal && user) fetchDrafts() }, [showDraftsModal, user])
  useEffect(() => { if (!authLoading && user) fetchInventoryItems() }, [authLoading, user])

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories')
      if (res.ok) {
        const data = asArray(await res.json())
        setCategories(data)
        const defaultName = pickDefaultCategoryName(data)
        setNewItem((prev) =>
          !prev.category || prev.category === DEFAULT_CATEGORY_NAME
            ? { ...prev, category: defaultName }
            : prev
        )
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchBusinessSettings = async () => {
    try {
      const res = await apiFetch('/business')
      if (res.ok) {
        const data = await res.json()
        setBusinessSettings(data)
        setUseAISearch(data.enable_ai_hsn_search || false)
      }
    } catch (err) { console.error(err) }
  }

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      showErrorToast('Category name is required')
      return
    }
    setCreatingCategory(true)
    try {
      const res = await apiFetch('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategory.name.trim(),
          description: newCategory.description.trim(),
          is_active: true,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        updateNewItem({ category: created.name }, 'category')
        setNewCategory({ name: '', description: '' })
        setShowAddCategoryModal(false)
        showSuccessToast('Category created')
      } else {
        const err = await res.json().catch(() => ({}))
        showErrorToast(err.error || 'Failed to create category')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
  }

  const fetchInventoryItems = async () => {
    try {
      const res = await apiFetch('/inventory/items')
      if (res.ok) {
        setInventoryItems(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
  }

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory)
      if (searchQuery) params.append('search', searchQuery)
      const res = await apiFetch(`/products?${params.toString()}`)
      if (res.ok) {
        setProducts(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
  }

  const fetchDrafts = async () => {
    try {
      setLoadingDraft(true)
      const res = await apiFetch('/drafts?entity_type=product')
      if (res.ok) {
        setDrafts(asArray(await res.json()))
      }
    } catch (err) { console.error(err) }
    finally { setLoadingDraft(false) }
  }

  const handleSaveDraft = async () => {
    try {
      const title = newItem.name || 'Untitled Product'
      const res = await apiFetch('/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'product',
          title: title,
          data: JSON.stringify(newItem)
        })
      })
      if (res.ok) {
        notifySuccess('Draft saved successfully')
      }
    } catch (err) { console.error(err) }
  }

  const handleLoadDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(`/drafts/${draftId}`)
      if (res.ok) {
        const d = await res.json()
        const draftData = JSON.parse(d.data)
        const { inventory, ...rest } = draftData
        skuManuallyEdited.current = Boolean(draftData?.sku?.trim())
        setNewItem({
          ...emptyProductForm,
          ...rest,
          item_code: rest.item_code ?? inventory?.item_code ?? '',
        })
        setShowDraftsModal(false)
        setShowCreateModal(true)
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!(await confirm({
      title: 'Delete draft?',
      description: 'Are you sure you want to delete this draft? This action cannot be undone.',
    }))) return
    try {
      await apiFetch(`/drafts/${draftId}`, { method: 'DELETE' })
      fetchDrafts()
    } catch (err) { console.error(err) }
  }

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedItems.size === products.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(products.map(p => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    if (!(await confirm({
      title: 'Delete products?',
      description: `Are you sure you want to delete ${selectedItems.size} selected items? This action cannot be undone.`,
    }))) return
    try {
      await Promise.all(
        Array.from(selectedItems).map(id => apiFetch(`/products/${id}`, { method: 'DELETE' }))
      )
      setSelectedItems(new Set())
      fetchProducts()
    } catch (err) { console.error(err) }
  }

  const handleHsnSearch = async (search: string) => {
    if (search.length < 2) {
      setHsnSearchResults([])
      return
    }
    setHsnSearchLoading(true)
    try {
      const res = await apiFetch(`/gst/hsn-search?search=${search}&use_ai=true`)
      if (res.ok) {
        const data = await res.json()
        setHsnSearchResults(data.slice(0, 10))
      }
    } catch (error) {
      console.error('Failed to search HSN codes:', error)
    } finally {
      setHsnSearchLoading(false)
    }
  }

  const handleSelectHsn = (hsn: any) => {
    const patch: Partial<typeof newItem> = { hsn_code: hsn.code }
    if (newItem.gst_enabled) {
      patch.tax_rate = hsn.cgst_rate + hsn.sgst_rate
    }
    setNewItem({ ...newItem, ...patch })
    setShowHsnSearchModal(false)
    setHsnSearchResults([])
    setHsnSearchQuery('')
  }

  const handleGstEnabledChange = (enabled: boolean) => {
    updateNewItem({
      gst_enabled: enabled,
      tax_rate: enabled ? (newItem.tax_rate > 0 ? newItem.tax_rate : 0) : 0,
    })
  }

  const handleExportCSV = async () => {
    try {
      await runWithExportProgress('Exporting products CSV', async (update) => {
        update(10, 'Fetching products…')
        const params = new URLSearchParams()
        if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory)
        if (searchQuery) params.append('search', searchQuery)
        const res = await apiFetch(`/products/export/csv?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Failed to export products CSV')
        }
        update(45, 'Receiving file…')
        const blob = await res.blob()
        update(75, 'Saving…')
        await downloadBlob(`products_${accountingExportDateStamp()}.csv`, blob, {
          skipProgress: true,
        })
        update(100, 'Saved')
      })
      notifySuccess('Products CSV exported')
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Failed to export products CSV')
    }
  }

  const handleExportExcel = async () => {
    try {
      await runWithExportProgress('Exporting products Excel', async (update) => {
        update(10, 'Fetching products…')
        const params = new URLSearchParams()
        if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory)
        if (searchQuery) params.append('search', searchQuery)
        const res = await apiFetch(`/products/export/excel?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Failed to export products Excel')
        }
        update(45, 'Receiving file…')
        const blob = await res.blob()
        update(75, 'Saving…')
        await downloadBlob(`products_${accountingExportDateStamp()}.xlsx`, blob, {
          skipProgress: true,
        })
        update(100, 'Saved')
      })
      notifySuccess('Products Excel exported')
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error ? err.message : 'Failed to export products Excel')
    }
  }

  const handleDownloadImportTemplate = () => {
    void downloadCsv(`products_import_template_${accountingExportDateStamp()}.csv`, [
      PRODUCT_IMPORT_HEADERS,
      PRODUCT_IMPORT_SAMPLE_ROW,
    ], { label: 'Exporting import template' })
  }

  const resetImportDialog = () => {
    setImportFile(null)
    setImportedCount(null)
    setImportErrors([])
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const handleImportDialogChange = (open: boolean) => {
    setShowImportDialog(open)
    if (!open) resetImportDialog()
  }

  const handleImportProducts = async () => {
    if (!importFile) {
      notifyError('Please select a CSV or Excel file to import')
      return
    }

    setImporting(true)
    setImportedCount(null)
    setImportErrors([])

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const fileName = importFile.name.toLowerCase()
      const endpoint = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
        ? '/products/import/excel'
        : '/products/import/csv'

      const res = await apiFetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        const count = data.imported ?? 0
        const errors: string[] = data.errors ?? []
        setImportedCount(count)
        setImportErrors(errors)

        if (count > 0) {
          fetchProducts()
          notifySuccess(`Successfully imported ${count} product${count === 1 ? '' : 's'}`)
        }

        if (count === 0 && errors.length > 0) {
          notifyError('No products were imported. Please review the errors below.')
        } else if (errors.length > 0) {
          notifyError(`${errors.length} row${errors.length === 1 ? '' : 's'} could not be imported`)
        }
      } else {
        notifyError(data.error || 'Import failed')
      }
    } catch (err) {
      console.error(err)
      notifyError('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handlePrintLabel = async (productId: string) => {
    setSelectedProductForPrint(productId)
    setPrintQuantity(1)
    setPrintStartPosition(1)
    try {
      const res = await apiFetch('/settings/print')
      if (res.ok) {
        const data = await res.json()
        const size = data.barcode_label_size
        if (size === '1inch' || size === '1.5inch' || size === '2inch' || size === '3inch') {
          setPrintLabelSize(size)
        }
        setPrintBarcodeMode(data.barcode_print_mode === 'label' ? 'label' : 'a4')
        const preset = normalizeA4SheetPreset(data.label_sheet_preset)
        setPrintSheetPreset(preset)
        const layout = layoutFromPresetKey(preset)
        setPrintSheetColumns(Number(data.label_columns) || layout.columns)
        setPrintSheetRows(Number(data.label_rows) || layout.rows)
      }
    } catch {
      /* use defaults */
    }
    setShowPrintDialog(true)
  }

  const printLabelsPerSheet = printSheetColumns * printSheetRows
  const printStartHint = stickerPositionToRowCol(printStartPosition, printSheetColumns)

  const refreshPrintPreview = useCallback(async () => {
    if (!selectedProductForPrint || !showPrintDialog) {
      setPrintPreviewHtml('')
      return
    }

    setPrintPreviewLoading(true)
    try {
      if (printBarcodeMode === 'label') {
        const res = await apiFetch(
          `/printer/barcode/preview?mode=label&size=${encodeURIComponent(printLabelSize)}`
        )
        if (res.ok) {
          const data = await res.json()
          setPrintPreviewHtml(data.html || '')
        } else {
          setPrintPreviewHtml('')
        }
        return
      }

      const res = await apiFetch(`/products/${selectedProductForPrint}/print-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: Math.min(printQuantity, 8),
          format: 'html',
          start_position: printStartPosition,
          preview: true,
        }),
      })
      if (res.ok) {
        setPrintPreviewHtml(await res.text())
      } else {
        setPrintPreviewHtml('')
      }
    } catch {
      setPrintPreviewHtml('')
    } finally {
      setPrintPreviewLoading(false)
    }
  }, [
    printBarcodeMode,
    printLabelSize,
    printQuantity,
    printStartPosition,
    selectedProductForPrint,
    showPrintDialog,
  ])

  useEffect(() => {
    if (!showPrintDialog) {
      setPrintPreviewHtml('')
      return
    }
    if (printPreviewTimerRef.current) {
      clearTimeout(printPreviewTimerRef.current)
    }
    printPreviewTimerRef.current = setTimeout(() => {
      void refreshPrintPreview()
    }, 350)
    return () => {
      if (printPreviewTimerRef.current) {
        clearTimeout(printPreviewTimerRef.current)
      }
    }
  }, [refreshPrintPreview, showPrintDialog])

  const handlePrintConfirm = async () => {
    if (!selectedProductForPrint) return

    const isThermal = printBarcodeMode === 'label'

    try {
      let thermalPrinterName = ''
      try {
        const settingsRes = await apiFetch('/settings/print')
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          thermalPrinterName = settings.thermal_printer_name || ''
        }
      } catch {
        /* optional */
      }

      const res = await apiFetch(`/products/${selectedProductForPrint}/print-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: isThermal ? 'application/json' : 'text/html',
        },
        body: JSON.stringify({
          quantity: printQuantity,
          format: isThermal ? 'json' : 'html',
          start_position: isThermal ? undefined : printStartPosition,
        }),
      })
      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const payload = (await res.json()) as BarcodeLabelsPayload
          if (!payload?.labels?.length) {
            notifyError('Label print returned empty content')
            return
          }
          await printBarcodeLabels(
            {
              ...payload,
              size: normalizeThermalPrintSize(payload.size || printLabelSize),
              title: payload.title || 'Product Labels',
            },
            { printerName: thermalPrinterName }
          )
          setShowPrintDialog(false)
          return
        }
        const html = await res.text()
        if (!html.trim()) {
          notifyError('Label print returned empty content')
          return
        }
        await printHtmlDocument(html, { title: 'Product Labels' })
        setShowPrintDialog(false)
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(data.error || 'Failed to print label')
      }
    } catch (err) {
      console.error(err)
      notifyError(err instanceof Error && err.message ? err.message : 'Failed to print label')
    }
  }

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    const product = products.find(p => p.id === productId)
    if (!product) return
    if (!(await confirm({
      title: product.is_active ? 'Disable product?' : 'Enable product?',
      description: product.is_active
        ? 'Are you sure you want to disable this product?'
        : 'Are you sure you want to enable this product?',
      confirmLabel: product.is_active ? 'Disable' : 'Enable',
      variant: 'default',
    }))) return
    try {
      const res = await apiFetch(`/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !product.is_active })
      })
      if (res.ok) {
        fetchProducts()
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!(await confirm({
      title: 'Delete product?',
      description: 'Are you sure you want to delete this product? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/products/${productId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchProducts()
      }
    } catch (err) { console.error(err) }
  }

  const handlePreviewProduct = (product: Product) => {
    setPreviewProduct(product)
    setShowPreviewDialog(true)
  }

  const updateNewItem = (patch: Partial<typeof newItem> | ((prev: typeof newItem) => typeof newItem), clearField?: string) => {
    setNewItem((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
    if (clearField) clearFieldError(clearField)
  }

  const handleNameChange = (name: string) => {
    updateNewItem((prev) => {
      const next = { ...prev, name }
      if (!skuManuallyEdited.current) {
        next.sku = skuFromProductName(name)
      }
      return next
    }, 'name')
  }

  const handleSkuChange = (sku: string) => {
    skuManuallyEdited.current = true
    updateNewItem({ sku }, 'sku')
  }

  const emptyProductForm = {
    name: '',
    sku: '',
    item_code: '',
    category: pickDefaultCategoryName(categories),
    unit: 'PCS',
    purchase_price: 0,
    sale_price: 0,
    mrp: 0,
    min_stock: 0,
    tax_rate: 0,
    gst_enabled: false,
    item_type: 'product',
    low_stock_alert: true,
    hsn_code: '',
    description: '',
    discount: '',
    enable_batching: false,
    sale_price_with_tax: true,
    purchase_price_with_tax: true,
    image_url: '',
  }

  const handleCreateItem = async () => {
    if (!validateRequired({ name: newItem.name }, { name: 'Product name' })) {
      setCreateTab('basic')
      return
    }

    const itemCodeErr = weighingItemCodeError(newItem.unit, newItem.item_code)
    if (itemCodeErr) {
      setError('item_code', itemCodeErr)
      setCreateTab('basic')
      return
    }

    setCreating(true)
    clearErrors()
    try {
      const res = await apiFetch('/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      })
      if (res.ok) {
        setShowCreateModal(false)
        skuManuallyEdited.current = false
        setNewItem(emptyProductForm)
        clearErrors()
        showSuccessToast('Product created successfully')
        fetchProducts()
      } else {
        const { fields } = await handleApiError(res, {
          toastTitle: 'Could not create product',
          switchTab: (field) => {
            if (['sale_price', 'purchase_price', 'mrp', 'tax_rate', 'discount'].includes(field)) setCreateTab('pricing')
            else if (['hsn_code', 'min_stock'].includes(field)) setCreateTab('settings')
            else setCreateTab('basic')
          },
        })
        if (fields.item_code) setCreateTab('basic')
      }
    } catch (err) {
      console.error(err)
      showErrorToast('Failed to create product. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val)

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-500">Manage your product catalog</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowDraftsModal(true)}>
              <Package className="h-4 w-4" />
              Drafts
            </Button>
            <Dialog open={showCreateModal} onOpenChange={(open) => {
              setShowCreateModal(open)
              if (!open) {
                clearErrors()
                setCreateTab('basic')
                skuManuallyEdited.current = false
                setNewItem(emptyProductForm)
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Product</DialogTitle>
                </DialogHeader>
                {fieldErrors._form && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fieldErrors._form}
                  </div>
                )}
                <Tabs value={createTab} onValueChange={setCreateTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Basic Details</TabsTrigger>
                    <TabsTrigger value="image">Image</TabsTrigger>
                    <TabsTrigger value="pricing">Pricing</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="item_type">Item Type</Label>
                      <Select value={newItem.item_type} onValueChange={(value) => updateNewItem({ item_type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select item type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="service">Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <SearchableSelect
                        value={newItem.category}
                        onValueChange={(value) => updateNewItem({ category: value }, 'category')}
                        options={categories.map((cat) => ({ value: cat.name, label: cat.name }))}
                        placeholder="Select category"
                        searchPlaceholder="Search categories..."
                        emptyMessage="No categories found"
                        onAddNew={() => setShowAddCategoryModal(true)}
                        addNewLabel="Add New"
                        className={cn(fieldErrors.category && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.category} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={newItem.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Enter product name"
                        className={cn(fieldErrors.name && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.name} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={newItem.sku}
                        onChange={(e) => handleSkuChange(e.target.value)}
                        placeholder="Auto-generated from name"
                        className={cn(fieldErrors.sku && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.sku} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="item_code">Item code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="item_code"
                          value={newItem.item_code}
                          maxLength={
                            isWeightBasedUnit(newItem.unit) ? WEIGHING_ITEM_CODE_MAX_LEN : undefined
                          }
                          onChange={(e) => {
                            clearFieldError('item_code')
                            updateNewItem({ item_code: e.target.value })
                          }}
                          placeholder={
                            isWeightBasedUnit(newItem.unit)
                              ? `Max ${WEIGHING_ITEM_CODE_MAX_LEN} characters`
                              : 'Enter item code or scan'
                          }
                          className={cn(fieldErrors.item_code && 'border-red-500')}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowBarcodeScanner(true)}
                        >
                          <Barcode className="h-4 w-4" />
                        </Button>
                      </div>
                      {isWeightBasedUnit(newItem.unit) && (
                        <p className="text-xs text-muted-foreground">
                          Weighing items: max {WEIGHING_ITEM_CODE_MAX_LEN} characters
                        </p>
                      )}
                      <FieldError message={fieldErrors.item_code} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="unit">Quantity Measurement</Label>
                      <Select value={newItem.unit} onValueChange={(value) => updateNewItem({ unit: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                          <SelectItem value="KG">KG (Kilogram)</SelectItem>
                          <SelectItem value="LTR">LTR (Liter)</SelectItem>
                          <SelectItem value="MTR">MTR (Meter)</SelectItem>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="DOZ">DOZ (Dozen)</SelectItem>
                          <SelectItem value="GM">GM (Gram)</SelectItem>
                          <SelectItem value="ML">ML (Milliliter)</SelectItem>
                          <SelectItem value="FT">FT (Feet)</SelectItem>
                          <SelectItem value="INCH">INCH</SelectItem>
                          <SelectItem value="SET">SET</SelectItem>
                          <SelectItem value="PKT">PKT (Packet)</SelectItem>
                          <SelectItem value="BTL">BTL (Bottle)</SelectItem>
                          <SelectItem value="CAN">CAN</SelectItem>
                          <SelectItem value="BAG">BAG</SelectItem>
                          <SelectItem value="ROLL">ROLL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newItem.description}
                        onChange={(e) => updateNewItem({ description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="image" className="space-y-4 mt-4">
                    <ProductImageField
                      idPrefix="create-product-image"
                      value={newItem.image_url}
                      onChange={(image_url) => updateNewItem({ image_url })}
                    />
                  </TabsContent>
                  
                  <TabsContent value="pricing" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <Label htmlFor="gst_enabled">Enable GST</Label>
                        <p className="text-xs text-muted-foreground">
                          When disabled, prices are GST exempt and tax rate is set to 0%.
                        </p>
                      </div>
                      <Switch
                        id="gst_enabled"
                        checked={newItem.gst_enabled}
                        onCheckedChange={handleGstEnabledChange}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Sale Price</Label>
                        <div className={cn('grid gap-4', newItem.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                          <div className="space-y-2">
                            <Input
                              type="number"
                              value={newItem.sale_price}
                              onChange={(e) => updateNewItem({ sale_price: parseFloat(e.target.value) || 0 }, 'sale_price')}
                              placeholder="0.00"
                              className={cn(fieldErrors.sale_price && 'border-red-500')}
                            />
                            <FieldError message={fieldErrors.sale_price} />
                          </div>
                          {newItem.gst_enabled && (
                            <Select
                              value={newItem.sale_price_with_tax ? 'with_tax' : 'without_tax'}
                              onValueChange={(value) => updateNewItem({ sale_price_with_tax: value === 'with_tax' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="with_tax">With Tax</SelectItem>
                                <SelectItem value="without_tax">Without Tax</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Purchase Price</Label>
                        <div className={cn('grid gap-4', newItem.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                          <div className="space-y-2">
                            <Input
                              type="number"
                              value={newItem.purchase_price}
                              onChange={(e) => updateNewItem({ purchase_price: parseFloat(e.target.value) || 0 }, 'purchase_price')}
                              placeholder="0.00"
                              className={cn(fieldErrors.purchase_price && 'border-red-500')}
                            />
                            <FieldError message={fieldErrors.purchase_price} />
                          </div>
                          {newItem.gst_enabled && (
                            <Select
                              value={newItem.purchase_price_with_tax ? 'with_tax' : 'without_tax'}
                              onValueChange={(value) => updateNewItem({ purchase_price_with_tax: value === 'with_tax' })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="with_tax">With Tax</SelectItem>
                                <SelectItem value="without_tax">Without Tax</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className={cn('grid gap-4', newItem.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                      <div className="space-y-2">
                        <Label htmlFor="mrp">MRP</Label>
                        <Input
                          id="mrp"
                          type="number"
                          value={newItem.mrp}
                          onChange={(e) => updateNewItem({ mrp: parseFloat(e.target.value) || 0 }, 'mrp')}
                          placeholder="0.00"
                          className={cn(fieldErrors.mrp && 'border-red-500')}
                        />
                        <FieldError message={fieldErrors.mrp} />
                      </div>
                      {newItem.gst_enabled && (
                        <div className="space-y-2">
                          <Label htmlFor="tax_rate">GST Rate %</Label>
                          <Input
                            id="tax_rate"
                            type="number"
                            value={newItem.tax_rate}
                            onChange={(e) => updateNewItem({ tax_rate: parseFloat(e.target.value) || 0 }, 'tax_rate')}
                            placeholder="0"
                            className={cn(fieldErrors.tax_rate && 'border-red-500')}
                          />
                          <FieldError message={fieldErrors.tax_rate} />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="discount">Discount on Sale Price</Label>
                      <Input
                        id="discount"
                        type="text"
                        value={newItem.discount}
                        onChange={(e) => updateNewItem({ discount: e.target.value }, 'discount')}
                        placeholder="10% or 100"
                        className={cn(fieldErrors.discount && 'border-red-500')}
                      />
                      <FieldError message={fieldErrors.discount} />
                      <p className="text-xs text-gray-500">
                        Enter percentage (e.g., 10%) for percentage discount, or amount (e.g., 100) for fixed amount discount
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="hsn_code">HSN Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="hsn_code"
                          value={newItem.hsn_code}
                          onChange={(e) => updateNewItem({ hsn_code: e.target.value }, 'hsn_code')}
                          placeholder="Enter HSN Code"
                          className={cn(fieldErrors.hsn_code && 'border-red-500')}
                        />
                        {businessSettings?.enable_ai_hsn_search && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowHsnSearchModal(true)}
                            title="Find HSN Code with AI"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FieldError message={fieldErrors.hsn_code} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="min_stock">Min Stock</Label>
                      <Input
                        id="min_stock"
                        type="number"
                        value={newItem.min_stock}
                        onChange={(e) => updateNewItem({ min_stock: parseFloat(e.target.value) || 0 }, 'min_stock')}
                        placeholder="0"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="low_stock_alert"
                        checked={newItem.low_stock_alert}
                        onCheckedChange={(checked) => updateNewItem({ low_stock_alert: checked as boolean })}
                      />
                      <Label htmlFor="low_stock_alert">Low Stock Alert</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enable_batching"
                        checked={newItem.enable_batching}
                        onCheckedChange={(checked) => updateNewItem({ enable_batching: checked as boolean })}
                      />
                      <Label htmlFor="enable_batching">Enable Batching</Label>
                    </div>
                  </TabsContent>
                </Tabs>
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button variant="outline" onClick={handleSaveDraft}>Save as Draft</Button>
                  <Button onClick={handleCreateItem} disabled={creating}>
                    {creating ? 'Creating...' : 'Create Product'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showDraftsModal} onOpenChange={setShowDraftsModal}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Saved Drafts</DialogTitle>
                </DialogHeader>
                {loadingDraft ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No drafts saved</div>
                ) : (
                  <div className="space-y-2">
                    {drafts.map((draft) => (
                      <div key={draft.id} className="flex items-center justify-between p-4 border rounded-md">
                        <div>
                          <div className="font-medium">{draft.title}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(draft.updated_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleLoadDraft(draft.id)}>Load</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteDraft(draft.id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex gap-4 items-center flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Bulk Import
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>
                {selectedItems.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete ({selectedItems.size})
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedItems.size === products.length && products.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(p.id)}
                        onCheckedChange={() => handleSelectItem(p.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.sale_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.purchase_price)}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreviewProduct(p)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.location.href = `/products/edit/${p.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrintLabel(p.id)}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print Label
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(p.id, p.is_active)}>
                            <Power className="h-4 w-4 mr-2" />
                            {p.is_active ? 'Disable' : 'Enable'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteProduct(p.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No products found</TableCell></TableRow>}
              </TableBody>
            </Table>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showImportDialog} onOpenChange={handleImportDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Import Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV or Excel file with your product data. Download the template first to see the required columns and format.
            </p>
            <Button variant="outline" onClick={handleDownloadImportTemplate} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" />
              Download Import Template
            </Button>
            <div className="space-y-2">
              <Label htmlFor="product_import_file">Import file</Label>
              <Input
                id="product_import_file"
                ref={importFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && (
                <p className="text-sm text-gray-500">Selected: {importFile.name}</p>
              )}
            </div>
            {importedCount !== null && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                Imported {importedCount} product{importedCount === 1 ? '' : 's'} successfully.
              </div>
            )}
            {importErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 max-h-40 overflow-y-auto space-y-1">
                {importErrors.map((error, index) => (
                  <p key={`${error}-${index}`}>{error}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleImportDialogChange(false)}>Cancel</Button>
            <Button onClick={handleImportProducts} disabled={importing || !importFile}>
              {importing ? 'Importing...' : 'Import Products'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Barcode Labels</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="printQuantity">Quantity</Label>
              <Input
                id="printQuantity"
                type="number"
                min="1"
                max="500"
                value={printQuantity}
                onChange={(e) => setPrintQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {printBarcodeMode === 'label' ? (
                <>
                  Thermal label ·{' '}
                  <span className="font-medium text-foreground">
                    {BARCODE_LABEL_SIZE_OPTIONS.find((o) => o.value === printLabelSize)?.label ??
                      printLabelSize}
                  </span>
                  {' · '}
                  {BARCODE_LABEL_SIZE_OPTIONS.find((o) => o.value === printLabelSize)?.description}
                </>
              ) : (
                <>
                  A4 sheet ·{' '}
                  <span className="font-medium text-foreground">
                    {A4_LABEL_SHEET_PRESETS.find((p) => p.key === printSheetPreset)?.label ??
                      `${printSheetColumns}×${printSheetRows} grid`}
                  </span>
                  {' · '}
                  {printLabelsPerSheet} labels per sheet
                </>
              )}
              <p className="mt-1 text-xs">
                Print mode and paper size are configured in Settings → Print → Barcode.
              </p>
            </div>
            {printBarcodeMode === 'a4' ? (
              <div className="space-y-2">
                <Label htmlFor="printStartPosition">Starting sticker (1–{printLabelsPerSheet})</Label>
                <Input
                  id="printStartPosition"
                  type="number"
                  min={1}
                  max={printLabelsPerSheet}
                  value={printStartPosition}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') return
                    const n = Number(raw)
                    if (!Number.isFinite(n)) return
                    setPrintStartPosition(Math.min(printLabelsPerSheet, Math.max(1, Math.round(n))))
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Use when reusing a partially printed sheet. First label prints at row{' '}
                  {printStartHint.row}, column {printStartHint.col} (numbered left-to-right, top-to-bottom).
                </p>
              </div>
            ) : null}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>
                  {printBarcodeMode === 'label' ? 'Label preview' : 'A4 sheet preview'}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={printPreviewLoading}
                  onClick={() => void refreshPrintPreview()}
                >
                  {printPreviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>
              {printPreviewHtml ? (
                <iframe
                  title="Barcode print preview"
                  srcDoc={printPreviewHtml}
                  className="h-[320px] w-full rounded border bg-white"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {printPreviewLoading ? 'Loading preview…' : 'Preview unavailable'}
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handlePrintConfirm}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Product Preview</DialogTitle>
          </DialogHeader>
          {previewProduct && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-48 h-48 flex-shrink-0">
                  {previewProduct.image_url ? (
                    <img
                      src={previewProduct.image_url}
                      alt={previewProduct.name}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg border flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">{previewProduct.name}</h3>
                  <p className="text-sm text-gray-600">SKU: {previewProduct.sku}</p>
                  {previewProduct.item_code && (
                    <p className="text-sm text-gray-600">Item code: {previewProduct.item_code}</p>
                  )}
                  <p className="text-sm text-gray-600">Category: {previewProduct.category}</p>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Sale Price</p>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(previewProduct.sale_price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Purchase Price</p>
                      <p className="text-lg font-semibold">{formatCurrency(previewProduct.purchase_price)}</p>
                    </div>
                    {previewProduct.mrp && (
                      <div>
                        <p className="text-xs text-gray-500">MRP</p>
                        <p className="text-lg font-semibold">{formatCurrency(previewProduct.mrp)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-500">Unit</p>
                  <p className="font-medium">{previewProduct.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tax Rate</p>
                  <p className="font-medium">
                    {isProductGstEnabled(previewProduct)
                      ? `${previewProduct.tax_rate}%`
                      : 'GST exempt (0%)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Min Stock</p>
                  <p className="font-medium">{previewProduct.min_stock}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-medium">{previewProduct.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                {previewProduct.hsn_code && (
                  <div>
                    <p className="text-xs text-gray-500">HSN Code</p>
                    <p className="font-medium">{previewProduct.hsn_code}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium">{previewProduct.is_service ? 'Service' : 'Product'}</p>
                </div>
              </div>
              {previewProduct.description && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm">{previewProduct.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHsnSearchModal} onOpenChange={setShowHsnSearchModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Find HSN Code with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hsn_search">Product Description</Label>
              <Input
                id="hsn_search"
                value={hsnSearchQuery}
                onChange={(e) => setHsnSearchQuery(e.target.value)}
                placeholder="Describe your product (e.g., 'cotton t-shirt', 'laptop computer')"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleHsnSearch(hsnSearchQuery)
                  }
                }}
              />
              <p className="text-xs text-gray-500">Enter a description of your product to find the appropriate HSN code</p>
            </div>
            <Button
              onClick={() => handleHsnSearch(hsnSearchQuery)}
              disabled={hsnSearchLoading || hsnSearchQuery.length < 2}
              className="w-full"
            >
              {hsnSearchLoading ? 'Searching...' : 'Search HSN Code'}
            </Button>
            {hsnSearchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-auto">
                <Label>Results</Label>
                {hsnSearchResults.map((hsn) => (
                  <div
                    key={hsn.code}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectHsn(hsn)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{hsn.code}</div>
                        <div className="text-xs text-gray-500 mt-1">{hsn.description}</div>
                        <div className="text-xs text-gray-400 mt-1">GST: {hsn.cgst_rate + hsn.sgst_rate}% (CGST: {hsn.cgst_rate}%, SGST: {hsn.sgst_rate}%)</div>
                      </div>
                      <Button size="sm" variant="outline">
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent className="max-w-md z-[60]">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_category_name">Name *</Label>
              <Input
                id="new_category_name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="Category name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_category_description">Description</Label>
              <Input
                id="new_category_description"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddCategoryModal(false)}>Cancel</Button>
              <Button onClick={handleCreateCategory} disabled={creatingCategory || !newCategory.name.trim()}>
                {creatingCategory ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <BarcodeScanner
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        onScan={(code) => {
          const nextCode = isWeightBasedUnit(newItem.unit)
            ? code.slice(0, WEIGHING_ITEM_CODE_MAX_LEN)
            : code
          if (isWeightBasedUnit(newItem.unit) && code.length > WEIGHING_ITEM_CODE_MAX_LEN) {
            setError(
              'item_code',
              `Item code for weighing items must be at most ${WEIGHING_ITEM_CODE_MAX_LEN} characters`
            )
          } else {
            clearFieldError('item_code')
          }
          setNewItem({ ...newItem, item_code: nextCode })
        }}
      />
      {confirmDialog}
    </DashboardLayout>
  )
}
