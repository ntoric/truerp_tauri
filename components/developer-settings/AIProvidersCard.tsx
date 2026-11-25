'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Save, Sparkles, Zap } from 'lucide-react'
import { apiFetch } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { notifyError, notifySuccess } from '@/lib/notify'

// GET/PUT /developer-settings/integrations/ai and POST …/ai/test.
// Keys are write-only: the API reports has_api_key + a last-4 hint.
type AIProviderKey = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'ollama'

interface AIProviderInfo {
  key: AIProviderKey
  label: string
  default_model: string
  default_base_url: string
  needs_key: boolean
  supports_pdf: boolean
  key_url?: string
}

interface AIProviderConfigView {
  has_api_key: boolean
  api_key_hint: string
  model: string
  base_url: string
  configured: boolean
}

interface AISettings {
  enable_ai_hsn_search: boolean
  enable_ai_bill_parsing: boolean
  provider: AIProviderKey
  providers: AIProviderInfo[]
  configs: Record<string, AIProviderConfigView>
  configured: boolean
  /** Set client-side when the server only speaks the old Gemini-only API. */
  outdated?: boolean
}

// Mirrors the backend's aiProviders; used if the server omits the list.
const FALLBACK_PROVIDERS: AIProviderInfo[] = [
  { key: 'gemini', label: 'Google Gemini', default_model: 'gemini-2.5-flash', default_base_url: 'https://generativelanguage.googleapis.com/v1beta', needs_key: true, supports_pdf: true, key_url: 'https://aistudio.google.com/app/apikey' },
  { key: 'openai', label: 'OpenAI (ChatGPT)', default_model: 'gpt-4o-mini', default_base_url: 'https://api.openai.com/v1', needs_key: true, supports_pdf: true, key_url: 'https://platform.openai.com/api-keys' },
  { key: 'anthropic', label: 'Anthropic (Claude)', default_model: 'claude-haiku-5-5', default_base_url: 'https://api.anthropic.com', needs_key: true, supports_pdf: true, key_url: 'https://console.anthropic.com/settings/keys' },
  { key: 'openrouter', label: 'OpenRouter', default_model: 'google/gemini-2.5-flash', default_base_url: 'https://openrouter.ai/api/v1', needs_key: true, supports_pdf: true, key_url: 'https://openrouter.ai/settings/keys' },
  { key: 'ollama', label: 'Ollama (self-hosted)', default_model: 'llama3.2-vision', default_base_url: 'http://localhost:11434', needs_key: false, supports_pdf: false },
]

/**
 * Fills in anything the server left out so rendering never depends on the
 * response shape. An older backend returns only the Gemini fields
 * (has_gemini_api_key, gemini_api_key_hint) and no provider list.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAISettings(raw: any): AISettings {
  const outdated = !Array.isArray(raw?.providers)
  const providers: AIProviderInfo[] = outdated || raw.providers.length === 0 ? FALLBACK_PROVIDERS : raw.providers
  const configs: Record<string, AIProviderConfigView> = { ...(raw?.configs ?? {}) }
  if (outdated && !configs.gemini) {
    configs.gemini = {
      has_api_key: !!raw?.has_gemini_api_key,
      api_key_hint: raw?.gemini_api_key_hint ?? '',
      model: '',
      base_url: '',
      configured: !!raw?.has_gemini_api_key,
    }
  }
  const provider: AIProviderKey = providers.some((p) => p.key === raw?.provider) ? raw.provider : providers[0].key
  return {
    enable_ai_hsn_search: !!raw?.enable_ai_hsn_search,
    enable_ai_bill_parsing: !!raw?.enable_ai_bill_parsing,
    provider,
    providers,
    configs,
    configured: !!(raw?.configured ?? configs[provider]?.configured),
    outdated,
  }
}

// Per-provider form state, so switching the dropdown back and forth keeps
// what was typed for each provider until saved.
interface ProviderDraft {
  model: string
  baseUrl: string
  apiKey: string
  clearKey: boolean
}

// POST /developer-settings/integrations/ai/models
interface AIModel {
  id: string
  name?: string
  /** Whether the model reads images; absent when the provider doesn't say. */
  vision?: boolean
}

interface ModelList {
  loading: boolean
  models: AIModel[]
  error?: string
  loaded: boolean
}

const PATH = '/developer-settings/integrations/ai'

const modelLabel = (m: AIModel) => {
  const base = m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id
  return m.vision ? `${base} · reads images` : base
}

const MODEL_EXAMPLES: Record<AIProviderKey, string> = {
  gemini: 'gemini-2.5-flash, gemini-2.5-pro',
  openai: 'gpt-4o-mini, gpt-4o, gpt-4.1',
  anthropic: 'claude-haiku-5-5, claude-sonnet-5-5',
  openrouter: 'google/gemini-2.5-flash, openai/gpt-4o-mini, anthropic/claude-sonnet-5-5',
  ollama: 'llama3.2-vision, qwen2.5vl, llava (vision models read bills)',
}

const draftsFrom = (s: AISettings): Record<string, ProviderDraft> =>
  Object.fromEntries(
    s.providers.map((p) => [
      p.key,
      {
        model: s.configs[p.key]?.model ?? '',
        baseUrl: s.configs[p.key]?.base_url ?? '',
        apiKey: '',
        clearKey: false,
      },
    ]),
  )

/** AI provider connection and AI feature toggles for the active store. */
export default function AIProvidersCard({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [provider, setProvider] = useState<AIProviderKey>('gemini')
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({})
  const [hsn, setHsn] = useState(false)
  const [billParsing, setBillParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [modelLists, setModelLists] = useState<Record<string, ModelList>>({})
  // Per provider: type a model ID instead of picking from the list.
  const [manualModel, setManualModel] = useState<Record<string, boolean>>({})

  // Fetch the provider's model list with the form's current key/base URL
  // (blank key = saved key), so models can be listed before saving.
  const loadModels = async (key: AIProviderKey, draftOverride?: ProviderDraft) => {
    const d = draftOverride ?? drafts[key]
    setModelLists((prev) => ({ ...prev, [key]: { loading: true, models: prev[key]?.models ?? [], loaded: false } }))
    try {
      const res = await apiFetch(`${PATH}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: key, api_key: d?.apiKey.trim() ?? '', base_url: d?.baseUrl.trim() ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load models')
      setModelLists((prev) => ({ ...prev, [key]: { loading: false, models: data.models ?? [], loaded: true } }))
    } catch (e) {
      setModelLists((prev) => ({
        ...prev,
        [key]: { loading: false, models: [], loaded: true, error: e instanceof Error ? e.message : 'Could not load models' },
      }))
    }
  }

  // Load the list once per provider when it can be listed (key saved, or a
  // provider whose list needs no key).
  useEffect(() => {
    if (!settings || settings.outdated || modelLists[provider]) return
    const info = settings.providers.find((p) => p.key === provider)
    const canList = !info?.needs_key || provider === 'openrouter' || settings.configs[provider]?.has_api_key
    if (canList) void loadModels(provider)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, provider])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apply = (raw: any) => {
    const s = normalizeAISettings(raw)
    setSettings(s)
    setProvider(s.provider)
    setDrafts(draftsFrom(s))
    setHsn(s.enable_ai_hsn_search)
    setBillParsing(s.enable_ai_bill_parsing)
  }

  useEffect(() => {
    apiFetch(PATH)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load AI settings')
        apply(await res.json())
      })
      .catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load AI settings'))
  }, [])

  if (!settings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const info = settings.providers.find((p) => p.key === provider) ?? settings.providers[0]
  const saved = settings.configs[provider]
  const draft = drafts[provider] ?? { model: '', baseUrl: '', apiKey: '', clearKey: false }
  const setDraft = (patch: Partial<ProviderDraft>) =>
    setDrafts((prev) => ({ ...prev, [provider]: { ...draft, ...patch } }))

  const hasKey = !info.needs_key || (saved?.has_api_key && !draft.clearKey) || draft.apiKey.trim() !== ''
  const canListModels = hasKey || provider === 'openrouter'
  const list = modelLists[provider]
  const modelOptions: SearchableSelectOption[] = [
    { value: '', label: `Default (${info.default_model})` },
    ...(list?.models ?? []).map((m) => ({ value: m.id, label: modelLabel(m) })),
  ]
  // Keep a saved model selectable even if the provider no longer lists it.
  if (draft.model && !modelOptions.some((o) => o.value === draft.model)) {
    modelOptions.push({ value: draft.model, label: `${draft.model} (not in list)` })
  }

  const body = () => ({
    provider,
    model: draft.model.trim(),
    base_url: draft.baseUrl.trim(),
    api_key: draft.apiKey.trim(),
    clear_api_key: draft.clearKey,
    enable_ai_hsn_search: hasKey && hsn,
    enable_ai_bill_parsing: hasKey && billParsing,
  })

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save AI settings')
      apply(data)
      setTestResult(null)
      notifySuccess(`AI settings saved: using ${info.label}`)
      onSaved?.()
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to save AI settings')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch(`${PATH}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      })
      const data = await res.json().catch(() => ({}))
      setTestResult({ ok: res.ok, message: data.message || data.error || (res.ok ? 'Connected' : 'Connection failed') })
    } catch {
      setTestResult({ ok: false, message: 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Features
          </CardTitle>
          <CardDescription>
            AI-powered HSN search and purchase bill parsing for this store. Pick any provider; each keeps its own key.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void test()} disabled={testing || !hasKey || settings.outdated}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Test
          </Button>
          <Button onClick={() => void save()} disabled={saving || settings.outdated}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save AI Settings
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.outdated && (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The server is running an older version that only supports Gemini. Restart or redeploy the backend to
              choose other AI providers. Saving is disabled until then so keys aren&apos;t lost.
            </span>
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as AIProviderKey)
                setTestResult(null)
              }}
            >
              <SelectTrigger id="ai-provider">
                <SelectValue>{info.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {settings.providers.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    <span className="flex items-center gap-2">
                      {p.label}
                      {settings.configs[p.key]?.configured && p.needs_key && (
                        <Badge variant="secondary" className="text-[10px]">Key saved</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provider !== settings.provider && (
              <p className="text-xs text-amber-700">
                Currently using {settings.providers.find((p) => p.key === settings.provider)?.label}. Save to switch.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ai-model">Model</Label>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setManualModel((prev) => ({ ...prev, [provider]: !prev[provider] }))}
              >
                {manualModel[provider] ? 'Choose from list' : 'Type a model ID'}
              </button>
            </div>
            {manualModel[provider] ? (
              <Input
                id="ai-model"
                autoComplete="off"
                value={draft.model}
                onChange={(e) => setDraft({ model: e.target.value })}
                placeholder={`Default: ${info.default_model}`}
              />
            ) : (
              <div className="flex gap-2">
                <SearchableSelect
                  className="h-9"
                  value={draft.model}
                  onValueChange={(v) => setDraft({ model: v })}
                  options={modelOptions}
                  placeholder={list?.loading ? 'Loading models…' : `Default: ${info.default_model}`}
                  searchPlaceholder="Search models…"
                  emptyMessage={list?.loading ? 'Loading models…' : 'No matching models'}
                  onAddNew={() => setManualModel((prev) => ({ ...prev, [provider]: true }))}
                  addNewLabel="Type a model ID"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  title="Reload models"
                  aria-label="Reload models"
                  disabled={list?.loading || !canListModels || settings.outdated}
                  onClick={() => void loadModels(provider)}
                >
                  <RefreshCw className={`h-4 w-4 ${list?.loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            )}
            {list?.error ? (
              <p className="text-xs text-red-600">{list.error}</p>
            ) : !canListModels ? (
              <p className="text-xs text-muted-foreground">Enter the API key to load the model list.</p>
            ) : list?.loaded ? (
              <p className="text-xs text-muted-foreground">
                {list.models.length} models available.
                {billParsing && ' Bill parsing needs one that reads images.'}
              </p>
            ) : null}
          </div>

          {info.needs_key && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-key">API key</Label>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                value={draft.apiKey}
                onChange={(e) => setDraft({ apiKey: e.target.value, clearKey: e.target.value ? false : draft.clearKey })}
                onBlur={() => {
                  if (draft.apiKey.trim()) void loadModels(provider)
                }}
                placeholder={
                  saved?.has_api_key && !draft.clearKey
                    ? `Saved (${saved.api_key_hint || '••••'}), leave blank to keep`
                    : `Enter your ${info.label} API key`
                }
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {info.key_url && (
                  <span>
                    Get a key from{' '}
                    <a href={info.key_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {new URL(info.key_url).host}
                    </a>
                    . Stored encrypted; never shown again.
                  </span>
                )}
                {saved?.has_api_key && !draft.apiKey && (
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => setDraft({ clearKey: !draft.clearKey })}
                  >
                    {draft.clearKey ? 'Keep saved key' : 'Remove saved key'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">
              {provider === 'ollama' ? 'Ollama server URL' : 'API base URL (optional)'}
            </Label>
            <Input
              id="ai-base-url"
              autoComplete="off"
              value={draft.baseUrl}
              onChange={(e) => setDraft({ baseUrl: e.target.value })}
              onBlur={() => {
                if (canListModels) void loadModels(provider)
              }}
              placeholder={`Default: ${info.default_base_url}`}
            />
            <p className="text-xs text-muted-foreground">
              {provider === 'ollama'
                ? 'Must be reachable from the TruERP server, not from this browser.'
                : 'Leave blank unless you use a proxy or compatible gateway.'}
            </p>
          </div>
        </div>

        {testResult && (
          <p className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {testResult.message}
          </p>
        )}

        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Switch id="enable_ai_hsn_search" checked={hasKey && hsn} disabled={!hasKey} onCheckedChange={(v) => setHsn(!!v)} />
              <Label htmlFor="enable_ai_hsn_search">Enable AI-powered HSN code search</Label>
            </div>
            <p className="text-xs text-muted-foreground">Find HSN codes from product descriptions.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Switch
                id="enable_ai_bill_parsing"
                checked={hasKey && billParsing}
                disabled={!hasKey}
                onCheckedChange={(v) => setBillParsing(!!v)}
              />
              <Label htmlFor="enable_ai_bill_parsing">Enable AI-powered purchase bill parsing</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload bill images{info.supports_pdf ? ' or PDFs' : ''} and extract vendor details, items and amounts.
              Needs a model that can read images.
              {!info.supports_pdf && ` ${info.label} can't read PDFs, so upload photos or screenshots.`}
            </p>
          </div>
          {!hasKey && (
            <p className="text-xs text-amber-700">Add a {info.label} API key to turn these on.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
