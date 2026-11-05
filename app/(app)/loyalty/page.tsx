'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import DashboardLayout from '@/components/layout/DashboardLayout'
import SummaryStat from '@/components/widgets/SummaryStat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { API_BASE, formatCurrency, formatDate } from '@/lib/utils'
import { Gift, Users, History, Save, Loader2, Search, Plus, Minus, CreditCard, Download, Trash2, Move, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { usePagination } from '@/hooks/usePagination'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import PaginationControls from '@/components/ui/pagination-controls'
import { downloadBlob } from '@/lib/accountingExport'
import {
  CARD_THEMES,
  DECOR_OPTIONS,
  DEFAULT_CARD_CONTENT,
  FONT_OPTIONS,
  GRAPHIC_OPTIONS,
  GeneratedLoyaltyCard,
  LoyaltyCardBusiness,
  LoyaltyCardContent,
  LoyaltyCardDesign,
  LoyaltyCardStore,
  NUMBER_FONT_OPTIONS,
  buildCardBackSvg,
  buildCardFrontSvg,
  generateLoyaltyCardsZip,
  prettyCardNumber,
  resolveCardContent,
  resolveCardLayout,
} from '@/lib/loyaltyCards'
import CardLayoutEditor, { CardSide } from '@/components/loyalty/CardLayoutEditor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LoyaltySettings {
  is_enabled: boolean
  spend_amount: number
  points_per_spend: number
  point_value: number
  min_redeem_points: number
  max_redeem_percent: number
}

interface LoyaltyStats {
  total_members: number
  total_points_outstanding: number
  points_earned_this_month: number
  points_redeemed_this_month: number
}

interface LoyaltyCustomer {
  id: string
  name: string
  phone: string
  loyalty_points: number
}

interface LoyaltyTransaction {
  id: string
  party_id: string
  party?: { name: string; phone: string }
  transaction_type: string
  points: number
  balance_after: number
  reference_number: string
  notes: string
  created_at: string
}

interface CardBatch {
  batch_id: string
  count: number
  first_card: string
  last_card: string
  created_at: string
}

interface LinkedParty {
  id: string
  name: string
  phone?: string
}

const emptyCardDesign: LoyaltyCardDesign = {
  theme: 'midnight',
  primary_color: '#0f172a',
  accent_color: '#f59e0b',
  card_prefix: 'LC',
  card_title: '',
  tagline: 'LOYALTY REWARDS',
  footer_text: '',
  show_logo: true,
  show_chip: true,
  include_back: true,
  back_terms: '',
  content: { ...DEFAULT_CARD_CONTENT },
}

/** Front-side content text fields (key → label/placeholder/max length). */
const FRONT_TEXT_FIELDS: { key: keyof LoyaltyCardContent; label: string; placeholder: string; max: number }[] = [
  { key: 'title', label: 'Card title', placeholder: 'Defaults to business name', max: 48 },
  { key: 'tagline', label: 'Tagline', placeholder: 'LOYALTY REWARDS', max: 60 },
  { key: 'store_label', label: 'Top-right label', placeholder: 'Defaults to store name', max: 48 },
  { key: 'member_label', label: 'Member label', placeholder: 'MEMBER / GOLD MEMBER', max: 30 },
  { key: 'footer_text', label: 'Footer line', placeholder: 'Defaults to business phone', max: 80 },
]

const BACK_TEXT_FIELDS: { key: keyof LoyaltyCardContent; label: string; placeholder: string; max: number }[] = [
  { key: 'signature_label', label: 'Signature strip label', placeholder: 'Authorized signature', max: 80 },
  { key: 'terms_heading', label: 'Terms heading', placeholder: 'TERMS & CONDITIONS', max: 60 },
  { key: 'footer_left', label: 'Bottom-left line', placeholder: 'Powered by TruERP Loyalty', max: 80 },
  { key: 'footer_right', label: 'Bottom-right line', placeholder: 'Defaults to contact details', max: 120 },
]

const FRONT_TOGGLES: { key: string; label: string; design?: boolean }[] = [
  { key: 'show_logo', label: 'Logo', design: true },
  { key: 'show_chip', label: 'EMV chip', design: true },
  { key: 'show_title', label: 'Business name' },
  { key: 'show_tagline', label: 'Tagline' },
  { key: 'show_store_name', label: 'Store name' },
  { key: 'show_member', label: 'Member label' },
  { key: 'show_card_number', label: 'Card number' },
  { key: 'show_footer', label: 'Footer line' },
  { key: 'show_barcode', label: 'Barcode' },
  { key: 'show_barcode_caption', label: 'Barcode caption' },
]

const BACK_TOGGLES: { key: keyof LoyaltyCardContent; label: string }[] = [
  { key: 'show_mag_stripe', label: 'Mag stripe' },
  { key: 'show_signature_strip', label: 'Signature strip' },
  { key: 'show_back_number', label: 'Card number' },
  { key: 'show_back_business_name', label: 'Business name' },
  { key: 'show_back_store_name', label: 'Store name' },
  { key: 'show_back_logo', label: 'Logo' },
  { key: 'show_terms', label: 'Terms text' },
  { key: 'show_footer_left', label: 'Bottom-left line' },
  { key: 'show_footer_right', label: 'Bottom-right line' },
]

function resolveAssetUrl(url: string): string {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/.test(url)) return url
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '')
  return url.startsWith('/') ? `${origin}${url}` : `${origin}/${url}`
}

async function fetchAsDataUri(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(resolveAssetUrl(url))
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export default function LoyaltyPage() {
  const [settings, setSettings] = useState<LoyaltySettings>({
    is_enabled: false,
    spend_amount: 100,
    points_per_spend: 1,
    point_value: 1,
    min_redeem_points: 50,
    max_redeem_percent: 25,
  })
  const [stats, setStats] = useState<LoyaltyStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustCustomer, setAdjustCustomer] = useState<LoyaltyCustomer | null>(null)
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<LoyaltyCustomer | null>(null)
  const [historyTxns, setHistoryTxns] = useState<LoyaltyTransaction[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Loyalty card generation
  const [cardDesign, setCardDesign] = useState<LoyaltyCardDesign>(emptyCardDesign)
  const [cardBusiness, setCardBusiness] = useState<LoyaltyCardBusiness | null>(null)
  const [cardStore, setCardStore] = useState<LoyaltyCardStore | null>(null)
  const [cardLogo, setCardLogo] = useState<string | undefined>(undefined)
  const [cardDesignSaving, setCardDesignSaving] = useState(false)
  const [cardCount, setCardCount] = useState('50')
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const [generatedCards, setGeneratedCards] = useState<GeneratedLoyaltyCard[]>([])
  const [cardBatches, setCardBatches] = useState<CardBatch[]>([])
  const [cardSearch, setCardSearch] = useState('')
  const [editingLayout, setEditingLayout] = useState(false)
  const [editSide, setEditSide] = useState<CardSide>('front')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignCard, setAssignCard] = useState<GeneratedLoyaltyCard | null>(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<LoyaltyCustomer[]>([])
  const [assignBusy, setAssignBusy] = useState(false)
  const { confirm, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [settingsRes, statsRes, customersRes, txRes, designRes, cardsRes] = await Promise.all([
        apiFetch('/loyalty/settings'),
        apiFetch('/loyalty/stats'),
        apiFetch('/loyalty/customers'),
        apiFetch('/loyalty/transactions'),
        apiFetch('/loyalty/card-design'),
        apiFetch('/loyalty/cards'),
      ])
      if (settingsRes.ok) setSettings(await settingsRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
      if (customersRes.ok) setCustomers(await customersRes.json())
      if (txRes.ok) setTransactions(await txRes.json())
      if (designRes.ok) {
        const data = await designRes.json()
        if (data.design) setCardDesign({ ...emptyCardDesign, ...data.design })
        if (data.content) {
          setCardDesign((d) => ({ ...d, content: { ...DEFAULT_CARD_CONTENT, ...data.content } }))
        }
        if (data.layout) {
          setCardDesign((d) => ({ ...d, layout: data.layout }))
        }
        if (data.business) setCardBusiness(data.business)
        setCardStore(data.store || null)
        if (data.business?.logo_url) {
          fetchAsDataUri(data.business.logo_url).then(setCardLogo)
        }
      }
      if (cardsRes.ok) {
        const data = await cardsRes.json()
        setGeneratedCards(data.cards || [])
        setCardBatches(data.batches || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('/loyalty/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        notifySuccess('Loyalty settings saved')
        setSettings(await res.json())
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(typeof data.error === 'string' ? data.error : 'Failed to save settings')
      }
    } catch {
      notifyError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const openAdjust = (customer: LoyaltyCustomer) => {
    setAdjustCustomer(customer)
    setAdjustPoints('')
    setAdjustNotes('')
    setAdjustOpen(true)
  }

  const openHistory = async (customer: LoyaltyCustomer) => {
    setHistoryCustomer(customer)
    setHistoryTxns([])
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const res = await apiFetch(`/loyalty/transactions?party_id=${customer.id}`)
      if (res.ok) {
        setHistoryTxns(await res.json())
      } else {
        notifyError('Failed to load points history')
      }
    } catch {
      notifyError('Failed to load points history')
    } finally {
      setHistoryLoading(false)
    }
  }

  const submitAdjust = async () => {
    if (!adjustCustomer) return
    const points = parseInt(adjustPoints, 10)
    if (!points || Number.isNaN(points)) {
      notifyError('Enter a valid points amount (use negative to deduct)')
      return
    }
    setAdjusting(true)
    try {
      const res = await apiFetch(`/loyalty/parties/${adjustCustomer.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ points, notes: adjustNotes }),
      })
      if (res.ok) {
        notifySuccess('Points updated')
        setAdjustOpen(false)
        loadAll()
      } else {
        const data = await res.json().catch(() => ({}))
        notifyError(typeof data.error === 'string' ? data.error : 'Adjustment failed')
      }
    } catch {
      notifyError('Adjustment failed')
    } finally {
      setAdjusting(false)
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  )

  const { page, setPage, totalPages, totalItems, paginatedItems, resetPage, pageSize } = usePagination(filteredCustomers)

  useEffect(() => {
    resetPage()
  }, [search])

  const cardContent = resolveCardContent(cardDesign)
  const setCardContent = (patch: Partial<LoyaltyCardContent>) =>
    setCardDesign((d) => ({
      ...d,
      content: { ...resolveCardContent(d), ...patch },
    }))

  const setCardElement = (side: CardSide, key: string, geom: { x: number; y: number; w?: number; h?: number; size?: number }) =>
    setCardDesign((d) => ({
      ...d,
      layout: {
        ...(d.layout || {}),
        [side]: { ...(d.layout?.[side] || {}), [key]: geom },
      },
    }))

  const saveCardDesign = async () => {
    setCardDesignSaving(true)
    try {
      const res = await apiFetch('/loyalty/card-design', {
        method: 'PUT',
        // Send the fully-resolved layout so the store always reflects exactly
        // what the designer shows (also acts as the reset path).
        body: JSON.stringify({ ...cardDesign, layout: resolveCardLayout(cardDesign) }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        notifySuccess('Card design saved')
        if (data.design) setCardDesign({ ...emptyCardDesign, ...data.design })
        if (data.content) {
          setCardDesign((d) => ({ ...d, content: { ...DEFAULT_CARD_CONTENT, ...data.content } }))
        }
        if (data.layout) {
          setCardDesign((d) => ({ ...d, layout: data.layout }))
        }
        if (data.business) setCardBusiness(data.business)
      } else {
        notifyError(typeof data.error === 'string' ? data.error : 'Failed to save design')
      }
    } catch {
      notifyError('Failed to save design')
    } finally {
      setCardDesignSaving(false)
    }
  }

  const generateAndDownload = async () => {
    const count = parseInt(cardCount, 10)
    if (!count || count < 1 || count > 250) {
      notifyError('Enter a number of cards between 1 and 250')
      return
    }
    setGenerating(true)
    setGenProgress('Reserving card numbers…')
    try {
      const res = await apiFetch('/loyalty/cards/generate', {
        method: 'POST',
        body: JSON.stringify({ count }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        notifyError(typeof data.error === 'string' ? data.error : 'Failed to generate cards')
        return
      }
      const cards: GeneratedLoyaltyCard[] = data.cards || []
      const design: LoyaltyCardDesign = {
        ...emptyCardDesign,
        ...(data.design || cardDesign),
        content: { ...DEFAULT_CARD_CONTENT, ...(data.content || cardDesign.content || {}) },
        layout: data.layout || cardDesign.layout || {},
      }
      const business: LoyaltyCardBusiness | null = data.business || cardBusiness
      const store: LoyaltyCardStore | null = data.store || cardStore
      if (!business) {
        notifyError('Business details unavailable')
        return
      }

      const zipBlob = await generateLoyaltyCardsZip({
        cards,
        design,
        business,
        store,
        batchId: data.batch_id,
        logoDataUri: cardLogo,
        onProgress: (done, total) => setGenProgress(`Rendering card ${done}/${total}…`),
      })
      setGenProgress('Preparing download…')
      const stamp = new Date().toISOString().split('T')[0]
      await downloadBlob(`loyalty-cards-${(store?.code || 'store').toLowerCase()}-${stamp}.zip`, zipBlob, {
        label: `Loyalty cards (${cards.length})`,
      })
      notifySuccess(`${cards.length} loyalty card design${cards.length === 1 ? '' : 's'} downloaded`)
      // Refresh generated card list + serial counter.
      const cardsRes = await apiFetch('/loyalty/cards')
      if (cardsRes.ok) {
        const list = await cardsRes.json()
        setGeneratedCards(list.cards || [])
        setCardBatches(list.batches || [])
      }
      if (data.design) {
        setCardDesign({
          ...emptyCardDesign,
          ...data.design,
          content: { ...DEFAULT_CARD_CONTENT, ...(data.content || {}) },
          layout: data.layout || {},
        })
      }
    } catch {
      notifyError('Failed to generate card artwork')
    } finally {
      setGenerating(false)
      setGenProgress('')
    }
  }

  const refreshCards = async () => {
    const res = await apiFetch('/loyalty/cards')
    if (res.ok) {
      const list = await res.json()
      setGeneratedCards(list.cards || [])
      setCardBatches(list.batches || [])
    }
  }

  const openAssign = (card: GeneratedLoyaltyCard) => {
    setAssignCard(card)
    setAssignSearch('')
    setAssignResults([])
    setAssignOpen(true)
    // Preload top customers for quick selection.
    apiFetch('/loyalty/customers')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setAssignResults(rows || []))
      .catch(() => {})
  }

  const searchAssignCustomers = async (q: string) => {
    setAssignSearch(q)
    try {
      const res = await apiFetch(`/loyalty/customers?search=${encodeURIComponent(q)}`)
      if (res.ok) setAssignResults((await res.json()) || [])
    } catch {
      /* keep current list */
    }
  }

  const submitAssign = async (partyId: string | null) => {
    if (!assignCard?.id) return
    setAssignBusy(true)
    try {
      const res = await apiFetch(`/loyalty/cards/${assignCard.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ party_id: partyId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        notifySuccess(
          partyId
            ? `Card ${assignCard.card_number} linked to ${data.party?.name || 'customer'}`
            : `Card ${assignCard.card_number} unlinked`
        )
        setAssignOpen(false)
        refreshCards()
      } else {
        notifyError(typeof data.error === 'string' ? data.error : 'Failed to assign card')
      }
    } catch {
      notifyError('Failed to assign card')
    } finally {
      setAssignBusy(false)
    }
  }

  const deleteGeneratedCard = async (card: GeneratedLoyaltyCard) => {
    if (!card.id) return
    if (!(await confirm({
      title: `Delete card ${card.card_number}?`,
      description: card.party
        ? `This card is linked to ${card.party.name}. Deleting it cannot be undone.`
        : 'This action cannot be undone.',
    }))) return
    try {
      const res = await apiFetch(`/loyalty/cards/${card.id}`, { method: 'DELETE' })
      if (res.ok) {
        setGeneratedCards((prev) => prev.filter((c) => c.id !== card.id))
        notifySuccess(`Card ${card.card_number} deleted`)
      } else {
        notifyError('Failed to delete card')
      }
    } catch {
      notifyError('Failed to delete card')
    }
  }

  const previewNumber = '000001'
  const cardPreviewFront = useMemo(() => {
    if (!cardBusiness) return ''
    return buildCardFrontSvg({
      design: cardDesign,
      business: cardBusiness,
      store: cardStore,
      cardNumber: previewNumber,
      logoDataUri: cardLogo,
      showGuides: true,
    })
  }, [cardDesign, cardBusiness, cardStore, cardLogo, previewNumber])

  const cardPreviewBack = useMemo(() => {
    if (!cardBusiness || !cardDesign.include_back) return ''
    return buildCardBackSvg({
      design: cardDesign,
      business: cardBusiness,
      store: cardStore,
      logoDataUri: cardLogo,
      showGuides: true,
    })
  }, [cardDesign, cardBusiness, cardStore, cardLogo])

  const filteredCards = generatedCards.filter((c) =>
    c.card_number.toLowerCase().includes(cardSearch.toLowerCase())
  )

  const txnLabel = (type: string) => {
    switch (type) {
      case 'earn':
        return 'Earned'
      case 'redeem':
        return 'Redeemed'
      case 'adjust':
        return 'Adjusted'
      default:
        return type
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="app-page-title">Customer Loyalty Program</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowStats((v) => !v)}>
            {showStats ? (
              <EyeOff className="mr-2 h-4 w-4" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {showStats ? 'Hide stats' : 'Show stats'}
          </Button>
        </div>

        {stats && showStats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat label="Members with points" value={stats.total_members} />
            <SummaryStat label="Outstanding points" value={stats.total_points_outstanding.toLocaleString()} />
            <SummaryStat tone="success" label="Earned this month" value={`+${stats.points_earned_this_month.toLocaleString()}`} />
            <SummaryStat tone="warning" label="Redeemed this month" value={stats.points_redeemed_this_month.toLocaleString()} />
          </div>
        )}

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="cards">Loyalty Cards</TabsTrigger>
            <TabsTrigger value="generated">Generated Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Earn &amp; redeem rules</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">
                        Program {settings.is_enabled ? 'active' : 'inactive'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Enable or disable loyalty points earning and redemption.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.is_enabled}
                    onCheckedChange={(v) => setSettings({ ...settings, is_enabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Earn rate — spend amount (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.spend_amount}
                    onChange={(e) =>
                      setSettings({ ...settings, spend_amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <p className="text-xs text-gray-500">Customer spends this amount to earn points below.</p>
                </div>
                <div className="space-y-2">
                  <Label>Points earned per spend amount</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.points_per_spend}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        points_per_spend: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Example: ₹{settings.spend_amount} spent → {settings.points_per_spend} point(s).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Redemption value (₹ per point)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={settings.point_value}
                    onChange={(e) =>
                      setSettings({ ...settings, point_value: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Minimum points to redeem</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.min_redeem_points}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_redeem_points: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Max bill % payable with points</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.max_redeem_percent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_redeem_percent: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={saveSettings} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer balances
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search customers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="py-8 text-center text-gray-500">Loading...</p>
                ) : (
                  <div className="table-scroll">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 font-medium">Customer</th>
                          <th className="pb-2 font-medium">Phone</th>
                          <th className="pb-2 font-medium text-right">Points</th>
                          <th className="pb-2 font-medium text-right">Value (₹)</th>
                          <th className="pb-2 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((c) => (
                          <tr key={c.id} className="border-b last:border-0">
                            <td className="py-3 font-medium">{c.name}</td>
                            <td className="py-3 text-gray-600">{c.phone || '—'}</td>
                            <td className="py-3 text-right font-semibold text-amber-600">
                              {(c.loyalty_points ?? 0).toLocaleString()}
                            </td>
                            <td className="py-3 text-right">
                              {formatCurrency((c.loyalty_points ?? 0) * settings.point_value)}
                            </td>
                            <td className="py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-1"
                                onClick={() => openHistory(c)}
                              >
                                <History className="mr-1.5 h-3.5 w-3.5" />
                                History
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAdjust(c)}>
                                Adjust
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredCustomers.length === 0 && (
                      <p className="py-8 text-center text-gray-500">No customers found</p>
                    )}
                  </div>
                )}
                {!loading && (
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={setPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{tx.party?.name || 'Customer'}</p>
                        <p className="text-xs text-gray-500">
                          {txnLabel(tx.transaction_type)}
                          {tx.reference_number ? ` · ${tx.reference_number}` : ''}
                          {tx.notes ? ` — ${tx.notes}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            tx.points >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600'
                          }
                        >
                          {tx.points >= 0 ? '+' : ''}
                          {tx.points.toLocaleString()} pts
                        </p>
                        <p className="text-xs text-gray-500">
                          Balance: {tx.balance_after.toLocaleString()} · {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && !loading && (
                    <p className="py-8 text-center text-gray-500">No loyalty activity yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Card design
                    {cardStore && (
                      <span className="text-xs font-normal text-gray-500">· {cardStore.name}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="mb-2 block">Theme</Label>
                    <div className="flex flex-wrap gap-2">
                      {CARD_THEMES.map((theme) => (
                        <button
                          key={theme.key}
                          type="button"
                          title={theme.label}
                          onClick={() =>
                            setCardDesign({
                              ...cardDesign,
                              theme: theme.key,
                              primary_color: cardDesign.primary_color,
                              accent_color: cardDesign.accent_color,
                            })
                          }
                          className={`h-10 w-16 rounded-md border-2 transition-all ${
                            cardDesign.theme === theme.key
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                          style={{ background: theme.swatch }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Card colour</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cardDesign.primary_color}
                          onChange={(e) =>
                            setCardDesign({ ...cardDesign, primary_color: e.target.value })
                          }
                          className="h-9 w-12 cursor-pointer rounded border"
                        />
                        <Input
                          value={cardDesign.primary_color}
                          onChange={(e) =>
                            setCardDesign({ ...cardDesign, primary_color: e.target.value })
                          }
                          className="font-mono"
                          placeholder="#0f172a"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent colour</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cardDesign.accent_color}
                          onChange={(e) =>
                            setCardDesign({ ...cardDesign, accent_color: e.target.value })
                          }
                          className="h-9 w-12 cursor-pointer rounded border"
                        />
                        <Input
                          value={cardDesign.accent_color}
                          onChange={(e) =>
                            setCardDesign({ ...cardDesign, accent_color: e.target.value })
                          }
                          className="font-mono"
                          placeholder="#f59e0b"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Text font</Label>
                      <Select
                        value={cardDesign.font_family || 'sans'}
                        onValueChange={(v) => setCardDesign({ ...cardDesign, font_family: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              <span style={{ fontFamily: f.stack }}>{f.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Card number font</Label>
                      <Select
                        value={cardDesign.number_font || 'mono'}
                        onValueChange={(v) => setCardDesign({ ...cardDesign, number_font: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NUMBER_FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              <span style={{ fontFamily: f.stack }}>{f.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Background</Label>
                      <Select
                        value={cardDesign.decor || 'orbits'}
                        onValueChange={(v) => setCardDesign({ ...cardDesign, decor: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DECOR_OPTIONS.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-sm font-semibold text-gray-700">Front content</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {FRONT_TEXT_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-xs">{field.label}</Label>
                          <Input
                            value={String(cardContent[field.key] ?? '')}
                            maxLength={field.max}
                            onChange={(e) => setCardContent({ [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 sm:grid-cols-3">
                      {FRONT_TOGGLES.map((t) => (
                        <label key={t.key} className="flex items-center gap-2 text-xs text-gray-600">
                          <Switch
                            checked={
                              t.design
                                ? Boolean(cardDesign[t.key as keyof LoyaltyCardDesign])
                                : Boolean(cardContent[t.key as keyof LoyaltyCardContent])
                            }
                            onCheckedChange={(v) =>
                              t.design
                                ? setCardDesign({ ...cardDesign, [t.key]: v })
                                : setCardContent({ [t.key]: v } as Partial<LoyaltyCardContent>)
                            }
                          />
                          {t.label}
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Front emblem</Label>
                      <Select
                        value={cardDesign.front_graphic || 'none'}
                        onValueChange={(v) => setCardDesign({ ...cardDesign, front_graphic: v })}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRAPHIC_OPTIONS.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Back content</p>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <Switch
                          checked={cardDesign.include_back}
                          onCheckedChange={(v) =>
                            setCardDesign({ ...cardDesign, include_back: v })
                          }
                        />
                        Include card back
                      </label>
                    </div>
                    {cardDesign.include_back && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {BACK_TEXT_FIELDS.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="text-xs">{field.label}</Label>
                              <Input
                                value={String(cardContent[field.key] ?? '')}
                                maxLength={field.max}
                                onChange={(e) => setCardContent({ [field.key]: e.target.value })}
                                placeholder={field.placeholder}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Terms text</Label>
                          <Textarea
                            value={cardContent.terms}
                            rows={3}
                            maxLength={500}
                            onChange={(e) => setCardContent({ terms: e.target.value })}
                            placeholder="Terms printed on the back of the card"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 sm:grid-cols-3">
                          {BACK_TOGGLES.map((t) => (
                            <label key={t.key} className="flex items-center gap-2 text-xs text-gray-600">
                              <Switch
                                checked={Boolean(cardContent[t.key])}
                                onCheckedChange={(v) => setCardContent({ [t.key]: v })}
                              />
                              {t.label}
                            </label>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Back emblem</Label>
                          <Select
                            value={cardDesign.back_graphic || 'none'}
                            onValueChange={(v) => setCardDesign({ ...cardDesign, back_graphic: v })}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GRAPHIC_OPTIONS.map((o) => (
                                <SelectItem key={o.key} value={o.key}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>

                  <Button onClick={saveCardDesign} disabled={cardDesignSaving}>
                    {cardDesignSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save design
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>Preview</CardTitle>
                    <div className="flex items-center gap-2">
                      {editingLayout && cardDesign.include_back && (
                        <div className="flex rounded-md border text-xs">
                          {(['front', 'back'] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setEditSide(s)}
                              className={`px-2.5 py-1 capitalize ${
                                editSide === s ? 'bg-blue-600 text-white' : 'text-gray-600'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                      <Button
                        variant={editingLayout ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingLayout((v) => !v)}
                      >
                        <Move className="mr-1.5 h-3.5 w-3.5" />
                        {editingLayout ? 'Done editing' : 'Edit layout'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reset element positions"
                        onClick={() => setCardDesign({ ...cardDesign, layout: {} })}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editingLayout && cardBusiness ? (
                      <>
                        <CardLayoutEditor
                          design={cardDesign}
                          business={cardBusiness}
                          store={cardStore}
                          logoDataUri={cardLogo}
                          side={editSide}
                          sampleCardNumber={previewNumber}
                          onElementChange={setCardElement}
                        />
                        <p className="text-xs text-gray-400">
                          Drag an element to move it · drag the blue dot to resize · remember to save the design
                        </p>
                      </>
                    ) : cardPreviewFront ? (
                      <>
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-gray-500">FRONT — CR80 (85.6 × 54 mm), 3 mm bleed, 300 DPI</p>
                          <div
                            className="overflow-hidden rounded-xl shadow-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: cardPreviewFront }}
                          />
                        </div>
                        {cardPreviewBack && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-gray-500">BACK</p>
                            <div
                              className="overflow-hidden rounded-xl shadow-lg [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                              dangerouslySetInnerHTML={{ __html: cardPreviewBack }}
                            />
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          Magenta dashed = trim edge · Cyan dashed = safe zone (not printed)
                        </p>
                      </>
                    ) : (
                      <p className="py-8 text-center text-gray-500">Loading preview…</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Generate printable cards
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-3">
                      <div className="space-y-2">
                        <Label>Number of cards</Label>
                        <Input
                          type="number"
                          min={1}
                          max={250}
                          value={cardCount}
                          onChange={(e) => setCardCount(e.target.value)}
                          className="w-32"
                        />
                      </div>
                      <Button onClick={generateAndDownload} disabled={generating}>
                        {generating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Generate &amp; download
                      </Button>
                    </div>
                    {generating && genProgress && (
                      <p className="text-sm text-gray-500">{genProgress}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Downloads a ZIP of print-ready PNG artwork (one unique card front per card
                      with its own card number + Code 128 barcode), a shared card back, a card
                      number list (CSV), and a print spec sheet. Max 250 cards per batch.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="generated" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generated cards</CardTitle>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search card number..."
                    value={cardSearch}
                    onChange={(e) => setCardSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cardBatches.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cardBatches.map((b) => (
                      <div
                        key={b.batch_id}
                        className="rounded-lg border bg-gray-50 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold">{b.count} cards</span>
                        <span className="mx-1.5 text-gray-400">·</span>
                        <span className="font-mono">
                          {b.first_card} → {b.last_card}
                        </span>
                        <span className="mx-1.5 text-gray-400">·</span>
                        <span className="text-gray-500">{formatDate(b.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="table-scroll">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Card number</th>
                        <th className="pb-2 font-medium">Serial</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Customer</th>
                        <th className="pb-2 font-medium">Generated</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCards.map((card) => (
                        <tr key={card.id || card.card_number} className="border-b last:border-0">
                          <td className="py-2.5 font-mono font-medium">
                            {prettyCardNumber(card.card_number)}
                          </td>
                          <td className="py-2.5 text-gray-600">#{card.serial}</td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              {card.status || 'active'}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-700">
                            {card.party?.name || <span className="text-gray-400">Unassigned</span>}
                          </td>
                          <td className="py-2.5 text-gray-600">{formatDate(card.created_at || '')}</td>
                          <td className="py-2.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="mr-1"
                              onClick={() => openAssign(card)}
                            >
                              {card.party ? 'Reassign' : 'Assign'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete card (misprint)"
                              onClick={() => deleteGeneratedCard(card)}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCards.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-500">
                      {generatedCards.length === 0 ? 'No cards generated yet' : 'No cards match'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust points — {adjustCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Current balance:{' '}
              <strong>{(adjustCustomer?.loyalty_points ?? 0).toLocaleString()} points</strong>
            </p>
            <div className="space-y-2">
              <Label>Points change</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustPoints(String(-Math.abs(parseInt(adjustPoints, 10) || 100)))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  placeholder="e.g. 100 or -50"
                  value={adjustPoints}
                  onChange={(e) => setAdjustPoints(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setAdjustPoints(String(Math.abs(parseInt(adjustPoints, 10) || 100)))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">Use negative values to deduct points.</p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdjust} disabled={adjusting}>
              {adjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link card {assignCard?.card_number} to a customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search customers by name or phone..."
                value={assignSearch}
                onChange={(e) => searchAssignCustomers(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {assignResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={assignBusy}
                  onClick={() => submitAssign(c.id)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone || '—'}</p>
                  </div>
                  <span className="text-xs text-amber-600">
                    {(c.loyalty_points ?? 0).toLocaleString()} pts
                  </span>
                </button>
              ))}
              {assignResults.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">No customers found</p>
              )}
            </div>
          </div>
          <DialogFooter>
            {assignCard?.party && (
              <Button variant="outline" onClick={() => submitAssign(null)} disabled={assignBusy}>
                Unlink card
              </Button>
            )}
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Points history — {historyCustomer?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Current balance:{' '}
            <strong>{(historyCustomer?.loyalty_points ?? 0).toLocaleString()} points</strong>
          </p>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {historyLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
            ) : historyTxns.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No points activity yet</p>
            ) : (
              historyTxns.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{txnLabel(tx.transaction_type)}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(tx.created_at)}
                      {tx.reference_number ? ` · ${tx.reference_number}` : ''}
                      {tx.notes ? ` — ${tx.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        tx.points >= 0
                          ? 'text-sm font-semibold text-green-600'
                          : 'text-sm font-semibold text-red-600'
                      }
                    >
                      {tx.points >= 0 ? '+' : ''}
                      {tx.points.toLocaleString()} pts
                    </p>
                    <p className="text-xs text-gray-500">
                      Balance: {tx.balance_after.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </DashboardLayout>
  )
}
