'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { asArray, cn, skuFromProductName } from '@/lib/utils'
import { DEFAULT_CATEGORY_NAME, pickDefaultCategoryName } from '@/lib/defaultCategories'
import { notifySuccess } from '@/lib/notify'
import ProductImageField from '@/components/ProductImageField'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import { Barcode, Search } from 'lucide-react'
import {
  WEIGHING_ITEM_CODE_MAX_LEN,
  isWeightBasedUnit,
  weighingItemCodeError,
} from '@/lib/weighingScale'

export interface CreatedProduct {
  id: string
  name: string
  sku: string
  item_code: string
  hsn_code: string
  sale_price: number
  purchase_price: number
  tax_rate: number
  unit: string
  stock_qty: number
  category: string
  sale_price_with_tax: boolean
}

interface Category {
  id: string
  name: string
  description?: string
}

function normalizeProductForm(
  data?: (Partial<ProductFormState> & { inventory?: { item_code?: string } }) | null
): ProductFormState {
  const base = emptyProductForm()
  if (!data) return base
  const { inventory, ...rest } = data
  return {
    ...base,
    ...rest,
    item_code: rest.item_code ?? inventory?.item_code ?? '',
  }
}

export type ProductFormState = {
  name: string
  sku: string
  item_code: string
  category: string
  unit: string
  purchase_price: number
  sale_price: number
  mrp: number
  min_stock: number
  tax_rate: number
  item_type: string
  low_stock_alert: boolean
  hsn_code: string
  description: string
  discount: string
  enable_batching: boolean
  sale_price_with_tax: boolean
  purchase_price_with_tax: boolean
  image_url: string
}

const emptyProductForm = (): ProductFormState => ({
  name: '',
  sku: '',
  item_code: '',
  category: DEFAULT_CATEGORY_NAME,
  unit: 'PCS',
  purchase_price: 0,
  sale_price: 0,
  mrp: 0,
  min_stock: 0,
  tax_rate: 18,
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

interface CreateProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (product: CreatedProduct) => void
  showDraftButton?: boolean
  /** When provided and dialog opens, form is seeded from these values (e.g. draft load). */
  initialValues?: Partial<ProductFormState> | null
}

export default function CreateProductDialog({
  open,
  onOpenChange,
  onCreated,
  showDraftButton = true,
  initialValues = null,
}: CreateProductDialogProps) {
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

  const [createTab, setCreateTab] = useState('basic')
  const [creating, setCreating] = useState(false)
  const [newItem, setNewItem] = useState<ProductFormState>(emptyProductForm)
  const [categories, setCategories] = useState<Category[]>([])
  const [enableAiHsnSearch, setEnableAiHsnSearch] = useState(false)

  const [showHsnSearchModal, setShowHsnSearchModal] = useState(false)
  const [hsnSearchQuery, setHsnSearchQuery] = useState('')
  const [hsnSearchResults, setHsnSearchResults] = useState<any[]>([])
  const [hsnSearchLoading, setHsnSearchLoading] = useState(false)

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const skuManuallyEdited = useRef(false)

  useEffect(() => {
    if (!open) return

    setNewItem(normalizeProductForm(initialValues))
    skuManuallyEdited.current = Boolean(initialValues?.sku?.trim())
    setCreateTab('basic')
    clearErrors()

    let cancelled = false
    const load = async () => {
      try {
        const [catRes, bizRes] = await Promise.all([
          apiFetch('/categories'),
          apiFetch('/business'),
        ])
        if (cancelled) return
        if (catRes.ok) {
          const cats = asArray(await catRes.json())
          setCategories(cats)
          const defaultName = pickDefaultCategoryName(cats)
          setNewItem((prev) => {
            if (initialValues?.category) return prev
            if (!prev.category || prev.category === DEFAULT_CATEGORY_NAME) {
              return { ...prev, category: defaultName }
            }
            return prev
          })
        }
        if (bizRes.ok) {
          const data = await bizRes.json()
          setEnableAiHsnSearch(Boolean(data.enable_ai_hsn_search))
        }
      } catch (err) {
        console.error(err)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // Reset/load only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const updateNewItem = (
    patch: Partial<ProductFormState> | ((prev: ProductFormState) => ProductFormState),
    clearField?: string
  ) => {
    setNewItem((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))
    if (clearField) clearFieldError(clearField)
  }

  const handleNameChange = (name: string) => {
    updateNewItem((prev) => {
      const next: ProductFormState = { ...prev, name }
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
        body: JSON.stringify(newItem),
      })

      if (res.ok) {
        const created = await res.json()
        const product: CreatedProduct = {
          id: String(created.id),
          name: String(created.name ?? newItem.name),
          sku: String(created.sku ?? newItem.sku ?? ''),
          item_code: String(created.item_code ?? newItem.item_code ?? ''),
          hsn_code: String(created.hsn_code ?? newItem.hsn_code ?? ''),
          sale_price: Number(created.sale_price ?? newItem.sale_price ?? 0),
          purchase_price: Number(created.purchase_price ?? newItem.purchase_price ?? 0),
          tax_rate: Number(created.tax_rate ?? newItem.tax_rate ?? 18),
          unit: String(created.unit ?? newItem.unit ?? 'PCS'),
          stock_qty: 0,
          category: String(created.category ?? newItem.category ?? ''),
          sale_price_with_tax: Boolean(created.sale_price_with_tax ?? newItem.sale_price_with_tax),
        }
        showSuccessToast('Product created successfully')
        onOpenChange(false)
        onCreated?.(product)
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

  const handleSaveDraft = async () => {
    try {
      const title = newItem.name || 'Untitled Product'
      const res = await apiFetch('/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: 'product',
          title,
          data: JSON.stringify(newItem),
        }),
      })
      if (res.ok) {
        notifySuccess('Draft saved successfully')
      }
    } catch (err) {
      console.error(err)
    }
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

  const handleHsnSearch = async (search: string) => {
    if (search.length < 2) {
      setHsnSearchResults([])
      return
    }
    setHsnSearchLoading(true)
    try {
      const res = await apiFetch(`/gst/hsn-search?search=${encodeURIComponent(search)}&use_ai=true`)
      if (res.ok) {
        const data = await res.json()
        setHsnSearchResults(asArray(data).slice(0, 10))
      }
    } catch (error) {
      console.error('Failed to search HSN codes:', error)
    } finally {
      setHsnSearchLoading(false)
    }
  }

  const handleSelectHsn = (hsn: { code: string; cgst_rate: number; sgst_rate: number }) => {
    updateNewItem({ hsn_code: hsn.code, tax_rate: hsn.cgst_rate + hsn.sgst_rate }, 'hsn_code')
    setShowHsnSearchModal(false)
    setHsnSearchResults([])
    setHsnSearchQuery('')
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          if (!next) {
            clearErrors()
            setCreateTab('basic')
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[60]">
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
                <Label htmlFor="create_item_type">Item Type</Label>
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
                <Label htmlFor="create_category">Category</Label>
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
                <Label htmlFor="create_name">Product Name *</Label>
                <Input
                  id="create_name"
                  value={newItem.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter product name"
                  className={cn(fieldErrors.name && 'border-red-500')}
                />
                <FieldError message={fieldErrors.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_sku">SKU</Label>
                <Input
                  id="create_sku"
                  value={newItem.sku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  placeholder="Auto-generated from name"
                  className={cn(fieldErrors.sku && 'border-red-500')}
                />
                <FieldError message={fieldErrors.sku} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_item_code">Item code</Label>
                <div className="flex gap-2">
                  <Input
                    id="create_item_code"
                    value={newItem.item_code}
                    maxLength={
                      isWeightBasedUnit(newItem.unit) ? WEIGHING_ITEM_CODE_MAX_LEN : undefined
                    }
                    onChange={(e) => updateNewItem({ item_code: e.target.value }, 'item_code')}
                    placeholder={
                      isWeightBasedUnit(newItem.unit)
                        ? `Max ${WEIGHING_ITEM_CODE_MAX_LEN} characters`
                        : 'Enter item code or scan'
                    }
                    className={cn(fieldErrors.item_code && 'border-red-500')}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowBarcodeScanner(true)}>
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
                <Label htmlFor="create_unit">Quantity Measurement</Label>
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
                <Label htmlFor="create_description">Description</Label>
                <Input
                  id="create_description"
                  value={newItem.description}
                  onChange={(e) => updateNewItem({ description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
            </TabsContent>

            <TabsContent value="image" className="space-y-4 mt-4">
              <ProductImageField
                idPrefix="inline-create-product-image"
                value={newItem.image_url}
                onChange={(image_url) => updateNewItem({ image_url })}
              />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sale Price</Label>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Purchase Price</Label>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create_mrp">MRP</Label>
                  <Input
                    id="create_mrp"
                    type="number"
                    value={newItem.mrp}
                    onChange={(e) => updateNewItem({ mrp: parseFloat(e.target.value) || 0 }, 'mrp')}
                    placeholder="0.00"
                    className={cn(fieldErrors.mrp && 'border-red-500')}
                  />
                  <FieldError message={fieldErrors.mrp} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create_tax_rate">GST Rate %</Label>
                  <Input
                    id="create_tax_rate"
                    type="number"
                    value={newItem.tax_rate}
                    onChange={(e) => updateNewItem({ tax_rate: parseFloat(e.target.value) || 0 }, 'tax_rate')}
                    placeholder="18"
                    className={cn(fieldErrors.tax_rate && 'border-red-500')}
                  />
                  <FieldError message={fieldErrors.tax_rate} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create_discount">Discount on Sale Price</Label>
                <Input
                  id="create_discount"
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
                <Label htmlFor="create_hsn_code">HSN Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="create_hsn_code"
                    value={newItem.hsn_code}
                    onChange={(e) => updateNewItem({ hsn_code: e.target.value }, 'hsn_code')}
                    placeholder="Enter HSN Code"
                    className={cn(fieldErrors.hsn_code && 'border-red-500')}
                  />
                  {enableAiHsnSearch && (
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
                <Label htmlFor="create_min_stock">Min Stock</Label>
                <Input
                  id="create_min_stock"
                  type="number"
                  value={newItem.min_stock}
                  onChange={(e) => updateNewItem({ min_stock: parseFloat(e.target.value) || 0 }, 'min_stock')}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create_low_stock_alert"
                  checked={newItem.low_stock_alert}
                  onCheckedChange={(checked) => updateNewItem({ low_stock_alert: checked as boolean })}
                />
                <Label htmlFor="create_low_stock_alert">Low Stock Alert</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create_enable_batching"
                  checked={newItem.enable_batching}
                  onCheckedChange={(checked) => updateNewItem({ enable_batching: checked as boolean })}
                />
                <div>
                  <Label htmlFor="create_enable_batching">Enable Batching</Label>
                  <p className="text-xs text-muted-foreground">
                    Track stock by batch number (required on purchase; picked on sale/POS).
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {showDraftButton && (
              <Button type="button" variant="outline" onClick={handleSaveDraft}>
                Save as Draft
              </Button>
            )}
            <Button type="button" onClick={handleCreateItem} disabled={creating}>
              {creating ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHsnSearchModal} onOpenChange={setShowHsnSearchModal}>
        <DialogContent className="max-w-lg z-[70]">
          <DialogHeader>
            <DialogTitle>Find HSN Code with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inline_hsn_search">Product Description</Label>
              <Input
                id="inline_hsn_search"
                value={hsnSearchQuery}
                onChange={(e) => setHsnSearchQuery(e.target.value)}
                placeholder="Describe your product (e.g., 'cotton t-shirt', 'laptop computer')"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleHsnSearch(hsnSearchQuery)
                }}
              />
              <p className="text-xs text-gray-500">Enter a description of your product to find the appropriate HSN code</p>
            </div>
            <Button
              type="button"
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
                        <div className="text-xs text-gray-400 mt-1">
                          GST: {hsn.cgst_rate + hsn.sgst_rate}% (CGST: {hsn.cgst_rate}%, SGST: {hsn.sgst_rate}%)
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline">
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
        <DialogContent className="max-w-md z-[70]">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inline_new_category_name">Name *</Label>
              <Input
                id="inline_new_category_name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="Category name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline_new_category_description">Description</Label>
              <Input
                id="inline_new_category_description"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddCategoryModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategory.name.trim()}
              >
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
          setNewItem((prev) => {
            const nextCode = isWeightBasedUnit(prev.unit)
              ? code.slice(0, WEIGHING_ITEM_CODE_MAX_LEN)
              : code
            if (isWeightBasedUnit(prev.unit) && code.length > WEIGHING_ITEM_CODE_MAX_LEN) {
              setError(
                'item_code',
                `Item code for weighing items must be at most ${WEIGHING_ITEM_CODE_MAX_LEN} characters`
              )
            } else {
              clearFieldError('item_code')
            }
            return {
              ...prev,
              item_code: nextCode,
            }
          })
        }}
      />
    </>
  )
}
