'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/hooks/useAuth'

export interface BankAccountOption {
  id: string
  account_name: string
  bank_name: string
  account_type: string
  balance: number
  is_primary: boolean
  is_active: boolean
}

export function useBankAccounts() {
  const [accounts, setAccounts] = useState<BankAccountOption[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/cash-bank/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const primaryAccount = accounts.find((a) => a.is_primary && a.is_active)

  return { accounts, primaryAccount, loading, refresh }
}

/** Value for cash-in-hand (no linked bank account). */
export const CASH_IN_HAND_ACCOUNT = '__cash_in_hand__'

export function bankAccountIdForApi(selected: string): string | null {
  if (!selected || selected === CASH_IN_HAND_ACCOUNT) {
    return null
  }
  return selected
}

export function defaultBankAccountSelection(
  accounts: BankAccountOption[],
  primaryAccount?: BankAccountOption
): string {
  if (primaryAccount?.id) {
    return primaryAccount.id
  }
  return CASH_IN_HAND_ACCOUNT
}

export function resolveBankAccountSelection(
  storedId: string | null | undefined,
  accounts: BankAccountOption[]
): string {
  if (!storedId) {
    return CASH_IN_HAND_ACCOUNT
  }
  if (accounts.some((a) => a.id === storedId)) {
    return storedId
  }
  return defaultBankAccountSelection(accounts, accounts.find((a) => a.is_primary))
}
