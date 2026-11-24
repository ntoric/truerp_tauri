'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { notifyError } from '@/lib/notify'
import { formatDateTime, listRequestLogs, type RequestLog, type StoreOption } from '@/lib/apiManagement'
import { StoreSelect } from './shared'

const PAGE = 50

function statusClass(code: number) {
  if (code >= 500) return 'text-red-600'
  if (code >= 400) return 'text-amber-700'
  return 'text-emerald-700'
}

export default function LogsTab({ stores }: { stores: StoreOption[] }) {
  const [storeId, setStoreId] = useState('')
  const [status, setStatus] = useState('all')
  const [offset, setOffset] = useState(0)
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listRequestLogs({ store_id: storeId, status: status === 'all' ? '' : status, offset, limit: PAGE })
      setLogs(res.logs)
      setTotal(res.total)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [storeId, status, offset])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <StoreSelect stores={stores} value={storeId} onChange={(v) => { setStoreId(v); setOffset(0) }} allowAll />
        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0) }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All responses</SelectItem>
            <SelectItem value="success">Successful (2xx/3xx)</SelectItem>
            <SelectItem value="client_error">Client errors (4xx)</SelectItem>
            <SelectItem value="server_error">Server errors (5xx)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="sm:ml-auto">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No public API requests match. Logs are kept for 30 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credential</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</TableCell>
                      <TableCell className="max-w-sm">
                        <span className="mr-1.5 font-mono text-xs font-semibold">{l.method}</span>
                        <span className="break-all font-mono text-xs">{l.path}</span>
                        <div className="font-mono text-[11px] text-muted-foreground" title="Request ID">{l.request_id}</div>
                      </TableCell>
                      <TableCell className={`font-mono text-xs font-semibold ${statusClass(l.status_code)}`}>
                        {l.status_code}
                        {l.error_code && <div className="font-normal">{l.error_code}</div>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.credential_name || '—'}
                        <div className="text-muted-foreground">{l.credential_type}</div>
                      </TableCell>
                      <TableCell className="text-xs">{l.store_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{l.duration_ms}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total.toLocaleString('en-IN')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset((o) => o + PAGE)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
