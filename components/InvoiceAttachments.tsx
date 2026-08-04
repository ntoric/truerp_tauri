'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Paperclip, Trash2, Upload, ExternalLink } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'

export interface InvoiceAttachment {
  id: string
  original_name: string
  public_url: string
  file_size: number
  mime_type: string
  created_at: string
}

interface InvoiceAttachmentsProps {
  invoiceId: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InvoiceAttachments({ invoiceId }: InvoiceAttachmentsProps) {
  const [files, setFiles] = useState<InvoiceAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const res = await apiFetch(`/invoices/${invoiceId}/attachments`)
      if (res.ok) setFiles(await res.json())
    } catch {
      notifyError('Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (invoiceId) load()
  }, [invoiceId])

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch(`/invoices/${invoiceId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        notifySuccess('Document attached')
        await load()
      } else {
        const err = await res.json().catch(() => ({}))
        notifyError(err.error || 'Upload failed')
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('Remove this attachment?')) return
    const res = await apiFetch(`/invoices/${invoiceId}/attachments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notifySuccess('Attachment removed')
      setFiles((prev) => prev.filter((f) => f.id !== id))
    } else {
      notifyError('Failed to delete attachment')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Paperclip className="h-4 w-4" />
          Attached documents
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Uploading…' : 'Attach file'}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={onUpload} />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading attachments…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents attached yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{f.original_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(f.file_size)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="sm" asChild>
                  <a href={f.public_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(f.id)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
