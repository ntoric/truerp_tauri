'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2, IndianRupee, Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { API_BASE, cn } from '@/lib/utils'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const {
    fieldErrors,
    clearFieldError,
    setError: setFieldError,
    showErrorToast,
  } = useFormErrors()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setValidating(false)
      setTokenValid(false)
      return
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/auth/reset-password/validate?token=${encodeURIComponent(token)}`
        )
        const data = await res.json()
        setTokenValid(Boolean(data.valid))
      } catch {
        setTokenValid(false)
      } finally {
        setValidating(false)
      }
    }
    validate()
  }, [token])

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
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setSuccess(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      showErrorToast(message)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!token || !tokenValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-4">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request new link</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Link>
            </Button>
          </CardFooter>
        </Card>
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
            <CardDescription>Your password has been reset. You can now log in.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Go to login</Link>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <IndianRupee className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>Choose a new password for your TruERP account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
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
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reset password
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-blue-600 hover:underline">
                Back to login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
