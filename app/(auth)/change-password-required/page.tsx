'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { API_BASE, cn } from '@/lib/utils'
import { getAuthToken } from '@/lib/authToken'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'

export default function ChangePasswordRequiredPage() {
  const { user, loading, logout, refreshProfile } = useAuth()
  const {
    fieldErrors,
    clearFieldError,
    setError: setFieldError,
    showErrorToast,
  } = useFormErrors()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login'
    }
  }, [loading, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    let valid = true
    if (!password) {
      setFieldError('password', 'Password is required')
      valid = false
    } else if (password.length < 6) {
      setFieldError('password', 'Password must be at least 6 characters')
      valid = false
    }
    if (password !== confirmPassword) {
      setFieldError('confirmPassword', 'Passwords do not match')
      valid = false
    }
    if (!valid) {
      showErrorToast('Please fix the errors below')
      return
    }

    const token = getAuthToken()
    if (!token) {
      window.location.href = '/login'
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update password')
      await refreshProfile()
      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Password updated</CardTitle>
            <CardDescription>Your account is ready. You can continue to the dashboard.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard">Continue to dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white">
              <KeyRound className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set a new password</CardTitle>
          <CardDescription>
            Your account is using a temporary password. Choose a new password to continue using TruERP.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Signed in as <span className="font-medium">{user.email}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  clearFieldError('password')
                  setPassword(e.target.value)
                }}
                className={cn(fieldErrors.password && 'border-red-500')}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <FieldError message={fieldErrors.password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  clearFieldError('confirmPassword')
                  setConfirmPassword(e.target.value)
                }}
                className={cn(fieldErrors.confirmPassword && 'border-red-500')}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save new password
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={logout}>
              Sign out
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
