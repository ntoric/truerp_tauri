'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { Upload, Loader2, Save, ArrowLeft, Check, X, Edit2, Camera } from 'lucide-react'
import { notifyError } from '@/lib/notify'

interface ParsedItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  hsn_code: string
  tax_rate: number
}

interface ParsedData {
  vendor_name: string
  vendor_gstin: string
  bill_number: string
  bill_date: string
  due_date: string
  items: ParsedItem[]
  subtotal: number
  tax_total: number
  total_amount: number
  notes: string
}

export default function AIParseReturnPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imagePreview, setImagePreview] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [fileType, setFileType] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<ParsedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setFileType(file.type)

      if (file.type === 'application/pdf') {
        setImagePreview('')
      } else {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleParseBill = async () => {
    if (!fileName) return

    setParsing(true)
    setError('')

    try {
      const fileInput = fileInputRef.current
      const file = fileInput?.files?.[0]

      if (!file) {
        setError('Please select a file')
        setParsing(false)
        return
      }

      const formData = new FormData()
      formData.append('image', file)

      const res = await apiFetch('/purchase/parse-bill-ai', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const result = await res.json()
        if (result.status === 'success' && result.data) {
          setParsedData(result.data)
          setEditedData(result.data)
          setIsEditing(true)
        } else {
          setError('Failed to parse bill data')
        }
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to parse bill')
      }
    } catch (err) {
      setError('An error occurred while parsing the bill')
      console.error(err)
    } finally {
      setParsing(false)
    }
  }

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedData(parsedData)
    }
    setIsEditing(!isEditing)
  }

  const handleDataChange = (field: keyof ParsedData, value: any) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value })
    }
  }

  const handleItemChange = (index: number, field: keyof ParsedItem, value: any) => {
    if (editedData) {
      const newItems = [...editedData.items]
      newItems[index] = { ...newItems[index], [field]: value }
      setEditedData({ ...editedData, items: newItems })
    }
  }

  const handleConfirmAndSave = async () => {
    if (!editedData) return

    setSaving(true)
    try {
      let vendorId = ''
      if (editedData.vendor_name) {
        const searchRes = await apiFetch(`/parties?search=${encodeURIComponent(editedData.vendor_name)}&party_type=vendor`)
        if (searchRes.ok) {
          const vendors = await searchRes.json()
          const existingVendor = Array.isArray(vendors) ? vendors.find((v: any) => v.name.toLowerCase() === editedData.vendor_name.toLowerCase()) : null

          if (existingVendor) {
            vendorId = existingVendor.id
          } else {
            const vendorRes = await apiFetch('/parties', {
              method: 'POST',
              body: JSON.stringify({
                name: editedData.vendor_name,
                gstin: editedData.vendor_gstin || '',
                type: 'vendor',
                phone: '',
                email: '',
                address: '',
                city: '',
                state: '',
                pincode: '',
              }),
            })

            if (vendorRes.ok) {
              const vendor = await vendorRes.json()
              vendorId = vendor.id
            }
          }
        }
      }

      const parsedReturnData = {
        vendor_id: vendorId,
        vendor_name: editedData.vendor_name,
        vendor_gstin: editedData.vendor_gstin,
        bill_number: editedData.bill_number,
        bill_date: editedData.bill_date,
        due_date: editedData.due_date,
        notes: editedData.notes,
        items: editedData.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'PCS',
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          hsn_code: item.hsn_code,
        })),
        subtotal: editedData.subtotal,
        tax_total: editedData.tax_total,
        total_amount: editedData.total_amount,
      }

      sessionStorage.setItem('parsedReturnData', JSON.stringify(parsedReturnData))

      router.push('/purchase-returns/create')
    } catch (err) {
      notifyError('An error occurred while preparing the data')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setImagePreview('')
    setFileName('')
    setFileType('')
    setParsedData(null)
    setEditedData(null)
    setIsEditing(false)
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/purchase-returns')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">AI Invoice Scanner - Purchase Return</h1>
          </div>
        </div>

        {!parsedData ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload Invoice Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="bill-image"
                />
                <label htmlFor="bill-image" className="cursor-pointer">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="rounded-full bg-blue-100 p-4">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900">Click to upload invoice image or PDF</p>
                      <p className="text-xs text-gray-500">Supports JPG, PNG, WebP, PDF</p>
                    </div>
                  </div>
                </label>
              </div>

              {(imagePreview || fileName) && (
                <div className="space-y-4">
                  <div className="relative">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Invoice preview"
                        className="max-h-96 w-full rounded-lg border object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border bg-gray-50 p-12">
                        <div className="text-center">
                          <div className="mb-2 rounded-full bg-red-100 p-3 inline-block">
                            <Upload className="h-8 w-8 text-red-600" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">{fileName}</p>
                          <p className="text-xs text-gray-500">PDF file</p>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={handleReset}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={handleParseBill}
                    disabled={parsing}
                    className="w-full"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Parsing Invoice...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Parse with AI
                      </>
                    )}
                  </Button>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Original Image</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <X className="mr-2 h-4 w-4" />
                    Start Over
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <img
                  src={imagePreview}
                  alt="Invoice preview"
                  className="max-h-64 w-full rounded-lg border object-contain"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Parsed Data</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditToggle}
                    >
                      {isEditing ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Done Editing
                        </>
                      ) : (
                        <>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Data
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleConfirmAndSave}
                      disabled={saving}
                      size="sm"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Confirm & Continue
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Vendor Details */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Vendor Name</Label>
                    {isEditing ? (
                      <Input
                        value={editedData?.vendor_name || ''}
                        onChange={(e) => handleDataChange('vendor_name', e.target.value)}
                      />
                    ) : (
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                        {parsedData.vendor_name || '-'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor GSTIN</Label>
                    {isEditing ? (
                      <Input
                        value={editedData?.vendor_gstin || ''}
                        onChange={(e) => handleDataChange('vendor_gstin', e.target.value)}
                      />
                    ) : (
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                        {parsedData.vendor_gstin || '-'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Bill Number</Label>
                    {isEditing ? (
                      <Input
                        value={editedData?.bill_number || ''}
                        onChange={(e) => handleDataChange('bill_number', e.target.value)}
                      />
                    ) : (
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                        {parsedData.bill_number || '-'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Bill Date</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editedData?.bill_date || ''}
                        onChange={(e) => handleDataChange('bill_date', e.target.value)}
                      />
                    ) : (
                      <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                        {parsedData.bill_date || '-'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2">
                  <Label>Items</Label>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left">
                          <th className="px-4 py-2 font-medium">Description</th>
                          <th className="px-4 py-2 font-medium">HSN</th>
                          <th className="px-4 py-2 text-right">Quantity</th>
                          <th className="px-4 py-2 text-right">Unit</th>
                          <th className="px-4 py-2 text-right">Unit Price</th>
                          <th className="px-4 py-2 text-right">Tax %</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isEditing ? editedData?.items : parsedData.items)?.map((item, index) => (
                          <tr key={index} className="border-b">
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  className="h-8"
                                />
                              ) : (
                                item.description
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  value={item.hsn_code}
                                  onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                                  className="h-8 w-24"
                                />
                              ) : (
                                item.hsn_code || '-'
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 w-20 text-right"
                                />
                              ) : (
                                <span className="text-right block">{item.quantity}</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  value={item.unit}
                                  onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                  className="h-8 w-16"
                                />
                              ) : (
                                item.unit || '-'
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.unit_price}
                                  onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="h-8 w-24 text-right"
                                />
                              ) : (
                                <span className="text-right block">{formatCurrency(item.unit_price)}</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.tax_rate}
                                  onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                  className="h-8 w-16 text-right"
                                />
                              ) : (
                                <span className="text-right block">{item.tax_rate}%</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {formatCurrency(item.quantity * item.unit_price * (1 + item.tax_rate / 100))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Subtotal</Label>
                    <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm font-medium">
                      {formatCurrency(isEditing ? (editedData?.subtotal ?? 0) : parsedData.subtotal)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Tax Total</Label>
                    <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm font-medium">
                      {formatCurrency(isEditing ? (editedData?.tax_total ?? 0) : parsedData.tax_total)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                      {formatCurrency(isEditing ? (editedData?.total_amount ?? 0) : parsedData.total_amount)}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  {isEditing ? (
                    <textarea
                      value={editedData?.notes || ''}
                      onChange={(e) => handleDataChange('notes', e.target.value)}
                      className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Additional notes..."
                    />
                  ) : (
                    <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                      {parsedData.notes || '-'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
