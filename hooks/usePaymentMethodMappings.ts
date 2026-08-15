'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'
import { offlineStorage } from '@/lib/offlineStorage'

export interface PaymentMethodMapping {
  payment_method: string
  label: string
  bank_account_id: string | null
}

export function usePaymentMethodMappings() {
  const [mappings, setMappings] = useState<PaymentMethodMapping[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/cash-bank/payment-method-mappings')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data.mappings) ? data.mappings : []
        setMappings(list)
        await offlineStorage.setMeta('payment_mappings', list)
        setLoading(false)
        return
      }
    } catch (err) {
      console.error(err)
    }
    try {
      const cached = await offlineStorage.getMeta<PaymentMethodMapping[]>('payment_mappings')
      if (Array.isArray(cached) && cached.length) setMappings(cached)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const accountLabelByMethod = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of mappings) {
      map.set(row.payment_method, row.bank_account_id ? 'mapped' : 'cash_in_hand')
    }
    return map
  }, [mappings])

  const getDepositHint = useCallback(
    (paymentMethod: string, accounts: { id: string; account_name: string; is_primary?: boolean }[]) => {
      const row = mappings.find((m) => m.payment_method === paymentMethod)
      if (row?.bank_account_id) {
        const acc = accounts.find((a) => a.id === row.bank_account_id)
        return acc?.account_name || 'Mapped account'
      }
      if (paymentMethod === 'cash') {
        return 'Cash in hand'
      }
      const primary = accounts.find((a) => a.is_primary)
      if (primary) {
        return primary.account_name
      }
      return 'Cash in hand'
    },
    [mappings]
  )

  return { mappings, loading, refresh, accountLabelByMethod, getDepositHint }
}

export async function savePaymentMethodMappings(
  mappings: { payment_method: string; bank_account_id: string | null }[]
) {
  return apiFetch('/cash-bank/payment-method-mappings', {
    method: 'PUT',
    body: JSON.stringify({ mappings }),
  })
}
