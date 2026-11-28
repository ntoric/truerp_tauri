'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Check, Copy, ExternalLink, Image as ImageIcon, Info, ListOrdered, Phone, Reply, Search, Sparkles } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import {
  WHATSAPP_TEMPLATE_SAMPLES,
  campaignTypeLabel,
  copyText,
  templateAsText,
  type WATemplateSample,
} from '@/lib/marketing'

/** Small copy button that flips to a check mark for a moment. */
function CopyButton({ text, label, size = 'sm' }: { text: string; label: string; size?: 'sm' | 'icon' }) {
  const [done, setDone] = useState(false)
  const onCopy = async () => {
    if (await copyText(text)) {
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } else {
      notifyError('Could not copy to the clipboard')
    }
  }
  if (size === 'icon') {
    return (
      <button
        type="button"
        onClick={onCopy}
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    )
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onCopy} className="gap-1.5">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </Button>
  )
}

/** Renders WhatsApp-style *bold* and {{n}} chips for the phone preview. */
function formatBubble(text: string) {
  return text.split(/(\*[^*\n]+\*|\{\{\d+\}\})/g).map((part, i) => {
    if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>
    if (/^\{\{\d+\}\}$/.test(part))
      return (
        <span key={i} className="rounded bg-emerald-100 px-1 font-mono text-[11px] text-emerald-800">
          {part}
        </span>
      )
    return <span key={i}>{part}</span>
  })
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <CopyButton text={value} label={label.toLowerCase()} size="icon" />
      </div>
      <div className={`whitespace-pre-wrap break-words rounded-md border bg-muted/40 px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  )
}

function TemplateCard({ t, onUse }: { t: WATemplateSample; onUse: (t: WATemplateSample) => void }) {
  return (
    <Card id={templateAnchor(t.id)} className="scroll-mt-[calc(var(--app-header-h)+1rem)] overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 border-b bg-muted/20 pb-4">
        <div className="min-w-0">
          <CardTitle className="text-base">{t.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-600/20">{t.category}</span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 ring-1 ring-sky-600/20">
              {t.languageLabel} ({t.language})
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted-foreground ring-1 ring-border">{campaignTypeLabel(t.campaignType)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={templateAsText(t)} label="Copy all" />
          <Button type="button" size="sm" onClick={() => onUse(t)} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Use in campaign
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Template name" value={t.name} mono />
          {t.header.type === 'text' && <Field label="Header (text)" value={t.header.text} />}
          {t.header.type === 'image' && (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b className="text-foreground">Header: Image.</b> Upload any sample banner when creating the template. The campaign&apos;s
                image URL is sent as the real image.
              </span>
            </div>
          )}
          <Field label="Body" value={t.body} />
          {t.footer && <Field label="Footer" value={t.footer} />}
          {t.buttons.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Buttons</span>
              <ul className="space-y-1 text-sm">
                {t.buttons.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {b.type === 'QUICK_REPLY' ? 'Quick reply' : b.type === 'URL' ? 'Visit website' : 'Call phone number'}
                    </span>
                    <span>{b.text}</span>
                    {b.value && <span className="truncate font-mono text-xs text-muted-foreground">{b.value}</span>}
                    <CopyButton text={b.text} label="button text" size="icon" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variable samples (Meta asks for these)</span>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Variable</th>
                    <th className="px-3 py-1.5 font-medium">Sample</th>
                    <th className="px-3 py-1.5 font-medium">Filled when sending with</th>
                  </tr>
                </thead>
                <tbody>
                  {t.variables.map((v, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono text-xs">{`{{${i + 1}}}`}</td>
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1">
                          {v.sample}
                          <CopyButton text={v.sample} label={`sample ${i + 1}`} size="icon" />
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{v.placeholder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Phone preview */}
        <div className="rounded-2xl bg-[#e5ddd5] p-3 dark:bg-emerald-950/40">
          <div className="rounded-lg bg-white p-2.5 text-[13px] leading-snug text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100">
            {t.header.type === 'image' && (
              <div className="mb-2 flex aspect-[1.9] items-center justify-center rounded-md bg-gradient-to-br from-amber-200 to-rose-200 text-amber-900">
                <ImageIcon className="h-6 w-6 opacity-60" />
              </div>
            )}
            {t.header.type === 'text' && <div className="mb-1 font-semibold">{t.header.text}</div>}
            <div className="whitespace-pre-wrap">{formatBubble(t.body)}</div>
            {t.footer && <div className="mt-1.5 text-[11px] text-slate-500">{t.footer}</div>}
          </div>
          {t.buttons.map((b, i) => (
            <div
              key={i}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-white py-1.5 text-[13px] font-medium text-sky-600 shadow-sm dark:bg-slate-900"
            >
              {b.type === 'URL' ? <ExternalLink className="h-3.5 w-3.5" /> : b.type === 'PHONE_NUMBER' ? <Phone className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
              {b.text}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const templateAnchor = (id: string) => `wa-template-${id}`

/** Side index of the visible templates; highlights the one in view and jumps to it on click. */
/** True when the list is its own scroll box (desktop); on phones the page scrolls instead. */
const listScrolls = (el: HTMLElement | null): el is HTMLElement => el != null && el.scrollHeight > el.clientHeight

function TemplateIndex({ templates, listRef }: { templates: WATemplateSample[]; listRef: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const els = templates.map((t) => document.getElementById(templateAnchor(t.id))).filter((el): el is HTMLElement => el != null)
    if (els.length === 0) return
    const visible = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top)
          else visible.delete(e.target.id)
        }
        // The topmost card that is still on screen wins.
        let best: string | null = null
        let bestTop = Infinity
        visible.forEach((top, id) => {
          if (top < bestTop) {
            bestTop = top
            best = id
          }
        })
        if (best) setActive(best)
      },
      listScrolls(listRef.current)
        ? { root: listRef.current, rootMargin: '0px 0px -45% 0px' }
        : { rootMargin: '-80px 0px -45% 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [templates, listRef])

  const jump = (id: string) => {
    const el = document.getElementById(templateAnchor(id))
    if (!el) return
    const list = listRef.current
    if (listScrolls(list)) {
      // Scroll only the template list, never the page or the index card.
      const top = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
      list.scrollTo({ top, behavior: 'smooth' })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setActive(templateAnchor(id))
  }

  return (
    <Card className="lg:flex lg:max-h-full lg:flex-col">
      <CardHeader className="space-y-0 border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListOrdered className="h-4 w-4 text-muted-foreground" />
          Index
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{templates.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 lg:min-h-0 lg:flex-1">
        {templates.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No templates</p>
        ) : (
          <nav className="max-h-48 space-y-0.5 overflow-y-auto lg:h-full lg:max-h-none">
            {templates.map((t, i) => {
              const isActive = active === templateAnchor(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => jump(t.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="mt-px w-5 shrink-0 text-right font-mono text-[11px] opacity-70">{i + 1}.</span>
                  <span className="min-w-0">
                    <span className="block truncate">{t.title}</span>
                    <span className="block truncate text-[11px] font-normal opacity-70">
                      {t.languageLabel} · {campaignTypeLabel(t.campaignType)}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>
        )}
      </CardContent>
    </Card>
  )
}

export default function WhatsAppTemplateLibrary() {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const templates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return WHATSAPP_TEMPLATE_SAMPLES
    return WHATSAPP_TEMPLATE_SAMPLES.filter((t) =>
      [t.title, t.description, t.name, t.languageLabel, campaignTypeLabel(t.campaignType)].some((s) => s.toLowerCase().includes(q))
    )
  }, [search])

  const applyTemplate = (t: WATemplateSample) => {
    notifySuccess(`Make sure "${t.name}" is approved in your WhatsApp account before sending.`, { title: 'Template applied' })
    router.push(`/marketing/editor?template=${encodeURIComponent(t.id)}`)
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates" className="pl-9" />
      </div>

      <div className="grid items-start gap-5 lg:h-[calc(100vh-var(--app-header-h)-2rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:h-full lg:min-h-0">
          <TemplateIndex templates={templates} listRef={listRef} />
        </aside>
        <div ref={listRef} className="min-w-0 space-y-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {templates.map((t) => (
            <TemplateCard key={t.id} t={t} onUse={applyTemplate} />
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground">No template matches &quot;{search}&quot;.</p>}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5 text-sm">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div className="space-y-2">
              <p>
                WhatsApp only lets businesses start a conversation with a <b>pre-approved template</b>. Copy one of these samples into your
                provider, wait for approval (usually minutes, at most 24 hours), then use its name in a campaign.
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>
                  <b className="text-foreground">Meta WhatsApp Cloud API</b>: WhatsApp Manager → Message templates → Create template → Marketing
                  → Default. Paste the name, header, body, footer and buttons, then fill the sample values.
                </li>
                <li>
                  <b className="text-foreground">Fast2SMS</b>: WhatsApp → Templates → Create. Same fields; the template is submitted to Meta for
                  you.
                </li>
                <li>
                  <b className="text-foreground">Twilio</b>: Content Template Builder → Create (type &quot;Card&quot; for image templates, otherwise
                  &quot;Text&quot;) → submit for WhatsApp approval. Use the <b>Content SID (HX…)</b> as the template name in the campaign.
                </li>
              </ol>
              <p className="text-muted-foreground">
                Variables are numbered <code className="font-mono">{'{{1}}'}</code>, <code className="font-mono">{'{{2}}'}</code>… The campaign
                fills them per customer (customer name, discount, code…). Keep the opt-out button: it lowers the chance of your number being
                reported.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
