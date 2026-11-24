'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink, FileCode2, FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { notifyError } from '@/lib/notify'
import {
  fetchOverview,
  publicApiBaseUrl,
  publicApiDocsUrl,
  publicApiExplorerUrl,
  publicApiSpecUrl,
  type IntegrationOverview,
} from '@/lib/apiManagement'
import { CopyButton } from './shared'

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-heading'
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

export default function OverviewTab() {
  const [data, setData] = useState<IntegrationOverview | null>(null)

  useEffect(() => {
    fetchOverview().then(setData).catch((e) => notifyError(e instanceof Error ? e.message : 'Failed to load overview'))
  }, [])

  const base = publicApiBaseUrl()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Public API</CardTitle>
          <CardDescription>
            Partners integrate with TruERP through a versioned REST API with OAuth 2.0 and API-key authentication, webhooks and an OpenAPI 3.1 specification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Base URL</span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{base}</code>
            <CopyButton value={base} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={publicApiDocsUrl()} target="_blank" rel="noreferrer"><BookOpen className="mr-1.5 h-4 w-4" /> API reference <ExternalLink className="ml-1 h-3 w-3" /></a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={publicApiExplorerUrl()} target="_blank" rel="noreferrer"><FlaskConical className="mr-1.5 h-4 w-4" /> Explorer <ExternalLink className="ml-1 h-3 w-3" /></a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={publicApiSpecUrl()} target="_blank" rel="noreferrer"><FileCode2 className="mr-1.5 h-4 w-4" /> OpenAPI spec <ExternalLink className="ml-1 h-3 w-3" /></a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data ? (
        <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Requests (24h)" value={data.requests_24h.toLocaleString('en-IN')} />
            <Stat label="Client errors (24h)" value={data.client_errors_24h} tone={data.client_errors_24h > 0 ? 'amber' : undefined} />
            <Stat label="Server errors (24h)" value={data.server_errors_24h} tone={data.server_errors_24h > 0 ? 'red' : undefined} />
            <Stat label="Queued deliveries" value={data.pending_deliveries} />
            <Stat label="Active API keys" value={data.active_api_keys} />
            <Stat label="OAuth apps" value={data.active_oauth_clients} />
            <Stat label="Active webhooks" value={data.active_webhooks} />
            <Stat label="Failing webhooks" value={data.failing_webhooks} tone={data.failing_webhooks > 0 ? 'red' : undefined} />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Busiest stores (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.top_stores_24h.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API traffic in the last 24 hours.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.top_stores_24h.map((s) => (
                    <li key={s.store_id} className="flex justify-between py-2">
                      <span>{s.store_name || s.store_id}</span>
                      <span className="tabular-nums text-muted-foreground">{s.requests.toLocaleString('en-IN')} requests</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
