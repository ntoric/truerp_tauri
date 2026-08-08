'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch, useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Save, Search } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import ProductImageField from '@/components/ProductImageField'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { cn } from '@/lib/utils'
import {
  WEIGHING_ITEM_CODE_MAX_LEN,
  isWeightBasedUnit,
  weighingItemCodeError,
} from '@/lib/weighingScale'

interface Product {
  id: string
  name: string
  sku: string
  item_code: string
  category: string
  purchase_price: number
  sale_price: number
  mrp: number
  unit: string
  min_stock: number
  tax_rate: number
  gst_enabled: boolean
  item_type: string
  low_stock_alert: boolean
  hsn_code: string
  description: string
  discount: string
  enable_batching: boolean
  sale_price_with_tax: boolean
  purchase_price_with_tax: boolean
  image_url: string
  is_active: boolean
}

interface Category {
  id: string
  name: string
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const productId = params.id as string

  const {
    fieldErrors,
    clearErrors,
    clearFieldError,
    setError,
    handleApiError,
    showSuccessToast,
    showErrorToast,
  } = useFormErrors()
  const { confirm, confirmDialog } = useConfirmDialog()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialIsActive, setInitialIsActive] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [hsnSearchResults, setHsnSearchResults] = useState<any[]>([])
  const [showHsnDropdown, setShowHsnDropdown] = useState(false)
  const [useAISearch, setUseAISearch] = useState(false)
  const [businessSettings, setBusinessSettings] = useState<any>(null)
  const [showHsnSearchModal, setShowHsnSearchModal] = useState(false)
  const [hsnSearchQuery, setHsnSearchQuery] = useState('')
  const [hsnSearchLoading, setHsnSearchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    sku: '',
    item_code: '',
    category: '',
    purchase_price: 0,
    sale_price: 0,
    mrp: 0,
    unit: 'PCS',
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
    is_active: true
  })

  useEffect(() => {
    fetchProduct()
    fetchCategories()
    fetchBusinessSettings()
  }, [productId])

  const fetchProduct = async () => {
    try {
      const res = await apiFetch(`/products/${productId}`)
      if (res.ok) {
        const data = await res.json()
        setFormData({
          ...data,
          gst_enabled: typeof data.gst_enabled === 'boolean' ? data.gst_enabled : parseFloat(String(data.tax_rate ?? 0)) > 0,
        })
        setInitialIsActive(Boolean(data.is_active))
      } else {
        console.error('Failed to fetch product:', res.status)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await apiFetch('/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) return
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
        handleChange('category', created.name)
        setNewCategory({ name: '', description: '' })
        setShowAddCategoryModal(false)
      } else {
        const err = await res.json().catch(() => ({}))
        showErrorToast(err.error || 'Failed to create category')
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      showErrorToast('Failed to create category')
    } finally {
      setCreatingCategory(false)
    }
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
    const patch: Partial<Product> = { hsn_code: hsn.code }
    if (formData.gst_enabled) {
      patch.tax_rate = hsn.cgst_rate + hsn.sgst_rate
    }
    setFormData({ ...formData, ...patch })
    setShowHsnSearchModal(false)
    setHsnSearchResults([])
    setHsnSearchQuery('')
  }

  const handleGstEnabledChange = (enabled: boolean) => {
    setFormData({
      ...formData,
      gst_enabled: enabled,
      tax_rate: enabled ? (formData.tax_rate > 0 ? formData.tax_rate : 0) : 0,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      setError('name', 'Product name is required')
      setActiveTab('basic')
      return
    }

    const itemCodeErr = weighingItemCodeError(formData.unit, formData.item_code)
    if (itemCodeErr) {
      setError('item_code', itemCodeErr)
      setActiveTab('basic')
      return
    }

    if (formData.is_active !== initialIsActive) {
      if (!(await confirm({
        title: formData.is_active ? 'Enable product?' : 'Disable product?',
        description: formData.is_active
          ? `Enable "${formData.name}"?`
          : `Disable "${formData.name}"?`,
        confirmLabel: formData.is_active ? 'Enable' : 'Disable',
        variant: 'default',
      }))) return
    }

    setSaving(true)
    clearErrors()

    try {
      const res = await apiFetch(`/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        showSuccessToast('Product updated successfully')
        router.push('/products')
      } else {
        await handleApiError(res, {
          toastTitle: 'Could not update product',
          switchTab: (field) => {
            if (['sale_price', 'purchase_price', 'mrp', 'tax_rate', 'discount'].includes(field)) {
              setActiveTab('pricing')
            } else if (['hsn_code', 'min_stock'].includes(field)) {
              setActiveTab('settings')
            } else {
              setActiveTab('basic')
            }
          },
        })
      }
    } catch (error) {
      console.error('Failed to update product:', error)
      showErrorToast('Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof Product, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    clearFieldError(field)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/products')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Product</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="image">Image</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                  <FieldError message={fieldErrors.name} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                  />
                  <FieldError message={fieldErrors.sku} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item_code">Item code</Label>
                  <Input
                    id="item_code"
                    value={formData.item_code}
                    maxLength={
                      isWeightBasedUnit(formData.unit) ? WEIGHING_ITEM_CODE_MAX_LEN : undefined
                    }
                    onChange={(e) => handleChange('item_code', e.target.value)}
                    placeholder={
                      isWeightBasedUnit(formData.unit)
                        ? `Max ${WEIGHING_ITEM_CODE_MAX_LEN} characters`
                        : undefined
                    }
                  />
                  {isWeightBasedUnit(formData.unit) && (
                    <p className="text-xs text-muted-foreground">
                      Weighing items: max {WEIGHING_ITEM_CODE_MAX_LEN} characters
                    </p>
                  )}
                  <FieldError message={fieldErrors.item_code} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <SearchableSelect
                    value={formData.category}
                    onValueChange={(value) => handleChange('category', value)}
                    options={categories.map((cat) => ({ value: cat.name, label: cat.name }))}
                    placeholder="Select category"
                    searchPlaceholder="Search categories..."
                    emptyMessage="No categories found"
                    onAddNew={() => setShowAddCategoryModal(true)}
                    addNewLabel="Add New"
                    className={fieldErrors.category ? 'border-red-500' : undefined}
                  />
                  <FieldError message={fieldErrors.category} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => handleChange('purchase_price', parseFloat(e.target.value) || 0)}
                  />
                  <FieldError message={fieldErrors.purchase_price} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale_price">Sale Price</Label>
                  <Input
                    id="sale_price"
                    type="number"
                    step="0.01"
                    value={formData.sale_price}
                    onChange={(e) => handleChange('sale_price', parseFloat(e.target.value) || 0)}
                  />
                  <FieldError message={fieldErrors.sale_price} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mrp">MRP</Label>
                  <Input
                    id="mrp"
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => handleChange('mrp', parseFloat(e.target.value) || 0)}
                  />
                  <FieldError message={fieldErrors.mrp} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => handleChange('unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PCS">PCS</SelectItem>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="BOX">BOX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_stock">Min Stock</Label>
                  <Input
                    id="min_stock"
                    type="number"
                    step="0.01"
                    value={formData.min_stock}
                    onChange={(e) => handleChange('min_stock', parseFloat(e.target.value) || 0)}
                  />
                  <FieldError message={fieldErrors.min_stock} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item_type">Item Type</Label>
                  <Select
                    value={formData.item_type}
                    onValueChange={(value) => handleChange('item_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      placeholder="Enter description"
                    />
                    <FieldError message={fieldErrors.description} />
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-4 mt-4">
                  <ProductImageField
                    idPrefix="edit-product-image"
                    value={formData.image_url}
                    onChange={(image_url) => handleChange('image_url', image_url)}
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
                      checked={formData.gst_enabled}
                      onCheckedChange={handleGstEnabledChange}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Sale Price</Label>
                      <div className={cn('grid gap-4', formData.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.sale_price}
                            onChange={(e) => handleChange('sale_price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                          <FieldError message={fieldErrors.sale_price} />
                        </div>
                        {formData.gst_enabled && (
                          <Select
                            value={formData.sale_price_with_tax ? 'with_tax' : 'without_tax'}
                            onValueChange={(value) => handleChange('sale_price_with_tax', value === 'with_tax')}
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
                      <div className={cn('grid gap-4', formData.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.purchase_price}
                            onChange={(e) => handleChange('purchase_price', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                          <FieldError message={fieldErrors.purchase_price} />
                        </div>
                        {formData.gst_enabled && (
                          <Select
                            value={formData.purchase_price_with_tax ? 'with_tax' : 'without_tax'}
                            onValueChange={(value) => handleChange('purchase_price_with_tax', value === 'with_tax')}
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

                  <div className={cn('grid gap-4', formData.gst_enabled ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div className="space-y-2">
                      <Label htmlFor="mrp">MRP</Label>
                      <Input
                        id="mrp"
                        type="number"
                        step="0.01"
                        value={formData.mrp}
                        onChange={(e) => handleChange('mrp', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                      <FieldError message={fieldErrors.mrp} />
                    </div>
                    {formData.gst_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="tax_rate">GST Rate %</Label>
                        <Input
                          id="tax_rate"
                          type="number"
                          step="0.01"
                          value={formData.tax_rate}
                          onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value) || 0)}
                          placeholder="0"
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
                      value={formData.discount}
                      onChange={(e) => handleChange('discount', e.target.value)}
                      placeholder="10% or 100"
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
                        value={formData.hsn_code}
                        onChange={(e) => handleChange('hsn_code', e.target.value)}
                        placeholder="Enter HSN Code"
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
                      step="0.01"
                      value={formData.min_stock}
                      onChange={(e) => handleChange('min_stock', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                    <FieldError message={fieldErrors.min_stock} />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => handleChange('is_active', checked)}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="low_stock_alert"
                      checked={formData.low_stock_alert}
                      onCheckedChange={(checked) => handleChange('low_stock_alert', checked)}
                    />
                    <Label htmlFor="low_stock_alert">Low Stock Alert</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_batching"
                      checked={formData.enable_batching}
                      onCheckedChange={(checked) => handleChange('enable_batching', checked)}
                    />
                    <div>
                      <Label htmlFor="enable_batching">Enable Batching</Label>
                      <p className="text-xs text-muted-foreground">
                        Track stock by batch number on purchase and sales.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/products')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

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
        <DialogContent className="max-w-md">
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
      {confirmDialog}
    </DashboardLayout>
  )
}
