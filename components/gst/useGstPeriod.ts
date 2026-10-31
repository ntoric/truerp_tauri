'use client'

import { useCallback, useEffect, useState } from 'react'
import { gstGet, gstSend, type GstReturnPeriod } from '@/lib/gstComposition'
import type { GstScopeState } from '@/components/gst/GstReportShell'

// useGstPeriod resolves the GSTReturnPeriod matching the current scope
// (registration + FY + quarter/annual). Custom scopes have no period.
export function useGstPeriod(gst: GstScopeState) {
  const [period, setPeriod] = useState<GstReturnPeriod | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const load = useCallback(async () => {
    setPeriod(null)
    setError('')
    const { scope } = gst
    if (scope.mode === 'custom' || !scope.registrationId) return
    setLoading(true)
    try {
      const periods = await gstGet<GstReturnPeriod[]>(
        `/periods?registration_id=${scope.registrationId}&fy=${scope.fy}`,
      )
      const match = (periods || []).find((p) =>
        scope.mode === 'quarter'
          ? p.period_type === 'quarterly' && p.quarter === scope.quarter
          : p.period_type === 'annual',
      )
      setPeriod(match || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load period')
    } finally {
      setLoading(false)
    }
  }, [gst.scope, gst.reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const ensurePeriod = useCallback(async (): Promise<GstReturnPeriod | null> => {
    const { scope } = gst
    if (scope.mode === 'custom' || !scope.registrationId) return null
    const created = await gstSend<GstReturnPeriod>('/periods', 'POST', {
      gst_registration_id: scope.registrationId,
      financial_year: scope.fy,
      period_type: scope.mode === 'quarter' ? 'quarterly' : 'annual',
      quarter: scope.mode === 'quarter' ? scope.quarter : 0,
    })
    setPeriod(created)
    return created
  }, [gst])

  return { period, loading, error, reload: load, ensurePeriod, setPeriod }
}
