'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn } from '@/lib/utils'
import { mergePartyCategories } from '@/lib/partyCategories'
import {
  EMPTY_PARTY_FORM,
  firstValidationMessage,
  validatePartyForm,
} from '@/lib/partyValidation'

export default function CreatePartyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type') || 'customer'
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    handleApiError,
    showErrorToast,
  } = useFormErrors()

  const [saving, setSaving] = useState(false)
  const [partyCategories, setPartyCategories] = useState<string[]>([])
  const [formData, setFormData] = useState({
    ...EMPTY_PARTY_FORM,
    party_type: typeParam,
  })

  useEffect(() => {
    if (typeParam) {
      setFormData((prev) => ({ ...prev, party_type: typeParam }))
    }
  }, [typeParam])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await apiFetch('/parties')
        if (res.ok) {
          const data = await res.json()
          setPartyCategories(
            mergePartyCategories(
              data.map((p: { category?: string }) => p.category).filter(Boolean) as string[]
            )
          )
        }
      } catch {
        // ignore
      }
    }
    loadCategories()
  }, [])

  const updateField = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    clearFieldError(field)
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validatePartyForm(formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        pan: formData.pan.trim().toUpperCase(),
        tan: formData.tan.trim().toUpperCase(),
        pincode: formData.pincode.trim(),
      }
      const res = await apiFetch('/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        router.push('/parties')
      } else {
        await handleApiError(res)
      }
    } catch {
      showErrorToast('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            Create New {formData.party_type === 'customer' ? 'Customer' : 'Vendor'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={cn(fieldErrors.name && 'border-red-500')}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className={cn(fieldErrors.phone && 'border-red-500')}
                  placeholder="10-digit mobile number"
                />
                <FieldError message={fieldErrors.phone} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={cn(fieldErrors.email && 'border-red-500')}
                />
                <FieldError message={fieldErrors.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || undefined}
                  onValueChange={(v) => updateField('category', v)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {partyCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="party_type">Party Type *</Label>
                <Select
                  value={formData.party_type}
                  onValueChange={(v) => updateField('party_type', v)}
                >
                  <SelectTrigger className={cn(fieldErrors.party_type && 'border-red-500')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.party_type} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="opening_balance">Opening Balance</Label>
                <Input
                  id="opening_balance"
                  type="number"
                  value={formData.opening_balance}
                  onChange={(e) => updateField('opening_balance', parseFloat(e.target.value) || 0)}
                  className={cn(fieldErrors.opening_balance && 'border-red-500')}
                />
                <FieldError message={fieldErrors.opening_balance} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credit_limit">Credit Limit</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  min={0}
                  value={formData.credit_limit}
                  onChange={(e) => updateField('credit_limit', parseFloat(e.target.value) || 0)}
                  className={cn(fieldErrors.credit_limit && 'border-red-500')}
                />
                <FieldError message={fieldErrors.credit_limit} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GST & Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={formData.gstin}
                  onChange={(e) => updateField('gstin', e.target.value.toUpperCase())}
                  className={cn(fieldErrors.gstin && 'border-red-500')}
                  placeholder="15-character GSTIN"
                />
                <FieldError message={fieldErrors.gstin} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan">PAN</Label>
                <Input
                  id="pan"
                  value={formData.pan}
                  onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                  className={cn(fieldErrors.pan && 'border-red-500')}
                  placeholder="ABCDE1234F"
                />
                <FieldError message={fieldErrors.pan} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tan">TAN</Label>
                <Input
                  id="tan"
                  value={formData.tan}
                  onChange={(e) => updateField('tan', e.target.value.toUpperCase())}
                  className={cn(fieldErrors.tan && 'border-red-500')}
                  placeholder="ABCD12345E"
                />
                <FieldError message={fieldErrors.tan} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => updateField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={cn(fieldErrors.pincode && 'border-red-500')}
                    placeholder="6-digit pincode"
                  />
                  <FieldError message={fieldErrors.pincode} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Additional notes..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save {formData.party_type === 'customer' ? 'Customer' : 'Vendor'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
