'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { FormPageSkeleton } from '@/components/layout/PageSkeleton'
import ImageCropModal from '@/components/ImageCropModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Crop, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { isSuperAdmin } from '@/lib/roles'
import { notifyError, notifySuccess } from '@/lib/notify'
import { logoAspectRatioValue, type LogoAspectRatio } from '@/lib/logoAspect'
import {
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminUpdateAnnouncement,
  uploadAnnouncementImage,
  resolveMediaUrl,
  ANNOUNCEMENT_TYPES,
  type Announcement,
  type AnnouncementType,
} from '@/lib/announcements'

interface AnnouncementForm {
  title: string
  body: string
  type: AnnouncementType
  image_url: string
  link_url: string
  link_label: string
  is_active: boolean
  starts_at: string
  ends_at: string
}

const emptyForm: AnnouncementForm = {
  title: '',
  body: '',
  type: 'announcement',
  image_url: '',
  link_url: '',
  link_label: '',
  is_active: true,
  starts_at: '',
  ends_at: '',
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function announcementToForm(a: Announcement): AnnouncementForm {
  return {
    title: a.title,
    body: a.body,
    type: a.type,
    image_url: a.image_url,
    link_url: a.link_url,
    link_label: a.link_label,
    is_active: a.is_active,
    starts_at: toLocalInput(a.starts_at),
    ends_at: toLocalInput(a.ends_at),
  }
}

type AnnouncementStatus = 'inactive' | 'scheduled' | 'active' | 'expired'

function announcementStatus(a: Announcement): AnnouncementStatus {
  const now = new Date()
  if (!a.is_active) return 'inactive'
  if (a.ends_at && new Date(a.ends_at) < now) return 'expired'
  if (a.starts_at && new Date(a.starts_at) > now) return 'scheduled'
  return 'active'
}

const STATUS_BADGE: Record<AnnouncementStatus, { label: string; className: string }> = {
  inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600' },
  scheduled: { label: 'Scheduled', className: 'bg-sky-100 text-sky-700' },
  active: { label: 'Live', className: 'bg-emerald-100 text-emerald-700' },
  expired: { label: 'Expired', className: 'bg-amber-100 text-amber-700' },
}

function typeLabel(type: string): string {
  return ANNOUNCEMENT_TYPES.find((t) => t.value === type)?.label ?? 'Announcement'
}

export default function AnnouncementsPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = isSuperAdmin(user?.role)
  const { confirm, confirmDialog } = useConfirmDialog()

  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<AnnouncementForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Image crop/upload state
  const [cropSource, setCropSource] = useState('')
  const [showCrop, setShowCrop] = useState(false)
  const [aspectKey, setAspectKey] = useState<LogoAspectRatio>('landscape')
  const [outputMaxSize, setOutputMaxSize] = useState(1200)
  const [uploadingImage, setUploadingImage] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await adminListAnnouncements())
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAdmin) load()
    if (!authLoading && !isAdmin) setLoading(false)
  }, [authLoading, isAdmin, load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm(announcementToForm(a))
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) {
      notifyError('Title is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body,
        type: form.type,
        image_url: form.image_url,
        link_url: form.link_url.trim(),
        link_label: form.link_label.trim(),
        is_active: form.is_active,
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
      }
      if (editing) {
        await adminUpdateAnnouncement(editing.id, payload)
        notifySuccess('Announcement updated.')
      } else {
        await adminCreateAnnouncement(payload)
        notifySuccess('Announcement published.')
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (a: Announcement) => {
    try {
      await adminUpdateAnnouncement(a.id, {
        title: a.title,
        body: a.body,
        type: a.type,
        image_url: a.image_url,
        link_url: a.link_url,
        link_label: a.link_label,
        is_active: !a.is_active,
        starts_at: a.starts_at ?? null,
        ends_at: a.ends_at ?? null,
      })
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to update announcement')
    }
  }

  const remove = async (a: Announcement) => {
    if (
      !(await confirm({
        title: 'Delete announcement?',
        description: `"${a.title}" will be removed for all users.`,
        variant: 'destructive',
      }))
    )
      return
    try {
      await adminDeleteAnnouncement(a.id)
      notifySuccess('Announcement deleted.')
      await load()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to delete announcement')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSource(reader.result as string)
      setShowCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (blob: Blob) => {
    setShowCrop(false)
    setUploadingImage(true)
    try {
      const url = await uploadAnnouncementImage(blob, 'announcement.jpg')
      setForm((f) => ({ ...f, image_url: url }))
      notifySuccess('Image uploaded.')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to upload image')
    } finally {
      setUploadingImage(false)
      setCropSource('')
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <FormPageSkeleton />
      </DashboardLayout>
    )
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>Only super admins can manage announcements.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-3">
        <PageHeader
          title="Announcements"
          actions={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New announcement
            </Button>
          }
        />
        <p className="text-sm text-gray-500">
          Publish announcements, reminders, release notes and other updates. Live announcements appear
          to every signed-in user as a toast card on the dashboard.
        </p>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No announcements yet. Create one to broadcast it to all users.
            </CardContent>
          </Card>
        ) : (
          items.map((a) => {
            const status = announcementStatus(a)
            const badge = STATUS_BADGE[status]
            return (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{a.title}</CardTitle>
                        <Badge variant="outline">{typeLabel(a.type)}</Badge>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </div>
                      <CardDescription className="line-clamp-2 max-w-2xl">
                        {a.body || 'No message body'}
                      </CardDescription>
                      <CardDescription className="text-xs">
                        Created {new Date(a.created_at).toLocaleString('en-IN')}
                        {a.starts_at && ` · starts ${new Date(a.starts_at).toLocaleString('en-IN')}`}
                        {a.ends_at && ` · ends ${new Date(a.ends_at).toLocaleString('en-IN')}`}
                        {a.image_url && ' · has image'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                      <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => remove(a)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {a.image_url && (
                  <CardContent className="pt-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveMediaUrl(a.image_url)} alt={a.title} className="h-24 rounded-lg object-cover" />
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* -------- Create / edit dialog -------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
            <DialogDescription>
              Shown to all signed-in users as a dashboard toast while it is live.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ann-title">Title *</Label>
                <Input
                  id="ann-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. New in v2.4"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as AnnouncementType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Message</Label>
              <Textarea
                id="ann-body"
                rows={5}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write the announcement. Longer messages make a taller card and scroll inside it."
              />
            </div>

            {/* Image upload with crop & resize */}
            <div className="space-y-2">
              <Label>Image (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="file" accept="image/*" className="max-w-xs" onChange={handleFileSelect} />
                {form.image_url && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCropSource(resolveMediaUrl(form.image_url))
                        setShowCrop(true)
                      }}
                    >
                      <Crop className="mr-2 h-4 w-4" /> Crop & resize
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  </>
                )}
                {uploadingImage && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-gray-500">
                  Output size (max edge): {outputMaxSize}px
                </Label>
                <Slider
                  value={[outputMaxSize]}
                  onValueChange={(v) => setOutputMaxSize(v[0])}
                  min={400}
                  max={2000}
                  step={100}
                />
              </div>
              {form.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(form.image_url)} alt="Announcement" className="h-32 rounded-lg border object-cover" />
              ) : (
                <div className="flex h-24 w-full max-w-xs flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50 text-center text-xs text-gray-500 dark:bg-transparent">
                  <Upload className="mb-1 h-6 w-6 text-gray-400" />
                  No image
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ann-link">Link URL (optional)</Label>
                <Input
                  id="ann-link"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-link-label">Link label</Label>
                <Input
                  id="ann-link-label"
                  value={form.link_label}
                  onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))}
                  placeholder="Learn more"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ann-starts">Starts at (optional)</Label>
                <Input
                  id="ann-starts"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-ends">Ends at (optional)</Label>
                <Input
                  id="ann-ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="ann-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="ann-active">Publish (visible to users)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || uploadingImage}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCrop && cropSource && (
        <ImageCropModal
          isOpen={showCrop}
          onClose={() => {
            setShowCrop(false)
            setCropSource('')
          }}
          imageSrc={cropSource}
          onCropComplete={handleCropComplete}
          aspectRatio={logoAspectRatioValue(aspectKey)}
          outputMaxSize={outputMaxSize}
          showAspectRatioPicker
          aspectRatioKey={aspectKey}
          onAspectRatioKeyChange={setAspectKey}
        />
      )}

      {confirmDialog}
    </DashboardLayout>
  )
}
