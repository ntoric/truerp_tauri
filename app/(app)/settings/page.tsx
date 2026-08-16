'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageSkeleton, { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageCropModal from '@/components/ImageCropModal'
import { 
  Building2, Save, Loader2, User, Settings as SettingsIcon, 
  FileText, Printer, Bell, HelpCircle, Share2, LogOut, Scale, Trash2, Palette 
} from 'lucide-react'
import WeighingScaleSettingsCard from '@/components/WeighingScaleSettingsCard'
import PrintSettingsCard from '@/components/PrintSettingsCard'
import DesktopUpdatesCard from '@/components/DesktopUpdatesCard'
import AppearanceSettingsCard from '@/components/AppearanceSettingsCard'
import { usePagination } from '@/hooks/usePagination'
import PaginationControls from '@/components/ui/pagination-controls'
import { usePageFeatures } from '@/hooks/usePageFeatures'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

interface Business {
  name: string
  gstin: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  bank_name: string
  account_number: string
  ifsc_code: string
  upi_id: string
  logo_url: string
  signature_url: string
  enable_ai_hsn_search: boolean
  enable_ai_bill_parsing: boolean
  gemini_api_key: string
}

interface InvoiceSettings {
  template: string
  primary_color: string
  secondary_color: string
  theme: string
  show_logo: boolean
  show_signature: boolean
  show_bank_details: boolean
  show_terms: boolean
  default_terms: string
  invoice_prefix: string
  starting_number: number
}

interface Reminder {
  id: string
  title: string
  description: string
  reminder_date: string
  reminder_type: string
  is_completed: boolean
  repeat: string
}

interface CAReportSharing {
  id: string
  ca_email: string
  ca_name: string
  access_level: string
  is_active: boolean
  notes: string
}

interface InvoiceCustomFieldDef {
  id: string
  label: string
  field_key: string
  field_type: string
  is_required: boolean
  show_on_pdf: boolean
  sort_order: number
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isPageEnabled } = usePageFeatures()
  const { confirm, confirmDialog } = useConfirmDialog()
  const remindersEnabled = isPageEnabled('/settings/reminders')
  const caShareEnabled = isPageEnabled('/settings/ca-share')
  const [activeTab, setActiveTab] = useState('business')
  
  // Business state
  const [business, setBusiness] = useState<Business>({
    name: '', gstin: '', address: '', city: '', state: '', pincode: '',
    phone: '', email: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '',
    logo_url: '', signature_url: '',
    enable_ai_hsn_search: false, enable_ai_bill_parsing: false, gemini_api_key: ''
  })
  
  // Invoice Settings state
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    template: 'classic', primary_color: '#2563eb', secondary_color: '#1e40af',
    theme: 'light', show_logo: true, show_signature: false, show_bank_details: true,
    show_terms: true, default_terms: '', invoice_prefix: 'INV', starting_number: 1
  })
  const [invoiceCustomFields, setInvoiceCustomFields] = useState<InvoiceCustomFieldDef[]>([])
  const [newCustomField, setNewCustomField] = useState({
    label: '', field_key: '', field_type: 'text', is_required: false, show_on_pdf: true, sort_order: 0,
  })
  
  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newReminder, setNewReminder] = useState({
    title: '', description: '', reminder_date: '', reminder_type: 'custom', repeat: 'once'
  })
  
  // CA Report Sharing state
  const [caShares, setCaShares] = useState<CAReportSharing[]>([])
  const [newCaShare, setNewCaShare] = useState({
    ca_email: '', ca_name: '', access_level: 'read_only', notes: ''
  })
  
  const customFieldsPagination = usePagination(invoiceCustomFields)
  const remindersPagination = usePagination(reminders)
  const caSharesPagination = usePagination(caShares)
  
  // Account state
  const [passwordChange, setPasswordChange] = useState({
    current_password: '', new_password: '', confirm_password: ''
  })
  
  // Image crop state
  const [showLogoCrop, setShowLogoCrop] = useState(false)
  const [showSignatureCrop, setShowSignatureCrop] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [croppedImage, setCroppedImage] = useState<Blob | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchAllData()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'users') {
      router.replace('/user-management')
      return
    }
    if (tab) setActiveTab(tab)
  }, [searchParams, router])

  useEffect(() => {
    if (activeTab === 'reminders' && !remindersEnabled) {
      setActiveTab('business')
    } else if (activeTab === 'ca' && !caShareEnabled) {
      setActiveTab('business')
    }
  }, [activeTab, remindersEnabled, caShareEnabled])

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchBusiness(),
        fetchInvoiceSettings(),
        fetchInvoiceCustomFields(),
        fetchReminders(),
        fetchCaShares(),
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBusiness = async () => {
    try {
      const res = await apiFetch('/business')
      if (res.ok) {
        const data = await res.json()
        setBusiness(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchInvoiceSettings = async () => {
    try {
      const res = await apiFetch('/settings/invoice')
      if (res.ok) {
        const data = await res.json()
        setInvoiceSettings(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchInvoiceCustomFields = async () => {
    try {
      const res = await apiFetch('/settings/invoice-custom-fields')
      if (res.ok) setInvoiceCustomFields(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  const createCustomField = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await apiFetch('/settings/invoice-custom-fields', {
      method: 'POST',
      body: JSON.stringify(newCustomField),
    })
    if (res.ok) {
      setMessage('Custom field added')
      setNewCustomField({ label: '', field_key: '', field_type: 'text', is_required: false, show_on_pdf: true, sort_order: 0 })
      await fetchInvoiceCustomFields()
    } else {
      setMessage('Failed to add custom field')
    }
    setSaving(false)
  }

  const deleteCustomField = async (id: string) => {
    if (!(await confirm({
      title: 'Delete custom field?',
      description: 'Are you sure you want to delete this custom field? This action cannot be undone.',
    }))) return
    await apiFetch(`/settings/invoice-custom-fields/${id}`, { method: 'DELETE' })
    await fetchInvoiceCustomFields()
  }

  const fetchReminders = async () => {
    try {
      const res = await apiFetch('/settings/reminders')
      if (res.ok) {
        const data = await res.json()
        setReminders(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchCaShares = async () => {
    try {
      const res = await apiFetch('/settings/ca-sharing')
      if (res.ok) {
        const data = await res.json()
        setCaShares(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const handleBusinessSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/business', {
        method: 'PUT',
        body: JSON.stringify(business),
      })
      if (res.ok) {
        setMessage('Business details updated successfully!')
      } else {
        setMessage('Failed to update business details')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Read file and show crop modal
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string)
      setShowLogoCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Read file and show crop modal
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string)
      setShowSignatureCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const handleLogoCropComplete = async (croppedBlob: Blob) => {
    setCroppedImage(croppedBlob)
    setShowLogoCrop(false)

    const formData = new FormData()
    formData.append('logo', croppedBlob, 'logo.png')

    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/business/upload-logo', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setBusiness(prev => ({ ...prev, logo_url: data.logo_url }))
        setMessage('Logo uploaded successfully!')
      } else {
        const errorData = await res.json()
        setMessage(errorData.error || 'Failed to upload logo')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveLogo = async () => {
    if (!business.logo_url) return
    const confirmed = await confirm({
      title: 'Remove business logo?',
      description: 'This will clear the logo from invoices and other documents. You can upload a new one anytime.',
      confirmLabel: 'Remove logo',
      variant: 'destructive',
    })
    if (!confirmed) return

    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/business/logo', { method: 'DELETE' })
      if (res.ok) {
        setBusiness(prev => ({ ...prev, logo_url: '' }))
        const logoInput = document.getElementById('logo') as HTMLInputElement | null
        if (logoInput) logoInput.value = ''
        setMessage('Logo removed successfully!')
      } else {
        const errorData = await res.json().catch(() => ({}))
        setMessage(errorData.error || 'Failed to remove logo')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSignatureCropComplete = async (croppedBlob: Blob) => {
    setCroppedImage(croppedBlob)
    setShowSignatureCrop(false)

    const formData = new FormData()
    formData.append('signature', croppedBlob, 'signature.png')

    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/business/upload-signature', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        setBusiness(prev => ({ ...prev, signature_url: data.signature_url }))
        setMessage('Signature uploaded successfully!')
      } else {
        const errorData = await res.json()
        setMessage(errorData.error || 'Failed to upload signature')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleInvoiceSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/invoice', {
        method: 'PUT',
        body: JSON.stringify(invoiceSettings),
      })
      if (res.ok) {
        setMessage('Invoice settings updated successfully!')
      } else {
        setMessage('Failed to update invoice settings')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/reminders', {
        method: 'POST',
        body: JSON.stringify(newReminder),
      })
      if (res.ok) {
        setMessage('Reminder created successfully!')
        setNewReminder({ title: '', description: '', reminder_date: '', reminder_type: 'custom', repeat: 'once' })
        fetchReminders()
      } else {
        setMessage('Failed to create reminder')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCaShare = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/ca-sharing', {
        method: 'POST',
        body: JSON.stringify(newCaShare),
      })
      if (res.ok) {
        setMessage('CA report sharing created successfully!')
        setNewCaShare({ ca_email: '', ca_name: '', access_level: 'read_only', notes: '' })
        fetchCaShares()
      } else {
        setMessage('Failed to create CA report sharing')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordChange.new_password !== passwordChange.confirm_password) {
      setMessage('Passwords do not match')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const res = await apiFetch('/settings/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordChange.current_password,
          new_password: passwordChange.new_password,
        }),
      })
      if (res.ok) {
        setMessage('Password changed successfully!')
        setPasswordChange({ current_password: '', new_password: '', confirm_password: '' })
      } else {
        setMessage('Failed to change password')
      }
    } catch (err) {
      setMessage('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteReminder = async (id: string) => {
    if (!(await confirm({
      title: 'Delete reminder?',
      description: 'Are you sure you want to delete this reminder? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/settings/reminders/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchReminders()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCaShare = async (id: string) => {
    if (!(await confirm({
      title: 'Delete CA share?',
      description: 'Are you sure you want to remove this CA share entry? This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/settings/ca-sharing/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCaShares()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleChange = (field: string, value: any, setter: any) => {
    setter((prev: any) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="app-page-subheader">
          <h1 className="app-page-title">Settings</h1>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {message && (
          <div className={`rounded-lg p-3 text-sm ${message.includes('success') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className={`grid w-full grid-cols-4 ${
              remindersEnabled && caShareEnabled
                ? 'lg:grid-cols-9'
                : remindersEnabled || caShareEnabled
                  ? 'lg:grid-cols-8'
                  : 'lg:grid-cols-7'
            }`}
          >
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden lg:inline">Business</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden lg:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden lg:inline">Appearance</span>
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Invoice</span>
            </TabsTrigger>
            <TabsTrigger value="print" className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              <span className="hidden lg:inline">Print</span>
            </TabsTrigger>
            <TabsTrigger value="weighing-scale" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden lg:inline">Scale</span>
            </TabsTrigger>
            {remindersEnabled && (
              <TabsTrigger value="reminders" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden lg:inline">Reminders</span>
              </TabsTrigger>
            )}
            {caShareEnabled && (
              <TabsTrigger value="ca" className="flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                <span className="hidden lg:inline">CA Share</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="help" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden lg:inline">Help</span>
            </TabsTrigger>
          </TabsList>

          {/* Business Settings Tab */}
          <TabsContent value="business">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <CardTitle>Manage Business</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBusinessSubmit} className="space-y-6">
                  {/* Logo and Signature Upload */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="logo">Business Logo</Label>
                      <div className="space-y-2">
                        {business.logo_url && (
                          <div className="relative h-32 w-full rounded-lg border border-gray-200 bg-gray-50">
                            <img 
                              src={business.logo_url} 
                              alt="Business Logo" 
                              className="h-full w-full object-contain p-2"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute right-2 top-2 gap-1.5"
                              onClick={handleRemoveLogo}
                              disabled={saving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </div>
                        )}
                        <Input 
                          id="logo" 
                          type="file" 
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={saving}
                        />
                        <p className="text-xs text-gray-500">Upload your business logo (JPG, PNG, GIF, WebP)</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signature">Signature</Label>
                      <div className="space-y-2">
                        {business.signature_url && (
                          <div className="relative h-32 w-full rounded-lg border border-gray-200 bg-gray-50">
                            <img 
                              src={business.signature_url} 
                              alt="Signature" 
                              className="h-full w-full object-contain p-2"
                            />
                          </div>
                        )}
                        <Input 
                          id="signature" 
                          type="file" 
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          disabled={saving}
                        />
                        <p className="text-xs text-gray-500">Upload your signature (JPG, PNG, GIF, WebP)</p>
                      </div>
                    </div>
                  </div>

                  {/* Business Details */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Business Name *</Label>
                      <Input id="name" value={business.name} onChange={(e) => handleChange('name', e.target.value, setBusiness)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <Input id="gstin" value={business.gstin} onChange={(e) => handleChange('gstin', e.target.value, setBusiness)} placeholder="22AAAAA0000A1Z5" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" value={business.address} onChange={(e) => handleChange('address', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={business.city} onChange={(e) => handleChange('city', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={business.state} onChange={(e) => handleChange('state', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input id="pincode" value={business.pincode} onChange={(e) => handleChange('pincode', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={business.phone} onChange={(e) => handleChange('phone', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={business.email} onChange={(e) => handleChange('email', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input id="bank_name" value={business.bank_name} onChange={(e) => handleChange('bank_name', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_number">Account Number</Label>
                      <Input id="account_number" value={business.account_number} onChange={(e) => handleChange('account_number', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc_code">IFSC Code</Label>
                      <Input id="ifsc_code" value={business.ifsc_code} onChange={(e) => handleChange('ifsc_code', e.target.value, setBusiness)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="upi_id">UPI ID</Label>
                      <Input id="upi_id" value={business.upi_id} onChange={(e) => handleChange('upi_id', e.target.value, setBusiness)} />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input id="current_password" type="password" value={passwordChange.current_password} onChange={(e) => handleChange('current_password', e.target.value, setPasswordChange)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input id="new_password" type="password" value={passwordChange.new_password} onChange={(e) => handleChange('new_password', e.target.value, setPasswordChange)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input id="confirm_password" type="password" value={passwordChange.confirm_password} onChange={(e) => handleChange('confirm_password', e.target.value, setPasswordChange)} required minLength={6} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettingsCard />
          </TabsContent>

          {/* Invoice Settings Tab */}
          <TabsContent value="invoice">
            <Card className="mb-6 border-blue-100 bg-blue-50/40">
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Invoice template &amp; appearance</p>
                  <p className="text-sm text-muted-foreground">
                    Choose themes, colors, and which fields appear on your GST invoice PDF.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/settings/invoice-template">Customize template</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <CardTitle>Invoice Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvoiceSettingsSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="template">Template</Label>
                      <Select value={invoiceSettings.template} onValueChange={(value) => handleChange('template', value, setInvoiceSettings)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stylish">Stylish</SelectItem>
                          <SelectItem value="luxury">Luxury</SelectItem>
                          <SelectItem value="advanced_gst">Advanced GST (Tally)</SelectItem>
                          <SelectItem value="classic">Classic</SelectItem>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="theme">Theme</Label>
                      <Select value={invoiceSettings.theme} onValueChange={(value) => handleChange('theme', value, setInvoiceSettings)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primary_color">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input id="primary_color" type="color" value={invoiceSettings.primary_color} onChange={(e) => handleChange('primary_color', e.target.value, setInvoiceSettings)} className="w-20 h-10" />
                        <Input value={invoiceSettings.primary_color} onChange={(e) => handleChange('primary_color', e.target.value, setInvoiceSettings)} className="flex-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondary_color">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input id="secondary_color" type="color" value={invoiceSettings.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value, setInvoiceSettings)} className="w-20 h-10" />
                        <Input value={invoiceSettings.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value, setInvoiceSettings)} className="flex-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                      <Input id="invoice_prefix" value={invoiceSettings.invoice_prefix} onChange={(e) => handleChange('invoice_prefix', e.target.value, setInvoiceSettings)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="starting_number">Starting Number</Label>
                      <Input id="starting_number" type="number" value={invoiceSettings.starting_number} onChange={(e) => handleChange('starting_number', parseInt(e.target.value), setInvoiceSettings)} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_logo">Show Logo</Label>
                      <Switch id="show_logo" checked={invoiceSettings.show_logo} onCheckedChange={(checked) => handleChange('show_logo', checked, setInvoiceSettings)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_signature">Show Signature</Label>
                      <Switch id="show_signature" checked={invoiceSettings.show_signature} onCheckedChange={(checked) => handleChange('show_signature', checked, setInvoiceSettings)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_bank_details">Show Bank Details</Label>
                      <Switch id="show_bank_details" checked={invoiceSettings.show_bank_details} onCheckedChange={(checked) => handleChange('show_bank_details', checked, setInvoiceSettings)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_terms">Show Terms</Label>
                      <Switch id="show_terms" checked={invoiceSettings.show_terms} onCheckedChange={(checked) => handleChange('show_terms', checked, setInvoiceSettings)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_terms">Default Terms</Label>
                    <Textarea id="default_terms" value={invoiceSettings.default_terms} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('default_terms', e.target.value, setInvoiceSettings)} rows={3} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Invoice Settings
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Invoice custom fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Define extra fields for sales invoices (PO number, project code, etc.). Values appear on the invoice form and optionally on PDF.
                </p>
                <form onSubmit={createCustomField} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={newCustomField.label}
                      onChange={(e) => setNewCustomField({ ...newCustomField, label: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Field key</Label>
                    <Input
                      value={newCustomField.field_key}
                      onChange={(e) => setNewCustomField({ ...newCustomField, field_key: e.target.value })}
                      placeholder="po_number"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newCustomField.field_type}
                      onValueChange={(v) => setNewCustomField({ ...newCustomField, field_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="boolean">Yes / No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-3 sm:justify-end">
                    <div className="flex items-center justify-between">
                      <Label>Required</Label>
                      <Switch
                        checked={newCustomField.is_required}
                        onCheckedChange={(c) => setNewCustomField({ ...newCustomField, is_required: c })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Show on PDF</Label>
                      <Switch
                        checked={newCustomField.show_on_pdf}
                        onCheckedChange={(c) => setNewCustomField({ ...newCustomField, show_on_pdf: c })}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={saving}>Add custom field</Button>
                  </div>
                </form>
                {invoiceCustomFields.length > 0 && (
                  <ul className="divide-y rounded-md border">
                    {customFieldsPagination.paginatedItems.map((f) => (
                      <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{f.label}</span>
                          <span className="ml-2 text-muted-foreground">({f.field_key} · {f.field_type})</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteCustomField(f.id)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <PaginationControls
                  page={customFieldsPagination.page}
                  totalPages={customFieldsPagination.totalPages}
                  totalItems={customFieldsPagination.totalItems}
                  pageSize={customFieldsPagination.pageSize}
                  onPageChange={customFieldsPagination.setPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="print">
            <PrintSettingsCard />
          </TabsContent>

          <TabsContent value="weighing-scale">
            <WeighingScaleSettingsCard />
          </TabsContent>

          {/* Reminders Tab */}
          {remindersEnabled && (
          <TabsContent value="reminders">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle>Reminders</CardTitle>
                  <p className="mt-1 text-sm font-normal text-gray-500">
                    Configure invoice due, payment, SMS, WhatsApp, email, and internal alerts on the{' '}
                    <a href="/notifications" className="text-blue-600 hover:underline">
                      Notifications &amp; Reminders
                    </a>{' '}
                    page.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleCreateReminder} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reminder_title">Title *</Label>
                      <Input id="reminder_title" value={newReminder.title} onChange={(e) => handleChange('title', e.target.value, setNewReminder)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder_date">Date *</Label>
                      <Input id="reminder_date" type="date" value={newReminder.reminder_date} onChange={(e) => handleChange('reminder_date', e.target.value, setNewReminder)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder_type">Type</Label>
                      <Select value={newReminder.reminder_type} onValueChange={(value) => handleChange('reminder_type', value, setNewReminder)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payment_due">Payment Due</SelectItem>
                          <SelectItem value="invoice_overdue">Invoice Overdue</SelectItem>
                          <SelectItem value="tax_filing">Tax Filing</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminder_repeat">Repeat</Label>
                      <Select value={newReminder.repeat} onValueChange={(value) => handleChange('repeat', value, setNewReminder)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">Once</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminder_description">Description</Label>
                    <Textarea id="reminder_description" value={newReminder.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value, setNewReminder)} rows={2} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Add Reminder
                  </Button>
                </form>

                <div className="space-y-2">
                  <h3 className="font-semibold">Your Reminders</h3>
                  <div className="space-y-2">
                    {remindersPagination.paginatedItems.map((reminder) => (
                      <div key={reminder.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{reminder.title}</p>
                          <p className="text-sm text-gray-500">{new Date(reminder.reminder_date).toLocaleDateString()} - {reminder.reminder_type}</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteReminder(reminder.id)}>
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                  <PaginationControls
                    page={remindersPagination.page}
                    totalPages={remindersPagination.totalPages}
                    totalItems={remindersPagination.totalItems}
                    pageSize={remindersPagination.pageSize}
                    onPageChange={remindersPagination.setPage}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* CA Report Sharing Tab */}
          {caShareEnabled && (
          <TabsContent value="ca">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-600" />
                <CardTitle>CA Report Sharing (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleCreateCaShare} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ca_email">CA Email *</Label>
                      <Input id="ca_email" type="email" value={newCaShare.ca_email} onChange={(e) => handleChange('ca_email', e.target.value, setNewCaShare)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ca_name">CA Name</Label>
                      <Input id="ca_name" value={newCaShare.ca_name} onChange={(e) => handleChange('ca_name', e.target.value, setNewCaShare)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="access_level">Access Level</Label>
                      <Select value={newCaShare.access_level} onValueChange={(value) => handleChange('access_level', value, setNewCaShare)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read_only">Read Only</SelectItem>
                          <SelectItem value="full_access">Full Access</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ca_notes">Notes</Label>
                    <Textarea id="ca_notes" value={newCaShare.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('notes', e.target.value, setNewCaShare)} rows={2} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Add CA Sharing
                  </Button>
                </form>

                <div className="space-y-2">
                  <h3 className="font-semibold">CA Report Shares</h3>
                  <div className="space-y-2">
                    {caSharesPagination.paginatedItems.map((share) => (
                      <div key={share.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{share.ca_name || share.ca_email}</p>
                          <p className="text-sm text-gray-500">{share.ca_email} - {share.access_level}</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteCaShare(share.id)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <PaginationControls
                    page={caSharesPagination.page}
                    totalPages={caSharesPagination.totalPages}
                    totalItems={caSharesPagination.totalItems}
                    pageSize={caSharesPagination.pageSize}
                    onPageChange={caSharesPagination.setPage}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Help & Support Tab */}
          <TabsContent value="help" className="space-y-6">
            <DesktopUpdatesCard />
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                <CardTitle>Help And Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Documentation</h3>
                  <p className="text-sm text-gray-600">Access our comprehensive documentation to learn how to use all features effectively.</p>
                  <Button variant="outline">View Documentation</Button>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">Contact Support</h3>
                  <p className="text-sm text-gray-600">Need help? Contact our support team for assistance.</p>
                  <Button variant="outline">Contact Support</Button>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold">FAQ</h3>
                  <p className="text-sm text-gray-600">Find answers to commonly asked questions.</p>
                  <Button variant="outline">View FAQ</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Image Crop Modals */}
        <ImageCropModal
          isOpen={showLogoCrop}
          onClose={() => setShowLogoCrop(false)}
          imageSrc={selectedImage}
          onCropComplete={handleLogoCropComplete}
          aspectRatio={1}
          circularCrop={false}
        />

        <ImageCropModal
          isOpen={showSignatureCrop}
          onClose={() => setShowSignatureCrop(false)}
          imageSrc={selectedImage}
          onCropComplete={handleSignatureCropComplete}
          aspectRatio={2}
          circularCrop={false}
        />
      </div>
      {confirmDialog}
    </DashboardLayout>
  )
}
