'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { FieldError } from '@/components/ui/field-error'
import { useFormErrors } from '@/hooks/useFormErrors'
import { cn } from '@/lib/utils'
import {
  firstValidationMessage,
  validateLoginForm,
} from '@/lib/authValidation'

export default function LoginPage() {
  const { login } = useAuth()
  const {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    showErrorToast,
  } = useFormErrors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needs2fa, setNeeds2fa] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validateLoginForm({ email, password, totpCode, needs2fa })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      showErrorToast(firstValidationMessage(errors) || 'Please fix the highlighted fields')
      return
    }
    setLoading(true)
    try {
      const result = await login(email.trim(), password, needs2fa ? totpCode.trim() : undefined)
      if (result.requiresPasswordChange) {
        window.location.href = '/change-password-required'
        return
      }
      const params = new URLSearchParams(window.location.search)
      const next = params.get('next')
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
      window.location.href = dest
    } catch (err: any) {
      if (err.requires2fa) {
        setNeeds2fa(true)
        setError('Enter the 6-digit code from your authenticator app')
      } else {
        setError(err.message)
        showErrorToast(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="TruERP"
              className="h-16 w-16 object-contain"
              width={64}
              height={64}
            />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Login to your TruERP account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  clearFieldError('email')
                  setEmail(e.target.value)
                }}
                className={cn(fieldErrors.email && 'border-red-500')}
                required
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
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
              />
              <FieldError message={fieldErrors.password} />
            </div>
            {needs2fa && (
              <div className="space-y-2">
                <Label htmlFor="totp">Authenticator code</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => {
                    clearFieldError('totpCode')
                    setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }}
                  className={cn(fieldErrors.totpCode && 'border-red-500')}
                  maxLength={6}
                  required
                />
                <FieldError message={fieldErrors.totpCode} />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
